import assert from 'node:assert/strict';
import test from 'node:test';
import { EconomyStore } from '../src/storage.js';
import {
  GEM_SHOP_CREDITS_PER_GEM,
  GEM_SHOP_MAX_EXCHANGE_GEMS,
} from '../src/gem-shop.js';

const user = { id: 1, email: 'shop@example.com', name: '宝石玩家', role: 'user' };

function setup() {
  const store = new EconomyStore(':memory:');
  const now = 1_700_000_000_000;
  const initial = store.getState(user, now);
  return { store, now, initial };
}

test('gem shop exchanges gems for credits atomically and records history', () => {
  const { store, now } = setup();
  try {
    const loaded = store.loadWorld(now + 1);
    loaded.world.players['1'].gems = 12;
    store.saveWorld(loaded.revision, loaded.world, now + 1);

    const response = store.apply(user, {
      action: 'exchangeGems', payload: { gems: 5 }, requestKey: 'gem-shop-exchange-0001',
      method: 'POST', path: '/api/game/gem-shop/exchange',
    }, now + 2);

    assert.deepEqual(Object.keys(response).sort(), ['result', 'revision']);
    assert.deepEqual(Object.keys(response.result).sort(), ['message', 'ok']);
    assert.equal(response.result.ok, true);

    const state = store.getState(user, now + 3);
    assert.equal(state.gems, 7);
    assert.equal(state.credits, 100 + 5 * GEM_SHOP_CREDITS_PER_GEM);

    const summary = store.getGemShopSummary(user, now + 4);
    assert.equal(summary.totalGemsSpent, 5);
    assert.equal(summary.totalCreditsReceived, 5 * GEM_SHOP_CREDITS_PER_GEM);
    assert.equal(summary.recentExchanges.length, 1);
    assert.equal(summary.recentExchanges[0].gemsSpent, 5);
  } finally {
    store.close();
  }
});

test('gem shop idempotency prevents duplicate deduction and issuance', () => {
  const { store, now } = setup();
  try {
    const loaded = store.loadWorld(now + 1);
    loaded.world.players['1'].gems = 10;
    store.saveWorld(loaded.revision, loaded.world, now + 1);
    const input = {
      action: 'exchangeGems', payload: { gems: 2 }, requestKey: 'gem-shop-exchange-0002',
      method: 'POST', path: '/api/game/gem-shop/exchange',
    };
    const first = store.apply(user, input, now + 2);
    const repeated = store.apply(user, input, now + 3);
    assert.deepEqual(repeated, first);
    const state = store.getState(user, now + 4);
    assert.equal(state.gems, 8);
    const summary = store.getGemShopSummary(user, now + 5);
    assert.equal(summary.totalGemsSpent, 2);
    assert.equal(summary.recentExchanges.length, 1);
  } finally {
    store.close();
  }
});

test('gem shop rejects invalid quantities and insufficient balance without mutation', () => {
  const { store, now } = setup();
  try {
    const loaded = store.loadWorld(now + 1);
    loaded.world.players['1'].gems = 3;
    store.saveWorld(loaded.revision, loaded.world, now + 1);
    const invalidValues = [0, 1.5, GEM_SHOP_MAX_EXCHANGE_GEMS + 1, 4];
    invalidValues.forEach((gems, index) => {
      const response = store.apply(user, {
        action: 'exchangeGems', payload: { gems }, requestKey: `gem-shop-invalid-000${index}`,
        method: 'POST', path: '/api/game/gem-shop/exchange',
      }, now + 2 + index);
      assert.equal(response.result.ok, false);
      assert.deepEqual(Object.keys(response.result).sort(), ['message', 'ok']);
    });
    const state = store.getState(user, now + 10);
    assert.equal(state.gems, 3);
    assert.equal(state.credits, 100);
    assert.equal(store.getGemShopSummary(user, now + 11).recentExchanges.length, 0);
  } finally {
    store.close();
  }
});
