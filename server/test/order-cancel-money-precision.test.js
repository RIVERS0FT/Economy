import assert from 'node:assert/strict';
import test from 'node:test';
import { FACILITY_TYPE_CATALOG } from '../src/domain.js';
import { dailyCheckInPeriodFor } from '../src/daily-check-in.js';
import { EconomyStore } from '../src/runtime-store.js';
import { DEFAULT_PROVINCE_ID, provinceScopedKey } from '../src/provinces.js';

const user = {
  id: 54501,
  email: 'issue-545-order-cancel@example.com',
  name: '即时交易精度测试玩家',
  role: 'user',
};

function applyOrderAction(store, action, payload, requestKey, now, path = '/api/game/orders') {
  return store.apply(user, {
    action,
    payload,
    requestKey,
    method: 'POST',
    path,
  }, now);
}

test('valid decimal daily-price commodity buy settles exactly without frozen funds or a cancellable remainder', () => {
  const now = 1_700_545_000_000;
  const store = new EconomyStore(':memory:');
  try {
    store.getState(user, now);
    const loaded = store.loadWorld(now + 1);
    const player = loaded.world.players[String(user.id)];
    player.credits = 100;
    const market = loaded.world.markets[provinceScopedKey(DEFAULT_PROVINCE_ID, 'wheat')];
    const pricePeriod = dailyCheckInPeriodFor(now + 2);
    market.officialPrice = 0.61;
    market.priceDateKey = pricePeriod.todayKey;
    market.nextPriceAt = pricePeriod.nextResetAt;
    market.todayBuyQuantity = 0;
    market.todaySellQuantity = 0;
    store.saveWorld(loaded.revision, loaded.world, now + 1);

    const placed = applyOrderAction(store, 'placeOrder', {
      provinceId: DEFAULT_PROVINCE_ID,
      assetKind: 'commodity',
      assetId: 'wheat',
      productId: 'wheat',
      side: 'buy',
      quantity: 3,
      price: 0.05,
    }, 'issue-545-place-immediate-buy', now + 2);
    assert.equal(placed.result.ok, true);

    const afterPlace = store.getState(user, now + 3);
    assert.equal(afterPlace.frozenCredits, 0);
    assert.equal(afterPlace.credits, 98.17);
    assert.equal(afterPlace.inventories.wheat.available, 3);
    assert.equal(afterPlace.provinceMarkets[DEFAULT_PROVINCE_ID].wheat.officialPrice, 0.61);
    const order = afterPlace.orders.find((candidate) => candidate.isOwn && candidate.assetKind === 'commodity' && candidate.assetId === 'wheat');
    assert.ok(order);
    assert.equal(order.status, 'filled');
    assert.equal(order.remaining, 0);
    assert.equal(order.price, 0.61);

    const cancelled = applyOrderAction(
      store,
      'cancelOrder',
      { orderId: order.id },
      'issue-545-cancel-filled-buy',
      now + 4,
      `/api/game/orders/${order.id}/cancel`,
    );
    assert.equal(cancelled.result.ok, false);
    const afterCancel = store.getState(user, now + 5);
    assert.equal(afterCancel.frozenCredits, 0);
    assert.equal(afterCancel.credits, 98.17);
    assert.equal(afterCancel.inventories.wheat.available, 3);
    assert.equal(afterCancel.provinceMarkets[DEFAULT_PROVINCE_ID].wheat.officialPrice, 0.61);
  } finally {
    store.close();
  }
});

test('facility build procurement compatibility purchase and cancel keep decimal money exact without frozen orders', () => {
  const now = 1_700_545_100_000;
  const store = new EconomyStore(':memory:');
  try {
    store.getState(user, now);
    const loaded = store.loadWorld(now + 1);
    const player = loaded.world.players[String(user.id)];
    player.credits = 100_000;
    for (const inventory of Object.values(player.inventories || {})) {
      inventory.available = 0;
      inventory.frozen = 0;
    }
    store.saveWorld(loaded.revision, loaded.world, now + 1);

    const ranch = FACILITY_TYPE_CATALOG.find((type) => type.id === 'ranch');
    assert.ok(ranch?.buildInputs?.length >= 2, '测试需要牧场至少两种建造材料');
    const quote = store.getFacilityBuildQuote(user, {
      provinceId: DEFAULT_PROVINCE_ID,
      facilityTypeId: 'ranch',
      quantity: 1,
    }, now + 2).quote;

    const procurement = applyOrderAction(store, 'placeOrder', {
      execution: 'facility-build-procurement',
      provinceId: DEFAULT_PROVINCE_ID,
      facilityTypeId: 'ranch',
      quantity: 1,
      materialOrderPrices: quote.materialOrderPrices,
    }, 'issue-545-create-immediate-procurement', now + 3);
    assert.equal(procurement.result.ok, true);
    assert.match(procurement.result.message, /今日系统价即时购齐/);

    const afterProcurement = store.getState(user, now + 4);
    assert.equal(afterProcurement.frozenCredits, 0);
    assert.equal(afterProcurement.orders.some((order) => order.isOwn && ['open', 'partial'].includes(order.status)), false);
    assert.equal(Number((100_000 - afterProcurement.credits).toFixed(6)), Number(quote.estimatedTotal.toFixed(6)));
    for (const input of ranch.buildInputs) assert.equal(afterProcurement.inventories[input.productId].available, input.quantity);

    const beforeCancel = structuredClone(afterProcurement);
    const cancelled = applyOrderAction(store, 'placeOrder', {
      execution: 'facility-build-procurement-cancel',
      provinceId: DEFAULT_PROVINCE_ID,
      orderIds: ['retired-procurement-order'],
    }, 'issue-545-cancel-retired-procurement', now + 5);
    assert.equal(cancelled.result.ok, true);
    assert.match(cancelled.result.message, /不存在待取消挂单/);

    const afterCancel = store.getState(user, now + 6);
    assert.equal(afterCancel.credits, beforeCancel.credits);
    assert.equal(afterCancel.frozenCredits, 0);
    assert.deepEqual(afterCancel.inventories, beforeCancel.inventories);
  } finally {
    store.close();
  }
});
