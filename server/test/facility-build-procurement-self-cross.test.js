import assert from 'node:assert/strict';
import test from 'node:test';
import { FACILITY_TYPE_CATALOG } from '../src/domain.js';
import { EconomyStore } from '../src/runtime-store.js';

const buyerUser = { id: 193, email: 'build-self-cross@example.com', name: '建造即时采购玩家', role: 'user' };
const ranch = FACILITY_TYPE_CATALOG.find((item) => item.id === 'ranch');
const ranchNeed = Object.fromEntries((ranch?.buildInputs || []).map((item) => [item.productId, item.quantity]));

function prepareStore(now) {
  const store = new EconomyStore(':memory:');
  store.getState(buyerUser, now);
  const loaded = store.loadWorld(now + 1);
  const buyer = loaded.world.players[String(buyerUser.id)];
  buyer.credits = 1_000_000;
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

function sellImmediately(store, productId, quantity, requestKey, now) {
  return store.apply(buyerUser, {
    action: 'placeOrder',
    payload: { assetKind: 'commodity', assetId: productId, productId, side: 'sell', quantity, price: 999_999 },
    requestKey,
    method: 'POST',
    path: '/api/game/orders',
  }, now);
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
    order.isOwn && order.assetKind === 'commodity' && (order.status === 'open' || order.status === 'partial')
  ));
}

test('manual commodity sells complete immediately, so build procurement has no self-crossing order state', () => {
  const now = 1_700_220_000_000;
  const store = prepareStore(now);
  try {
    assert.equal(ranchNeed.timber, 3);
    assert.equal(ranchNeed.ore, 2);
    giveInventory(store, 'timber', 2, now + 10);
    const sold = sellImmediately(store, 'timber', 2, 'build-self-cross-sell-0001', now + 11);
    assert.equal(sold.result.ok, true, sold.result.message);

    const afterSell = store.getState(buyerUser, now + 12);
    assert.equal(afterSell.inventories.timber.available, 0);
    assert.equal(afterSell.inventories.timber.frozen, 0);
    assert.equal(openPlayerCommodityOrders(afterSell).length, 0);
    assert.ok(afterSell.orders.some((order) => (
      order.isOwn && order.assetId === 'timber' && order.side === 'sell' && order.status === 'filled'
    )));

    const procurement = submitProcurement(store, 'facility-build-self-cross-0001', now + 13);
    assert.equal(procurement.result.ok, true, procurement.result.message);
    assert.doesNotMatch(procurement.result.message, /自动撤销|交叉卖单/);
    const after = store.getState(buyerUser, now + 14);
    assert.equal(after.inventories.timber.available, ranchNeed.timber);
    assert.equal(after.inventories.ore.available, ranchNeed.ore);
    assert.equal(after.frozenCredits, 0);
    assert.equal(openPlayerCommodityOrders(after).length, 0);
  } finally {
    store.close();
  }
});

test('existing available materials reduce only the true immediate procurement deficit', () => {
  const now = 1_700_230_000_000;
  const store = prepareStore(now);
  try {
    giveInventory(store, 'timber', 2, now + 10);
    giveInventory(store, 'ore', 1, now + 11);
    const before = store.getState(buyerUser, now + 12);
    assert.equal(before.inventories.timber.available, 2);
    assert.equal(before.inventories.ore.available, 1);

    const procurement = submitProcurement(store, 'facility-build-self-cross-0011', now + 13);
    assert.equal(procurement.result.ok, true, procurement.result.message);
    const after = store.getState(buyerUser, now + 14);
    assert.equal(after.inventories.timber.available, ranchNeed.timber);
    assert.equal(after.inventories.ore.available, ranchNeed.ore);
    const buys = after.orders.filter((order) => (
      order.isOwn && order.assetKind === 'commodity' && order.side === 'buy' && order.status === 'filled'
      && Number(order.createdAt) >= now + 13
    ));
    assert.equal(buys.reduce((sum, order) => sum + order.quantity, 0), 2);
    assert.equal(openPlayerCommodityOrders(after).length, 0);
  } finally {
    store.close();
  }
});

test('failed immediate procurement never rewrites completed trade history or leaves frozen assets', () => {
  const now = 1_700_240_000_000;
  const store = prepareStore(now);
  try {
    giveInventory(store, 'timber', 1, now + 10);
    const sold = sellImmediately(store, 'timber', 1, 'build-self-cross-sell-0021', now + 11);
    assert.equal(sold.result.ok, true, sold.result.message);
    const loaded = store.loadWorld(now + 12);
    loaded.world.players[String(buyerUser.id)].credits = 0;
    store.saveWorld(loaded.revision, loaded.world, now + 12);
    const before = store.getState(buyerUser, now + 13);
    const completedSellIds = before.orders.filter((order) => order.isOwn && order.side === 'sell' && order.status === 'filled').map((order) => order.id);

    const procurement = submitProcurement(store, 'facility-build-self-cross-0022', now + 14);
    assert.equal(procurement.result.ok, false);
    assert.match(procurement.result.message, /资金不足/);
    const after = store.getState(buyerUser, now + 15);
    assert.deepEqual(
      after.orders.filter((order) => order.isOwn && order.side === 'sell' && order.status === 'filled').map((order) => order.id),
      completedSellIds,
    );
    assert.equal(after.frozenCredits, 0);
    assert.equal(after.inventories.timber.frozen, 0);
    assert.equal(after.inventories.ore.frozen, 0);
    assert.equal(openPlayerCommodityOrders(after).length, 0);
  } finally {
    store.close();
  }
});
