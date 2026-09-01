import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, createClientState, createWorld, ensurePlayer, processWorld } from '../src/domain.js';
import {
  nextTransportDeadline,
  processTransportWorld,
  TRANSPORT_BASE_SECONDS_PER_KM,
  TRANSPORT_MAX_IN_TRANSIT_PER_PLAYER,
  TRANSPORT_MAX_ROUTES_PER_PLAYER,
  TRANSPORT_MODES,
  transportCost,
  transportDurationMs,
} from '../src/transport.js';
import { inventoryForProvince, provinceScopedKey } from '../src/provinces.js';
import { provinceDistanceKm } from '../src/province-access.js';

const alice = { id: 1, email: 'alice@example.com', name: 'Alice' };
const bob = { id: 2, email: 'bob@example.com', name: 'Bob' };
const now = 1_700_000_000_000;

function deferDemand(world, at = now + 5 * 60 * 1000) {
  for (const state of Object.values(world.demandGroups)) state.nextDemandAt = at;
}

function unlockedPlayer(world, user, credits = 50_000) {
  const player = ensurePlayer(world, user, now);
  player.credits = credits;
  player.startingProvinceChosen = true;
  player.startingProvinceId = '110000';
  player.unlockedProvinces = ['110000', '130000', '120000'];
  return player;
}

test('road transport moves goods into in-transit and charges the mode cost', () => {
  const world = createWorld(now);
  deferDemand(world);
  const player = unlockedPlayer(world, alice);
  inventoryForProvince(player, 'wheat', '110000').available = 20;
  const distanceKm = provinceDistanceKm('110000', '130000');
  const expectedCost = transportCost('road', 5, distanceKm);
  const expectedMs = transportDurationMs('road', distanceKm);
  const before = player.credits;

  const result = applyAction(world, alice, 'transportShip', {
    sourceProvinceId: '110000',
    destinationProvinceId: '130000',
    productId: 'wheat',
    quantity: 5,
    mode: 'road',
  }, now + 1);

  assert.equal(result.ok, true);
  assert.equal(player.credits, before - expectedCost);
  const source = inventoryForProvince(player, 'wheat', '110000');
  assert.equal(source.available, 15);
  assert.equal(source.inTransit, 5);
  assert.equal(world.transportShipments.length, 1);
  const shipment = world.transportShipments[0];
  assert.equal(shipment.status, 'in-transit');
  assert.equal(shipment.tripType, 'one-way');
  assert.equal(shipment.arrivesAt, now + 1 + expectedMs);
  assert.equal(shipment.cost, expectedCost);
  assert.ok(expectedMs >= 1_000);
  assert.ok(expectedMs <= distanceKm * TRANSPORT_BASE_SECONDS_PER_KM * 1000 * 1.0001);
});

test('rail and air enforce capacity while matching their time factors', () => {
  const world = createWorld(now);
  deferDemand(world);
  const player = unlockedPlayer(world, bob);
  inventoryForProvince(player, 'ore', '110000').available = 5_000;
  const distanceKm = provinceDistanceKm('110000', '130000');

  const railTooBig = applyAction(world, bob, 'transportShip', {
    sourceProvinceId: '110000',
    destinationProvinceId: '130000',
    productId: 'ore',
    quantity: TRANSPORT_MODES.rail.capacity + 1,
    mode: 'rail',
  }, now + 1);
  assert.equal(railTooBig.ok, false);

  const airOk = applyAction(world, bob, 'transportShip', {
    sourceProvinceId: '110000',
    destinationProvinceId: '130000',
    productId: 'ore',
    quantity: TRANSPORT_MODES.air.capacity,
    mode: 'air',
  }, now + 2);
  assert.equal(airOk.ok, true);

  const railDuration = transportDurationMs('rail', distanceKm);
  const airDuration = transportDurationMs('air', distanceKm);
  const roadDuration = transportDurationMs('road', distanceKm);
  assert.ok(railDuration > roadDuration);
  assert.ok(airDuration < roadDuration);
});

test('locked destination rejects transport and in-transit cap is enforced', () => {
  const world = createWorld(now);
  deferDemand(world);
  const player = unlockedPlayer(world, alice);
  player.unlockedProvinces = ['110000'];
  inventoryForProvince(player, 'wheat', '110000').available = 500;

  const locked = applyAction(world, alice, 'transportShip', {
    sourceProvinceId: '110000',
    destinationProvinceId: '130000',
    productId: 'wheat',
    quantity: 1,
    mode: 'road',
  }, now + 1);
  assert.equal(locked.ok, false);
  assert.match(locked.message, /尚未解锁/);

  player.unlockedProvinces = ['110000', '130000'];
  for (let index = 0; index < TRANSPORT_MAX_IN_TRANSIT_PER_PLAYER; index += 1) {
    const result = applyAction(world, alice, 'transportShip', {
      sourceProvinceId: '110000',
      destinationProvinceId: '130000',
      productId: 'wheat',
      quantity: 1,
      mode: 'road',
    }, now + 2 + index);
    assert.equal(result.ok, true);
  }
  const overCap = applyAction(world, alice, 'transportShip', {
    sourceProvinceId: '110000',
    destinationProvinceId: '130000',
    productId: 'wheat',
    quantity: 1,
    mode: 'road',
  }, now + 30);
  assert.equal(overCap.ok, false);
  assert.match(overCap.message, /在途运输不能超过/);
});

test('arrival processing moves goods into the destination warehouse and updates the deadline', () => {
  const world = createWorld(now);
  deferDemand(world);
  const player = unlockedPlayer(world, alice);
  inventoryForProvince(player, 'wheat', '110000').available = 10;

  assert.equal(applyAction(world, alice, 'transportShip', {
    sourceProvinceId: '110000',
    destinationProvinceId: '130000',
    productId: 'wheat',
    quantity: 4,
    mode: 'road',
  }, now + 1).ok, true);
  const shipment = world.transportShipments[0];
  const deadline = nextTransportDeadline(world);
  assert.equal(deadline, shipment.arrivesAt);

  processTransportWorld(world, shipment.arrivesAt);
  assert.equal(shipment.status, 'arrived');
  const source = inventoryForProvince(player, 'wheat', '110000');
  const destination = inventoryForProvince(player, 'wheat', '130000');
  assert.equal(source.inTransit, 0);
  assert.equal(source.available, 6);
  assert.equal(destination.available, 4);
  assert.equal(nextTransportDeadline(world), null);
});

test('world processing settles due shipments through the normal domain cycle', () => {
  const world = createWorld(now);
  deferDemand(world);
  const player = unlockedPlayer(world, bob);
  inventoryForProvince(player, 'wheat', '110000').available = 10;
  assert.equal(applyAction(world, bob, 'transportShip', {
    sourceProvinceId: '110000',
    destinationProvinceId: '130000',
    productId: 'wheat',
    quantity: 3,
    mode: 'air',
  }, now + 1).ok, true);
  const shipment = world.transportShipments[0];

  processWorld(world, shipment.arrivesAt + 1);
  assert.equal(shipment.status, 'arrived');
  assert.equal(inventoryForProvince(player, 'wheat', '130000').available, 3);
  assert.equal(inventoryForProvince(player, 'wheat', '110000').inTransit, 0);
});


test('transport routes persist without requiring current inventory or funds', () => {
  const world = createWorld(now);
  deferDemand(world);
  const player = unlockedPlayer(world, alice, 0);
  inventoryForProvince(player, 'wheat', '110000').available = 0;

  const invalid = applyAction(world, alice, 'transportShip', {
    operation: 'route-create',
    sourceProvinceId: '110000',
    destinationProvinceId: '110000',
    productId: 'wheat',
    quantity: 10,
    mode: 'road',
  }, now + 1);
  assert.equal(invalid.ok, false);
  assert.equal(Object.hasOwn(player, 'transportRoutes'), false);

  const created = applyAction(world, alice, 'transportShip', {
    operation: 'route-create',
    sourceProvinceId: '110000',
    destinationProvinceId: '130000',
    productId: 'wheat',
    quantity: 10,
    mode: 'road',
  }, now + 2);
  assert.equal(created.ok, true);
  assert.equal(player.transportRoutes.length, 1);
  assert.equal(player.transportRoutes[0].tripType, 'one-way');
  assert.equal(player.transportRoutes[0].autoDispatch, false);
  const routeId = player.transportRoutes[0].id;

  const updated = applyAction(world, alice, 'transportShip', {
    operation: 'route-update',
    routeId,
    sourceProvinceId: '110000',
    destinationProvinceId: '120000',
    productId: 'ore',
    quantity: 500,
    mode: 'rail',
  }, now + 3);
  assert.equal(updated.ok, true);
  assert.equal(player.transportRoutes[0].destinationProvinceId, '120000');
  assert.equal(player.transportRoutes[0].productId, 'ore');
  assert.equal(player.transportRoutes[0].quantity, 500);
  assert.equal(player.transportRoutes[0].mode, 'rail');
  assert.equal(player.transportRoutes[0].tripType, 'one-way');

  const client = createClientState(world, alice.id, now + 4);
  assert.equal(client.transportRoutes.length, 1);
  assert.equal(client.transportRoutes[0].id, routeId);
  assert.equal(client.transportRoutes[0].tripType, 'one-way');
  assert.equal(client.transportRoutes[0].autoDispatch, false);
});

test('dispatching and deleting a route leaves the shipment in transit', () => {
  const world = createWorld(now);
  deferDemand(world);
  const player = unlockedPlayer(world, bob, 50_000);
  inventoryForProvince(player, 'wheat', '110000').available = 20;

  assert.equal(applyAction(world, bob, 'transportShip', {
    operation: 'route-create',
    sourceProvinceId: '110000',
    destinationProvinceId: '130000',
    productId: 'wheat',
    quantity: 5,
    mode: 'road',
  }, now + 1).ok, true);
  const routeId = player.transportRoutes[0].id;

  const dispatched = applyAction(world, bob, 'transportShip', {
    operation: 'route-dispatch',
    routeId,
  }, now + 2);
  assert.equal(dispatched.ok, true);
  assert.equal(world.transportShipments.length, 1);
  assert.equal(world.transportShipments[0].routeId, routeId);
  assert.equal(world.transportShipments[0].status, 'in-transit');

  const deleted = applyAction(world, bob, 'transportShip', {
    operation: 'route-delete',
    routeId,
  }, now + 3);
  assert.equal(deleted.ok, true);
  assert.deepEqual(player.transportRoutes, []);
  assert.equal(world.transportShipments.length, 1);
  assert.equal(world.transportShipments[0].routeId, routeId);
  assert.equal(world.transportShipments[0].status, 'in-transit');
});

test('transport route limit is enforced', () => {
  const world = createWorld(now);
  deferDemand(world);
  const player = unlockedPlayer(world, alice, 0);

  for (let index = 0; index < TRANSPORT_MAX_ROUTES_PER_PLAYER; index += 1) {
    const created = applyAction(world, alice, 'transportShip', {
      operation: 'route-create',
      sourceProvinceId: '110000',
      destinationProvinceId: '130000',
      productId: 'wheat',
      quantity: 1,
      mode: 'road',
    }, now + index + 1);
    assert.equal(created.ok, true);
  }
  assert.equal(player.transportRoutes.length, TRANSPORT_MAX_ROUTES_PER_PLAYER);

  const overLimit = applyAction(world, alice, 'transportShip', {
    operation: 'route-create',
    sourceProvinceId: '110000',
    destinationProvinceId: '120000',
    productId: 'wheat',
    quantity: 1,
    mode: 'road',
  }, now + TRANSPORT_MAX_ROUTES_PER_PLAYER + 2);
  assert.equal(overLimit.ok, false);
  assert.match(overLimit.message, /路线不能超过/);
  assert.equal(player.transportRoutes.length, TRANSPORT_MAX_ROUTES_PER_PLAYER);
});

test('multi-stop routes validate ordered stations without a station cap', () => {
  const world = createWorld(now);
  deferDemand(world);
  const player = unlockedPlayer(world, alice, 0);

  const duplicate = applyAction(world, alice, 'transportShip', {
    operation: 'route-create',
    sourceProvinceId: '110000',
    viaProvinceIds: ['130000', '130000'],
    destinationProvinceId: '120000',
    productId: 'wheat',
    quantity: 1,
    mode: 'road',
  }, now + 1);
  assert.equal(duplicate.ok, false);
  assert.match(duplicate.message, /站点不能重复/);

  const duplicateDestination = applyAction(world, alice, 'transportShip', {
    operation: 'route-create',
    sourceProvinceId: '110000',
    viaProvinceIds: ['130000'],
    destinationProvinceId: '130000',
    productId: 'wheat',
    quantity: 1,
    mode: 'road',
  }, now + 2);
  assert.equal(duplicateDestination.ok, false);
  assert.match(duplicateDestination.message, /站点不能重复/);

  const closedWithoutVia = applyAction(world, alice, 'transportShip', {
    operation: 'route-create',
    sourceProvinceId: '110000',
    destinationProvinceId: '110000',
    productId: 'wheat',
    quantity: 1,
    mode: 'road',
  }, now + 3);
  assert.equal(closedWithoutVia.ok, false);
  assert.match(closedWithoutVia.message, /起止州不能相同/);

  player.unlockedProvinces = ['110000'];
  const lockedVia = applyAction(world, alice, 'transportShip', {
    operation: 'route-create',
    sourceProvinceId: '110000',
    viaProvinceIds: ['130000'],
    destinationProvinceId: '120000',
    productId: 'wheat',
    quantity: 1,
    mode: 'road',
  }, now + 4);
  assert.equal(lockedVia.ok, false);
  assert.match(lockedVia.message, /中间站尚未解锁/);

  player.unlockedProvinces = ['110000', '120000', '130000'];
  const created = applyAction(world, alice, 'transportShip', {
    operation: 'route-create',
    sourceProvinceId: '110000',
    viaProvinceIds: ['130000'],
    destinationProvinceId: '120000',
    tripType: 'round',
    productId: 'wheat',
    quantity: 1,
    mode: 'road',
  }, now + 5);
  assert.equal(created.ok, true);
  const route = player.transportRoutes[0];
  assert.deepEqual(route.viaProvinceIds, ['130000']);
  assert.equal(route.tripType, 'round');

  const client = createClientState(world, alice.id, now + 6);
  assert.equal(client.transportRoutes.length, 1);
  assert.deepEqual(client.transportRoutes[0].viaProvinceIds, ['130000']);
  assert.equal(client.transportRoutes[0].tripType, 'round');
});

test('multi-stop capacity applies to initial load and cost follows remaining cargo', () => {
  const world = createWorld(now);
  deferDemand(world);
  const player = unlockedPlayer(world, alice, 1_000_000);
  inventoryForProvince(player, 'wheat', '110000').available = 200;

  const dispatched = applyAction(world, alice, 'transportShip', {
    sourceProvinceId: '110000',
    viaProvinceIds: ['130000'],
    destinationProvinceId: '120000',
    productId: 'wheat',
    quantity: 50,
    mode: 'road',
  }, now + 1);
  assert.equal(dispatched.ok, true);
  const shipment = world.transportShipments[0];
  const firstLeg = provinceDistanceKm('110000', '130000');
  const secondLeg = provinceDistanceKm('130000', '120000');
  assert.equal(shipment.tripType, 'one-way');
  assert.equal(shipment.cost,
    transportCost('road', 100, firstLeg) + transportCost('road', 50, secondLeg));
  assert.equal(inventoryForProvince(player, 'wheat', '110000').available, 100);
  assert.equal(inventoryForProvince(player, 'wheat', '110000').inTransit, 100);

  const overCapacity = applyAction(world, alice, 'transportShip', {
    sourceProvinceId: '110000',
    viaProvinceIds: ['130000'],
    destinationProvinceId: '120000',
    productId: 'wheat',
    quantity: 51,
    mode: 'road',
  }, now + 2);
  assert.equal(overCapacity.ok, false);
  assert.match(overCapacity.message, /首段总载荷不能超过 100/);
});

test('round-trip dispatch delivers every stop and charges empty return legs once', () => {
  const world = createWorld(now);
  deferDemand(world);
  const player = unlockedPlayer(world, alice, 1_000_000);
  inventoryForProvince(player, 'wheat', '110000').available = 50;

  const dispatched = applyAction(world, alice, 'transportShip', {
    sourceProvinceId: '110000',
    viaProvinceIds: ['130000'],
    destinationProvinceId: '120000',
    tripType: 'round',
    productId: 'wheat',
    quantity: 5,
    mode: 'road',
  }, now + 1);
  assert.equal(dispatched.ok, true);
  const shipment = world.transportShipments[0];
  const leg110To130 = provinceDistanceKm('110000', '130000');
  const leg130To120 = provinceDistanceKm('130000', '120000');
  const expectedCost = transportCost('road', 10, leg110To130)
    + transportCost('road', 5, leg130To120)
    + transportCost('road', 0, leg130To120)
    + transportCost('road', 0, leg110To130);
  assert.equal(shipment.cost, expectedCost);
  assert.equal(shipment.tripType, 'round');
  assert.equal(shipment.stopPlan.length, 2);
  assert.equal(shipment.stopPlan[0].provinceId, '130000');
  assert.equal(shipment.stopPlan[1].provinceId, '120000');
  assert.equal(shipment.stopPlan[0].arrivesAt, now + 1 + transportDurationMs('road', leg110To130));
  assert.equal(
    shipment.stopPlan[1].arrivesAt,
    now + 1 + transportDurationMs('road', leg110To130) + transportDurationMs('road', leg130To120),
  );
  assert.equal(shipment.arrivesAt, now + 1
    + 2 * transportDurationMs('road', leg110To130)
    + 2 * transportDurationMs('road', leg130To120));
  const source = inventoryForProvince(player, 'wheat', '110000');
  assert.equal(source.available, 40);
  assert.equal(source.inTransit, 10);
  assert.equal(nextTransportDeadline(world), shipment.stopPlan[0].arrivesAt);

  const insufficient = applyAction(world, alice, 'transportShip', {
    sourceProvinceId: '110000',
    viaProvinceIds: ['130000'],
    destinationProvinceId: '120000',
    tripType: 'round',
    productId: 'wheat',
    quantity: 21,
    mode: 'road',
  }, now + 2);
  assert.equal(insufficient.ok, false);
  assert.match(insufficient.message, /库存不足/);
});

test('closed loop dispatch returns to the starting state as one in-transit shipment', () => {
  const world = createWorld(now);
  deferDemand(world);
  const player = unlockedPlayer(world, bob, 1_000_000);
  inventoryForProvince(player, 'wheat', '110000').available = 30;

  const dispatched = applyAction(world, bob, 'transportShip', {
    sourceProvinceId: '110000',
    viaProvinceIds: ['130000', '120000'],
    destinationProvinceId: '110000',
    tripType: 'round',
    productId: 'wheat',
    quantity: 5,
    mode: 'road',
  }, now + 1);
  assert.equal(dispatched.ok, true);
  const shipment = world.transportShipments[0];
  assert.equal(shipment.destinationProvinceId, '110000');
  assert.equal(shipment.tripType, 'one-way');
  assert.deepEqual(
    shipment.stopPlan.map((stop) => stop.provinceId),
    ['130000', '120000'],
  );
  const source = inventoryForProvince(player, 'wheat', '110000');
  assert.equal(source.available, 20);
  assert.equal(source.inTransit, 10);

  const client = createClientState(world, bob.id, now + 2);
  assert.equal(client.transportShipments.length, 1);
  assert.equal(client.transportShipments[0].stopPlan.length, 2);
});

test('staged arrivals settle each stop at its own deadline', () => {
  const world = createWorld(now);
  deferDemand(world);
  const player = unlockedPlayer(world, alice, 1_000_000);
  inventoryForProvince(player, 'wheat', '110000').available = 30;

  assert.equal(applyAction(world, alice, 'transportShip', {
    sourceProvinceId: '110000',
    viaProvinceIds: ['130000'],
    destinationProvinceId: '120000',
    tripType: 'one-way',
    productId: 'wheat',
    quantity: 5,
    mode: 'road',
  }, now + 1).ok, true);
  const shipment = world.transportShipments[0];
  const firstStopAt = shipment.stopPlan[0].arrivesAt;

  processTransportWorld(world, firstStopAt);
  assert.equal(shipment.status, 'in-transit');
  assert.equal(shipment.stopPlan[0].deliveredAt, firstStopAt);
  assert.equal(shipment.stopPlan[1].deliveredAt, null);
  assert.equal(inventoryForProvince(player, 'wheat', '130000').available, 5);
  assert.equal(inventoryForProvince(player, 'wheat', '120000').available, 0);
  assert.equal(inventoryForProvince(player, 'wheat', '110000').inTransit, 5);
  assert.equal(nextTransportDeadline(world), shipment.stopPlan[1].arrivesAt);

  processWorld(world, shipment.arrivesAt + 1);
  assert.equal(shipment.status, 'arrived');
  assert.equal(inventoryForProvince(player, 'wheat', '120000').available, 5);
  assert.equal(inventoryForProvince(player, 'wheat', '110000').inTransit, 0);
  assert.equal(nextTransportDeadline(world), null);
});

test('automatic routes wait for resources and keep at most one active shipment per route', () => {
  const world = createWorld(now);
  deferDemand(world);
  const player = unlockedPlayer(world, alice, 1_000_000);
  const source = inventoryForProvince(player, 'wheat', '110000');
  source.available = 0;

  const created = applyAction(world, alice, 'transportShip', {
    operation: 'route-create',
    sourceProvinceId: '110000',
    destinationProvinceId: '130000',
    productId: 'wheat',
    quantity: 4,
    mode: 'road',
    autoDispatch: true,
  }, now + 1);
  assert.equal(created.ok, true);
  const routeId = player.transportRoutes[0].id;
  assert.equal(player.transportRoutes[0].autoDispatch, true);

  processTransportWorld(world, now + 2);
  assert.equal(world.transportShipments.length, 0);

  source.available = 8;
  processTransportWorld(world, now + 3);
  assert.equal(world.transportShipments.length, 1);
  const shipment = world.transportShipments[0];
  assert.equal(shipment.routeId, routeId);
  assert.equal(shipment.status, 'in-transit');
  assert.equal(source.available, 4);

  processTransportWorld(world, now + 4);
  assert.equal(world.transportShipments.length, 1);
  assert.equal(source.available, 4);

  const client = createClientState(world, alice.id, now + 5);
  assert.equal(client.transportRoutes[0].autoDispatch, true);
});
