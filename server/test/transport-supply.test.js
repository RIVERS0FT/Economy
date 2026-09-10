import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createWorld, ensurePlayer } from '../src/domain.js';
import { EconomyStore } from '../src/storage.js';
import { FACILITY_TYPE_CATALOG } from '../src/industry-catalog.js';
import { migrateFacilityGroupWorld } from '../src/facility-groups.js';
import { inventoryForProvince, provinceScopedKey } from '../src/provinces.js';
import { freezeCommodity, frozenForSource, assertCommodityFreezeInvariant } from '../src/commodity-freezes.js';
import { buildingInputPlans, planInputTotals, buildingFreezeSource } from '../src/building-input-freezes.js';
import { createProductionSettlementClaim } from '../../shared/production-settlement.js';
import { applyProductionSettlementClaim, createProductionSettlementBasis } from '../src/production-settlement.js';
import { applyCreateTransportRoute, applyTransportShip, processTransportWorld, transportRouteClientState } from '../src/transport.js';

const now = 1780000000000;
const source = '110000';
const destination = '130000';
const user = { id: 8982, name: 'Transport Supply', email: 'transport-supply@example.test' };

function group(typeId, provinceId, count = 1) {
  const type = FACILITY_TYPE_CATALOG.find((entry) => entry.id === typeId);
  return { provinceId, facilityTypeId: typeId, count, participatingCount: count, enabled: true,
    status: 'running', activeRecipeId: type.defaultRecipeId, lifetimeOutput: 0, cycleStartedAt: now,
    staffingRateBps: 10000, staffingUpdatedAt: now, staffingBatchCarryBps: 0 };
}

function fixture(sourceQuantity = 1000) {
  const world = createWorld(now);
  const player = ensurePlayer(world, user, now);
  player.facilityGroups = [group('farm', source), group('mill', destination, 20)];
  player.credits = 1000000;
  migrateFacilityGroupWorld(world, now);
  inventoryForProvince(player, 'wheat', source).available = sourceQuantity;
  inventoryForProvince(player, 'wheat', destination).available = 0;
  inventoryForProvince(player, 'industrial-fuel', source).available = 10000;
  world.markets[provinceScopedKey(source, 'industrial-fuel')] = {
    ...world.markets[provinceScopedKey(source, 'industrial-fuel')],
    productId: 'industrial-fuel', provinceId: source, officialPrice: 1, nextPriceAt: now + 86400000,
  };
  assert.equal(applyCreateTransportRoute(world, user, { sourceProvinceId: source,
    destinationProvinceId: destination, mode: 'road' }, now).ok, true);
  return { world, player, route: player.transportRoutes[0] };
}

function createTask(world, route, extra = {}) {
  return applyTransportShip(world, user, { operation: 'task-supply-create', routeId: route.id,
    sourceProvinceId: source, destinationProvinceId: destination, productId: 'wheat',
    targetQuantity: 500, budget: 1000, ...extra }, now);
}

function service(world, trip) {
  const at = trip.arrivesAt + 1;
  processTransportWorld(world, at);
  const result = applyTransportShip(world, user, { operation: 'node-service', routeId: trip.routeId,
    cycleId: trip.id, visitIndex: trip.currentVisitIndex, unload: [], load: [] }, at);
  assert.equal(result.ok, true, result.message);
}

test('supply caps real building demand, preserves foreign custody and reserves actual stock only', () => {
  const { world, player, route } = fixture();
  const stock = inventoryForProvince(player, 'wheat', source);
  freezeCommodity(stock, 'contract', 'supplier', 50);
  const need = buildingInputPlans(world, player, now, destination).reduce((sum, plan) => sum + (planInputTotals(plan).wheat ?? 0), 0);
  assert.ok(need > 0 && need < 200);
  const result = createTask(world, route);
  assert.equal(result.ok, true, result.message);
  const task = player.transportTaskState.tasks[0];
  assert.equal(frozenForSource(stock, 'transport', `task:${task.id}`), need);
  assert.equal(frozenForSource(stock, 'contract', 'supplier'), 50);
  assert.equal(stock.available + stock.frozen, 1000);
  assertCommodityFreezeInvariant(stock);
  const before = JSON.stringify(world);
  transportRouteClientState(world, user.id);
  assert.equal(JSON.stringify(world), before, 'task projections must remain read-only');
  assert.equal(createTask(world, route).ok, false, 'duplicate destination/product cannot double-supply');
  assert.equal(JSON.stringify(world), before);
});

test('supply delivery preserves source ownership and transfers into destination building protection', () => {
  const { world, player, route } = fixture();
  assert.equal(createTask(world, route).ok, true);
  const task = player.transportTaskState.tasks[0];
  const stock = inventoryForProvince(player, 'wheat', source);
  const quantity = frozenForSource(stock, 'transport', `task:${task.id}`);
  const start = applyTransportShip(world, user, { operation: 'task-cycle-start', routeId: route.id }, now + 1);
  assert.equal(start.ok, true, start.message);
  const trip = world.transportShipments.at(-1);
  assert.equal(stock.inTransit, quantity);
  const credits = player.credits;
  service(world, trip);
  assert.equal(stock.inTransit, 0);
  assert.equal(task.deliveredQuantity, quantity);
  assert.equal(player.credits, credits, 'self-supply does not issue a reward');
  const dest = inventoryForProvince(player, 'wheat', destination);
  const mill = player.facilityGroups.find((entry) => entry.provinceId === destination);
  assert.equal(frozenForSource(dest, 'production', buildingFreezeSource(mill)), quantity);
  assertCommodityFreezeInvariant(dest);
  service(world, trip);
  assert.equal(task.spent, trip.transportFee);
  assert.equal(frozenForSource(stock, 'transport', `task:${task.id}`), 0, 'fulfilled target needs no additional batch');
});

test('budget block and cancellation never buy, spend, or release another source', () => {
  const { world, player, route } = fixture();
  const stock = inventoryForProvince(player, 'wheat', source);
  freezeCommodity(stock, 'auction', 'other-auction', 10);
  const credits = player.credits;
  assert.equal(createTask(world, route, { budget: 0.01 }).ok, true);
  const task = player.transportTaskState.tasks[0];
  assert.equal(frozenForSource(stock, 'transport', `task:${task.id}`), 0);
  assert.equal(applyTransportShip(world, user, { operation: 'task-cycle-start', routeId: route.id }, now + 1).ok, false);
  assert.equal(player.credits, credits);
  assert.equal(applyTransportShip(world, user, { operation: 'task-cancel', routeId: route.id, taskId: task.id }, now + 2).ok, true);
  assert.equal(frozenForSource(stock, 'auction', 'other-auction'), 10);
  assert.equal(stock.available + stock.frozen, 1000);
});

test('a real production completion protects newly produced supply before automatic sale', () => {
  const { world, player, route } = fixture(0);
  assert.equal(createTask(world, route).ok, true);
  const task = player.transportTaskState.tasks[0];
  const farm = FACILITY_TYPE_CATALOG.find((entry) => entry.id === 'farm');
  const recipe = farm.recipes.find((entry) => entry.id === farm.defaultRecipeId);
  const through = now + recipe.cycleMs;
  const claim = createProductionSettlementClaim(createProductionSettlementBasis(world, user.id, through));
  assert.ok(claim);
  applyProductionSettlementClaim(world, user.id, claim, through);
  const stock = inventoryForProvince(player, 'wheat', source);
  assert.ok(frozenForSource(stock, 'transport', `task:${task.id}`) > 0);
  assert.equal(world.orders.some((order) => order.ownerId === user.id && order.provinceId === source
    && order.productId === 'wheat' && order.side === 'sell'), false);
  assertCommodityFreezeInvariant(stock);
});

test('real SQLite task acceptance is idempotent, private, and survives cold reopen without quota refunds', () => {
  const directory = mkdtempSync(join(tmpdir(), 'economy-transport-business-'));
  const path = join(directory, 'world.sqlite');
  let store = new EconomyStore(path);
  try {
    store.getStateSnapshot(user, undefined, now);
    const request = (payload, key) => ({ action: 'transportShip', payload, requestKey: key,
      method: 'POST', path: '/api/game/transport' });
    assert.equal(store.apply(user, request({ operation: 'route-create', sourceProvinceId: source,
      destinationProvinceId: destination, mode: 'road' }, 'task-create-route'), now + 1).result.ok, true);
    const view = store.getStateSnapshot(user, undefined, now + 1).state;
    const route = view.transportRoutes[0];
    assert.ok(route.transportBusiness.offers.length > 0);
    const offer = route.transportBusiness.offers[0];
    const command = request({ operation: 'task-freight-accept', routeId: route.id, offerId: offer.id }, 'task-accept');
    const accepted = store.apply(user, command, now + 2);
    assert.equal(accepted.result.ok, true, accepted.result.message);
    assert.deepEqual(store.apply(user, command, now + 3).result, accepted.result);
    const saved = store.getStateSnapshot(user, undefined, now + 3).state.transportRoutes[0].transportBusiness;
    assert.equal(saved.tasks.length, 1);
    store.close();
    store = new EconomyStore(path);
    const reopened = store.getStateSnapshot(user, undefined, now + 4).state.transportRoutes[0].transportBusiness;
    assert.equal(reopened.tasks[0].id, saved.tasks[0].id);
    assert.equal(reopened.committedReward, saved.committedReward);
    const other = { id: 8983, name: 'Other', email: 'other-task@example.test' };
    assert.equal(store.getStateSnapshot(other, undefined, now + 4).state.transportRoutes.length, 0);
    assert.equal(store.apply(user, request({ operation: 'task-cancel', routeId: route.id,
      taskId: saved.tasks[0].id }, 'task-cancel'), now + 5).result.ok, true);
    const cancelled = store.getStateSnapshot(user, undefined, now + 5).state.transportRoutes[0].transportBusiness;
    assert.equal(cancelled.committedReward, saved.committedReward);
    assert.equal(cancelled.tasks[0].status, 'cancelled');
    assert.equal(cancelled.offers.some((entry) => entry.id === offer.id), false);
  } finally { store.close(); rmSync(directory, { recursive: true, force: true }); }
});
