import assert from 'node:assert/strict';
import test from 'node:test';
import { dailyCheckInPeriodFor } from '../src/daily-check-in.js';
import { applyAction, createWorld, ensurePlayer, migrateWorld, processWorld } from '../src/domain.js';
import { DEFAULT_PROVINCE_ID, provinceScopedKey } from '../src/provinces.js';

const alice = { id: 1, email: 'alice@example.com', name: 'Alice' };
const bob = { id: 2, email: 'bob@example.com', name: 'Bob' };
const now = 1_700_000_000_000;
const cycleMs = 5 * 60 * 1000;

function deferDemand(world, at = now + (3 * 24 * 60 * 60 * 1000)) {
  for (const state of Object.values(world.demandGroups)) state.nextDemandAt = at;
}

function oreMarket(world) {
  return world.markets[provinceScopedKey(DEFAULT_PROVINCE_ID, 'ore')];
}

function wheatMarket(world) {
  return world.markets[provinceScopedKey(DEFAULT_PROVINCE_ID, 'wheat')];
}

function auditFor(world, productId) {
  return world.systemMarketAudit?.products?.[provinceScopedKey(DEFAULT_PROVINCE_ID, productId)];
}

test('manual sell executes immediately at the server daily price without creating a resting order', () => {
  const world = createWorld(now);
  deferDemand(world);
  const player = ensurePlayer(world, alice, now);
  player.credits = 1_000;
  player.inventories.wheat.available = 10;
  const market = wheatMarket(world);
  market.officialPrice = 0.8;

  const result = applyAction(world, alice, 'placeOrder', {
    productId: 'wheat', side: 'sell', quantity: 4, price: 99,
  }, now + 1);

  assert.equal(result.ok, true);
  assert.equal(result.message, '');
  assert.equal(result.executedPrice, 0.8);
  assert.equal(player.inventories.wheat.frozen, 0);
  assert.equal(player.inventories.wheat.available, 6);
  assert.equal(player.credits, 1_003.168);
  assert.equal(market.todaySellQuantity, 4);
  assert.equal(market.todayBuyQuantity, 0);
  const order = world.orders.at(-1);
  assert.equal(order.status, 'filled');
  assert.equal(order.remaining, 0);
  assert.equal(order.price, 0.8);
  assert.equal(order.fills.length, 1);
  assert.equal(order.fills[0].price, 0.8);
  assert.equal(order.fills[0].fee, 0.032);
  assert.equal(order.fills[0].netTotal, 3.168);
  assert.equal(world.orders.some((candidate) => candidate.ownerType === 'player' && ['open', 'partial'].includes(candidate.status)), false);
  const audit = auditFor(world, 'wheat');
  assert.equal(audit.boughtQuantity, 4);
  assert.equal(audit.creditsIssued, 3.168);
  assert.equal(world.systemMarketAudit.version, 2);
});

test('manual buy executes immediately at the server daily price and ignores a client supplied price', () => {
  const world = createWorld(now);
  deferDemand(world);
  const player = ensurePlayer(world, bob, now);
  player.credits = 1_000;
  const market = wheatMarket(world);
  market.officialPrice = 0.8;

  const result = applyAction(world, bob, 'placeOrder', {
    productId: 'wheat', side: 'buy', quantity: 5, price: 0.01,
  }, now + 1);

  assert.equal(result.ok, true);
  assert.equal(result.executedPrice, 0.8);
  assert.equal(player.frozenCredits, 0);
  assert.equal(player.credits, 996);
  assert.equal(player.inventories.wheat.available, 5);
  assert.equal(market.todayBuyQuantity, 5);
  assert.equal(market.todaySellQuantity, 0);
  const audit = auditFor(world, 'wheat');
  assert.equal(audit.soldQuantity, 5);
  assert.equal(audit.creditsCollected, 4);
});

test('official price remains fixed during the same Asia Shanghai natural day', () => {
  const world = createWorld(now);
  deferDemand(world);
  const player = ensurePlayer(world, bob, now);
  player.credits = 10_000;
  const market = oreMarket(world);
  market.officialPrice = 10;

  assert.equal(applyAction(world, bob, 'placeOrder', {
    productId: 'ore', side: 'buy', quantity: 20, price: 1,
  }, now + 1).ok, true);
  processWorld(world, now + cycleMs + 2);

  assert.equal(market.officialPrice, 10);
  assert.equal(market.todayBuyQuantity, 20);
  assert.equal(market.lastPriceChangeBps, 0);
});

test('Asia Shanghai midnight raises the daily price from yesterday buy pressure and resets daily counters', () => {
  const world = createWorld(now);
  deferDemand(world);
  const market = oreMarket(world);
  market.officialPrice = 10;
  market.todayBuyQuantity = 20;
  market.todaySellQuantity = 4;
  market.cycleBuyQuantity = 20;
  market.cycleSellQuantity = 4;
  const nextResetAt = dailyCheckInPeriodFor(now).nextResetAt;

  processWorld(world, nextResetAt + 1);

  assert.equal(market.officialPrice, 10.4);
  assert.equal(market.lastPriceChangeBps, 400);
  assert.equal(market.lastImbalance, 0.4);
  assert.equal(market.previousDayBuyQuantity, 20);
  assert.equal(market.previousDaySellQuantity, 4);
  assert.equal(market.todayBuyQuantity, 0);
  assert.equal(market.todaySellQuantity, 0);
  assert.equal(market.priceDateKey, dailyCheckInPeriodFor(nextResetAt + 1).todayKey);
  assert.equal(market.nextPriceAt, dailyCheckInPeriodFor(nextResetAt + 1).nextResetAt);
});

test('balanced or zero yesterday volume does not move the next daily price', () => {
  const balancedWorld = createWorld(now);
  deferDemand(balancedWorld);
  const balanced = oreMarket(balancedWorld);
  balanced.officialPrice = 10;
  balanced.todayBuyQuantity = 50;
  balanced.todaySellQuantity = 50;
  processWorld(balancedWorld, dailyCheckInPeriodFor(now).nextResetAt + 1);
  assert.equal(balanced.officialPrice, 10);
  assert.equal(balanced.lastPriceChangeBps, 0);

  const idleWorld = createWorld(now);
  deferDemand(idleWorld);
  const idle = oreMarket(idleWorld);
  idle.officialPrice = 10;
  processWorld(idleWorld, dailyCheckInPeriodFor(now).nextResetAt + 1);
  assert.equal(idle.officialPrice, 10);
  assert.equal(idle.previousDayBuyQuantity, 0);
  assert.equal(idle.previousDaySellQuantity, 0);
});

test('daily system price is capped to five percent per day and base price 50 to 300 percent bounds', () => {
  const upWorld = createWorld(now);
  deferDemand(upWorld);
  const up = oreMarket(upWorld);
  up.officialPrice = 20.9;
  up.todayBuyQuantity = 10_000;
  up.todaySellQuantity = 0;
  processWorld(upWorld, dailyCheckInPeriodFor(now).nextResetAt + 1);
  assert.equal(up.lastPriceChangeBps, 500);
  assert.equal(up.officialPrice, 21);

  const downWorld = createWorld(now);
  deferDemand(downWorld);
  const down = oreMarket(downWorld);
  down.officialPrice = 3.5;
  down.todayBuyQuantity = 0;
  down.todaySellQuantity = 10_000;
  processWorld(downWorld, dailyCheckInPeriodFor(now).nextResetAt + 1);
  assert.equal(down.lastPriceChangeBps, -500);
  assert.equal(down.officialPrice, 3.5);
});

test('stale volume older than yesterday is not applied after a multi-day offline gap', () => {
  const world = createWorld(now);
  deferDemand(world, now + (10 * 24 * 60 * 60 * 1000));
  const market = oreMarket(world);
  market.officialPrice = 10;
  market.todayBuyQuantity = 1_000;
  market.todaySellQuantity = 0;

  processWorld(world, now + (2 * 24 * 60 * 60 * 1000));

  assert.equal(market.officialPrice, 10);
  assert.equal(market.previousDayBuyQuantity, 0);
  assert.equal(market.previousDaySellQuantity, 0);
});

test('daily price rollover never clears server internal population orders', () => {
  const world = createWorld(now);
  deferDemand(world);
  const market = oreMarket(world);
  market.officialPrice = 10;
  const populationOrder = {
    id: 'population-ore-buy',
    assetKind: 'commodity',
    assetId: 'ore',
    productId: 'ore',
    provinceId: DEFAULT_PROVINCE_ID,
    side: 'buy',
    ownerType: 'population',
    ownerName: '食品市场需求',
    demandGroupId: 'food',
    demandTier: 'direct',
    price: 10.4,
    quantity: 3,
    remaining: 3,
    status: 'open',
    createdAt: now + 1,
  };
  world.orders.push(populationOrder);
  market.todayBuyQuantity = 20;
  market.todaySellQuantity = 4;

  processWorld(world, dailyCheckInPeriodFor(now).nextResetAt + 1);

  assert.equal(market.officialPrice, 10.4);
  assert.equal(populationOrder.status, 'open');
  assert.equal(populationOrder.remaining, 3);
});

test('migration cancels legacy resting player commodity orders and releases frozen assets', () => {
  const world = createWorld(now);
  deferDemand(world);
  const player = ensurePlayer(world, alice, now);
  player.credits = 100;
  player.frozenCredits = 5;
  world.playerCommodityInstantTradeVersion = 0;
  world.orders.push({
    id: 'legacy-player-buy',
    assetKind: 'commodity',
    assetId: 'wheat',
    productId: 'wheat',
    provinceId: DEFAULT_PROVINCE_ID,
    side: 'buy',
    ownerType: 'player',
    ownerId: 1,
    price: 1,
    quantity: 5,
    remaining: 5,
    status: 'open',
    fills: [],
    createdAt: now - 1,
  });

  migrateWorld(world, now + 1);

  const legacy = world.orders.find((order) => order.id === 'legacy-player-buy');
  assert.equal(legacy.status, 'cancelled');
  assert.equal(player.frozenCredits, 0);
  assert.equal(player.credits, 105);
  assert.equal(world.playerCommodityInstantTradeVersion, 1);
});
