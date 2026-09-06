import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, createWorld, ensurePlayer } from '../src/domain.js';
import { processTransportWorld } from '../src/transport.js';
import { inventoryForProvince } from '../src/provinces.js';

const now = 1_700_000_000_000;
const user = { id: 91, email: 'transport-empty@example.com', name: 'Transport Empty' };

test('new empty node-cycle shipment is never reinterpreted as a legacy shipment', () => {
  const world = createWorld(now);
  const player = ensurePlayer(world, user, now);
  player.credits = 100_000;
  inventoryForProvince(player, 'industrial-fuel', '110000').available = 10000;
  player.startingProvinceChosen = true;
  player.startingProvinceId = '110000';
  player.unlockedProvinces = ['110000', '130000'];

  const created = applyAction(world, user, 'transportShip', {
    operation: 'route-create',
    sourceProvinceId: '110000',
    destinationProvinceId: '130000',
    mode: 'road',
  }, now + 1);
  assert.equal(created.ok, true);

  const route = player.transportRoutes[0];
  const started = applyAction(world, user, 'transportShip', {
    operation: 'cycle-start',
    routeId: route.id,
    load: [],
  }, now + 2);
  assert.equal(started.ok, true);

  const shipment = world.transportShipments[0];
  assert.equal(shipment.nodeCycleVersion, 1);
  assert.equal(shipment.status, 'in-transit');
  assert.equal(shipment.currentVisitIndex, 0);
  assert.equal(shipment.nextVisitIndex, 1);

  const firstArrival = shipment.arrivesAt;
  processTransportWorld(world, firstArrival + 1);
  assert.equal(shipment.status, 'docked');
  assert.equal(shipment.currentVisitIndex, 1);

  processTransportWorld(world, firstArrival + 7 * 24 * 60 * 60 * 1000);
  assert.equal(shipment.status, 'docked');
  assert.equal(shipment.currentVisitIndex, 1);
});
