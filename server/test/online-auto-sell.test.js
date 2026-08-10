import assert from 'node:assert/strict';
import test from 'node:test';
import { applySettledCommodityOrder, createWorld, ensurePlayer } from '../src/domain.js';
import {
  migrateFacilityGroupWorld,
  productionReservedQuantitiesForPlayer,
} from '../src/facility-groups.js';
import {
  applyOnlineAutoSell,
  contractAvailableHoldForAutoSell,
} from '../src/online-auto-sell.js';
import { applyOnlineAutoSellPolicyAction } from '../src/online-auto-sell-policy.js';
import { isOpenOrder } from '../src/order-identity.js';
import { countOpenOrdersForOwner } from '../src/order-book-runtime.js';

const now = 1_700_000_000_000;
const alice = { id: 1, email: 'alice@example.com', name: 'Alice' };
const bob = { id: 2, email: 'bob@example.com', name: 'Bob' };

function addBuyOrder(world, buyer, productId, quantity, price, id = `buy-${productId}`) {
  const total = quantity * price;
  buyer.credits -= total;
  buyer.frozenCredits += total;
  world.orders.push({
    id,
    assetKind: 'commodity',
    assetId: productId,
    productId,
    side: 'buy',
    ownerType: 'player',
    ownerId: buyer.userId,
    ownerName: buyer.playerName,
    price,
    quantity,
    remaining: quantity,
    status: 'open',
    fills: [],
    createdAt: now + 1,
  });
}

function setAutoSellPolicy(world, user, productId, overrides = {}) {
  const result = applyOnlineAutoSellPolicyAction(world, user, {
    productId,
    enabled: true,
    price: 5,
    minimumFreeInventory: 0,
    ...overrides,
  });
  assert.equal(result.ok, true);
  return result;
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

function ownSellOrders(world, productId) {
  return world.orders.filter((order) => (
    Number(order.ownerId) === alice.id && order.productId === productId && order.side === 'sell'
  ));
}

test('online auto sell keeps one full enabled production cycle of inputs', () => {
  const world = createWorld(now);
  const seller = ensurePlayer(world, alice, now);
  const buyer = ensurePlayer(world, bob, now);
  seller.credits = 1_000;
  buyer.credits = 10_000;
  seller.inventories.plastic.available = 5;
  seller.inventories.copper.available = 2;
  seller.facilityGroups = [group('electronics-factory', 2, {
    enabled: true,
    status: 'running',
    participatingCount: 2,
    cycleStartedAt: now,
  })];
  migrateFacilityGroupWorld(world, now);
  setAutoSellPolicy(world, alice, 'plastic', { price: 50 });
  addBuyOrder(world, buyer, 'plastic', 10, 100);

  assert.equal(productionReservedQuantitiesForPlayer(world, alice.id).plastic, 2);
  const result = applyOnlineAutoSell(world, alice, { productId: 'plastic' }, now + 2);

  assert.equal(result.ok, true);
  assert.equal(seller.inventories.plastic.available, 2);
  assert.equal(seller.inventories.plastic.frozen, 0);
  assert.equal(seller.facilityGroups[0].status, 'running');
  const orders = ownSellOrders(world, 'plastic');
  assert.equal(orders.length, 1);
  assert.equal(orders[0].status, 'filled');
  assert.equal(orders[0].remaining, 0);
});

test('online auto sell preserves the unfrozen shortfall of an auto-reserved supply contract', () => {
  const world = createWorld(now);
  const seller = ensurePlayer(world, alice, now);
  const buyer = ensurePlayer(world, bob, now);
  buyer.credits = 10_000;
  seller.inventories.wheat.available = 9;
  seller.inventories.wheat.frozen = 1;
  world.productionContracts = [{
    id: 'supply-1',
    kind: 'supply',
    status: 'active',
    supplierId: alice.id,
    productId: 'wheat',
    quantityPerDelivery: 4,
    supplierReservedQuantity: 1,
    supplierAutoReserve: true,
    completedDeliveries: 0,
    totalDeliveries: 10,
  }];
  setAutoSellPolicy(world, alice, 'wheat');
  addBuyOrder(world, buyer, 'wheat', 10, 10);

  assert.equal(contractAvailableHoldForAutoSell(world, alice.id, 'wheat'), 3);
  const result = applyOnlineAutoSell(world, alice, { productId: 'wheat' }, now + 2);

  assert.equal(result.ok, true);
  assert.equal(seller.inventories.wheat.available, 3);
  assert.equal(seller.inventories.wheat.frozen, 1);
});

test('online auto sell preserves the next batch hold for a long-term supply contract', () => {
  const world = createWorld(now);
  const seller = ensurePlayer(world, alice, now);
  seller.inventories.wheat.available = 9;
  seller.inventories.wheat.frozen = 1;
  world.productionContracts = [{
    id: 'long-term-supply',
    kind: 'supply',
    status: 'active',
    supplierId: alice.id,
    productId: 'wheat',
    quantityPerDelivery: 4,
    supplierReservedQuantity: 1,
    supplierAutoReserve: true,
    completedDeliveries: 25,
    totalDeliveries: null,
  }];

  assert.equal(contractAvailableHoldForAutoSell(world, alice.id, 'wheat'), 3);
});

test('online auto sell leaves standing supply when no qualifying buyer exists', () => {
  const world = createWorld(now);
  const seller = ensurePlayer(world, alice, now);
  const buyer = ensurePlayer(world, bob, now);
  seller.inventories.wheat.available = 10;
  buyer.credits = 10_000;
  setAutoSellPolicy(world, alice, 'wheat');

  const result = applyOnlineAutoSell(world, alice, { productId: 'wheat' }, now + 1);

  assert.equal(result.ok, true);
  assert.match(result.message, /已挂出 10 个小麦/);
  assert.equal(seller.inventories.wheat.available, 0);
  assert.equal(seller.inventories.wheat.frozen, 10);
  const order = ownSellOrders(world, 'wheat').at(-1);
  assert.ok(order);
  assert.equal(order.status, 'open');
  assert.equal(order.remaining, 10);
  assert.equal(order.price, 5);
  assert.equal(seller.onlineAutoSellOrderIds.wheat, order.id);
  assert.equal(countOpenOrdersForOwner(world, alice.id), 0);

  const buy = applySettledCommodityOrder(world, bob, {
    assetKind: 'commodity',
    assetId: 'wheat',
    side: 'buy',
    quantity: 4,
    price: 6,
  }, now + 2);
  assert.equal(buy.ok, true);
  assert.equal(order.status, 'partial');
  assert.equal(order.remaining, 6);
  assert.equal(seller.inventories.wheat.frozen, 6);
});

test('own crossing buy blocks online auto sell instead of creating a self-cross', () => {
  const world = createWorld(now);
  const seller = ensurePlayer(world, alice, now);
  const buyer = ensurePlayer(world, bob, now);
  seller.credits = 1_000;
  buyer.credits = 1_000;
  seller.inventories.wheat.available = 10;
  setAutoSellPolicy(world, alice, 'wheat');
  addBuyOrder(world, seller, 'wheat', 1, 8, 'own-buy');
  addBuyOrder(world, buyer, 'wheat', 2, 8, 'external-buy');

  const result = applyOnlineAutoSell(world, alice, { productId: 'wheat' }, now + 2);

  assert.equal(result.ok, false);
  assert.match(result.message, /自己的买单/);
  assert.equal(seller.inventories.wheat.available, 10);
  assert.equal(ownSellOrders(world, 'wheat').length, 0);
  assert.equal(world.orders.filter((order) => isOpenOrder(order) && order.side === 'buy').length, 2);
});

test('online auto sell preserves minimum free inventory in addition to production and contract holds', () => {
  const world = createWorld(now);
  const seller = ensurePlayer(world, alice, now);
  const buyer = ensurePlayer(world, bob, now);
  buyer.credits = 10_000;
  seller.inventories.plastic.available = 20;
  seller.inventories.plastic.frozen = 1;
  seller.facilityGroups = [group('electronics-factory', 2, {
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
  setAutoSellPolicy(world, alice, 'plastic', { minimumFreeInventory: 5 });
  addBuyOrder(world, buyer, 'plastic', 20, 10);

  assert.equal(productionReservedQuantitiesForPlayer(world, alice.id).plastic, 2);
  assert.equal(contractAvailableHoldForAutoSell(world, alice.id, 'plastic'), 3);
  const result = applyOnlineAutoSell(world, alice, { productId: 'plastic' }, now + 2);

  assert.equal(result.ok, true);
  assert.equal(seller.inventories.plastic.available, 10);
  assert.equal(seller.inventories.plastic.frozen, 1);
});

test('online auto sell leaves the configured minimum free inventory untouched', () => {
  const world = createWorld(now);
  const seller = ensurePlayer(world, alice, now);
  const buyer = ensurePlayer(world, bob, now);
  buyer.credits = 10_000;
  seller.inventories.wheat.available = 5;
  setAutoSellPolicy(world, alice, 'wheat', { minimumFreeInventory: 5 });
  addBuyOrder(world, buyer, 'wheat', 10, 10);

  const result = applyOnlineAutoSell(world, alice, { productId: 'wheat' }, now + 2);

  assert.equal(result.ok, true);
  assert.match(result.message, /可自动挂单库存/);
  assert.equal(seller.inventories.wheat.available, 5);
  assert.equal(ownSellOrders(world, 'wheat').length, 0);
});

test('online auto sell policy rejects invalid minimum free inventory values', () => {
  const world = createWorld(now);
  ensurePlayer(world, alice, now);

  for (const minimumFreeInventory of [-1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
    const result = applyOnlineAutoSellPolicyAction(world, alice, {
      productId: 'wheat',
      enabled: true,
      price: 5,
      minimumFreeInventory,
    });
    assert.equal(result.ok, false);
    assert.match(result.message, /设置无效/);
  }
});

test('online auto sell execution ignores client thresholds and uses the saved standing price', () => {
  const world = createWorld(now);
  const seller = ensurePlayer(world, alice, now);
  const buyer = ensurePlayer(world, bob, now);
  buyer.credits = 10_000;
  seller.inventories.wheat.available = 8;
  setAutoSellPolicy(world, alice, 'wheat', { price: 9, minimumFreeInventory: 2 });
  addBuyOrder(world, buyer, 'wheat', 3, 8, 'below-saved-price');

  const result = applyOnlineAutoSell(world, alice, {
    productId: 'wheat',
    price: 1,
    minimumFreeInventory: 0,
  }, now + 2);

  assert.equal(result.ok, true);
  assert.equal(seller.inventories.wheat.available, 2);
  assert.equal(seller.inventories.wheat.frozen, 6);
  const order = ownSellOrders(world, 'wheat').at(-1);
  assert.ok(order);
  assert.equal(order.status, 'open');
  assert.equal(order.price, 9);
  assert.equal(order.remaining, 6);
});

test('changing an auto sell policy cancels the old standing order and releases its inventory', () => {
  const world = createWorld(now);
  const seller = ensurePlayer(world, alice, now);
  seller.inventories.wheat.available = 10;
  setAutoSellPolicy(world, alice, 'wheat', { price: 5 });
  const first = applyOnlineAutoSell(world, alice, { productId: 'wheat' }, now + 1);
  assert.equal(first.ok, true);
  const oldOrder = ownSellOrders(world, 'wheat').at(-1);
  assert.ok(oldOrder && isOpenOrder(oldOrder));

  setAutoSellPolicy(world, alice, 'wheat', { price: 6 });

  assert.equal(oldOrder.status, 'cancelled');
  assert.equal(seller.inventories.wheat.available, 10);
  assert.equal(seller.inventories.wheat.frozen, 0);
  assert.equal(seller.onlineAutoSellOrderIds?.wheat, undefined);

  const second = applyOnlineAutoSell(world, alice, { productId: 'wheat' }, now + 2);
  assert.equal(second.ok, true);
  const newOrder = ownSellOrders(world, 'wheat').at(-1);
  assert.notEqual(newOrder.id, oldOrder.id);
  assert.equal(newOrder.price, 6);
});

test('online auto sell requires an enabled saved policy', () => {
  const world = createWorld(now);
  const seller = ensurePlayer(world, alice, now);
  const buyer = ensurePlayer(world, bob, now);
  seller.inventories.wheat.available = 10;
  buyer.credits = 10_000;
  addBuyOrder(world, buyer, 'wheat', 10, 10);

  const missing = applyOnlineAutoSell(world, alice, { productId: 'wheat' }, now + 2);
  assert.equal(missing.ok, false);
  assert.match(missing.message, /未启用自动出售/);

  setAutoSellPolicy(world, alice, 'wheat', { enabled: false });
  const disabled = applyOnlineAutoSell(world, alice, { productId: 'wheat' }, now + 3);
  assert.equal(disabled.ok, false);
  assert.match(disabled.message, /未启用自动出售/);
});
