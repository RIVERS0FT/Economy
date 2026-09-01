import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, createClientState, createWorld, ensurePlayer, processWorld } from '../src/domain.js';
import {
  buildTransportPlan,
  defaultTransportRouteName,
  migrateTransportWorld,
  nextTransportDeadline,
  processTransportWorld,
  TRANSPORT_MAX_ROUTES_PER_PLAYER,
  TRANSPORT_MODES,
} from '../src/transport.js';
import { inventoryForProvince, provinceScopedKey } from '../src/provinces.js';

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

function testMarketFor(world, provinceId, productId) {
  const key = provinceScopedKey(provinceId, productId);
  if (!world.markets[key]) {
    const template = world.markets[provinceScopedKey('110000', productId)]
      || Object.values(world.markets).find((market) => market?.productId === productId);
    assert.ok(template, `missing market fixture for ${productId}`);
    world.markets[key] = structuredClone(template);
    world.markets[key].provinceId = provinceId;
    world.markets[key].productId = productId;
  }
  return world.markets[key];
}

function setReferencePrice(world, provinceId, productId, price) {
  const market = testMarketFor(world, provinceId, productId);
  market.lastTradePrice = price;
  market.lastPrice = price;
  market.officialPrice = null;
}

function profitableProduct(world, productId, sourceProvinceId = '110000', destinationProvinceId = '130000', sourcePrice = 1, destinationPrice = 50) {
  setReferencePrice(world, sourceProvinceId, productId, sourcePrice);
  setReferencePrice(world, destinationProvinceId, productId, destinationPrice);
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

test('transport routes persist without current inventory and default to start-end names', () => {
  const world = createWorld(now);
  deferDemand(world);
  const player = unlockedPlayer(world, alice, 0);

  const created = createRoute(world, alice);
  assert.equal(created.ok, true);
  assert.equal(player.transportRoutes.length, 1);
  const route = player.transportRoutes[0];
  assert.equal(route.name, defaultTransportRouteName('110000', '130000'));
  assert.equal(route.tripType, 'one-way');
  assert.equal(route.mode, 'road');
  assert.equal(Object.hasOwn(route, 'productId'), false);
  assert.equal(Object.hasOwn(route, 'quantity'), false);
  assert.equal(Object.hasOwn(route, 'autoDispatch'), false);
  assert.equal(world.transportShipments.length, 0);

  const client = createClientState(world, alice.id, now + 2);
  assert.equal(client.transportRoutes.length, 1);
  assert.equal(client.transportRoutes[0].name, route.name);
  assert.equal(Object.hasOwn(client.transportRoutes[0], 'productId'), false);
  assert.equal(Object.hasOwn(client.transportRoutes[0], 'quantity'), false);
  assert.equal(Object.hasOwn(client.transportRoutes[0], 'autoDispatch'), false);
});

test('route rename is independent and default names follow endpoint edits until customized', () => {
  const world = createWorld(now);
  deferDemand(world);
  const player = unlockedPlayer(world, alice, 0);
  assert.equal(createRoute(world, alice).ok, true);
  const routeId = player.transportRoutes[0].id;

  const updatedDefault = applyAction(world, alice, 'transportShip', {
    operation: 'route-update',
    routeId,
    sourceProvinceId: '110000',
    destinationProvinceId: '120000',
    mode: 'rail',
  }, now + 2);
  assert.equal(updatedDefault.ok, true);
  assert.equal(player.transportRoutes[0].name, defaultTransportRouteName('110000', '120000'));
  assert.equal(player.transportRoutes[0].mode, 'rail');

  const renamed = applyAction(world, alice, 'transportShip', {
    operation: 'route-rename',
    routeId,
    name: '东部工业线',
  }, now + 3);
  assert.equal(renamed.ok, true);
  assert.equal(player.transportRoutes[0].name, '东部工业线');

  const updatedCustom = applyAction(world, alice, 'transportShip', {
    operation: 'route-update',
    routeId,
    sourceProvinceId: '130000',
    destinationProvinceId: '120000',
    mode: 'air',
  }, now + 4);
  assert.equal(updatedCustom.ok, true);
  assert.equal(player.transportRoutes[0].name, '东部工业线');
});

test('profitable inventory automatically dispatches without a manual route action', () => {
  const world = createWorld(now);
  deferDemand(world);
  const player = unlockedPlayer(world, alice, 50_000);
  inventoryForProvince(player, 'wheat', '110000').available = 80;
  profitableProduct(world, 'wheat');
  const creditsBefore = player.credits;

  const created = createRoute(world, alice);
  assert.equal(created.ok, true);
  assert.match(created.message, /自动发运/);
  assert.equal(world.transportShipments.length, 1);
  const shipment = world.transportShipments[0];
  assert.equal(shipment.routeId, player.transportRoutes[0].id);
  assert.equal(shipment.status, 'in-transit');
  assert.equal(shipment.manifest.length, 1);
  assert.deepEqual(shipment.manifest[0], {
    productId: 'wheat',
    destinationProvinceId: '130000',
    quantity: 80,
  });
  assert.ok(Array.isArray(shipment.legPlan));
  assert.equal(shipment.legPlan.length, 1);
  assert.equal(inventoryForProvince(player, 'wheat', '110000').available, 0);
  assert.equal(inventoryForProvince(player, 'wheat', '110000').inTransit, 80);
  assert.ok(player.credits < creditsBefore);

  const manual = applyAction(world, alice, 'transportShip', {
    operation: 'route-dispatch',
    routeId: player.transportRoutes[0].id,
  }, now + 2);
  assert.equal(manual.ok, false);
  assert.match(manual.message, /自动发运/);
});

test('automatic cargo can combine products and fills transport capacity by expected unit spread', () => {
  const world = createWorld(now);
  deferDemand(world);
  const player = unlockedPlayer(world, bob, 50_000);
  inventoryForProvince(player, 'wheat', '110000').available = 60;
  inventoryForProvince(player, 'ore', '110000').available = 80;
  profitableProduct(world, 'wheat', '110000', '130000', 1, 100);
  profitableProduct(world, 'ore', '110000', '130000', 1, 50);

  assert.equal(createRoute(world, bob).ok, true);
  const shipment = world.transportShipments[0];
  assert.equal(shipment.manifest.length, 2);
  assert.deepEqual(shipment.manifest.map((entry) => [entry.productId, entry.quantity]), [
    ['wheat', 60],
    ['ore', 40],
  ]);
  assert.equal(shipment.legPlan[0].remainingLoad, TRANSPORT_MODES.road.capacity);
  assert.equal(inventoryForProvince(player, 'ore', '110000').available, 40);
});

test('routes wait silently until cargo and funds make an automatic shipment possible', () => {
  const world = createWorld(now);
  deferDemand(world);
  const player = unlockedPlayer(world, alice, 0);
  profitableProduct(world, 'wheat');
  assert.equal(createRoute(world, alice).ok, true);
  assert.equal(world.transportShipments.length, 0);

  inventoryForProvince(player, 'wheat', '110000').available = 10;
  processTransportWorld(world, now + 2);
  assert.equal(world.transportShipments.length, 0);

  player.credits = 50_000;
  processTransportWorld(world, now + 3);
  assert.equal(world.transportShipments.length, 1);
  assert.equal(world.transportShipments[0].status, 'in-transit');
});

test('a route keeps at most one active shipment and starts the next trip after completion', () => {
  const world = createWorld(now);
  deferDemand(world);
  const player = unlockedPlayer(world, alice, 50_000);
  inventoryForProvince(player, 'wheat', '110000').available = 200;
  profitableProduct(world, 'wheat');
  assert.equal(createRoute(world, alice).ok, true);
  assert.equal(world.transportShipments.filter((shipment) => shipment.status === 'in-transit').length, 1);

  processTransportWorld(world, now + 2);
  assert.equal(world.transportShipments.filter((shipment) => shipment.status === 'in-transit').length, 1);

  const first = world.transportShipments.find((shipment) => shipment.status === 'in-transit');
  processWorld(world, first.arrivesAt + 1);
  const active = world.transportShipments.filter((shipment) => shipment.status === 'in-transit');
  assert.equal(active.length, 1);
  assert.notEqual(active[0].id, first.id);
  assert.equal(active[0].routeId, first.routeId);
});

test('multi-stop manifests unload only the cargo assigned to each stop', () => {
  const world = createWorld(now);
  deferDemand(world);
  const player = unlockedPlayer(world, bob, 50_000);
  inventoryForProvince(player, 'wheat', '110000').available = 40;
  inventoryForProvince(player, 'ore', '110000').available = 40;
  profitableProduct(world, 'wheat', '110000', '130000', 1, 100);
  profitableProduct(world, 'ore', '110000', '120000', 1, 100);
  setReferencePrice(world, '120000', 'wheat', 1);
  setReferencePrice(world, '130000', 'ore', 1);

  assert.equal(createRoute(world, bob, { viaProvinceIds: ['130000'], destinationProvinceId: '120000' }).ok, true);
  const shipment = world.transportShipments[0];
  assert.equal(shipment.stopPlan.length, 2);
  const firstStop = shipment.stopPlan[0];
  const secondStop = shipment.stopPlan[1];

  processTransportWorld(world, firstStop.arrivesAt);
  assert.equal(inventoryForProvince(player, 'wheat', '130000').available, 40);
  assert.equal(inventoryForProvince(player, 'ore', '120000').available, 0);
  assert.equal(inventoryForProvince(player, 'wheat', '110000').inTransit, 0);
  assert.equal(inventoryForProvince(player, 'ore', '110000').inTransit, 40);
  assert.equal(shipment.status, 'in-transit');

  processTransportWorld(world, secondStop.arrivesAt);
  assert.equal(inventoryForProvince(player, 'ore', '120000').available, 40);
  assert.equal(inventoryForProvince(player, 'ore', '110000').inTransit, 0);
  assert.equal(shipment.status, 'arrived');
});

test('route deletion is blocked while its shipment is active and allowed after arrival', () => {
  const world = createWorld(now);
  deferDemand(world);
  const player = unlockedPlayer(world, bob, 50_000);
  inventoryForProvince(player, 'wheat', '110000').available = 20;
  profitableProduct(world, 'wheat');
  assert.equal(createRoute(world, bob).ok, true);
  const routeId = player.transportRoutes[0].id;
  const shipment = world.transportShipments[0];

  const blocked = applyAction(world, bob, 'transportShip', { operation: 'route-delete', routeId }, now + 2);
  assert.equal(blocked.ok, false);
  assert.match(blocked.message, /运输在途/);
  assert.equal(player.transportRoutes.length, 1);

  processTransportWorld(world, shipment.arrivesAt);
  inventoryForProvince(player, 'wheat', '110000').available = 0;
  const deleted = applyAction(world, bob, 'transportShip', { operation: 'route-delete', routeId }, shipment.arrivesAt + 1);
  assert.equal(deleted.ok, true);
  assert.deepEqual(player.transportRoutes, []);
});

test('route validation still enforces unlocked ordered stops and route count limits', () => {
  const world = createWorld(now);
  deferDemand(world);
  const player = unlockedPlayer(world, alice, 0);

  const duplicate = createRoute(world, alice, { viaProvinceIds: ['130000'], destinationProvinceId: '130000' });
  assert.equal(duplicate.ok, false);
  assert.match(duplicate.message, /站点不能重复/);

  player.unlockedProvinces = ['110000'];
  const locked = createRoute(world, alice, { destinationProvinceId: '130000' }, now + 2);
  assert.equal(locked.ok, false);
  assert.match(locked.message, /尚未解锁/);

  player.unlockedProvinces = ['110000', '130000', '120000'];
  for (let index = 0; index < TRANSPORT_MAX_ROUTES_PER_PLAYER; index += 1) {
    const result = createRoute(world, alice, { destinationProvinceId: index % 2 === 0 ? '130000' : '120000' }, now + 10 + index);
    assert.equal(result.ok, true);
  }
  const over = createRoute(world, alice, {}, now + 100);
  assert.equal(over.ok, false);
  assert.match(over.message, /路线不能超过/);
});

test('transport plan accounts for remaining load and authoritative leg timestamps', () => {
  const plan = buildTransportPlan({
    sourceProvinceId: '110000',
    viaProvinceIds: ['130000'],
    destinationProvinceId: '120000',
    tripType: 'one-way',
  }, 'road', [
    { productId: 'wheat', destinationProvinceId: '130000', quantity: 40 },
    { productId: 'ore', destinationProvinceId: '120000', quantity: 30 },
  ], now);
  assert.ok(plan);
  assert.equal(plan.initialLoad, 70);
  assert.equal(plan.legPlan.length, 2);
  assert.equal(plan.legPlan[0].remainingLoad, 70);
  assert.equal(plan.legPlan[1].remainingLoad, 30);
  assert.equal(plan.legPlan[0].departsAt, now);
  assert.equal(plan.legPlan[0].arrivesAt, plan.legPlan[1].departsAt);
  assert.equal(plan.arrivesAt, plan.legPlan[1].arrivesAt);
  assert.equal(nextTransportDeadline({ transportShipments: [{ status: 'in-transit', stopPlan: plan.stopPlan, arrivesAt: plan.arrivesAt }] }), plan.stopPlan[0].arrivesAt);
});

test('legacy route goods and auto-dispatch fields migrate away while legacy shipments gain manifests and leg plans', () => {
  const world = createWorld(now);
  deferDemand(world);
  const player = unlockedPlayer(world, alice, 50_000);
  player.transportRoutes = [{
    id: 'legacy-route',
    sourceProvinceId: '110000',
    destinationProvinceId: '130000',
    tripType: 'one-way',
    productId: 'wheat',
    quantity: 5,
    mode: 'road',
    autoDispatch: false,
    createdAt: now - 100,
    updatedAt: now - 50,
  }];
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

  migrateTransportWorld(world);
  const route = player.transportRoutes[0];
  assert.equal(route.name, defaultTransportRouteName('110000', '130000'));
  assert.equal(Object.hasOwn(route, 'productId'), false);
  assert.equal(Object.hasOwn(route, 'quantity'), false);
  assert.equal(Object.hasOwn(route, 'autoDispatch'), false);
  const shipment = world.transportShipments[0];
  assert.deepEqual(shipment.manifest, [{ productId: 'wheat', destinationProvinceId: '130000', quantity: 5 }]);
  assert.equal(shipment.legPlan.length, 1);
  assert.equal(shipment.routeName, route.name);
});
