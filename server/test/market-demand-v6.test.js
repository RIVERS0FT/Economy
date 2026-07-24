import assert from 'node:assert/strict';
import test from 'node:test';
import { createMarketDemandRuntime } from '../src/market-demand.js';
import { createMarketSignalRuntime } from '../src/market-demand/signals.js';

const products = [
  { id: 'wheat', name: '小麦', category: 'raw', basePrice: 2, marketDemandGroupId: 'food' },
  { id: 'rice', name: '水稻', category: 'raw', basePrice: 2, marketDemandGroupId: 'food' },
  { id: 'flour', name: '面粉', category: 'intermediate', basePrice: 13, marketDemandGroupId: 'food' },
  { id: 'food', name: '食品', category: 'consumer', basePrice: 15, marketDemandGroupId: 'food' },
  { id: 'meat', name: '肉', category: 'consumer', basePrice: 6, marketDemandGroupId: 'food' },
  { id: 'eggs', name: '蛋', category: 'consumer', basePrice: 3, marketDemandGroupId: 'food' },
  { id: 'milk', name: '奶', category: 'consumer', basePrice: 3, marketDemandGroupId: 'food' },
  { id: 'fish', name: '鱼类', category: 'raw', basePrice: 6, marketDemandGroupId: 'food' },
  { id: 'fruit', name: '水果', category: 'raw', basePrice: 4, marketDemandGroupId: 'food' },
  { id: 'beverage', name: '饮料', category: 'consumer', basePrice: 18, marketDemandGroupId: 'food' },
  { id: 'prepared-meal', name: '预制餐', category: 'consumer', basePrice: 18, marketDemandGroupId: 'food' },
  { id: 'sugar', name: '砂糖', category: 'intermediate', basePrice: 13, marketDemandGroupId: 'food' },
  { id: 'sugarcane', name: '甘蔗', category: 'raw', basePrice: 2, marketDemandGroupId: 'food' },
  { id: 'furniture', name: '家具', category: 'consumer', basePrice: 24, marketDemandGroupId: 'household' },
  { id: 'clothing', name: '服装', category: 'consumer', basePrice: 55, marketDemandGroupId: 'household' },
  { id: 'paper', name: '纸品', category: 'consumer', basePrice: 15, marketDemandGroupId: 'household' },
  { id: 'electronics', name: '电子产品', category: 'industrial', basePrice: 84, marketDemandGroupId: 'household' },
  { id: 'appliance', name: '家电', category: 'industrial', basePrice: 92, marketDemandGroupId: 'household' },
  { id: 'machinery', name: '机械', category: 'industrial', basePrice: 76, marketDemandGroupId: 'household' },
];
const facilities = [
  { id: 'mill', category: 'processing', recipes: [{ id: 'flour', operatingCost: 7, cycleMs: 40_000, inputs: [{ productId: 'wheat', quantity: 2 }], output: { productId: 'flour', quantity: 1 } }] },
  { id: 'food', category: 'consumer', recipes: [{ id: 'food', operatingCost: 14, cycleMs: 50_000, inputs: [{ productId: 'flour', quantity: 2 }], output: { productId: 'food', quantity: 3 } }] },
  { id: 'beverage', category: 'consumer', recipes: [
    { id: 'milk-drink', operatingCost: 11, cycleMs: 60_000, inputs: [{ productId: 'sugar', quantity: 1 }, { productId: 'milk', quantity: 1 }], output: { productId: 'beverage', quantity: 2 } },
    { id: 'fruit-drink', operatingCost: 11, cycleMs: 60_000, inputs: [{ productId: 'fruit', quantity: 2 }, { productId: 'sugar', quantity: 1 }], output: { productId: 'beverage', quantity: 2 } },
  ] },
  { id: 'appliance', category: 'consumer', recipes: [{ id: 'appliance', operatingCost: 10, cycleMs: 60_000, inputs: [{ productId: 'machinery', quantity: 1 }, { productId: 'electronics', quantity: 1 }], output: { productId: 'appliance', quantity: 2 } }] },
];
const isOpenOrder = (order) => ['open', 'partial'].includes(order.status) && Number(order.remaining || 0) > 0;
const constants = { demandCycleMs: 300_000 };
const marketFor = (world, productId) => {
  world.markets ||= {};
  world.markets[productId] ||= { productId, priceHistory: [], demand: {} };
  return world.markets[productId];
};

function createRuntime() {
  return createMarketDemandRuntime({
    products,
    facilities,
    constants,
    marketFor,
    matchOrder: () => {},
    isOpenOrder,
  });
}

function createTestWorld(now) {
  return {
    players: { '1': { registeredAt: now - 1_000, lastEconomicActivityAt: now - 1_000 } },
    orders: [],
    markets: {},
  };
}

test('market model 8 settles fills that happen after demand orders are created', () => {
  const now = 1_700_000_000_000;
  const runtime = createRuntime();
  const world = createTestWorld(now);
  runtime.initializeWorld(world, now);
  world.marketDemand.groups.food.nextDemandAt = now;
  runtime.processGroup(world, 'food', now);
  const direct = world.orders.find((order) => order.demandGroupId === 'food' && order.demandTier === 'direct');
  assert.ok(direct);
  const filled = Math.min(2, direct.remaining);
  direct.remaining -= filled;
  direct.lastFilledAt = now + 240_000;
  direct.status = direct.remaining > 0 ? 'partial' : 'filled';

  runtime.processGroup(world, 'food', now + constants.demandCycleMs);

  const state = world.marketDemand.groups.food;
  assert.ok(state.lastCycleSettlement.filledUtility > 0);
  assert.ok(state.previousDemandQuantities[direct.productId] > 0);
  assert.ok(state.satisfaction > 0);
});

test('direct demand quote anchor accumulates fractional no-fill increases and recovers after service', () => {
  const now = 1_700_000_000_000;
  const runtime = createRuntime();
  const world = createTestWorld(now);
  runtime.initializeWorld(world, now);
  world.marketDemand.groups.food.nextDemandAt = now;

  const topWheatPriceFor = (cycleId) => Math.max(...world.orders
    .filter((order) => order.demandGroupId === 'food'
      && order.demandTier === 'direct'
      && order.productId === 'wheat'
      && Number(order.demandCycleId) === cycleId)
    .map((order) => Number(order.price || 0)));

  runtime.processGroup(world, 'food', now);
  assert.equal(topWheatPriceFor(Math.floor(now / constants.demandCycleMs)), 2);

  for (let cycle = 1; cycle <= 8; cycle += 1) {
    runtime.processGroup(world, 'food', now + cycle * constants.demandCycleMs);
  }

  const raisedAt = now + 8 * constants.demandCycleMs;
  const raisedCycleId = Math.floor(raisedAt / constants.demandCycleMs);
  const raisedAnchor = world.marketDemand.groups.food.directQuoteAnchors.wheat;
  assert.ok(raisedAnchor >= 2.53);
  assert.equal(topWheatPriceFor(raisedCycleId), 3);

  const filledAt = raisedAt + 240_000;
  for (const order of world.orders.filter((item) => item.demandGroupId === 'food'
    && item.demandTier === 'direct'
    && item.productId === 'wheat'
    && Number(item.demandCycleId) === raisedCycleId)) {
    order.remaining = 0;
    order.status = 'filled';
    order.lastFilledAt = filledAt;
  }

  runtime.processGroup(world, 'food', raisedAt + constants.demandCycleMs);
  const recoveredAnchor = world.marketDemand.groups.food.directQuoteAnchors.wheat;
  assert.ok(recoveredAnchor < raisedAnchor);
  assert.ok(recoveredAnchor > 2);
  assert.equal(world.marketDemand.groups.food.lastCycleSettlement.products.wheat.directFillRatio, 1);
});

test('market model 8 uses funded population wallets when no player is active', () => {
  const now = 1_700_000_000_000;
  const runtime = createRuntime();
  const world = createTestWorld(now);
  world.players['1'].registeredAt = now - 8 * 24 * 60 * 60 * 1000;
  world.players['1'].lastEconomicActivityAt = world.players['1'].registeredAt;
  runtime.initializeWorld(world, now);
  world.marketDemand.groups.food.nextDemandAt = now;

  runtime.processGroup(world, 'food', now);

  assert.equal(world.marketDemand.groups.food.lastActivePlayerCount, 0);
  assert.ok(world.marketDemand.groups.food.lastBudget > 0);
  assert.ok(world.marketDemand.groups.food.lastCommitted > 0);
  assert.equal(world.orders.some((order) => order.demandGroupId === 'food' && (order.demandTier === 'direct' || order.demandTier === 'derived-liquidity')), true);
});

test('player-only activity excludes consumption and reserve trades from budget activity', () => {
  const now = 1_700_000_000_000;
  const world = { markets: { wheat: { priceHistory: [
    { price: 2, quantity: 5, createdAt: now, takerSide: 'buy', signalWeight: 1, marketRole: 'player' },
    { price: 3, quantity: 7, createdAt: now, takerSide: 'buy', signalWeight: 1, marketRole: 'consumption' },
    { price: 4, quantity: 9, createdAt: now, takerSide: 'sell', signalWeight: 0.5, marketRole: 'liquidity' },
  ] } }, orders: [] };
  const signals = createMarketSignalRuntime({ marketFor, isOpenOrder });
  const stats = signals.realTradeStats(world, 'wheat', now);
  assert.equal(stats.playerValue, 10);
  assert.equal(stats.consumptionValue, 21);
  assert.equal(stats.liquidityValue, 18);
  assert.equal(stats.value, 49);
});
