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
  applyStartTransportCycle, applyServiceTransportNode,
  migrateTransportWorld, processTransportWorld, transportSlotClientState,
  TRANSPORT_SLOT_LIMIT_BY_STAGE,
} from '../src/transport.js';
import { TRANSPORT_MODE_POLICY, transportCyclePolicyForShipment } from '../../shared/transport-policy.js';

const now = 1_780_000_000_000;
const user = { id: 8912, name: 'Transport Slots', email: 'transport-slots@example.com' };

function fixture(mode = 'road', stage = 'C1', destinationProvinceId = '130000') {
  const world = createWorld(now);
  world.transportShipments = [];
  const player = ensurePlayer(world, user, now);
  player.credits = 1_000_000;
  player.research ||= {};
  player.research.unlockedComplexity = stage;
  inventoryForProvince(player, 'industrial-fuel', '110000').available = 100_000;
  const created = applyCreateTransportRoute(world, user, {
    sourceProvinceId: '110000', destinationProvinceId, mode,
    vehicleCount: 99, capacity: 99999,
  }, now);
  assert.equal(created.ok, true);
  return { world, player, route: player.transportRoutes.at(-1) };
}

function start(world, route, load = []) {
  return applyStartTransportCycle(world, user, { routeId: route.id, vehicleCount: 99, load }, now + 2);
}

function service(world, shipment, unload = [], load = []) {
  return applyServiceTransportNode(world, user, {
    routeId: shipment.routeId,
    cycleId: shipment.id,
    visitIndex: shipment.currentVisitIndex,
    unload,
    load,
  }, shipment.arrivesAt + 1);
}

test('technology stage is the only gameplay source of simultaneous transport slot count', () => {
  for (const [stage, expected] of Object.entries(TRANSPORT_SLOT_LIMIT_BY_STAGE)) {
    const { world, player } = fixture('road', stage);
    migrateTransportWorld(world, now + 1);
    const state = transportSlotClientState(world, user.id);
    assert.equal(state.stage, stage);
    assert.equal(state.limit, expected);
    assert.equal(state.slots.length, expected);
    assert.equal(player.research.transportSlots.limit, expected);
  }
});

test('each unlocked slot selects one transport tool and switching resets that slot training only', () => {
  const { world, player } = fixture();
  migrateTransportWorld(world, now + 1);
  assert.deepEqual(player.transportSlotState.slots.map((slot) => slot.mode), ['road', 'rail']);
  player.transportSlotState.slots[1].experience = 73;
  const changed = applyTransportShip(world, user, {
    operation: 'slot-configure', slotId: 'transport-slot-2', mode: 'air',
  }, now + 2);
  assert.equal(changed.ok, true);
  assert.equal(player.transportSlotState.slots[0].mode, 'road');
  assert.equal(player.transportSlotState.slots[1].mode, 'air');
  assert.equal(player.transportSlotState.slots[1].experience, 0);
  assert.equal(changed.transportSlots.slots[1].level, 1);
  const unchanged = applyTransportShip(world, user, {
    operation: 'slot-configure', slotId: 'transport-slot-2', mode: 'air',
  }, now + 3);
  assert.equal(unchanged.ok, true);
  assert.equal(player.transportSlotState.slots[1].experience, 0);
});

test('a trip occupies its matching slot from departure through intermediate docking until final return', () => {
  const { world, player, route } = fixture('road');
  assert.equal(applyCreateTransportRoute(world, user, {
    sourceProvinceId: '110000', destinationProvinceId: '120000', mode: 'road',
  }, now).ok, true);
  const secondRoute = player.transportRoutes[1];
  migrateTransportWorld(world, now + 1);
  inventoryForProvince(player, 'wheat', '110000').available = 400;
  const launched = start(world, route, [{ productId: 'wheat', quantity: 200 }]);
  assert.equal(launched.ok, true);
  const shipment = world.transportShipments[0];
  assert.equal(shipment.slotId, 'transport-slot-1');
  assert.equal(shipment.policySnapshot.vehicleCount, 1);
  assert.equal(shipment.policySnapshot.capacity, TRANSPORT_MODE_POLICY.road.capacity);
  assert.equal(transportSlotClientState(world, user.id).used, 1);
  assert.equal(start(world, secondRoute, [{ productId: 'wheat', quantity: 100 }]).ok, false);

  processTransportWorld(world, shipment.arrivesAt + 1);
  assert.equal(shipment.status, 'docked');
  assert.equal(transportSlotClientState(world, user.id).slots[0].occupied, true);
  assert.equal(start(world, secondRoute, [{ productId: 'wheat', quantity: 100 }]).ok, false);

  assert.equal(service(world, shipment, [{ productId: 'wheat', quantity: 200 }]).ok, true);
  processTransportWorld(world, shipment.arrivesAt + 1);
  assert.equal(service(world, shipment).ok, true);
  assert.equal(shipment.status, 'arrived');
  assert.equal(transportSlotClientState(world, user.id).used, 0);
  assert.equal(start(world, secondRoute, [{ productId: 'wheat', quantity: 100 }]).ok, true);
});

test('tool proficiency is frozen into each paid trip and levels up only after the full trip finishes', () => {
  const { world, player, route } = fixture('road');
  migrateTransportWorld(world, now + 1);
  player.transportSlotState.slots[0].experience = 2;
  inventoryForProvince(player, 'wheat', '110000').available = 200;
  assert.equal(start(world, route, [{ productId: 'wheat', quantity: 200 }]).ok, true);
  const shipment = world.transportShipments[0];
  const policy = transportCyclePolicyForShipment(shipment);
  const gained = Math.max(1, Math.min(12, Math.ceil(shipment.cycleDistanceKm / 500)));
  assert.equal(shipment.transportToolLevel, 1);
  assert.equal(policy.transportToolLevel, 1);
  assert.equal(policy.transportToolSpeedBonusBps, 0);
  processTransportWorld(world, shipment.arrivesAt + 1);
  assert.equal(service(world, shipment, [{ productId: 'wheat', quantity: 200 }]).ok, true);
  assert.equal(player.transportSlotState.slots[0].experience, 2);
  processTransportWorld(world, shipment.arrivesAt + 1);
  const completed = service(world, shipment);
  assert.equal(completed.ok, true);
  assert.equal(player.transportSlotState.slots[0].experience, 2 + gained);
  assert.equal(transportSlotClientState(world, user.id).slots[0].level, 2);
  assert.match(completed.message, /Lv\.2/);
  assert.equal(shipment.transportTrainingAwarded, true);
  assert.equal(shipment.transportTrainingExperience, gained);
});

test('trained tools improve travel speed without changing cargo capacity, cash freight or fuel demand', () => {
  const { world, player, route } = fixture('road');
  migrateTransportWorld(world, now + 1);
  player.transportSlotState.slots[0].experience = 120;
  inventoryForProvince(player, 'wheat', '110000').available = 200;
  const fuelBefore = inventoryForProvince(player, 'industrial-fuel', '110000').available;
  const creditsBefore = player.credits;
  assert.equal(start(world, route, [{ productId: 'wheat', quantity: 200 }]).ok, true);
  const shipment = world.transportShipments[0];
  assert.equal(shipment.transportToolLevel, 10);
  assert.equal(shipment.transportToolSpeedBonusBps, 2700);
  assert.equal(shipment.policySnapshot.capacity, 200);
  assert.equal(shipment.policySnapshot.transportFeePerKm, TRANSPORT_MODE_POLICY.road.transportFeePerKm);
  assert.equal(shipment.policySnapshot.fuelPerKm, TRANSPORT_MODE_POLICY.road.fuelPerKm);
  assert.ok(shipment.policySnapshot.secondsPerKm < 0.06);
  assert.equal(player.credits, Math.round((creditsBefore - shipment.transportFee) * 1e6) / 1e6);
  assert.equal(inventoryForProvince(player, 'industrial-fuel', '110000').available, fuelBefore - shipment.fuelPurchased);
});

test('route fleet expansion is retired at the API boundary and cannot bypass technology slots', () => {
  const { world, player, route } = fixture();
  migrateTransportWorld(world, now + 1);
  const before = JSON.stringify({ credits: player.credits, route, slots: player.transportSlotState });
  const result = applyTransportShip(world, user, {
    operation: 'route-expand', routeId: route.id, quantity: 99, expectedVehicleCount: 1,
  }, now + 2);
  assert.equal(result.ok, false);
  assert.match(result.message, /科技解锁运输槽位/);
  assert.equal(JSON.stringify({ credits: player.credits, route, slots: player.transportSlotState }), before);
});

test('legacy paid route expansions are refunded once and normalized to one slot per trip', () => {
  const { world, player, route } = fixture('rail');
  const beforeExpansion = player.credits;
  const expanded = applyExpandTransportRoute(world, user, {
    routeId: route.id, quantity: 2, expectedVehicleCount: 1,
  }, now + 1);
  assert.equal(expanded.ok, true);
  assert.equal(route.vehicleCount, 3);
  assert.equal(player.credits, beforeExpansion - 2 * TRANSPORT_MODE_POLICY.rail.vehiclePurchaseCost);
  migrateTransportWorld(world, now + 2);
  assert.equal(player.transportRoutes[0].vehicleCount, 1);
  assert.equal(player.credits, beforeExpansion);
  assert.equal(player.stats.transportFleetMigrationRefund, 2 * TRANSPORT_MODE_POLICY.rail.vehiclePurchaseCost);
  const once = JSON.stringify({ credits: player.credits, stats: player.stats, state: player.transportSlotState });
  migrateTransportWorld(world, now + 3);
  assert.equal(JSON.stringify({ credits: player.credits, stats: player.stats, state: player.transportSlotState }), once);
});

test('transport slot configuration survives real SQLite idempotency replay and cold reopen', () => {
  const directory = mkdtempSync(join(tmpdir(), 'economy-transport-slots-'));
  const path = join(directory, 'world.sqlite');
  let store = new EconomyStore(path);
  try {
    store.getStateSnapshot(user, undefined, now);
    const request = (payload, key) => ({ action: 'transportShip', payload, requestKey: key,
      method: 'POST', path: '/api/game/transport' });
    const command = request({ operation: 'slot-configure', slotId: 'transport-slot-2', mode: 'air' }, 'slot-configure');
    const configured = store.apply(user, command, now + 1);
    assert.equal(configured.result.ok, true);
    const paid = store.getStateSnapshot(user, undefined, now + 1).state;
    assert.equal(paid.research.transportSlots.slots[1].mode, 'air');
    const repeated = store.apply(user, command, now + 2);
    assert.deepEqual(repeated.result, configured.result);
    store.close();
    store = new EconomyStore(path);
    const reopened = store.getStateSnapshot(user, undefined, now + 3).state;
    assert.equal(reopened.research.transportSlots.limit, 2);
    assert.equal(reopened.research.transportSlots.slots[1].mode, 'air');
    assert.equal(reopened.research.transportSlots.slots[1].level, 1);
  } finally { store.close(); rmSync(directory, { recursive: true, force: true }); }
});

test('prototype names and invalid transport tools cannot create routes or reconfigure slots', () => {
  const { world, player } = fixture();
  migrateTransportWorld(world, now + 1);
  for (const mode of ['__proto__', 'constructor', 'toString', ['road'], null]) {
    const before = JSON.stringify({ player, shipments: world.transportShipments });
    assert.equal(applyTransportShip(world, user, { operation: 'slot-configure', slotId: 'transport-slot-1', mode }, now + 2).ok, false);
    assert.equal(JSON.stringify({ player, shipments: world.transportShipments }), before);
  }
});
