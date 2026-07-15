import assert from 'node:assert/strict';
import test from 'node:test';
import { createWorld, ensurePlayer } from '../src/domain.js';
import { EconomyStore } from '../src/storage.js';

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
  const row = store.selectWorld.get();
  return JSON.parse(String(row.state_json));
}

function assertPlayerLogsAbsent(player) {
  assert.equal(Object.hasOwn(player, 'trades'), false);
  assert.equal(Object.hasOwn(player, 'ledger'), false);
  assert.equal(Object.hasOwn(player, 'assetEvents'), false);
}

test('client state version 12 excludes all player log arrays and factory instances', () => {
  const store = new EconomyStore(':memory:');
  try {
    const state = store.getState(alice, 1_700_000_000_000);
    assert.equal(state.version, 12);
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

test('actions update authoritative state without writing player logs to SQLite', () => {
  const store = new EconomyStore(':memory:');
  const now = 1_700_000_000_000;
  try {
    store.getState(alice, now);
    const placed = store.apply(alice, request(
      'placeOrder',
      { productId: 'wheat', side: 'buy', quantity: 5, price: 1 },
      'place-order-12345678',
      '/api/game/orders',
    ), now + 1);
    assert.equal(placed.result.ok, true);
    assert.equal(placed.state.frozenCredits, 5);
    assert.equal(Object.hasOwn(placed.state, 'trades'), false);
    assert.equal(Object.hasOwn(placed.state, 'assetEvents'), false);
    assertPlayerLogsAbsent(persistedWorld(store).players['1']);

    const order = placed.state.orders.find((item) => item.ownerId === alice.id && item.status === 'open');
    assert.ok(order);
    const cancelled = store.apply(alice, request(
      'cancelOrder',
      { orderId: order.id },
      'cancel-order-12345678',
      `/api/game/orders/${order.id}/cancel`,
    ), now + 2);
    assert.equal(cancelled.result.ok, true);
    assert.equal(cancelled.state.frozenCredits, 0);
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

test('idempotency preserves authoritative response without creating server logs', () => {
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
    assertPlayerLogsAbsent(persistedWorld(store).players['1']);
  } finally {
    store.close();
  }
});
