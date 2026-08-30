import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createWorld,
  ECONOMY_CONSTANTS,
  ensurePlayer,
  FACILITY_TYPE_CATALOG,
  PRODUCT_CATALOG,
} from '../src/domain.js';
import {
  applyFacilityGroupAction,
  migrateFacilityGroupWorld,
  processFacilityGroupWorld,
} from '../src/facility-groups.js';

const now = 1_700_000_000_000;
const alice = { id: 1, email: 'alice@example.com', name: 'Alice' };
const bob = { id: 2, email: 'bob@example.com', name: 'Bob' };

function stoppedGroup(typeId, count) {
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

test('commodity orders keep the safe-integer quantity boundary while factory direct orders are retired', () => {
  const world = createWorld(now);
  const commoditySeller = ensurePlayer(world, alice, now);
  const facilitySeller = ensurePlayer(world, bob, now);
  commoditySeller.inventories.wheat.available = 10_001;
  facilitySeller.facilityGroups = [stoppedGroup('farm', 1_000_001)];
  migrateFacilityGroupWorld(world, now);

  assert.equal(ECONOMY_CONSTANTS.maxOrderQuantity, Number.MAX_SAFE_INTEGER);
  assert.equal(applyFacilityGroupAction(world, alice, 'placeOrder', {
    assetKind: 'commodity', assetId: 'wheat', side: 'sell', quantity: 10_001, price: 1,
  }, now + 1).ok, true);
  assert.deepEqual(applyFacilityGroupAction(world, bob, 'placeOrder', {
    assetKind: 'facility', assetId: 'farm', side: 'sell', quantity: 1_000_001, price: 80,
  }, now + 2), { ok: false, message: '工厂资产仅允许通过拍卖交易' });

  assert.equal(world.orders.find((order) => order.ownerId === alice.id && order.assetKind === 'commodity')?.quantity, 10_001);
  assert.equal(world.orders.some((order) => order.ownerId === bob.id && order.assetKind === 'facility'), false);
});

test('unfinished order limit still applies to commodity orders while factory direct orders reject independently', () => {
  const world = createWorld(now);
  const player = ensurePlayer(world, alice, now);
  player.credits = 1_000_000;
  processFacilityGroupWorld(world, now);

  const catalogSize = PRODUCT_CATALOG.length + FACILITY_TYPE_CATALOG.length;
  const expectedLimit = catalogSize * 10;
  assert.equal(ECONOMY_CONSTANTS.maxOpenOrders, expectedLimit);

  world.orders = Array.from({ length: expectedLimit }, (_, index) => ({
    id: `commodity-limit-${index}`,
    assetKind: 'commodity',
    assetId: 'wheat',
    productId: 'wheat',
    side: 'buy',
    ownerType: 'player',
    ownerId: alice.id,
    ownerName: 'Alice',
    price: 1,
    quantity: 1,
    remaining: 1,
    status: 'open',
    createdAt: now + index,
  }));

  const commodityResult = applyFacilityGroupAction(world, alice, 'placeOrder', {
    assetKind: 'commodity', assetId: 'wheat', side: 'buy', quantity: 1, price: 1,
  }, now);
  const facilityResult = applyFacilityGroupAction(world, alice, 'placeOrder', {
    assetKind: 'facility', assetId: 'farm', side: 'buy', quantity: 1, price: 80,
  }, now);

  assert.deepEqual(commodityResult, { ok: false, message: '未完成订单数量已达上限' });
  assert.deepEqual(facilityResult, { ok: false, message: '工厂资产仅允许通过拍卖交易' });
});

test('commodity orders keep the cent tick without a fixed business price cap', () => {
  const world = createWorld(now);
  const commoditySeller = ensurePlayer(world, alice, now);
  commoditySeller.inventories.wheat.available = 2;
  migrateFacilityGroupWorld(world, now);

  const uncappedPrice = 1_000_000.01;
  assert.equal(applyFacilityGroupAction(world, alice, 'placeOrder', {
    assetKind: 'commodity', assetId: 'wheat', side: 'sell', quantity: 1, price: uncappedPrice,
  }, now + 1).ok, true);
  assert.equal(applyFacilityGroupAction(world, alice, 'placeOrder', {
    assetKind: 'commodity', assetId: 'wheat', side: 'sell', quantity: 1, price: 0.01,
  }, now + 2).ok, true);

  assert.equal(world.orders.find((order) => order.ownerId === alice.id && order.price === uncappedPrice)?.price, uncappedPrice);
  assert.deepEqual(applyFacilityGroupAction(world, alice, 'placeOrder', {
    assetKind: 'commodity', assetId: 'wheat', side: 'sell', quantity: 1, price: 0.001,
  }, now + 3), { ok: false, message: '订单参数无效' });
});

test('factory direct orders reject before price or notional validation', () => {
  const world = createWorld(now);
  const seller = ensurePlayer(world, bob, now);
  seller.facilityGroups = [stoppedGroup('farm', 2)];
  migrateFacilityGroupWorld(world, now);

  for (const payload of [
    { quantity: 1, price: 1_000_000.01 },
    { quantity: 1, price: 0.001 },
    { quantity: Number.MAX_SAFE_INTEGER, price: 80 },
  ]) {
    assert.deepEqual(applyFacilityGroupAction(world, bob, 'placeOrder', {
      assetKind: 'facility', assetId: 'farm', side: 'sell', ...payload,
    }, now + 4), { ok: false, message: '工厂资产仅允许通过拍卖交易' });
  }
  assert.equal(seller.facilityGroups[0].count, 2);
  assert.equal(world.orders.some((order) => order.ownerId === bob.id && order.assetKind === 'facility'), false);
});

test('commodity orders reject notionals outside the representable money range', () => {
  const world = createWorld(now);
  ensurePlayer(world, alice, now);
  migrateFacilityGroupWorld(world, now);

  assert.deepEqual(applyFacilityGroupAction(world, alice, 'placeOrder', {
    assetKind: 'commodity', assetId: 'wheat', side: 'sell', quantity: Number.MAX_SAFE_INTEGER, price: 1,
  }, now + 1), { ok: false, message: '订单总额超出系统可表示范围' });
});
