import { cashEconomyError, cashMicros, cashQuantity } from './cash-economy-money.js';
import { assertCommodityInvestmentAccount } from './commodity-investments.js';

/** Constant-time hot-path checks. Full reconciliation is reserved for an all-player boundary. */
export function assertCommodityInvestmentLedger(world, { allPlayers = false } = {}) {
  const ledger = world.commodityInvestmentLedger;
  if (ledger === undefined) return true;
  if (!ledger || ledger.version !== 1) throw cashEconomyError('INVESTMENT_LEDGER_INVALID', '投资结算账本版本无效');
  cashQuantity(ledger.transactions, '投资总流水序号', { allowZero: true });
  const held = cashMicros(ledger.principalDeposited) - cashMicros(ledger.principalReleased);
  const closed = cashMicros(ledger.closeGross);
  if (held < 0n || cashMicros(ledger.feesPaid) > closed
    || cashMicros(ledger.profitIssued) - cashMicros(ledger.lossCollected) !== closed - cashMicros(ledger.principalReleased)) {
    throw cashEconomyError('INVESTMENT_LEDGER_UNBALANCED', '投资结算本金、损益或费用不守恒');
  }
  if (allPlayers) {
    let principal = 0n;
    for (const player of Object.values(world.players || {})) {
      assertCommodityInvestmentAccount(player);
      for (const position of Object.values(player.commodityInvestmentAccount?.positions || {})) principal += cashMicros(position.cost);
    }
    if (principal !== held) throw cashEconomyError('INVESTMENT_LEDGER_UNBALANCED', '投资托管本金与持仓合计不一致');
  }
  return true;
}
