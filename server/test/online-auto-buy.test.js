import assert from 'node:assert/strict';
import test from 'node:test';
import { createWorld, ensurePlayer } from '../src/domain.js';
import {
  migrateFacilityGroupWorld,
  productionReservedQuantitiesForPlayer,
} from '../src/facility-groups.js';
import { applyOnlineAutoBuy } from '../src/online-auto-buy.js';
import { isOpenOrder } from '../src/order-identity.js';
import { countOpenOrdersForOwner } from '../src/order-book-runtime.js';
import { applyOnlineAutoTradePolicyAction } from '../src/online-auto-trade-policy.js';
import { contractAvailableHoldForOnlineTrade } from '../src/online-auto-trade-reservations.js';

const now = 1_700_000_000_000;
const alice = { id: 1, email: 'alice@example.com', name: 'Alice' };
const bob = { id: 2, email: 'bob@example.com', name: 'Bob' };

function clearOrders(world) {
  world.orders = [];
}

function setAutoTradePolicy(world, user, productId, overrides = {}) {
  const buy = {
    enabled: true,
    maxPrice: 5,
    targetFreeInventory: 10,
    ...(overrides.buy || {}),
  };
  const sell = {
    enabled: false,
    price: 10,
    minimumFreeInventory: 20,
    ...(overrides.sell || {}),
  };
  const result = applyOnlineAutoTradePolicyAction(world, user, { productId, buy, sell });
  assert.equal(result.ok, true, result.message);
  return result;
}

function addSellOrder(world, seller, productId, quantity, price, id = `sell-${productId}`) {
  const inventory = seller.inventories[productId] ||= { available: 0, frozen: 0 };
  assert.ok(inventory.available >= quantity);
  inventory.available -= quantity;
  inventory.frozen += quantity;
  world.orders.push({
    id,
    assetKind: 'commodity',
    assetId: productId,
    productId,
    side: 'sell',
    ownerType: 'player',
    ownerId: seller.userId,
    ownerName: seller.playerName,
    price,
    quantity,
    remaining: quantity,
    status: 'open',
    fills: [],
    createdAt: now + 1,
  });
}

function ownBuyOrders(world, productId) {
  return world.orders.filter((order) => (
    Number(order.ownerId) === alice.id && order.productId === productId && order.side === 'buy'
  ));
}

function group(typeId, count, overrides = {}) {
  return {
    facilityTypeId: typeId,
    count,
    participatingCount: 0,
    enabled: false,
    status: 'stopped',
    statusReason: 'manual',
    activeRecipeId: `${typeId}-default`,
    lifetimeOutput: 0,
    ...overrides,
  };
}

test('online auto buy leaves a real standing buy order and does not consume the manual order quota', () => {
  const world = createWorld(now);
  clearOrders(world);
  const buyer = ensurePlayer(world, alice, now);
  buyer.credits = 100;
  setAutoTradePolicy(world, alice, 'wheat');

  const result = applyOnlineAutoBuy(world, alice, { productId: 'wheat' }, now + 1);

  assert.equal(result.ok, true);
  assert.match(result.message, /已挂出 10 个小麦的自动买单/);
  const order = ownBuyOrders(world, 'wheat').at(-1);
  assert.ok(order && isOpenOrder(order));
  assert.equal(order.price, 5);
  assert.equal(order.remaining, 10);
  assert.equal(buyer.credits, 50);
  assert.equal(buyer.frozenCredits, 50);
  assert.equal(buyer.onlineAutoBuyOrderIds.wheat, order.id);
  assert.equal(countOpenOrdersForOwner(world, alice.id), 0);
});

test('online auto buy fills qualifying sell orders and leaves the remaining demand standing', () => {
  const world = createWorld(now);
  clearOrders(world);
  const buyer = ensurePlayer(world, alice, now);
  const seller = ensurePlayer(world, bob, now);
  buyer.credits = 100;
  seller.inventories.wheat.available = 4;
  addSellOrder(world, seller, 'wheat', 4, 4);
  setAutoTradePolicy(world, alice, 'wheat');

  const result = applyOnlineAutoBuy(world, alice, { productId: 'wheat' }, now + 2);

  assert.equal(result.ok, true);
  assert.match(result.message, /自动采购 4 个小麦/);
  const order = ownBuyOrders(world, 'wheat').at(-1);
  assert.ok(order);
  assert.equal(order.status, 'partial');
  assert.equal(order.remaining, 6);
  assert.equal(buyer.inventories.wheat.available, 4);
  assert.equal(buyer.onlineAutoBuyOrderIds.wheat, order.id);
});

test('online auto buy replenishes production and contract holds before target free inventory', () => {
  const world = createWorld(now);
  clearOrders(world);
  const buyer = ensurePlayer(world, alice, now);
  buyer.credits = 1_000;
  buyer.inventories.plastic.available = 4;
  buyer.facilityGroups = [group('electronics-factory', 2, {
    enabled: true,
    status: 'running',
    participatingCount: 2,
    cycleStartedAt: now,
  })];
  world.productionContracts = [{
    id: 'supply-plastic',
    kind: 'supply',
    status: 'active',
    supplierId: alice.id,
    productId: 'plastic',
    quantityPerDelivery: 4,
    supplierReservedQuantity: 1,
    supplierAutoReserve: true,
    completedDeliveries: 0,
    totalDeliveries: 10,
  }];
  migrateFacilityGroupWorld(world, now);
  setAutoTradePolicy(world, alice, 'plastic', {
    buy: { targetFreeInventory: 5 },
  });

  assert.equal(productionReservedQuantitiesForPlayer(world, alice.id).plastic, 2);
  assert.equal(contractAvailableHoldForOnlineTrade(world, alice.id, 'plastic'), 3);
  const result = applyOnlineAutoBuy(world, alice, { productId: 'plastic' }, now + 2);

  assert.equal(result.ok, true);
  const order = ownBuyOrders(world, 'plastic').at(-1);
  assert.ok(order && isOpenOrder(order));
  assert.equal(order.remaining, 6);
});

test('online auto buy keeps the same order when available funds still cap the same target', () => {
  const world = createWorld(now);
  clearOrders(world);
  const buyer = ensurePlayer(world, alice, now);
  buyer.credits = 100;
  setAutoTradePolicy(world, alice, 'wheat', {
    buy: { targetFreeInventory: 100 },
  });

  const first = applyOnlineAutoBuy(world, alice, { productId: 'wheat' }, now + 1);
  assert.equal(first.ok, true);
  const order = ownBuyOrders(world, 'wheat').at(-1);
  assert.ok(order && isOpenOrder(order));
  assert.equal(order.remaining, 20);
  assert.equal(buyer.credits, 0);
  const createdAt = order.createdAt;

  const second = applyOnlineAutoBuy(world, alice, { productId: 'wheat' }, now + 2);
  assert.equal(second.ok, true);
  assert.match(second.message, /可用资金限制/);
  assert.equal(ownBuyOrders(world, 'wheat').filter(isOpenOrder).length, 1);
  assert.equal(order.createdAt, createdAt);
  assert.equal(order.status, 'open');
});

test('own crossing sell cancels the managed auto buy and releases its frozen credits', () => {
  const world = createWorld(now);
  clearOrders(world);
  const buyer = ensurePlayer(world, alice, now);
  buyer.credits = 100;
  buyer.inventories.wheat.available = 1;
  setAutoTradePolicy(world, alice, 'wheat');
  const first = applyOnlineAutoBuy(world, alice, { productId: 'wheat' }, now + 1);
  assert.equal(first.ok, true);
  const managed = ownBuyOrders(world, 'wheat').at(-1);
  assert.ok(managed && isOpenOrder(managed));
  assert.equal(buyer.frozenCredits, 45);

  addSellOrder(world, buyer, 'wheat', 1, 4, 'own-crossing-sell');
  const result = applyOnlineAutoBuy(world, alice, { productId: 'wheat' }, now + 2);

  assert.equal(result.ok, false);
  assert.match(result.message, /自己的卖单/);
  assert.equal(managed.status, 'cancelled');
  assert.equal(buyer.frozenCredits, 0);
  assert.equal(buyer.onlineAutoBuyOrderIds?.wheat, undefined);
});

test('online auto buy execution ignores client thresholds and uses the saved policy', () => {
  const world = createWorld(now);
  clearOrders(world);
  const buyer = ensurePlayer(world, alice, now);
  buyer.credits = 100;
  setAutoTradePolicy(world, alice, 'wheat', {
    buy: { maxPrice: 5, targetFreeInventory: 10 },
  });

  const result = applyOnlineAutoBuy(world, alice, {
    productId: 'wheat',
    maxPrice: 1,
    targetFreeInventory: 1,
  }, now + 1);

  assert.equal(result.ok, true);
  const order = ownBuyOrders(world, 'wheat').at(-1);
  assert.ok(order);
  assert.equal(order.price, 5);
  assert.equal(order.remaining, 10);
});

test('atomic auto trade policy rejects overlapping inventory or price bands', () => {
  const world = createWorld(now);
  ensurePlayer(world, alice, now);

  const inventoryConflict = applyOnlineAutoTradePolicyAction(world, alice, {
    productId: 'wheat',
    buy: { enabled: true, maxPrice: 5, targetFreeInventory: 20 },
    sell: { enabled: true, price: 10, minimumFreeInventory: 10 },
  });
  assert.equal(inventoryConflict.ok, false);
  assert.match(inventoryConflict.message, /目标自由库存/);

  const priceConflict = applyOnlineAutoTradePolicyAction(world, alice, {
    productId: 'wheat',
    buy: { enabled: true, maxPrice: 10, targetFreeInventory: 10 },
    sell: { enabled: true, price: 10, minimumFreeInventory: 20 },
  });
  assert.equal(priceConflict.ok, false);
  assert.match(priceConflict.message, /最高自动采购价格/);
});

test('changing the auto buy side atomically cancels its old standing order without disturbing sell settings', () => {
  const world = createWorld(now);
  clearOrders(world);
  const buyer = ensurePlayer(world, alice, now);
  buyer.credits = 100;
  setAutoTradePolicy(world, alice, 'wheat', {
    sell: { enabled: true, price: 10, minimumFreeInventory: 20 },
  });
  const first = applyOnlineAutoBuy(world, alice, { productId: 'wheat' }, now + 1);
  assert.equal(first.ok, true);
  const oldOrder = ownBuyOrders(world, 'wheat').at(-1);
  assert.ok(oldOrder && isOpenOrder(oldOrder));

  const changed = applyOnlineAutoTradePolicyAction(world, alice, {
    productId: 'wheat',
    buy: { enabled: true, maxPrice: 4, targetFreeInventory: 10 },
    sell: { enabled: true, price: 10, minimumFreeInventory: 20 },
  });

  assert.equal(changed.ok, true);
  assert.equal(oldOrder.status, 'cancelled');
  assert.equal(buyer.frozenCredits, 0);
  assert.equal(buyer.onlineAutoBuyOrderIds?.wheat, undefined);
  assert.equal(buyer.onlineAutoSellPolicies.wheat.enabled, true);
  assert.equal(buyer.onlineAutoSellPolicies.wheat.price, 10);
});
