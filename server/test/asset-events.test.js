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

test('client state exposes asset events and version 6', () => {
  const store = new EconomyStore(':memory:');
  try {
    const state = store.getState(alice, 1_700_000_000_000);
    assert.equal(state.version, 6);
    assert.equal(Array.isArray(state.assetEvents), true);
    assert.equal(state.assetEvents.length, 1);
    assert.equal(state.assetEvents[0].legacy, true);
  } finally {
    store.close();
  }
});

test('placing and cancelling an order records frozen asset changes', () => {
  const store = new EconomyStore(':memory:');
  const now = 1_700_000_000_000;
  try {
    store.getState(alice, now);
    const placed = store.apply(alice, request(
      'placeOrder',
      { productId: 'grain', side: 'buy', quantity: 5, price: 1 },
      'place-order-12345678',
      '/api/game/orders',
    ), now + 1);
    const placedEvent = placed.state.assetEvents[0];
    assert.equal(placed.result.ok, true);
    assert.equal(placedEvent.category, 'order');
    assert.equal(placedEvent.cashDelta, -5);
    assert.equal(placedEvent.frozenCashDelta, 5);
    assert.equal(placedEvent.sourceType, 'order');

    const order = placed.state.orders.find((item) => item.ownerId === alice.id && item.status === 'open');
    assert.ok(order);
    const cancelled = store.apply(alice, request(
      'cancelOrder',
      { orderId: order.id },
      'cancel-order-12345678',
      `/api/game/orders/${order.id}/cancel`,
    ), now + 2);
    const cancelledEvent = cancelled.state.assetEvents[0];
    assert.equal(cancelled.result.ok, true);
    assert.equal(cancelledEvent.category, 'order');
    assert.equal(cancelledEvent.cashDelta, 5);
    assert.equal(cancelledEvent.frozenCashDelta, -5);
    assert.equal(cancelledEvent.sourceId, order.id);
  } finally {
    store.close();
  }
});

test('production settlement records cash input and output changes', () => {
  const store = new EconomyStore(':memory:');
  const now = 1_700_000_000_000;
  try {
    store.getState(alice, now);
    const built = store.apply(alice, request(
      'buildFacility',
      { facilityTypeId: 'farm' },
      'build-farm-12345678',
      '/api/game/facilities',
    ), now + 1);
    const facilityId = built.state.facilities[0].id;
    store.getState(alice, now + 300_002);
    store.apply(alice, request(
      'startFacility',
      { facilityId },
      'start-farm-12345678',
      `/api/game/facilities/${facilityId}/start`,
    ), now + 300_003);

    const state = store.getState(alice, now + 330_004);
    const event = state.assetEvents[0];
    assert.equal(event.category, 'production');
    assert.equal(event.cashDelta, -1);
    assert.equal(event.productionChanges.length, 1);
    assert.equal(event.productionChanges[0].outputProductId, 'grain');
    assert.equal(event.productionChanges[0].outputQuantity, 2);
    assert.equal(event.productionChanges[0].internalGoodsDelta, 2);
  } finally {
    store.close();
  }
});

test('legacy ledger migrates once into asset events', () => {
  const store = new EconomyStore(':memory:');
  const now = 1_700_000_000_000;
  try {
    const world = createWorld(now);
    const player = ensurePlayer(world, alice, now);
    player.ledger = [{
      id: 'legacy-ledger-1',
      category: 'market_trade',
      amount: -12,
      balanceAfter: 88,
      createdAt: now - 100,
      description: '历史买入记录',
    }];
    delete player.assetEvents;
    world.version = 2;
    store.insertWorld.run(1, JSON.stringify(world), now);

    const first = store.getState(alice, now + 1);
    const second = store.getState(alice, now + 2);
    assert.equal(first.assetEvents.filter((event) => event.id === 'legacy-ledger-1').length, 1);
    assert.equal(second.assetEvents.filter((event) => event.id === 'legacy-ledger-1').length, 1);
    assert.equal(second.assetEvents.find((event) => event.id === 'legacy-ledger-1').legacy, true);
  } finally {
    store.close();
  }
});

test('idempotency does not duplicate asset events', () => {
  const store = new EconomyStore(':memory:');
  const now = 1_700_000_000_000;
  try {
    store.getState(alice, now);
    const action = request(
      'placeOrder',
      { productId: 'grain', side: 'buy', quantity: 2, price: 1 },
      'idempotent-order-12345678',
      '/api/game/orders',
    );
    const first = store.apply(alice, action, now + 1);
    const second = store.apply(alice, action, now + 2);
    assert.deepEqual(second, first);

    const state = store.getState(alice, now + 3);
    const orderEvents = state.assetEvents.filter((event) => event.sourceId === first.state.assetEvents[0].sourceId);
    assert.equal(orderEvents.length, 1);
  } finally {
    store.close();
  }
});
