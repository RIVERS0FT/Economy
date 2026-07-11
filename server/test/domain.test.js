import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyAction,
  createWorld,
  ensurePlayer,
  migrateWorld,
} from '../src/domain.js';
import { EconomyStore } from '../src/storage.js';

const alice = { id: 1, email: 'alice@example.com', name: 'Alice' };
const bob = { id: 2, email: 'bob@example.com', name: 'Bob' };
const now = 1_700_000_000_000;

test('different products never match in the same order book', () => {
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
});

test('work cooldown uses server time', () => {
  const world = createWorld(now);
  ensurePlayer(world, alice, now);
  assert.equal(applyAction(world, alice, 'work', {}, now).ok, true);
  assert.equal(applyAction(world, alice, 'work', {}, now + 1_000).ok, false);
  assert.equal(applyAction(world, alice, 'work', {}, now + 3_000).ok, true);
});

test('version 1 state migrates inventory and commodity orders without losing assets', () => {
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
        facilities: [],
        trades: [],
        ledger: [],
        work: { cooldownUntil: 0, lastWorkedAt: 0, streak: 0, totalClicks: 0 },
        stats: { workIssued: 0, populationIssued: 0, systemSinks: 0, commodityVolume: 0, facilityVolume: 0 },
      },
    },
    orders: [{
      id: 'legacy-order', side: 'buy', ownerType: 'market', ownerName: '市场',
      price: 5, quantity: 1, remaining: 1, status: 'open', createdAt: now,
    }],
    facilityListings: [],
    demand: { cycleMs: 300_000, nextDemandAt: now + 300_000, lastBudget: 10, lastQuantity: 2, lastPrice: 5, satisfaction: 1 },
    marketPrice: 7,
    marketPriceHistory: [{ price: 7, quantity: 1, createdAt: now }],
    lastProcessedAt: now,
  };

  migrateWorld(world, now);
  assert.equal(world.players['1'].inventories.grain.available, 7);
  assert.equal(world.players['1'].inventories.grain.frozen, 2);
  assert.equal(world.orders[0].productId, 'grain');
  assert.equal('facilitySlots' in world.players['1'], false);
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
    const first = store.apply(alice, request, now);
    const second = store.apply(alice, request, now + 500);
    assert.deepEqual(second, first);
    assert.equal(store.getState(alice, now + 1_000).work.totalClicks, 1);
  } finally {
    store.close();
  }
});

test('client state uses version 8 and exposes no factory instances', () => {
  const store = new EconomyStore(':memory:');
  try {
    const state = store.getState(alice, now);
    assert.equal(state.version, 8);
    assert.equal(Array.isArray(state.facilityGroups), true);
    assert.equal(Object.hasOwn(state, 'facilities'), false);
    assert.equal(state.products.length, 6);
    assert.equal(state.facilityTypes.length, 6);
  } finally {
    store.close();
  }
});
