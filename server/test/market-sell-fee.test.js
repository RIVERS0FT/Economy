import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, createWorld, ensurePlayer } from '../src/domain.js';
import {
  applyFacilityGroupAction,
  createFacilityGroupClientState,
  migrateFacilityGroupWorld,
} from '../src/facility-groups.js';
import {
  applyMarketSellFee,
  calculateCumulativeMarketSellFee,
} from '../src/market-sell-fee.js';

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

test('累计卖出手续费按 1% 向上取整且最低为 1', () => {
  assert.equal(calculateCumulativeMarketSellFee(0), 0);
  assert.equal(calculateCumulativeMarketSellFee(1), 1);
  assert.equal(calculateCumulativeMarketSellFee(100), 1);
  assert.equal(calculateCumulativeMarketSellFee(101), 2);
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
  assert.deepEqual(next, { fee: 1, netTotal: 0 });
  assert.equal(order.fills[0].fee, 0);
  assert.equal(order.fills[0].netTotal, 100);
  assert.equal(order.marketSellFeeGross, 1);
  assert.equal(order.marketSellFeeCharged, 1);
});

test('商品卖单部分成交按同一卖单累计补收手续费', () => {
  const world = createWorld(now);
  deferMarketDemand(world);
  const seller = ensurePlayer(world, bob, now);
  const buyer = ensurePlayer(world, alice, now);
  seller.credits = 0;
  seller.inventories.ore.available = 101;
  buyer.credits = 1_000;

  assert.equal(applyAction(world, bob, 'placeOrder', {
    productId: 'ore', side: 'sell', quantity: 101, price: 1,
  }, now + 1).ok, true);

  for (const [index, quantity] of [30, 30, 40, 1].entries()) {
    assert.equal(applyAction(world, alice, 'placeOrder', {
      productId: 'ore', side: 'buy', quantity, price: 1,
    }, now + 2 + index).ok, true);
  }

  const order = world.orders.find((item) => item.ownerId === bob.id && item.productId === 'ore');
  assert.deepEqual(order.fills.map((fill) => fill.fee), [1, 0, 0, 1]);
  assert.deepEqual(order.fills.map((fill) => fill.netTotal), [29, 30, 40, 0]);
  assert.equal(order.marketSellFeeGross, 101);
  assert.equal(order.marketSellFeeCharged, 2);
  assert.equal(seller.credits, 99);
  assert.equal(seller.stats.systemSinks, 2);
  assert.equal(buyer.credits, 899);
});

test('工厂卖单使用相同手续费并只向本人公开匿名金额字段', () => {
  const world = createWorld(now);
  const seller = ensurePlayer(world, bob, now);
  const buyer = ensurePlayer(world, alice, now);
  seller.credits = 0;
  seller.facilityGroups = [group('farm', 2)];
  buyer.credits = 1_000;
  migrateFacilityGroupWorld(world, now);

  assert.equal(applyFacilityGroupAction(world, bob, 'placeOrder', {
    assetKind: 'facility', assetId: 'farm', side: 'sell', quantity: 2, price: 80,
  }, now + 1).ok, true);
  assert.equal(applyFacilityGroupAction(world, alice, 'placeOrder', {
    assetKind: 'facility', assetId: 'farm', side: 'buy', quantity: 2, price: 80,
  }, now + 2).ok, true);

  const internal = world.orders.find((item) => item.ownerId === bob.id && item.assetKind === 'facility');
  assert.equal(seller.credits, 158);
  assert.equal(seller.stats.systemSinks, 2);
  assert.equal(internal.fills[0].total, 160);
  assert.equal(internal.fills[0].fee, 2);
  assert.equal(internal.fills[0].netTotal, 158);

  const state = createFacilityGroupClientState(world, bob.id, now + 3);
  const publicOrder = state.orders.find((item) => item.id === internal.id);
  assert.equal(publicOrder.fills[0].fee, 2);
  assert.equal(publicOrder.fills[0].netTotal, 158);
  assert.equal('counterparty' in publicOrder.fills[0], false);
  assert.equal('marketSellFeeGross' in publicOrder, false);
  assert.equal('marketSellFeeCharged' in publicOrder, false);
});
