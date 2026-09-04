import assert from 'node:assert/strict';
import test from 'node:test';
import { FACILITY_TYPE_CATALOG } from '../src/domain.js';
import { EconomyStore } from '../src/runtime-store.js';

const buyerUser = { id: 191, email: 'build-orders@example.com', name: '采购建设玩家', role: 'user' };
const ranch = FACILITY_TYPE_CATALOG.find((item) => item.id === 'ranch');
const ranchNeed = Object.fromEntries((ranch?.buildInputs || []).map((item) => [item.productId, item.quantity]));

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

function submitProcurement(store, requestKey, now, materialOrderPrices = { timber: 999, ore: 999 }) {
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

function openPlayerCommodityOrders(state) {
  return (state.orders || []).filter((order) => (
    order.isOwn
    && order.assetKind === 'commodity'
    && (order.status === 'open' || order.status === 'partial')
  ));
}

test('legacy build procurement action immediately buys every missing material and leaves no procurement group', () => {
  const now = 1_700_190_000_000;
  const store = prepareStore(now);
  try {
    assert.equal(ranchNeed.timber, 3);
    assert.equal(ranchNeed.ore, 2);
    const requestKey = 'facility-build-orders-0001';
    const first = submitProcurement(store, requestKey, now + 10);
    const repeated = submitProcurement(store, requestKey, now + 11);

    assert.deepEqual(repeated, first, '幂等重试不得重复即时采购');
    assert.equal(first.result.ok, true, first.result.message);
    assert.match(first.result.message, /已按今日系统价即时购齐 5 件建造材料/);
    assert.equal(Object.hasOwn(first.result, 'procurementGroup'), false);

    const state = store.getState(buyerUser, now + 12);
    assert.equal(state.facilityGroups.find((group) => group.facilityTypeId === 'ranch'), undefined, '兼容采购动作只购料，不自动建厂');
    assert.equal(state.inventories.timber.available, ranchNeed.timber);
    assert.equal(state.inventories.ore.available, ranchNeed.ore);
    assert.equal(state.inventories.timber.frozen, 0);
    assert.equal(state.inventories.ore.frozen, 0);
    assert.equal(state.frozenCredits, 0);
    assert.equal(openPlayerCommodityOrders(state).length, 0);

    const filled = state.orders.filter((order) => (
      order.isOwn && order.assetKind === 'commodity' && order.status === 'filled'
    ));
    assert.equal(filled.reduce((sum, order) => sum + order.quantity, 0), 5);
    assert.ok(filled.every((order) => order.remaining === 0));
  } finally {
    store.close();
  }
});

test('legacy procurement cancel action is an idempotent no-op because no resting procurement order exists', () => {
  const now = 1_700_200_000_000;
  const store = prepareStore(now);
  try {
    const procurement = submitProcurement(store, 'facility-build-orders-0011', now + 10);
    assert.equal(procurement.result.ok, true, procurement.result.message);
    const before = store.getState(buyerUser, now + 11);

    const cancelRequest = {
      action: 'placeOrder',
      payload: {
        execution: 'facility-build-procurement-cancel',
        orderIds: [],
      },
      requestKey: 'facility-build-orders-cancel-0011',
      method: 'POST',
      path: '/api/game/orders',
    };
    const firstCancel = store.apply(buyerUser, cancelRequest, now + 12);
    const repeatedCancel = store.apply(buyerUser, cancelRequest, now + 13);

    assert.deepEqual(repeatedCancel, firstCancel);
    assert.equal(firstCancel.result.ok, true);
    assert.match(firstCancel.result.message, /不存在待取消挂单/);
    const after = store.getState(buyerUser, now + 14);
    assert.equal(after.frozenCredits, 0);
    assert.equal(openPlayerCommodityOrders(after).length, 0);
    assert.equal(after.inventories.timber.available, before.inventories.timber.available);
    assert.equal(after.inventories.ore.available, before.inventories.ore.available);
  } finally {
    store.close();
  }
});

test('invalid compatibility price protection fails before any immediate purchase', () => {
  const now = 1_700_210_000_000;
  const store = prepareStore(now);
  try {
    const before = store.getState(buyerUser, now + 10);
    const result = submitProcurement(store, 'facility-build-orders-0021', now + 11, { timber: 999 });

    assert.equal(result.result.ok, false);
    assert.match(result.result.message, /铁矿石采购价格保护无效/);
    const after = store.getState(buyerUser, now + 12);
    assert.deepEqual(after.orders, before.orders);
    assert.deepEqual(after.inventories, before.inventories);
    assert.equal(after.credits, before.credits);
    assert.equal(after.frozenCredits, 0);
  } finally {
    store.close();
  }
});

test('stale compatibility price cap rejects the whole purchase without partial material delivery', () => {
  const now = 1_700_220_000_000;
  const store = prepareStore(now);
  try {
    const before = store.getState(buyerUser, now + 10);
    const result = submitProcurement(store, 'facility-build-orders-0031', now + 11, { timber: 0.01, ore: 999 });

    assert.equal(result.result.ok, false);
    assert.match(result.result.message, /木材今日系统价已变化/);
    const after = store.getState(buyerUser, now + 12);
    assert.equal(after.credits, before.credits);
    assert.equal(after.inventories.timber.available, 0);
    assert.equal(after.inventories.ore.available, 0);
    assert.equal(after.frozenCredits, 0);
    assert.equal(openPlayerCommodityOrders(after).length, 0);
  } finally {
    store.close();
  }
});
