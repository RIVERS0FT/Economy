import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyAction,
  createWorld,
  ensurePlayer,
  migrateWorld,
} from '../src/domain.js';
import { DEFAULT_PROVINCE_ID, provinceScopedKey } from '../src/provinces.js';

const now = 1_700_000_000_000;
const alice = { id: 1, email: 'alice@example.com', name: 'Alice' };
const bob = { id: 2, email: 'bob@example.com', name: 'Bob' };

function deferDemand(world, until = now + 60 * 60 * 1000) {
  for (const state of Object.values(world.demandGroups || {})) state.nextDemandAt = until;
}

test('commodity sell executes once at the daily price without creating a resting order or freeze', () => {
  const world = createWorld(now);
  deferDemand(world);
  world.orders = [];
  const seller = ensurePlayer(world, bob, now);
  seller.credits = 0;
  seller.inventories.wheat.available = 4;
  seller.inventories.wheat.frozen = 0;
  const market = world.markets[provinceScopedKey(DEFAULT_PROVINCE_ID, 'wheat')];
  market.officialPrice = 1;

  const response = applyAction(world, bob, 'placeOrder', {
    assetKind: 'commodity',
    assetId: 'wheat',
    productId: 'wheat',
    provinceId: DEFAULT_PROVINCE_ID,
    side: 'sell',
    quantity: 2,
    price: 1_000_000,
  }, now + 1);

  assert.equal(response.ok, true);
  assert.equal(response.executedPrice, 1);
  assert.equal(response.quantity, 2);
  assert.equal(seller.inventories.wheat.available, 2);
  assert.equal(seller.inventories.wheat.frozen, 0);
  assert.equal(seller.credits, 1.98);
  const playerOrders = world.orders.filter((order) => order.ownerType === 'player');
  assert.equal(playerOrders.length, 1);
  assert.equal(playerOrders[0].status, 'filled');
  assert.equal(playerOrders[0].remaining, 0);
  assert.equal(world.orders.some((order) => order.ownerType === 'player' && ['open', 'partial'].includes(order.status)), false);
});

test('legacy player commodity migration cancels resting orders and releases frozen assets exactly once', () => {
  const world = createWorld(now);
  deferDemand(world);
  world.orders = [];
  const buyer = ensurePlayer(world, alice, now);
  const seller = ensurePlayer(world, bob, now);
  buyer.credits = 0;
  buyer.frozenCredits = 10;
  seller.credits = 0;
  seller.inventories.wheat.available = 0;
  seller.inventories.wheat.frozen = 1;
  world.playerCommodityInstantTradeVersion = 0;
  world.orders.push(
    {
      id: 'buy-order', provinceId: DEFAULT_PROVINCE_ID, assetKind: 'commodity', assetId: 'wheat', productId: 'wheat',
      side: 'buy', ownerType: 'player', ownerId: alice.id, price: 10, quantity: 1, remaining: 1,
      status: 'open', fills: [], createdAt: now,
    },
    {
      id: 'sell-order', provinceId: DEFAULT_PROVINCE_ID, assetKind: 'commodity', assetId: 'wheat', productId: 'wheat',
      side: 'sell', ownerType: 'player', ownerId: bob.id, price: 10, quantity: 1, remaining: 1,
      status: 'open', fills: [], createdAt: now + 1,
    },
  );

  migrateWorld(world, now + 2);
  assert.deepEqual(world.orders.map((order) => order.status), ['cancelled', 'cancelled']);
  assert.equal(buyer.frozenCredits, 0);
  assert.equal(buyer.credits, 10);
  assert.equal(seller.inventories.wheat.frozen, 0);
  assert.equal(seller.inventories.wheat.available, 1);
  assert.equal(world.playerCommodityInstantTradeVersion, 1);

  migrateWorld(world, now + 3);
  assert.equal(buyer.credits, 10);
  assert.equal(seller.inventories.wheat.available, 1);
});
