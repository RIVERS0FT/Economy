import { cashFee, cashMicros, cashMoney, cashQuantity, cashTimestamp, cashEconomyError } from './cash-economy-money.js';
import { commodityInvestmentQuote, commodityInvestmentPeriod, COMMODITY_INDEX_POLICY_ID, requireCashProduct } from './commodity-investment-prices.js';
import { assertCommodityInvestmentAccount } from './commodity-investments.js';

/** A valuation basis is a liability snapshot, never a second holding or spendable asset. */
export function captureInvestmentAssessmentBasis(player, { type, weekKey, assessedAt, cash, loan, prior }) {
  assertCommodityInvestmentAccount(player);
  cashTimestamp(assessedAt);
  for (const value of [cash, loan, prior]) cashMicros(value);
  const account = player.commodityInvestmentAccount;
  return {
    version: 1, type, weekKey, assessedAt, cash, loan, prior,
    closeGross: account?.closeGross ?? 0, feesPaid: account?.feesPaid ?? 0,
    positions: Object.values(account?.positions ?? {}).map((position) => ({
      productId: position.productId, contractId: position.contractId,
      quantity: position.quantity, expiresAt: position.expiresAt,
    })),
  };
}

/** Reconstruct the original assessment, not the player's later balances or a later market date. */
export function quoteInvestmentAssessmentBasis(world, basis) {
  if (!basis || basis.version !== 1 || !Array.isArray(basis.positions)
    || typeof basis.weekKey !== 'string' || !['active_week', 'returning_player'].includes(basis.type)) {
    throw cashEconomyError('INVESTMENT_ASSESSMENT_INVALID', '待确认周资金结算依据无效');
  }
  cashTimestamp(basis.assessedAt);
  const previousGross = cashMicros(basis.closeGross);
  if (cashMicros(basis.feesPaid) !== cashFee(previousGross)) {
    throw cashEconomyError('INVESTMENT_ASSESSMENT_INVALID', '待确认周资金结算费用依据不一致');
  }
  let portfolio = 0n;
  let expiryGross = 0n;
  const identities = new Set();
  for (const position of basis.positions) {
    const period = commodityInvestmentPeriod(position.expiresAt - 1);
    const expected = `${position.productId}:${period.key}:${COMMODITY_INDEX_POLICY_ID}`;
    if (period.endsAt !== position.expiresAt || position.contractId !== expected || identities.has(expected)) {
      throw cashEconomyError('INVESTMENT_ASSESSMENT_INVALID', '待确认周资金结算合约依据无效');
    }
    identities.add(expected);
    requireCashProduct(position.productId);
    cashTimestamp(position.expiresAt);
    cashQuantity(position.quantity);
    const quote = commodityInvestmentQuote(world, position.productId, Math.min(basis.assessedAt, position.expiresAt));
    const gross = cashMicros(quote.price) * BigInt(position.quantity);
    portfolio += gross;
    if (position.expiresAt <= basis.assessedAt) expiryGross += gross;
  }
  // Normal deadline order settles expiring positions (and their fee) before the assessment.
  const expiryFee = cashFee(previousGross + expiryGross) - cashMicros(basis.feesPaid);
  const assets = cashMicros(basis.cash) + portfolio - expiryFee;
  const loan = cashMicros(basis.loan);
  const prior = cashMicros(basis.prior);
  return {
    currencyAssets: cashMoney(assets), loanLiability: cashMoney(loan), priorSettlementLiability: cashMoney(prior),
    taxBase: cashMoney(assets > loan + prior ? assets - loan - prior : 0n),
  };
}
