import assert from 'node:assert/strict';
import test from 'node:test';
import { EconomyStore } from '../src/storage.js';
import {
  calculateNextGemShopRate,
  GEM_SHOP_CREDITS_PER_GEM,
  GEM_SHOP_LEGACY_CREDITS_PER_GEM,
  GEM_SHOP_MAX_CREDITS_PER_GEM,
  GEM_SHOP_MAX_DAILY_RATE_CHANGE,
  GEM_SHOP_MAX_EXCHANGE_GEMS,
  GEM_SHOP_MIN_CREDITS_PER_GEM,
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
    assert.equal(summary.quoteDecision, 'accepted');
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

test('legacy full idempotency responses are projected to slim acknowledgements', () => {
  const { store, now } = setup();
  try {
    store.insertIdempotency.run(
      Number(user.id),
      'legacy-full-action-0001',
      'POST',
      '/api/game/gem-shop/exchange',
      JSON.stringify({
        result: { ok: true, message: '旧响应', gemsSpent: 2, creditsReceived: 20 },
        revision: 9,
        state: { version: 15, userId: 1, credits: 120 },
      }),
      now,
    );

    const response = store.apply(user, {
      action: 'exchangeGems',
      payload: { gems: 2 },
      requestKey: 'legacy-full-action-0001',
      method: 'POST',
      path: '/api/game/gem-shop/exchange',
    }, now + 1);

    assert.deepEqual(response, {
      result: { ok: true, message: '旧响应' },
      revision: 9,
    });
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

test('terminal quote can be accepted only once per Shanghai day', () => {
  const { store, now } = setup();
  try {
    const loaded = store.loadWorld(now + 1);
    loaded.world.players['1'].gems = 10;
    store.saveWorld(loaded.revision, loaded.world, now + 1);
    const first = store.apply(user, {
      action: 'exchangeGems', payload: { gems: 2 }, requestKey: 'daily-quote-accept-0001',
      method: 'POST', path: '/api/game/gem-shop/exchange',
    }, now + 2);
    assert.equal(first.result.ok, true);
    const second = store.apply(user, {
      action: 'exchangeGems', payload: { gems: 1 }, requestKey: 'daily-quote-accept-0002',
      method: 'POST', path: '/api/game/gem-shop/exchange',
    }, now + 3);
    assert.equal(second.result.ok, false);
    assert.match(second.result.message, /今日终端报价已经使用/);
  } finally {
    store.close();
  }
});

test('rejecting terminal quote locks the day without changing assets', () => {
  const { store, now } = setup();
  try {
    const before = store.getState(user, now + 1);
    const rejected = store.apply(user, {
      action: 'rejectGemShopQuote', payload: {}, requestKey: 'daily-quote-reject-0001',
      method: 'POST', path: '/api/game/gem-shop/quote/reject',
    }, now + 2);
    assert.equal(rejected.result.ok, true);
    const exchange = store.apply(user, {
      action: 'exchangeGems', payload: { gems: 1 }, requestKey: 'daily-quote-reject-0002',
      method: 'POST', path: '/api/game/gem-shop/exchange',
    }, now + 3);
    assert.equal(exchange.result.ok, false);
    const after = store.getState(user, now + 4);
    assert.equal(after.gems, before.gems);
    assert.equal(after.credits, before.credits);
    assert.equal(store.getGemShopSummary(user, now + 5).quoteDecision, 'rejected');
  } finally {
    store.close();
  }
});

test('dynamic terminal quote uses the 100 baseline, 1-10000 bounds, and a 10% maximum daily change', () => {
  assert.equal(GEM_SHOP_CREDITS_PER_GEM, 100);
  assert.equal(GEM_SHOP_LEGACY_CREDITS_PER_GEM, 10);
  assert.equal(GEM_SHOP_MIN_CREDITS_PER_GEM, 1);
  assert.equal(GEM_SHOP_MAX_CREDITS_PER_GEM, 10_000);
  assert.equal(GEM_SHOP_MAX_DAILY_RATE_CHANGE, 1_000);

  const high = calculateNextGemShopRate({
    previousRate: 100,
    yesterdayEffectiveGems: 200,
    recentEffectiveGems: [20, 30, 40, 50, 60, 70, 80],
    acceptedCount: 20,
    rejectedCount: 0,
  });
  assert.equal(high.creditsPerGem, 1);
  assert.equal(high.demandTone, 'high');

  const low = calculateNextGemShopRate({
    previousRate: 100,
    yesterdayEffectiveGems: 5,
    recentEffectiveGems: [80, 90, 100, 110, 120, 130, 140],
    acceptedCount: 0,
    rejectedCount: 20,
  });
  assert.equal(low.creditsPerGem, 1_100);
  assert.equal(low.demandTone, 'low');

  const upperBound = calculateNextGemShopRate({
    previousRate: 9_500,
    yesterdayEffectiveGems: 1,
    recentEffectiveGems: [100, 100, 100],
    acceptedCount: 0,
    rejectedCount: 20,
  });
  assert.equal(upperBound.creditsPerGem, 10_000);
  assert.ok(upperBound.creditsPerGem - 9_500 <= GEM_SHOP_MAX_DAILY_RATE_CHANGE);
});
