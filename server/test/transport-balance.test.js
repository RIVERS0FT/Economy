import assert from 'node:assert/strict';
import test from 'node:test';
import { createWorld, ensurePlayer } from '../src/domain.js';
import { inventoryForProvince } from '../src/provinces.js';
import {
  applyCreateTransportRoute, applyStartTransportCycle, applyServiceTransportNode,
  migrateTransportWorld, processTransportWorld, transportCycleCost, transportCycleDistanceKm,
  transportRouteSetupCost, transportShipmentClientState, TRANSPORT_MODES,
} from '../src/transport.js';
import {
  createTransportCyclePolicy, legacyTransportCyclePolicy,
  transportPolicyDurationMs, isTransportCyclePolicy,
} from '../../shared/transport-policy.js';

const now = 1_780_000_000_000;
const user = { id: 251, email: 'transport-balance@example.com', name: 'Transport Balance' };
const round = (value) => Math.round(value * 1_000_000) / 1_000_000;
function fixture(mode = 'road') {
  const world = createWorld(now);
  world.transportShipments = [];
  const player = ensurePlayer(world, user, now);
  player.credits = 100000;
  inventoryForProvince(player, 'industrial-fuel', '110000').available = 10000;
  const created = applyCreateTransportRoute(world, user, {
    sourceProvinceId: '110000', destinationProvinceId: '130000', mode,
  }, now);
  assert.equal(created.ok, true);
  return { world, player, route: player.transportRoutes[0] };
}
function service(world, shipment, unload = [], load = []) {
  return applyServiceTransportNode(world, user, {
    routeId: shipment.routeId, cycleId: shipment.id,
    visitIndex: shipment.currentVisitIndex, unload, load,
  }, Number(shipment.arrivesAt) + 1);
}

for (const [mode, capacity, rate, seconds] of [
  ['road', 200, 0.015, 70], ['rail', 2000, 0.02, 135], ['air', 300, 0.22, 30],
]) {
  test(`${mode} uses the approved capacity, distance-only fees and per-leg startup time`, () => {
    const { world, player, route } = fixture(mode);
    assert.equal(TRANSPORT_MODES[mode].capacity, capacity);
    assert.equal(transportPolicyDurationMs(createTransportCyclePolicy(mode), 1000), seconds * 1000);
    assert.equal(route.setupCost, transportRouteSetupCost(route));
    const cycle = transportCycleCost(route);
    assert.ok(Math.abs(cycle.totalCost - round(transportCycleDistanceKm(route) * rate)) <= 0.0000011);
    const before = player.credits;
    assert.equal(applyStartTransportCycle(world, user, { routeId: route.id, load: [] }, now + 1).ok, true);
    const shipment = world.transportShipments[0];
    assert.equal(player.credits, round(before - cycle.totalCost));
    assert.equal(cycle.fuelPurchased, Math.ceil(cycle.distanceKm * TRANSPORT_MODES[mode].fuelPerKm));
    assert.equal(cycle.fuelCost, 0);
    assert.equal(inventoryForProvince(player, 'industrial-fuel', '110000').available, 10000 - cycle.fuelPurchased);
    assert.deepEqual(shipment.policySnapshot, createTransportCyclePolicy(mode));
    assert.equal(shipment.arrivesAt - shipment.departsAt, transportPolicyDurationMs(shipment.policySnapshot, shipment.currentLeg.distanceKm));
    processTransportWorld(world, shipment.arrivesAt + 1);
    const afterFirstLeg = player.credits;
    assert.equal(service(world, shipment).ok, true);
    assert.equal(player.credits, afterFirstLeg);
    processTransportWorld(world, shipment.arrivesAt + 1);
    assert.equal(service(world, shipment).ok, true);
    assert.equal(shipment.status, 'arrived');
    assert.equal(shipment.fuelConsumed, shipment.fuelPurchased);
    assert.equal(player.credits, afterFirstLeg);
  });
}

test('empty and full vehicles pay identical complete-cycle charges, not quantity fees', () => {
  const results = [];
  for (const quantity of [0, 200]) {
    const { world, player, route } = fixture();
    inventoryForProvince(player, 'wheat', route.sourceProvinceId).available = 200;
    const load = quantity ? [{ productId: 'wheat', quantity }] : [];
    assert.equal(applyStartTransportCycle(world, user, { routeId: route.id, load }, now + 1).ok, true);
    results.push(world.transportShipments[0].cost);
  }
  assert.equal(results[0], results[1]);
});

test('client-supplied rates, capacity, distance and deadlines never override a new cycle policy', () => {
  const { world, player, route } = fixture('air');
  inventoryForProvince(player, 'wheat', route.sourceProvinceId).available = 500;
  const before = player.credits;
  const forged = {
    routeId: route.id, load: [{ productId: 'wheat', quantity: 301 }],
    policySnapshot: { ...createTransportCyclePolicy('air'), capacity: 100000, secondsPerKm: 0, fuelPerKm: 0 },
    cost: 0, distanceKm: 0, arrivesAt: now,
  };
  assert.equal(applyStartTransportCycle(world, user, forged, now + 1).ok, false);
  assert.equal(player.credits, before);
  assert.equal(inventoryForProvince(player, 'wheat', route.sourceProvinceId).available, 500);
  assert.equal(world.transportShipments.length, 0);
  forged.load[0].quantity = 300;
  assert.equal(applyStartTransportCycle(world, user, forged, now + 1).ok, true);
  const shipment = world.transportShipments[0];
  assert.deepEqual(shipment.policySnapshot, createTransportCyclePolicy('air'));
  assert.equal(shipment.cost, transportCycleCost(route).totalCost);
  assert.ok(shipment.arrivesAt > now + 1);
});

test('legacy aircraft retain 500 cargo slots, paid fees and their existing arrival deadline', () => {
  const { world, player, route } = fixture('air');
  const source = inventoryForProvince(player, 'wheat', route.sourceProvinceId);
  source.available = 500;
  assert.equal(applyStartTransportCycle(world, user, { routeId: route.id, load: [{ productId: 'wheat', quantity: 300 }] }, now + 1).ok, true);
  const shipment = world.transportShipments[0];
  // Model a persisted pre-snapshot aircraft cycle carrying its full old load.
  delete shipment.policySnapshot;
  shipment.cargoLots[0].quantity = 500;
  source.available = 0;
  source.inTransit = 500;
  route.setupCost = 550;
  shipment.cost = 812.345678;
  shipment.transportFee = 548.333333;
  shipment.fuelCost = 264.012345;
  shipment.fuelPurchased = 264.012345;
  const before = { credits: player.credits, cost: shipment.cost, arrival: shipment.arrivesAt, source: { ...source } };
  migrateTransportWorld(world);
  const once = JSON.stringify(shipment);
  migrateTransportWorld(world);
  assert.equal(JSON.stringify(shipment), once);
  assert.deepEqual(shipment.policySnapshot, legacyTransportCyclePolicy('air'));
  assert.equal(shipment.cost, before.cost);
  assert.equal(shipment.arrivesAt, before.arrival);
  assert.equal(player.credits, before.credits);
  assert.deepEqual(source, before.source);
  assert.equal(player.transportRoutes[0].setupCost, 550);

  processTransportWorld(world, shipment.arrivesAt + 10 * 86400000);
  assert.equal(shipment.status, 'docked');
  assert.equal(shipment.currentVisitIndex, 1);
  const ore = inventoryForProvince(player, 'ore', route.destinationProvinceId);
  ore.available = 100;
  const oldCredits = player.credits;
  assert.equal(service(world, shipment, [{ productId: 'wheat', quantity: 100 }], [{ productId: 'ore', quantity: 100 }]).ok, true);
  assert.equal(shipment.cargoLots.reduce((sum, lot) => sum + lot.quantity, 0), 500);
  assert.equal(shipment.arrivesAt - shipment.departsAt, transportPolicyDurationMs(legacyTransportCyclePolicy('air'), shipment.currentLeg.distanceKm));
  assert.equal(player.credits, oldCredits);
  const projection = transportShipmentClientState(world, user.id)[0];
  assert.equal(projection.policySnapshot.capacity, 500);
  assert.equal(projection.deliveredQuantity, 100);
  projection.policySnapshot.capacity = 1;
  assert.equal(shipment.policySnapshot.capacity, 500);
  processTransportWorld(world, shipment.arrivesAt + 1);
  assert.equal(service(world, shipment, [{ productId: 'wheat', quantity: 400 }, { productId: 'ore', quantity: 100 }]).ok, true);
  assert.equal(shipment.status, 'arrived');
  assert.equal(source.inTransit, 0);
  assert.equal(inventoryForProvince(player, 'ore', route.destinationProvinceId).inTransit, 0);
  assert.equal(applyStartTransportCycle(world, user, { routeId: route.id, load: [] }, shipment.arrivedAt + 1).ok, true);
  assert.equal(world.transportShipments.at(-1).policySnapshot.capacity, 300);
});

test('paid policy survives serialization and does not reprice after a market change', () => {
  const { world, player, route } = fixture();
  assert.equal(applyStartTransportCycle(world, user, { routeId: route.id, load: [] }, now + 1).ok, true);
  const original = world.transportShipments[0];
  const paid = original.cost;
  const policy = { ...original.policySnapshot };
  const restored = JSON.parse(JSON.stringify(world));
  migrateTransportWorld(restored);
  for (const market of Object.values(restored.markets || {})) market.officialPrice = 9999;
  const shipment = restored.transportShipments[0];
  const restoredPlayer = restored.players[String(user.id)];
  const credits = restoredPlayer.credits;
  processTransportWorld(restored, shipment.arrivesAt + 1);
  assert.equal(service(restored, shipment).ok, true);
  assert.deepEqual(shipment.policySnapshot, policy);
  assert.equal(shipment.cost, paid);
  assert.equal(restoredPlayer.credits, credits);
  assert.equal(player.credits, credits);
});

test('insufficient money and unavailable or overflowing cargo reject without partial asset mutations', () => {
  const { world, player, route } = fixture();
  const stock = inventoryForProvince(player, 'wheat', route.sourceProvinceId);
  stock.available = 0;
  stock.frozen = 1000;
  const credits = player.credits;
  assert.equal(applyStartTransportCycle(world, user, { routeId: route.id, load: [{ productId: 'wheat', quantity: 1 }] }, now).ok, false);
  assert.equal(player.credits, credits);
  assert.equal(stock.frozen, 1000);
  const overflow = [{ productId: 'wheat', quantity: Number.MAX_SAFE_INTEGER }, { productId: 'wheat', quantity: 1 }];
  assert.equal(applyStartTransportCycle(world, user, { routeId: route.id, load: overflow }, now).ok, false);
  player.credits = 0;
  assert.equal(applyStartTransportCycle(world, user, { routeId: route.id, load: [] }, now).ok, false);
  assert.equal(player.credits, 0);
  assert.equal(world.transportShipments.length, 0);
  assert.equal(isTransportCyclePolicy({ ...createTransportCyclePolicy('road'), capacity: -1 }), false);
});


test('missing commodity fuel and joint fuel-cargo shortages reject before any asset mutation', () => {
  const { world, player, route } = fixture();
  const fuel = inventoryForProvince(player, 'industrial-fuel', route.sourceProvinceId);
  const required = transportCycleCost(route).fuelPurchased;
  fuel.available = required - 1;
  fuel.frozen = 10000;
  fuel.inTransit = 10000;
  const before = JSON.stringify(player);
  assert.equal(applyStartTransportCycle(world, user, { routeId: route.id, load: [] }, now).ok, false);
  assert.equal(JSON.stringify(player), before);
  assert.equal(world.transportShipments.length, 0);
  fuel.available = required + 2;
  const beforeJoint = JSON.stringify(player);
  assert.equal(applyStartTransportCycle(world, user, {
    routeId: route.id, load: [{ productId: 'industrial-fuel', quantity: 3 }],
  }, now).ok, false);
  assert.equal(JSON.stringify(player), beforeJoint);
  const credits = player.credits;
  assert.equal(applyStartTransportCycle(world, user, {
    routeId: route.id, load: [{ productId: 'industrial-fuel', quantity: 2 }],
  }, now).ok, true);
  assert.equal(fuel.available, 0);
  assert.equal(fuel.frozen, 10000);
  assert.equal(fuel.inTransit, 10002);
  assert.equal(player.credits, round(credits - transportCycleCost(route).transportFee));
  const paidState = JSON.stringify(player);
  assert.equal(applyStartTransportCycle(world, user, { routeId: route.id, load: [] }, now + 1).ok, false);
  assert.equal(JSON.stringify(player), paidState);
});

test('intermediate partial swapping records actual visits and rejects missing or stale node generations', () => {
  const { world, player, route } = fixture();
  // Three saved stops produce five distinct visits including the return.
  route.viaProvinceIds = ['120000'];
  inventoryForProvince(player, 'wheat', '110000').available = 100;
  inventoryForProvince(player, 'ore', '120000').available = 30;
  assert.equal(applyStartTransportCycle(world, user, { routeId: route.id, load: [{ productId: 'wheat', quantity: 100 }] }, now).ok, true);
  const shipment = world.transportShipments[0];
  const paidFuel = inventoryForProvince(player, 'industrial-fuel', '110000').available;
  const paidCredits = player.credits;
  processTransportWorld(world, shipment.arrivesAt + 1);
  const request = { routeId: route.id, cycleId: shipment.id, visitIndex: 1,
    unload: [{ productId: 'wheat', quantity: 30 }], load: [{ productId: 'ore', quantity: 30 }] };
  const before = JSON.stringify(player);
  assert.equal(applyServiceTransportNode(world, user, { ...request, cycleId: undefined }, shipment.arrivesAt + 2).ok, false);
  assert.equal(JSON.stringify(player), before);
  assert.equal(applyServiceTransportNode(world, user, request, shipment.arrivesAt + 2).ok, true);
  const after = JSON.stringify(player);
  assert.equal(applyServiceTransportNode(world, user, request, shipment.arrivesAt + 2).ok, false);
  assert.equal(JSON.stringify(player), after);
  assert.equal(shipment.nodeHistory[1].visitIndex, 1);
  assert.deepEqual(shipment.nodeHistory[1].unload, request.unload);
  const projection = transportShipmentClientState(world, user.id)[0];
  assert.equal(projection.manifest.some((entry) => Object.hasOwn(entry, 'destinationProvinceId')), false);
  projection.nodeHistory[1].load[0].quantity = 999;
  assert.equal(shipment.nodeHistory[1].load[0].quantity, 30);
  assert.equal(player.credits, paidCredits);
  assert.equal(inventoryForProvince(player, 'industrial-fuel', '110000').available, paidFuel);
  processTransportWorld(world, shipment.arrivesAt + 1);
  assert.equal(service(world, shipment, [{ productId: 'wheat', quantity: 70 }, { productId: 'ore', quantity: 30 }]).ok, true);
  processTransportWorld(world, shipment.arrivesAt + 1);
  assert.equal(shipment.currentVisitIndex, 3);
  assert.equal(service(world, shipment, [], [{ productId: 'wheat', quantity: 30 }]).ok, true);
  assert.equal(shipment.nodeHistory.at(-1).visitIndex, 3);
  processTransportWorld(world, shipment.arrivesAt + 1);
  assert.equal(service(world, shipment, [{ productId: 'wheat', quantity: 30 }]).ok, true);
  assert.equal(player.credits, paidCredits);
  assert.equal(inventoryForProvince(player, 'industrial-fuel', '110000').available, paidFuel);
});

test('version-two prepaid cash fuel snapshots never backcharge inventory on subsequent visits', () => {
  const { world, player, route } = fixture();
  assert.equal(applyStartTransportCycle(world, user, { routeId: route.id, load: [] }, now).ok, true);
  const shipment = world.transportShipments[0];
  shipment.policySnapshot = { ...createTransportCyclePolicy('road'), version: 2, fuelUnitPrice: 1 };
  delete shipment.policySnapshot.fuelProductId;
  shipment.fuelPurchased = 2.345678;
  shipment.fuelCost = 2.345678;
  shipment.fuelConsumed = 0.5;
  shipment.cost = 10.345678;
  const fuel = inventoryForProvince(player, 'industrial-fuel', '110000');
  const stock = fuel.available;
  const credits = player.credits;
  migrateTransportWorld(world);
  processTransportWorld(world, shipment.arrivesAt + 1);
  assert.equal(service(world, shipment).ok, true);
  processTransportWorld(world, shipment.arrivesAt + 1);
  assert.equal(service(world, shipment).ok, true);
  assert.equal(fuel.available, stock);
  assert.equal(player.credits, credits);
  assert.equal(shipment.fuelCost, 2.345678);
  assert.equal(shipment.cost, 10.345678);
  assert.equal(shipment.policySnapshot.version, 2);
});
