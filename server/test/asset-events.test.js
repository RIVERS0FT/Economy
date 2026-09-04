import assert from 'node:assert/strict';
import test from 'node:test';
import { CURRENT_CLIENT_STATE_VERSION } from '../shared/economy-state-version.js';
import { createWorld, ensurePlayer } from '../src/domain.js';
import { EconomyStore } from '../src/storage.js';
import { EconomyStore as RuntimeEconomyStore } from '../src/runtime-store.js';
import { readSegmentedWorld } from '../src/world-storage-v2.js';

const alice = { id: 1, email: 'alice@example.com', name: 'Alice' };

function request(action, payload, requestKey, path) {
  return {
    action,
    payload,
    requestKey,
    method: 'POST',
    path,
  };
}

function persistedWorld(store) {
  return readSegmentedWorld(store)?.world;
}

function assertPlayerLogsAbsent(player) {
  assert.equal(Object.hasOwn(player, 'trades'), false);
  assert.equal(Object.hasOwn(player, 'ledger'), false);
  assert.equal(Object.hasOwn(player, 'assetEvents'), false);
}

test('current client state version excludes all player log arrays and factory instances', () => {
  const store = new EconomyStore(':memory:');
  try {
    const state = store.getState(alice, 1_700_000_000_000);
    assert.equal(state.version, CURRENT_CLIENT_STATE_VERSION);
    assert.equal(Object.hasOwn(state, 'trades'), false);
    assert.equal(Object.hasOwn(state, 'ledger'), false);
    assert.equal(Object.hasOwn(state, 'assetEvents'), false);
    assert.equal(Object.hasOwn(state, 'facilities'), false);
    assert.equal(Array.isArray(state.facilityGroups), true);
    assertPlayerLogsAbsent(persistedWorld(store).players['1']);
  } finally {
    store.close();
  }
});

test('runtime COW local action remains valid after V2 persistence strips presentation logs', () => {
  const store = new RuntimeEconomyStore(':memory:', { scheduledProcessing: false });
  const now = 1_700_000_000_000;
  try {
    store.getState(alice, now);
    assertPlayerLogsAbsent(persistedWorld(store).players['1']);
    const deposited = store.apply(alice, request(
      'bankDeposit',
      { amount: 1 },
      'bank-after-log-strip-12345678',
      '/api/game/bank/deposits',
    ), now + 1);
    assert.equal(deposited.result.ok, true);
    assertPlayerLogsAbsent(persistedWorld(store).players['1']);
  } finally {
    store.close();
  }
});

test('immediate market actions update authoritative state without writing player logs to SQLite', () => {
  const store = new EconomyStore(':memory:');
  const now = 1_700_000_000_000;
  try {
    const initial = store.getState(alice, now);
    const placed = store.apply(alice, request(
      'placeOrder',
      { productId: 'wheat', side: 'buy', quantity: 5, price: 1 },
      'place-order-12345678',
      '/api/game/orders',
    ), now + 1);
    assert.equal(placed.result.ok, true);
    const placedState = store.getState(alice, now + 2);
    assert.equal(placedState.frozenCredits, 0);
    assert.equal(placedState.inventories.wheat.available, initial.inventories.wheat.available + 5);
    assert.equal(placedState.orders.some((item) => item.isOwn && ['open', 'partial'].includes(item.status)), false);
    assert.equal(Object.hasOwn(placedState, 'trades'), false);
    assert.equal(Object.hasOwn(placedState, 'assetEvents'), false);
    assertPlayerLogsAbsent(persistedWorld(store).players['1']);
  } finally {
    store.close();
  }
});

test('legacy server logs and factory instance array are removed during the next state load', () => {
  const store = new EconomyStore(':memory:');
  const now = 1_700_000_000_000;
  try {
    const world = createWorld(now);
    const player = ensurePlayer(world, alice, now);
    player.trades = [{ id: 'old-trade', type: 'commodity' }];
    player.ledger = [{ id: 'old-ledger', amount: 1 }];
    player.assetEvents = [{ id: 'old-event', cashDelta: 1 }];
    store.insertWorld.run(1, JSON.stringify(world), now);

    const state = store.getState(alice, now + 1);
    assert.equal(Object.hasOwn(state, 'trades'), false);
    const persisted = persistedWorld(store).players['1'];
    assertPlayerLogsAbsent(persisted);
    assert.equal(Object.hasOwn(persisted, 'facilities'), false);
  } finally {
    store.close();
  }
});

test('idempotency preserves an immediate authoritative response without creating server logs', () => {
  const store = new EconomyStore(':memory:');
  const now = 1_700_000_000_000;
  try {
    store.getState(alice, now);
    const action = request(
      'placeOrder',
      { productId: 'wheat', side: 'buy', quantity: 2, price: 1 },
      'idempotent-order-12345678',
      '/api/game/orders',
    );
    const first = store.apply(alice, action, now + 1);
    const second = store.apply(alice, action, now + 2);
    assert.deepEqual(second, first);
    const state = store.getState(alice, now + 3);
    assert.equal(state.inventories.wheat.available, 2);
    assert.equal(state.frozenCredits, 0);
    assertPlayerLogsAbsent(persistedWorld(store).players['1']);
  } finally {
    store.close();
  }
});
