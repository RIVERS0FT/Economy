import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, createWorld, ensurePlayer } from '../src/domain.js';
import {
  applyFacilityGroupAction,
  migrateFacilityGroupWorld,
} from '../src/facility-groups.js';
import {
  applyMarketSellFee,
  calculateCumulativeMarketSellFee,
} from '../src/market-sell-fee.js';
import { DEFAULT_PROVINCE_ID, provinceScopedKey } from '../src/provinces.js';

const now = 1_700_000_000_000;
const alice = { id: 1, email: 'alice@example.com', name: 'Alice' };
const bob = { id: 2, email: 'bob@example.com', name: 'Bob' };

function group(typeId, count) {
  return {
    facilityTypeId: typeId,
    count,
    participatingCount: 0,
    pendingJoinCount: 0,
    enabled: false,
    status: 'stopped',
    statusReason: 'manual',
    activeRecipeId: typeId === 'farm' ? 'wheat-crop' : `${typeId}-default`,
    lifetimeOutput: 0,
  };
}

function deferMarketDemand(world) {
  for (const state of Object.values(world.demandGroups)) state.nextDemandAt = now + 24 * 60 * 60 * 1000;
}

test('累计卖出手续费按成交总额精确收取 1%', () => {
  assert.equal(calculateCumulativeMarketSellFee(0), 0);
  assert.equal(calculateCumulativeMarketSellFee(1), 0.01);
  assert.equal(calculateCumulativeMarketSellFee(100), 1);
  assert.equal(calculateCumulativeMarketSellFee(101), 1.01);
  assert.equal(calculateCumulativeMarketSellFee(200), 2);
});

test('既有卖单只从新成交开始累计且不追收旧 fill', () => {
  const order = {
    id: 'legacy',
    ownerType: 'player',
    ownerId: bob.id,
    side: 'sell',
    fills: [{ id: 'old', quantity: 100, price: 1, total: 100, createdAt: now }],
  };
  const next = applyMarketSellFee(order, 1);
  assert.deepEqual(next, { fee: 0.01, netTotal: 0.99 });
  assert.equal(order.fills[0].fee, 0);
  assert.equal(order.fills[0].netTotal, 100);
  assert.equal(order.marketSellFeeGross, 1);
  assert.equal(order.marketSellFeeCharged, 0.01);
});

test('商品即时卖出每笔按当日成交额收取 1% 且不会留下部分卖单', () => {
  const world = createWorld(now);
  deferMarketDemand(world);
  const seller = ensurePlayer(world, bob, now);
  seller.credits = 0;
  seller.inventories.wheat.available = 101;
  world.markets[provinceScopedKey(DEFAULT_PROVINCE_ID, 'wheat')].officialPrice = 1;

  for (const [index, quantity] of [30, 30, 40, 1].entries()) {
    const response = applyAction(world, bob, 'placeOrder', {
      provinceId: DEFAULT_PROVINCE_ID,
      productId: 'wheat',
      side: 'sell',
      quantity,
      price: 999,
    }, now + 1 + index);
    assert.equal(response.ok, true);
    assert.equal(response.executedPrice, 1);
  }

  const orders = world.orders.filter((item) => item.ownerId === bob.id && item.productId === 'wheat');
  assert.deepEqual(orders.map((order) => order.fills[0].fee), [0.3, 0.3, 0.4, 0.01]);
  assert.deepEqual(orders.map((order) => order.fills[0].netTotal), [29.7, 29.7, 39.6, 0.99]);
  assert.ok(orders.every((order) => order.status === 'filled' && order.remaining === 0));
  assert.equal(seller.credits, 99.99);
  assert.equal(seller.inventories.wheat.available, 0);
  assert.equal(seller.inventories.wheat.frozen, 0);
  assert.equal(seller.stats.systemSinks, 0);
  assert.equal(seller.stats.marketServiceFees, 1.01);
  assert.equal(seller.stats.employmentPayments, 1.01);
});

test('工厂直售被拒绝且不会产生市场手续费', () => {
  const world = createWorld(now);
  const seller = ensurePlayer(world, bob, now);
  seller.credits = 0;
  seller.facilityGroups = [group('farm', 2)];
  migrateFacilityGroupWorld(world, now);

  const response = applyFacilityGroupAction(world, bob, 'placeOrder', {
    assetKind: 'facility', assetId: 'farm', side: 'sell', quantity: 2, price: 80,
  }, now + 1);

  assert.deepEqual(response, { ok: false, message: '工厂资产仅允许通过拍卖交易' });
  assert.equal(seller.credits, 0);
  assert.equal(seller.stats.systemSinks, 0);
  assert.equal(seller.stats.marketServiceFees, 0);
  assert.equal(seller.facilityGroups[0].count, 2);
  assert.equal(world.orders.some((item) => item.ownerId === bob.id && item.assetKind === 'facility'), false);
});
