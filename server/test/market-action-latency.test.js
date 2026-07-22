import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyAction,
  createWorld,
  ensurePlayer,
  migrateWorld,
} from '../src/domain.js';

const now = 1_700_000_000_000;
const alice = { id: 1, email: 'alice@example.com', name: 'Alice' };
const bob = { id: 2, email: 'bob@example.com', name: 'Bob' };

function deferDemand(world, until = now + 60 * 60 * 1000) {
  for (const state of Object.values(world.demandGroups || {})) state.nextDemandAt = until;
}

test('commodity sell order is created once and frozen once', () => {
  const world = createWorld(now);
  deferDemand(world);
  world.orders = [];
  const seller = ensurePlayer(world, bob, now);
  seller.inventories.wheat.available = 4;
  seller.inventories.wheat.frozen = 0;

  const response = applyAction(world, bob, 'placeOrder', {
    assetKind: 'commodity',
    assetId: 'wheat',
    productId: 'wheat',
    side: 'sell',
    quantity: 2,
    price: 1_000_000,
  }, now + 1);

  assert.equal(response.ok, true);
  const playerOrders = world.orders.filter((order) => order.ownerType === 'player');
  assert.equal(playerOrders.length, 1);
  assert.equal(playerOrders[0].assetKind, 'commodity');
  assert.equal(playerOrders[0].assetId, 'wheat');
  assert.equal(playerOrders[0].quantity, 2);
  assert.equal(playerOrders[0].remaining, 2);
  assert.equal(seller.inventories.wheat.available, 2);
  assert.equal(seller.inventories.wheat.frozen, 2);
});

test('commodity order-book repair runs only when the persisted integrity version is stale', () => {
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
  world.orders.push(
    {
      id: 'buy-order',
      assetKind: 'commodity',
      assetId: 'wheat',
      productId: 'wheat',
      side: 'buy',
      ownerType: 'player',
      ownerId: alice.id,
      ownerName: 'Alice',
      price: 10,
      quantity: 1,
      remaining: 1,
      status: 'open',
      fills: [],
      createdAt: now,
    },
    {
      id: 'sell-order',
      assetKind: 'commodity',
      assetId: 'wheat',
      productId: 'wheat',
      side: 'sell',
      ownerType: 'player',
      ownerId: bob.id,
      ownerName: 'Bob',
      price: 10,
      quantity: 1,
      remaining: 1,
      status: 'open',
      fills: [],
      createdAt: now + 1,
    },
  );

  world.orderBookIntegrityVersion = 1;
  migrateWorld(world, now + 2);
  assert.deepEqual(world.orders.filter((order) => order.ownerType === 'player').map((order) => order.status), ['open', 'open']);

  world.orderBookIntegrityVersion = 0;
  migrateWorld(world, now + 3);
  const repaired = world.orders.filter((order) => order.ownerType === 'player');
  assert.deepEqual(repaired.map((order) => order.status), ['filled', 'filled']);
  assert.equal(world.orderBookIntegrityVersion, 1);
  assert.equal(buyer.frozenCredits, 0);
  assert.equal(buyer.inventories.wheat.available, 1);
  assert.equal(seller.inventories.wheat.frozen, 0);
  assert.equal(seller.credits, 10);
});
