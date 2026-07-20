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
import { SELF_CROSS_MESSAGE } from '../src/order-book-integrity.js';

const now = 1_700_000_000_000;
const alice = { id: 1, email: 'alice@example.com', name: 'Alice' };
const bob = { id: 2, email: 'bob@example.com', name: 'Bob' };

function deferDemand(world) {
  for (const state of Object.values(world.demandGroups)) state.nextDemandAt = now + 60 * 60 * 1000;
}

test('commodity orders reject a price that crosses the same player resting order before freezing assets', () => {
  const world = createWorld(now);
  deferDemand(world);
  const player = ensurePlayer(world, alice, now);
  player.credits = 1_000;
  player.inventories.wheat.available = 3;

  const sell = applyAction(world, alice, 'placeOrder', {
    productId: 'wheat', side: 'sell', quantity: 2, price: 10,
  }, now + 1);
  assert.equal(sell.ok, true);
  assert.equal(player.inventories.wheat.available, 1);
  assert.equal(player.inventories.wheat.frozen, 2);

  const creditsBefore = player.credits;
  const frozenCreditsBefore = player.frozenCredits;
  const orderCountBefore = world.orders.length;
  const buy = applyAction(world, alice, 'placeOrder', {
    productId: 'wheat', side: 'buy', quantity: 1, price: 10,
  }, now + 2);

  assert.deepEqual(buy, { ok: false, message: SELF_CROSS_MESSAGE });
  assert.equal(player.credits, creditsBefore);
  assert.equal(player.frozenCredits, frozenCreditsBefore);
  assert.equal(world.orders.length, orderCountBefore);
});

test('facility orders reject a price that crosses the same player resting order before freezing funds', () => {
  const world = createWorld(now);
  deferDemand(world);
  const player = ensurePlayer(world, alice, now);
  const farm = FACILITY_TYPE_CATALOG.find((type) => type.id === 'farm');
  assert.ok(farm);
  player.credits = 100_000;
  player.facilityGroups = [{ facilityTypeId: farm.id, count: 1 }];

  const sell = applyFacilityGroupAction(world, alice, 'placeOrder', {
    assetKind: 'facility', assetId: farm.id, side: 'sell', quantity: 1, price: farm.systemValue,
  }, now + 1);
  assert.equal(sell.ok, true);

  const creditsBefore = player.credits;
  const frozenCreditsBefore = player.frozenCredits;
  const orderCountBefore = world.orders.length;
  const buy = applyFacilityGroupAction(world, alice, 'placeOrder', {
    assetKind: 'facility', assetId: farm.id, side: 'buy', quantity: 1, price: farm.systemValue,
  }, now + 2);

  assert.deepEqual(buy, { ok: false, message: SELF_CROSS_MESSAGE });
  assert.equal(player.credits, creditsBefore);
  assert.equal(player.frozenCredits, frozenCreditsBefore);
  assert.equal(world.orders.length, orderCountBefore);
});

test('migration immediately settles legacy crossed commodity orders from different players at maker price', () => {
  const world = createWorld(now);
  deferDemand(world);
  const seller = ensurePlayer(world, alice, now);
  const buyer = ensurePlayer(world, bob, now);
  world.orders = [];
  seller.credits = 100;
  seller.inventories.wheat.available = 0;
  seller.inventories.wheat.frozen = 1;
  buyer.credits = 88;
  buyer.frozenCredits = 12;
  buyer.inventories.wheat.available = 0;
  world.orders.push(
    {
      id: 'legacy-sell', assetKind: 'commodity', assetId: 'wheat', productId: 'wheat',
      side: 'sell', ownerType: 'player', ownerId: alice.id, ownerName: 'Alice',
      price: 10, quantity: 1, remaining: 1, status: 'open', createdAt: now + 1, fills: [],
    },
    {
      id: 'legacy-buy', assetKind: 'commodity', assetId: 'wheat', productId: 'wheat',
      side: 'buy', ownerType: 'player', ownerId: bob.id, ownerName: 'Bob',
      price: 12, quantity: 1, remaining: 1, status: 'open', createdAt: now + 2, fills: [],
    },
  );

  migrateWorld(world, now + 3);

  assert.equal(world.orders.find((order) => order.id === 'legacy-sell').status, 'filled');
  assert.equal(world.orders.find((order) => order.id === 'legacy-buy').status, 'filled');
  assert.equal(world.orders.find((order) => order.id === 'legacy-buy').fills[0].price, 10);
  assert.equal(seller.inventories.wheat.frozen, 0);
  assert.equal(seller.credits, 109);
  assert.equal(seller.stats.systemSinks, 1);
  assert.equal(buyer.frozenCredits, 0);
  assert.equal(buyer.credits, 90);
  assert.equal(buyer.inventories.wheat.available, 1);
});

test('migration cancels the newer legacy self-crossing commodity order and releases its frozen funds', () => {
  const world = createWorld(now);
  deferDemand(world);
  const player = ensurePlayer(world, alice, now);
  world.orders = [];
  player.credits = 90;
  player.frozenCredits = 10;
  player.inventories.wheat.available = 0;
  player.inventories.wheat.frozen = 1;
  world.orders.push(
    {
      id: 'own-sell-older', assetKind: 'commodity', assetId: 'wheat', productId: 'wheat',
      side: 'sell', ownerType: 'player', ownerId: alice.id, ownerName: 'Alice',
      price: 10, quantity: 1, remaining: 1, status: 'open', createdAt: now + 1, fills: [],
    },
    {
      id: 'own-buy-newer', assetKind: 'commodity', assetId: 'wheat', productId: 'wheat',
      side: 'buy', ownerType: 'player', ownerId: alice.id, ownerName: 'Alice',
      price: 10, quantity: 1, remaining: 1, status: 'open', createdAt: now + 2, fills: [],
    },
  );

  migrateWorld(world, now + 3);

  assert.equal(world.orders.find((order) => order.id === 'own-sell-older').status, 'open');
  assert.equal(world.orders.find((order) => order.id === 'own-buy-newer').status, 'cancelled');
  assert.equal(player.credits, 100);
  assert.equal(player.frozenCredits, 0);
  assert.equal(player.inventories.wheat.frozen, 1);
});
