import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyAction,
  createClientState,
  createWorld,
  ensurePlayer,
  migrateWorld,
  processWorld,
} from '../src/domain.js';
import { EconomyStore } from '../src/storage.js';

const alice = { id: 1, email: 'alice@example.com', name: 'Alice' };
const bob = { id: 2, email: 'bob@example.com', name: 'Bob' };

function addReadyFacility(player, overrides = {}) {
  const facility = {
    id: overrides.id || 'facility-test',
    facilityTypeId: overrides.facilityTypeId || 'farm',
    name: overrides.name || '测试农场',
    ownerId: player.userId,
    level: 1,
    status: 'paused',
    builtAt: overrides.builtAt || 1_700_000_000_000,
    cycleMs: overrides.cycleMs || 30_000,
    outputProductId: overrides.outputProductId || 'grain',
    outputPerCycle: overrides.outputPerCycle || 2,
    inputProductId: overrides.inputProductId,
    inputPerCycle: overrides.inputPerCycle || 0,
    operatingCost: overrides.operatingCost ?? 1,
    internalGoods: 0,
    internalCapacity: overrides.internalCapacity || 40,
    lifetimeOutput: 0,
    systemValue: overrides.systemValue || 80,
    productionMode: 'continuous',
    completedQuantity: 0,
    ...overrides,
  };
  player.facilities.push(facility);
  return facility;
}

test('different products never match in the same order book', () => {
  const now = 1_700_000_000_000;
  const world = createWorld(now);
  const seller = ensurePlayer(world, bob, now);
  const buyer = ensurePlayer(world, alice, now);
  seller.inventories.ore.available = 10;
  buyer.credits = 1_000;

  assert.equal(applyAction(world, bob, 'placeOrder', {
    productId: 'ore', side: 'sell', quantity: 5, price: 8,
  }, now + 1).ok, true);
  assert.equal(applyAction(world, alice, 'placeOrder', {
    productId: 'grain', side: 'buy', quantity: 5, price: 9,
  }, now + 2).ok, true);
  assert.equal(buyer.inventories.ore.available, 0);
  assert.equal(seller.inventories.ore.frozen, 5);

  assert.equal(applyAction(world, alice, 'placeOrder', {
    productId: 'ore', side: 'buy', quantity: 3, price: 9,
  }, now + 3).ok, true);
  assert.equal(buyer.inventories.ore.available, 3);
  assert.equal(seller.inventories.ore.frozen, 2);
  assert.equal(buyer.trades[0].productId, 'ore');
});

test('facility ownership has no slot limit', () => {
  const now = 1_700_000_000_000;
  const world = createWorld(now);
  const player = ensurePlayer(world, alice, now);
  player.credits = 10_000;

  for (let index = 0; index < 6; index += 1) {
    const actionAt = now + index * 1_000_000;
    const result = applyAction(world, alice, 'buildFacility', {
      facilityTypeId: index % 2 ? 'mine' : 'farm',
    }, actionAt);
    assert.equal(result.ok, true);
    processWorld(world, actionAt + 900_000);
  }

  assert.equal(player.facilities.length, 6);
  assert.equal('facilitySlots' in player, false);
});

test('only one facility may be under construction at a time', () => {
  const now = 1_700_000_000_000;
  const world = createWorld(now);
  const player = ensurePlayer(world, alice, now);
  player.credits = 1_000;
  assert.equal(applyAction(world, alice, 'buildFacility', { facilityTypeId: 'farm' }, now).ok, true);
  assert.equal(applyAction(world, alice, 'buildFacility', { facilityTypeId: 'mine' }, now + 1).ok, false);
});

test('target production plan stops at the exact requested quantity', () => {
  const now = 1_700_000_000_000;
  const world = createWorld(now);
  const player = ensurePlayer(world, alice, now);
  player.credits = 1_000;
  const facility = addReadyFacility(player, { id: 'farm-target' });

  assert.equal(applyAction(world, alice, 'setProductionPlan', {
    facilityId: facility.id, mode: 'target', targetQuantity: 6,
  }, now + 1).ok, true);
  assert.equal(applyAction(world, alice, 'startFacility', { facilityId: facility.id }, now + 2).ok, true);
  processWorld(world, now + 100_000);

  assert.equal(facility.internalGoods, 6);
  assert.equal(facility.completedQuantity, 6);
  assert.equal(facility.status, 'paused');
  assert.equal(facility.stopReason, 'plan_complete');
});

test('target quantity must align with output per cycle', () => {
  const now = 1_700_000_000_000;
  const world = createWorld(now);
  const player = ensurePlayer(world, alice, now);
  const facility = addReadyFacility(player, { id: 'farm-invalid-target', outputPerCycle: 2 });
  const response = applyAction(world, alice, 'setProductionPlan', {
    facilityId: facility.id, mode: 'target', targetQuantity: 5,
  }, now + 1);
  assert.equal(response.ok, false);
});

test('processing facilities consume input inventory in batches', () => {
  const now = 1_700_000_000_000;
  const world = createWorld(now);
  const player = ensurePlayer(world, alice, now);
  player.credits = 1_000;
  player.inventories.grain.available = 10;
  const facility = addReadyFacility(player, {
    id: 'mill-1',
    facilityTypeId: 'mill',
    name: '面粉厂 1',
    cycleMs: 40_000,
    outputProductId: 'flour',
    outputPerCycle: 1,
    inputProductId: 'grain',
    inputPerCycle: 2,
    operatingCost: 2,
    internalCapacity: 30,
    systemValue: 130,
  });

  applyAction(world, alice, 'startFacility', { facilityId: facility.id }, now + 1);
  processWorld(world, now + 80_001);
  assert.equal(facility.internalGoods, 2);
  assert.equal(player.inventories.grain.available, 6);
  assert.equal(player.credits, 996);
});

test('a factory blocks on missing input and does not restart automatically', () => {
  const now = 1_700_000_000_000;
  const world = createWorld(now);
  const player = ensurePlayer(world, alice, now);
  player.credits = 1_000;
  const facility = addReadyFacility(player, {
    id: 'mill-blocked',
    facilityTypeId: 'mill',
    outputProductId: 'flour',
    outputPerCycle: 1,
    inputProductId: 'grain',
    inputPerCycle: 2,
    operatingCost: 2,
    cycleMs: 40_000,
  });

  assert.equal(applyAction(world, alice, 'startFacility', { facilityId: facility.id }, now).ok, false);
  assert.equal(facility.status, 'insufficient_input');
  player.inventories.grain.available = 10;
  processWorld(world, now + 100_000);
  assert.equal(facility.internalGoods, 0);
  assert.equal(facility.status, 'insufficient_input');
  assert.equal(applyAction(world, alice, 'startFacility', { facilityId: facility.id }, now + 100_001).ok, true);
});

test('manual stop settles completed cycles and discards the partial cycle', () => {
  const now = 1_700_000_000_000;
  const world = createWorld(now);
  const player = ensurePlayer(world, alice, now);
  player.credits = 1_000;
  const facility = addReadyFacility(player, { id: 'farm-stop', cycleMs: 30_000 });
  applyAction(world, alice, 'startFacility', { facilityId: facility.id }, now);
  const response = applyAction(world, alice, 'pauseFacility', { facilityId: facility.id }, now + 65_000);
  assert.equal(response.ok, true);
  assert.equal(facility.internalGoods, 4);
  assert.equal(facility.status, 'paused');
  assert.equal(facility.stopReason, 'manual');
});

test('facility listing transfers the original unique factory without slot checks', () => {
  const now = 1_700_000_000_000;
  const world = createWorld(now);
  const seller = ensurePlayer(world, bob, now);
  const buyer = ensurePlayer(world, alice, now);
  buyer.credits = 1_000;
  const facility = addReadyFacility(seller, { id: 'facility-unique', name: '唯一工厂' });

  assert.equal(applyAction(world, bob, 'listFacility', {
    facilityId: facility.id, price: 80,
  }, now + 1).ok, true);
  const listing = world.facilityListings.find((item) => item.ownerId === bob.id);
  assert.ok(listing);
  assert.equal(applyAction(world, alice, 'buyFacility', { listingId: listing.id }, now + 2).ok, true);
  assert.equal(seller.facilities.length, 0);
  assert.equal(buyer.facilities.at(-1).id, 'facility-unique');
  assert.equal(buyer.facilities.at(-1).ownerId, alice.id);
});

test('version 1 state migrates inventory, orders and facilities to version 2 world', () => {
  const now = 1_700_000_000_000;
  const world = {
    version: 1,
    players: {
      '1': {
        userId: 1,
        playerName: 'Alice',
        registeredAt: now,
        credits: 100,
        frozenCredits: 0,
        inventory: 7,
        frozenInventory: 2,
        inventoryCapacity: 100,
        facilitySlots: 1,
        facilities: [{
          id: 'legacy-facility', name: '基础生产设施', ownerId: 1, level: 1,
          status: 'paused', builtAt: now, cycleMs: 30_000, outputPerCycle: 1,
          operatingCost: 1, internalGoods: 3, internalCapacity: 20,
          lifetimeOutput: 8, systemValue: 80,
        }],
        trades: [], ledger: [],
        work: { cooldownUntil: 0, lastWorkedAt: 0, streak: 0, totalClicks: 0 },
        stats: { workIssued: 0, populationIssued: 0, systemSinks: 0, commodityVolume: 0, facilityVolume: 0 },
      },
    },
    orders: [{ id: 'legacy-order', side: 'buy', ownerType: 'market', ownerName: '市场', price: 5, quantity: 1, remaining: 1, status: 'open', createdAt: now }],
    facilityListings: [],
    demand: { cycleMs: 300_000, nextDemandAt: now + 300_000, lastBudget: 10, lastQuantity: 2, lastPrice: 5, satisfaction: 1 },
    marketPrice: 7,
    marketPriceHistory: [{ price: 7, quantity: 1, createdAt: now }],
    lastProcessedAt: now,
  };

  migrateWorld(world, now);
  assert.equal(world.version, 2);
  assert.equal(world.players['1'].inventories.grain.available, 7);
  assert.equal(world.players['1'].inventories.grain.frozen, 2);
  assert.equal(world.players['1'].facilities[0].facilityTypeId, 'farm');
  assert.equal(world.orders[0].productId, 'grain');
  assert.equal('facilitySlots' in world.players['1'], false);
});

test('client state exposes six products, six factory types and version 5', () => {
  const now = 1_700_000_000_000;
  const world = createWorld(now);
  ensurePlayer(world, alice, now);
  const state = createClientState(world, alice.id, now);
  assert.equal(state.version, 5);
  assert.equal(state.products.length, 6);
  assert.equal(state.facilityTypes.length, 6);
  assert.equal(state.commodityName, '粮食');
});

test('work cooldown uses server time', () => {
  const now = 1_700_000_000_000;
  const world = createWorld(now);
  ensurePlayer(world, alice, now);
  assert.equal(applyAction(world, alice, 'work', {}, now).ok, true);
  assert.equal(applyAction(world, alice, 'work', {}, now + 1_000).ok, false);
  assert.equal(applyAction(world, alice, 'work', {}, now + 3_000).ok, true);
});

test('idempotency returns the original response without applying an action twice', () => {
  const store = new EconomyStore(':memory:');
  try {
    const request = {
      action: 'work',
      payload: {},
      requestKey: 'request-12345678',
      method: 'POST',
      path: '/api/game/work',
    };
    const first = store.apply(alice, request, 1_700_000_000_000);
    const second = store.apply(alice, request, 1_700_000_000_500);
    assert.deepEqual(second, first);
    assert.equal(store.getState(alice, 1_700_000_000_500).credits, 101);
  } finally {
    store.close();
  }
});
