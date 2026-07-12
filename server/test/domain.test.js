import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyAction,
  createWorld,
  ensurePlayer,
  FACILITY_TYPE_CATALOG,
  migrateWorld,
  processWorld,
  PRODUCT_CATALOG,
} from '../src/domain.js';
import { EconomyStore } from '../src/storage.js';

const alice = { id: 1, email: 'alice@example.com', name: 'Alice' };
const bob = { id: 2, email: 'bob@example.com', name: 'Bob' };
const carol = { id: 3, email: 'carol@example.com', name: 'Carol' };
const now = 1_700_000_000_000;

test('different products never match in the same order book', () => {
  const world = createWorld(now);
  const seller = ensurePlayer(world, bob, now);
  const buyer = ensurePlayer(world, alice, now);
  seller.inventories.ore.available = 10;
  buyer.credits = 1_000;

  assert.equal(applyAction(world, bob, 'placeOrder', {
    productId: 'ore', side: 'sell', quantity: 5, price: 8,
  }, now + 1).ok, true);
  assert.equal(applyAction(world, alice, 'placeOrder', {
    productId: 'grain', side: 'buy', quantity: 5, price: 9,
  }, now + 2).ok, true);
  assert.equal(buyer.inventories.ore.available, 0);
  assert.equal(seller.inventories.ore.frozen, 5);

  assert.equal(applyAction(world, alice, 'placeOrder', {
    productId: 'ore', side: 'buy', quantity: 3, price: 9,
  }, now + 3).ok, true);
  assert.equal(buyer.inventories.ore.available, 3);
  assert.equal(seller.inventories.ore.frozen, 2);
});

test('work cooldown uses server time', () => {
  const world = createWorld(now);
  ensurePlayer(world, alice, now);
  assert.equal(applyAction(world, alice, 'work', {}, now).ok, true);
  assert.equal(applyAction(world, alice, 'work', {}, now + 1_000).ok, false);
  assert.equal(applyAction(world, alice, 'work', {}, now + 9_999).ok, false);
  assert.equal(applyAction(world, alice, 'work', {}, now + 10_000).ok, true);
});

test('version 1 state migrates inventory and commodity orders without losing assets', () => {
  const world = {
    version: 1,
    players: {
      '1': {
        userId: 1,
        playerName: 'Alice',
        registeredAt: now,
        credits: 100,
        frozenCredits: 0,
        inventory: 7,
        frozenInventory: 2,
        inventoryCapacity: 100,
        facilitySlots: 1,
        facilities: [],
        trades: [],
        ledger: [],
        work: { cooldownUntil: 0, lastWorkedAt: 0, streak: 0, totalClicks: 0 },
        stats: { workIssued: 0, populationIssued: 0, systemSinks: 0, commodityVolume: 0, facilityVolume: 0 },
      },
    },
    orders: [{
      id: 'legacy-order', side: 'buy', ownerType: 'market', ownerName: '市场',
      price: 5, quantity: 1, remaining: 1, status: 'open', createdAt: now,
    }],
    facilityListings: [],
    demand: { cycleMs: 300_000, nextDemandAt: now + 300_000, lastBudget: 10, lastQuantity: 2, lastPrice: 5, satisfaction: 1 },
    marketPrice: 7,
    marketPriceHistory: [{ price: 7, quantity: 1, createdAt: now }],
    lastProcessedAt: now,
  };

  migrateWorld(world, now);
  assert.equal(world.players['1'].inventories.grain.available, 7);
  assert.equal(world.players['1'].inventories.grain.frozen, 2);
  assert.equal(world.orders[0].productId, 'grain');
  assert.equal('facilitySlots' in world.players['1'], false);
});

test('idempotency returns the original response without applying an action twice', () => {
  const store = new EconomyStore(':memory:');
  try {
    const request = {
      action: 'work',
      payload: {},
      requestKey: 'request-12345678',
      method: 'POST',
      path: '/api/game/work',
    };
    const first = store.apply(alice, request, now);
    const second = store.apply(alice, request, now + 500);
    assert.deepEqual(second, first);
    assert.equal(store.getState(alice, now + 1_000).work.totalClicks, 1);
  } finally {
    store.close();
  }
});

test('client state uses version 11 and exposes no factory instances', () => {
  const store = new EconomyStore(':memory:');
  try {
    const state = store.getState(alice, now);
    assert.equal(state.version, 11);
    assert.equal(Array.isArray(state.facilityGroups), true);
    assert.equal(Object.hasOwn(state, 'facilities'), false);
    assert.equal(state.products.length, 12);
    assert.equal(state.facilityTypes.length, 12);
  } finally {
    store.close();
  }
});


test('expanded industry catalog exposes complete production chains', () => {
  assert.equal(PRODUCT_CATALOG.length, 12);
  assert.equal(FACILITY_TYPE_CATALOG.length, 12);

  const productIds = new Set(PRODUCT_CATALOG.map((product) => product.id));
  const facilityIds = new Set(FACILITY_TYPE_CATALOG.map((facility) => facility.id));
  assert.equal(productIds.size, PRODUCT_CATALOG.length);
  assert.equal(facilityIds.size, FACILITY_TYPE_CATALOG.length);

  for (const facility of FACILITY_TYPE_CATALOG) {
    assert.equal(productIds.has(facility.output.productId), true);
    if (facility.input) assert.equal(productIds.has(facility.input.productId), true);
  }

  const facilities = new Map(FACILITY_TYPE_CATALOG.map((facility) => [facility.id, facility]));
  assert.deepEqual(facilities.get('logging-camp').output, { productId: 'timber', quantity: 2 });
  assert.deepEqual(facilities.get('sawmill').input, { productId: 'timber', quantity: 2 });
  assert.deepEqual(facilities.get('sawmill').output, { productId: 'lumber', quantity: 1 });
  assert.deepEqual(facilities.get('oil-field').output, { productId: 'crude-oil', quantity: 2 });
  assert.deepEqual(facilities.get('refinery').input, { productId: 'crude-oil', quantity: 2 });
  assert.deepEqual(facilities.get('refinery').output, { productId: 'plastic', quantity: 1 });
  assert.deepEqual(facilities.get('furniture-factory').input, { productId: 'lumber', quantity: 2 });
  assert.deepEqual(facilities.get('furniture-factory').output, { productId: 'furniture', quantity: 2 });
  assert.deepEqual(facilities.get('electronics-factory').input, { productId: 'plastic', quantity: 2 });
  assert.deepEqual(facilities.get('electronics-factory').output, { productId: 'electronics', quantity: 1 });
});

test('existing worlds receive new inventories, markets, and liquidity without resetting assets', () => {
  const world = createWorld(now);
  const player = ensurePlayer(world, alice, now);
  player.credits = 777;
  player.inventories.grain.available = 9;
  const newProductIds = ['timber', 'crude-oil', 'lumber', 'plastic', 'furniture', 'electronics'];

  for (const productId of newProductIds) {
    delete player.inventories[productId];
    delete world.markets[productId];
  }
  world.orders = world.orders.filter((order) => !newProductIds.includes(order.productId));

  migrateWorld(world, now);
  processWorld(world, now + 1);

  assert.equal(player.credits, 777);
  assert.equal(player.inventories.grain.available, 9);
  for (const productId of newProductIds) {
    assert.deepEqual(player.inventories[productId], { available: 0, frozen: 0 });
    assert.equal(world.markets[productId].productId, productId);
    assert.equal(world.orders.some((order) => order.productId === productId && order.side === 'buy' && order.ownerType === 'market'), true);
    assert.equal(world.orders.some((order) => order.productId === productId && order.side === 'sell' && order.ownerType === 'market'), true);
  }
});

test('commodity order fills preserve every exact resting price', () => {
  const world = createWorld(now);
  world.orders = [];
  const buyer = ensurePlayer(world, alice, now);
  const sellerA = ensurePlayer(world, bob, now);
  const sellerB = ensurePlayer(world, carol, now);
  buyer.credits = 100;
  sellerA.inventories.grain.available = 1;
  sellerB.inventories.grain.available = 1;

  assert.equal(applyAction(world, bob, 'placeOrder', {
    productId: 'grain', side: 'sell', quantity: 1, price: 5,
  }, now + 1).ok, true);
  assert.equal(applyAction(world, carol, 'placeOrder', {
    productId: 'grain', side: 'sell', quantity: 1, price: 6,
  }, now + 2).ok, true);
  assert.equal(applyAction(world, alice, 'placeOrder', {
    productId: 'grain', side: 'buy', quantity: 2, price: 20,
  }, now + 3).ok, true);

  const buyOrder = world.orders.find((order) => order.ownerId === alice.id && order.side === 'buy');
  assert.deepEqual(
    buyOrder.fills.map((fill) => ({ price: fill.price, quantity: fill.quantity })),
    [{ price: 5, quantity: 1 }, { price: 6, quantity: 1 }],
  );
  assert.equal(buyer.credits, 89);
  assert.equal(buyer.frozenCredits, 0);
  assert.equal(buyer.inventories.grain.available, 2);
});
