import { PRODUCT_CATALOG } from './product-catalog.js';
import { cashAdd, cashEconomyError, cashFee, cashMicros, cashMoney, cashTimestamp } from './cash-economy-money.js';
import {
  applyCommodityInvestmentTrade, assertCommodityInvestmentAccount, commodityInvestmentValuation,
  settleDueCommodityInvestments,
} from './commodity-investments.js';
import { commodityInvestmentQuote } from './commodity-investment-prices.js';
import { creditPopulationEmployment } from './population-economy.js';
import { assertCommodityInvestmentLedger } from './commodity-investment-ledger.js';
import { stageCommodityInvestmentAudit } from './commodity-investment-audit.js';

const RECOVERABLE_PRICE_ERRORS = new Set(['CASH_PRICE_UNAVAILABLE', 'CASH_PRICE_CONFLICT', 'CASH_PRICE_INVALID']);

export function isInvestmentPriceUnavailable(error) {
  return RECOVERABLE_PRICE_ERRORS.has(error?.code);
}

/** Only read-only projections may expose unknown equity; financial writes use the strict function. */
export function readInvestmentFinancialPosition(world, player, now = world.lastProcessedAt) {
  try { return investmentFinancialPosition(world, player, now); }
  catch (error) {
    if (!isInvestmentPriceUnavailable(error)) throw error;
    return { equity: null, principal: investmentBookValue(player), prudentValue: null, unrealizedProfit: null };
  }
}

export function cashEconomyActive(world) {
  return world?.cashEconomy?.version === 1;
}

/** Price failure never turns an existing asset into a zero balance. */
export function investmentFinancialPosition(world, player, now = world.lastProcessedAt) {
  assertCommodityInvestmentAccount(player);
  if (!Object.keys(player.commodityInvestmentAccount?.positions ?? {}).length) {
    return { equity: 0, principal: 0, prudentValue: 0, unrealizedProfit: 0 };
  }
  const at = cashTimestamp(now);
  const valuation = commodityInvestmentValuation(world, player, at);
  return {
    equity: valuation.equity,
    principal: valuation.principal,
    prudentValue: cashMoney(valuation.positions.reduce((total, position) => (
      total + cashMicros(Math.min(position.value, position.cost))
    ), 0n)),
    unrealizedProfit: valuation.unrealizedProfit,
  };
}

/** Cost-only account value is used only for the historical operating-growth baseline. */
export function investmentBookValue(player) {
  assertCommodityInvestmentAccount(player);
  let amount = 0n;
  for (const position of Object.values(player.commodityInvestmentAccount?.positions ?? {})) amount += cashMicros(position.cost);
  return cashMoney(amount, '商品投资账面本金');
}

function recordTransactions(world, player, transactions) {
  for (const transaction of transactions) {
    const previous = world.commodityInvestmentLedger ?? {
      version: 1, principalDeposited: 0, principalReleased: 0,
      profitIssued: 0, lossCollected: 0, feesPaid: 0, closeGross: 0, transactions: 0,
    };
    const grossProfit = cashMicros(transaction.gross) - cashMicros(transaction.principalReleased);
    const isBuy = transaction.type === 'buy';
    const next = {
      ...previous,
      principalDeposited: cashAdd(previous.principalDeposited, isBuy ? transaction.gross : 0),
      principalReleased: cashAdd(previous.principalReleased, transaction.principalReleased),
      closeGross: cashAdd(previous.closeGross, isBuy ? 0 : transaction.gross),
      profitIssued: cashAdd(previous.profitIssued, !isBuy && grossProfit > 0n ? cashMoney(grossProfit) : 0),
      lossCollected: cashAdd(previous.lossCollected, !isBuy && grossProfit < 0n ? cashMoney(-grossProfit) : 0),
      feesPaid: cashAdd(previous.feesPaid, transaction.fee),
      transactions: previous.transactions + 1,
    };
    if (!Number.isSafeInteger(next.transactions)) throw cashEconomyError('INVESTMENT_LEDGER_RANGE', '投资总流水数量超出系统范围');
    // Market-service employment is funded by the fee, not by creating an extra player receipt.
    if (transaction.fee > 0) creditPopulationEmployment(world, transaction.fee, 'marketService');
    world.commodityInvestmentLedger = next;
    assertCommodityInvestmentLedger(world);
    stageCommodityInvestmentAudit(world, player, transaction);
  }
}

export function settlePlayerCommodityInvestments(world, player, now) {
  const result = settleDueCommodityInvestments(world, player, now);
  recordTransactions(world, player, result.transactions);
  return result;
}

export function applyCommodityInvestmentAction(world, player, payload, now) {
  if (!cashEconomyActive(world)) return { ok: false, message: '商品投资尚未启用，资产迁移完成后开放' };
  if (payload?.side === 'buy' && (player.weeklyCashSettlement?.pendingInvestmentAssessment || player.bankAccount?.creditLoan?.defaultedAt > 0
    || Number(player.weeklyCashSettlement?.pendingSettlement?.amountOutstanding || 0) > 0)) {
    return { ok: false, message: '请先结清到期欠款，再新增商品投资' };
  }
  const result = applyCommodityInvestmentTrade(world, player, payload, now);
  recordTransactions(world, player, [result.transaction]);
  return result;
}

/** Due financial contracts are processed after daily quotes and before weekly cash assessment. */
export function processCommodityInvestmentWorld(world, now) {
  let settled = 0;
  for (const player of Object.values(world.players ?? {})) {
    if (!Object.values(player.commodityInvestmentAccount?.positions ?? {}).some((position) => position.expiresAt <= now)) continue;
    try {
      settled += settlePlayerCommodityInvestments(world, player, now).settled;
    } catch (error) {
      if (!RECOVERABLE_PRICE_ERRORS.has(error?.code)) throw error;
      // Keep the entire account intact. An unrelated player's valid settlement is not blocked by missing history.
    }
  }
  return settled;
}

export function nextCommodityInvestmentDeadline(world, now) {
  let deadline = null;
  for (const player of Object.values(world.players ?? {})) {
    for (const position of Object.values(player.commodityInvestmentAccount?.positions ?? {})) {
      let at = position.expiresAt;
      if (at <= now) {
        try { commodityInvestmentQuote(world, position.productId, at); }
        catch (error) {
          if (!RECOVERABLE_PRICE_ERRORS.has(error?.code)) throw error;
          // Missing historical prices need repair, not a hot loop of zero-delay scheduler wakeups.
          at = now + 60_000;
        }
      }
      deadline = deadline === null ? at : Math.min(deadline, at);
    }
  }
  return deadline;
}

/** Private positions and public quotes use different existing state partitions. */
export function createCommodityInvestmentClientState(world, player, now) {
  const enabled = cashEconomyActive(world);
  const quotes = {};
  if (enabled) {
    for (const product of PRODUCT_CATALOG) {
      try { quotes[product.id] = { ...commodityInvestmentQuote(world, product.id, now), available: true }; }
      catch (error) {
        if (!RECOVERABLE_PRICE_ERRORS.has(error?.code)) throw error;
        quotes[product.id] = { productId: product.id, available: false, message: error.message };
      }
    }
  }
  let account;
  try { account = { ...commodityInvestmentValuation(world, player, now), valuationAvailable: true }; }
  catch (error) {
    if (!RECOVERABLE_PRICE_ERRORS.has(error?.code)) throw error;
    assertCommodityInvestmentAccount(player);
    account = {
      equity: null, principal: investmentBookValue(player), unrealizedProfit: null,
      realizedProfit: player.commodityInvestmentAccount?.realizedProfit ?? 0,
      feesPaid: player.commodityInvestmentAccount?.feesPaid ?? 0,
      positions: Object.values(player.commodityInvestmentAccount?.positions ?? {}).map((position) => ({
        ...structuredClone(position), value: null, price: null, averageCost: null, unrealizedProfit: null,
        status: position.expiresAt <= now ? 'expiry-pending' : 'open',
      })),
      recentTransactions: structuredClone(player.commodityInvestmentAccount?.recentTransactions ?? []),
      valuationAvailable: false, message: error.message,
    };
  }
  return { commodityInvestmentQuotes: quotes, commodityInvestment: { ...account, enabled } };
}

/** Explicit bank-default liquidation uses actual index proceeds; it is not ordinary auto-operation. */
export function collectCommodityInvestmentForDebt(world, player, requiredCredits, now) {
  let remaining = cashMicros(requiredCredits);
  if (remaining === 0n) return 0;
  const before = cashMicros(player.credits);
  try { settlePlayerCommodityInvestments(world, player, now); }
  catch (error) { if (RECOVERABLE_PRICE_ERRORS.has(error?.code)) return 0; throw error; }
  remaining -= cashMicros(player.credits) - before;
  const positions = Object.values(player.commodityInvestmentAccount?.positions ?? {})
    .sort((a, b) => a.contractId.localeCompare(b.contractId));
  for (const position of positions) {
    if (remaining <= 0n) break;
    let quote;
    try { quote = commodityInvestmentQuote(world, position.productId, now); }
    catch (error) { if (RECOVERABLE_PRICE_ERRORS.has(error?.code)) continue; throw error; }
    if (quote.contractId !== position.contractId) continue;
    const unitMicros = cashMicros(quote.price);
    // Find the fewest whole units covering the remaining debt under the actual cumulative fee.
    // A fixed +1 approximation can over-liquidate expensive positions.
    const closedGross = cashMicros(player.commodityInvestmentAccount.closeGross);
    const paidFee = cashMicros(player.commodityInvestmentAccount.feesPaid);
    const proceeds = (units) => {
      const gross = unitMicros * BigInt(units);
      return gross - (cashFee(closedGross + gross) - paidFee);
    };
    let lower = 1;
    let upper = position.quantity;
    while (lower < upper) {
      const middle = lower + Math.floor((upper - lower) / 2);
      if (proceeds(middle) >= remaining) upper = middle;
      else lower = middle + 1;
    }
    const quantity = lower;
    const result = applyCommodityInvestmentTrade(world, player, { ...quote, side: 'sell', quantity }, now);
    const transaction = { ...result.transaction, type: 'bank-collection' };
    // Keep the account's visible record consistent with the durable audit.
    player.commodityInvestmentAccount.recentTransactions.at(-1).type = transaction.type;
    recordTransactions(world, player, [transaction]);
    remaining -= cashMicros(transaction.cashChange);
  }
  return cashMoney(cashMicros(player.credits) - before);
}
