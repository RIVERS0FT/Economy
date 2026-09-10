import assert from 'node:assert/strict';
import test from 'node:test';
import { createWorld, ensurePlayer } from '../src/domain.js';
import { inventoryForProvince, provinceScopedKey } from '../src/provinces.js';
import { freezeCommodity, frozenForSource, assertCommodityFreezeInvariant } from '../src/commodity-freezes.js';
import {
  applyTransportShip, applyCreateTransportRoute, applyServiceTransportNode,
  applyDeleteTransportRoute, processTransportWorld, migrateTransportWorld,
  transportRouteClientState, transportShipmentClientState,
} from '../src/transport.js';
import { transportFreightOffers, reconcileTransportTaskReserves, transportTaskRouteState } from '../src/transport-tasks.js';

const now = 1780000000000;
const user = { id: 8981, name: 'Transport Tasks', email: 'transport-tasks@example.com' };

function fixture() {
  const world = createWorld(now);
  const player = ensurePlayer(world, user, now);
  world.transportShipments = [];
  player.credits = 1000000;
  for (const provinceId of ['110000', '130000']) {
    const market = world.markets[provinceScopedKey(provinceId, 'industrial-fuel')];
    market.officialPrice = 1;
    market.nextPriceAt = now + 86400000;
    inventoryForProvince(player, 'industrial-fuel', provinceId).available = 100000;
  }
  assert.equal(applyCreateTransportRoute(world, user, {
    sourceProvinceId: '110000', destinationProvinceId: '130000', mode: 'road',
  }, now).ok, true);
  return { world, player, route: player.transportRoutes[0] };
}

function accept(world, player, route) {
  const offer = transportFreightOffers(world, player, route, now).find((entry) => entry.sourceProvinceId === route.sourceProvinceId && entry.quantity === 200);
  assert.ok(offer);
  const result = applyTransportShip(world, user, { operation: 'task-freight-accept', routeId: route.id, offerId: offer.id }, now);
  assert.equal(result.ok, true, result.message);
  return { task: player.transportTaskState.tasks[0], offer };
}

function start(world, route) {
  const result = applyTransportShip(world, user, { operation: 'task-cycle-start', routeId: route.id }, now + 1);
  assert.equal(result.ok, true, result.message);
  return world.transportShipments.at(-1);
}

function node(world, trip) {
  const at = trip.arrivesAt + 1;
  processTransportWorld(world, at);
  const command = { routeId: trip.routeId, cycleId: trip.id, visitIndex: trip.currentVisitIndex, unload: [], load: [] };
  const result = applyServiceTransportNode(world, user, command, at);
  assert.equal(result.ok, true, result.message);
  return { command, at };
}

test('freight offers and private projections are read-only; forged and repeated acceptance cannot mint goods', () => {
  const { world, player, route } = fixture();
  const before = JSON.stringify(world);
  transportRouteClientState(world, user.id);
  transportTaskRouteState(world, user.id, route, now);
  assert.equal(JSON.stringify(world), before);
  assert.equal(applyTransportShip(world, user, { operation: 'task-freight-accept', routeId: route.id, offerId: 'forged', reward: 999999 }, now).ok, false);
  assert.equal(JSON.stringify(world), before);
  const { task, offer } = accept(world, player, route);
  assert.equal(task.reward, offer.reward);
  assert.equal(task.escrowQuantity, offer.quantity);
  const accepted = JSON.stringify(world);
  assert.equal(applyTransportShip(world, user, { operation: 'task-freight-accept', routeId: route.id, offerId: offer.id }, now).ok, false);
  assert.equal(JSON.stringify(world), accepted);
});

test('external freight is never a player asset, fuel is charged once, and delivery pays exactly once', () => {
  const { world, player, route } = fixture();
  const { task } = accept(world, player, route);
  const goods = inventoryForProvince(player, task.productId, task.sourceProvinceId);
  const beforeGoods = structuredClone(goods);
  const fuel = inventoryForProvince(player, 'industrial-fuel', route.sourceProvinceId);
  const beforeFuel = fuel.available + fuel.frozen;
  const credits = player.credits;
  const trip = start(world, route);
  assert.equal(trip.taskCargo[0].quantity, 200);
  assert.equal(task.escrowQuantity, 0);
  if (task.productId !== 'industrial-fuel') assert.deepEqual(goods, beforeGoods);
  assert.equal(fuel.available + fuel.frozen, beforeFuel - trip.fuelPurchased);
  assert.equal(player.credits, Math.round((credits - trip.transportFee) * 1e6) / 1e6);
  assert.equal(transportShipmentClientState(world, user.id)[0].manifest[0].destinationProvinceId, task.destinationProvinceId);
  migrateTransportWorld(world);
  assert.equal(trip.taskCargo[0].quantity, 200);
  const { command, at } = node(world, trip);
  assert.equal(task.deliveredQuantity, 200);
  assert.equal(task.paid, task.reward);
  assert.equal(task.status, 'completed');
  const paid = JSON.stringify(world);
  assert.equal(applyServiceTransportNode(world, user, command, at + 1).ok, false);
  assert.equal(JSON.stringify(world), paid);
  node(world, trip);
  assert.equal(trip.status, 'arrived');
  assert.equal(trip.freightIncome, task.reward);
});

test('cancelling loaded freight preserves cargo and its fixed destination', () => {
  const { world, player, route } = fixture();
  const { task } = accept(world, player, route);
  const trip = start(world, route);
  assert.equal(applyTransportShip(world, user, { operation: 'task-cancel', routeId: route.id, taskId: task.id }, now + 2).ok, true);
  assert.equal(task.status, 'cancelling');
  assert.equal(trip.taskCargo[0].taskId, task.id);
  const quota = player.transportTaskState.quota.committedReward;
  node(world, trip);
  assert.equal(task.deliveredQuantity, 200);
  assert.equal(player.transportTaskState.quota.committedReward, quota);
  node(world, trip);
  assert.equal(trip.taskCargo.length, 0);
});

test('pending route deletion completes the paid trip before releasing remaining task custody', () => {
  const { world, player, route } = fixture();
  accept(world, player, route);
  const trip = start(world, route);
  assert.equal(applyDeleteTransportRoute(world, user, { routeId: route.id }, now + 2).ok, true);
  assert.equal(player.transportRoutes.length, 1);
  node(world, trip);
  assert.equal(player.transportRoutes.length, 1);
  node(world, trip);
  assert.equal(player.transportRoutes.length, 0);
  const fuel = inventoryForProvince(player, 'industrial-fuel', route.sourceProvinceId);
  assert.equal(frozenForSource(fuel, 'transport', `fuel:${route.id}`), 0);
  assertCommodityFreezeInvariant(fuel);
});

test('an offline task trip only reaches the current dock and does not deliver or pay', () => {
  const { world, player, route } = fixture();
  const { task } = accept(world, player, route);
  const trip = start(world, route);
  const credits = player.credits;
  processTransportWorld(world, trip.arrivesAt + 10 * 86400000);
  assert.equal(trip.status, 'docked');
  assert.equal(task.deliveredQuantity, 0);
  assert.equal(player.credits, credits);
  assert.equal(trip.taskCargo.length, 1);
});

test('task fuel cannot steal production custody and task configuration is server-validated', () => {
  const { world, player, route } = fixture();
  const fuel = inventoryForProvince(player, 'industrial-fuel', route.sourceProvinceId);
  freezeCommodity(fuel, 'production', 'other-building', fuel.available);
  const held = fuel.frozen;
  accept(world, player, route);
  reconcileTransportTaskReserves(world, player, user.id, now);
  assert.equal(frozenForSource(fuel, 'production', 'other-building'), held);
  assert.equal(frozenForSource(fuel, 'transport', `fuel:${route.id}`), 0);
  assert.equal(applyTransportShip(world, user, { operation: 'task-cycle-start', routeId: route.id, fuel: 0, capacity: 999999 }, now).ok, false);
  const before = JSON.stringify(world);
  assert.equal(applyTransportShip(world, user, { operation: 'task-supply-create', routeId: route.id,
    sourceProvinceId: route.sourceProvinceId, destinationProvinceId: route.destinationProvinceId,
    productId: 'wheat', targetQuantity: 0, budget: 100 }, now).ok, false);
  assert.equal(JSON.stringify(world), before);
});
