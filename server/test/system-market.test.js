import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, createWorld, ensurePlayer, processWorld } from '../src/domain.js';
import { DEFAULT_PROVINCE_ID, provinceScopedKey } from '../src/provinces.js';

const alice = { id: 1, email: 'alice@example.com', name: 'Alice' };
const bob = { id: 2, email: 'bob@example.com', name: 'Bob' };
const carol = { id: 3, email: 'carol@example.com', name: 'Carol' };
const now = 1_700_000_000_000;
const cycleMs = 5 * 60 * 1000;

function deferDemand(world, at = now + cycleMs) {
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

test('player sell order at exactly the system price is fully bought by the system in real time', () => {
  const world = createWorld(now);
  deferDemand(world);
  const player = ensurePlayer(world, alice, now);
  player.credits = 1_000;
  player.inventories.wheat.available = 10;
  const market = wheatMarket(world);
  market.officialPrice = 0.8;

  const result = applyAction(world, alice, 'placeOrder', {
    productId: 'wheat', side: 'sell', quantity: 4, price: 0.8,
  }, now + 1);

  assert.equal(result.ok, true);
  assert.equal(result.message, '订单已全部成交');
  assert.equal(player.inventories.wheat.frozen, 0);
  assert.equal(player.inventories.wheat.available, 6);
  assert.equal(player.credits, 1_003.168);
  assert.equal(market.cycleSellQuantity, 4);
  assert.equal(market.cycleBuyQuantity, 0);
  const order = world.orders.at(-1);
  assert.equal(order.status, 'filled');
  assert.equal(order.remaining, 0);
  assert.equal(order.fills.length, 1);
  assert.equal(order.fills[0].price, 0.8);
  assert.equal(order.fills[0].quantity, 4);
  assert.equal(order.fills[0].fee, 0.032);
  assert.equal(order.fills[0].netTotal, 3.168);
  const audit = auditFor(world, 'wheat');
  assert.equal(audit.boughtQuantity, 4);
  assert.equal(audit.creditsIssued, 3.168);
  assert.equal(world.systemMarketAudit.version, 1);
});

test('player buy order at exactly the system price is fully supplied by the system in real time', () => {
  const world = createWorld(now);
  deferDemand(world);
  const player = ensurePlayer(world, bob, now);
  player.credits = 1_000;
  const market = wheatMarket(world);
  market.officialPrice = 0.8;

  const result = applyAction(world, bob, 'placeOrder', {
    productId: 'wheat', side: 'buy', quantity: 5, price: 0.8,
  }, now + 1);

  assert.equal(result.ok, true);
  assert.equal(result.message, '订单已全部成交');
  assert.equal(player.frozenCredits, 0);
  assert.equal(player.credits, 996);
  assert.equal(player.inventories.wheat.available, 5);
  assert.equal(market.cycleBuyQuantity, 5);
  assert.equal(market.cycleSellQuantity, 0);
  const audit = auditFor(world, 'wheat');
  assert.equal(audit.soldQuantity, 5);
  assert.equal(audit.creditsCollected, 4);
});

test('orders one tick away from the system price stay in the order book', () => {
  const world = createWorld(now);
  deferDemand(world);
  const seller = ensurePlayer(world, alice, now);
  const buyer = ensurePlayer(world, bob, now);
  seller.credits = 1_000;
  buyer.credits = 1_000;
  seller.inventories.wheat.available = 10;
  const market = wheatMarket(world);
  market.officialPrice = 0.8;

  assert.equal(applyAction(world, alice, 'placeOrder', {
    productId: 'wheat', side: 'sell', quantity: 4, price: 0.81,
  }, now + 1).message, '订单已进入订单簿');
  assert.equal(applyAction(world, bob, 'placeOrder', {
    productId: 'wheat', side: 'buy', quantity: 5, price: 0.79,
  }, now + 2).message, '订单已进入订单簿');

  assert.equal(seller.inventories.wheat.frozen, 4);
  assert.equal(buyer.frozenCredits, 3.95);
  assert.equal(market.cycleSellQuantity, 0);
  assert.equal(market.cycleBuyQuantity, 0);
});

test('player-to-player matching runs first and the system only takes the remaining quantity', () => {
  const world = createWorld(now);
  deferDemand(world);
  const buyer = ensurePlayer(world, bob, now);
  const seller = ensurePlayer(world, alice, now);
  buyer.credits = 1_000;
  seller.credits = 1_000;
  seller.inventories.wheat.available = 10;
  const market = wheatMarket(world);
  market.officialPrice = 0.8;

  assert.equal(applyAction(world, bob, 'placeOrder', {
    productId: 'wheat', side: 'buy', quantity: 2, price: 0.85,
  }, now + 1).message, '订单已进入订单簿');
  assert.equal(applyAction(world, alice, 'placeOrder', {
    productId: 'wheat', side: 'sell', quantity: 4, price: 0.8,
  }, now + 2).message, '订单已全部成交');

  assert.equal(buyer.inventories.wheat.available, 2);
  assert.equal(buyer.frozenCredits, 0);
  assert.equal(seller.inventories.wheat.frozen, 0);
  assert.equal(seller.credits, 1_003.267);
  assert.equal(market.cycleSellQuantity, 2);
  const order = world.orders.at(-1);
  assert.equal(order.fills.length, 2);
  assert.deepEqual(order.fills.map((fill) => fill.price), [0.85, 0.8]);
  assert.equal(seller.stats.soldGoods, 4);
});

test('price cycle raises the official price from buy pressure and resets counters', () => {
  const world = createWorld(now);
  deferDemand(world);
  const market = oreMarket(world);
  market.officialPrice = 10;
  market.cycleBuyQuantity = 20;
  market.cycleSellQuantity = 4;
  market.nextPriceAt = now + 1;

  processWorld(world, now + 2);

  assert.equal(market.officialPrice, 10.04);
  assert.equal(market.lastPriceChangeBps, 40);
  assert.equal(market.lastImbalance, 0.4);
  assert.equal(market.cycleBuyQuantity, 0);
  assert.equal(market.cycleSellQuantity, 0);
  assert.equal(market.nextPriceAt, now + 2 + cycleMs);
});

test('price cycle clears every resting player order at the new exact price and not adjacent ticks', () => {
  const world = createWorld(now);
  deferDemand(world);
  const sellerA = ensurePlayer(world, alice, now);
  const sellerB = ensurePlayer(world, bob, now);
  sellerA.credits = 1_000;
  sellerB.credits = 1_000;
  sellerA.inventories.ore.available = 10;
  sellerB.inventories.ore.available = 10;
  const market = oreMarket(world);
  market.officialPrice = 10;

  assert.equal(applyAction(world, alice, 'placeOrder', {
    productId: 'ore', side: 'sell', quantity: 3, price: 10.04,
  }, now + 1).message, '订单已进入订单簿');
  assert.equal(applyAction(world, bob, 'placeOrder', {
    productId: 'ore', side: 'sell', quantity: 2, price: 10.04,
  }, now + 2).message, '订单已进入订单簿');
  assert.equal(applyAction(world, alice, 'placeOrder', {
    productId: 'ore', side: 'sell', quantity: 1, price: 10.03,
  }, now + 3).message, '订单已进入订单簿');
  assert.equal(applyAction(world, bob, 'placeOrder', {
    productId: 'ore', side: 'sell', quantity: 1, price: 10.05,
  }, now + 4).message, '订单已进入订单簿');

  market.cycleBuyQuantity = 20;
  market.cycleSellQuantity = 4;
  market.nextPriceAt = now + 10;
  processWorld(world, now + 11);

  assert.equal(market.officialPrice, 10.04);
  const filledAtPrice = world.orders.filter((order) => (
    order.ownerType === 'player' && order.side === 'sell' && order.price === 10.04
  ));
  assert.equal(filledAtPrice.length, 2);
  assert.ok(filledAtPrice.every((order) => order.status === 'filled' && order.remaining === 0));
  const resting = world.orders.filter((order) => (
    order.ownerType === 'player' && order.side === 'sell' && (order.price === 10.03 || order.price === 10.05)
  ));
  assert.equal(resting.length, 2);
  assert.ok(resting.every((order) => order.status === 'open' && order.remaining > 0));
  assert.equal(market.cycleSellQuantity, 5);
  assert.equal(market.cycleBuyQuantity, 0);
  assert.equal(sellerA.stats.soldGoods, 3);
  assert.equal(sellerB.stats.soldGoods, 2);
});

test('price cycle supplies resting player buys at the new exact price', () => {
  const world = createWorld(now);
  deferDemand(world);
  const buyer = ensurePlayer(world, carol, now);
  buyer.credits = 1_000;
  const market = oreMarket(world);
  market.officialPrice = 10;

  assert.equal(applyAction(world, carol, 'placeOrder', {
    productId: 'ore', side: 'buy', quantity: 2, price: 10.04,
  }, now + 1).message, '订单已进入订单簿');
  market.cycleBuyQuantity = 20;
  market.cycleSellQuantity = 4;
  market.nextPriceAt = now + 10;
  processWorld(world, now + 11);

  assert.equal(market.officialPrice, 10.04);
  assert.equal(buyer.inventories.ore.available, 2);
  assert.equal(buyer.frozenCredits, 0);
  assert.equal(market.cycleBuyQuantity, 2);
  const order = world.orders.at(-1);
  assert.equal(order.status, 'filled');
});

test('system price stays within the base price 50% to 300% bounds', () => {
  const world = createWorld(now);
  deferDemand(world);
  const market = oreMarket(world);

  market.officialPrice = 20.9;
  market.cycleBuyQuantity = 10_000;
  market.cycleSellQuantity = 0;
  market.nextPriceAt = now + 1;
  processWorld(world, now + 2);
  assert.equal(market.officialPrice, 21);

  market.cycleBuyQuantity = 0;
  market.cycleSellQuantity = 10_000;
  market.officialPrice = 3.5;
  market.nextPriceAt = now + 3;
  processWorld(world, now + 4);
  assert.equal(market.officialPrice, 3.5);
});

test('price cycle never clears population consumption orders', () => {
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
    price: 10.04,
    quantity: 3,
    remaining: 3,
    status: 'open',
    createdAt: now + 1,
  };
  world.orders.push(populationOrder);
  market.cycleBuyQuantity = 20;
  market.cycleSellQuantity = 4;
  market.nextPriceAt = now + 10;

  processWorld(world, now + 11);

  assert.equal(market.officialPrice, 10.04);
  assert.equal(populationOrder.status, 'open');
  assert.equal(populationOrder.remaining, 3);
  assert.equal(market.cycleBuyQuantity, 0);
});
