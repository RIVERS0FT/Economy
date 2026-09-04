import assert from 'node:assert/strict';
import test from 'node:test';
import { FACILITY_TYPE_CATALOG } from '../src/domain.js';
import { EconomyStore } from '../src/runtime-store.js';
import { DEFAULT_PROVINCE_ID } from '../src/provinces.js';

const buyerUser = { id: 191, email: 'build-orders@example.com', name: '采购建设玩家', role: 'user' };
const ranch = FACILITY_TYPE_CATALOG.find((item) => item.id === 'ranch');

function prepareStore(now) {
  const store = new EconomyStore(':memory:');
  store.getState(buyerUser, now);
  const loaded = store.loadWorld(now + 1);
  const buyer = loaded.world.players[String(buyerUser.id)];
  buyer.credits = 100_000;
  for (const inventory of Object.values(buyer.inventories)) {
    inventory.available = 0;
    inventory.frozen = 0;
  }
  store.saveWorld(loaded.revision, loaded.world, now + 1);
  return store;
}

function quoteFor(store, now) {
  return store.getFacilityBuildQuote(buyerUser, {
    provinceId: DEFAULT_PROVINCE_ID,
    facilityTypeId: 'ranch',
    quantity: 1,
  }, now).quote;
}

function submitCompatibilityProcurement(store, quote, requestKey, now, materialOrderPrices = quote.materialOrderPrices) {
  return store.apply(buyerUser, {
    action: 'placeOrder',
    payload: {
      execution: 'facility-build-procurement',
      provinceId: DEFAULT_PROVINCE_ID,
      facilityTypeId: 'ranch',
      quantity: 1,
      materialOrderPrices,
    },
    requestKey,
    method: 'POST',
    path: '/api/game/orders',
  }, now);
}

test('legacy build procurement action now purchases every missing material immediately at the daily official price', () => {
  const now = 1_700_190_000_000;
  const store = prepareStore(now);
  try {
    const quote = quoteFor(store, now + 2);
    const before = store.getState(buyerUser, now + 3);
    const first = submitCompatibilityProcurement(store, quote, 'facility-build-orders-0001', now + 4);
    const repeated = submitCompatibilityProcurement(store, quote, 'facility-build-orders-0001', now + 5);
    assert.deepEqual(repeated, first);
    assert.equal(first.result.ok, true);
    assert.match(first.result.message, /今日系统价即时购齐/);

    const after = store.getState(buyerUser, now + 6);
    assert.equal(after.facilityGroups.find((group) => group.facilityTypeId === 'ranch'), undefined, '兼容采购动作只购料，不自动建厂');
    for (const input of ranch.buildInputs) assert.equal(after.inventories[input.productId].available, input.quantity);
    assert.equal(after.frozenCredits, 0);
    assert.equal(after.orders.some((order) => order.isOwn && ['open', 'partial'].includes(order.status)), false);
    assert.equal(Number((before.credits - after.credits).toFixed(6)), Number(quote.estimatedTotal.toFixed(6)));
  } finally {
    store.close();
  }
});

test('legacy build procurement cancel action is a no-op because no resting order exists', () => {
  const now = 1_700_200_000_000;
  const store = prepareStore(now);
  try {
    const before = store.getState(buyerUser, now + 2);
    const result = store.apply(buyerUser, {
      action: 'placeOrder',
      payload: { execution: 'facility-build-procurement-cancel', provinceId: DEFAULT_PROVINCE_ID, orderIds: ['legacy'] },
      requestKey: 'facility-build-orders-cancel-0011', method: 'POST', path: '/api/game/orders',
    }, now + 3);
    assert.equal(result.result.ok, true);
    assert.match(result.result.message, /不存在待取消挂单/);
    const after = store.getState(buyerUser, now + 4);
    assert.equal(after.credits, before.credits);
    assert.equal(after.frozenCredits, 0);
    assert.deepEqual(after.inventories, before.inventories);
  } finally {
    store.close();
  }
});

test('legacy build procurement rejects incomplete daily-price protection before changing assets', () => {
  const now = 1_700_210_000_000;
  const store = prepareStore(now);
  try {
    const quote = quoteFor(store, now + 2);
    const firstProductId = ranch.buildInputs[0].productId;
    const before = store.getState(buyerUser, now + 3);
    const result = submitCompatibilityProcurement(store, quote, 'facility-build-orders-0021', now + 4, {
      [firstProductId]: quote.materialOrderPrices[firstProductId],
    });
    assert.equal(result.result.ok, false);
    assert.match(result.result.message, /采购价格保护无效/);
    const after = store.getState(buyerUser, now + 5);
    assert.equal(after.credits, before.credits);
    assert.equal(after.frozenCredits, before.frozenCredits);
    assert.deepEqual(after.inventories, before.inventories);
  } finally {
    store.close();
  }
});
