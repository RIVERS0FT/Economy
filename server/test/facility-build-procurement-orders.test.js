import assert from 'node:assert/strict';
import test from 'node:test';
import { FACILITY_TYPE_CATALOG } from '../src/domain.js';
import { EconomyStore } from '../src/runtime-store.js';

const buyerUser = { id: 191, email: 'build-orders@example.com', name: '采购建设玩家', role: 'user' };
const sellerUser = { id: 192, email: 'build-supplier@example.com', name: '采购供应商', role: 'user' };
const ranch = FACILITY_TYPE_CATALOG.find((item) => item.id === 'ranch');
const ranchNeed = Object.fromEntries((ranch?.buildInputs || []).map((item) => [item.productId, item.quantity]));

function prepareStore(now) {
  const store = new EconomyStore(':memory:');
  store.getState(buyerUser, now);
  store.getState(sellerUser, now + 1);
  const loaded = store.loadWorld(now + 2);
  const buyer = loaded.world.players[String(buyerUser.id)];
  const seller = loaded.world.players[String(sellerUser.id)];
  buyer.credits = 100_000;
  seller.credits = 1_000;
  for (const inventory of Object.values(buyer.inventories)) {
    inventory.available = 0;
    inventory.frozen = 0;
  }
  for (const inventory of Object.values(seller.inventories)) {
    inventory.available = 0;
    inventory.frozen = 0;
  }
  store.saveWorld(loaded.revision, loaded.world, now + 2);
  return store;
}

function placeSell(store, productId, quantity, price, requestKey, now) {
  const loaded = store.loadWorld(now);
  loaded.world.players[String(sellerUser.id)].inventories[productId].available = quantity;
  store.saveWorld(loaded.revision, loaded.world, now);
  return store.apply(sellerUser, {
    action: 'placeOrder',
    payload: { assetKind: 'commodity', assetId: productId, productId, side: 'sell', quantity, price },
    requestKey,
    method: 'POST',
    path: '/api/game/orders',
  }, now + 1);
}

function submitProcurement(store, requestKey, now, materialOrderPrices = { timber: 60, ore: 70 }) {
  return store.apply(buyerUser, {
    action: 'placeOrder',
    payload: {
      execution: 'facility-build-procurement',
      facilityTypeId: 'ranch',
      quantity: 1,
      materialOrderPrices,
    },
    requestKey,
    method: 'POST',
    path: '/api/game/orders',
  }, now);
}

test('insufficient sell depth creates one build procurement group with ordinary partial buy orders', () => {
  const now = 1_700_190_000_000;
  const store = prepareStore(now);
  try {
    assert.equal(ranchNeed.timber, 3);
    assert.equal(ranchNeed.ore, 2);
    assert.equal(placeSell(store, 'timber', 1, 60, 'build-order-sell-0001', now + 10).result.ok, true);
    assert.equal(placeSell(store, 'ore', ranchNeed.ore, 70, 'build-order-sell-0002', now + 20).result.ok, true);

    const requestKey = 'facility-build-orders-0001';
    const first = submitProcurement(store, requestKey, now + 31);
    const repeated = submitProcurement(store, requestKey, now + 32);
    assert.deepEqual(repeated, first, '幂等重试不得创建第二个采购组或重复买单');
    assert.equal(first.result.ok, true);
    assert.match(first.result.message, /剩余 2 件继续挂在市场/);
    assert.equal(first.result.procurementGroup.facilityTypeId, 'ranch');
    assert.equal(first.result.procurementGroup.quantity, 1);
    assert.equal(first.result.procurementGroup.orders.length, 2);

    const state = store.getState(buyerUser, now + 33);
    assert.equal(state.facilityGroups.find((group) => group.facilityTypeId === 'ranch'), undefined, '挂单不得自动建厂');
    assert.equal(state.inventories.timber.available, 1, '当前可成交木材应立即进入仓库');
    assert.equal(state.inventories.ore.available, ranchNeed.ore, '当前可成交铁矿石应立即进入仓库');

    const referencedOrders = first.result.procurementGroup.orders.map((reference) => (
      state.orders.find((order) => order.id === reference.orderId)
    ));
    assert.ok(referencedOrders.every(Boolean), '采购组必须返回正式订单 ID');
    const timberOrder = referencedOrders.find((order) => order.assetId === 'timber');
    const oreOrder = referencedOrders.find((order) => order.assetId === 'ore');
    assert.equal(timberOrder.status, 'partial');
    assert.equal(timberOrder.remaining, ranchNeed.timber - 1);
    assert.equal(oreOrder.status, 'filled');
    assert.equal(oreOrder.remaining, 0);
    assert.equal(state.frozenCredits, (ranchNeed.timber - 1) * 60, '只冻结未成交买单的剩余资金');
  } finally {
    store.close();
  }
});

test('cancelling a build procurement group releases only unfilled funds and keeps purchased materials', () => {
  const now = 1_700_200_000_000;
  const store = prepareStore(now);
  try {
    assert.equal(placeSell(store, 'timber', 1, 60, 'build-order-sell-0011', now + 10).result.ok, true);
    assert.equal(placeSell(store, 'ore', ranchNeed.ore, 70, 'build-order-sell-0012', now + 20).result.ok, true);
    const procurement = submitProcurement(store, 'facility-build-orders-0011', now + 31);
    assert.equal(procurement.result.ok, true);
    const beforeCancel = store.getState(buyerUser, now + 32);
    assert.ok(beforeCancel.frozenCredits > 0);

    const cancelRequest = {
      action: 'placeOrder',
      payload: {
        execution: 'facility-build-procurement-cancel',
        orderIds: procurement.result.procurementGroup.orders.map((order) => order.orderId),
      },
      requestKey: 'facility-build-orders-cancel-0011',
      method: 'POST',
      path: '/api/game/orders',
    };
    const firstCancel = store.apply(buyerUser, cancelRequest, now + 33);
    const repeatedCancel = store.apply(buyerUser, cancelRequest, now + 34);
    assert.deepEqual(repeatedCancel, firstCancel, '整组取消的幂等重试不得重复释放资金');
    assert.equal(firstCancel.result.ok, true);
    assert.match(firstCancel.result.message, /已成交材料保留在仓库/);

    const afterCancel = store.getState(buyerUser, now + 35);
    assert.equal(afterCancel.frozenCredits, 0);
    assert.equal(afterCancel.inventories.timber.available, 1);
    assert.equal(afterCancel.inventories.ore.available, ranchNeed.ore);
    assert.equal(afterCancel.facilityGroups.find((group) => group.facilityTypeId === 'ranch'), undefined);
    const timberOrderId = procurement.result.procurementGroup.orders.find((order) => order.productId === 'timber').orderId;
    const timberOrder = afterCancel.orders.find((order) => order.id === timberOrderId);
    assert.equal(timberOrder.status, 'cancelled');
    assert.equal(timberOrder.remaining, ranchNeed.timber - 1);
  } finally {
    store.close();
  }
});

test('invalid grouped material prices fail before creating any buy order', () => {
  const now = 1_700_210_000_000;
  const store = prepareStore(now);
  try {
    const before = store.getState(buyerUser, now + 10);
    const result = submitProcurement(store, 'facility-build-orders-0021', now + 11, { timber: 60 });
    assert.equal(result.result.ok, false);
    assert.match(result.result.message, /铁矿石买单价格无效/);
    const after = store.getState(buyerUser, now + 12);
    assert.deepEqual(after.orders, before.orders);
    assert.deepEqual(after.inventories, before.inventories);
    assert.equal(after.credits, before.credits);
    assert.equal(after.frozenCredits, before.frozenCredits);
  } finally {
    store.close();
  }
});
