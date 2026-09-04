import assert from 'node:assert/strict';
import test from 'node:test';
import { CURRENT_CLIENT_STATE_VERSION } from '../shared/economy-state-version.js';
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
import { readSegmentedWorld } from '../src/world-storage-v2.js';

const alice = { id: 1, email: 'alice@example.com', name: 'Alice' };
const bob = { id: 2, email: 'bob@example.com', name: 'Bob' };
const carol = { id: 3, email: 'carol@example.com', name: 'Carol' };
const now = 1_700_000_000_000;
const cycleMs = 5 * 60 * 1000;

function persistedWorld(store) {
  return readSegmentedWorld(store)?.world;
}

function prepareDemand(world, groupId, at = now) {
  world.demandGroups[groupId].nextDemandAt = at;
  world.demandGroups[groupId].lastCycleId = Math.floor(at / cycleMs) - 1;
}

function deferDemand(world, at = now + cycleMs) {
  for (const state of Object.values(world.demandGroups)) state.nextDemandAt = at;
}

test('different products settle independently at their daily official prices without a shared player order book', () => {
  const world = createWorld(now);
  deferDemand(world);
  const seller = ensurePlayer(world, bob, now);
  const buyer = ensurePlayer(world, alice, now);
  buyer.inventories.ore.available = 0;
  buyer.inventories.wheat.available = 0;
  seller.inventories.ore.available = 10;
  seller.credits = 0;
  buyer.credits = 1_000;

  const orePrice = world.markets.ore.officialPrice;
  const wheatPrice = world.markets.wheat.officialPrice;
  const oreSell = applyAction(world, bob, 'placeOrder', {
    productId: 'ore', side: 'sell', quantity: 5, price: 6,
  }, now + 1);
  const wheatBuy = applyAction(world, alice, 'placeOrder', {
    productId: 'wheat', side: 'buy', quantity: 5, price: 9,
  }, now + 2);
  const oreBuy = applyAction(world, alice, 'placeOrder', {
    productId: 'ore', side: 'buy', quantity: 3, price: 9,
  }, now + 3);

  assert.equal(oreSell.ok, true);
  assert.equal(wheatBuy.ok, true);
  assert.equal(oreBuy.ok, true);
  assert.equal(oreSell.executedPrice, orePrice);
  assert.equal(wheatBuy.executedPrice, wheatPrice);
  assert.equal(oreBuy.executedPrice, orePrice);
  assert.equal(seller.inventories.ore.available, 5);
  assert.equal(seller.inventories.ore.frozen, 0);
  assert.equal(buyer.inventories.wheat.available, 5);
  assert.equal(buyer.inventories.ore.available, 3);
  assert.equal(world.orders.some((order) => order.ownerType === 'player' && ['open', 'partial'].includes(order.status)), false);
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
        stats: { populationIssued: 0, systemSinks: 0, commodityVolume: 0, facilityVolume: 0 },
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
  assert.equal(world.players['1'].inventories.wheat.available, 8);
  assert.equal(world.players['1'].inventories.wheat.frozen, 1);
  assert.equal(world.orders[0].productId, 'wheat');
  assert.equal(world.orders[0].status, 'cancelled');
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

  assert.deepEqual(player.inventories.wheat, { available: 10, frozen: 0, inTransit: 0 });
  assert.equal(Object.hasOwn(player.inventories, 'grain'), false);
  assert.equal(world.orders[0].assetId, 'wheat');
  assert.equal(world.orders[0].status, 'cancelled');
  assert.equal(world.orders[0].productId, 'wheat');
  assert.equal(world.markets.wheat.productId, 'wheat');
  assert.equal(Object.hasOwn(world.markets, 'grain'), false);
  assert.equal(world.marketDemand.modelVersion, MARKET_DEMAND_MODEL_VERSION);
});

test('idempotency returns the original response without applying an action twice', () => {
  const store = new EconomyStore(':memory:');
  try {
    const request = {
      action: 'renamePlayer',
      payload: { playerName: 'Alice Updated' },
      requestKey: 'request-12345678',
      method: 'PATCH',
      path: '/api/game/profile',
    };
    const first = store.apply(alice, request, now);
    const second = store.apply(alice, request, now + 500);
    assert.deepEqual(second, first);
    assert.equal(store.getState(alice, now + 1_000).playerName, 'Alice Updated');
  } finally {
    store.close();
  }
});

test('client state uses the current version and exposes no factory instances', () => {
  const store = new EconomyStore(':memory:');
  try {
    const state = store.getState(alice, now);
    assert.equal(state.version, CURRENT_CLIENT_STATE_VERSION);
    assert.equal(Array.isArray(state.facilityGroups), true);
    assert.equal(Object.hasOwn(state, 'facilities'), false);
    assert.equal(state.products.length, 38);
    assert.equal(state.facilityTypes.length, 26);
  } finally {
    store.close();
  }
});

test('expanded industry catalog exposes fruit and complete production chains', () => {
  assert.equal(PRODUCT_CATALOG.length, 38);
  assert.equal(FACILITY_TYPE_CATALOG.length, 26);

  const expectedProducts = [
    'wheat', 'rice', 'cotton', 'sugarcane', 'fruit', 'timber', 'ore', 'copper-ore', 'crude-oil',
    'meat', 'eggs', 'milk', 'fish', 'wool', 'flour', 'sugar', 'lumber', 'steel', 'copper',
    'plastic', 'industrial-fuel', 'industrial-chemicals', 'fertilizer', 'feed', 'veterinary-medicine', 'textile', 'pulp', 'food', 'beverage',
    'prepared-meal', 'paper', 'furniture', 'clothing', 'tools', 'machinery', 'tractor', 'electronics',
    'appliance',
  ];
  const expectedFacilities = [
    'farm', 'orchard', 'ranch', 'fishery',
    'logging-camp', 'mine', 'oil-field', 'mill', 'sawmill', 'feed-factory',
    'pulp-mill', 'steelworks', 'textile-mill', 'food-factory', 'paper-mill',
    'refinery', 'fertilizer-factory', 'veterinary-medicine-factory', 'beverage-factory',
    'furniture-factory', 'garment-factory', 'tool-workshop', 'machine-factory', 'tractor-factory',
    'electronics-factory', 'appliance-factory',
  ];
  assert.deepEqual(PRODUCT_CATALOG.map((product) => product.id), expectedProducts);
  assert.deepEqual(FACILITY_TYPE_CATALOG.map((facility) => facility.id), expectedFacilities);
  const facilityComplexityRanks = FACILITY_TYPE_CATALOG.map((facility) => Number(facility.complexity.slice(1)));
  assert.deepEqual(
    facilityComplexityRanks,
    [...facilityComplexityRanks].sort((left, right) => left - right),
    '工厂正式目录必须按复杂度 C1 至 C7 升序排列',
  );

  const expectedPrices = {
    wheat: 1.2, rice: 1.2, cotton: 1.2, sugarcane: 1.2, fruit: 1.3, timber: 6, ore: 7,
    'copper-ore': 7, 'crude-oil': 9, meat: 2.4, eggs: 2.4, milk: 2.4, fish: 2.5, wool: 2.4,
    flour: 13, sugar: 13, lumber: 17, steel: 29, copper: 29, plastic: 30, 'industrial-fuel': 4, 'industrial-chemicals': 5, fertilizer: 6.76, feed: 5.8,
    'veterinary-medicine': 14.1, textile: 20, pulp: 20, food: 15, beverage: 18,
    'prepared-meal': 18, paper: 15, furniture: 24, clothing: 55, tools: 12, machinery: 15.55,
    tractor: 15.35, electronics: 84, appliance: 92,
  };
  assert.deepEqual(Object.fromEntries(PRODUCT_CATALOG.map((product) => [product.id, product.basePrice])), expectedPrices);

  const productIds = new Set(expectedProducts);
  const expectedProfitByComplexity = { C3: 6, C4: 6, C5: 8, C6: 10, C7: 12 };
  const expectedC1ProfitByFacility = { farm: 0.6, orchard: 0.9, ranch: 0.8, fishery: 1 };
  const expectedC2Profits = [3, 6, 9, 10.5];
  for (const product of PRODUCT_CATALOG) {
    assert.ok(Math.abs(product.basePrice - Math.round(product.basePrice * 100) / 100) < 1e-9, `${product.id} 初始参考价最多保留两位小数`);
  }
  for (const facility of FACILITY_TYPE_CATALOG) {
    assert.ok(Array.isArray(facility.recipes) && facility.recipes.length >= 1);
    assert.ok(facility.recipes.some((recipe) => recipe.id === facility.defaultRecipeId));
    const defaultRecipe = facility.recipes.find((recipe) => recipe.id === facility.defaultRecipeId);
    const methodGroup = facility.productionMethodGroups.find((group) => group.id === 'operation');
    const defaultMethodId = methodGroup?.defaultMethodId;
    const methodIds = methodGroup?.methods.map((method) => method.id) ?? [];
    assert.equal(facility.cycleMs, defaultRecipe.cycleMs);
    assert.equal(facility.operatingCost, defaultRecipe.operatingCost);
    for (const recipe of facility.recipes) {
      assert.ok(Array.isArray(recipe.inputs), `${facility.id}/${recipe.id} 必须使用 inputs[]`);
      assert.equal(Number.isInteger(recipe.cycleMs / 1_000), true, `${facility.id}/${recipe.id} 周期秒数必须为整数`);
      assert.ok(Math.abs(recipe.operatingCost - Math.round(recipe.operatingCost * 100) / 100) < 1e-9, `${facility.id}/${recipe.id} 周期成本最多保留两位小数`);
      assert.equal(productIds.has(recipe.output.productId), true);
      assert.equal(Number.isInteger(recipe.output.quantity), true);
      for (const input of recipe.inputs) {
        assert.equal(productIds.has(input.productId), true);
        assert.equal(Number.isInteger(input.quantity), true);
      }
      const inputValue = recipe.inputs.reduce((sum, input) => sum + expectedPrices[input.productId] * input.quantity, 0);
      const profit = (expectedPrices[recipe.output.productId] * recipe.output.quantity - inputValue - recipe.operatingCost)
        * 60_000 / recipe.cycleMs;
      if (facility.complexity === 'C1' && recipe.productionMethodId !== defaultMethodId) continue;
      const expectedProfit = facility.complexity === 'C1'
        ? expectedC1ProfitByFacility[facility.id]
        : facility.complexity === 'C2'
          ? expectedC2Profits[methodIds.indexOf(recipe.productionMethodId)]
          : expectedProfitByComplexity[facility.complexity];
      assert.ok(Number.isFinite(expectedProfit), `${facility.id}/${recipe.id} 缺少参考分钟利润规则`);
      assert.ok(Math.abs(profit - expectedProfit) < 1e-9, `${facility.id}/${recipe.id} 参考分钟利润不正确`);
    }
  }

  const facilities = new Map(FACILITY_TYPE_CATALOG.map((facility) => [facility.id, facility]));
  const standardRecipes = (facility) => facility.recipes.filter(
    (recipe) => recipe.productionMethodId === facility.productionMethodGroups[0].defaultMethodId,
  );
  assert.deepEqual(standardRecipes(facilities.get('farm')).map((recipe) => recipe.output.productId), ['wheat', 'rice', 'cotton', 'sugarcane']);
  assert.equal(facilities.get('orchard').recipes[0].output.productId, 'fruit');
  assert.equal(facilities.get('fishery').recipes[0].output.productId, 'fish');
  assert.equal(facilities.get('mill').name, '磨坊');
  assert.deepEqual(standardRecipes(facilities.get('mill')).map((recipe) => recipe.output.productId), ['flour', 'sugar']);
  assert.deepEqual(standardRecipes(facilities.get('food-factory')).map((recipe) => recipe.output.productId), ['food', 'prepared-meal']);
  assert.deepEqual(standardRecipes(facilities.get('beverage-factory')).map((recipe) => recipe.inputs), [
    [{ productId: 'sugar', quantity: 1 }, { productId: 'milk', quantity: 1 }],
    [{ productId: 'fruit', quantity: 2 }, { productId: 'sugar', quantity: 1 }],
  ]);
  assert.deepEqual(facilities.get('appliance-factory').recipes[0].inputs, [
    { productId: 'machinery', quantity: 1 }, { productId: 'electronics', quantity: 1 },
  ]);
  assert.deepEqual(standardRecipes(facilities.get('feed-factory'))[0].inputs, [
    { productId: 'wheat', quantity: 2 }, { productId: 'fruit', quantity: 1 },
  ]);
  assert.deepEqual(standardRecipes(facilities.get('veterinary-medicine-factory'))[0].inputs, [
    { productId: 'fertilizer', quantity: 1 }, { productId: 'plastic', quantity: 1 },
  ]);
  assert.deepEqual(standardRecipes(facilities.get('tractor-factory'))[0].inputs, [
    { productId: 'machinery', quantity: 1 }, { productId: 'steel', quantity: 1 },
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
    assert.ok(state.directCommitted <= state.lastBudget + 0.000001);
    assert.ok(state.derivedCommitted <= state.lastBudget + 0.000001);
    assert.equal(state.lastInventoryBoost, 0);
    assert.equal(state.lastStockValue, 0);
  }
});


test('market demand retains 70% of zero-fill orders and publishes a bounded demand curve', () => {
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
    && order.productId === 'wheat'
    && order.demandCycleId === firstCycleId
    && order.status === 'open'
  ));
  assert.ok(firstOrder);
  const firstRemaining = firstOrder.remaining;

  prepareDemand(world, 'food', now + cycleMs + 1);
  processWorld(world, now + cycleMs + 1);

  assert.ok(firstOrder.remaining > 0);
  assert.ok(firstOrder.remaining <= Math.floor(firstRemaining * 0.70));
  const nextCycleId = world.demandGroups.food.lastCycleId;
  const nextOrders = world.orders.filter((order) => (
    order.ownerType === 'population'
    && order.demandGroupId === 'food'
    && order.demandTier === 'direct'
    && order.productId === 'wheat'
    && order.demandCycleId === nextCycleId
    && (order.status === 'open' || order.status === 'partial')
  ));
  assert.ok(nextOrders.length >= 2);
  assert.ok(new Set(nextOrders.map((order) => order.price)).size >= 2);
  assert.ok(world.demandGroups.food.lastRetainedOrderValue > 0);
  assert.ok(world.demandGroups.food.lastOpenOrderValue <= world.demandGroups.food.lastBudget * 2.5);
});

test('market demand retains a partially filled internal carried order and publishes a cent-priced next curve', () => {
  const world = createWorld(now);
  ensurePlayer(world, alice, now);
  deferDemand(world, now + 10 * cycleMs);
  prepareDemand(world, 'food', now + 1);
  processWorld(world, now + 1);

  const firstCycleId = world.demandGroups.food.lastCycleId;
  const carried = world.orders.find((order) => (
    order.ownerType === 'population'
    && order.demandGroupId === 'food'
    && order.productId === 'wheat'
    && order.demandCycleId === firstCycleId
    && order.status === 'open'
    && order.quantity > 1
  ));
  assert.ok(carried);
  carried.status = 'partial';
  carried.remaining = carried.quantity - 1;
  carried.fills = [{
    id: 'internal-partial-fill',
    quantity: 1,
    price: carried.price,
    total: carried.price,
    createdAt: now + 2,
    takerSide: 'sell',
  }];
  carried.lastFilledAt = now + 2;

  prepareDemand(world, 'food', now + cycleMs + 1);
  processWorld(world, now + cycleMs + 1);
  const nextCycleId = world.demandGroups.food.lastCycleId;
  assert.ok(nextCycleId > firstCycleId);
  assert.equal(world.orders.some((order) => (
    order.id === carried.id
    && (order.status === 'open' || order.status === 'partial')
  )), true);
  const nextOrder = world.orders.find((order) => (
    order.ownerType === 'population'
    && order.demandGroupId === 'food'
    && order.productId === 'wheat'
    && order.demandCycleId === nextCycleId
    && (order.status === 'open' || order.status === 'partial')
  ));
  assert.ok(nextOrder);
  assert.equal(nextOrder.price, Number(nextOrder.price.toFixed(2)));
}

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
  assert.equal(stocked.lastClassAllocation.basic.staples.shares.wheat, empty.lastClassAllocation.basic.staples.shares.wheat);
  assert.equal(stocked.lastInventoryBoost, 0);
  assert.equal(stocked.lastStockValue, 0);
  assert.equal(availableOnly.lastBudget, splitAvailableFrozen.lastBudget);
});

test('consumer substitutes shift demand toward the cheaper grain without changing total budget', () => {
  const world = createWorld(now);
  ensurePlayer(world, bob, now);
  world.priceTransmission.products.wheat.referencePrice = 6;
  world.priceTransmission.products.rice.referencePrice = 2;

  prepareDemand(world, 'food', now + 3);
  processWorld(world, now + 3);
  const shares = world.demandGroups.food.lastClassAllocation.basic.staples.shares;
  assert.ok(shares.rice > shares.wheat);
  assert.ok(world.demandGroups.food.lastBudget > 0);
}

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
  ensurePlayer(world, bob, now);
  world.priceTransmission.products.plastic.referencePrice = 24;

  prepareDemand(world, 'household', now + 2);
  processWorld(world, now + 2);
  const allocation = world.demandGroups.household.lastAllocation;
  assert.ok(allocation.copper.requiredQuantity > allocation.plastic.requiredQuantity);
  const relations = world.demandGroups.household.lastDerivedRelations
    .filter((item) => item.outputProductId === 'electronics');
  assert.ok(relations.find((item) => item.inputProductId === 'copper').complementGate
    > relations.find((item) => item.inputProductId === 'plastic').complementGate);
}

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
    const firstWorld = persistedWorld(store);
    const initialActivity = firstWorld.players[String(alice.id)].lastEconomicActivityAt;

    store.getStateSnapshot(alice, first.revision, now + 1_000);
    const afterPoll = persistedWorld(store);
    assert.equal(afterPoll.players[String(alice.id)].lastEconomicActivityAt, initialActivity);

    const success = store.apply(alice, {
      action: 'bankDeposit', payload: { amount: 1 }, requestKey: 'activity-success', method: 'POST', path: '/api/game/bank/deposits',
    }, now + 10_000);
    assert.equal(success.result.ok, true);
    const afterSuccess = persistedWorld(store);
    assert.equal(afterSuccess.players[String(alice.id)].lastEconomicActivityAt, now + 10_000);

    const failure = store.apply(alice, {
      action: 'bankDeposit', payload: { amount: 999_999 }, requestKey: 'activity-failure', method: 'POST', path: '/api/game/bank/deposits',
    }, now + 10_001);
    assert.equal(failure.result.ok, false);
    const afterFailure = persistedWorld(store);
    assert.equal(afterFailure.players[String(alice.id)].lastEconomicActivityAt, now + 10_000);
  } finally {
    store.close();
  }
});

test('new worlds create private market demand orders without publishing them in main state', () => {
  const store = new EconomyStore(':memory:');
  try {
    const state = store.getState(alice, now);
    assert.equal(state.orders.some((order) => order.isOwn === false), false);
    const persisted = persistedWorld(store);
    const marketOrders = persisted.orders.filter((order) => order.ownerType === 'population');
    assert.ok(marketOrders.length > 0);
    assert.deepEqual([...new Set(marketOrders.map((order) => order.ownerName))].sort(), [
      '家庭消费市场需求', '食品市场需求',
    ]);
    assert.equal(persisted.version, 32);
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
  assert.equal(world.version, 32);
  assert.equal(world.marketDemand.modelVersion, MARKET_DEMAND_MODEL_VERSION);
  assert.deepEqual(world.orders.map((order) => order.id), ['player-wheat-sell']);
  assert.equal(world.orders[0].status, 'cancelled');
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
  assert.equal(world.orders[0].status, 'cancelled');
  assert.equal(player.credits, 777);
  assert.equal(player.inventories.wheat.available, 9);
  assert.deepEqual(player.inventories.fruit, { available: 0, frozen: 0, inTransit: 0 });
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

  assert.equal(world.version, 32);
  assert.deepEqual(world.orders.map((order) => order.id), ['player-order']);
  assert.equal(world.orders[0].status, 'cancelled');
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

  assert.equal(world.version, 32);
  assert.equal(player.credits, 777);
  assert.equal(player.inventories.plastic.available, 9);
  assert.equal(player.inventories.copper.available, 4);
  assert.equal(player.facilityGroups[0].cycleStartedAt, now);
  assert.deepEqual(Object.keys(world.demandGroups).sort(), ['food', 'household']);
  assert.equal(world.marketDemand.modelVersion, MARKET_DEMAND_MODEL_VERSION);
  assert.ok(world.priceTransmission.products.electronics);
});

test('commodity compatibility fills always record the daily official price instead of player supplied prices', () => {
  const world = createWorld(now);
  world.orders = [];
  deferDemand(world);
  const buyer = ensurePlayer(world, alice, now);
  const sellerA = ensurePlayer(world, bob, now);
  const sellerB = ensurePlayer(world, carol, now);
  buyer.credits = 100;
  sellerA.credits = 0;
  sellerB.credits = 0;
  sellerA.inventories.wheat.available = 1;
  sellerB.inventories.wheat.available = 1;
  const officialPrice = world.markets.wheat.officialPrice;

  assert.equal(applyAction(world, bob, 'placeOrder', { productId: 'wheat', side: 'sell', quantity: 1, price: 5 }, now + 1).ok, true);
  assert.equal(applyAction(world, carol, 'placeOrder', { productId: 'wheat', side: 'sell', quantity: 1, price: 6 }, now + 2).ok, true);
  assert.equal(applyAction(world, alice, 'placeOrder', { productId: 'wheat', side: 'buy', quantity: 2, price: 20 }, now + 3).ok, true);

  const playerOrders = world.orders.filter((order) => order.ownerType === 'player');
  assert.equal(playerOrders.length, 3);
  assert.ok(playerOrders.every((order) => order.status === 'filled' && order.remaining === 0));
  assert.ok(playerOrders.every((order) => order.price === officialPrice));
  assert.ok(playerOrders.every((order) => order.fills.length === 1 && order.fills[0].price === officialPrice));
  assert.equal(buyer.credits, Number((100 - officialPrice * 2).toFixed(6)));
  assert.equal(buyer.frozenCredits, 0);
  assert.equal(buyer.inventories.wheat.available, 2);
  assert.equal(sellerA.inventories.wheat.available, 0);
  assert.equal(sellerB.inventories.wheat.available, 0);
  assert.equal(world.orders.some((order) => order.ownerType === 'player' && ['open', 'partial'].includes(order.status)), false);
});
