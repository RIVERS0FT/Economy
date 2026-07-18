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

function prepareDemand(world, groupId) {
  world.demandGroups[groupId].nextDemandAt = now;
  world.demandGroups[groupId].lastCycleId = -1;
}

test('different products never match in the same order book', () => {
  const world = createWorld(now);
  const seller = ensurePlayer(world, bob, now);
  const buyer = ensurePlayer(world, alice, now);
  seller.inventories.ore.available = 10;
  buyer.credits = 1_000;

  assert.equal(applyAction(world, bob, 'placeOrder', {
    productId: 'ore', side: 'sell', quantity: 5, price: 6,
  }, now + 1).ok, true);
  assert.equal(applyAction(world, alice, 'placeOrder', {
    productId: 'wheat', side: 'buy', quantity: 5, price: 9,
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
      id: 'legacy-order', side: 'sell', ownerType: 'player', ownerId: 1, ownerName: 'Alice',
      price: 5, quantity: 1, remaining: 1, status: 'open', createdAt: now,
    }],
    facilityListings: [],
    demand: { cycleMs: 300_000, nextDemandAt: now + 300_000, lastBudget: 10, lastQuantity: 2, lastPrice: 5, satisfaction: 1 },
    marketPrice: 7,
    marketPriceHistory: [{ price: 7, quantity: 1, createdAt: now }],
    lastProcessedAt: now,
  };

  migrateWorld(world, now);
  assert.equal(world.players['1'].inventories.wheat.available, 7);
  assert.equal(world.players['1'].inventories.wheat.frozen, 2);
  assert.equal(world.orders[0].productId, 'wheat');
  assert.equal('facilitySlots' in world.players['1'], false);
});

test('world version 7 grain assets migrate entirely to wheat', () => {
  const world = createWorld(now);
  const player = ensurePlayer(world, alice, now);
  world.version = 7;
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
  assert.equal(world.orders[0].productId, 'wheat');
  assert.equal(world.markets.wheat.productId, 'wheat');
  assert.equal(Object.hasOwn(world.markets, 'grain'), false);
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

test('client state uses version 14 and exposes no factory instances', () => {
  const store = new EconomyStore(':memory:');
  try {
    const state = store.getState(alice, now);
    assert.equal(state.version, 15);
    assert.equal(Array.isArray(state.facilityGroups), true);
    assert.equal(Object.hasOwn(state, 'facilities'), false);
    assert.equal(state.products.length, 22);
    assert.equal(state.facilityTypes.length, 15);
  } finally {
    store.close();
  }
});


test('expanded industry catalog exposes complete production chains', () => {
  assert.equal(PRODUCT_CATALOG.length, 22);
  assert.equal(FACILITY_TYPE_CATALOG.length, 15);

  const productIds = new Set(PRODUCT_CATALOG.map((product) => product.id));
  const facilityIds = new Set(FACILITY_TYPE_CATALOG.map((facility) => facility.id));
  assert.equal(productIds.size, PRODUCT_CATALOG.length);
  assert.equal(facilityIds.size, FACILITY_TYPE_CATALOG.length);

  const expectedPrices = {
    wheat: 2,
    rice: 2,
    cotton: 2,
    timber: 5,
    ore: 6,
    'copper-ore': 6,
    'crude-oil': 8,
    meat: 6,
    eggs: 3,
    milk: 3,
    wool: 6,
    flour: 13,
    lumber: 15,
    steel: 24,
    copper: 24,
    plastic: 24,
    textile: 18,
    food: 15,
    furniture: 20,
    clothing: 48,
    machinery: 60,
    electronics: 64,
  };
  assert.deepEqual(Object.fromEntries(PRODUCT_CATALOG.map((product) => [product.id, product.basePrice])), expectedPrices);

  const expectedFacilityBalance = {
    farm: [120_000, 6],
    'logging-camp': [60_000, 9],
    mine: [60_000, 11],
    ranch: [120_000, 16],
    'oil-field': [60_000, 15],
    mill: [40_000, 7],
    sawmill: [40_000, 3],
    steelworks: [40_000, 4],
    refinery: [40_000, 6],
    'textile-mill': [40_000, 4],
    'food-factory': [50_000, 14],
    'furniture-factory': [60_000, 4],
    'garment-factory': [60_000, 6],
    'machine-factory': [60_000, 6],
    'electronics-factory': [60_000, 10],
  };

  for (const product of PRODUCT_CATALOG) {
    assert.equal(Number.isInteger(product.basePrice), true, `${product.id} 初始参考价必须为整数`);
  }
  for (const facility of FACILITY_TYPE_CATALOG) {
    assert.equal(productIds.has(facility.output.productId), true);
    assert.ok(Array.isArray(facility.inputs));
    for (const input of facility.inputs) assert.equal(productIds.has(input.productId), true);
    assert.ok(Array.isArray(facility.recipes) && facility.recipes.length >= 1);
    assert.ok(facility.recipes.some((recipe) => recipe.id === facility.defaultRecipeId));
    assert.deepEqual([facility.cycleMs, facility.operatingCost], expectedFacilityBalance[facility.id]);
    assert.equal(Number.isInteger(facility.cycleMs / 1_000), true, `${facility.id} 周期秒数必须为整数`);
    assert.equal(Number.isInteger(facility.operatingCost), true, `${facility.id} 周期成本必须为整数`);
    for (const recipe of facility.recipes) {
      assert.equal(productIds.has(recipe.output.productId), true);
      assert.ok(Array.isArray(recipe.inputs));
      for (const input of recipe.inputs) {
        assert.equal(productIds.has(input.productId), true);
        assert.equal(Number.isInteger(input.quantity), true);
      }
      assert.equal(recipe.cycleMs, facility.cycleMs);
      assert.equal(recipe.operatingCost, facility.operatingCost);
      assert.equal(Number.isInteger(recipe.output.quantity), true);
      const inputValue = recipe.inputs.reduce((sum, input) => sum + expectedPrices[input.productId] * input.quantity, 0);
      const profit = (expectedPrices[recipe.output.productId] * recipe.output.quantity - inputValue - recipe.operatingCost)
        * 60_000 / recipe.cycleMs;
      const expectedProfit = facility.category === 'raw' ? 1 : facility.category === 'processing' ? 3 : 6;
      assert.equal(profit, expectedProfit, `${facility.id}/${recipe.id} 参考分钟利润不正确`);
    }
  }

  const facilities = new Map(FACILITY_TYPE_CATALOG.map((facility) => [facility.id, facility]));
  assert.deepEqual(facilities.get('farm').recipes.map((recipe) => recipe.output.productId), ['wheat', 'rice', 'cotton']);
  assert.deepEqual(facilities.get('mine').recipes.map((recipe) => recipe.output.productId), ['ore', 'copper-ore']);
  assert.deepEqual(facilities.get('ranch').recipes.map((recipe) => recipe.output.productId), ['meat', 'eggs', 'milk', 'wool']);
  assert.equal(facilities.get('steelworks').name, '冶炼厂');
  assert.deepEqual(facilities.get('steelworks').recipes.map((recipe) => recipe.output.productId), ['steel', 'copper']);
  assert.deepEqual(facilities.get('textile-mill').recipes.map((recipe) => recipe.inputs), [
    [{ productId: 'cotton', quantity: 6 }],
    [{ productId: 'wool', quantity: 2 }],
  ]);
  assert.deepEqual(facilities.get('electronics-factory').recipes[0].inputs, [
    { productId: 'plastic', quantity: 1 },
    { productId: 'copper', quantity: 1 },
  ]);
  assert.deepEqual(facilities.get('electronics-factory').output, { productId: 'electronics', quantity: 1 });
});




test('population demand only creates food and household orders within dynamic budgets', () => {
  const world = createWorld(now);
  prepareDemand(world, 'food');
  prepareDemand(world, 'household');
  processWorld(world, now + 1);

  assert.ok(world.orders.every((order) => ['player', 'population'].includes(order.ownerType)));
  const populationOrders = world.orders.filter((order) => order.ownerType === 'population');
  assert.ok(populationOrders.length > 0);
  assert.deepEqual([...new Set(populationOrders.map((order) => order.ownerName))].sort(), ['家庭用品需求', '饮食需求']);
  assert.ok(populationOrders.every((order) => ['food', 'household'].includes(order.demandGroupId)));
  assert.equal(world.demandGroups.food.lastBudget, 1_000);
  assert.ok(world.demandGroups.food.lastCommitted <= world.demandGroups.food.lastBudget);
  assert.equal(world.demandGroups.household.lastBudget, 900);
  assert.ok(world.demandGroups.household.lastCommitted <= world.demandGroups.household.lastBudget);
  assert.deepEqual(Object.keys(world.demandGroups.food.lastAllocation).sort(), ['eggs', 'flour', 'food', 'meat', 'milk', 'rice', 'wheat']);
  assert.deepEqual(Object.keys(world.demandGroups.household.lastAllocation).sort(), [
    'clothing', 'copper', 'copper-ore', 'cotton', 'crude-oil', 'electronics',
    'furniture', 'lumber', 'plastic', 'textile', 'timber', 'wool',
  ]);
});

test('population demand scales sublinearly with active players and stops at the configured cap', () => {
  const foodBudgetFor = (playerCount) => {
    const world = createWorld(now);
    for (let index = 1; index <= playerCount; index += 1) {
      ensurePlayer(world, { id: index, email: `player-${index}@example.com`, name: `Player ${index}` }, now);
    }
    prepareDemand(world, 'food');
    prepareDemand(world, 'household');
    processWorld(world, now + 1);
    return {
      food: world.demandGroups.food.lastBudget,
      household: world.demandGroups.household.lastBudget,
      active: world.demandGroups.food.lastActivePlayerCount,
    };
  };

  assert.deepEqual([1, 4, 9, 25, 121].map((count) => foodBudgetFor(count).food), [1_000, 1_500, 2_000, 3_000, 6_000]);
  assert.deepEqual([1, 4, 9, 25, 121].map((count) => foodBudgetFor(count).household), [900, 1_350, 1_800, 2_700, 5_400]);
  assert.equal(foodBudgetFor(144).active, 144);
  assert.equal(foodBudgetFor(144).food, 6_000);
});

test('inactive players stop scaling demand after seven days', () => {
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

test('population demand grows with stock value and favors stocked products without double counting frozen inventory', () => {
  const demandWithWheat = (available, frozen) => {
    const world = createWorld(now);
    const player = ensurePlayer(world, alice, now);
    player.inventories.wheat.available = available;
    player.inventories.wheat.frozen = frozen;
    prepareDemand(world, 'food');
    processWorld(world, now + 1);
    return world.demandGroups.food;
  };

  const empty = demandWithWheat(0, 0);
  const stocked = demandWithWheat(10_000, 0);
  const availableOnly = demandWithWheat(10, 0);
  const splitAvailableFrozen = demandWithWheat(5, 5);

  assert.equal(empty.lastBudget, 1_000);
  assert.equal(stocked.lastBudget, 1_400);
  assert.equal(stocked.lastInventoryBoost, 400);
  assert.equal(stocked.lastStockValue, 20_000);
  assert.ok(stocked.lastAllocation.wheat.budget > empty.lastAllocation.wheat.budget);
  assert.ok(empty.lastAllocation.wheat.quantity > 0);
  assert.equal(availableOnly.lastStockValue, splitAvailableFrozen.lastStockValue);
  assert.equal(availableOnly.lastBudget, splitAvailableFrozen.lastBudget);
});

test('state polling and failed actions do not refresh economic activity', () => {
  const store = new EconomyStore(':memory:');
  try {
    const first = store.getStateSnapshot(alice, undefined, now);
    const firstWorld = JSON.parse(String(store.selectWorld.get().state_json));
    const initialActivity = firstWorld.players[String(alice.id)].lastEconomicActivityAt;

    store.getStateSnapshot(alice, first.revision, now + 1_000);
    const afterPoll = JSON.parse(String(store.selectWorld.get().state_json));
    assert.equal(afterPoll.players[String(alice.id)].lastEconomicActivityAt, initialActivity);

    const success = store.apply(alice, {
      action: 'work', payload: {}, requestKey: 'activity-success', method: 'POST', path: '/api/game/work',
    }, now + 10_000);
    assert.equal(success.result.ok, true);
    const afterSuccess = JSON.parse(String(store.selectWorld.get().state_json));
    assert.equal(afterSuccess.players[String(alice.id)].lastEconomicActivityAt, now + 10_000);

    const failure = store.apply(alice, {
      action: 'work', payload: {}, requestKey: 'activity-failure', method: 'POST', path: '/api/game/work',
    }, now + 10_001);
    assert.equal(failure.result.ok, false);
    const afterFailure = JSON.parse(String(store.selectWorld.get().state_json));
    assert.equal(afterFailure.players[String(alice.id)].lastEconomicActivityAt, now + 10_000);
  } finally {
    store.close();
  }
});

test('new worlds create population demand during the first authoritative state read', () => {
  const store = new EconomyStore(':memory:');
  try {
    const state = store.getState(alice, now);
    const externalBuyOrders = state.orders.filter((order) => order.isOwn === false && order.side === 'buy');
    assert.ok(externalBuyOrders.length > 0);
    assert.ok(externalBuyOrders.every((order) => (
      !Object.hasOwn(order, 'ownerType')
      && !Object.hasOwn(order, 'ownerName')
      && !Object.hasOwn(order, 'demandGroupId')
    )));
    const persisted = JSON.parse(String(store.selectWorld.get().state_json));
    const populationOrders = persisted.orders.filter((order) => order.ownerType === 'population');
    assert.ok(populationOrders.length > 0);
    assert.deepEqual([...new Set(populationOrders.map((order) => order.ownerName))].sort(), ['家庭用品需求', '饮食需求']);
    assert.equal(persisted.version, 13);
    assert.ok(persisted.demandGroups.food.lastCommitted <= persisted.demandGroups.food.lastBudget);
    assert.ok(persisted.demandGroups.household.lastCommitted <= persisted.demandGroups.household.lastBudget);
  } finally {
    store.close();
  }
});

test('world version 12 migration immediately rebuilds smoothed dynamic population demand', () => {
  const world = createWorld(now);
  const player = ensurePlayer(world, alice, now);
  player.inventories.wheat.available = 2;
  world.version = 12;
  world.demandGroups.food.lastBudget = 500;
  world.demandGroups.household.lastBudget = 480;
  delete world.demandGroups.food.lastTargetBudget;
  delete world.demandGroups.household.lastTargetBudget;
  world.orders = [{
    id: 'player-wheat-sell', assetKind: 'commodity', assetId: 'wheat', productId: 'wheat',
    side: 'sell', ownerType: 'player', ownerId: alice.id, ownerName: 'Alice',
    price: 99, quantity: 2, remaining: 2, status: 'open', createdAt: now,
  }];
  for (const group of Object.values(world.demandGroups)) {
    group.nextDemandAt = now + 5 * 60 * 1000;
    group.lastCycleId = Math.floor(now / group.cycleMs);
    group.lastCommitted = group.lastBudget;
  }

  processWorld(world, now + 1);

  assert.equal(world.version, 13);
  assert.ok(world.orders.some((order) => order.id === 'player-wheat-sell'));
  const populationOrders = world.orders.filter((order) => order.ownerType === 'population');
  assert.ok(populationOrders.length > 0);
  assert.ok(populationOrders.every((order) => order.demandCycleId === Math.floor((now + 1) / (5 * 60 * 1000))));
  assert.equal(world.demandGroups.food.lastBudget, 600);
  assert.equal(world.demandGroups.household.lastBudget, 576);
  assert.ok(world.demandGroups.food.nextDemandAt > now + 1);
  assert.ok(world.demandGroups.household.nextDemandAt > now + 1);
});

test('migration removes market and legacy population orders while preserving player orders', () => {
  const world = createWorld(now);
  const player = ensurePlayer(world, alice, now);
  player.credits = 777;
  player.inventories.wheat.available = 9;
  world.version = 9;
  world.orders = [
    { id: 'player-order', assetKind: 'commodity', assetId: 'wheat', productId: 'wheat', side: 'sell', ownerType: 'player', ownerId: alice.id, ownerName: 'Alice', price: 3, quantity: 2, remaining: 2, status: 'open', createdAt: now },
    { id: 'market-order', productId: 'wheat', side: 'buy', ownerType: 'market', ownerName: '市场流动采购', price: 2, quantity: 2, remaining: 2, status: 'open', createdAt: now },
    { id: 'enterprise-order', productId: 'machinery', side: 'buy', ownerType: 'population', ownerName: '企业采购', price: 60, quantity: 1, remaining: 1, status: 'open', createdAt: now },
  ];

  migrateWorld(world, now);

  assert.equal(world.version, 13);
  assert.deepEqual(world.orders.map((order) => order.id), ['player-order']);
  assert.equal(player.credits, 777);
  assert.equal(player.inventories.wheat.available, 9);
});

test('world version 8 migration restarts electronics and upgrades demand state without resetting assets', () => {
  const world = createWorld(now);
  const player = ensurePlayer(world, alice, now);
  world.version = 8;
  player.credits = 777;
  player.inventories.plastic.available = 9;
  player.inventories.copper.available = 4;
  player.facilityGroups = [{
    facilityTypeId: 'electronics-factory', count: 2, participatingCount: 2, pendingJoinCount: 0,
    enabled: true, status: 'running', activeRecipeId: 'electronics-factory-default',
    cycleStartedAt: now - 30_000, lifetimeOutput: 5,
  }];

  migrateWorld(world, now);

  assert.equal(world.version, 13);
  assert.equal(player.credits, 777);
  assert.equal(player.inventories.plastic.available, 9);
  assert.equal(player.inventories.copper.available, 4);
  assert.equal(player.facilityGroups[0].cycleStartedAt, now);
  assert.deepEqual(Object.keys(world.demandGroups).sort(), ['food', 'household']);
  assert.ok(world.priceTransmission.products.electronics);
});

test('commodity order fills preserve every exact player resting price without system liquidity', () => {
  const world = createWorld(now);
  world.orders = [];
  const buyer = ensurePlayer(world, alice, now);
  const sellerA = ensurePlayer(world, bob, now);
  const sellerB = ensurePlayer(world, carol, now);
  buyer.credits = 100;
  sellerA.inventories.wheat.available = 1;
  sellerB.inventories.wheat.available = 1;

  assert.equal(applyAction(world, bob, 'placeOrder', { productId: 'wheat', side: 'sell', quantity: 1, price: 5 }, now + 1).ok, true);
  assert.equal(applyAction(world, carol, 'placeOrder', { productId: 'wheat', side: 'sell', quantity: 1, price: 6 }, now + 2).ok, true);
  assert.equal(applyAction(world, alice, 'placeOrder', { productId: 'wheat', side: 'buy', quantity: 2, price: 20 }, now + 3).ok, true);

  const buyOrder = world.orders.find((order) => order.ownerId === alice.id && order.side === 'buy');
  assert.deepEqual(buyOrder.fills.map((fill) => ({ price: fill.price, quantity: fill.quantity })), [
    { price: 5, quantity: 1 }, { price: 6, quantity: 1 },
  ]);
  assert.equal(buyer.credits, 89);
  assert.equal(buyer.frozenCredits, 0);
  assert.equal(buyer.inventories.wheat.available, 2);
  assert.equal(world.orders.some((order) => order.ownerType === 'market'), false);
});
