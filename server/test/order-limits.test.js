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

test('commodity and facility orders share one safe-integer quantity boundary without a fixed business cap', () => {
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
  assert.equal(applyFacilityGroupAction(world, bob, 'placeOrder', {
    assetKind: 'facility', assetId: 'farm', side: 'sell', quantity: 1_000_001, price: 80,
  }, now + 2).ok, true);

  assert.equal(world.orders.find((order) => order.ownerId === alice.id && order.assetKind === 'commodity')?.quantity, 10_001);
  assert.equal(world.orders.find((order) => order.ownerId === bob.id && order.assetKind === 'facility')?.quantity, 1_000_001);
});

test('commodity and facility books share the catalog-sized unfinished order limit', () => {
  const world = createWorld(now);
  const player = ensurePlayer(world, alice, now);
  player.credits = 1_000_000;
  processFacilityGroupWorld(world, now);

  const expectedLimit = PRODUCT_CATALOG.length + FACILITY_TYPE_CATALOG.length;
  assert.equal(ECONOMY_CONSTANTS.maxOpenOrders, expectedLimit);
  assert.equal(expectedLimit, 52);

  world.orders = [
    ...PRODUCT_CATALOG.map((product, index) => ({
      id: `commodity-limit-${index}`,
      assetKind: 'commodity',
      assetId: product.id,
      productId: product.id,
      side: 'buy',
      ownerType: 'player',
      ownerId: alice.id,
      ownerName: 'Alice',
      price: 1,
      quantity: 1,
      remaining: 1,
      status: 'open',
      createdAt: now + index,
    })),
    ...FACILITY_TYPE_CATALOG.map((facility, index) => ({
      id: `facility-limit-${index}`,
      assetKind: 'facility',
      assetId: facility.id,
      facilityTypeId: facility.id,
      side: 'buy',
      ownerType: 'player',
      ownerId: alice.id,
      ownerName: 'Alice',
      price: facility.systemValue,
      quantity: 1,
      remaining: 1,
      status: 'open',
      createdAt: now + PRODUCT_CATALOG.length + index,
    })),
  ];

  const commodityResult = applyFacilityGroupAction(world, alice, 'placeOrder', {
    assetKind: 'commodity', assetId: 'wheat', side: 'buy', quantity: 1, price: 1,
  }, now);
  const facilityResult = applyFacilityGroupAction(world, alice, 'placeOrder', {
    assetKind: 'facility', assetId: 'farm', side: 'buy', quantity: 1, price: 80,
  }, now);

  assert.deepEqual(commodityResult, { ok: false, message: '未完成订单数量已达上限' });
  assert.deepEqual(facilityResult, { ok: false, message: '未完成订单数量已达上限' });
});

test('orders reject notionals outside the representable money range', () => {
  const world = createWorld(now);
  ensurePlayer(world, alice, now);
  ensurePlayer(world, bob, now);
  migrateFacilityGroupWorld(world, now);

  assert.deepEqual(applyFacilityGroupAction(world, alice, 'placeOrder', {
    assetKind: 'commodity', assetId: 'wheat', side: 'sell', quantity: Number.MAX_SAFE_INTEGER, price: 1,
  }, now + 1), { ok: false, message: '订单总额超出系统可表示范围' });
  assert.deepEqual(applyFacilityGroupAction(world, bob, 'placeOrder', {
    assetKind: 'facility', assetId: 'farm', side: 'sell', quantity: Number.MAX_SAFE_INTEGER, price: 80,
  }, now + 2), { ok: false, message: '工厂订单总额超出系统可表示范围' });
});
