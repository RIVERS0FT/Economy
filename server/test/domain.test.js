import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyAction,
  createWorld,
  ensurePlayer,
  FACILITY_TYPE_CATALOG,
  MARKET_DEMAND_GROUP_CATALOG,
  MARKET_DEMAND_MODEL_VERSION,
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

test('different products never match in the same order book', () => {
  const world = createWorld(now);
  deferDemand(world);
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
  deferDemand(world);
  ensurePlayer(world, alice, now);
  assert.equal(applyAction(world, alice, 'work', {}, now).ok, true);
  assert.equal(applyAction(world, alice, 'work', {}, now + 1_000).ok, false);
  assert.equal(applyAction(world, alice, 'work', {}, now + 2_999).ok, false);
  assert.equal(applyAction(world, alice, 'work', {}, now + 3_000).ok, true);
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
  assert.equal(world.marketDemand.modelVersion, MARKET_DEMAND_MODEL_VERSION);
});

test('world version 7 grain assets migrate entirely to wheat', () => {
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
  assert.equal(world.orders[0].productId, 'wheat');
  assert.equal(world.markets.wheat.productId, 'wheat');
  assert.equal(Object.hasOwn(world.markets, 'grain'), false);
  assert.equal(world.marketDemand.modelVersion, MARKET_DEMAND_MODEL_VERSION);
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

test('client state uses version 16 and exposes no factory instances', () => {
  const store = new EconomyStore(':memory:');
  try {
    const state = store.getState(alice, now);
    assert.equal(state.version, 16);
    assert.equal(Array.isArray(state.facilityGroups), true);
    assert.equal(Object.hasOwn(state, 'facilities'), false);
    assert.equal(state.products.length, 31);
    assert.equal(state.facilityTypes.length, 21);
  } finally {
    store.close();
  }
});

test('expanded industry catalog exposes fruit and complete production chains', () => {
  assert.equal(PRODUCT_CATALOG.length, 31);
  assert.equal(FACILITY_TYPE_CATALOG.length, 21);

  const expectedProducts = [
    'wheat', 'rice', 'cotton', 'sugarcane', 'fruit', 'timber', 'ore', 'copper-ore', 'crude-oil',
    'meat', 'eggs', 'milk', 'fish', 'wool', 'flour', 'sugar', 'lumber', 'steel', 'copper',
    'plastic', 'textile', 'pulp', 'food', 'beverage', 'prepared-meal', 'paper', 'furniture',
    'clothing', 'machinery', 'electronics', 'appliance',
  ];
  const expectedFacilities = [
    'farm', 'orchard', 'logging-camp', 'mine', 'ranch', 'fishery', 'oil-field', 'mill', 'sawmill',
    'pulp-mill', 'steelworks', 'refinery', 'textile-mill', 'food-factory', 'beverage-factory',
    'paper-mill', 'furniture-factory', 'garment-factory', 'machine-factory',
    'electronics-factory', 'appliance-factory',
  ];
  assert.deepEqual(PRODUCT_CATALOG.map((product) => product.id), expectedProducts);
  assert.deepEqual(FACILITY_TYPE_CATALOG.map((facility) => facility.id), expectedFacilities);

  const expectedPrices = {
    wheat: 2, rice: 2, cotton: 2, sugarcane: 2, fruit: 4, timber: 6, ore: 7,
    'copper-ore': 7, 'crude-oil': 9, meat: 6, eggs: 3, milk: 3, fish: 6, wool: 6,
    flour: 13, sugar: 13, lumber: 17, steel: 29, copper: 29, plastic: 30, textile: 20,
    pulp: 20, food: 15, beverage: 18, 'prepared-meal': 18, paper: 15, furniture: 24,
    clothing: 55, machinery: 76, electronics: 84, appliance: 92,
  };
  assert.deepEqual(Object.fromEntries(PRODUCT_CATALOG.map((product) => [product.id, product.basePrice])), expectedPrices);

  const productIds = new Set(expectedProducts);
  const expectedProfitByComplexity = { C1: 1, C2: 3, C3: 6, C4: 6, C5: 8, C6: 10, C7: 12 };
  for (const product of PRODUCT_CATALOG) {
    assert.equal(Number.isInteger(product.basePrice), true, `${product.id} 初始参考价必须为整数`);
  }
  for (const facility of FACILITY_TYPE_CATALOG) {
    assert.ok(Array.isArray(facility.recipes) && facility.recipes.length >= 1);
    assert.ok(facility.recipes.some((recipe) => recipe.id === facility.defaultRecipeId));
    const defaultRecipe = facility.recipes.find((recipe) => recipe.id === facility.defaultRecipeId);
    assert.equal(facility.cycleMs, defaultRecipe.cycleMs);
    assert.equal(facility.operatingCost, defaultRecipe.operatingCost);
    for (const recipe of facility.recipes) {
      assert.ok(Array.isArray(recipe.inputs), `${facility.id}/${recipe.id} 必须使用 inputs[]`);
      assert.equal(Number.isInteger(recipe.cycleMs / 1_000), true, `${facility.id}/${recipe.id} 周期秒数必须为整数`);
      assert.equal(Number.isInteger(recipe.operatingCost), true, `${facility.id}/${recipe.id} 周期成本必须为整数`);
      assert.equal(productIds.has(recipe.output.productId), true);
      assert.equal(Number.isInteger(recipe.output.quantity), true);
      for (const input of recipe.inputs) {
        assert.equal(productIds.has(input.productId), true);
        assert.equal(Number.isInteger(input.quantity), true);
      }
      const inputValue = recipe.inputs.reduce((sum, input) => sum + expectedPrices[input.productId] * input.quantity, 0);
      const profit = (expectedPrices[recipe.output.productId] * recipe.output.quantity - inputValue - recipe.operatingCost)
        * 60_000 / recipe.cycleMs;
      const expectedProfit = expectedProfitByComplexity[facility.complexity];
      assert.equal(profit, expectedProfit, `${facility.id}/${recipe.id} 参考分钟利润不正确`);
    }
  }

  const facilities = new Map(FACILITY_TYPE_CATALOG.map((facility) => [facility.id, facility]));
  assert.deepEqual(facilities.get('farm').recipes.map((recipe) => recipe.output.productId), ['wheat', 'rice', 'cotton', 'sugarcane']);
  assert.equal(facilities.get('orchard').recipes[0].output.productId, 'fruit');
  assert.equal(facilities.get('fishery').recipes[0].output.productId, 'fish');
  assert.equal(facilities.get('mill').name, '磨坊');
  assert.deepEqual(facilities.get('mill').recipes.map((recipe) => recipe.output.productId), ['flour', 'sugar']);
  assert.deepEqual(facilities.get('food-factory').recipes.map((recipe) => recipe.output.productId), ['food', 'prepared-meal']);
  assert.deepEqual(facilities.get('beverage-factory').recipes.map((recipe) => recipe.inputs), [
    [{ productId: 'sugar', quantity: 1 }, { productId: 'milk', quantity: 1 }],
    [{ productId: 'fruit', quantity: 2 }, { productId: 'sugar', quantity: 1 }],
  ]);
  assert.deepEqual(facilities.get('appliance-factory').recipes[0].inputs, [
    { productId: 'machinery', quantity: 1 }, { productId: 'electronics', quantity: 1 },
  ]);
});

test('market demand creates direct and derived orders within the shared group budget', () => {
  const world = createWorld(now);
  ensurePlayer(world, alice, now);
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
    assert.equal(group.directBudgetShare, 0.70);
    assert.ok(state.directCommitted <= Math.floor(state.lastBudget * group.directBudgetShare));
    assert.ok(state.derivedCommitted <= state.lastBudget - Math.floor(state.lastBudget * group.directBudgetShare));
    assert.equal(state.lastInventoryBoost, 0);
    assert.equal(state.lastStockValue, 0);
  }
});


test('market demand retains at most 35% of unsold orders and publishes a bounded demand curve', () => {
  const world = createWorld(now);
  ensurePlayer(world, alice, now);
  deferDemand(world, now + 10 * cycleMs);
  prepareDemand(world, 'food', now);
  processWorld(world, now + 1);

  const firstCycleId = world.demandGroups.food.lastCycleId;
  const firstOrder = world.orders.find((order) => (
    order.ownerType === 'population'
    && order.demandGroupId === 'food'
    && order.demandTier === 'direct'
    && order.productId === 'food'
    && order.demandCycleId === firstCycleId
    && order.status === 'open'
  ));
  assert.ok(firstOrder);
  const firstRemaining = firstOrder.remaining;

  prepareDemand(world, 'food', now + cycleMs + 1);
  processWorld(world, now + cycleMs + 1);

  assert.ok(firstOrder.remaining > 0);
  assert.ok(firstOrder.remaining <= Math.floor(firstRemaining * 0.35));
  const nextCycleId = world.demandGroups.food.lastCycleId;
  const nextOrders = world.orders.filter((order) => (
    order.ownerType === 'population'
    && order.demandGroupId === 'food'
    && order.demandTier === 'direct'
    && order.productId === 'food'
    && order.demandCycleId === nextCycleId
    && (order.status === 'open' || order.status === 'partial')
  ));
  assert.ok(nextOrders.length >= 2);
  assert.ok(new Set(nextOrders.map((order) => order.price)).size >= 2);
  assert.ok(world.demandGroups.food.lastRetainedOrderValue > 0);
  assert.ok(world.demandGroups.food.lastOpenOrderValue <= world.demandGroups.food.lastBudget * 2.5);
});

test('market demand cancels carried orders and resets to the model price after a sale', () => {
  const world = createWorld(now);
  const seller = ensurePlayer(world, bob, now);
  seller.inventories.wheat.available = 1;
  deferDemand(world, now + 10 * cycleMs);
  assert.equal(applyAction(world, bob, 'placeOrder', {
    productId: 'wheat', side: 'sell', quantity: 1, price: 1,
  }, now).ok, true);

  prepareDemand(world, 'food', now + 1);
  processWorld(world, now + 1);
  const filledOrder = world.orders.find((order) => (
    order.ownerType === 'population'
    && order.demandGroupId === 'food'
    && order.productId === 'wheat'
    && order.lastFilledAt === now + 1
  ));
  assert.ok(filledOrder);

  const firstCycleId = world.demandGroups.food.lastCycleId;
  prepareDemand(world, 'food', now + cycleMs + 1);
  processWorld(world, now + cycleMs + 1);
  const nextCycleId = world.demandGroups.food.lastCycleId;
  assert.ok(nextCycleId > firstCycleId);
  assert.equal(world.orders.some((order) => (
    order.ownerType === 'population'
    && order.demandGroupId === 'food'
    && order.productId === 'wheat'
    && Number(order.demandCycleId) < nextCycleId
    && (order.status === 'open' || order.status === 'partial')
  )), false);
  const nextOrder = world.orders.find((order) => (
    order.ownerType === 'population'
    && order.demandGroupId === 'food'
    && order.productId === 'wheat'
    && order.demandCycleId === nextCycleId
    && (order.status === 'open' || order.status === 'partial')
  ));
  assert.ok(nextOrder);
  assert.equal(nextOrder.price, Math.round(world.priceTransmission.products.wheat.referencePrice));
});

test('population-funded market demand does not scale with active player count', () => {
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
    };
  };

  const budgets = [1, 4, 9, 25, 121].map(foodBudgetFor);
  assert.ok(budgets[0].food > 0);
  assert.ok(budgets[0].household > 0);
  assert.ok(budgets.every((item) => item.food === budgets[0].food));
  assert.ok(budgets.every((item) => item.household === budgets[0].household));
});

test('population wallets continue funded demand without active players', () => {
  const world = createWorld(now);
  const player = ensurePlayer(world, alice, now);
  player.lastEconomicActivityAt = now - 8 * 24 * 60 * 60 * 1000;
  prepareDemand(world, 'food');
  processWorld(world, now + 1);
  assert.ok(world.demandGroups.food.lastBudget > 0);
  assert.ok(world.orders.some((order) => order.ownerType === 'population' && order.demandGroupId === 'food'));
});

test('player inventory never increases market demand budget or product allocation', () => {
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

  assert.equal(stocked.lastBudget, empty.lastBudget);
  assert.equal(stocked.lastClassAllocation.staples.shares.wheat, empty.lastClassAllocation.staples.shares.wheat);
  assert.equal(stocked.lastInventoryBoost, 0);
  assert.equal(stocked.lastStockValue, 0);
  assert.equal(availableOnly.lastBudget, splitAvailableFrozen.lastBudget);
});

test('consumer substitutes shift demand toward the cheaper grain without changing total budget', () => {
  const world = createWorld(now);
  const seller = ensurePlayer(world, bob, now);
  seller.inventories.wheat.available = 100;
  seller.inventories.rice.available = 100;
  deferDemand(world);
  assert.equal(applyAction(world, bob, 'placeOrder', {
    productId: 'wheat', side: 'sell', quantity: 100, price: 6,
  }, now + 1).ok, true);
  assert.equal(applyAction(world, bob, 'placeOrder', {
    productId: 'rice', side: 'sell', quantity: 100, price: 2,
  }, now + 2).ok, true);

  prepareDemand(world, 'food', now + 3);
  processWorld(world, now + 3);
  const shares = world.demandGroups.food.lastClassAllocation.basic.staples.shares;
  assert.ok(shares.rice > shares.wheat);
  assert.ok(world.demandGroups.food.lastBudget > 0);
});

test('beverage production paths shift toward cheaper fruit inputs', () => {
  const routeShares = ({ fruitPrice, milkPrice }) => {
    const world = createWorld(now);
    world.priceTransmission.products.fruit.referencePrice = fruitPrice;
    world.priceTransmission.products.milk.referencePrice = milkPrice;
    world.priceTransmission.products.sugar.referencePrice = 13;
    prepareDemand(world, 'food', now + 1);
    processWorld(world, now + 1);
    return world.demandGroups.food.recipeShares.beverage;
  };

  const fruitCheap = routeShares({ fruitPrice: 2, milkPrice: 12 });
  const milkCheap = routeShares({ fruitPrice: 8, milkPrice: 1 });
  assert.ok(fruitCheap['fruit-beverage'] > fruitCheap['milk-beverage']);
  assert.ok(milkCheap['milk-beverage'] > milkCheap['fruit-beverage']);
  assert.ok(fruitCheap['milk-beverage'] >= 0.05);
  assert.ok(milkCheap['fruit-beverage'] >= 0.05);
});

test('fruit participates in fresh direct demand without expanding the food budget', () => {
  const world = createWorld(now);
  ensurePlayer(world, alice, now);
  prepareDemand(world, 'food', now + 1);
  processWorld(world, now + 1);
  const fresh = world.demandGroups.food.lastClassAllocation.basic['fresh-drinks'];
  assert.ok(fresh.shares.fruit > 0);
  assert.ok(fresh.shares.beverage > 0);
  assert.ok(world.demandGroups.food.lastBudget > 0);
  assert.ok(world.orders.some((order) => order.ownerType === 'population' && order.productId === 'fruit' && order.demandTier === 'direct'));
});

test('complement gating prioritizes the bottleneck input for electronics', () => {
  const world = createWorld(now);
  const seller = ensurePlayer(world, bob, now);
  seller.inventories.plastic.available = 1_000;
  deferDemand(world);
  assert.equal(applyAction(world, bob, 'placeOrder', {
    productId: 'plastic', side: 'sell', quantity: 1_000, price: 24,
  }, now + 1).ok, true);

  prepareDemand(world, 'household', now + 2);
  processWorld(world, now + 2);
  const allocation = world.demandGroups.household.lastAllocation;
  assert.ok(allocation.copper.requiredQuantity > allocation.plastic.requiredQuantity);
  const relations = world.demandGroups.household.lastDerivedRelations
    .filter((item) => item.outputProductId === 'electronics');
  assert.ok(relations.find((item) => item.inputProductId === 'copper').complementGate
    > relations.find((item) => item.inputProductId === 'plastic').complementGate);
});

test('downstream price signals move upstream only after relation lag cycles', () => {
  const world = createWorld(now);
  deferDemand(world, now + 4 * cycleMs);
  world.markets.electronics.priceHistory.push({
    price: 128, quantity: 20, createdAt: now + 1, takerSide: 'buy',
  });
  const initialCopper = world.priceTransmission.products.copper.referencePrice;

  processPriceTransmission(world, now + cycleMs + 1);
  assert.equal(world.priceTransmission.products.copper.referencePrice, initialCopper);
  processPriceTransmission(world, now + 2 * cycleMs + 1);
  processPriceTransmission(world, now + 3 * cycleMs + 1);
  assert.ok(world.priceTransmission.products.copper.referencePrice > initialCopper);
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

test('new worlds create private market demand orders during the first authoritative state read', () => {
  const store = new EconomyStore(':memory:');
  try {
    const state = store.getState(alice, now);
    const externalBuyOrders = state.orders.filter((order) => order.isOwn === false && order.side === 'buy');
    assert.ok(externalBuyOrders.length > 0);
    assert.ok(externalBuyOrders.every((order) => (
      !Object.hasOwn(order, 'ownerType')
      && !Object.hasOwn(order, 'ownerName')
      && !Object.hasOwn(order, 'demandGroupId')
      && !Object.hasOwn(order, 'demandTier')
    )));
    const persisted = JSON.parse(String(store.selectWorld.get().state_json));
    const marketOrders = persisted.orders.filter((order) => order.ownerType === 'population');
    assert.ok(marketOrders.length > 0);
    assert.deepEqual([...new Set(marketOrders.map((order) => order.ownerName))].sort(), [
      '家庭消费市场需求', '食品市场需求',
    ]);
    assert.equal(persisted.version, 14);
    assert.equal(persisted.marketDemand.modelVersion, MARKET_DEMAND_MODEL_VERSION);
    assert.ok(persisted.demandGroups.food.lastCommitted <= persisted.demandGroups.food.lastBudget);
    assert.ok(persisted.demandGroups.household.lastCommitted <= persisted.demandGroups.household.lastBudget);
  } finally {
    store.close();
  }
});

test('legacy demand migration immediately rebuilds market demand without losing player assets', () => {
  const world = createWorld(now);
  const player = ensurePlayer(world, alice, now);
  player.inventories.wheat.available = 2;
  delete world.marketDemand;
  world.version = 12;
  world.demandGroups.food.lastBudget = 500;
  world.demandGroups.household.lastBudget = 480;
  world.orders = [{
    id: 'player-wheat-sell', assetKind: 'commodity', assetId: 'wheat', productId: 'wheat',
    side: 'sell', ownerType: 'player', ownerId: alice.id, ownerName: 'Alice',
    price: 99, quantity: 2, remaining: 2, status: 'open', createdAt: now,
  }, {
    id: 'legacy-demand', assetKind: 'commodity', assetId: 'wheat', productId: 'wheat',
    side: 'buy', ownerType: 'population', ownerName: '饮食需求', demandGroupId: 'food',
    price: 2, quantity: 2, remaining: 2, status: 'open', createdAt: now,
  }];

  migrateWorld(world, now);
  assert.equal(world.version, 14);
  assert.equal(world.marketDemand.modelVersion, MARKET_DEMAND_MODEL_VERSION);
  assert.deepEqual(world.orders.map((order) => order.id), ['player-wheat-sell']);
  assert.equal(player.inventories.wheat.available, 2);
  assert.equal(world.demandGroups.food.nextDemandAt, now);
  processWorld(world, now + 1);
  assert.ok(world.orders.some((order) => order.id === 'player-wheat-sell'));
  assert.ok(world.orders.some((order) => order.ownerType === 'population'));
});

test('market demand model version 2 migrates to version 3 without resetting player assets', () => {
  const world = createWorld(now);
  const player = ensurePlayer(world, alice, now);
  player.credits = 777;
  player.inventories.wheat.available = 9;
  world.marketDemand.modelVersion = 2;
  world.orders = [
    { id: 'player-order-v2', assetKind: 'commodity', assetId: 'wheat', productId: 'wheat', side: 'sell', ownerType: 'player', ownerId: alice.id, ownerName: 'Alice', price: 3, quantity: 2, remaining: 2, status: 'open', createdAt: now },
    { id: 'market-order-v2', assetKind: 'commodity', assetId: 'food', productId: 'food', side: 'buy', ownerType: 'population', ownerName: '食品市场需求', demandGroupId: 'food', demandTier: 'direct', price: 15, quantity: 2, remaining: 2, status: 'open', createdAt: now },
  ];

  migrateWorld(world, now);

  assert.equal(world.marketDemand.modelVersion, MARKET_DEMAND_MODEL_VERSION);
  assert.deepEqual(world.orders.map((order) => order.id), ['player-order-v2']);
  assert.equal(player.credits, 777);
  assert.equal(player.inventories.wheat.available, 9);
  assert.deepEqual(player.inventories.fruit, { available: 0, frozen: 0 });
  assert.ok(world.markets.fruit);
  assert.ok(world.marketDemand.priceTransmission.products.fruit);
  assert.equal(world.demandGroups.food.nextDemandAt, now);
  processWorld(world, now + 1);
  assert.ok(world.orders.some((order) => order.ownerType === 'population'));
});

test('migration removes obsolete system orders while preserving player orders', () => {
  const world = createWorld(now);
  const player = ensurePlayer(world, alice, now);
  player.credits = 777;
  player.inventories.wheat.available = 9;
  delete world.marketDemand;
  world.version = 9;
  world.orders = [
    { id: 'player-order', assetKind: 'commodity', assetId: 'wheat', productId: 'wheat', side: 'sell', ownerType: 'player', ownerId: alice.id, ownerName: 'Alice', price: 3, quantity: 2, remaining: 2, status: 'open', createdAt: now },
    { id: 'market-order', productId: 'wheat', side: 'buy', ownerType: 'market', ownerName: '市场流动采购', price: 2, quantity: 2, remaining: 2, status: 'open', createdAt: now },
    { id: 'enterprise-order', productId: 'machinery', side: 'buy', ownerType: 'population', ownerName: '企业采购', price: 60, quantity: 1, remaining: 1, status: 'open', createdAt: now },
  ];

  migrateWorld(world, now);

  assert.equal(world.version, 14);
  assert.deepEqual(world.orders.map((order) => order.id), ['player-order']);
  assert.equal(player.credits, 777);
  assert.equal(player.inventories.wheat.available, 9);
});

test('world version 8 migration restarts electronics and upgrades market demand state without resetting assets', () => {
  const world = createWorld(now);
  const player = ensurePlayer(world, alice, now);
  delete world.marketDemand;
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

  assert.equal(world.version, 14);
  assert.equal(player.credits, 777);
  assert.equal(player.inventories.plastic.available, 9);
  assert.equal(player.inventories.copper.available, 4);
  assert.equal(player.facilityGroups[0].cycleStartedAt, now);
  assert.deepEqual(Object.keys(world.demandGroups).sort(), ['food', 'household']);
  assert.equal(world.marketDemand.modelVersion, MARKET_DEMAND_MODEL_VERSION);
  assert.ok(world.priceTransmission.products.electronics);
});

test('commodity order fills preserve every exact player resting price without system liquidity', () => {
  const world = createWorld(now);
  world.orders = [];
  deferDemand(world);
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
