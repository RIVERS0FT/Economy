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

function prepareStapleDemand(world) {
  world.demandGroups.staples.nextDemandAt = now;
  world.demandGroups.staples.lastCycleId = -1;
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

test('staple demand shifts budget to rice when wheat is expensive', () => {
  const world = createWorld(now);
  const wheatSeller = ensurePlayer(world, bob, now);
  const riceSeller = ensurePlayer(world, carol, now);
  wheatSeller.inventories.wheat.frozen = 40;
  riceSeller.inventories.rice.frozen = 40;
  world.orders = [
    { id: 'wheat-ask', productId: 'wheat', side: 'sell', ownerType: 'player', ownerId: bob.id, ownerName: 'Bob', price: 9, quantity: 40, remaining: 40, status: 'open', createdAt: now },
    { id: 'rice-ask', productId: 'rice', side: 'sell', ownerType: 'player', ownerId: carol.id, ownerName: 'Carol', price: 6, quantity: 40, remaining: 40, status: 'open', createdAt: now + 1 },
  ];
  prepareStapleDemand(world);

  processWorld(world, now + 1);
  const allocation = world.demandGroups.staples.lastAllocation;
  assert.ok(allocation.rice.budget > allocation.wheat.budget);
  assert.ok(world.orders.some((order) => order.demandGroupId === 'staples' && order.productId === 'food'));
  assert.ok(Object.values(allocation).reduce((sum, item) => sum + item.budget, 0) <= 330);

  const orderCount = world.orders.filter((order) => order.demandGroupId === 'staples').length;
  processWorld(world, now + 2);
  assert.equal(world.orders.filter((order) => order.demandGroupId === 'staples').length, orderCount);
});

test('food competes with wheat and rice through utility-adjusted prices and capped budget shares', () => {
  const world = createWorld(now);
  const sellerA = ensurePlayer(world, bob, now);
  const sellerB = ensurePlayer(world, carol, now);
  sellerA.inventories.wheat.frozen = 100;
  sellerA.inventories.food.frozen = 100;
  sellerB.inventories.rice.frozen = 100;
  world.orders = [
    { id: 'wheat-base', productId: 'wheat', side: 'sell', ownerType: 'player', ownerId: bob.id, ownerName: 'Bob', price: 6, quantity: 100, remaining: 100, status: 'open', createdAt: now },
    { id: 'rice-base', productId: 'rice', side: 'sell', ownerType: 'player', ownerId: carol.id, ownerName: 'Carol', price: 6, quantity: 100, remaining: 100, status: 'open', createdAt: now + 1 },
    { id: 'food-base', productId: 'food', side: 'sell', ownerType: 'player', ownerId: bob.id, ownerName: 'Bob', price: 18, quantity: 100, remaining: 100, status: 'open', createdAt: now + 2 },
  ];
  prepareStapleDemand(world);

  processWorld(world, now + 1);
  const allocation = world.demandGroups.staples.lastAllocation;
  assert.equal(allocation.wheat.utilityPerUnit, 1);
  assert.equal(allocation.rice.utilityPerUnit, 1);
  assert.equal(allocation.food.utilityPerUnit, 3);
  assert.ok(allocation.food.budget > allocation.wheat.budget);
  assert.ok(allocation.food.budget > allocation.rice.budget);
  assert.ok(allocation.food.budget <= 264);
  assert.ok(allocation.wheat.budget <= 165);
  assert.ok(allocation.rice.budget <= 165);
  assert.ok(world.demandGroups.staples.lastCommitted <= 330);
  assert.equal(
    world.orders.filter((order) => order.ownerType === 'population' && order.productId === 'food')
      .every((order) => order.demandGroupId === 'staples'),
    true,
  );
});

test('food demand yields to grains when its utility-adjusted price exceeds the ceiling', () => {
  const world = createWorld(now);
  const seller = ensurePlayer(world, bob, now);
  seller.inventories.wheat.frozen = 100;
  seller.inventories.rice.frozen = 100;
  seller.inventories.food.frozen = 100;
  world.orders = [
    { id: 'wheat-cheap', productId: 'wheat', side: 'sell', ownerType: 'player', ownerId: bob.id, ownerName: 'Bob', price: 6, quantity: 100, remaining: 100, status: 'open', createdAt: now },
    { id: 'rice-cheap', productId: 'rice', side: 'sell', ownerType: 'player', ownerId: bob.id, ownerName: 'Bob', price: 6, quantity: 100, remaining: 100, status: 'open', createdAt: now + 1 },
    { id: 'food-expensive', productId: 'food', side: 'sell', ownerType: 'player', ownerId: bob.id, ownerName: 'Bob', price: 37, quantity: 100, remaining: 100, status: 'open', createdAt: now + 2 },
  ];
  prepareStapleDemand(world);

  processWorld(world, now + 1);
  const allocation = world.demandGroups.staples.lastAllocation;
  assert.equal(allocation.food.budget, 0);
  assert.equal(allocation.food.quantity, 0);
  assert.ok(allocation.wheat.budget > 0);
  assert.ok(allocation.rice.budget > 0);
});

test('staple demand leaves budget unspent when every substitute is above the ceiling', () => {
  const world = createWorld(now);
  const seller = ensurePlayer(world, bob, now);
  seller.inventories.wheat.frozen = 20;
  seller.inventories.rice.frozen = 20;
  seller.inventories.food.frozen = 20;
  world.orders = [
    { id: 'wheat-expensive', productId: 'wheat', side: 'sell', ownerType: 'player', ownerId: bob.id, ownerName: 'Bob', price: 13, quantity: 20, remaining: 20, status: 'open', createdAt: now },
    { id: 'rice-expensive', productId: 'rice', side: 'sell', ownerType: 'player', ownerId: bob.id, ownerName: 'Bob', price: 13, quantity: 20, remaining: 20, status: 'open', createdAt: now + 1 },
    { id: 'food-too-expensive', productId: 'food', side: 'sell', ownerType: 'player', ownerId: bob.id, ownerName: 'Bob', price: 37, quantity: 20, remaining: 20, status: 'open', createdAt: now + 2 },
  ];
  prepareStapleDemand(world);
  processWorld(world, now + 1);
  assert.equal(world.orders.some((order) => order.demandGroupId === 'staples'), false);
  assert.equal(world.demandGroups.staples.lastCommitted, 0);
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

test('client state uses version 12 and exposes no factory instances', () => {
  const store = new EconomyStore(':memory:');
  try {
    const state = store.getState(alice, now);
    assert.equal(state.version, 12);
    assert.equal(Array.isArray(state.facilityGroups), true);
    assert.equal(Object.hasOwn(state, 'facilities'), false);
    assert.equal(state.products.length, 13);
    assert.equal(state.facilityTypes.length, 12);
  } finally {
    store.close();
  }
});


test('expanded industry catalog exposes complete production chains', () => {
  assert.equal(PRODUCT_CATALOG.length, 13);
  assert.equal(FACILITY_TYPE_CATALOG.length, 12);

  const productIds = new Set(PRODUCT_CATALOG.map((product) => product.id));
  const facilityIds = new Set(FACILITY_TYPE_CATALOG.map((facility) => facility.id));
  assert.equal(productIds.size, PRODUCT_CATALOG.length);
  assert.equal(facilityIds.size, FACILITY_TYPE_CATALOG.length);

  const expectedPrices = {
    wheat: 2,
    rice: 2,
    timber: 5,
    ore: 6,
    'crude-oil': 8,
    flour: 13,
    lumber: 15,
    steel: 24,
    plastic: 24,
    food: 15,
    furniture: 20,
    machinery: 60,
    electronics: 64,
  };
  assert.deepEqual(Object.fromEntries(PRODUCT_CATALOG.map((product) => [product.id, product.basePrice])), expectedPrices);

  const expectedFacilityBalance = {
    farm: [120_000, 6],
    'logging-camp': [60_000, 9],
    mine: [60_000, 11],
    'oil-field': [60_000, 15],
    mill: [40_000, 7],
    sawmill: [40_000, 3],
    steelworks: [40_000, 4],
    refinery: [40_000, 6],
    'food-factory': [50_000, 14],
    'furniture-factory': [60_000, 4],
    'machine-factory': [60_000, 6],
    'electronics-factory': [60_000, 10],
  };

  for (const product of PRODUCT_CATALOG) {
    assert.equal(Number.isInteger(product.basePrice), true, `${product.id} 初始参考价必须为整数`);
  }
  for (const facility of FACILITY_TYPE_CATALOG) {
    assert.equal(productIds.has(facility.output.productId), true);
    if (facility.input) assert.equal(productIds.has(facility.input.productId), true);
    assert.ok(Array.isArray(facility.recipes) && facility.recipes.length >= 1);
    assert.ok(facility.recipes.some((recipe) => recipe.id === facility.defaultRecipeId));
    assert.deepEqual([facility.cycleMs, facility.operatingCost], expectedFacilityBalance[facility.id]);
    assert.equal(Number.isInteger(facility.cycleMs / 1_000), true, `${facility.id} 周期秒数必须为整数`);
    assert.equal(Number.isInteger(facility.operatingCost), true, `${facility.id} 周期成本必须为整数`);
    for (const recipe of facility.recipes) {
      assert.equal(productIds.has(recipe.output.productId), true);
      if (recipe.input) assert.equal(productIds.has(recipe.input.productId), true);
      assert.equal(recipe.cycleMs, facility.cycleMs);
      assert.equal(recipe.operatingCost, facility.operatingCost);
      assert.equal(Number.isInteger(recipe.output.quantity), true);
      if (recipe.input) assert.equal(Number.isInteger(recipe.input.quantity), true);
    }
  }
  const farm = FACILITY_TYPE_CATALOG.find((facility) => facility.id === 'farm');
  assert.deepEqual(farm.recipes.map((recipe) => recipe.output.productId), ['wheat', 'rice']);
  for (const recipe of farm.recipes) {
    assert.equal(recipe.cycleMs, 120_000);
    assert.equal(recipe.operatingCost, 6);
    assert.equal(recipe.output.quantity, 4);
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
  player.inventories.wheat.available = 9;
  const newProductIds = ['timber', 'crude-oil', 'lumber', 'plastic', 'furniture', 'electronics'];

  for (const productId of newProductIds) {
    delete player.inventories[productId];
    delete world.markets[productId];
  }
  world.orders = world.orders.filter((order) => !newProductIds.includes(order.productId));

  migrateWorld(world, now);
  processWorld(world, now + 1);

  assert.equal(player.credits, 777);
  assert.equal(player.inventories.wheat.available, 9);
  for (const productId of newProductIds) {
    assert.deepEqual(player.inventories[productId], { available: 0, frozen: 0 });
    assert.equal(world.markets[productId].productId, productId);
    assert.equal(world.orders.some((order) => order.productId === productId && order.side === 'buy' && order.ownerType === 'market'), true);
    assert.equal(world.orders.some((order) => order.productId === productId && order.side === 'sell' && order.ownerType === 'market'), true);
  }
});

test('commodity order fills preserve every exact resting price', () => {
  const world = createWorld(now);
  world.orders = [
    { id: 'test-market-buy', productId: 'wheat', side: 'buy', ownerType: 'market', ownerName: '测试流动买单', price: 1, quantity: 18, remaining: 18, status: 'open', createdAt: now },
    { id: 'test-market-sell', productId: 'wheat', side: 'sell', ownerType: 'market', ownerName: '测试流动卖单', price: 100, quantity: 14, remaining: 14, status: 'open', createdAt: now },
  ];
  const buyer = ensurePlayer(world, alice, now);
  const sellerA = ensurePlayer(world, bob, now);
  const sellerB = ensurePlayer(world, carol, now);
  buyer.credits = 100;
  sellerA.inventories.wheat.available = 1;
  sellerB.inventories.wheat.available = 1;

  assert.equal(applyAction(world, bob, 'placeOrder', {
    productId: 'wheat', side: 'sell', quantity: 1, price: 5,
  }, now + 1).ok, true);
  assert.equal(applyAction(world, carol, 'placeOrder', {
    productId: 'wheat', side: 'sell', quantity: 1, price: 6,
  }, now + 2).ok, true);
  assert.equal(applyAction(world, alice, 'placeOrder', {
    productId: 'wheat', side: 'buy', quantity: 2, price: 20,
  }, now + 3).ok, true);

  const buyOrder = world.orders.find((order) => order.ownerId === alice.id && order.side === 'buy');
  assert.deepEqual(
    buyOrder.fills.map((fill) => ({ price: fill.price, quantity: fill.quantity })),
    [{ price: 5, quantity: 1 }, { price: 6, quantity: 1 }],
  );
  assert.equal(buyer.credits, 89);
  assert.equal(buyer.frozenCredits, 0);
  assert.equal(buyer.inventories.wheat.available, 2);
});


test('commodity system liquidity follows the current order book instead of last trade price', () => {
  const makeOrder = (id, side, price, status = 'open') => ({
    id,
    productId: 'wheat',
    side,
    ownerType: 'player',
    ownerId: side === 'buy' ? 1 : 2,
    ownerName: side === 'buy' ? 'Buyer' : 'Seller',
    price,
    quantity: 1,
    remaining: status === 'cancelled' ? 0 : 1,
    status,
    createdAt: now,
  });
  const quote = (orders) => {
    const world = createWorld(now);
    world.orders = orders;
    world.markets.wheat.lastPrice = 100;
    world.markets.wheat.demand.nextDemandAt = now + 300_000;
    processWorld(world, now + 1);
    const marketOrders = world.orders.filter((order) => (
      order.productId === 'wheat' && order.ownerType === 'market' && ['open', 'partial'].includes(order.status)
    ));
    return {
      buy: marketOrders.find((order) => order.side === 'buy')?.price,
      sell: marketOrders.find((order) => order.side === 'sell')?.price,
      lastPrice: world.markets.wheat.lastPrice,
    };
  };

  assert.deepEqual(quote([makeOrder('bid-8', 'buy', 8), makeOrder('ask-12', 'sell', 12)]), {
    buy: 8, sell: 12, lastPrice: 100,
  });
  assert.deepEqual(quote([makeOrder('ask-12', 'sell', 12)]), {
    buy: 11, sell: 12, lastPrice: 100,
  });
  assert.deepEqual(quote([makeOrder('bid-8', 'buy', 8)]), {
    buy: 8, sell: 9, lastPrice: 100,
  });
  assert.deepEqual(quote([]), { buy: 1, sell: 3, lastPrice: 100 });
  assert.deepEqual(quote([
    makeOrder('cancelled-bid', 'buy', 99, 'cancelled'),
    makeOrder('ask-12', 'sell', 12),
  ]), { buy: 11, sell: 12, lastPrice: 100 });
  assert.deepEqual(quote([makeOrder('ask-1', 'sell', 1)]), {
    buy: undefined, sell: 1, lastPrice: 100,
  });
});
