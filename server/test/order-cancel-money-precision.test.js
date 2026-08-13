import assert from 'node:assert/strict';
import test from 'node:test';
import { FACILITY_TYPE_CATALOG } from '../src/domain.js';
import { EconomyStore } from '../src/runtime-store.js';

const user = {
  id: 54501,
  email: 'issue-545-order-cancel@example.com',
  name: '撤单精度测试玩家',
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

test('decimal commodity buy cancellation releases frozen funds without a floating-point invariant failure', () => {
  const now = 1_700_545_000_000;
  const store = new EconomyStore(':memory:');
  try {
    const initial = store.getState(user, now);
    const initialCredits = initial.credits;

    const placed = applyOrderAction(store, 'placeOrder', {
      assetKind: 'commodity',
      assetId: 'wheat',
      productId: 'wheat',
      side: 'buy',
      quantity: 3,
      price: 0.05,
    }, 'issue-545-place-decimal-buy', now + 1);
    assert.equal(placed.result.ok, true);

    const afterPlace = store.getState(user, now + 2);
    const order = afterPlace.orders.find((candidate) => (
      candidate.isOwn
      && candidate.assetKind === 'commodity'
      && candidate.assetId === 'wheat'
      && candidate.side === 'buy'
      && (candidate.status === 'open' || candidate.status === 'partial')
    ));
    assert.ok(order, '0.05 × 3 的买单必须保留为可撤销开放订单');
    assert.equal(order.remaining, 3);
    assert.equal(afterPlace.frozenCredits, 0.15);

    const cancelled = applyOrderAction(
      store,
      'cancelOrder',
      { orderId: order.id },
      'issue-545-cancel-decimal-buy',
      now + 3,
      `/api/game/orders/${order.id}/cancel`,
    );
    assert.equal(cancelled.result.ok, true);

    const afterCancel = store.getState(user, now + 4);
    assert.equal(afterCancel.frozenCredits, 0);
    assert.equal(afterCancel.credits, initialCredits);
    assert.equal(afterCancel.orders.find((candidate) => candidate.id === order.id)?.status, 'cancelled');
  } finally {
    store.close();
  }
});

test('facility build procurement group cancellation releases decimal buy-order funds exactly', () => {
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
    const materialOrderPrices = Object.fromEntries(
      ranch.buildInputs.map((item) => [item.productId, 0.05]),
    );

    const procurement = applyOrderAction(store, 'placeOrder', {
      execution: 'facility-build-procurement',
      facilityTypeId: 'ranch',
      quantity: 1,
      materialOrderPrices,
    }, 'issue-545-create-procurement', now + 2);
    assert.equal(procurement.result.ok, true);
    assert.ok(procurement.result.procurementGroup?.orders?.length >= 2);

    const beforeCancel = store.getState(user, now + 3);
    assert.ok(beforeCancel.frozenCredits > 0);
    const orderIds = procurement.result.procurementGroup.orders.map((reference) => reference.orderId);
    assert.ok(orderIds.every((orderId) => beforeCancel.orders.some((order) => (
      order.id === orderId && (order.status === 'open' || order.status === 'partial')
    ))));

    const cancelled = applyOrderAction(store, 'placeOrder', {
      execution: 'facility-build-procurement-cancel',
      orderIds,
    }, 'issue-545-cancel-procurement', now + 4);
    assert.equal(cancelled.result.ok, true);
    assert.match(cancelled.result.message, /已成交材料保留在仓库/);

    const afterCancel = store.getState(user, now + 5);
    assert.equal(afterCancel.frozenCredits, 0);
    assert.equal(afterCancel.credits, 100_000);
    for (const orderId of orderIds) {
      assert.equal(afterCancel.orders.find((order) => order.id === orderId)?.status, 'cancelled');
    }
  } finally {
    store.close();
  }
});
