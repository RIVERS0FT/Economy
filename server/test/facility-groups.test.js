import assert from 'node:assert/strict';
import test from 'node:test';
import { createWorld, ensurePlayer } from '../src/domain.js';
import { applyFacilityGroupAction, createFacilityGroupClientState, migrateFacilityGroupWorld, processFacilityGroupWorld } from '../src/facility-groups.js';

const now = 1_700_000_000_000;
const alice = { id: 1, email: 'alice@example.com', name: 'Alice' };
const bob = { id: 2, email: 'bob@example.com', name: 'Bob' };

function group(typeId, count, overrides = {}) {
  return { facilityTypeId: typeId, count, participatingCount: 0, pendingJoinCount: 0, enabled: false, status: 'stopped', statusReason: 'manual', activeRecipeId: typeId === 'farm' ? 'wheat-crop' : `${typeId}-default`, lifetimeOutput: 0, ...overrides };
}

test('factory buy and sell orders use price-time matching and partial fills', () => {
  const world = createWorld(now);
  const seller = ensurePlayer(world, bob, now);
  const buyer = ensurePlayer(world, alice, now);
  seller.facilityGroups = [group('farm', 5)];
  buyer.credits = 1_000;
  migrateFacilityGroupWorld(world, now);

  assert.equal(applyFacilityGroupAction(world, bob, 'placeOrder', { assetKind: 'facility', assetId: 'farm', side: 'sell', quantity: 3, price: 80 }, now + 1).ok, true);
  assert.equal(applyFacilityGroupAction(world, alice, 'placeOrder', { assetKind: 'facility', assetId: 'farm', side: 'buy', quantity: 2, price: 90 }, now + 2).ok, true);

  assert.equal(seller.facilityGroups[0].count, 3);
  assert.equal(buyer.facilityGroups.find((item) => item.facilityTypeId === 'farm').count, 2);
  const sellOrder = world.orders.find((order) => order.ownerId === bob.id && order.assetKind === 'facility');
  const buyOrder = world.orders.find((order) => order.ownerId === alice.id && order.assetKind === 'facility' && order.side === 'buy');
  assert.equal(sellOrder.remaining, 1);
  assert.equal(sellOrder.status, 'partial');
  assert.deepEqual(buyOrder.fills.map((fill) => ({ price: fill.price, quantity: fill.quantity })), [
    { price: 80, quantity: 2 },
  ]);
});

test('running factory sell order immediately reduces participating output', () => {
  const world = createWorld(now);
  const seller = ensurePlayer(world, bob, now);
  seller.facilityGroups = [group('farm', 5, { enabled: true, status: 'running', participatingCount: 5, cycleStartedAt: now })];
  migrateFacilityGroupWorld(world, now);

  const response = applyFacilityGroupAction(world, bob, 'placeOrder', { assetKind: 'facility', assetId: 'farm', side: 'sell', quantity: 2, price: 100 }, now + 1);
  assert.equal(response.ok, true);
  assert.equal(seller.facilityGroups[0].participatingCount, 3);
  assert.equal(createFacilityGroupClientState(world, bob.id, now + 1).facilityGroups[0].listedCount, 2);
});

test('production increments produced goods statistics', () => {
  const world = createWorld(now);
  const player = ensurePlayer(world, alice, now);
  player.facilityGroups = [group('farm', 2, { enabled: true, status: 'running', participatingCount: 2, cycleStartedAt: now })];
  migrateFacilityGroupWorld(world, now);
  processFacilityGroupWorld(world, now + 30_000);
  assert.equal(player.stats.producedGoods, 4);
  assert.equal(player.inventories.wheat.available, 4);
});

test('asset valuation excludes the current players own buy order', () => {
  const world = createWorld(now);
  const player = ensurePlayer(world, alice, now);
  player.inventories.wheat.available = 10;
  world.orders.push({ id: 'self-bid', assetKind: 'commodity', assetId: 'wheat', productId: 'wheat', side: 'buy', ownerType: 'player', ownerId: alice.id, ownerName: 'Alice', price: 999, quantity: 1, remaining: 1, status: 'open', createdAt: now });
  migrateFacilityGroupWorld(world, now);
  const state = createFacilityGroupClientState(world, alice.id, now);
  assert.notEqual(state.valuationPrices['commodity:wheat'], 999);
  assert.equal(state.assetSummary.commodityValue, 10 * state.valuationPrices['commodity:wheat']);
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

test('running farm crop changes apply at the next cycle boundary', () => {
  const world = createWorld(now);
  const player = ensurePlayer(world, alice, now);
  player.credits = 1_000;
  player.facilityGroups = [group('farm', 2, {
    enabled: true,
    status: 'running',
    participatingCount: 2,
    cycleStartedAt: now,
  })];
  migrateFacilityGroupWorld(world, now);
  const response = applyFacilityGroupAction(world, alice, 'setFacilityRecipe', {
    facilityTypeId: 'farm', recipeId: 'rice-crop',
  }, now + 1);
  assert.equal(response.ok, true);
  assert.equal(player.facilityGroups[0].activeRecipeId, 'wheat-crop');
  assert.equal(player.facilityGroups[0].pendingRecipeId, 'rice-crop');

  assert.equal(applyFacilityGroupAction(world, alice, 'setFacilityRecipe', {
    facilityTypeId: 'farm', recipeId: 'wheat-crop',
  }, now + 2).ok, true);
  assert.equal(player.facilityGroups[0].pendingRecipeId, undefined);
  assert.equal(applyFacilityGroupAction(world, alice, 'setFacilityRecipe', {
    facilityTypeId: 'farm', recipeId: 'rice-crop',
  }, now + 3).ok, true);

  processFacilityGroupWorld(world, now + 30_000);
  assert.equal(player.facilityGroups[0].activeRecipeId, 'rice-crop');
  assert.equal(player.facilityGroups[0].pendingRecipeId, undefined);
  assert.equal(player.inventories.wheat.available, 4);
  assert.equal(player.inventories.rice.available, 0);

  processFacilityGroupWorld(world, now + 60_000);
  assert.equal(player.inventories.rice.available, 4);
});

test('warehouse errors recover without backfilling missed cycles', () => {
  const world = createWorld(now);
  const player = ensurePlayer(world, alice, now);
  player.warehouseLevel = 1;
  player.inventoryCapacity = 500;
  player.inventories.wheat.available = 499;
  player.facilityGroups = [group('farm', 1, { enabled: true, status: 'error', statusReason: 'warehouse_full' })];
  migrateFacilityGroupWorld(world, now);
  processFacilityGroupWorld(world, now + 120_000);
  assert.equal(player.facilityGroups[0].status, 'error');
  assert.equal(player.inventories.wheat.available, 499);

  player.warehouseLevel = 2;
  player.inventoryCapacity = 750;
  processFacilityGroupWorld(world, now + 120_001);
  assert.equal(player.facilityGroups[0].status, 'running');
  assert.equal(player.facilityGroups[0].cycleStartedAt, now + 120_001);
  assert.equal(player.inventories.wheat.available, 499);
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

  processFacilityGroupWorld(world, now + 60_000);

  const completed = player.facilityGroups[0];
  assert.equal(completed.enabled, true);
  assert.equal(completed.status, 'running');
  assert.equal(player.inventories.wheat.available, 4);
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
