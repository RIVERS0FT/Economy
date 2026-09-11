import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, ensurePlayer, commoditySystemPriceFor, FACILITY_TYPE_CATALOG } from '../src/domain.js';
import { inventoryForProvince, PROVINCE_CATALOG } from '../src/provinces.js';
import { freezeCommodity } from '../src/commodity-freezes.js';
import { EconomyStore } from '../src/runtime-store.js';
import { applyCommodityInvestmentTrade, commodityInvestmentValuation } from '../src/commodity-investments.js';
import { archiveCashPriceDay, cashDateKey, commodityInvestmentQuote } from '../src/commodity-investment-prices.js';
import {
  assertCashProductionCycle, cashProductionWorkInProgress, pauseCashProductionCycle,
  quoteCashProductionCycle, settleCashProductionCycle, startCashProductionCycle,
} from '../src/cash-production-cycles.js';
import { createRuntimeMutationScope, cloneWorldForMutation } from '../src/world-storage-v2.js';
import { cashMicros } from '../src/cash-economy-money.js';

const NOW = Date.parse('2026-09-10T08:00:00Z');
const USER = { id: 902, name: 'cash-production-test' };
function setup(now = NOW) {
  const world = createWorld(now); const player = ensurePlayer(world, USER, now); player.credits = 10000;
  const type = FACILITY_TYPE_CATALOG.find((row) => row.id === 'mill');
  const group = {
    provinceId: '110000', facilityTypeId: type.id, activeRecipeId: type.defaultRecipeId,
    count: 2, enabled: true, status: 'stopped', staffingRateBps: 10000,
    staffingUpdatedAt: now, staffingBatchCarryBps: 0, lifetimeOutput: 0,
  };
  player.facilityGroups = [group];
  const recipe = type.recipes.find((row) => row.id === group.activeRecipeId);
  for (const row of [...recipe.inputs, recipe.output]) commoditySystemPriceFor(world, row.productId, group.provinceId, now);
  return { world, player, group, recipe };
}
function shape(world) { return structuredClone(world); }

test('a production start buys and consumes inputs directly and preserves total cost as work in progress', () => {
  const { world, player, group, recipe } = setup();
  const beforeInventory = structuredClone(player.inventories);
  const quote = quoteCashProductionCycle(world, player, group, NOW);
  const result = startCashProductionCycle(world, player, group, NOW, { manual: true });
  assert.equal(result.started, true);
  assert.equal(cashMicros(player.credits) + cashMicros(cashProductionWorkInProgress(player)), 10000000000n);
  assert.equal(cashProductionWorkInProgress(player), quote.totalCost);
  assert.equal(result.cycle.inputs.length, recipe.inputs.length);
  assert.deepEqual(player.inventories, beforeInventory);
  for (const row of quote.inputs) assert.equal(world.markets[`110000:${row.productId}`].todayBuyQuantity, row.quantity);
  assert.equal(result.employment.payerAmount, quote.operatingCost);
  assertCashProductionCycle(group);
});

test('completion pays cash exactly once, never creates output stock and never sells unrelated holdings', () => {
  const { world, player, group, recipe } = setup();
  const output = inventoryForProvince(player, recipe.output.productId, '110000'); output.available = 123;
  freezeCommodity(output, 'contract', 'other-owner', 20);
  const beforeInventory = structuredClone(player.inventories);
  const { cycle } = startCashProductionCycle(world, player, group, NOW, { manual: true });
  const cashBefore = player.credits;
  assert.equal(settleCashProductionCycle(world, player, group, cycle.completesAt - 1).settled, false);
  const result = settleCashProductionCycle(world, player, group, cycle.completesAt);
  assert.equal(result.settled, true);
  assert.equal(cashMicros(player.credits) - cashMicros(cashBefore), cashMicros(result.settlement.revenue));
  assert.equal(result.settlement.revenue, result.settlement.gross - result.settlement.fee);
  assert.equal(group.lifetimeOutput, cycle.output.quantity);
  assert.equal(cashProductionWorkInProgress(player), 0);
  assert.deepEqual(player.inventories, beforeInventory);
  const before = shape(world);
  assert.equal(settleCashProductionCycle(world, player, group, cycle.completesAt + 10000).settled, false);
  assert.deepEqual(world, before);
});

test('investment assets are neither consumed as inputs nor liquidated when an industrial cycle completes', () => {
  const { world, player, group } = setup();
  for (const province of PROVINCE_CATALOG) commoditySystemPriceFor(world, 'wheat', province.id, NOW);
  const quote = commodityInvestmentQuote(world, 'wheat', NOW);
  applyCommodityInvestmentTrade(world, player, { ...quote, side: 'buy', quantity: 100 }, NOW);
  const investmentBefore = structuredClone(player.commodityInvestmentAccount);
  const valueBefore = commodityInvestmentValuation(world, player, NOW).principal;
  const { cycle } = startCashProductionCycle(world, player, group, NOW, { manual: true });
  settleCashProductionCycle(world, player, group, cycle.completesAt);
  assert.deepEqual(player.commodityInvestmentAccount, investmentBefore);
  assert.equal(commodityInvestmentValuation(world, player, NOW).principal, valueBefore);
});

test('insufficient cash never buys a partial recipe, changes carry, advances a sequence or writes volume', () => {
  const { world, player, group } = setup(); player.credits = 0.01;
  const before = shape(world);
  assert.deepEqual(startCashProductionCycle(world, player, group, NOW, { manual: true }), {
    started: false, reason: 'insufficient_funds', employment: null,
  });
  assert.deepEqual(world, before);
});

test('repeating start on the same in-flight cycle cannot charge its inputs twice', () => {
  const { world, player, group } = setup();
  startCashProductionCycle(world, player, group, NOW, { manual: true });
  const before = shape(world);
  assert.equal(startCashProductionCycle(world, player, group, NOW + 1, { manual: true }).started, false);
  assert.deepEqual(world, before);
});

test('stopping, changing the selected recipe and expanding cannot refund or rewrite an already paid cycle', () => {
  const { world, player, group } = setup();
  const { cycle } = startCashProductionCycle(world, player, group, NOW, { manual: true });
  const cashBefore = player.credits;
  pauseCashProductionCycle(player, group, NOW + 1);
  group.count += 100;
  group.activeRecipeId = FACILITY_TYPE_CATALOG.find((row) => row.id === 'mill').recipes.at(-1).id;
  assert.equal(player.credits, cashBefore);
  assert.deepEqual(group.cashCycle, cycle);
  const result = settleCashProductionCycle(world, player, group, cycle.completesAt);
  assert.equal(result.settlement.output.quantity, cycle.output.quantity);
  assert.equal(group.enabled, false);
  assert.equal(group.status, 'stopped');
});

test('completion uses the original completion-day price while late volume does not change today', () => {
  const at = Date.parse('2026-09-10T15:59:50Z');
  const { world, player, group, recipe } = setup(at);
  const { cycle } = startCashProductionCycle(world, player, group, at, { manual: true });
  const market = world.markets[`110000:${recipe.output.productId}`];
  market.priceDateKey = cashDateKey(cycle.completesAt); market.officialPrice = 20;
  archiveCashPriceDay(world, cycle.completesAt);
  const later = cycle.completesAt + 5 * 86400000;
  market.priceDateKey = cashDateKey(later); market.officialPrice = 30; market.todaySellQuantity = 0;
  const result = settleCashProductionCycle(world, player, group, later);
  assert.equal(result.settlement.price, 20);
  assert.equal(result.settlement.priceDateKey, cashDateKey(cycle.completesAt));
  const updated = world.markets[`110000:${recipe.output.productId}`];
  assert.equal(updated.todaySellQuantity, 0);
  assert.equal(updated.dailyHistory.find((row) => row.dateKey === cashDateKey(cycle.completesAt)).sellQuantity, cycle.output.quantity);
});

test('missing completion-day price leaves the paid cycle and funds intact for recovery', () => {
  const at = Date.parse('2026-09-10T15:59:50Z');
  const { world, player, group } = setup(at);
  const { cycle } = startCashProductionCycle(world, player, group, at, { manual: true });
  const before = shape(world);
  assert.throws(() => settleCashProductionCycle(world, player, group, cycle.completesAt), { code: 'CASH_PRICE_UNAVAILABLE' });
  assert.deepEqual(world, before);
});

test('automatic operation refuses a nonpositive expected margin; an explicit manual cycle may run', () => {
  const { world, player, group, recipe } = setup();
  world.markets[`110000:${recipe.output.productId}`].officialPrice = 0.01;
  assert.equal(startCashProductionCycle(world, player, group, NOW).reason, 'unprofitable');
  assert.equal(startCashProductionCycle(world, player, group, NOW, { manual: true }).started, true);
  const result = settleCashProductionCycle(world, player, group, group.cashCycle.completesAt);
  assert.ok(result.settlement.profit < 0);
});

test('late processing settles only the one prepaid cycle and never invents offline inputs or output', () => {
  const { world, player, group } = setup();
  const { cycle } = startCashProductionCycle(world, player, group, NOW, { manual: true });
  archiveCashPriceDay(world, cycle.completesAt);
  settleCashProductionCycle(world, player, group, NOW + 30 * 86400000);
  assert.equal(group.lifetimeOutput, cycle.output.quantity);
  assert.equal(group.cashCycle, null);
  assert.equal(group.staffingRateBps, 0);
});

test('tampered period costs and sequence cannot produce a settlement', () => {
  const { world, player, group } = setup();
  startCashProductionCycle(world, player, group, NOW, { manual: true });
  group.cashCycle.totalCost += 0.01;
  assert.throws(() => settleCashProductionCycle(world, player, group, group.cashCycle.completesAt), { code: 'CASH_CYCLE_INVALID' });
  group.cashCycle.totalCost -= 0.01;
  group.cashLastCompletedSequence = group.cashCycle.sequence;
  assert.throws(() => assertCashProductionCycle(group), { code: 'CASH_CYCLE_INVALID' });
});

test('start is compatible with scoped copy-on-write and does not mutate another draft or cached market', () => {
  const { world } = setup();
  const original = shape(world);
  const scope = createRuntimeMutationScope(world, USER.id, 'startFacility', { provinceId: '110000', facilityTypeId: 'mill' }, { scheduledProcessing: true });
  const draft = cloneWorldForMutation(world, scope); const player = draft.players[String(USER.id)];
  startCashProductionCycle(draft, player, player.facilityGroups[0], NOW, { manual: true });
  assert.deepEqual(world, original);
  assert.ok(player.cashOperatingStats.materialsPaid > 0);
});

test('real SQLite rollback restores both prepaid cycle and cash after a failed enclosing transaction', () => {
  const store = new EconomyStore(':memory:');
  try {
    store.transaction(() => {
      const loaded = store.loadWorld(NOW); const { world, player } = setup();
      loaded.world.players[String(USER.id)] = player;
      Object.assign(loaded.world.markets, world.markets);
      store.saveWorldIfChanged(loaded.revision, loaded.world, NOW, loaded.stateJson);
    });
    assert.throws(() => store.transaction(() => {
      const loaded = store.loadWorld(NOW); const player = loaded.world.players[String(USER.id)];
      startCashProductionCycle(loaded.world, player, player.facilityGroups[0], NOW, { manual: true });
      store.saveWorldIfChanged(loaded.revision, loaded.world, NOW, loaded.stateJson);
      throw new Error('rollback prepaid cycle');
    }), /rollback prepaid cycle/);
    store.transaction(() => {
      const player = store.loadWorld(NOW).world.players[String(USER.id)];
      assert.equal(player.credits, 10000);
      assert.equal(player.facilityGroups[0].cashCycle, undefined);
    });
  } finally { store.close(); }
});
