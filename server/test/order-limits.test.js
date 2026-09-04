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
import { DEFAULT_PROVINCE_ID, provinceScopedKey } from '../src/provinces.js';

const now = 1_700_000_000_000;
const alice = { id: 1, email: 'alice@example.com', name: 'Alice' };
const bob = { id: 2, email: 'bob@example.com', name: 'Bob' };

function stoppedGroup(typeId, count) {
  return {
    facilityTypeId: typeId,
    provinceId: DEFAULT_PROVINCE_ID,
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

test('commodity immediate trades keep the safe-integer quantity boundary while factory direct orders are retired', () => {
  const world = createWorld(now);
  const commoditySeller = ensurePlayer(world, alice, now);
  const facilitySeller = ensurePlayer(world, bob, now);
  commoditySeller.inventories.wheat.available = 10_001;
  facilitySeller.facilityGroups = [stoppedGroup('farm', 1_000_001)];
  migrateFacilityGroupWorld(world, now);

  assert.equal(ECONOMY_CONSTANTS.maxOrderQuantity, Number.MAX_SAFE_INTEGER);
  const commodity = applyFacilityGroupAction(world, alice, 'placeOrder', {
    assetKind: 'commodity', assetId: 'wheat', productId: 'wheat', side: 'sell', quantity: 10_001, price: 1,
  }, now + 1);
  assert.equal(commodity.ok, true);
  assert.equal(commodity.quantity, 10_001);
  assert.equal(commoditySeller.inventories.wheat.available, 0);
  assert.equal(commoditySeller.inventories.wheat.frozen, 0);

  assert.deepEqual(applyFacilityGroupAction(world, bob, 'placeOrder', {
    assetKind: 'facility', assetId: 'farm', side: 'sell', quantity: 1_000_001, price: 80,
  }, now + 2), { ok: false, message: '工厂资产仅允许通过拍卖交易' });
  assert.equal(world.orders.some((order) => order.ownerId === bob.id && order.assetKind === 'facility'), false);
});

test('legacy unfinished-order count never blocks a new immediate commodity trade', () => {
  const world = createWorld(now);
  const player = ensurePlayer(world, alice, now);
  player.credits = 1_000_000;
  processFacilityGroupWorld(world, now);

  const catalogSize = PRODUCT_CATALOG.length + FACILITY_TYPE_CATALOG.length;
  const legacyLimit = catalogSize * 10;
  assert.equal(ECONOMY_CONSTANTS.maxOpenOrders, legacyLimit);
  world.orders = Array.from({ length: legacyLimit }, (_, index) => ({
    id: `legacy-commodity-limit-${index}`,
    provinceId: DEFAULT_PROVINCE_ID,
    assetKind: 'commodity', assetId: 'wheat', productId: 'wheat', side: 'buy', ownerType: 'player', ownerId: alice.id,
    price: 1, quantity: 1, remaining: 1, status: 'open', createdAt: now + index,
  }));

  const beforeOpen = world.orders.length;
  const result = applyFacilityGroupAction(world, alice, 'placeOrder', {
    assetKind: 'commodity', assetId: 'wheat', productId: 'wheat', side: 'buy', quantity: 1, price: 1,
  }, now + 1);

  assert.equal(result.ok, true, result.message);
  assert.equal(player.frozenCredits, 0);
  assert.equal(world.orders.filter((order) => ['open', 'partial'].includes(order.status)).length, beforeOpen);
  assert.equal(world.orders.at(-1).status, 'filled');
});

test('client supplied commodity prices are ignored in favor of the daily official price', () => {
  const world = createWorld(now);
  const seller = ensurePlayer(world, alice, now);
  seller.inventories.wheat.available = 2;
  const market = world.markets[provinceScopedKey(DEFAULT_PROVINCE_ID, 'wheat')];
  market.officialPrice = 1.2;

  const high = applyFacilityGroupAction(world, alice, 'placeOrder', {
    assetKind: 'commodity', assetId: 'wheat', productId: 'wheat', side: 'sell', quantity: 1, price: 1_000_000.01,
  }, now + 1);
  const low = applyFacilityGroupAction(world, alice, 'placeOrder', {
    assetKind: 'commodity', assetId: 'wheat', productId: 'wheat', side: 'sell', quantity: 1, price: 0.001,
  }, now + 2);

  assert.equal(high.ok, true);
  assert.equal(low.ok, true);
  assert.equal(high.executedPrice, 1.2);
  assert.equal(low.executedPrice, 1.2);
  assert.equal(seller.inventories.wheat.frozen, 0);
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

test('commodity immediate trades reject totals outside the representable money range', () => {
  const world = createWorld(now);
  ensurePlayer(world, alice, now);
  migrateFacilityGroupWorld(world, now);

  assert.deepEqual(applyFacilityGroupAction(world, alice, 'placeOrder', {
    assetKind: 'commodity', assetId: 'wheat', productId: 'wheat', side: 'sell', quantity: Number.MAX_SAFE_INTEGER, price: 1,
  }, now + 1), { ok: false, message: '交易总额超出系统可表示范围' });
});
