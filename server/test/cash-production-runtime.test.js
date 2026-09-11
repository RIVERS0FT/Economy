import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, ensurePlayer, commoditySystemPriceFor, FACILITY_TYPE_CATALOG, PRODUCT_CATALOG, processWorld } from '../src/domain.js';
import { applyFacilityGroupAction, migrateFacilityGroupWorld, createFacilityGroupClientState } from '../src/facility-groups.js';
import { processCashProductionGroup, processCashProductionForPlayer, nextCashProductionDeadline } from '../src/cash-production-runtime.js';
import { applyProductionSettlementClaim } from '../src/production-settlement.js';
import { completeBuildingCycleAutoOperation } from '../src/cycle-auto-operation.js';
import { reconcileBuildingInputFreezes } from '../src/building-input-freezes.js';
import { ensurePlayerResearch } from '../src/research.js';
import { applyCommercialBuildingAction, COMMERCIAL_BUILDING_TYPE_CATALOG, processCommercialWorld } from '../src/commercial-buildings.js';
import { cashFinancialAssets } from '../src/cash-financial-assets.js';
import { cashMicros } from '../src/cash-economy-money.js';
import { applyCommodityInvestmentTrade } from '../src/commodity-investments.js';
import { commodityInvestmentQuote, cashDateKey } from '../src/commodity-investment-prices.js';
import { PROVINCE_CATALOG } from '../src/provinces.js';
import { createRuntimeMutationScope, cloneWorldForMutation } from '../src/world-storage-v2.js';

const NOW = Date.parse('2026-09-10T08:00:00Z');
const USER = { id: 912, name: 'cash-runtime' };
const PROVINCE = '110000';
function setup({ group = true } = {}) {
  const world = createWorld(NOW); const player = ensurePlayer(world, USER, NOW);
  world.cashEconomy = { version: 1, activatedAt: NOW };
  player.credits = 10000;
  ensurePlayerResearch(world, player, NOW);
  player.research.completedTechnologyIds.push('urban-commerce', 'department-retail');
  for (const product of PRODUCT_CATALOG) commoditySystemPriceFor(world, product.id, PROVINCE, NOW);
  const type = FACILITY_TYPE_CATALOG.find((row) => row.id === 'mill');
  const factory = { facilityTypeId: type.id, provinceId: PROVINCE, count: 2, activeRecipeId: type.defaultRecipeId,
    enabled: true, status: 'stopped', staffingRateBps: 10000, staffingUpdatedAt: NOW,
    staffingBatchCarryBps: 0, lifetimeOutput: 0 };
  player.facilityGroups = group ? [factory] : [];
  return { world, player, factory, type };
}
function action(world, name, payload, at = NOW) {
  return applyFacilityGroupAction(world, USER, name, { provinceId: PROVINCE, ...payload }, at, { migrate: false, process: false });
}

test('actual production start/completion allocates wages and fees once and never touches inventory', () => {
  const { world, player, factory } = setup();
  const inventory = structuredClone(player.inventories);
  const wageBefore = world.populationEconomy.stats.totalEmploymentIncome;
  assert.equal(action(world, 'startFacility', { facilityTypeId: factory.facilityTypeId }).ok, true);
  const cycle = structuredClone(factory.cashCycle);
  assert.ok(cycle);
  assert.equal(cashMicros(world.populationEconomy.stats.totalEmploymentIncome) - cashMicros(wageBefore), cashMicros(cycle.wage));
  factory.enabled = false;
  processCashProductionForPlayer(world, player, cycle.completesAt);
  assert.equal(factory.lifetimeOutput, cycle.output.quantity);
  assert.deepEqual(player.inventories, inventory);
  const balance = player.credits; const income = world.populationEconomy.stats.totalEmploymentIncome;
  processCashProductionForPlayer(world, player, cycle.completesAt + 1);
  assert.equal(player.credits, balance);
  assert.equal(world.populationEconomy.stats.totalEmploymentIncome, income);
});

test('legacy client production claims cannot create fictitious cash output', () => {
  const { world, player, factory } = setup();
  processCashProductionForPlayer(world, player, NOW);
  const before = player.credits;
  applyProductionSettlementClaim(world, USER.id, { settleThrough: NOW + 999999999, groups: [{ completedCycles: 999999 }] }, NOW + 1);
  assert.equal(player.credits, before);
  assert.equal(factory.lifetimeOutput, 0);
});

test('stopping through the actual action preserves the paid cycle across normalization and completes it', () => {
  const { world, player, factory } = setup();
  processCashProductionForPlayer(world, player, NOW);
  const cycle = structuredClone(factory.cashCycle); const before = player.credits;
  assert.equal(action(world, 'pauseFacility', { facilityTypeId: factory.facilityTypeId }, NOW + 1).ok, true);
  assert.equal(player.credits, before);
  migrateFacilityGroupWorld(world, NOW + 2);
  const recovered = player.facilityGroups[0];
  assert.deepEqual(recovered.cashCycle, cycle);
  assert.equal(recovered.enabled, false);
  processCashProductionForPlayer(world, player, cycle.completesAt);
  assert.equal(recovered.lifetimeOutput, cycle.output.quantity);
  assert.equal(recovered.cashCycle, null);
});

test('configuration and expansion only change future funded cycles, not a current completion', () => {
  const { world, player, factory, type } = setup();
  processCashProductionForPlayer(world, player, NOW);
  const cycle = structuredClone(factory.cashCycle);
  const otherRecipe = type.recipes.find((recipe) => recipe.id !== type.defaultRecipeId);
  assert.equal(action(world, 'setFacilityRecipe', { facilityTypeId: type.id, recipeId: otherRecipe.id }, NOW + 1).ok, true);
  assert.deepEqual(factory.cashCycle, cycle);
  assert.equal(factory.cycleStartedAt, NOW);
  factory.count += 10;
  factory.enabled = false;
  processCashProductionForPlayer(world, player, cycle.completesAt);
  assert.equal(factory.lastCashCycle.output.quantity, cycle.output.quantity);
});

test('a paid cycle is not lost when normalizing a zero-count former owner', () => {
  const { world, player, factory } = setup();
  processCashProductionForPlayer(world, player, NOW);
  const cycle = structuredClone(factory.cashCycle); factory.count = 0;
  migrateFacilityGroupWorld(world, NOW + 1);
  assert.deepEqual(player.facilityGroups[0].cashCycle, cycle);
  processCashProductionForPlayer(world, player, cycle.completesAt);
  assert.equal(player.facilityGroups[0].lifetimeOutput, cycle.output.quantity);
});

test('auto-operation off permits one explicit cycle but never automatically starts another', () => {
  const { world, player, factory } = setup();
  player.factoryAutoOperationPolicies = { [`${PROVINCE}:${factory.facilityTypeId}`]: { enabled: false } };
  assert.equal(processCashProductionGroup(world, player, factory, NOW).started, false);
  assert.equal(action(world, 'startFacility', { facilityTypeId: factory.facilityTypeId }).ok, true);
  const cycle = factory.cashCycle;
  processCashProductionForPlayer(world, player, cycle.completesAt);
  assert.equal(factory.cashCycle, null);
  assert.equal(factory.cashCycleSequence, 1);
});

test('long offline processing cannot backfill newly funded cycles', () => {
  const { world, player, factory } = setup();
  processCashProductionForPlayer(world, player, NOW);
  const cycle = structuredClone(factory.cashCycle);
  const later = NOW + 2 * 60 * 60 * 1000;
  processCashProductionForPlayer(world, player, later);
  assert.equal(factory.lifetimeOutput, cycle.output.quantity);
  assert.equal(factory.cashCycle.startedAt, later);
  assert.equal(factory.cashCycleSequence, 2);
  assert.equal(nextCashProductionDeadline(world), factory.cashCycle.completesAt);
});

test('missing completion quote retains the paid asset and advertises a bounded retry', () => {
  const { world, player, factory } = setup();
  processCashProductionForPlayer(world, player, NOW);
  const cycle = structuredClone(factory.cashCycle);
  delete world.markets[`${PROVINCE}:${cycle.output.productId}`];
  const before = player.credits;
  const result = processCashProductionForPlayer(world, player, cycle.completesAt);
  assert.equal(result.settled, 0);
  assert.deepEqual(factory.cashCycle, cycle);
  assert.equal(player.credits, before);
  assert.equal(nextCashProductionDeadline(world), cycle.completesAt + 60000);
});

test('old stock-selling and stock-freezing hooks are inert in the new economy', () => {
  const { world, player, factory } = setup();
  player.inventories[`${PROVINCE}:wheat`] = { available: 321, frozen: 0, inTransit: 0 };
  const before = structuredClone(player);
  assert.equal(completeBuildingCycleAutoOperation(world, player, factory, 'production', NOW, NOW), false);
  assert.deepEqual(reconcileBuildingInputFreezes(world, player, NOW), []);
  assert.deepEqual(player, before);
});

test('construction pays all formal materials atomically without needing or creating stock', () => {
  const { world, player } = setup({ group: false });
  const type = FACILITY_TYPE_CATALOG.find((row) => row.id === 'ranch');
  const materials = type.buildInputs.reduce((sum, row) => sum + row.quantity * world.markets[`${PROVINCE}:${row.productId}`].officialPrice, 0);
  const inventory = structuredClone(player.inventories);
  player.__suppressInitialAutoOperationBootstrap = true;
  assert.equal(action(world, 'buildFacility', { facilityTypeId: type.id, quantity: 1 }).ok, true);
  assert.equal(cashMicros(10000) - cashMicros(player.credits), cashMicros(type.buildCost + materials));
  assert.deepEqual(player.inventories, inventory);
  assert.equal(player.facilityGroups[0].count, 1);
  for (const row of type.buildInputs) assert.equal(world.markets[`${PROVINCE}:${row.productId}`].todayBuyQuantity, row.quantity);
});

test('insufficient construction money leaves every material counter and cash unchanged', () => {
  const { world, player } = setup({ group: false });
  player.credits = 0.01;
  const before = structuredClone(world);
  assert.equal(action(world, 'buildFacility', { facilityTypeId: 'ranch', quantity: 1 }).ok, false);
  assert.deepEqual(player.inventories, before.players[String(USER.id)].inventories);
  assert.equal(player.credits, 0.01);
  for (const [key, market] of Object.entries(world.markets)) assert.equal(market.todayBuyQuantity, before.markets[key].todayBuyQuantity);
});

test('cash commercial operation consumes direct payments and retains only the funded cycle cost', () => {
  const { world, player } = setup({ group: false });
  const type = COMMERCIAL_BUILDING_TYPE_CATALOG.find((row) => row.id === 'convenience-store');
  const inventory = structuredClone(player.inventories);
  assert.equal(applyCommercialBuildingAction(world, USER, { operation: 'build', provinceId: PROVINCE,
    commercialTypeId: type.id, quantity: 1 }, NOW).ok, true);
  const group = player.commercialBuildingGroups[0];
  assert.ok(group.cashOperatingCycle);
  const cost = group.cashOperatingCycle.totalCost; const revenue = group.pendingRevenue;
  assert.equal(cashFinancialAssets(world, player, NOW).productionWorkInProgress, cost);
  const before = player.credits;
  assert.equal(applyCommercialBuildingAction(world, USER, { operation: 'stop', provinceId: PROVINCE,
    commercialTypeId: type.id }, NOW + 1).ok, true);
  processCommercialWorld(world, group.cycleCompletesAt);
  assert.equal(cashMicros(player.credits) - cashMicros(before), cashMicros(revenue));
  assert.equal(group.cashOperatingCycle, undefined);
  assert.deepEqual(player.inventories, inventory);
});

test('new construction and commercial state never change an independent investment position', () => {
  const { world, player } = setup({ group: false });
  for (const province of PROVINCE_CATALOG) commoditySystemPriceFor(world, 'wheat', province.id, NOW);
  applyCommodityInvestmentTrade(world, player, { ...commodityInvestmentQuote(world, 'wheat', NOW), side: 'buy', quantity: 1 }, NOW);
  const account = structuredClone(player.commodityInvestmentAccount);
  action(world, 'buildFacility', { facilityTypeId: 'farm', quantity: 1 });
  processCashProductionForPlayer(world, player, NOW + 60000);
  assert.deepEqual(player.commodityInvestmentAccount, account);
});

test('production scope isolates unrelated players and original market snapshots', () => {
  const { world } = setup();
  const other = ensurePlayer(world, { id: 913, name: 'other' }, NOW);
  const beforeOther = structuredClone(other);
  const scope = createRuntimeMutationScope(world, USER.id, 'startFacility', { provinceId: PROVINCE, facilityTypeId: 'mill' });
  const draft = cloneWorldForMutation(world, scope);
  processCashProductionForPlayer(draft, draft.players[String(USER.id)], NOW);
  assert.equal(world.players[String(USER.id)].credits, 10000);
  assert.deepEqual(other, beforeOther);
});
