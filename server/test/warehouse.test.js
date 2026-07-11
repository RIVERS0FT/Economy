import assert from 'node:assert/strict';
import test from 'node:test';
import { createWorld, ensurePlayer } from '../src/domain.js';
import { EconomyStore } from '../src/storage.js';
import {
  WAREHOUSE_MAX_LEVEL,
  warehouseCapacityForLevel,
  warehouseUpgradeCostForLevel,
} from '../src/warehouse.js';

const alice = { id: 1, email: 'alice@example.com', name: 'Alice' };
const now = 1_700_000_000_000;

function request(requestKey = 'warehouse-upgrade-12345678') {
  return {
    action: 'upgradeWarehouse',
    payload: {},
    requestKey,
    method: 'POST',
    path: '/api/game/warehouse/upgrade',
  };
}

function seedStore({ credits = 10_000, inventoryCapacity = 500, warehouseLevel } = {}) {
  const store = new EconomyStore(':memory:');
  const world = createWorld(now);
  const player = ensurePlayer(world, alice, now);
  player.credits = credits;
  player.inventoryCapacity = inventoryCapacity;
  if (warehouseLevel !== undefined) player.warehouseLevel = warehouseLevel;
  store.insertWorld.run(1, JSON.stringify(world), now);
  return store;
}

test('warehouse state defaults to level 1 and client version 8', () => {
  const store = new EconomyStore(':memory:');
  try {
    const state = store.getState(alice, now);
    assert.equal(state.version, 8);
    assert.equal(state.warehouseLevel, 1);
    assert.equal(state.inventoryCapacity, 500);
    assert.equal(state.warehouseMaxLevel, WAREHOUSE_MAX_LEVEL);
    assert.equal(state.warehouseUpgradeCost, 150);
    assert.equal(state.warehouseNextCapacity, 750);
  } finally {
    store.close();
  }
});

test('warehouse upgrade deducts server funds and increases shared capacity', () => {
  const store = seedStore();
  try {
    const response = store.apply(alice, request(), now + 1);
    assert.equal(response.result.ok, true);
    assert.equal(response.state.warehouseLevel, 2);
    assert.equal(response.state.inventoryCapacity, 750);
    assert.equal(response.state.credits, 9_850);
    assert.equal(response.state.stats.systemSinks, 150);
    assert.equal(response.state.warehouseUpgradeCost, 600);
    assert.equal(response.state.warehouseNextCapacity, 1_000);
  } finally {
    store.close();
  }
});

test('warehouse upgrade rejects insufficient funds without changing capacity', () => {
  const store = seedStore({ credits: 149 });
  try {
    const response = store.apply(alice, request('warehouse-insufficient-12345678'), now + 1);
    assert.equal(response.result.ok, false);
    assert.equal(response.state.credits, 149);
    assert.equal(response.state.warehouseLevel, 1);
    assert.equal(response.state.inventoryCapacity, 500);
  } finally {
    store.close();
  }
});

test('legacy custom capacity infers a non-decreasing warehouse level', () => {
  const store = seedStore({ inventoryCapacity: 900 });
  try {
    const state = store.getState(alice, now + 1);
    assert.equal(state.warehouseLevel, 3);
    assert.equal(state.inventoryCapacity, 1_000);
    assert.ok(state.inventoryCapacity >= 900);
  } finally {
    store.close();
  }
});

test('maximum warehouse level cannot be upgraded again', () => {
  const store = seedStore({
    warehouseLevel: WAREHOUSE_MAX_LEVEL,
    inventoryCapacity: warehouseCapacityForLevel(WAREHOUSE_MAX_LEVEL),
  });
  try {
    const response = store.apply(alice, request('warehouse-max-12345678'), now + 1);
    assert.equal(response.result.ok, false);
    assert.equal(response.state.warehouseLevel, WAREHOUSE_MAX_LEVEL);
    assert.equal(response.state.inventoryCapacity, warehouseCapacityForLevel(WAREHOUSE_MAX_LEVEL));
    assert.equal(response.state.warehouseUpgradeCost, null);
    assert.equal(warehouseUpgradeCostForLevel(WAREHOUSE_MAX_LEVEL), null);
  } finally {
    store.close();
  }
});

test('warehouse upgrade is idempotent', () => {
  const store = seedStore();
  try {
    const action = request('warehouse-idempotent-12345678');
    const first = store.apply(alice, action, now + 1);
    const second = store.apply(alice, action, now + 2);
    assert.deepEqual(second, first);
    assert.equal(store.getState(alice, now + 3).warehouseLevel, 2);
  } finally {
    store.close();
  }
});
