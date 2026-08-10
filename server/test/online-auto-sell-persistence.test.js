import assert from 'node:assert/strict';
import test from 'node:test';
import { EconomyStore } from '../src/runtime-store.js';

const alice = { id: 1, email: 'alice@example.com', name: 'Alice' };
const now = 1_700_000_000_000;

function request(payload, requestKey) {
  return {
    action: 'placeOrder',
    payload,
    requestKey,
    method: 'POST',
    path: '/api/game/orders',
  };
}

function persistedPlayer(store) {
  const row = store.selectWorld.get();
  const world = JSON.parse(String(row.state_json));
  return world.players['1'];
}

test('runtime store persists auto-sell policy and returns it in formal client state', () => {
  const store = new EconomyStore(':memory:');
  try {
    const initial = store.getState(alice, now);
    assert.deepEqual(initial.onlineAutoSellPolicies, {});
    const activityBefore = persistedPlayer(store).lastEconomicActivityAt;

    const saved = store.apply(alice, request({
      assetKind: 'commodity',
      assetId: 'wheat',
      productId: 'wheat',
      execution: 'online-auto-sell-policy',
      enabled: true,
      price: 6.25,
      minimumFreeInventory: 4,
    }, 'auto-sell-policy-12345678'), now + 1);
    assert.equal(saved.result.ok, true);

    const persisted = persistedPlayer(store);
    assert.deepEqual(persisted.onlineAutoSellPolicies.wheat, {
      enabled: true,
      price: 6.25,
      minimumFreeInventory: 4,
    });
    assert.equal(persisted.lastEconomicActivityAt, activityBefore);

    const reloaded = store.getState(alice, now + 2);
    assert.deepEqual(reloaded.onlineAutoSellPolicies.wheat, {
      enabled: true,
      price: 6.25,
      minimumFreeInventory: 4,
    });
  } finally {
    store.close();
  }
});

test('runtime store keeps last legal thresholds when auto-sell is disabled', () => {
  const store = new EconomyStore(':memory:');
  try {
    store.getState(alice, now);
    const saved = store.apply(alice, request({
      productId: 'wheat',
      execution: 'online-auto-sell-policy',
      enabled: false,
      price: 9.5,
      minimumFreeInventory: 7,
    }, 'auto-sell-policy-off-12345678'), now + 1);
    assert.equal(saved.result.ok, true);
    assert.deepEqual(store.getState(alice, now + 2).onlineAutoSellPolicies.wheat, {
      enabled: false,
      price: 9.5,
      minimumFreeInventory: 7,
    });
  } finally {
    store.close();
  }
});

test('runtime store rejects invalid auto-sell policies without persisting them', () => {
  const store = new EconomyStore(':memory:');
  try {
    store.getState(alice, now);
    const rejected = store.apply(alice, request({
      productId: 'wheat',
      execution: 'online-auto-sell-policy',
      enabled: true,
      price: 5,
      minimumFreeInventory: -1,
    }, 'auto-sell-policy-invalid-12345678'), now + 1);
    assert.equal(rejected.result.ok, false);
    assert.deepEqual(store.getState(alice, now + 2).onlineAutoSellPolicies, {});
  } finally {
    store.close();
  }
});
