import { PRODUCT_CATALOG } from './product-catalog.js';
import { cashAdd, cashEconomyError, cashMicros, cashMoney, cashTimestamp } from './cash-economy-money.js';
import { cashDateKey, commodityInvestmentQuote } from './commodity-investment-prices.js';
import {
  applyCommodityInvestmentTrade, assertCommodityInvestmentAccount, commodityInvestmentValuation,
  collectCommodityInvestments, settleDueCommodityInvestments,
} from './commodity-investments.js';
import { creditPopulationEmployment } from './population-economy.js';

const HISTORY_LIMIT = 100;
const RETRY_MS = 60_000;

function requireEnabled(world) {
  if (world.cashEconomy?.version !== 1) throw cashEconomyError('INVESTMENT_NOT_ENABLED', '当前经营版本尚未开放商品期货');
}

/** Only the owning player and accounting segments are mutable; quotes never become market trades. */
function execute(world, player, now, command) {
  requireEnabled(world);
  cashTimestamp(now);
  assertCommodityInvestmentAccount(player);
  const draft = { ...player, stats: { ...(player.stats ?? {}) } };
  const result = command(draft);
  const records = result.transactions ?? (result.transaction ? [result.transaction] : []);
  if (!records.length) return result;
  const before = world.commodityInvestmentAudit ?? {
    version: 1, principalDeposited: 0, principalReleased: 0, grossSettled: 0,
    feesPaid: 0, profitIssued: 0, lossCollected: 0, transactionCount: 0,
  };
  if (before.version !== 1) throw cashEconomyError('INVESTMENT_AUDIT_INVALID', '投资审计版本无效');
  const audit = { ...before };
  let fees = 0n;
  for (const record of records) {
    audit.transactionCount += 1;
    if (!Number.isSafeInteger(audit.transactionCount)) throw cashEconomyError('INVESTMENT_AUDIT_INVALID', '投资流水数量超出范围');
    if (record.type === 'buy') audit.principalDeposited = cashAdd(audit.principalDeposited, record.gross);
    else {
      audit.principalReleased = cashAdd(audit.principalReleased, record.principalReleased);
      audit.grossSettled = cashAdd(audit.grossSettled, record.gross);
      const difference = cashMicros(record.gross) - cashMicros(record.principalReleased);
      if (difference > 0n) audit.profitIssued = cashAdd(audit.profitIssued, cashMoney(difference));
      else audit.lossCollected = cashAdd(audit.lossCollected, cashMoney(-difference));
    }
    fees += cashMicros(record.fee);
  }
  const fee = cashMoney(fees);
  audit.feesPaid = cashAdd(audit.feesPaid, fee);
  draft.stats.investmentFeesPaid = cashAdd(draft.stats.investmentFeesPaid ?? 0, fee);
  draft.stats.investmentRealizedProfit = draft.commodityInvestmentAccount.realizedProfit;
  // Prepare the employment change on an isolated segment before committing either side.
  const employmentWorld = { ...world, populationEconomy: structuredClone(world.populationEconomy) };
  creditPopulationEmployment(employmentWorld, fee, 'marketService');
  Object.assign(player, { credits: draft.credits, commodityInvestmentAccount: draft.commodityInvestmentAccount, stats: draft.stats });
  world.commodityInvestmentAudit = audit;
  if (fees > 0n) world.populationEconomy = employmentWorld.populationEconomy;
  return result;
}

export function executeCommodityInvestmentTrade(world, player, payload, now) {
  return execute(world, player, now, (draft) => applyCommodityInvestmentTrade(world, draft, payload, now));
}

export function settlePlayerCommodityInvestments(world, player, now) {
  if (!player.commodityInvestmentAccount) return { settled: 0, transactions: [] };
  return execute(world, player, now, (draft) => settleDueCommodityInvestments(world, draft, now));
}

/** Bank collection is an explicit internal authority, never a client-selectable trade mode. */
export function collectPlayerCommodityInvestments(world, player, targetCredits, now) {
  if (!player.commodityInvestmentAccount) return { transactions: [] };
  return execute(world, player, now, (draft) => collectCommodityInvestments(world, draft, targetCredits, now));
}

export function nextCommodityInvestmentDeadline(world, now) {
  let earliest = null;
  for (const player of Object.values(world.players ?? {})) {
    for (const position of Object.values(player.commodityInvestmentAccount?.positions ?? {})) {
      const retryAt = Number(player.commodityInvestmentExpiryRetryAt ?? 0);
      const deadline = Math.max(position.expiresAt, retryAt);
      earliest = earliest === null ? deadline : Math.min(earliest, deadline);
    }
  }
  return earliest;
}

/** Missing historic quotes preserve ownership; other players' due positions still settle. */
export function processCommodityInvestmentWorld(world, now) {
  if (world.cashEconomy?.version !== 1) return false;
  let changed = false;
  for (const player of Object.values(world.players ?? {})) {
    if (Number(player.commodityInvestmentExpiryRetryAt ?? 0) > now) continue;
    try {
      const result = settlePlayerCommodityInvestments(world, player, now);
      changed ||= result.settled > 0;
      if (player.commodityInvestmentExpiryError) {
        delete player.commodityInvestmentExpiryError;
        delete player.commodityInvestmentExpiryRetryAt;
        changed = true;
      }
    } catch (error) {
      if (error.code !== 'CASH_PRICE_UNAVAILABLE') throw error;
      player.commodityInvestmentExpiryError = '到期价格待核对，持仓和本金保留';
      player.commodityInvestmentExpiryRetryAt = now + RETRY_MS;
      changed = true;
    }
  }
  return changed;
}

/** One shared quote projection per immutable world/date; reading cannot create markets or positions. */
const quoteCache = new WeakMap();
export function createCommodityInvestmentClientState(world, player, now) {
  if (world.cashEconomy?.version !== 1) return {};
  const dateKey = cashDateKey(now);
  const previous = quoteCache.get(world);
  let quotes = previous?.markets === world.markets && previous.archive === world.cashPriceArchive
    && previous.dateKey === dateKey ? previous.quotes : null;
  if (!quotes) {
    quotes = PRODUCT_CATALOG.map((product) => {
      try { return { ...commodityInvestmentQuote(world, product.id, now), available: true }; }
      catch (error) {
        if (error.code !== 'CASH_PRICE_UNAVAILABLE') throw error;
        return { productId: product.id, available: false, message: '正式指数报价尚未就绪' };
      }
    });
    quoteCache.set(world, { markets: world.markets, archive: world.cashPriceArchive, dateKey, quotes });
  }
  let account;
  try { account = { ...commodityInvestmentValuation(world, player, now), valuationAvailable: true }; }
  catch (error) {
    if (error.code !== 'CASH_PRICE_UNAVAILABLE') throw error;
    // Null is intentionally distinct from a zero-valued holding.
    account = { valuationAvailable: false, equity: null, unrealizedProfit: null,
      principal: Object.values(player.commodityInvestmentAccount?.positions ?? {}).reduce((sum, row) => cashAdd(sum, row.cost), 0),
      realizedProfit: player.commodityInvestmentAccount?.realizedProfit ?? 0,
      feesPaid: player.commodityInvestmentAccount?.feesPaid ?? 0,
      closeGross: player.commodityInvestmentAccount?.closeGross ?? 0,
      positions: Object.values(player.commodityInvestmentAccount?.positions ?? {}).map((row) => ({ ...structuredClone(row),
        price: null, value: null, averageCost: row.cost / row.quantity, unrealizedProfit: null,
        status: row.expiresAt <= now ? 'expiry-pending' : 'open' })),
      recentTransactions: structuredClone(player.commodityInvestmentAccount?.recentTransactions ?? []).slice(-HISTORY_LIMIT),
    };
  }
  return { commodityInvestment: { ...account, expiryMessage: player.commodityInvestmentExpiryError ?? '' },
    commodityInvestmentQuotes: structuredClone(quotes) };
}
