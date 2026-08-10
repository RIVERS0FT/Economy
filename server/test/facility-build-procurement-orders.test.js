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
    assert.match(first.result.message, /剩余 [1-9]\d* 件继续挂在市场/);
    assert.equal(first.result.procurementGroup.facilityTypeId, 'ranch');
    assert.equal(first.result.procurementGroup.quantity, 1);
    assert.equal(first.result.procurementGroup.orders.length, 2);

    const state = store.getState(buyerUser, now + 33);
    assert.equal(state.facilityGroups.find((group) => group.facilityTypeId === 'ranch'), undefined, '挂单不得自动建厂');

    const referencedOrders = first.result.procurementGroup.orders.map((reference) => (
      state.orders.find((order) => order.id === reference.orderId)
    ));
    assert.ok(referencedOrders.every(Boolean), '采购组必须返回正式订单 ID');
    const openOrders = referencedOrders.filter((order) => order.status === 'open' || order.status === 'partial');
    const remainingQuantity = openOrders.reduce((sum, order) => sum + order.remaining, 0);
    assert.ok(remainingQuantity > 0, '卖盘不足时至少应有一张普通买单保留未成交数量');
    assert.match(first.result.message, new RegExp(`剩余 ${remainingQuantity} 件继续挂在市场`));

    for (const reference of first.result.procurementGroup.orders) {
      const order = state.orders.find((candidate) => candidate.id === reference.orderId);
      assert.equal(
        state.inventories[reference.productId].available,
        reference.quantity - order.remaining,
        '已成交建材应按统一订单簿实际成交数量进入仓库',
      );
    }
    const expectedFrozen = openOrders.reduce((sum, order) => sum + order.remaining * order.price, 0);
    assert.equal(state.frozenCredits, expectedFrozen, '只冻结各建材买单未成交部分对应的剩余资金');
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

    const beforeOrders = procurement.result.procurementGroup.orders.map((reference) => ({
      reference,
      order: beforeCancel.orders.find((candidate) => candidate.id === reference.orderId),
    }));
    assert.ok(beforeOrders.every(({ order }) => Boolean(order)));
    const openBeforeCancel = beforeOrders.filter(({ order }) => order.status === 'open' || order.status === 'partial');
    assert.ok(openBeforeCancel.length > 0, '取消测试必须保留至少一张未完成建材买单');
    const expectedAvailableByProduct = Object.fromEntries(beforeOrders.map(({ reference, order }) => [
      reference.productId,
      reference.quantity - order.remaining,
    ]));

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
    assert.equal(afterCancel.facilityGroups.find((group) => group.facilityTypeId === 'ranch'), undefined);
    for (const { reference, order: beforeOrder } of beforeOrders) {
      assert.equal(
        afterCancel.inventories[reference.productId].available,
        expectedAvailableByProduct[reference.productId],
        '整组取消不得回滚已经成交并入库的建材',
      );
      const afterOrder = afterCancel.orders.find((candidate) => candidate.id === reference.orderId);
      if (beforeOrder.status === 'open' || beforeOrder.status === 'partial') {
        assert.equal(afterOrder.status, 'cancelled');
        assert.equal(afterOrder.remaining, beforeOrder.remaining, '撤单保留历史未成交数量，不把剩余数量伪装为成交');
      }
    }
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
