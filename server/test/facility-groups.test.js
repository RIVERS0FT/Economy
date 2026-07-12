import assert from 'node:assert/strict';
import test from 'node:test';
import { createWorld, ensurePlayer } from '../src/domain.js';
import { applyFacilityGroupAction, createFacilityGroupClientState, migrateFacilityGroupWorld, processFacilityGroupWorld } from '../src/facility-groups.js';

const now = 1_700_000_000_000;
const alice = { id: 1, email: 'alice@example.com', name: 'Alice' };
const bob = { id: 2, email: 'bob@example.com', name: 'Bob' };

function group(typeId, count, overrides = {}) {
  return { facilityTypeId: typeId, count, participatingCount: 0, pendingJoinCount: 0, status: 'paused', stopReason: 'manual', productionMode: 'continuous', completedQuantity: 0, ...overrides };
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
  assert.equal(sellOrder.remaining, 1);
  assert.equal(sellOrder.status, 'partial');
});

test('running factory sell order immediately reduces participating output', () => {
  const world = createWorld(now);
  const seller = ensurePlayer(world, bob, now);
  seller.facilityGroups = [group('farm', 5, { status: 'running', participatingCount: 5, cycleStartedAt: now })];
  migrateFacilityGroupWorld(world, now);

  const response = applyFacilityGroupAction(world, bob, 'placeOrder', { assetKind: 'facility', assetId: 'farm', side: 'sell', quantity: 2, price: 100 }, now + 1);
  assert.equal(response.ok, true);
  assert.equal(seller.facilityGroups[0].participatingCount, 3);
  assert.equal(createFacilityGroupClientState(world, bob.id, now + 1).facilityGroups[0].listedCount, 2);
});

test('production increments produced goods statistics', () => {
  const world = createWorld(now);
  const player = ensurePlayer(world, alice, now);
  player.facilityGroups = [group('farm', 2, { status: 'running', participatingCount: 2, cycleStartedAt: now })];
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
