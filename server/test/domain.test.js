import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyAction,
  createWorld,
  ensurePlayer,
  FACILITY_TYPE_CATALOG,
  MARKET_DEMAND_GROUP_CATALOG,
  migrateWorld,
  processPriceTransmission,
  processWorld,
  PRODUCT_CATALOG,
} from '../src/domain.js';
import { EconomyStore } from '../src/storage.js';

const alice = { id: 1, email: 'alice@example.com', name: 'Alice' };
const bob = { id: 2, email: 'bob@example.com', name: 'Bob' };
const carol = { id: 3, email: 'carol@example.com', name: 'Carol' };
const now = 1_700_000_000_000;
const cycleMs = 5 * 60 * 1000;

function prepareDemand(world, groupId, at = now) {
  world.demandGroups[groupId].nextDemandAt = at;
  world.demandGroups[groupId].lastCycleId = Math.floor(at / cycleMs) - 1;
}

function deferDemand(world, at = now + cycleMs) {
  for (const state of Object.values(world.demandGroups)) state.nextDemandAt = at;
}

test('different products never match and work cooldown uses server time', () => {
  const world = createWorld(now);
  deferDemand(world);
  const seller = ensurePlayer(world, bob, now);
  const buyer = ensurePlayer(world, alice, now);
  seller.inventories.ore.available = 10;
  buyer.credits = 1_000;
  assert.equal(applyAction(world, bob, 'placeOrder', { productId: 'ore', side: 'sell', quantity: 5, price: 6 }, now + 1).ok, true);
  assert.equal(applyAction(world, alice, 'placeOrder', { productId: 'wheat', side: 'buy', quantity: 5, price: 9 }, now + 2).ok, true);
  assert.equal(buyer.inventories.ore.available, 0);
  assert.equal(applyAction(world, alice, 'placeOrder', { productId: 'ore', side: 'buy', quantity: 3, price: 9 }, now + 3).ok, true);
  assert.equal(buyer.inventories.ore.available, 3);
  assert.equal(applyAction(world, alice, 'work', {}, now + 4).ok, true);
  assert.equal(applyAction(world, alice, 'work', {}, now + 5_000).ok, false);
  assert.equal(applyAction(world, alice, 'work', {}, now + 10_004).ok, true);
});

test('legacy grain assets migrate entirely to wheat and install market demand state', () => {
  const world = createWorld(now);
  const player = ensurePlayer(world, alice, now);
  world.version = 7;
  delete world.marketDemand;
  player.inventories.grain = { available: 7, frozen: 3 };
  delete player.inventories.wheat;
  world.markets.grain = { ...world.markets.wheat, productId: 'grain' };
  delete world.markets.wheat;
  world.orders = [{
    id: 'legacy-grain-sell', assetKind: 'commodity', assetId: 'grain', productId: 'grain',
    side: 'sell', ownerType: 'player', ownerId: alice.id, ownerName: 'Alice',
    price: 6, quantity: 3, remaining: 3, status: 'open', createdAt: now,
  }];
  migrateWorld(world, now);
  assert.deepEqual(player.inventories.wheat, { available: 7, frozen: 3 });
  assert.equal(Object.hasOwn(player.inventories, 'grain'), false);
  assert.equal(world.orders[0].assetId, 'wheat');
  assert.equal(world.marketDemand.modelVersion, 1);
  assert.equal(world.version, 13);
});

test('idempotency returns the original response without applying an action twice', () => {
  const store = new EconomyStore(':memory:');
  try {
    const request = { action: 'work', payload: {}, requestKey: 'request-12345678', method: 'POST', path: '/api/game/work' };
    const first = store.apply(alice, request, now);
    const second = store.apply(alice, request, now + 500);
    assert.deepEqual(second, first);
    assert.equal(store.getState(alice, now + 1_000).work.totalClicks, 1);
  } finally {
    store.close();
  }
});

test('catalog retains 22 products, 15 facilities and integer reference profit gradient', () => {
  assert.equal(PRODUCT_CATALOG.length, 22);
  assert.equal(FACILITY_TYPE_CATALOG.length, 15);
  const prices = Object.fromEntries(PRODUCT_CATALOG.map((product) => [product.id, product.basePrice]));
  for (const facility of FACILITY_TYPE_CATALOG) {
    for (const recipe of facility.recipes) {
      const inputValue = recipe.inputs.reduce((sum, input) => sum + prices[input.productId] * input.quantity, 0);
      const profit = (prices[recipe.output.productId] * recipe.output.quantity - inputValue - recipe.operatingCost)
        * 60_000 / recipe.cycleMs;
      assert.equal(profit, facility.category === 'raw' ? 1 : facility.category === 'processing' ? 3 : 6);
    }
  }
  const facilities = new Map(FACILITY_TYPE_CATALOG.map((facility) => [facility.id, facility]));
  assert.deepEqual(facilities.get('textile-mill').recipes.map((recipe) => recipe.inputs), [
    [{ productId: 'cotton', quantity: 6 }],
    [{ productId: 'wool', quantity: 2 }],
  ]);
  assert.deepEqual(facilities.get('electronics-factory').recipes[0].inputs, [
    { productId: 'plastic', quantity: 1 }, { productId: 'copper', quantity: 1 },
  ]);
});

test('market demand creates direct and derived orders within the shared group budget', () => {
  const world = createWorld(now);
  prepareDemand(world, 'food');
  prepareDemand(world, 'household');
  processWorld(world, now + 1);
  const marketOrders = world.orders.filter((order) => order.ownerType === 'population');
  assert.ok(marketOrders.some((order) => order.demandTier === 'direct'));
  assert.ok(marketOrders.some((order) => order.demandTier === 'derived-liquidity'));
  assert.deepEqual([...new Set(marketOrders.map((order) => order.ownerName))].sort(), [
    '家庭消费市场需求', '食品市场需求',
  ]);
  for (const group of MARKET_DEMAND_GROUP_CATALOG) {
    const state = world.demandGroups[group.id];
    assert.equal(state.lastCommitted, state.directCommitted + state.derivedCommitted);
    assert.ok(state.lastCommitted <= state.lastBudget);
    assert.ok(state.directCommitted <= Math.floor(state.lastBudget * group.directBudgetShare));
    assert.equal(state.lastInventoryBoost, 0);
    assert.equal(state.lastStockValue, 0);
  }
});

test('market budget scales sublinearly, caps at six times and excludes inactive players', () => {
  const budgetFor = (playerCount) => {
    const world = createWorld(now);
    for (let index = 1; index <= playerCount; index += 1) {
      ensurePlayer(world, { id: index, email: `player-${index}@example.com`, name: `Player ${index}` }, now);
    }
    prepareDemand(world, 'food');
    processWorld(world, now + 1);
    return world.demandGroups.food.lastBudget;
  };
  assert.deepEqual([1, 4, 9, 25, 121].map(budgetFor), [1_000, 1_500, 2_000, 3_000, 6_000]);
  assert.equal(budgetFor(144), 6_000);

  const world = createWorld(now);
  for (let index = 1; index <= 9; index += 1) {
    const player = ensurePlayer(world, { id: index, email: `inactive-${index}@example.com`, name: `Inactive ${index}` }, now);
    if (index > 1) player.lastEconomicActivityAt = now - 8 * 24 * 60 * 60 * 1000;
  }
  prepareDemand(world, 'food');
  processWorld(world, now + 1);
  assert.equal(world.demandGroups.food.lastActivePlayerCount, 1);
  assert.equal(world.demandGroups.food.lastBudget, 1_000);
});

test('player inventory never increases market demand budget or product allocation', () => {
  const run = (inventoryQuantity) => {
    const world = createWorld(now);
    ensurePlayer(world, alice, now).inventories.wheat.available = inventoryQuantity;
    prepareDemand(world, 'food');
    processWorld(world, now + 1);
    return world.demandGroups.food;
  };
  const empty = run(0);
  const stocked = run(100_000);
  assert.equal(stocked.lastBudget, empty.lastBudget);
  assert.equal(stocked.lastClassAllocation.staples.shares.wheat, empty.lastClassAllocation.staples.shares.wheat);
  assert.equal(stocked.lastInventoryBoost, 0);
  assert.equal(stocked.lastStockValue, 0);
});

test('consumer substitutes shift demand toward the cheaper grain without changing total budget', () => {
  const world = createWorld(now);
  const seller = ensurePlayer(world, bob, now);
  seller.inventories.wheat.available = 100;
  seller.inventories.rice.available = 100;
  deferDemand(world);
  assert.equal(applyAction(world, bob, 'placeOrder', { productId: 'wheat', side: 'sell', quantity: 100, price: 6 }, now + 1).ok, true);
  assert.equal(applyAction(world, bob, 'placeOrder', { productId: 'rice', side: 'sell', quantity: 100, price: 2 }, now + 2).ok, true);
  prepareDemand(world, 'food', now + 3);
  processWorld(world, now + 3);
  const shares = world.demandGroups.food.lastClassAllocation.staples.shares;
  assert.ok(shares.rice > shares.wheat);
  assert.equal(world.demandGroups.food.lastBudget, 1_000);
});

test('complement gating prioritizes the bottleneck input for electronics', () => {
  const world = createWorld(now);
  const seller = ensurePlayer(world, bob, now);
  seller.inventories.plastic.available = 1_000;
  deferDemand(world);
  assert.equal(applyAction(world, bob, 'placeOrder', { productId: 'plastic', side: 'sell', quantity: 1_000, price: 24 }, now + 1).ok, true);
  prepareDemand(world, 'household', now + 2);
  processWorld(world, now + 2);
  const allocation = world.demandGroups.household.lastAllocation;
  assert.ok(allocation.copper.requiredQuantity > allocation.plastic.requiredQuantity);
  const relations = world.demandGroups.household.lastDerivedRelations.filter((item) => item.outputProductId === 'electronics');
  assert.ok(relations.find((item) => item.inputProductId === 'copper').complementGate
    > relations.find((item) => item.inputProductId === 'plastic').complementGate);
});

test('downstream price signals move upstream only after relation lag cycles', () => {
  const world = createWorld(now);
  world.markets.electronics.priceHistory.push({ price: 128, quantity: 20, createdAt: now + 1, takerSide: 'buy' });
  const initialCopper = world.priceTransmission.products.copper.referencePrice;
  processPriceTransmission(world, now + cycleMs + 1);
  assert.equal(world.priceTransmission.products.copper.referencePrice, initialCopper);
  processPriceTransmission(world, now + 2 * cycleMs + 1);
  processPriceTransmission(world, now + 3 * cycleMs + 1);
  assert.ok(world.priceTransmission.products.copper.referencePrice > initialCopper);
});

test('new worlds expose private market orders and preserve the existing client version', () => {
  const store = new EconomyStore(':memory:');
  try {
    const state = store.getState(alice, now);
    assert.equal(state.version, 15);
    assert.equal(state.products.length, 22);
    assert.equal(state.facilityTypes.length, 15);
    const externalBuyOrders = state.orders.filter((order) => order.isOwn === false && order.side === 'buy');
    assert.ok(externalBuyOrders.length > 0);
    assert.ok(externalBuyOrders.every((order) => (
      !Object.hasOwn(order, 'ownerType')
      && !Object.hasOwn(order, 'ownerName')
      && !Object.hasOwn(order, 'demandGroupId')
      && !Object.hasOwn(order, 'demandTier')
    )));
    const persisted = JSON.parse(String(store.selectWorld.get().state_json));
    assert.equal(persisted.version, 13);
    assert.equal(persisted.marketDemand.modelVersion, 1);
  } finally {
    store.close();
  }
});

test('legacy demand migration removes old system orders while preserving player assets and orders', () => {
  const world = createWorld(now);
  const player = ensurePlayer(world, alice, now);
  player.credits = 777;
  player.inventories.wheat.available = 9;
  delete world.marketDemand;
  world.version = 12;
  world.orders = [
    { id: 'player-order', assetKind: 'commodity', assetId: 'wheat', productId: 'wheat', side: 'sell', ownerType: 'player', ownerId: alice.id, ownerName: 'Alice', price: 3, quantity: 2, remaining: 2, status: 'open', createdAt: now },
    { id: 'old-demand', productId: 'wheat', side: 'buy', ownerType: 'population', ownerName: '饮食需求', demandGroupId: 'food', price: 2, quantity: 2, remaining: 2, status: 'open', createdAt: now },
  ];
  migrateWorld(world, now);
  assert.deepEqual(world.orders.map((order) => order.id), ['player-order']);
  assert.equal(player.credits, 777);
  assert.equal(player.inventories.wheat.available, 9);
  assert.equal(world.marketDemand.modelVersion, 1);
  assert.equal(world.demandGroups.food.nextDemandAt, now);
});

test('commodity fills preserve exact player resting prices', () => {
  const world = createWorld(now);
  world.orders = [];
  deferDemand(world);
  const buyer = ensurePlayer(world, alice, now);
  const sellerA = ensurePlayer(world, bob, now);
  const sellerB = ensurePlayer(world, carol, now);
  buyer.credits = 100;
  sellerA.inventories.wheat.available = 1;
  sellerB.inventories.wheat.available = 1;
  applyAction(world, bob, 'placeOrder', { productId: 'wheat', side: 'sell', quantity: 1, price: 5 }, now + 1);
  applyAction(world, carol, 'placeOrder', { productId: 'wheat', side: 'sell', quantity: 1, price: 6 }, now + 2);
  applyAction(world, alice, 'placeOrder', { productId: 'wheat', side: 'buy', quantity: 2, price: 20 }, now + 3);
  const order = world.orders.find((item) => item.ownerId === alice.id && item.side === 'buy');
  assert.deepEqual(order.fills.map((fill) => ({ price: fill.price, quantity: fill.quantity })), [
    { price: 5, quantity: 1 }, { price: 6, quantity: 1 },
  ]);
  assert.equal(buyer.credits, 89);
});
