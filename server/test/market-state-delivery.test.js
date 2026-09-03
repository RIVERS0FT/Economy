import assert from 'node:assert/strict';
import test from 'node:test';
import { createWorld, ensurePlayer } from '../src/domain.js';
import { createEconomicCalendarClientState, ECONOMIC_EVENT_EPOCH_MS } from '../src/economic-events.js';
import { createFacilityGroupClientState } from '../src/facility-groups.js';
import { createMarketDetail } from '../src/market-state-delivery.js';
import {
  getOrderBookRuntimeDiagnostics,
  resetOrderBookRuntimeDiagnostics,
} from '../src/order-book-runtime.js';
import { DEFAULT_PROVINCE_ID, provinceScopedKey } from '../src/provinces.js';
import { EconomyStore } from '../src/runtime-store.js';

const HOUR_MS = 60 * 60 * 1_000;
const DAY_MS = 24 * HOUR_MS;
const now = ECONOMIC_EVENT_EPOCH_MS + DAY_MS + HOUR_MS;
const alice = { id: 301, email: 'alice-market@example.com', name: 'Alice' };
const bob = { id: 302, email: 'bob-market@example.com', name: 'Bob' };

function openOrder(id, ownerId, side, price, remaining, createdAt) {
  return {
    id,
    provinceId: DEFAULT_PROVINCE_ID,
    assetKind: 'commodity',
    assetId: 'wheat',
    productId: 'wheat',
    ownerType: 'player',
    ownerId,
    ownerName: ownerId === alice.id ? 'Alice' : 'Bob',
    side,
    price,
    quantity: remaining,
    remaining,
    status: 'open',
    createdAt,
    fills: [],
  };
}

test('initial player state keeps market summaries and only the current player legacy orders', () => {
  const world = createWorld(now);
  ensurePlayer(world, alice, now);
  ensurePlayer(world, bob, now);
  const calendar = createEconomicCalendarClientState(now);
  const completedEvent = calendar.events.find((event) => event.endsAt <= now);
  assert.ok(completedEvent);
  const eventProductId = completedEvent.productIds[0];
  const eventMarket = world.markets[provinceScopedKey(DEFAULT_PROVINCE_ID, eventProductId)];
  eventMarket.priceHistory = [
    { price: 10, quantity: 2, createdAt: completedEvent.startsAt + HOUR_MS, takerSide: 'buy', marketRole: 'private' },
    { price: 11, quantity: 3, createdAt: completedEvent.endsAt - HOUR_MS, takerSide: 'sell', signalWeight: 99 },
  ];
  world.orders = [
    openOrder('alice-buy', alice.id, 'buy', 3, 5, now - 2_000),
    openOrder('bob-sell', bob.id, 'sell', 4, 7, now - 1_000),
  ];

  const state = createFacilityGroupClientState(world, alice.id, now);
  assert.deepEqual(state.orders.map((order) => order.id), ['alice-buy']);
  assert.equal(state.orders[0].isOwn, true);
  assert.equal(state.marketPriceHistory.length, 0);
  for (const provinceMarkets of Object.values(state.provinceMarkets)) {
    for (const market of Object.values(provinceMarkets)) {
      assert.equal(Object.hasOwn(market, 'priceHistory'), false);
    }
  }
  for (const provinceMarkets of Object.values(state.provinceFacilityMarkets)) {
    for (const market of Object.values(provinceMarkets)) {
      assert.equal(Object.hasOwn(market, 'priceHistory'), false);
    }
  }
  assert.deepEqual(
    state.provinceMarkets[DEFAULT_PROVINCE_ID][eventProductId].eventTradeWindows[completedEvent.id],
    { tradeCount: 2, volume: 5, firstPrice: 10, lastPrice: 11 },
  );
});

test('commodity market detail returns bounded public real-trade history, empty public depth, and a conditional revision', () => {
  const world = createWorld(now);
  ensurePlayer(world, alice, now);
  ensurePlayer(world, bob, now);
  const market = world.markets[provinceScopedKey(DEFAULT_PROVINCE_ID, 'wheat')];
  market.priceHistory = [
    { price: 2.75, quantity: 9, createdAt: now - DAY_MS - 1, takerSide: 'buy', marketRole: 'expired' },
    { price: 3, quantity: 1, createdAt: now - 3_000, marketRole: 'synthetic', signalWeight: 8 },
    { price: 3.25, quantity: 2, createdAt: now - 2_000, takerSide: 'buy', marketRole: 'reserve', signalWeight: 3 },
    { price: 3.5, quantity: 4, createdAt: now - 1_000, takerSide: 'sell', marketRole: 'consumption', signalWeight: 4 },
  ];
  world.orders = [];
  for (let index = 0; index < 6; index += 1) {
    world.orders.push(openOrder(`bid-${index}`, bob.id, 'buy', 50 - index, index + 1, now + index));
    world.orders.push(openOrder(`ask-${index}`, bob.id, 'sell', 60 + index, index + 2, now + index));
  }
  world.orders.push(openOrder('ask-same-level', alice.id, 'sell', 60, 3, now + 10));

  const detail = createMarketDetail(world, {
    provinceId: DEFAULT_PROVINCE_ID,
    assetKind: 'commodity',
    assetId: 'wheat',
    now,
  });
  assert.deepEqual(detail.orderBook.bids, []);
  assert.deepEqual(detail.orderBook.asks, []);
  assert.equal(detail.market.buyVolume, 0);
  assert.equal(detail.market.sellVolume, 0);
  assert.equal(detail.market.buyOrderCount, 0);
  assert.equal(detail.market.sellOrderCount, 0);
  assert.equal(detail.market.bestBid, null);
  assert.equal(detail.market.bestAsk, null);
  assert.equal(detail.market.priceHistory.length, 2);
  assert.deepEqual(detail.market.priceHistory[0], {
    price: 3.25,
    quantity: 2,
    createdAt: now - 2_000,
    takerSide: 'buy',
  });
  assert.deepEqual(detail.market.priceHistory[1], {
    price: 3.5,
    quantity: 4,
    createdAt: now - 1_000,
    takerSide: 'sell',
  });
  assert.match(detail.revision, /^[A-Za-z0-9_-]{16}$/);
  const serialized = JSON.stringify(detail);
  for (const privateValue of [
    'Alice', 'Bob', 'ask-same-level', 'bid-0', 'ask-0',
    'marketRole', 'signalWeight', 'expired', 'synthetic',
  ]) {
    assert.equal(serialized.includes(privateValue), false, `${privateValue} must not be public`);
  }

  assert.throws(
    () => createMarketDetail(world, { provinceId: DEFAULT_PROVINCE_ID, assetKind: 'invalid', assetId: 'wheat', now }),
    (error) => error.statusCode === 400,
  );
  assert.throws(
    () => createMarketDetail(world, { provinceId: 'missing', assetKind: 'commodity', assetId: 'wheat', now }),
    (error) => error.statusCode === 404,
  );
  assert.throws(
    () => createMarketDetail(world, { provinceId: DEFAULT_PROVINCE_ID, assetKind: 'commodity', assetId: 'missing', now }),
    (error) => error.statusCode === 404,
  );
});

test('market detail store response omits an unchanged conditional payload', () => {
  const store = new EconomyStore(':memory:');
  try {
    store.getState(alice, now);
    const committedWorld = store.worldCache.world;
    resetOrderBookRuntimeDiagnostics(committedWorld);
    const first = store.getMarketDetail(alice, {
      provinceId: DEFAULT_PROVINCE_ID,
      assetKind: 'commodity',
      assetId: 'wheat',
    }, now + 1);
    assert.equal(first.unchanged, false);
    assert.equal(first.marketDetailRevision, first.marketDetail.revision);
    assert.equal(getOrderBookRuntimeDiagnostics(committedWorld).builds, 1);
    const repeated = store.getMarketDetail(alice, {
      provinceId: DEFAULT_PROVINCE_ID,
      assetKind: 'commodity',
      assetId: 'wheat',
      knownRevision: first.marketDetailRevision,
    }, now + 2);
    assert.equal(repeated.unchanged, true);
    assert.equal('marketDetail' in repeated, false);
    assert.equal(repeated.marketDetailRevision, first.marketDetailRevision);
    assert.equal(repeated.serverNow, now + 2);
    assert.equal(
      getOrderBookRuntimeDiagnostics(committedWorld).builds,
      1,
      'repeated market detail must reuse the committed-world order-book runtime',
    );
  } finally {
    store.close();
  }
});
