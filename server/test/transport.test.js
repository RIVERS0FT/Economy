import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, createClientState, createWorld, ensurePlayer } from '../src/domain.js';
import {
  defaultTransportRouteName,
  migrateTransportWorld,
  nextTransportDeadline,
  processTransportWorld,
  transportCycleCost,
  transportCycleDistanceKm,
  transportRouteSetupCost,
  transportTraversalStops,
  TRANSPORT_MAX_ROUTES_PER_PLAYER,
  TRANSPORT_MODES,
} from '../src/transport.js';
import { inventoryForProvince } from '../src/provinces.js';

const alice = { id: 1, email: 'alice@example.com', name: 'Alice' };
const bob = { id: 2, email: 'bob@example.com', name: 'Bob' };
const now = 1_700_000_000_000;

function unlockedPlayer(world, user, credits = 100_000) {
  const player = ensurePlayer(world, user, now);
  player.credits = credits;
  player.startingProvinceChosen = true;
  player.startingProvinceId = '110000';
  player.unlockedProvinces = ['110000', '130000', '120000'];
  inventoryForProvince(player, 'industrial-fuel', '110000').available = 10000;
  return player;
}

function createRoute(world, user, input = {}, at = now + 1) {
  return applyAction(world, user, 'transportShip', {
    operation: 'route-create',
    sourceProvinceId: '110000',
    destinationProvinceId: '130000',
    mode: 'road',
    ...input,
  }, at);
}

function startCycle(world, user, routeId, load = [], at = now + 2) {
  return applyAction(world, user, 'transportShip', {
    operation: 'cycle-start',
    routeId,
    load,
  }, at);
}

function serviceNode(world, user, shipment, unload = [], load = [], at = now + 3) {
  return applyAction(world, user, 'transportShip', {
    operation: 'node-service',
    routeId: shipment.routeId,
    cycleId: shipment.id,
    visitIndex: shipment.currentVisitIndex,
    unload,
    load,
  }, at);
}

test('transport route creation charges setup only and derives non-closed routes as return trips', () => {
  const world = createWorld(now);
  const player = unlockedPlayer(world, alice);
  const creditsBefore = player.credits;

  const created = createRoute(world, alice, { tripType: 'one-way' });
  assert.equal(created.ok, true);
  assert.equal(player.transportRoutes.length, 1);
  const route = player.transportRoutes[0];
  assert.equal(route.name, defaultTransportRouteName('110000', '130000'));
  assert.equal(route.tripType, 'round');
  assert.equal(route.mode, 'road');
  assert.equal(route.setupCost, transportRouteSetupCost(route, route.mode));
  assert.equal(player.credits, creditsBefore - route.setupCost);
  assert.deepEqual(world.transportShipments, []);
  assert.deepEqual(transportTraversalStops(route), ['110000', '130000', '110000']);
});

test('source equal to destination creates a single closed loop instead of a return traversal', () => {
  const world = createWorld(now);
  const player = unlockedPlayer(world, bob);
  const created = createRoute(world, bob, {
    destinationProvinceId: '110000',
    viaProvinceIds: ['130000', '120000'],
    tripType: 'round',
  });
  assert.equal(created.ok, true);
  const route = player.transportRoutes[0];
  assert.equal(route.tripType, 'one-way');
  assert.deepEqual(transportTraversalStops(route), ['110000', '130000', '120000', '110000']);
});

test('cycle transport fee and fuel depend only on full-cycle distance', () => {
  const route = {
    sourceProvinceId: '110000',
    destinationProvinceId: '130000',
    mode: 'road',
  };
  const distanceKm = transportCycleDistanceKm(route);
  const cost = transportCycleCost(route);
  assert.ok(distanceKm > 0);
  assert.equal(cost.distanceKm, distanceKm);
  assert.equal(
    cost.transportFee,
    Math.round(distanceKm * TRANSPORT_MODES.road.transportFeePerKm * 1_000_000) / 1_000_000,
  );
  assert.equal(
    cost.fuelPurchased,
    Math.ceil(distanceKm * TRANSPORT_MODES.road.fuelPerKm),
  );
  assert.equal(Number((cost.transportFee + cost.fuelCost).toFixed(6)), Number(cost.totalCost.toFixed(6)));
  assert.equal(Object.hasOwn(TRANSPORT_MODES.road, 'unitCostPerKm'), false);
  assert.equal(Object.hasOwn(TRANSPORT_MODES.road, 'fixedCost'), false);
});

test('cycle start pays full transport and fuel cost once and starts only the first leg', () => {
  const world = createWorld(now);
  const player = unlockedPlayer(world, alice);
  inventoryForProvince(player, 'wheat', '110000').available = 80;
  assert.equal(createRoute(world, alice).ok, true);
  const route = player.transportRoutes[0];
  const creditsBeforeCycle = player.credits;
  const expectedCost = transportCycleCost(route);

  const started = startCycle(world, alice, route.id, [{ productId: 'wheat', quantity: 50 }]);
  assert.equal(started.ok, true);
  assert.equal(world.transportShipments.length, 1);
  const shipment = world.transportShipments[0];
  assert.equal(shipment.status, 'in-transit');
  assert.equal(shipment.currentVisitIndex, 0);
  assert.equal(shipment.nextVisitIndex, 1);
  assert.equal(shipment.currentLeg.fromProvinceId, '110000');
  assert.equal(shipment.currentLeg.toProvinceId, '130000');
  assert.equal(shipment.transportFee, expectedCost.transportFee);
  assert.equal(shipment.fuelCost, expectedCost.fuelCost);
  assert.equal(shipment.cost, expectedCost.totalCost);
  assert.equal(shipment.fuelPurchased, expectedCost.fuelPurchased);
  assert.equal(shipment.fuelCost, 0);
  assert.equal(inventoryForProvince(player, 'industrial-fuel', '110000').available, 10000 - expectedCost.fuelPurchased);
  assert.equal(player.credits, creditsBeforeCycle - expectedCost.totalCost);
  assert.equal(inventoryForProvince(player, 'wheat', '110000').available, 30);
  assert.equal(inventoryForProvince(player, 'wheat', '110000').inTransit, 50);
});

test('cycle may depart the origin empty because later nodes can provide cargo', () => {
  const world = createWorld(now);
  const player = unlockedPlayer(world, bob);
  assert.equal(createRoute(world, bob).ok, true);
  const route = player.transportRoutes[0];
  const creditsBeforeCycle = player.credits;
  const expectedCost = transportCycleCost(route);

  const started = startCycle(world, bob, route.id, []);
  assert.equal(started.ok, true);
  assert.equal(world.transportShipments[0].cargoLots.length, 0);
  assert.equal(player.credits, creditsBeforeCycle - expectedCost.totalCost);
});

test('offline/world processing only docks the current leg and never departs the next leg', () => {
  const world = createWorld(now);
  const player = unlockedPlayer(world, alice);
  inventoryForProvince(player, 'wheat', '110000').available = 20;
  assert.equal(createRoute(world, alice).ok, true);
  const route = player.transportRoutes[0];
  assert.equal(startCycle(world, alice, route.id, [{ productId: 'wheat', quantity: 20 }]).ok, true);
  const shipment = world.transportShipments[0];
  const creditsAfterStart = player.credits;
  const firstArrival = shipment.arrivesAt;

  processTransportWorld(world, firstArrival + 1);
  assert.equal(shipment.status, 'docked');
  assert.equal(shipment.currentVisitIndex, 1);
  assert.equal(shipment.currentLeg, null);
  assert.equal(player.credits, creditsAfterStart);
  assert.equal(inventoryForProvince(player, 'wheat', '110000').inTransit, 20);
  assert.equal(inventoryForProvince(player, 'wheat', '130000').available, 0);

  processTransportWorld(world, firstArrival + 10 * 24 * 60 * 60 * 1000);
  assert.equal(shipment.status, 'docked');
  assert.equal(shipment.currentVisitIndex, 1);
  assert.equal(shipment.currentLeg, null);
  assert.equal(player.credits, creditsAfterStart);
});

test('client node service unloads and loads atomically without another fee', () => {
  const world = createWorld(now);
  const player = unlockedPlayer(world, bob);
  inventoryForProvince(player, 'wheat', '110000').available = 20;
  inventoryForProvince(player, 'ore', '130000').available = 30;
  assert.equal(createRoute(world, bob).ok, true);
  const route = player.transportRoutes[0];
  assert.equal(startCycle(world, bob, route.id, [{ productId: 'wheat', quantity: 20 }]).ok, true);
  const shipment = world.transportShipments[0];
  processTransportWorld(world, shipment.arrivesAt + 1);
  const creditsBeforeService = player.credits;

  const serviced = serviceNode(
    world,
    bob,
    shipment,
    [{ productId: 'wheat', quantity: 20 }],
    [{ productId: 'ore', quantity: 30 }],
    shipment.arrivesAt + 2,
  );
  assert.equal(serviced.ok, true);
  assert.equal(shipment.status, 'in-transit');
  assert.equal(shipment.currentLeg.fromProvinceId, '130000');
  assert.equal(shipment.currentLeg.toProvinceId, '110000');
  assert.equal(player.credits, creditsBeforeService);
  assert.equal(inventoryForProvince(player, 'wheat', '110000').inTransit, 0);
  assert.equal(inventoryForProvince(player, 'wheat', '130000').available, 20);
  assert.equal(inventoryForProvince(player, 'ore', '130000').available, 0);
  assert.equal(inventoryForProvince(player, 'ore', '130000').inTransit, 30);

  processTransportWorld(world, shipment.arrivesAt + 1);
  assert.equal(shipment.status, 'docked');
  assert.equal(shipment.currentVisitIndex, 2);
  const returned = serviceNode(
    world,
    bob,
    shipment,
    [{ productId: 'ore', quantity: 30 }],
    [],
    shipment.arrivesAt + 2,
  );
  assert.equal(returned.ok, true);
  assert.equal(shipment.status, 'arrived');
  assert.equal(inventoryForProvince(player, 'ore', '130000').inTransit, 0);
  assert.equal(inventoryForProvince(player, 'ore', '110000').available, 30);
  assert.equal(player.credits, creditsBeforeService);
});

test('node service rejects invalid capacity before changing assets', () => {
  const world = createWorld(now);
  const player = unlockedPlayer(world, alice);
  inventoryForProvince(player, 'ore', '130000').available = TRANSPORT_MODES.road.capacity + 1;
  assert.equal(createRoute(world, alice).ok, true);
  const route = player.transportRoutes[0];
  assert.equal(startCycle(world, alice, route.id, []).ok, true);
  const shipment = world.transportShipments[0];
  processTransportWorld(world, shipment.arrivesAt + 1);
  const creditsBefore = player.credits;
  const availableBefore = inventoryForProvince(player, 'ore', '130000').available;

  const rejected = serviceNode(
    world,
    alice,
    shipment,
    [],
    [{ productId: 'ore', quantity: TRANSPORT_MODES.road.capacity + 1 }],
    shipment.arrivesAt + 2,
  );
  assert.equal(rejected.ok, false);
  assert.match(rejected.message, /容量/);
  assert.equal(shipment.status, 'docked');
  assert.equal(player.credits, creditsBefore);
  assert.equal(inventoryForProvince(player, 'ore', '130000').available, availableBefore);
});

test('route deletion waits for the paid trip to return and unload without allowing another start', () => {
  const world = createWorld(now);
  const player = unlockedPlayer(world, bob);
  inventoryForProvince(player, 'wheat', '110000').available = 10;
  assert.equal(createRoute(world, bob).ok, true);
  const routeId = player.transportRoutes[0].id;
  assert.equal(startCycle(world, bob, routeId, [{ productId: 'wheat', quantity: 10 }]).ok, true);
  const shipment = world.transportShipments[0];
  const paidCredits = player.credits;
  const requested = applyAction(world, bob, 'transportShip', { operation: 'route-delete', routeId }, now + 3);
  assert.equal(requested.ok, true);
  assert.equal(player.transportRoutes[0].deletionPending, true);
  assert.equal(startCycle(world, bob, routeId, []).ok, false);
  processTransportWorld(world, shipment.arrivesAt + 1);
  assert.equal(player.transportRoutes[0].deletionPending, true);
  assert.equal(serviceNode(world, bob, shipment, [], [], shipment.arrivesAt + 2).ok, true);
  assert.equal(player.transportRoutes.length, 1);
  processTransportWorld(world, shipment.arrivesAt + 1);
  const stockBefore = inventoryForProvince(player, 'wheat', '110000').available;
  assert.equal(serviceNode(world, bob, shipment, [{ productId: 'wheat', quantity: 5 }], [], shipment.arrivesAt + 2).ok, false);
  assert.equal(inventoryForProvince(player, 'wheat', '110000').available, stockBefore);
  assert.equal(serviceNode(world, bob, shipment, [{ productId: 'wheat', quantity: 10 }], [], shipment.arrivesAt + 3).ok, true);
  assert.equal(shipment.status, 'arrived');
  assert.equal(inventoryForProvince(player, 'wheat', '110000').available, 10);
  assert.equal(inventoryForProvince(player, 'wheat', '110000').inTransit, 0);
  assert.equal(player.credits, paidCredits);
  assert.deepEqual(player.transportRoutes, []);
});

test('legacy in-transit shipment migrates without fuel backcharge and stops at its next node', () => {
  const world = createWorld(now);
  const player = unlockedPlayer(world, alice);
  player.transportRoutes = [{
    id: 'legacy-route',
    name: '',
    sourceProvinceId: '110000',
    destinationProvinceId: '130000',
    tripType: 'one-way',
    mode: 'road',
    setupCost: 0,
    createdAt: now - 100,
    updatedAt: now - 50,
  }];
  inventoryForProvince(player, 'wheat', '110000').inTransit = 5;
  world.transportShipments = [{
    id: 'legacy-shipment',
    ownerId: alice.id,
    routeId: 'legacy-route',
    sourceProvinceId: '110000',
    destinationProvinceId: '130000',
    tripType: 'one-way',
    productId: 'wheat',
    quantity: 5,
    mode: 'road',
    cost: 10,
    departsAt: now,
    arrivesAt: now + 10_000,
    status: 'in-transit',
    createdAt: now,
  }];
  const creditsBefore = player.credits;

  migrateTransportWorld(world);
  assert.equal(player.transportRoutes[0].tripType, 'round');
  const shipment = world.transportShipments[0];
  assert.equal(shipment.legacyCycle, true);
  assert.equal(shipment.fuelPurchased, 0);
  assert.equal(shipment.status, 'in-transit');
  assert.deepEqual(shipment.cargoLots, [{ productId: 'wheat', originProvinceId: '110000', quantity: 5 }]);
  assert.equal(player.credits, creditsBefore);

  processTransportWorld(world, shipment.arrivesAt + 1);
  assert.equal(shipment.status, 'docked');
  const visitIndex = shipment.currentVisitIndex;
  processTransportWorld(world, shipment.arrivesAt + 100_000);
  assert.equal(shipment.status, 'docked');
  assert.equal(shipment.currentVisitIndex, visitIndex);
  assert.equal(player.credits, creditsBefore);
});

test('route validation ignores legacy access fields while enforcing ordered stops and route count limits', () => {
  const world = createWorld(now);
  const player = unlockedPlayer(world, alice, 1_000_000);

  const duplicate = createRoute(world, alice, { viaProvinceIds: ['130000'], destinationProvinceId: '130000' });
  assert.equal(duplicate.ok, false);
  assert.match(duplicate.message, /站点不能重复/);

  player.unlockedProvinces = ['110000'];
  const unrestricted = createRoute(world, alice, { destinationProvinceId: '130000' }, now + 2);
  assert.equal(unrestricted.ok, true);

  for (let index = 1; index < TRANSPORT_MAX_ROUTES_PER_PLAYER; index += 1) {
    const result = createRoute(world, alice, { destinationProvinceId: index % 2 === 0 ? '130000' : '120000' }, now + 10 + index);
    assert.equal(result.ok, true);
  }
  const over = createRoute(world, alice, {}, now + 100);
  assert.equal(over.ok, false);
  assert.match(over.message, /路线不能超过/);
});

test('current leg is the only transport deadline and client state exposes docked runtime', () => {
  const world = createWorld(now);
  const player = unlockedPlayer(world, alice);
  assert.equal(createRoute(world, alice).ok, true);
  const route = player.transportRoutes[0];
  assert.equal(startCycle(world, alice, route.id, []).ok, true);
  const shipment = world.transportShipments[0];
  assert.equal(nextTransportDeadline(world), shipment.arrivesAt);

  processTransportWorld(world, shipment.arrivesAt + 1);
  assert.equal(nextTransportDeadline(world), null);
  const client = createClientState(world, alice.id, shipment.arrivesAt + 1);
  assert.equal(client.transportRoutes[0].tripType, 'round');
  assert.ok(client.transportRoutes[0].cycleDistanceKm > 0);
  assert.ok(client.transportRoutes[0].cycleCost > 0);
  assert.equal(client.transportShipments[0].status, 'docked');
  assert.equal(client.transportShipments[0].legPlan.length, 0);
  assert.equal(client.transportShipments[0].currentProvinceId, '130000');
});
