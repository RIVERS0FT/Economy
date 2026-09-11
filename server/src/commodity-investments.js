import { cashAdd, cashEconomyError, cashFee, cashMicros, cashMoney, cashProduct, cashQuantity, cashTimestamp } from './cash-economy-money.js';
import {
  COMMODITY_INDEX_POLICY_ID, COMMODITY_INVESTMENT_FEE_BPS, COMMODITY_INVESTMENT_HISTORY_LIMIT,
  commodityInvestmentPeriod, commodityInvestmentQuote, requireCashProduct,
} from './commodity-investment-prices.js';

export const COMMODITY_INVESTMENT_ACCOUNT_VERSION = 1;
const SIGNED = { signed: true };

function emptyAccount() {
  return {
    version: COMMODITY_INVESTMENT_ACCOUNT_VERSION, sequence: 0, positions: {}, recentTransactions: [],
    principalDeposited: 0, principalReleased: 0, closeGross: 0, feesPaid: 0,
    realizedProfit: 0, profitIssued: 0, lossCollected: 0,
  };
}

function accountFor(player) {
  return player.commodityInvestmentAccount ?? emptyAccount();
}

function sumPrincipal(account) {
  return Object.values(account.positions).reduce((sum, position) => sum + cashMicros(position.cost, '持仓成本'), 0n);
}

export function assertCommodityInvestmentAccount(player) {
  const account = player?.commodityInvestmentAccount;
  if (account === undefined) return true;
  if (!account || account.version !== COMMODITY_INVESTMENT_ACCOUNT_VERSION
    || !account.positions || Array.isArray(account.positions) || !Array.isArray(account.recentTransactions)) {
    throw cashEconomyError('INVESTMENT_ACCOUNT_INVALID', '商品投资账户结构无效');
  }
  cashQuantity(account.sequence, '投资流水序号', { allowZero: true });
  for (const [key, position] of Object.entries(account.positions)) {
    requireCashProduct(position.productId);
    cashQuantity(position.quantity, '持仓数量');
    cashTimestamp(position.openedAt); cashTimestamp(position.expiresAt);
    const period = commodityInvestmentPeriod(position.openedAt);
    if (position.indexPolicyId !== COMMODITY_INDEX_POLICY_ID || position.expiresAt !== period.endsAt
      || key !== position.contractId || key !== `${position.productId}:${period.key}:${position.indexPolicyId}`) {
      throw cashEconomyError('INVESTMENT_POSITION_INVALID', '商品持仓合约或到期时间不一致');
    }
    const cost = cashMicros(position.cost, '持仓成本');
    if (cost < 10_000n * BigInt(position.quantity)) throw cashEconomyError('INVESTMENT_POSITION_INVALID', '持仓成本不能低于最小正式价');
  }
  const deposited = cashMicros(account.principalDeposited, '累计建仓本金');
  const released = cashMicros(account.principalReleased, '累计结算本金');
  const gross = cashMicros(account.closeGross, '累计结算总额');
  const fee = cashMicros(account.feesPaid, '累计投资费用');
  const realized = cashMicros(account.realizedProfit, '累计已实现损益', SIGNED);
  const issued = cashMicros(account.profitIssued, '投资盈利发行');
  const collected = cashMicros(account.lossCollected, '投资亏损回收');
  if (deposited !== released + sumPrincipal(account) || fee !== cashFee(gross, COMMODITY_INVESTMENT_FEE_BPS)
    || realized !== gross - released - fee || issued - collected !== gross - released) {
    throw cashEconomyError('INVESTMENT_ACCOUNT_UNBALANCED', '商品投资本金、损益或费用不守恒');
  }
  if (account.recentTransactions.length > COMMODITY_INVESTMENT_HISTORY_LIMIT) {
    throw cashEconomyError('INVESTMENT_ACCOUNT_INVALID', '投资流水超过保留上限');
  }
  return true;
}

function draftFor(player) {
  cashMicros(player.credits, '可用资金');
  assertCommodityInvestmentAccount(player);
  return { credits: player.credits, account: structuredClone(accountFor(player)) };
}

function appendTransaction(draft, record) {
  draft.account.sequence = cashQuantity(draft.account.sequence + 1, '投资流水序号');
  const entry = { id: `commodity-investment-${draft.account.sequence}`, ...record };
  draft.account.recentTransactions = [...draft.account.recentTransactions, entry].slice(-COMMODITY_INVESTMENT_HISTORY_LIMIT);
  return entry;
}

function commit(player, draft) {
  cashMicros(draft.credits, '可用资金');
  assertCommodityInvestmentAccount({ commodityInvestmentAccount: draft.account });
  player.credits = draft.credits;
  player.commodityInvestmentAccount = draft.account;
}

function closePosition(draft, position, quantity, quote, at, processedAt, type) {
  if (quantity > position.quantity) throw cashEconomyError('INVESTMENT_HOLDINGS_INSUFFICIENT', '商品期货持仓不足');
  const account = draft.account;
  const costBefore = cashMicros(position.cost);
  const released = quantity === position.quantity ? costBefore : costBefore * BigInt(quantity) / BigInt(position.quantity);
  const gross = cashMicros(cashProduct(quote.price, quantity));
  const nextGross = cashMicros(account.closeGross) + gross;
  const nextFee = cashFee(nextGross, COMMODITY_INVESTMENT_FEE_BPS);
  const fee = nextFee - cashMicros(account.feesPaid);
  const payout = gross - fee;
  const grossProfit = gross - released;
  draft.credits = cashMoney(cashMicros(draft.credits) + payout, '平仓后可用资金');
  account.principalReleased = cashMoney(cashMicros(account.principalReleased) + released, '累计结算本金');
  account.closeGross = cashMoney(nextGross, '累计结算总额');
  account.feesPaid = cashMoney(nextFee, '累计投资费用');
  account.realizedProfit = cashMoney(cashMicros(account.realizedProfit, undefined, SIGNED) + grossProfit - fee, '累计已实现损益', SIGNED);
  account.profitIssued = cashMoney(cashMicros(account.profitIssued) + (grossProfit > 0n ? grossProfit : 0n), '投资盈利发行');
  account.lossCollected = cashMoney(cashMicros(account.lossCollected) + (grossProfit < 0n ? -grossProfit : 0n), '投资亏损回收');
  if (quantity === position.quantity) delete account.positions[position.contractId];
  else {
    position.quantity -= quantity;
    position.cost = cashMoney(costBefore - released, '剩余持仓成本');
  }
  return appendTransaction(draft, {
    type, contractId: position.contractId, productId: position.productId, quantity,
    price: quote.price, priceDateKey: quote.priceDateKey, gross: cashMoney(gross), fee: cashMoney(fee),
    principalReleased: cashMoney(released), cashChange: cashMoney(payout),
    realizedProfit: cashMoney(grossProfit - fee, '已实现损益', SIGNED),
    createdAt: at, processedAt,
  });
}

/** Internal domain command: HTTP idempotency and authentication belong to the runtime action boundary. */
export function applyCommodityInvestmentTrade(world, player, payload, now) {
  cashTimestamp(now);
  if (!payload || (payload.side !== 'buy' && payload.side !== 'sell')) {
    throw cashEconomyError('INVESTMENT_SIDE_INVALID', '投资交易方向无效');
  }
  const quantity = cashQuantity(payload.quantity, '交易数量');
  const quote = commodityInvestmentQuote(world, payload.productId, now);
  if (payload.contractId !== quote.contractId || payload.priceDateKey !== quote.priceDateKey) {
    throw cashEconomyError('INVESTMENT_QUOTE_STALE', '合约或报价已更新，请重新确认');
  }
  const draft = draftFor(player);
  if (Object.values(draft.account.positions).some((position) => position.expiresAt <= now)) {
    throw cashEconomyError('INVESTMENT_EXPIRY_PENDING', '到期持仓尚待正式价格结算');
  }
  const position = draft.account.positions[quote.contractId];
  let record;
  if (payload.side === 'buy') {
    const total = cashProduct(quote.price, quantity);
    if (cashMicros(draft.credits) < cashMicros(total)) throw cashEconomyError('INVESTMENT_FUNDS_INSUFFICIENT', '建仓资金不足');
    const nextQuantity = cashQuantity((position?.quantity ?? 0) + quantity, '持仓数量');
    const nextCost = cashAdd(position?.cost ?? 0, total, '持仓成本');
    draft.credits = cashMoney(cashMicros(draft.credits) - cashMicros(total));
    draft.account.principalDeposited = cashAdd(draft.account.principalDeposited, total, '累计建仓本金');
    draft.account.positions[quote.contractId] = {
      contractId: quote.contractId, productId: quote.productId, indexPolicyId: quote.indexPolicyId,
      expiresAt: quote.expiresAt, openedAt: position?.openedAt ?? now,
      quantity: nextQuantity, cost: nextCost,
    };
    record = appendTransaction(draft, {
      type: 'buy', contractId: quote.contractId, productId: quote.productId, quantity,
      price: quote.price, priceDateKey: quote.priceDateKey, gross: total, fee: 0,
      principalReleased: 0, cashChange: -total, realizedProfit: 0, createdAt: now, processedAt: now,
    });
  } else {
    if (!position) throw cashEconomyError('INVESTMENT_HOLDINGS_INSUFFICIENT', '没有可卖出的商品期货持仓');
    record = closePosition(draft, position, quantity, quote, now, now, 'sell');
  }
  commit(player, draft);
  return { ok: true, message: '', transaction: structuredClone(record) };
}

/** No replay, no automatic roll: one committed expiry removes the position permanently. */
export function settleDueCommodityInvestments(world, player, now) {
  cashTimestamp(now);
  assertCommodityInvestmentAccount(player);
  const due = Object.values(accountFor(player).positions).filter((position) => position.expiresAt <= now)
    .sort((left, right) => left.expiresAt - right.expiresAt || left.contractId.localeCompare(right.contractId));
  if (due.length === 0) return { settled: 0, transactions: [] };
  // Quote every expiry before modifying even a draft, so missing history cannot cause a partial close.
  const quotes = due.map((position) => commodityInvestmentQuote(world, position.productId, position.expiresAt));
  const draft = draftFor(player);
  const transactions = due.map((previous, index) => {
    const position = draft.account.positions[previous.contractId];
    return closePosition(draft, position, position.quantity, quotes[index], position.expiresAt, now, 'expiry');
  });
  commit(player, draft);
  return { settled: due.length, transactions: structuredClone(transactions) };
}

/** Read-only valuation. Unknown prices stay unknown, never masquerade as zero-valued assets. */
export function commodityInvestmentValuation(world, player, now) {
  cashTimestamp(now);
  assertCommodityInvestmentAccount(player);
  const account = accountFor(player);
  let equity = 0n;
  let cost = 0n;
  const positions = [];
  for (const position of Object.values(account.positions)) {
    const quote = commodityInvestmentQuote(world, position.productId, Math.min(now, position.expiresAt));
    const value = cashProduct(quote.price, position.quantity);
    equity += cashMicros(value); cost += cashMicros(position.cost);
    positions.push({ ...structuredClone(position), price: quote.price, priceDateKey: quote.priceDateKey,
      value, averageCost: Number(cashMicros(position.cost) / BigInt(position.quantity)) / 1_000_000,
      unrealizedProfit: cashMoney(cashMicros(value) - cashMicros(position.cost), '浮动损益', SIGNED),
      status: position.expiresAt <= now ? 'expiry-pending' : 'open',
    });
  }
  return {
    equity: cashMoney(equity, '持仓权益'), principal: cashMoney(cost, '持仓本金'),
    unrealizedProfit: cashMoney(equity - cost, '浮动损益', SIGNED),
    realizedProfit: account.realizedProfit, feesPaid: account.feesPaid,
    positions, recentTransactions: structuredClone(account.recentTransactions),
  };
}
