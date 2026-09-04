import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyAction,
  createWorld,
  ensurePlayer,
  FACILITY_TYPE_CATALOG,
  migrateWorld,
} from '../src/domain.js';
import { applyFacilityGroupAction } from '../src/facility-groups.js';
import { DEFAULT_PROVINCE_ID, provinceScopedKey } from '../src/provinces.js';

const now = 1_700_000_000_000;
const alice = { id: 1, email: 'alice@example.com', name: 'Alice' };
const bob = { id: 2, email: 'bob@example.com', name: 'Bob' };

function deferDemand(world) {
  for (const state of Object.values(world.demandGroups)) state.nextDemandAt = now + 60 * 60 * 1000;
}

test('same player buy and sell both execute immediately against the system without a self-cross order state', () => {
  const world = createWorld(now);
  deferDemand(world);
  const player = ensurePlayer(world, alice, now);
  player.credits = 1_000;
  player.inventories.wheat.available = 3;
  world.markets[provinceScopedKey(DEFAULT_PROVINCE_ID, 'wheat')].officialPrice = 1;

  const sell = applyAction(world, alice, 'placeOrder', {
    productId: 'wheat', side: 'sell', quantity: 2, price: 10,
  }, now + 1);
  const buy = applyAction(world, alice, 'placeOrder', {
    productId: 'wheat', side: 'buy', quantity: 1, price: 0.01,
  }, now + 2);

  assert.equal(sell.ok, true);
  assert.equal(buy.ok, true);
  assert.equal(sell.executedPrice, 1);
  assert.equal(buy.executedPrice, 1);
  assert.equal(player.inventories.wheat.available, 2);
  assert.equal(player.inventories.wheat.frozen, 0);
  assert.equal(player.frozenCredits, 0);
  const own = world.orders.filter((order) => order.ownerType === 'player' && order.ownerId === alice.id && order.productId === 'wheat');
  assert.equal(own.length, 2);
  assert.ok(own.every((order) => order.status === 'filled' && order.remaining === 0));
});

test('factory direct orders are rejected before freezing funds or facilities', () => {
  const world = createWorld(now);
  deferDemand(world);
  const player = ensurePlayer(world, alice, now);
  const farm = FACILITY_TYPE_CATALOG.find((type) => type.id === 'farm');
  assert.ok(farm);
  player.credits = 100_000;
  player.facilityGroups = [{ facilityTypeId: farm.id, count: 1 }];

  const creditsBefore = player.credits;
  const frozenCreditsBefore = player.frozenCredits;
  const orderCountBefore = world.orders.length;
  const sell = applyFacilityGroupAction(world, alice, 'placeOrder', {
    assetKind: 'facility', assetId: farm.id, side: 'sell', quantity: 1, price: farm.systemValue,
  }, now + 1);
  const buy = applyFacilityGroupAction(world, alice, 'placeOrder', {
    assetKind: 'facility', assetId: farm.id, side: 'buy', quantity: 1, price: farm.systemValue,
  }, now + 2);

  assert.deepEqual(sell, { ok: false, message: '工厂资产仅允许通过拍卖交易' });
  assert.deepEqual(buy, { ok: false, message: '工厂资产仅允许通过拍卖交易' });
  assert.equal(player.credits, creditsBefore);
  assert.equal(player.frozenCredits, frozenCreditsBefore);
  assert.equal(player.facilityGroups[0].count, 1);
  assert.equal(world.orders.length, orderCountBefore);
});

test('migration cancels crossed legacy commodity orders from different players and releases both sides', () => {
  const world = createWorld(now);
  deferDemand(world);
  const seller = ensurePlayer(world, alice, now);
  const buyer = ensurePlayer(world, bob, now);
  world.orders = [];
  world.playerCommodityInstantTradeVersion = 0;
  seller.credits = 100;
  seller.inventories.wheat.available = 0;
  seller.inventories.wheat.frozen = 1;
  buyer.credits = 88;
  buyer.frozenCredits = 12;
  buyer.inventories.wheat.available = 0;
  world.orders.push(
    {
      id: 'legacy-sell', provinceId: DEFAULT_PROVINCE_ID, assetKind: 'commodity', assetId: 'wheat', productId: 'wheat',
      side: 'sell', ownerType: 'player', ownerId: alice.id, ownerName: 'Alice',
      price: 10, quantity: 1, remaining: 1, status: 'open', createdAt: now + 1, fills: [],
    },
    {
      id: 'legacy-buy', provinceId: DEFAULT_PROVINCE_ID, assetKind: 'commodity', assetId: 'wheat', productId: 'wheat',
      side: 'buy', ownerType: 'player', ownerId: bob.id, ownerName: 'Bob',
      price: 12, quantity: 1, remaining: 1, status: 'open', createdAt: now + 2, fills: [],
    },
  );

  migrateWorld(world, now + 3);

  assert.equal(world.orders.find((order) => order.id === 'legacy-sell').status, 'cancelled');
  assert.equal(world.orders.find((order) => order.id === 'legacy-buy').status, 'cancelled');
  assert.equal(seller.inventories.wheat.frozen, 0);
  assert.equal(seller.inventories.wheat.available, 1);
  assert.equal(seller.credits, 100);
  assert.equal(buyer.frozenCredits, 0);
  assert.equal(buyer.credits, 100);
  assert.equal(buyer.inventories.wheat.available, 0);
});

test('migration cancels both sides of a legacy self-cross and releases all frozen assets', () => {
  const world = createWorld(now);
  deferDemand(world);
  const player = ensurePlayer(world, alice, now);
  world.orders = [];
  world.playerCommodityInstantTradeVersion = 0;
  player.credits = 90;
  player.frozenCredits = 10;
  player.inventories.wheat.available = 0;
  player.inventories.wheat.frozen = 1;
  world.orders.push(
    {
      id: 'own-sell-older', provinceId: DEFAULT_PROVINCE_ID, assetKind: 'commodity', assetId: 'wheat', productId: 'wheat',
      side: 'sell', ownerType: 'player', ownerId: alice.id, ownerName: 'Alice',
      price: 10, quantity: 1, remaining: 1, status: 'open', createdAt: now + 1, fills: [],
    },
    {
      id: 'own-buy-newer', provinceId: DEFAULT_PROVINCE_ID, assetKind: 'commodity', assetId: 'wheat', productId: 'wheat',
      side: 'buy', ownerType: 'player', ownerId: alice.id, ownerName: 'Alice',
      price: 10, quantity: 1, remaining: 1, status: 'open', createdAt: now + 2, fills: [],
    },
  );

  migrateWorld(world, now + 3);

  assert.equal(world.orders.find((order) => order.id === 'own-sell-older').status, 'cancelled');
  assert.equal(world.orders.find((order) => order.id === 'own-buy-newer').status, 'cancelled');
  assert.equal(player.credits, 100);
  assert.equal(player.frozenCredits, 0);
  assert.equal(player.inventories.wheat.frozen, 0);
  assert.equal(player.inventories.wheat.available, 1);
});
