import assert from 'node:assert/strict';
import test from 'node:test';
import { createWorld, ensurePlayer } from '../src/domain.js';
import { EconomyStore } from '../src/storage.js';
import {
  warehouseCapacityForLevel,
  warehouseCapacityIncreaseForLevel,
  warehouseUpgradeCostForLevel,
} from '../src/warehouse.js';

const alice = { id: 1, email: 'alice@example.com', name: 'Alice' };
const now = 1_700_000_000_000;

function request(requestKey = 'warehouse-upgrade-12345678') {
  return { action: 'upgradeWarehouse', payload: {}, requestKey, method: 'POST', path: '/api/game/warehouse/upgrade' };
}

function seedStore({ credits = 10_000, inventoryCapacity = 500, warehouseLevel, grainAvailable = 0, grainFrozen = 0, orders = [] } = {}) {
  const store = new EconomyStore(':memory:');
  const world = createWorld(now);
  const player = ensurePlayer(world, alice, now);
  player.credits = credits;
  player.inventoryCapacity = inventoryCapacity;
  player.inventories.grain.available = grainAvailable;
  player.inventories.grain.frozen = grainFrozen;
  if (warehouseLevel !== undefined) player.warehouseLevel = warehouseLevel;
  world.orders.push(...orders);
  store.insertWorld.run(1, JSON.stringify(world), now);
  return store;
}

function buyOrder(overrides = {}) {
  return {
    id: `warehouse-order-${Math.random()}`,
    assetKind: 'commodity',
    assetId: 'grain',
    productId: 'grain',
    side: 'buy',
    ownerType: 'player',
    ownerId: alice.id,
    ownerName: 'Alice',
    price: 1,
    quantity: 40,
    remaining: 40,
    status: 'open',
    createdAt: now,
    ...overrides,
  };
}

test('warehouse state defaults to level 1 and client version 11', () => {
  const store = new EconomyStore(':memory:');
  try {
    const state = store.getState(alice, now);
    assert.equal(state.version, 11);
    assert.equal(state.warehouseLevel, 1);
    assert.equal(state.inventoryCapacity, 500);
    assert.equal(Object.hasOwn(state, 'warehouseMaxLevel'), false);
    assert.equal(state.warehouseUpgradeCost, 150);
    assert.equal(state.warehouseNextCapacity, 750);
    assert.equal(state.warehouseNextCapacityIncrease, 250);
    assert.equal(state.warehouseStoredQuantity, 0);
    assert.equal(state.warehouseReservedQuantity, 0);
    assert.equal(state.warehouseUsedCapacity, 0);
    assert.equal(state.warehouseAvailableCapacity, 500);
  } finally { store.close(); }
});

test('warehouse capacity increase grows with every level', () => {
  assert.deepEqual(
    [1, 2, 3, 4, 5, 6].map((level) => warehouseCapacityForLevel(level)),
    [500, 750, 1_050, 1_400, 1_800, 2_250],
  );
  assert.deepEqual(
    [1, 2, 3, 4, 5].map((level) => warehouseCapacityIncreaseForLevel(level)),
    [250, 300, 350, 400, 450],
  );
  assert.equal(warehouseUpgradeCostForLevel(5), 3_750);
});

test('warehouse usage counts stored goods and remaining open commodity buy orders only', () => {
  const store = seedStore({
    grainAvailable: 25,
    grainFrozen: 5,
    orders: [
      buyOrder({ remaining: 40, status: 'partial' }),
      buyOrder({ remaining: 12, status: 'filled' }),
      buyOrder({ remaining: 7, side: 'sell' }),
      buyOrder({ remaining: 9, ownerId: 2 }),
      buyOrder({ assetKind: 'facility', assetId: 'farm', facilityTypeId: 'farm', productId: undefined, remaining: 20 }),
    ],
  });
  try {
    const state = store.getState(alice, now + 1);
    assert.equal(state.warehouseStoredQuantity, 30);
    assert.equal(state.warehouseReservedQuantity, 40);
    assert.equal(state.warehouseUsedCapacity, 70);
    assert.equal(state.warehouseAvailableCapacity, 430);
  } finally { store.close(); }
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
    assert.equal(response.state.warehouseNextCapacity, 1_050);
    assert.equal(response.state.warehouseNextCapacityIncrease, 300);
    assert.equal(response.state.warehouseAvailableCapacity, 750);
  } finally { store.close(); }
});

test('warehouse upgrade preserves stored and reserved usage while adding free capacity', () => {
  const store = seedStore({ grainAvailable: 25, grainFrozen: 5, orders: [buyOrder({ remaining: 40, status: 'partial' })] });
  try {
    const response = store.apply(alice, request('warehouse-usage-upgrade-12345678'), now + 1);
    assert.equal(response.result.ok, true);
    assert.equal(response.state.warehouseStoredQuantity, 30);
    assert.equal(response.state.warehouseReservedQuantity, 40);
    assert.equal(response.state.warehouseUsedCapacity, 70);
    assert.equal(response.state.warehouseAvailableCapacity, 680);
  } finally { store.close(); }
});

test('warehouse upgrade rejects insufficient funds without changing capacity', () => {
  const store = seedStore({ credits: 149 });
  try {
    const response = store.apply(alice, request('warehouse-insufficient-12345678'), now + 1);
    assert.equal(response.result.ok, false);
    assert.equal(response.state.credits, 149);
    assert.equal(response.state.warehouseLevel, 1);
    assert.equal(response.state.inventoryCapacity, 500);
  } finally { store.close(); }
});

test('legacy custom capacity infers a non-decreasing warehouse level', () => {
  const store = seedStore({ inventoryCapacity: 900 });
  try {
    const state = store.getState(alice, now + 1);
    assert.equal(state.warehouseLevel, 3);
    assert.equal(state.inventoryCapacity, 1_050);
    assert.ok(state.inventoryCapacity >= 900);
  } finally { store.close(); }
});

test('legacy stored level behind capacity is advanced and can still expand', () => {
  const store = seedStore({ credits: 10_000, warehouseLevel: 2, inventoryCapacity: 2_000 });
  try {
    const state = store.getState(alice, now + 1);
    assert.equal(state.warehouseLevel, 6);
    assert.equal(state.inventoryCapacity, 2_250);
    assert.equal(state.warehouseNextCapacityIncrease, 500);
    assert.equal(state.warehouseNextCapacity, 2_750);

    const response = store.apply(alice, request('warehouse-legacy-capacity-12345678'), now + 2);
    assert.equal(response.result.ok, true);
    assert.equal(response.state.warehouseLevel, 7);
    assert.equal(response.state.inventoryCapacity, 2_750);
  } finally { store.close(); }
});

test('warehouse can continue upgrading after former level 12 limit', () => {
  const store = seedStore({
    credits: 50_000,
    warehouseLevel: 12,
    inventoryCapacity: warehouseCapacityForLevel(12),
  });
  try {
    const response = store.apply(alice, request('warehouse-level-12-12345678'), now + 1);
    assert.equal(response.result.ok, true);
    assert.equal(response.state.warehouseLevel, 13);
    assert.equal(response.state.inventoryCapacity, warehouseCapacityForLevel(13));
    assert.equal(response.state.warehouseNextCapacityIncrease, warehouseCapacityIncreaseForLevel(13));
    assert.equal(response.state.warehouseUpgradeCost, warehouseUpgradeCostForLevel(13));
  } finally { store.close(); }
});

test('warehouse upgrade is idempotent', () => {
  const store = seedStore();
  try {
    const actionRequest = request('warehouse-idempotent-12345678');
    const first = store.apply(alice, actionRequest, now + 1);
    const second = store.apply(alice, actionRequest, now + 2);
    assert.deepEqual(second, first);
    assert.equal(store.getState(alice, now + 3).warehouseLevel, 2);
  } finally { store.close(); }
});
