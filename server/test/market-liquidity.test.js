import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyAction,
  createWorld,
  ensurePlayer,
  MARKET_DEMAND_MODEL_VERSION,
  migrateWorld,
  processWorld,
} from '../src/domain.js';

const now = 1_700_000_000_000;
const cycleMs = 5 * 60 * 1000;
const alice = { id: 1, email: 'alice@example.com', name: 'Alice' };

function prepareAllDemand(world, at = now) {
  for (const state of Object.values(world.demandGroups)) {
    state.nextDemandAt = at;
    state.lastCycleId = Math.floor(at / cycleMs) - 1;
  }
}

function liquidityOrders(world, groupId, productId) {
  return world.orders.filter((order) => (
    order.ownerType === 'population'
    && order.demandGroupId === groupId
    && order.productId === productId
    && (order.demandTier === 'liquidity-buy' || order.demandTier === 'liquidity-sell')
  ));
}

function cancelConsumptionBuys(world, productId) {
  for (const order of world.orders) {
    if (
      order.ownerType === 'population'
      && order.productId === productId
      && order.side === 'buy'
      && (order.demandTier === 'direct' || order.demandTier === 'derived-liquidity')
      && order.remaining > 0
    ) {
      order.remaining = 0;
      order.status = 'cancelled';
    }
  }
}

function openSystemOrders(world, productId, side) {
  return world.orders.filter((order) => (
    order.ownerType === 'population'
    && order.productId === productId
    && order.side === side
    && order.remaining > 0
    && (order.status === 'open' || order.status === 'partial')
  ));
}

function reserveTotals(world, groupId) {
  const group = world.marketDemand.liquidity.groups[groupId];
  return {
    credits: group.credits + group.frozenCredits,
    inventory: Object.fromEntries(Object.entries(group.reserves).map(([productId, reserve]) => [
      productId,
      reserve.inventory + reserve.frozenInventory,
    ])),
  };
}

test('market model 19 creates inventory-backed buy and sell orders without system self-trades', () => {
  const world = createWorld(now);
  ensurePlayer(world, alice, now);
  world.marketDemand.liquidity.groups.food.reserves.wheat.inventory = 6;
  prepareAllDemand(world);
  processWorld(world, now + 1);

  assert.equal(MARKET_DEMAND_MODEL_VERSION, 20);
  const systemOrders = world.orders.filter((order) => order.ownerType === 'population');
  assert.ok(systemOrders.some((order) => order.demandTier === 'direct'));
  assert.ok(systemOrders.some((order) => order.demandTier === 'derived-liquidity'));
  assert.ok(systemOrders.some((order) => order.demandTier === 'liquidity-buy'));
  assert.ok(systemOrders.some((order) => order.demandTier === 'liquidity-sell'));
  assert.equal(systemOrders.some((order) => Number(order.lastFilledAt || 0) > 0), false);

  for (const group of Object.values(world.marketDemand.liquidity.groups)) {
    assert.ok(group.credits >= 0);
    assert.ok(group.frozenCredits >= 0);
    for (const reserve of Object.values(group.reserves)) {
      assert.ok(reserve.inventory >= 0);
      assert.ok(reserve.frozenInventory >= 0);
    }
  }
});

test('system liquidity asks reprice above retained consumption bids instead of crossing', () => {
  const world = createWorld(now);
  ensurePlayer(world, alice, now);
  world.marketDemand.liquidity.groups.food.reserves.wheat.inventory = 6;
  prepareAllDemand(world);
  processWorld(world, now + 1);

  world.orders.push({
    id: 'retained-appliance-demand',
    assetKind: 'commodity',
    assetId: 'appliance',
    productId: 'appliance',
    side: 'buy',
    ownerType: 'population',
    ownerName: '家庭消费市场需求',
    demandGroupId: 'household',
    demandTier: 'direct',
    demandCycleId: world.demandGroups.household.lastCycleId,
    populationModelId: 'professional',
    fundingPool: 'direct',
    price: 151.23,
    quantity: 10,
    remaining: 10,
    status: 'open',
    createdAt: now + 2,
  });

  prepareAllDemand(world, now + cycleMs + 1);
  processWorld(world, now + cycleMs + 1);

  for (const productId of Object.keys(world.markets)) {
    const buys = openSystemOrders(world, productId, 'buy');
    const sells = openSystemOrders(world, productId, 'sell');
    if (buys.length === 0 || sells.length === 0) continue;
    const bestBid = Math.max(...buys.map((order) => order.price));
    const bestAsk = Math.min(...sells.map((order) => order.price));
    assert.ok(bestBid < bestAsk, `${productId} system book crossed at ${bestBid}/${bestAsk}`);
  }

  const applianceBuys = openSystemOrders(world, 'appliance', 'buy');
  const applianceSell = liquidityOrders(world, 'household', 'appliance')
    .find((order) => order.demandTier === 'liquidity-sell' && order.remaining > 0);
  assert.ok(applianceBuys.length > 0);
  if (applianceSell) {
    assert.ok(applianceSell.price > Math.max(...applianceBuys.map((order) => order.price)));
  }
});

test('player immediate selling does not consume an internal reserve bid', () => {
  const world = createWorld(now);
  const player = ensurePlayer(world, alice, now);
  player.inventories.wheat.available = 10;
  world.marketDemand.liquidity.groups.food.reserves.wheat.inventory = 6;
  prepareAllDemand(world);
  processWorld(world, now + 1);
  cancelConsumptionBuys(world, 'wheat');

  const buyOrder = liquidityOrders(world, 'food', 'wheat')
    .find((order) => order.demandTier === 'liquidity-buy' && order.remaining > 0);
  assert.ok(buyOrder);
  const group = world.marketDemand.liquidity.groups.food;
  const reserve = group.reserves.wheat;
  const creditsBefore = player.credits;
  const reserveInventoryBefore = reserve.inventory;
  const reserveFundsBefore = group.credits + group.frozenCredits;
  const reserveRemainingBefore = buyOrder.remaining;

  const result = applyAction(world, alice, 'placeOrder', {
    productId: 'wheat', side: 'sell', quantity: 1, price: buyOrder.price,
  }, now + 2);
  assert.equal(result.ok, true);
  assert.equal(player.credits, Number((creditsBefore + result.netTotal).toFixed(6)));
  assert.equal(reserve.inventory, reserveInventoryBefore);
  assert.equal(group.credits + group.frozenCredits, reserveFundsBefore);
  assert.equal(buyOrder.remaining, reserveRemainingBefore);
});

test('player immediate buying does not consume an internal reserve ask', () => {
  const world = createWorld(now);
  const player = ensurePlayer(world, alice, now);
  player.credits = 10_000;
  prepareAllDemand(world);
  processWorld(world, now + 1);

  const sellOrder = liquidityOrders(world, 'food', 'wheat')
    .find((order) => order.demandTier === 'liquidity-sell' && order.remaining > 0);
  assert.ok(sellOrder);
  const group = world.marketDemand.liquidity.groups.food;
  const reserve = group.reserves.wheat;
  const frozenBefore = reserve.frozenInventory;
  const fundsBefore = group.credits + group.frozenCredits;
  const remainingBefore = sellOrder.remaining;

  const result = applyAction(world, alice, 'placeOrder', {
    productId: 'wheat', side: 'buy', quantity: 1, price: sellOrder.price,
  }, now + 2);
  assert.equal(result.ok, true);
  assert.equal(player.inventories.wheat.available, 1);
  assert.equal(reserve.frozenInventory, frozenBefore);
  assert.equal(group.credits + group.frozenCredits, fundsBefore);
  assert.equal(sellOrder.remaining, remainingBefore);
});

test('liquidity orders are cancelled and re-reserved on the next cycle', () => {
  const world = createWorld(now);
  ensurePlayer(world, alice, now);
  world.marketDemand.liquidity.groups.food.reserves.wheat.inventory = 6;
  prepareAllDemand(world);
  processWorld(world, now + 1);
  const oldOrders = liquidityOrders(world, 'food', 'wheat').filter((order) => order.remaining > 0);
  assert.ok(oldOrders.length >= 2);

  prepareAllDemand(world, now + cycleMs + 1);
  processWorld(world, now + cycleMs + 1);

  assert.ok(oldOrders.every((order) => order.status === 'cancelled' || order.status === 'filled'));
  const nextCycleId = world.demandGroups.food.lastCycleId;
  assert.ok(liquidityOrders(world, 'food', 'wheat').some((order) => (
    order.demandCycleId === nextCycleId && order.remaining > 0
  )));
});

test('model 3 migrates directly to current model with one-time reserve seeding', () => {
  const world = createWorld(now);
  const player = ensurePlayer(world, alice, now);
  player.credits = 777;
  player.inventories.wheat.available = 9;
  world.marketDemand.modelVersion = 3;
  delete world.marketDemand.liquidity;
  world.orders.push({
    id: 'model-3-market-order', assetKind: 'commodity', assetId: 'wheat', productId: 'wheat',
    side: 'buy', ownerType: 'population', ownerName: '食品市场需求', demandGroupId: 'food',
    demandTier: 'direct', demandCycleId: 1, price: 2, quantity: 2, remaining: 2,
    status: 'open', createdAt: now,
  });

  migrateWorld(world, now + 1);

  assert.equal(world.marketDemand.modelVersion, 20);
  assert.equal(world.players[String(alice.id)].credits, 777);
  assert.equal(world.players[String(alice.id)].inventories.wheat.available, 9);
  assert.equal(world.orders.some((order) => order.id === 'model-3-market-order'), false);
  assert.equal(world.marketDemand.liquidity.groups.food.initialCredits, 3_000);
  assert.ok(world.marketDemand.liquidity.groups.food.reserves.wheat.inventory > 0);
});

test('model 5 migrates to current model and releases obsolete liquidity reservations', () => {
  const world = createWorld(now);
  const player = ensurePlayer(world, alice, now);
  player.credits = 777;
  player.inventories.wheat.available = 9;
  prepareAllDemand(world);
  processWorld(world, now + 1);
  world.marketDemand.modelVersion = 5;
  const oldSystemOrderIds = new Set(world.orders
    .filter((order) => order.ownerType === 'population')
    .map((order) => order.id));
  const before = Object.fromEntries(['food', 'household'].map((groupId) => [groupId, reserveTotals(world, groupId)]));

  migrateWorld(world, now + 2);

  assert.equal(world.marketDemand.modelVersion, 20);
  assert.equal(world.players[String(alice.id)].credits, 777);
  assert.equal(world.players[String(alice.id)].inventories.wheat.available, 9);
  assert.equal(world.orders.some((order) => oldSystemOrderIds.has(order.id)), false);
  for (const groupId of ['food', 'household']) {
    const group = world.marketDemand.liquidity.groups[groupId];
    assert.equal(group.frozenCredits, 0);
    assert.equal(group.credits, before[groupId].credits);
    for (const [productId, reserve] of Object.entries(group.reserves)) {
      assert.equal(reserve.frozenInventory, 0);
      assert.equal(reserve.inventory, before[groupId].inventory[productId]);
    }
  }
  processWorld(world, now + 3);
  assert.ok(world.orders.some((order) => order.ownerType === 'population'));
});

test('market reserve has no business target or quote-size ceiling and quotes cents', () => {
  const world = createWorld(now);
  ensurePlayer(world, alice, now);
  const group = world.marketDemand.liquidity.groups.food;
  group.credits = 100_000;
  group.reserves.wheat.inventory = 1_000;
  group.reserves.wheat.targetInventory = 200;
  world.demandGroups.food.previousDemandQuantities.wheat = 800;
  world.markets.wheat.priceHistory.push({ price: 2.17, quantity: 1000, createdAt: now, takerSide: 'sell', marketRole: 'player' });
  prepareAllDemand(world);
  processWorld(world, now + 1);
  const reserve = group.reserves.wheat;
  assert.ok(reserve.targetInventory > 30);
  const orders = liquidityOrders(world, 'food', 'wheat').filter((order) => order.remaining > 0);
  assert.ok(orders.some((order) => order.side === 'sell' && order.quantity > Math.floor(reserve.targetInventory * 0.25)));
  assert.ok(orders.every((order) => order.price === Number(order.price.toFixed(2))));
});
