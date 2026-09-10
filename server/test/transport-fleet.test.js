import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createWorld, ensurePlayer } from '../src/domain.js';
import { EconomyStore } from '../src/storage.js';
import { inventoryForProvince } from '../src/provinces.js';
import {
  applyTransportShip, applyCreateTransportRoute, applyExpandTransportRoute,
  applyStartTransportCycle, applyServiceTransportNode, applyDeleteTransportRoute,
  migrateTransportWorld, processTransportWorld, transportCycleCost, transportRouteClientState,
} from '../src/transport.js';
import {
  TRANSPORT_MODE_POLICY, TRANSPORT_MAX_VEHICLES_PER_ROUTE, createTransportCyclePolicy,
  isTransportCyclePolicy, transportRouteVehicleCount, transportFleetCost, transportPolicyDurationMs,
} from '../../shared/transport-policy.js';

const now = 1_780_000_000_000;
const user = { id: 8912, name: 'Transport Fleet', email: 'transport-fleet@example.com' };
function fixture(mode = 'road') {
  const world = createWorld(now);
  world.transportShipments = [];
  const player = ensurePlayer(world, user, now);
  player.credits = 1_000_000;
  inventoryForProvince(player, 'industrial-fuel', '110000').available = 100_000;
  assert.equal(applyCreateTransportRoute(world, user, {
    sourceProvinceId: '110000', destinationProvinceId: '130000', mode,
    vehicleCount: 100, capacity: 99999,
  }, now).ok, true);
  return { world, player, route: player.transportRoutes[0] };
}
function expand(world, route, quantity = 2, extra = {}) {
  return applyTransportShip(world, user, { operation: 'route-expand', routeId: route.id,
    quantity, expectedVehicleCount: transportRouteVehicleCount(route), ...extra }, now + 1);
}
function start(world, route, count, load = []) {
  return applyStartTransportCycle(world, user, { routeId: route.id, vehicleCount: count, load }, now + 2);
}
function service(world, shipment, unload = [], load = []) {
  return applyServiceTransportNode(world, user, { routeId: shipment.routeId, cycleId: shipment.id,
    visitIndex: shipment.currentVisitIndex, unload, load }, shipment.arrivesAt + 1);
}

for (const [mode, unitCapacity, price] of [['road', 200, 80], ['rail', 2000, 1200], ['air', 500, 2400]]) {
  test(`${mode}: creation includes one vehicle, batch purchase pays only independent unit price`, () => {
    const { world, player, route } = fixture(mode);
    assert.equal(route.vehicleCount, 1);
    const credits = player.credits;
    const setupCost = route.setupCost;
    const path = [route.sourceProvinceId, route.destinationProvinceId, route.mode];
    assert.equal(expand(world, route, 3, { mode: 'air', sourceProvinceId: '120000', cost: 0 }).ok, true);
    assert.equal(route.vehicleCount, 4);
    assert.equal(player.credits, credits - 3 * price);
    assert.equal(route.setupCost, setupCost);
    assert.deepEqual([route.sourceProvinceId, route.destinationProvinceId, route.mode], path);
    assert.equal(transportRouteClientState(world, user.id)[0].vehicleCount, 4);
    assert.equal(createTransportCyclePolicy(mode, 4).capacity, unitCapacity * 4);
    assert.equal(world.transportShipments.length, 0);
  });

  test(`${mode}: only dispatched vehicles are paid, capacity scales without accelerating travel`, () => {
    const { world, player, route } = fixture(mode);
    assert.equal(expand(world, route, 4).ok, true);
    const stock = inventoryForProvince(player, 'wheat', '110000');
    stock.available = unitCapacity * 2;
    const fuel = inventoryForProvince(player, 'industrial-fuel', '110000');
    const beforeFuel = fuel.available;
    const beforeCredits = player.credits;
    assert.equal(start(world, route, 2, [{ productId: 'wheat', quantity: unitCapacity * 2 }]).ok, true);
    const shipment = world.transportShipments[0];
    const expectedCost = transportCycleCost(route, mode, 2);
    assert.equal(shipment.policySnapshot.vehicleCount, 2);
    assert.equal(shipment.policySnapshot.unitCapacity, unitCapacity);
    assert.equal(shipment.policySnapshot.capacity, 2 * unitCapacity);
    assert.equal(shipment.transportFee, expectedCost.transportFee);
    assert.equal(shipment.fuelPurchased, expectedCost.fuelPurchased);
    assert.equal(player.credits, Math.round((beforeCredits - expectedCost.transportFee) * 1e6) / 1e6);
    assert.equal(fuel.available, beforeFuel - expectedCost.fuelPurchased);
    assert.equal(shipment.arrivesAt - shipment.departsAt,
      transportPolicyDurationMs(createTransportCyclePolicy(mode, 1), shipment.currentLeg.distanceKm));
    assert.equal(route.vehicleCount, 5);
    assert.equal(world.transportShipments.length, 1);
    assert.equal(start(world, route, 1).ok, false);
  });
}

test('fleet fuel rounds once after full distance and dispatched count, not per vehicle or per leg', () => {
  const result = transportFleetCost('road', 123, 3);
  assert.equal(result.fuelPurchased, 2);
  assert.notEqual(result.fuelPurchased, 3 * Math.ceil(123 * 0.005));
  assert.equal(result.transportFee, 5.535);
  assert.equal(transportFleetCost('air', 1234.56789, 7).fuelPurchased, Math.ceil(1234.56789 * 0.08 * 7));
  assert.throws(() => transportFleetCost('air', 100, 0));
  assert.throws(() => createTransportCyclePolicy('road', 1.1));
  assert.equal(isTransportCyclePolicy({ ...createTransportCyclePolicy('road', 2), capacity: 200 }), false);
});

test('invalid, stale, oversized, foreign and unaffordable expansion has no asset effects', () => {
  const { world, player, route } = fixture();
  for (const quantity of [0, -1, 0.5, '2', null, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER, TRANSPORT_MAX_VEHICLES_PER_ROUTE]) {
    const before = JSON.stringify(world);
    assert.equal(expand(world, route, quantity).ok, false);
    assert.equal(JSON.stringify(world), before);
  }
  assert.equal(expand(world, route, 1, { expectedVehicleCount: 0 }).ok, false);
  assert.equal(applyExpandTransportRoute(world, { ...user, id: 999999 }, { routeId: route.id, quantity: 1, expectedVehicleCount: 1 }, now).ok, false);
  ensurePlayer(world, { id: 999998, name: 'Other', email: 'other-fleet@example.com' }, now);
  assert.equal(applyExpandTransportRoute(world, { id: 999998 }, { routeId: route.id, quantity: 1, expectedVehicleCount: 1 }, now).ok, false);
  player.credits = 79;
  const before = JSON.stringify(world);
  assert.equal(expand(world, route, 1).ok, false);
  assert.equal(JSON.stringify(world), before);
  player.credits = 100000;
  assert.equal(expand(world, route, 1).ok, true);
  const paid = JSON.stringify(world);
  assert.equal(expand(world, route, 1, { expectedVehicleCount: 1 }).ok, false);
  assert.equal(JSON.stringify(world), paid);
});

test('dispatch rejects unowned or fractional vehicles and capacity/fuel forgery before charging', () => {
  const { world, player, route } = fixture();
  const before = JSON.stringify(world);
  for (const count of [0, -1, 2, 1.5, '1', null, 101]) {
    assert.equal(start(world, route, count).ok, false);
    assert.equal(JSON.stringify(world), before);
  }
  assert.equal(expand(world, route, 2).ok, true);
  const stock = inventoryForProvince(player, 'wheat', '110000');
  stock.available = 1000;
  const paid = JSON.stringify(world);
  assert.equal(start(world, route, 2, [{ productId: 'wheat', quantity: 401 }]).ok, false);
  assert.equal(JSON.stringify(world), paid);
  const fuel = inventoryForProvince(player, 'industrial-fuel', '110000');
  fuel.available = transportCycleCost(route, route.mode, 2).fuelPurchased + 1;
  const joint = JSON.stringify(world);
  assert.equal(start(world, route, 2, [{ productId: 'industrial-fuel', quantity: 2 }]).ok, false);
  assert.equal(JSON.stringify(world), joint);
});

test('purchasing while in transit does not change paid policy, cargo, costs or deadlines', () => {
  const { world, player, route } = fixture();
  inventoryForProvince(player, 'wheat', '110000').available = 200;
  assert.equal(start(world, route, 1, [{ productId: 'wheat', quantity: 200 }]).ok, true);
  const shipment = world.transportShipments[0];
  const snapshot = JSON.stringify(shipment);
  assert.equal(expand(world, route, 3).ok, true);
  assert.equal(JSON.stringify(shipment), snapshot);
  processTransportWorld(world, shipment.arrivesAt + 1);
  inventoryForProvince(player, 'ore', '130000').available = 1000;
  assert.equal(service(world, shipment, [], [{ productId: 'ore', quantity: 1 }]).ok, false);
  assert.equal(service(world, shipment, [{ productId: 'wheat', quantity: 200 }], [{ productId: 'ore', quantity: 200 }]).ok, true);
  processTransportWorld(world, shipment.arrivesAt + 1);
  assert.equal(service(world, shipment, [{ productId: 'ore', quantity: 200 }]).ok, true);
  assert.equal(start(world, route, 4).ok, true);
  assert.equal(world.transportShipments.at(-1).policySnapshot.capacity, 800);
});

test('path and mode remain immutable after expansion; deleting waits for the entire paid batch', () => {
  const { world, player, route } = fixture();
  assert.equal(expand(world, route, 2).ok, true);
  const before = JSON.stringify(route);
  assert.equal(applyTransportShip(world, user, { operation: 'route-update', routeId: route.id, mode: 'air', destinationProvinceId: '120000' }, now).ok, false);
  assert.equal(JSON.stringify(route), before);
  assert.equal(start(world, route, 3).ok, true);
  assert.equal(applyDeleteTransportRoute(world, user, { routeId: route.id }, now).ok, true);
  const credits = player.credits;
  assert.equal(expand(world, route, 1).ok, false);
  const shipment = world.transportShipments[0];
  processTransportWorld(world, shipment.arrivesAt + 1);
  assert.equal(service(world, shipment).ok, true);
  processTransportWorld(world, shipment.arrivesAt + 1);
  assert.equal(service(world, shipment).ok, true);
  assert.equal(player.transportRoutes.length, 0);
  assert.equal(player.credits, credits);
});

test('legacy routes normalize once; version-three aircraft stay at 300 until their next trip', () => {
  const { world, player, route } = fixture('air');
  delete route.vehicleCount;
  migrateTransportWorld(world);
  assert.equal(player.transportRoutes[0].vehicleCount, 1);
  const migrated = player.transportRoutes[0];
  assert.equal(expand(world, migrated, 2).ok, true);
  assert.equal(start(world, migrated, 1).ok, true);
  const shipment = world.transportShipments[0];
  const v3 = { ...createTransportCyclePolicy('air'), version: 3, capacity: 300 };
  delete v3.vehicleCount;
  delete v3.unitCapacity;
  shipment.policySnapshot = v3;
  const before = JSON.stringify(shipment);
  migrateTransportWorld(world);
  migrateTransportWorld(world);
  assert.equal(player.transportRoutes[0].vehicleCount, 3);
  assert.equal(JSON.stringify(shipment), before);
  processTransportWorld(world, shipment.arrivesAt + 1);
  assert.equal(service(world, shipment).ok, true);
  processTransportWorld(world, shipment.arrivesAt + 1);
  assert.equal(service(world, shipment).ok, true);
  assert.equal(start(world, player.transportRoutes[0], 3).ok, true);
  assert.equal(world.transportShipments.at(-1).policySnapshot.capacity, 1500);
});

test('real SQLite transport writes replay idempotently and preserve purchased fleet on cold reopen', () => {
  const directory = mkdtempSync(join(tmpdir(), 'economy-transport-fleet-'));
  const path = join(directory, 'world.sqlite');
  let store = new EconomyStore(path);
  try {
    store.getStateSnapshot(user, undefined, now);
    const request = (payload, key) => ({ action: 'transportShip', payload, requestKey: key,
      method: 'POST', path: '/api/game/transport' });
    const created = store.apply(user, request({ operation: 'route-create', sourceProvinceId: '110000', destinationProvinceId: '130000', mode: 'road' }, 'fleet-create'), now + 1);
    assert.equal(created.result.ok, true);
    const state = store.getStateSnapshot(user, undefined, now + 1).state;
    const routeId = state.transportRoutes[0].id;
    const command = request({ operation: 'route-expand', routeId, quantity: 1, expectedVehicleCount: 1 }, 'fleet-expand');
    const bought = store.apply(user, command, now + 2);
    assert.equal(bought.result.ok, true);
    const paid = store.getStateSnapshot(user, undefined, now + 2).state;
    const repeated = store.apply(user, command, now + 3);
    assert.deepEqual(repeated.result, bought.result);
    assert.equal(store.getStateSnapshot(user, undefined, now + 3).state.credits, paid.credits);
    assert.equal(store.apply(user, { ...command, requestKey: 'stale-new-key' }, now + 4).result.ok, false);
    store.close();
    store = new EconomyStore(path);
    const reopened = store.getStateSnapshot(user, undefined, now + 5).state;
    assert.equal(reopened.transportRoutes[0].vehicleCount, 2);
    assert.equal(reopened.credits, paid.credits);
    assert.equal(reopened.transportRoutes[0].mode, 'road');
  } finally { store.close(); rmSync(directory, { recursive: true, force: true }); }
});


test('prototype names and non-string modes cannot create routes or policies', () => {
  const { world, player } = fixture();
  const before = JSON.stringify(player);
  for (const mode of ['__proto__', 'constructor', 'toString', ['road'], null]) {
    assert.equal(applyCreateTransportRoute(world, user, { sourceProvinceId: '110000', destinationProvinceId: '130000', mode }, now).ok, false);
  }
  assert.equal(JSON.stringify(player), before);
  assert.throws(() => createTransportCyclePolicy('__proto__'));
  assert.throws(() => transportFleetCost('constructor', 100, 1));
});
