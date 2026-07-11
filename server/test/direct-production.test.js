import assert from 'node:assert/strict';
import test from 'node:test';
import { createWorld, ensurePlayer } from '../src/domain.js';
import { EconomyStore } from '../src/storage.js';

const alice = { id: 1, email: 'alice@example.com', name: 'Alice' };
const now = 1_700_000_000_000;

function facility(overrides = {}) {
  return {
    id: 'facility-test',
    facilityTypeId: 'farm',
    name: '测试农场',
    ownerId: alice.id,
    level: 1,
    status: 'running',
    builtAt: now - 60_000,
    cycleStartedAt: now - 60_000,
    cycleMs: 30_000,
    outputProductId: 'grain',
    outputPerCycle: 2,
    inputPerCycle: 0,
    operatingCost: 1,
    lifetimeOutput: 0,
    systemValue: 80,
    productionMode: 'continuous',
    completedQuantity: 0,
    ...overrides,
  };
}

function seedStore({ credits = 1_000, inventoryCapacity = 500, inventories = {}, facilities = [] } = {}) {
  const store = new EconomyStore(':memory:');
  const world = createWorld(now);
  const player = ensurePlayer(world, alice, now);
  player.credits = credits;
  player.inventoryCapacity = inventoryCapacity;
  for (const [productId, values] of Object.entries(inventories)) {
    player.inventories[productId] = { available: 0, frozen: 0, ...values };
  }
  player.facilities = facilities;
  store.insertWorld.run(1, JSON.stringify(world), now - 60_000);
  return store;
}

function persistedPlayer(store) {
  const row = store.selectWorld.get();
  return JSON.parse(String(row.state_json)).players[String(alice.id)];
}

test('raw factory output moves directly into shared warehouse', () => {
  const store = seedStore({ facilities: [facility()] });
  try {
    const state = store.getState(alice, now);
    assert.equal(state.inventories.grain.available, 4);
    assert.equal(state.credits, 998);
    assert.equal(state.facilities[0].lifetimeOutput, 4);
    assert.equal(state.facilities[0].completedQuantity, 4);
    assert.equal(Object.hasOwn(state.facilities[0], 'internalGoods'), false);
    assert.equal(Object.hasOwn(state.facilities[0], 'internalCapacity'), false);
    assert.equal(Object.hasOwn(state.facilityTypes[0], 'internalCapacity'), false);
    assert.equal(Object.hasOwn(persistedPlayer(store).facilities[0], 'internalGoods'), false);
    assert.equal(Object.hasOwn(persistedPlayer(store).facilities[0], 'internalCapacity'), false);
  } finally {
    store.close();
  }
});

test('factory stops before producing when shared warehouse lacks one full cycle of space', () => {
  const store = seedStore({
    inventories: { grain: { available: 499 } },
    facilities: [facility({ cycleStartedAt: now - 30_000 })],
  });
  try {
    const state = store.getState(alice, now);
    assert.equal(state.inventories.grain.available, 499);
    assert.equal(state.credits, 1_000);
    assert.equal(state.facilities[0].status, 'full');
    assert.equal(state.facilities[0].stopReason, 'output_full');
    assert.equal(state.warehouseAvailableCapacity, 1);
  } finally {
    store.close();
  }
});

test('processing factory can run at full warehouse when input consumption frees enough space', () => {
  const mill = facility({
    facilityTypeId: 'mill',
    name: '测试面粉厂',
    cycleStartedAt: now - 40_000,
    cycleMs: 40_000,
    inputProductId: 'grain',
    inputPerCycle: 2,
    outputProductId: 'flour',
    outputPerCycle: 1,
    operatingCost: 2,
    systemValue: 130,
  });
  const store = seedStore({
    inventories: { grain: { available: 500 } },
    facilities: [mill],
  });
  try {
    const state = store.getState(alice, now);
    assert.equal(state.inventories.grain.available, 498);
    assert.equal(state.inventories.flour.available, 1);
    assert.equal(state.warehouseStoredQuantity, 499);
    assert.equal(state.credits, 998);
    assert.equal(state.facilities[0].status, 'running');
  } finally {
    store.close();
  }
});

test('multiple factories share the same remaining warehouse capacity', () => {
  const store = seedStore({
    inventories: { grain: { available: 496 } },
    facilities: [
      facility({ id: 'farm-a', cycleStartedAt: now - 30_000 }),
      facility({ id: 'farm-b', cycleStartedAt: now - 30_000 }),
      facility({ id: 'farm-c', cycleStartedAt: now - 30_000 }),
    ],
  });
  try {
    const state = store.getState(alice, now);
    assert.equal(state.inventories.grain.available, 500);
    assert.equal(state.facilities.filter((item) => item.status === 'full').length, 1);
    assert.equal(state.credits, 998);
  } finally {
    store.close();
  }
});

test('legacy internal factory goods migrate into shared warehouse without loss', () => {
  const legacy = facility({
    status: 'paused',
    cycleStartedAt: undefined,
    internalGoods: 10,
    internalCapacity: 40,
    lifetimeOutput: 10,
    completedQuantity: 10,
  });
  const store = seedStore({ facilities: [legacy] });
  try {
    const state = store.getState(alice, now);
    assert.equal(state.inventories.grain.available, 10);
    assert.equal(state.facilities[0].lifetimeOutput, 10);
    assert.equal(Object.hasOwn(state.facilities[0], 'internalGoods'), false);
    assert.equal(Object.hasOwn(persistedPlayer(store).facilities[0], 'internalGoods'), false);
  } finally {
    store.close();
  }
});

test('production state is stable when processed repeatedly at the same server time', () => {
  const store = seedStore({ facilities: [facility()] });
  try {
    const first = store.getState(alice, now);
    const second = store.getState(alice, now);
    assert.equal(first.inventories.grain.available, 4);
    assert.equal(second.inventories.grain.available, 4);
    assert.equal(second.credits, 998);
  } finally {
    store.close();
  }
});
