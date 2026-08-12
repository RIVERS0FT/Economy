import assert from 'node:assert/strict';
import test from 'node:test';
import { FACILITY_TYPE_CATALOG } from '../src/domain.js';
import { EconomyStore } from '../src/runtime-store.js';

const buyerUser = { id: 193, email: 'build-self-cross@example.com', name: '建造自交叉玩家', role: 'user' };
const ranch = FACILITY_TYPE_CATALOG.find((item) => item.id === 'ranch');
const ranchNeed = Object.fromEntries((ranch?.buildInputs || []).map((item) => [item.productId, item.quantity]));
const HIGH_PRICE = 1_000_000;

function prepareStore(now) {
  const store = new EconomyStore(':memory:');
  store.getState(buyerUser, now);
  const loaded = store.loadWorld(now + 1);
  const buyer = loaded.world.players[String(buyerUser.id)];
  buyer.credits = 1_000_000_000;
  for (const inventory of Object.values(buyer.inventories)) {
    inventory.available = 0;
    inventory.frozen = 0;
  }
  store.saveWorld(loaded.revision, loaded.world, now + 1);
  return store;
}

function giveInventory(store, productId, quantity, now) {
  const loaded = store.loadWorld(now);
  const inventory = loaded.world.players[String(buyerUser.id)].inventories[productId];
  inventory.available = quantity;
  inventory.frozen = 0;
  store.saveWorld(loaded.revision, loaded.world, now);
}

function placeOwnSell(store, productId, quantity, price, requestKey, now) {
  return store.apply(buyerUser, {
    action: 'placeOrder',
    payload: { assetKind: 'commodity', assetId: productId, productId, side: 'sell', quantity, price },
    requestKey,
    method: 'POST',
    path: '/api/game/orders',
  }, now);
}

function submitProcurement(store, requestKey, now, materialOrderPrices = {
  timber: HIGH_PRICE,
  ore: HIGH_PRICE,
}) {
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

function ownOrder(state, orderId) {
  return state.orders.find((order) => order.id === orderId);
}

test('build procurement auto-cancels crossing own sells and recalculates the released inventory deficit', () => {
  const now = 1_700_220_000_000;
  const store = prepareStore(now);
  try {
    assert.equal(ranchNeed.timber, 3);
    assert.equal(ranchNeed.ore, 2);
    giveInventory(store, 'timber', 2, now + 10);
    const sell = placeOwnSell(store, 'timber', 2, HIGH_PRICE, 'build-self-cross-sell-0001', now + 11);
    assert.equal(sell.result.ok, true);

    const before = store.getState(buyerUser, now + 12);
    const ownSell = before.orders.find((order) => (
      order.isOwn && order.assetId === 'timber' && order.side === 'sell'
      && (order.status === 'open' || order.status === 'partial')
    ));
    assert.ok(ownSell, '测试需要一张仍未完成的本人木材卖单');
    assert.equal(before.inventories.timber.available, 0);
    assert.equal(before.inventories.timber.frozen, 2);

    const requestKey = 'facility-build-self-cross-0001';
    const first = submitProcurement(store, requestKey, now + 13);
    const repeated = submitProcurement(store, requestKey, now + 14);
    assert.deepEqual(repeated, first, '幂等重试不得再次撤卖单或重复创建采购买单');
    assert.equal(first.result.ok, true);
    assert.match(first.result.message, /已自动撤销 1 张交叉卖单/);
    assert.ok(first.result.procurementGroup);

    const timberReference = first.result.procurementGroup.orders.find((order) => order.productId === 'timber');
    const oreReference = first.result.procurementGroup.orders.find((order) => order.productId === 'ore');
    assert.equal(timberReference?.quantity, 1, '撤回 2 件冻结木材后，3 件原缺口只能继续采购 1 件');
    assert.equal(oreReference?.quantity, 2);

    const after = store.getState(buyerUser, now + 15);
    const cancelledSell = ownOrder(after, ownSell.id);
    assert.equal(cancelledSell?.status, 'cancelled');
    assert.equal(cancelledSell?.remaining, ownSell.remaining);
  } finally {
    store.close();
  }
});

test('build procurement cancels every crossing sell and creates no buy order when released inventory covers all deficits', () => {
  const now = 1_700_230_000_000;
  const store = prepareStore(now);
  try {
    giveInventory(store, 'timber', ranchNeed.timber, now + 10);
    const timberSellResult = placeOwnSell(
      store,
      'timber',
      ranchNeed.timber,
      HIGH_PRICE,
      'build-self-cross-sell-0011',
      now + 11,
    );
    assert.equal(timberSellResult.result.ok, true);
    giveInventory(store, 'ore', ranchNeed.ore, now + 12);
    const oreSellResult = placeOwnSell(
      store,
      'ore',
      ranchNeed.ore,
      HIGH_PRICE,
      'build-self-cross-sell-0012',
      now + 13,
    );
    assert.equal(oreSellResult.result.ok, true);

    const before = store.getState(buyerUser, now + 14);
    const crossingSells = before.orders.filter((order) => (
      order.isOwn && order.side === 'sell'
      && (order.assetId === 'timber' || order.assetId === 'ore')
      && (order.status === 'open' || order.status === 'partial')
    ));
    assert.equal(crossingSells.length, 2);

    const requestKey = 'facility-build-self-cross-0011';
    const first = submitProcurement(store, requestKey, now + 15);
    const repeated = submitProcurement(store, requestKey, now + 16);
    assert.deepEqual(repeated, first);
    assert.equal(first.result.ok, true);
    assert.match(first.result.message, /已自动撤销 2 张交叉卖单/);
    assert.match(first.result.message, /建造材料已充足/);
    assert.equal(first.result.procurementGroup, undefined, '释放库存已经补足缺口时不得创建空采购组');

    const after = store.getState(buyerUser, now + 17);
    for (const sellOrder of crossingSells) {
      assert.equal(ownOrder(after, sellOrder.id)?.status, 'cancelled');
    }
    assert.equal(after.inventories.timber.available, ranchNeed.timber);
    assert.equal(after.inventories.ore.available, ranchNeed.ore);
    assert.equal(
      after.orders.filter((order) => order.isOwn && order.side === 'buy' && (order.assetId === 'timber' || order.assetId === 'ore')).length,
      0,
    );
  } finally {
    store.close();
  }
});

test('build procurement leaves non-crossing own sells untouched', () => {
  const now = 1_700_240_000_000;
  const store = prepareStore(now);
  try {
    giveInventory(store, 'timber', 1, now + 10);
    const sellResult = placeOwnSell(
      store,
      'timber',
      1,
      HIGH_PRICE * 2,
      'build-self-cross-sell-0021',
      now + 11,
    );
    assert.equal(sellResult.result.ok, true);
    const before = store.getState(buyerUser, now + 12);
    const ownSell = before.orders.find((order) => (
      order.isOwn && order.assetId === 'timber' && order.side === 'sell'
      && (order.status === 'open' || order.status === 'partial')
    ));
    assert.ok(ownSell);

    const result = submitProcurement(store, 'facility-build-self-cross-0021', now + 13);
    assert.equal(result.result.ok, true);
    assert.doesNotMatch(result.result.message, /自动撤销/);
    const timberReference = result.result.procurementGroup.orders.find((order) => order.productId === 'timber');
    assert.equal(timberReference?.quantity, ranchNeed.timber, '未交叉卖单继续冻结库存，不应被当成可用建材');

    const after = store.getState(buyerUser, now + 14);
    const unchangedSell = ownOrder(after, ownSell.id);
    assert.ok(unchangedSell?.status === 'open' || unchangedSell?.status === 'partial');
  } finally {
    store.close();
  }
});

test('failed build procurement rolls back auto-cancelled sells and released inventory', () => {
  const now = 1_700_250_000_000;
  const store = prepareStore(now);
  try {
    giveInventory(store, 'timber', 2, now + 10);
    const sellResult = placeOwnSell(store, 'timber', 2, HIGH_PRICE, 'build-self-cross-sell-0031', now + 11);
    assert.equal(sellResult.result.ok, true);

    const loaded = store.loadWorld(now + 12);
    loaded.world.players[String(buyerUser.id)].credits = 0;
    store.saveWorld(loaded.revision, loaded.world, now + 12);
    const before = store.getState(buyerUser, now + 13);
    const ownSell = before.orders.find((order) => (
      order.isOwn && order.assetId === 'timber' && order.side === 'sell'
      && (order.status === 'open' || order.status === 'partial')
    ));
    assert.ok(ownSell);
    assert.equal(before.inventories.timber.available, 0);
    assert.equal(before.inventories.timber.frozen, 2);

    const result = submitProcurement(store, 'facility-build-self-cross-0031', now + 14);
    assert.equal(result.result.ok, false);
    assert.match(result.result.message, /资金不足/);

    const after = store.getState(buyerUser, now + 15);
    const restoredSell = ownOrder(after, ownSell.id);
    assert.ok(restoredSell?.status === 'open' || restoredSell?.status === 'partial');
    assert.equal(restoredSell?.remaining, ownSell.remaining);
    assert.equal(after.inventories.timber.available, before.inventories.timber.available);
    assert.equal(after.inventories.timber.frozen, before.inventories.timber.frozen);
    assert.equal(
      after.orders.filter((order) => order.isOwn && order.side === 'buy' && (order.assetId === 'timber' || order.assetId === 'ore')).length,
      0,
      '失败事务不得留下任何建材买单',
    );
  } finally {
    store.close();
  }
});
