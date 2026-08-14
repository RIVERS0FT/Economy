import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applySettledCommodityOrder,
  createWorld,
  ensurePlayer,
  migrateWorld,
} from '../src/domain.js';
import {
  applyFacilityGroupAction,
  createFacilityGroupClientState,
  migrateFacilityGroupWorld,
  processFacilityGroupWorld,
} from '../src/facility-groups.js';
import { wealthAssetsFor } from '../src/leaderboards.js';
import {
  DEFAULT_PROVINCE_ID,
  PROVINCE_CATALOG,
  inventoryForProvince,
  provinceScopedKey,
} from '../src/provinces.js';

const NOW = 1_781_000_000_000;
const BEIJING = DEFAULT_PROVINCE_ID;
const SHANGHAI = '310000';
const alice = { id: 501, name: '省级玩家甲' };
const bob = { id: 502, name: '省级玩家乙' };
const carol = { id: 503, name: '省级玩家丙' };

test('province catalog exposes 34 stable unique province-level identifiers', () => {
  assert.equal(PROVINCE_CATALOG.length, 34);
  assert.equal(new Set(PROVINCE_CATALOG.map((province) => province.id)).size, 34);
  assert.equal(PROVINCE_CATALOG.some((province) => province.id === BEIJING), true);
  assert.equal(PROVINCE_CATALOG.some((province) => province.id === SHANGHAI), true);
});

test('world 29 inventory migration conserves legacy assets in the default province without serialized aliases', () => {
  const world = createWorld(NOW);
  const player = ensurePlayer(world, alice, NOW);
  world.version = 29;
  player.inventories = {
    wheat: { available: 7, frozen: 3 },
    rice: { available: 4, frozen: 2 },
  };

  migrateWorld(world, NOW + 1);

  assert.deepEqual(player.inventories[provinceScopedKey(BEIJING, 'wheat')], { available: 7, frozen: 3 });
  assert.deepEqual(player.inventories[provinceScopedKey(BEIJING, 'rice')], { available: 4, frozen: 2 });
  assert.equal(player.inventories.wheat, player.inventories[provinceScopedKey(BEIJING, 'wheat')]);
  assert.equal(Object.keys(player.inventories).includes('wheat'), false);
  assert.equal(Object.values(player.inventories).reduce((sum, item) => sum + item.available + item.frozen, 0), 16);
  assert.equal(JSON.stringify(player.inventories).includes('"wheat":'), false);
});

test('same commodity cannot match across provinces while same-province price-time order remains authoritative', () => {
  const world = createWorld(NOW);
  world.orders = [];
  const buyer = ensurePlayer(world, alice, NOW);
  const firstSeller = ensurePlayer(world, bob, NOW);
  const secondSeller = ensurePlayer(world, carol, NOW);
  buyer.credits = 1_000;
  inventoryForProvince(firstSeller, 'wheat', SHANGHAI).available = 1;
  inventoryForProvince(secondSeller, 'wheat', SHANGHAI).available = 1;

  assert.equal(applySettledCommodityOrder(world, bob, {
    provinceId: SHANGHAI, productId: 'wheat', side: 'sell', quantity: 1, price: 5,
  }, NOW + 1).ok, true);
  assert.equal(applySettledCommodityOrder(world, carol, {
    provinceId: SHANGHAI, productId: 'wheat', side: 'sell', quantity: 1, price: 5,
  }, NOW + 2).ok, true);
  assert.equal(applySettledCommodityOrder(world, alice, {
    provinceId: BEIJING, productId: 'wheat', side: 'buy', quantity: 2, price: 5,
  }, NOW + 3).ok, true);

  assert.equal(inventoryForProvince(buyer, 'wheat', BEIJING).available, 0);
  assert.equal(world.orders.filter((order) => order.provinceId === SHANGHAI && order.side === 'sell' && order.status === 'open').length, 2);

  assert.equal(applySettledCommodityOrder(world, alice, {
    provinceId: SHANGHAI, productId: 'wheat', side: 'buy', quantity: 2, price: 5,
  }, NOW + 4).ok, true);

  const shanghaiSells = world.orders.filter((order) => order.provinceId === SHANGHAI && order.side === 'sell');
  assert.deepEqual(shanghaiSells.map((order) => order.ownerId), [bob.id, carol.id]);
  assert.deepEqual(shanghaiSells.map((order) => order.status), ['filled', 'filled']);
  assert.equal(inventoryForProvince(buyer, 'wheat', SHANGHAI).available, 2);
  assert.equal(world.orders.some((order) => order.provinceId === BEIJING && order.side === 'buy' && order.status === 'open'), true);
});

test('construction and production consume and output only the selected province inventory', () => {
  const world = createWorld(NOW);
  const player = ensurePlayer(world, alice, NOW);
  player.credits = 10_000;

  const built = applyFacilityGroupAction(world, alice, 'buildFacility', {
    provinceId: SHANGHAI,
    facilityTypeId: 'farm',
    quantity: 1,
  }, NOW + 1);
  assert.equal(built.ok, true);
  const farm = player.facilityGroups.find((group) => group.facilityTypeId === 'farm' && group.provinceId === SHANGHAI);
  assert.ok(farm);
  assert.equal(player.facilityGroups.some((group) => group.facilityTypeId === 'farm' && group.provinceId === BEIJING), false);

  Object.assign(farm, {
    enabled: true,
    status: 'running',
    statusReason: undefined,
    participatingCount: 1,
    cycleStartedAt: NOW + 1,
    staffingRateBps: 10_000,
    staffingUpdatedAt: NOW + 1,
    staffingBatchCarryBps: 0,
  });
  processFacilityGroupWorld(world, NOW + 20_002);

  assert.equal(inventoryForProvince(player, 'wheat', SHANGHAI).available, 1);
  assert.equal(inventoryForProvince(player, 'wheat', BEIJING).available, 0);
});

test('facility order transfer preserves the province and client projections stay partitioned', () => {
  const world = createWorld(NOW);
  world.orders = [];
  const seller = ensurePlayer(world, bob, NOW);
  const buyer = ensurePlayer(world, alice, NOW);
  seller.facilityGroups = [{
    facilityTypeId: 'farm', provinceId: SHANGHAI, count: 1, participatingCount: 0,
    enabled: false, status: 'stopped', statusReason: 'manual', lifetimeOutput: 0,
    activeRecipeId: 'wheat-crop', staffingRateBps: 10_000, staffingUpdatedAt: NOW,
    staffingBatchCarryBps: 0,
  }];
  buyer.credits = 1_000;
  migrateFacilityGroupWorld(world, NOW);

  assert.equal(applyFacilityGroupAction(world, bob, 'placeOrder', {
    provinceId: SHANGHAI, assetKind: 'facility', assetId: 'farm', side: 'sell', quantity: 1, price: 80,
  }, NOW + 1).ok, true);
  assert.equal(applyFacilityGroupAction(world, alice, 'placeOrder', {
    provinceId: SHANGHAI, assetKind: 'facility', assetId: 'farm', side: 'buy', quantity: 1, price: 80,
  }, NOW + 2).ok, true);

  assert.equal(seller.facilityGroups.some((group) => group.facilityTypeId === 'farm' && group.provinceId === SHANGHAI), false);
  assert.equal(buyer.facilityGroups.some((group) => group.facilityTypeId === 'farm' && group.provinceId === SHANGHAI && group.count === 1), true);
  assert.equal(buyer.facilityGroups.some((group) => group.facilityTypeId === 'farm' && group.provinceId === BEIJING), false);

  const state = createFacilityGroupClientState(world, alice.id, NOW + 3);
  assert.equal(state.provinceFacilityGroups[SHANGHAI].some((group) => group.facilityTypeId === 'farm'), true);
  assert.deepEqual(state.provinceFacilityGroups[BEIJING] || [], []);
  assert.equal(Object.hasOwn(state.markets, 'wheat'), true);
  assert.equal(Object.hasOwn(state.provinceMarkets[SHANGHAI] || {}, 'wheat'), false);
  assert.equal(state.orders.filter((order) => order.assetKind === 'facility').every((order) => order.provinceId === SHANGHAI), true);
});

test('global wealth ranking values each inventory with its local market price', () => {
  const world = createWorld(NOW);
  const player = ensurePlayer(world, alice, NOW);
  player.credits = 0;
  player.frozenCredits = 0;
  player.facilityGroups = [];
  if (player.bankAccount) player.bankAccount.depositCredits = 0;
  inventoryForProvince(player, 'wheat', BEIJING).available = 2;
  inventoryForProvince(player, 'wheat', SHANGHAI).available = 3;
  world.markets[provinceScopedKey(BEIJING, 'wheat')].lastTradePrice = 4;
  world.markets[provinceScopedKey(SHANGHAI, 'wheat')] = { lastTradePrice: 7 };

  assert.equal(wealthAssetsFor(world, player), 29);
});
