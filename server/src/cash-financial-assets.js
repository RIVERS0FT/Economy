import { cashAdd, cashMicros, cashMoney } from './cash-economy-money.js';
import { commodityInvestmentValuation } from './commodity-investments.js';
import { cashProductionWorkInProgress } from './cash-production-cycles.js';

/** Accounting only; no expiry processing, quote initialization, loans or client-derived prices. */
export function cashFinancialAssets(world, player, at = world.lastProcessedAt, { allowUnavailable = false } = {}) {
  const account = player?.commodityInvestmentAccount;
  let investmentEquity = 0; let investmentPrincipal = 0; let investmentCreditValue = 0;
  if (account) {
    try {
      const valuation = commodityInvestmentValuation(world, player, at);
      investmentEquity = valuation.equity;
      investmentPrincipal = valuation.principal;
      investmentCreditValue = Math.min(investmentEquity, investmentPrincipal);
    } catch (error) {
      if (!allowUnavailable || error.code !== 'CASH_PRICE_UNAVAILABLE') throw error;
      investmentEquity = null; investmentCreditValue = null;
      investmentPrincipal = Object.values(account.positions ?? {}).reduce((sum, row) => cashAdd(sum, row.cost), 0);
    }
  }
  let productionWorkInProgress = cashProductionWorkInProgress(player);
  for (const group of player?.commercialBuildingGroups ?? []) {
    if (group.cashOperatingCycle) productionWorkInProgress = cashAdd(productionWorkInProgress, group.cashOperatingCycle.totalCost);
  }
  return { investmentEquity, investmentPrincipal, investmentCreditValue, productionWorkInProgress,
    valuationAvailable: investmentEquity !== null,
    total: investmentEquity === null ? null : cashAdd(investmentEquity, productionWorkInProgress) };
}

/** The first closing assessment excludes only the converted inventory principal, never trading gains. */
export function cashMigrationWeeklyAdjustment(player, closedAt) {
  const migration = player.cashInventoryMigration;
  if (!migration || migration.weeklyAdjustmentApplied === true || migration.at > closedAt) return 0;
  return cashMoney(cashMicros(migration.liquidationCredits));
}
