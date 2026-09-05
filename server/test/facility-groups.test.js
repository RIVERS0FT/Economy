import assert from 'node:assert/strict';
import test from 'node:test';
import { createWorld, ensurePlayer } from '../src/domain.js';
import { applyFacilityGroupAction, createFacilityGroupClientState, migrateFacilityGroupWorld, processFacilityGroupWorld } from '../src/facility-groups.js';
import { applyPopulationPolicy } from '../src/population-admin-control.js';
import { ensurePopulationEconomy } from '../src/population-economy.js';
import { DEFAULT_PROVINCE_ID, provinceScopedKey } from '../src/provinces.js';

const now = 1_700_000_000_000;
const alice = { id: 1, email: 'alice@example.com', name: 'Alice' };
const bob = { id: 2, email: 'bob@example.com', name: 'Bob' };

function group(typeId, count, overrides = {}) {
  return { facilityTypeId: typeId, count, participatingCount: 0, enabled: false, status: 'stopped', statusReason: 'manual', activeRecipeId: typeId === 'farm' ? 'wheat-crop' : `${typeId}-default`, lifetimeOutput: 0, ...overrides };
}

function unlockFacilityTestProvinces(player) {
  player.startingProvinceChosen = true;
  player.startingProvinceId = '110000';
  player.unlockedProvinces = ['110000', '120000'];
}

test('factory direct buy and sell orders are rejected without transferring assets', () => {
  const world = createWorld(now);
  const seller = ensurePlayer(world, bob, now);
  const buyer = ensurePlayer(world, alice, now);
  seller.facilityGroups = [group('farm', 5)];
  buyer.credits = 1_000;
  migrateFacilityGroupWorld(world, now);

  const sell = applyFacilityGroupAction(world, bob, 'placeOrder', {
    assetKind: 'facility', assetId: 'farm', side: 'sell', quantity: 3, price: 80,
  }, now + 1);
  const buy = applyFacilityGroupAction(world, alice, 'placeOrder', {
    assetKind: 'facility', assetId: 'farm', side: 'buy', quantity: 2, price: 90,
  }, now + 2);

  assert.deepEqual(sell, { ok: false, message: '工厂资产仅允许通过拍卖交易' });
  assert.deepEqual(buy, { ok: false, message: '工厂资产仅允许通过拍卖交易' });
  assert.equal(seller.facilityGroups[0].count, 5);
  assert.equal(buyer.facilityGroups?.some((item) => item.facilityTypeId === 'farm'), false);
  assert.equal(buyer.credits, 1_000);
  assert.equal(buyer.frozenCredits, 0);
  assert.equal(world.orders.some((order) => order.assetKind === 'facility' && order.ownerType === 'player'), false);
});

test('rejected factory direct sell leaves running participation unchanged', () => {
  const world = createWorld(now);
  const seller = ensurePlayer(world, bob, now);
  seller.facilityGroups = [group('farm', 5, { enabled: true, status: 'running', participatingCount: 5, cycleStartedAt: now })];
  migrateFacilityGroupWorld(world, now);

  const response = applyFacilityGroupAction(world, bob, 'placeOrder', {
    assetKind: 'facility', assetId: 'farm', side: 'sell', quantity: 2, price: 100,
  }, now + 1);
  assert.deepEqual(response, { ok: false, message: '工厂资产仅允许通过拍卖交易' });
  assert.equal(seller.facilityGroups[0].participatingCount, 5);
  assert.equal(createFacilityGroupClientState(world, bob.id, now + 1).facilityGroups[0].listedCount, 0);
});

test('production increments produced goods statistics', () => {
  const world = createWorld(now);
  const player = ensurePlayer(world, alice, now);
  player.facilityGroups = [group('farm', 2, { enabled: true, status: 'running', participatingCount: 2, cycleStartedAt: now })];
  migrateFacilityGroupWorld(world, now);
  processFacilityGroupWorld(world, now + 20_000);
  assert.equal(player.stats.producedGoods, 2);
  assert.equal(player.inventories.wheat.available, 2);
});


test('production wage multiplier changes population wages without changing production cost and only affects the next cycle', () => {
  const world = createWorld(now);
  const player = ensurePlayer(world, alice, now);
  player.credits = 1_000;
  player.facilityGroups = [group('farm', 1, {
    enabled: true,
    status: 'running',
    participatingCount: 1,
    cycleStartedAt: now,
  })];
  const population = ensurePopulationEconomy(world, now);
  const pendingProduction = () => Object.values(population.models).reduce(
    (sum, model) => sum + model.pendingIncome.production,
    0,
  );
  migrateFacilityGroupWorld(world, now);
  assert.equal(player.facilityGroups[0].cycleWageMultiplierBps, 10_000);

  applyPopulationPolicy(world, {
    stabilizationShareBps: 1_200,
    targetWalletCycles: 3,
    refillCapBps: 10_000,
    productionWageMultiplierBps: 13_300,
    modelMultipliersBps: { basic: 10_000, skilled: 10_000, professional: 10_000 },
    durationCycles: 12,
    note: '测试生产工资系数仅影响后续周期',
  }, { adminUserId: 1, now: now + 1 });

  processFacilityGroupWorld(world, now + 20_000);
  assert.equal(player.credits, 999);
  assert.equal(pendingProduction(), 1);
  assert.equal(population.stats.productionWageSubsidyIssued, 0);

  processFacilityGroupWorld(world, now + 40_000);
  assert.equal(player.credits, 998);
  assert.ok(Math.abs(pendingProduction() - 2.33) < 1e-9);
  assert.ok(Math.abs(population.stats.productionWageSubsidyIssued - 0.33) < 1e-9);
  assert.equal(population.stats.productionWageWithheld, 0);
  assert.equal(player.stats.productionPayroll, 2);
  assert.equal(player.stats.employmentPayments, 2);
  assert.equal('cycleWageMultiplierBps' in createFacilityGroupClientState(world, alice.id, now + 40_000).facilityGroups[0], false);
});

test('electronics factory atomically consumes plastic and copper', () => {
  const world = createWorld(now);
  const player = ensurePlayer(world, alice, now);
  player.credits = 100;
  player.inventories.plastic.available = 2;
  player.inventories.copper.available = 2;
  player.facilityGroups = [group('electronics-factory', 2, {
    enabled: true, status: 'running', participatingCount: 2, cycleStartedAt: now,
  })];
  migrateFacilityGroupWorld(world, now);

  processFacilityGroupWorld(world, now + 60_000);

  assert.equal(player.inventories.plastic.available, 0);
  assert.equal(player.inventories.copper.available, 0);
  assert.equal(player.inventories.electronics.available, 2);
  assert.equal(player.credits, 70);
  assert.equal(player.stats.producedGoods, 2);
});

test('electronics factory deducts no material when either input is missing', () => {
  const world = createWorld(now);
  const player = ensurePlayer(world, alice, now);
  player.credits = 100;
  player.inventories.plastic.available = 1;
  player.inventories.copper.available = 0;
  player.facilityGroups = [group('electronics-factory', 1, {
    enabled: true, status: 'running', participatingCount: 1, cycleStartedAt: now,
    staffingBatchCarryBps: 9_999,
  })];
  migrateFacilityGroupWorld(world, now);

  processFacilityGroupWorld(world, now + 60_000);

  assert.equal(player.facilityGroups[0].status, 'error');
  assert.equal(player.facilityGroups[0].statusReason, 'insufficient_input');
  assert.equal(player.inventories.plastic.available + player.inventories.plastic.frozen, 1);
  assert.equal(player.inventories.copper.available, 0);
  assert.equal(player.inventories.electronics.available, 0);
  assert.equal(player.credits, 100);
});

test('fruit beverage recipe uses its own cost and atomically consumes fruit and sugar', () => {
  const world = createWorld(now);
  const player = ensurePlayer(world, alice, now);
  player.credits = 100;
  player.inventories.fruit.available = 2;
  player.inventories.sugar.available = 1;
  player.facilityGroups = [group('beverage-factory', 1, {
    enabled: true, status: 'running', participatingCount: 1,
    activeRecipeId: 'fruit-beverage', cycleStartedAt: now,
  })];
  player.factoryAutoOperationPolicies = { '110000:beverage-factory': { enabled: false, inputCoverageCycles: 2, mode: 'balanced', outputMode: 'surplus' } };
  migrateFacilityGroupWorld(world, now);

  processFacilityGroupWorld(world, now + 60_000);

  assert.equal(player.inventories.fruit.available, 0);
  assert.equal(player.inventories.sugar.available, 0);
  assert.equal(player.inventories.beverage.available, 2);
  assert.ok(Math.abs(player.credits - 85.6) < 1e-9);
});

test('commodity valuation uses the daily official price and ignores retired open bid prices', () => {
  const world = createWorld(now);
  const buyer = ensurePlayer(world, alice, now);
  buyer.credits = 10_000;
  migrateFacilityGroupWorld(world, now);
  const market = world.markets[provinceScopedKey(DEFAULT_PROVINCE_ID, 'wheat')];

  const initial = createFacilityGroupClientState(world, alice.id, now);
  assert.equal(initial.valuationPrices['commodity:wheat'], market.officialPrice);

  market.lastTradePrice = 3;
  market.officialPrice = 11;
  world.orders.push({
    id: 'retired-open-bid', provinceId: DEFAULT_PROVINCE_ID, assetKind: 'commodity', assetId: 'wheat', productId: 'wheat',
    side: 'buy', ownerType: 'player', ownerId: 3, ownerName: 'Charlie', price: 999, quantity: 1, remaining: 1,
    status: 'open', createdAt: now + 1,
  });
  buyer.inventories.wheat.available = 10;

  const state = createFacilityGroupClientState(world, alice.id, now + 2);
  assert.equal(market.lastTradePrice, 3);
  assert.equal(state.valuationPrices['commodity:wheat'], 11);
  assert.equal(state.assetSummary.commodityValue, 110);
});

test('factory automatically recovers after funds return', () => {
  const world = createWorld(now);
  const player = ensurePlayer(world, alice, now);
  player.credits = 0;
  player.facilityGroups = [group('farm', 2, { enabled: true, status: 'error', statusReason: 'insufficient_funds' })];
  migrateFacilityGroupWorld(world, now);
  processFacilityGroupWorld(world, now + 1);
  assert.equal(player.facilityGroups[0].status, 'error');
  assert.equal(player.facilityGroups[0].enabled, true);

  player.credits = 100;
  processFacilityGroupWorld(world, now + 2);
  assert.equal(player.facilityGroups[0].status, 'running');
  assert.equal(player.facilityGroups[0].participatingCount, 2);
  assert.equal(player.facilityGroups[0].cycleStartedAt, now + 2);
});

test('manual stop disables automatic recovery', () => {
  const world = createWorld(now);
  const player = ensurePlayer(world, alice, now);
  player.credits = 0;
  player.facilityGroups = [group('farm', 1, { enabled: true, status: 'error', statusReason: 'insufficient_funds' })];
  migrateFacilityGroupWorld(world, now);
  assert.equal(applyFacilityGroupAction(world, alice, 'pauseFacility', { facilityTypeId: 'farm' }, now + 1).ok, true);
  player.credits = 100;
  processFacilityGroupWorld(world, now + 2);
  assert.equal(player.facilityGroups[0].status, 'stopped');
  assert.equal(player.facilityGroups[0].enabled, false);
});

test('running farm crop changes apply immediately with a staffing penalty and progress reset', () => {
  const world = createWorld(now);
  const player = ensurePlayer(world, alice, now);
  player.credits = 1_000;
  player.facilityGroups = [group('farm', 2, {
    enabled: true,
    status: 'running',
    participatingCount: 2,
    cycleStartedAt: now,
    staffingRateBps: 10_000,
    staffingUpdatedAt: now,
    staffingBatchCarryBps: 7_500,
  })];
  migrateFacilityGroupWorld(world, now);
  const response = applyFacilityGroupAction(world, alice, 'setFacilityRecipe', {
    facilityTypeId: 'farm', recipeId: 'rice-crop',
  }, now + 1);
  const farm = player.facilityGroups[0];
  assert.equal(response.ok, true);
  assert.match(response.message, /生产进度已清零/);
  assert.equal(farm.activeRecipeId, 'rice-crop');
  assert.equal(farm.cycleStartedAt, now + 1);
  assert.equal(farm.staffingRateBps, 8_000);
  assert.equal(Object.hasOwn(farm, 'cycleStaffingRateBps'), false);
  assert.equal(farm.staffingBatchCarryBps, 0);
  assert.equal(Object.hasOwn(farm, 'pendingRecipeId'), false);

  const repeated = applyFacilityGroupAction(world, alice, 'setFacilityRecipe', {
    facilityTypeId: 'farm', recipeId: 'rice-crop',
  }, now + 2);
  assert.equal(repeated.ok, true);
  assert.equal(farm.cycleStartedAt, now + 1);
  assert.equal(farm.staffingRateBps, 8_000);

  processFacilityGroupWorld(world, now + 20_000);
  assert.equal(player.inventories.wheat.available, 0);
  assert.equal(player.inventories.rice.available, 0);
  processFacilityGroupWorld(world, now + 20_001);
  assert.equal(player.inventories.rice.available, 1);
});

test('legacy pending factory and recipe state migrates once into immediate participation', () => {
  const world = createWorld(now);
  const player = ensurePlayer(world, alice, now);
  player.facilityGroups = [group('farm', 10, {
    enabled: true,
    status: 'running',
    participatingCount: 8,
    pendingJoinCount: 2,
    cycleStartedAt: now - 5_000,
    staffingRateBps: 8_000,
    staffingUpdatedAt: now,
    staffingBatchCarryBps: 9_999,
    pendingRecipeId: 'rice-crop',
  })];
  migrateFacilityGroupWorld(world, now);
  const farm = player.facilityGroups[0];
  assert.equal(farm.participatingCount, 10);
  assert.equal(farm.activeRecipeId, 'rice-crop');
  assert.equal(farm.staffingRateBps, 4_400);
  assert.equal(Object.hasOwn(farm, 'cycleStaffingRateBps'), false);
  assert.equal(farm.cycleStartedAt, now);
  assert.equal(farm.staffingBatchCarryBps, 0);
  assert.equal(Object.hasOwn(farm, 'pendingJoinCount'), false);
  assert.equal(Object.hasOwn(farm, 'pendingRecipeId'), false);
  migrateFacilityGroupWorld(world, now + 1);
  assert.equal(farm.staffingRateBps, 4_400);
});

test('legacy warehouse capacity errors are retired during migration', () => {
  const world = createWorld(now);
  const player = ensurePlayer(world, alice, now);
  player.warehouseLevel = 9;
  player.inventoryCapacity = 500;
  player.inventories.wheat.available = 50_000;
  player.facilityGroups = [group('farm', 1, {
    enabled: true, status: 'error', statusReason: 'warehouse_full', staffingBatchCarryBps: 9_999,
  })];
  migrateFacilityGroupWorld(world, now);
  assert.notEqual(player.facilityGroups[0].statusReason, 'warehouse_full');
  processFacilityGroupWorld(world, now + 20_000);
  assert.notEqual(player.facilityGroups[0].statusReason, 'warehouse_full');
  assert.equal(player.inventories.wheat.available >= 50_000, true);
});

test('stopped facilities apply recipes immediately and fixed recipes are idempotent', () => {
  const world = createWorld(now);
  const player = ensurePlayer(world, alice, now);
  player.facilityGroups = [group('farm', 1), group('mill', 1)];
  migrateFacilityGroupWorld(world, now);

  assert.equal(applyFacilityGroupAction(world, alice, 'setFacilityRecipe', {
    facilityTypeId: 'farm', recipeId: 'rice-crop',
  }, now + 1).ok, true);
  assert.equal(player.facilityGroups.find((item) => item.facilityTypeId === 'farm').activeRecipeId, 'rice-crop');

  const fixedRecipeResult = applyFacilityGroupAction(world, alice, 'setFacilityRecipe', {
    facilityTypeId: 'mill', recipeId: 'mill-default',
  }, now + 2);
  assert.equal(fixedRecipeResult.ok, true);
  assert.equal(player.facilityGroups.find((item) => item.facilityTypeId === 'mill').activeRecipeId, 'mill-default');
});
test('legacy completed target plans migrate to a manual stop', () => {
  const world = createWorld(now);
  const player = ensurePlayer(world, alice, now);
  player.credits = 100;
  player.facilityGroups = [group('farm', 1, {
    enabled: false,
    status: 'stopped',
    statusReason: 'plan_complete',
    productionMode: 'target',
    targetQuantity: 2,
    completedQuantity: 2,
  })];
  migrateFacilityGroupWorld(world, now);
  const completed = player.facilityGroups[0];
  assert.equal(completed.enabled, false);
  assert.equal(completed.status, 'stopped');
  assert.equal(completed.statusReason, 'manual');
  assert.equal(completed.activeRecipeId, 'wheat-crop');
  assert.equal(Object.hasOwn(completed, 'productionMode'), false);
  assert.equal(Object.hasOwn(completed, 'targetQuantity'), false);
});

test('legacy running target plans become continuous production', () => {
  const world = createWorld(now);
  const player = ensurePlayer(world, alice, now);
  player.credits = 100;
  player.facilityGroups = [group('farm', 1, {
    enabled: true,
    status: 'running',
    participatingCount: 1,
    cycleStartedAt: now,
    productionMode: 'target',
    targetQuantity: 2,
    completedQuantity: 0,
    pendingProductionPlan: {
      mode: 'continuous',
      requestedAt: now + 1,
    },
  })];
  migrateFacilityGroupWorld(world, now);

  processFacilityGroupWorld(world, now + 20_000);

  const completed = player.facilityGroups[0];
  assert.equal(completed.enabled, true);
  assert.equal(completed.status, 'running');
  assert.equal(player.inventories.wheat.available, 1);
  assert.equal(Object.hasOwn(completed, 'productionMode'), false);
  assert.equal(Object.hasOwn(completed, 'pendingProductionPlan'), false);
});


test('factory order books contain player orders only', () => {
  const world = createWorld(now);
  world.orders.push(
    { id: 'system-factory-buy', assetKind: 'facility', assetId: 'farm', facilityTypeId: 'farm', side: 'buy', ownerType: 'market', ownerName: '系统资产采购', price: 72, quantity: 3, remaining: 3, status: 'open', createdAt: now },
    { id: 'system-factory-sell', assetKind: 'facility', assetId: 'farm', facilityTypeId: 'farm', side: 'sell', ownerType: 'market', ownerName: '系统资产供给', price: 88, quantity: 2, remaining: 2, status: 'open', createdAt: now },
    { id: 'player-factory-buy', assetKind: 'facility', assetId: 'farm', facilityTypeId: 'farm', side: 'buy', ownerType: 'player', ownerId: alice.id, ownerName: 'Alice', price: 80, quantity: 1, remaining: 1, status: 'open', createdAt: now },
  );

  migrateFacilityGroupWorld(world, now);
  assert.equal(world.orders.some((order) => order.assetKind === 'facility' && order.ownerType === 'market'), false);
  assert.equal(world.orders.some((order) => order.id === 'player-factory-buy'), true);

  processFacilityGroupWorld(world, now + 1);
  assert.equal(world.orders.some((order) => order.assetKind === 'facility' && order.ownerType === 'market'), false);
  assert.equal(world.orders.some((order) => order.id === 'player-factory-buy'), true);
});

test('empty factory order books stay empty after world processing', () => {
  const world = createWorld(now);
  world.orders = world.orders.filter((order) => order.assetKind !== 'facility' && !order.facilityTypeId);
  migrateFacilityGroupWorld(world, now);
  processFacilityGroupWorld(world, now + 1);
  assert.equal(world.orders.some((order) => order.assetKind === 'facility' || order.facilityTypeId), false);
});

test('stopped factory staffing decays linearly from its stored timestamp', () => {
  const world = createWorld(now);
  const player = ensurePlayer(world, alice, now);
  player.facilityGroups = [group('farm', 2, {
    staffingRateBps: 10_000,
    staffingUpdatedAt: now,
  })];
  migrateFacilityGroupWorld(world, now);

  const state = createFacilityGroupClientState(world, alice.id, now + 15 * 60_000);
  const farm = state.facilityGroups[0];
  assert.equal(farm.staffingRateBps, 5_000);
  assert.equal(farm.staffingUpdatedAt, now + 15 * 60_000);
  assert.equal(farm.productionAvailableCount, 2);
  assert.equal(farm.projectedEffectiveCount, 1);
  assert.equal(player.facilityGroups[0].staffingRateBps, 10_000, 'read-only projection must not create a high-frequency write loop');
});

test('running factory settles each completed cycle at its completion staffing rate and carries fractional capacity', () => {
  const world = createWorld(now);
  const player = ensurePlayer(world, alice, now);
  player.credits = 100;
  player.facilityGroups = [group('farm', 1, {
    enabled: true,
    status: 'running',
    participatingCount: 1,
    cycleStartedAt: now,
    staffingRateBps: 2_500,
    staffingUpdatedAt: now,
    staffingBatchCarryBps: 0,
  })];
  migrateFacilityGroupWorld(world, now);

  const midway = createFacilityGroupClientState(world, alice.id, now + 60_000).facilityGroups[0];
  assert.equal(midway.staffingRateBps, 3_500);
  assert.equal(midway.staffingUpdatedAt, now + 60_000);
  assert.equal(midway.projectedEffectiveCount, 0);
  assert.equal(Object.hasOwn(midway, 'cycleStaffingRateBps'), false);
  assert.equal(Object.hasOwn(midway, 'cycleEffectiveCount'), false);

  processFacilityGroupWorld(world, now + 80_000);
  assert.equal(player.inventories.wheat.available, 1);
  assert.equal(player.credits, 99);
  assert.equal(player.facilityGroups[0].staffingBatchCarryBps, 3_330);
  assert.equal(player.facilityGroups[0].staffingRateBps, 3_832);
});

test('cycle completion rate can increase integer output beyond the cycle-start projection', () => {
  const world = createWorld(now);
  const player = ensurePlayer(world, alice, now);
  player.credits = 100;
  player.facilityGroups = [group('farm', 4, {
    enabled: true,
    status: 'running',
    participatingCount: 4,
    cycleStartedAt: now,
    staffingRateBps: 2_400,
    staffingUpdatedAt: now,
  })];
  migrateFacilityGroupWorld(world, now);

  processFacilityGroupWorld(world, now + 20_000);

  assert.equal(player.inventories.wheat.available, 1, 'completion rate 27.33% yields one integer batch while the 24% start rate yields zero');
  assert.equal(player.credits, 99);
  assert.equal(player.facilityGroups[0].staffingRateBps, 2_733);
  assert.equal(player.facilityGroups[0].staffingBatchCarryBps, 932);
});

test('completion-time capacity still settles atomically when the final requirement is unavailable', () => {
  const world = createWorld(now);
  const player = ensurePlayer(world, alice, now);
  player.credits = 0;
  player.facilityGroups = [group('farm', 4, {
    enabled: true,
    status: 'running',
    participatingCount: 4,
    cycleStartedAt: now,
    staffingRateBps: 2_400,
    staffingUpdatedAt: now,
  })];
  migrateFacilityGroupWorld(world, now);

  processFacilityGroupWorld(world, now + 20_000);

  assert.equal(player.facilityGroups[0].status, 'error');
  assert.equal(player.facilityGroups[0].statusReason, 'insufficient_funds');
  assert.equal(player.inventories.wheat.available, 0);
  assert.equal(player.credits, 0);
  assert.equal(player.facilityGroups[0].staffingBatchCarryBps, 0);
});

test('error staffing decays and auto recovery starts from the reduced live rate', () => {
  const world = createWorld(now);
  const player = ensurePlayer(world, alice, now);
  player.credits = 0;
  player.facilityGroups = [group('farm', 2, {
    enabled: true,
    status: 'error',
    statusReason: 'insufficient_funds',
    staffingRateBps: 10_000,
    staffingUpdatedAt: now,
  })];
  migrateFacilityGroupWorld(world, now);

  processFacilityGroupWorld(world, now + 15 * 60_000);
  const waiting = createFacilityGroupClientState(world, alice.id, now + 15 * 60_000).facilityGroups[0];
  assert.equal(waiting.status, 'error');
  assert.equal(waiting.staffingRateBps, 5_000);

  player.credits = 100;
  processFacilityGroupWorld(world, now + 15 * 60_000 + 1);
  const recovered = player.facilityGroups[0];
  assert.equal(recovered.status, 'running');
  assert.equal(recovered.staffingRateBps, 5_000);
  assert.equal(recovered.cycleStartedAt, now + 15 * 60_000 + 1);
  assert.equal(Object.hasOwn(recovered, 'cycleStaffingRateBps'), false);
});

test('batch recipe change applies every regional target in one facility action', () => {
  const world = createWorld(now);
  const player = ensurePlayer(world, alice, now);
  unlockFacilityTestProvinces(player);
  player.facilityGroups = [
    group('farm', 1, { provinceId: '110000' }),
    group('farm', 1, { provinceId: '120000' }),
  ];
  migrateFacilityGroupWorld(world, now);

  const response = applyFacilityGroupAction(world, alice, 'setFacilityRecipes', {
    targets: [
      { provinceId: '110000', facilityTypeId: 'farm', recipeId: 'rice-crop' },
      { provinceId: '120000', facilityTypeId: 'farm', recipeId: 'rice-crop' },
    ],
  }, now + 1);

  assert.equal(response.ok, true);
  assert.equal(player.facilityGroups.find((item) => item.provinceId === '110000').activeRecipeId, 'rice-crop');
  assert.equal(player.facilityGroups.find((item) => item.provinceId === '120000').activeRecipeId, 'rice-crop');
});

test('batch recipe change rejects the whole request before mutating any regional target', () => {
  const world = createWorld(now);
  const player = ensurePlayer(world, alice, now);
  unlockFacilityTestProvinces(player);
  player.facilityGroups = [
    group('farm', 1, { provinceId: '110000' }),
    group('farm', 1, { provinceId: '120000' }),
  ];
  migrateFacilityGroupWorld(world, now);

  const response = applyFacilityGroupAction(world, alice, 'setFacilityRecipes', {
    targets: [
      { provinceId: '110000', facilityTypeId: 'farm', recipeId: 'rice-crop' },
      { provinceId: '120000', facilityTypeId: 'farm', recipeId: 'missing-recipe' },
    ],
  }, now + 1);

  assert.equal(response.ok, false);
  assert.equal(player.facilityGroups.find((item) => item.provinceId === '110000').activeRecipeId, 'wheat-crop');
  assert.equal(player.facilityGroups.find((item) => item.provinceId === '120000').activeRecipeId, 'wheat-crop');
});
