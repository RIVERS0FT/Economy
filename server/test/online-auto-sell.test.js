import assert from 'node:assert/strict';
import test from 'node:test';
import { createWorld, ensurePlayer } from '../src/domain.js';
import {
  migrateFacilityGroupWorld,
  productionReservedQuantitiesForPlayer,
} from '../src/facility-groups.js';
import {
  applyOnlineAutoSell,
  contractAvailableHoldForAutoSell,
} from '../src/online-auto-sell.js';
import { isOpenOrder } from '../src/order-identity.js';

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
  addBuyOrder(world, buyer, 'plastic', 10, 100);

  assert.equal(productionReservedQuantitiesForPlayer(world, alice.id).plastic, 2);
  const result = applyOnlineAutoSell(world, alice, {
    productId: 'plastic',
    price: 50,
  }, now + 2);

  assert.equal(result.ok, true);
  assert.equal(seller.inventories.plastic.available, 2);
  assert.equal(seller.inventories.plastic.frozen, 0);
  assert.equal(seller.facilityGroups[0].status, 'running');
  const ownAutoOrders = world.orders.filter((order) => (
    Number(order.ownerId) === alice.id && order.productId === 'plastic' && order.side === 'sell'
  ));
  assert.equal(ownAutoOrders.length, 1);
  assert.equal(ownAutoOrders[0].status, 'filled');
  assert.equal(ownAutoOrders[0].remaining, 0);
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
  addBuyOrder(world, buyer, 'wheat', 10, 10);

  assert.equal(contractAvailableHoldForAutoSell(world, alice.id, 'wheat'), 3);
  const result = applyOnlineAutoSell(world, alice, {
    productId: 'wheat',
    price: 5,
  }, now + 2);

  assert.equal(result.ok, true);
  assert.equal(seller.inventories.wheat.available, 3);
  assert.equal(seller.inventories.wheat.frozen, 1);
});

test('online auto sell leaves no standing sell order when qualifying demand disappears', () => {
  const world = createWorld(now);
  const seller = ensurePlayer(world, alice, now);
  seller.inventories.wheat.available = 10;
  const beforeOrders = world.orders.length;

  const result = applyOnlineAutoSell(world, alice, {
    productId: 'wheat',
    price: 5,
  }, now + 1);

  assert.equal(result.ok, false);
  assert.equal(world.orders.length, beforeOrders);
  assert.equal(seller.inventories.wheat.available, 10);
  assert.equal(seller.inventories.wheat.frozen, 0);
});

test('own crossing buy blocks online auto sell instead of creating a self-cross', () => {
  const world = createWorld(now);
  const seller = ensurePlayer(world, alice, now);
  const buyer = ensurePlayer(world, bob, now);
  seller.credits = 1_000;
  buyer.credits = 1_000;
  seller.inventories.wheat.available = 10;
  addBuyOrder(world, seller, 'wheat', 1, 8, 'own-buy');
  addBuyOrder(world, buyer, 'wheat', 2, 8, 'external-buy');

  const result = applyOnlineAutoSell(world, alice, {
    productId: 'wheat',
    price: 5,
  }, now + 2);

  assert.equal(result.ok, false);
  assert.match(result.message, /自己的买单/);
  assert.equal(seller.inventories.wheat.available, 10);
  assert.equal(world.orders.filter((order) => Number(order.ownerId) === alice.id && order.side === 'sell').length, 0);
  assert.equal(world.orders.filter((order) => isOpenOrder(order) && order.side === 'buy').length, 2);
});
