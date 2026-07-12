import assert from 'node:assert/strict';
import test from 'node:test';
import { createWorld, ensurePlayer } from '../src/domain.js';
import { applyFacilityGroupAction, createFacilityGroupClientState, migrateFacilityGroupWorld, processFacilityGroupWorld } from '../src/facility-groups.js';

const now = 1_700_000_000_000;
const alice = { id: 1, email: 'alice@example.com', name: 'Alice' };
const bob = { id: 2, email: 'bob@example.com', name: 'Bob' };

function group(typeId, count, overrides = {}) {
  return { facilityTypeId: typeId, count, participatingCount: 0, pendingJoinCount: 0, enabled: false, status: 'stopped', statusReason: 'manual', productionMode: 'continuous', completedQuantity: 0, ...overrides };
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
  assert.equal(player.inventories.grain.available, 4);
});

test('asset valuation excludes the current players own buy order', () => {
  const world = createWorld(now);
  const player = ensurePlayer(world, alice, now);
  player.inventories.grain.available = 10;
  world.orders.push({ id: 'self-bid', assetKind: 'commodity', assetId: 'grain', productId: 'grain', side: 'buy', ownerType: 'player', ownerId: alice.id, ownerName: 'Alice', price: 999, quantity: 1, remaining: 1, status: 'open', createdAt: now });
  migrateFacilityGroupWorld(world, now);
  const state = createFacilityGroupClientState(world, alice.id, now);
  assert.notEqual(state.valuationPrices['commodity:grain'], 999);
  assert.equal(state.assetSummary.commodityValue, 10 * state.valuationPrices['commodity:grain']);
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

test('running plan changes apply at the next cycle boundary', () => {
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
  const response = applyFacilityGroupAction(world, alice, 'setProductionPlan', {
    facilityTypeId: 'farm', mode: 'target', targetQuantity: 8,
  }, now + 1);
  assert.equal(response.ok, true);
  assert.equal(player.facilityGroups[0].productionMode, 'continuous');
  assert.equal(player.facilityGroups[0].pendingProductionPlan.mode, 'target');

  processFacilityGroupWorld(world, now + 30_000);
  assert.equal(player.facilityGroups[0].productionMode, 'target');
  assert.equal(player.facilityGroups[0].targetQuantity, 8);
  assert.equal(player.facilityGroups[0].completedQuantity, 0);
  assert.equal(player.inventories.grain.available, 4);
});

test('warehouse errors recover without backfilling missed cycles', () => {
  const world = createWorld(now);
  const player = ensurePlayer(world, alice, now);
  player.warehouseLevel = 1;
  player.inventoryCapacity = 500;
  player.inventories.grain.available = 499;
  player.facilityGroups = [group('farm', 1, { enabled: true, status: 'error', statusReason: 'warehouse_full' })];
  migrateFacilityGroupWorld(world, now);
  processFacilityGroupWorld(world, now + 120_000);
  assert.equal(player.facilityGroups[0].status, 'error');
  assert.equal(player.inventories.grain.available, 499);

  player.warehouseLevel = 2;
  player.inventoryCapacity = 750;
  processFacilityGroupWorld(world, now + 120_001);
  assert.equal(player.facilityGroups[0].status, 'running');
  assert.equal(player.facilityGroups[0].cycleStartedAt, now + 120_001);
  assert.equal(player.inventories.grain.available, 499);
});
test('target production completion disables the run switch', () => {
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
  })];
  migrateFacilityGroupWorld(world, now);

  processFacilityGroupWorld(world, now + 30_000);

  const completed = player.facilityGroups[0];
  assert.equal(player.inventories.grain.available, 2);
  assert.equal(completed.productionMode, 'target');
  assert.equal(completed.completedQuantity, 2);
  assert.equal(completed.enabled, false);
  assert.equal(completed.status, 'stopped');
  assert.equal(completed.statusReason, 'plan_complete');
  assert.equal(completed.participatingCount, 0);
  assert.equal(completed.pendingJoinCount, 0);
  assert.equal(completed.cycleStartedAt, undefined);
});

test('target completion preserves pending plan but still stops', () => {
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

  processFacilityGroupWorld(world, now + 30_000);

  const completed = player.facilityGroups[0];
  assert.equal(completed.productionMode, 'continuous');
  assert.equal(completed.pendingProductionPlan, undefined);
  assert.equal(completed.enabled, false);
  assert.equal(completed.status, 'stopped');
  assert.equal(completed.statusReason, 'plan_complete');
});
