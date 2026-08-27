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
  installDefaultProvinceAliases,
  inventoryForProvince,
  provinceScopedKey,
  syncDefaultProvinceAlias,
} from '../src/provinces.js';

const NOW = 1_781_000_000_000;
const CALIFORNIA = DEFAULT_PROVINCE_ID;
const GEORGIA = '310000';
const LEGACY_REGION_IDS = Object.freeze([
  '110000', '120000', '130000', '140000', '150000', '210000', '220000', '230000',
  '310000', '320000', '330000', '340000', '350000', '360000', '370000', '410000',
  '420000', '430000', '440000', '450000', '460000', '500000', '510000', '520000',
  '530000', '540000', '610000', '620000', '630000', '640000', '650000', '710000',
  '810000', '820000',
]);
const alice = { id: 501, name: '州级玩家甲' };
const bob = { id: 502, name: '州级玩家乙' };
const carol = { id: 503, name: '州级玩家丙' };

function countOwnKeyScans(target) {
  let scans = 0;
  return {
    record: new Proxy(target, {
      ownKeys(value) {
        scans += 1;
        return Reflect.ownKeys(value);
      },
    }),
    scans: () => scans,
  };
}

test('region catalog exposes 48 stable unique contiguous-state identifiers', () => {
  assert.equal(PROVINCE_CATALOG.length, 48);
  assert.equal(new Set(PROVINCE_CATALOG.map((province) => province.id)).size, 48);
  assert.equal(new Set(PROVINCE_CATALOG.map((province) => province.mapName)).size, 48);
  assert.equal(LEGACY_REGION_IDS.every((id) => PROVINCE_CATALOG.some((province) => province.id === id)), true);
  assert.equal(PROVINCE_CATALOG.find((province) => province.id === CALIFORNIA)?.mapName, 'California');
  assert.equal(PROVINCE_CATALOG.find((province) => province.id === GEORGIA)?.mapName, 'Georgia');
  assert.equal(PROVINCE_CATALOG.some((province) => province.mapName === 'Alaska'), false);
  assert.equal(PROVINCE_CATALOG.some((province) => province.mapName === 'Hawaii'), false);
  assert.equal(PROVINCE_CATALOG.some((province) => province.mapName === 'District of Columbia'), false);
});

test('default province alias installation scans each record only once', () => {
  const defaultKey = provinceScopedKey(CALIFORNIA, 'wheat');
  const georgiaKey = provinceScopedKey(GEORGIA, 'wheat');
  const observed = countOwnKeyScans({
    [defaultKey]: { price: 4 },
    [georgiaKey]: { price: 7 },
  });

  installDefaultProvinceAliases(observed.record);
  const firstPassScans = observed.scans();
  assert.ok(firstPassScans > 0);
  assert.equal(observed.record.wheat, observed.record[defaultKey]);
  assert.equal(Object.keys(observed.record).includes('wheat'), false);

  for (let index = 0; index < 1_000; index += 1) {
    installDefaultProvinceAliases(observed.record);
  }
  assert.equal(observed.scans(), firstPassScans + 1);
  assert.equal(observed.record[georgiaKey].price, 7);
});

test('default province alias sync updates one dynamic asset without rescanning the record', () => {
  const wheatKey = provinceScopedKey(CALIFORNIA, 'wheat');
  const riceKey = provinceScopedKey(CALIFORNIA, 'rice');
  const observed = countOwnKeyScans({
    [wheatKey]: { price: 4 },
  });

  installDefaultProvinceAliases(observed.record);
  const installedScans = observed.scans();
  observed.record[riceKey] = { price: 6 };
  syncDefaultProvinceAlias(observed.record, 'rice');

  assert.equal(observed.record.rice, observed.record[riceKey]);
  assert.equal(observed.scans(), installedScans);

  delete observed.record[riceKey];
  syncDefaultProvinceAlias(observed.record, 'rice');
  assert.equal(Object.hasOwn(observed.record, 'rice'), false);
  assert.equal(observed.scans(), installedScans);
});

test('inventory lookup performs legacy inventory migration once per inventory record', () => {
  const observed = countOwnKeyScans({
    wheat: { available: 3, frozen: 2 },
  });
  const player = { inventories: observed.record };

  const defaultInventory = inventoryForProvince(player, 'wheat', CALIFORNIA);
  const firstPassScans = observed.scans();
  assert.ok(firstPassScans > 0);
  assert.deepEqual(defaultInventory, { available: 3, frozen: 2, inTransit: 0 });

  for (let index = 0; index < 1_000; index += 1) {
    inventoryForProvince(player, 'wheat', GEORGIA);
  }
  assert.equal(observed.scans(), firstPassScans);
  assert.deepEqual(inventoryForProvince(player, 'wheat', GEORGIA), {
    available: 0,
    frozen: 0,
    inTransit: 0,
  });
});

test('world 30 geography replacement keeps legacy scoped assets on their existing region IDs', () => {
  const world = createWorld(NOW);
  const player = ensurePlayer(world, alice, NOW);
  inventoryForProvince(player, 'wheat', GEORGIA).available = 9;
  const originalKey = provinceScopedKey(GEORGIA, 'wheat');

  migrateWorld(world, NOW + 1);

  assert.equal(world.version, 32);
  assert.equal(player.inventories[originalKey].available, 9);
  assert.equal(Object.keys(player.inventories).includes(originalKey), true);
});

test('world 29 inventory migration conserves legacy assets in default California without serialized aliases', () => {
  const world = createWorld(NOW);
  const player = ensurePlayer(world, alice, NOW);
  world.version = 29;
  player.inventories = {
    wheat: { available: 7, frozen: 3 },
    rice: { available: 4, frozen: 2 },
  };

  migrateWorld(world, NOW + 1);

  assert.deepEqual(player.inventories[provinceScopedKey(CALIFORNIA, 'wheat')], { available: 7, frozen: 3, inTransit: 0 });
  assert.deepEqual(player.inventories[provinceScopedKey(CALIFORNIA, 'rice')], { available: 4, frozen: 2, inTransit: 0 });
  assert.equal(player.inventories.wheat, player.inventories[provinceScopedKey(CALIFORNIA, 'wheat')]);
  assert.equal(Object.keys(player.inventories).includes('wheat'), false);
  assert.equal(Object.values(player.inventories).reduce((sum, item) => sum + item.available + item.frozen, 0), 16);
  assert.equal(JSON.stringify(player.inventories).includes('"wheat":'), false);
});

test('same commodity cannot match across states while same-state price-time order remains authoritative', () => {
  const world = createWorld(NOW);
  world.orders = [];
  const buyer = ensurePlayer(world, alice, NOW);
  const firstSeller = ensurePlayer(world, bob, NOW);
  const secondSeller = ensurePlayer(world, carol, NOW);
  buyer.credits = 1_000;
  inventoryForProvince(firstSeller, 'wheat', GEORGIA).available = 1;
  inventoryForProvince(secondSeller, 'wheat', GEORGIA).available = 1;

  assert.equal(applySettledCommodityOrder(world, bob, {
    provinceId: GEORGIA, productId: 'wheat', side: 'sell', quantity: 1, price: 5,
  }, NOW + 1).ok, true);
  assert.equal(applySettledCommodityOrder(world, carol, {
    provinceId: GEORGIA, productId: 'wheat', side: 'sell', quantity: 1, price: 5,
  }, NOW + 2).ok, true);
  assert.equal(applySettledCommodityOrder(world, alice, {
    provinceId: CALIFORNIA, productId: 'wheat', side: 'buy', quantity: 2, price: 5,
  }, NOW + 3).ok, true);

  assert.equal(inventoryForProvince(buyer, 'wheat', CALIFORNIA).available, 0);
  assert.equal(world.orders.filter((order) => order.provinceId === GEORGIA && order.side === 'sell' && order.status === 'open').length, 2);

  assert.equal(applySettledCommodityOrder(world, alice, {
    provinceId: GEORGIA, productId: 'wheat', side: 'buy', quantity: 2, price: 5,
  }, NOW + 4).ok, true);

  const georgiaSells = world.orders.filter((order) => order.provinceId === GEORGIA && order.side === 'sell');
  assert.deepEqual(georgiaSells.map((order) => order.ownerId), [bob.id, carol.id]);
  assert.deepEqual(georgiaSells.map((order) => order.status), ['filled', 'filled']);
  assert.equal(inventoryForProvince(buyer, 'wheat', GEORGIA).available, 2);
  assert.equal(world.orders.some((order) => order.provinceId === CALIFORNIA && order.side === 'buy' && order.status === 'open'), true);
});

test('construction and production consume and output only the selected province inventory', () => {
  const world = createWorld(NOW);
  const player = ensurePlayer(world, alice, NOW);
  player.credits = 10_000;

  const built = applyFacilityGroupAction(world, alice, 'buildFacility', {
    provinceId: GEORGIA,
    facilityTypeId: 'farm',
    quantity: 1,
  }, NOW + 1);
  assert.equal(built.ok, true);
  const farm = player.facilityGroups.find((group) => group.facilityTypeId === 'farm' && group.provinceId === GEORGIA);
  assert.ok(farm);
  assert.equal(player.facilityGroups.some((group) => group.facilityTypeId === 'farm' && group.provinceId === CALIFORNIA), false);

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

  assert.equal(inventoryForProvince(player, 'wheat', GEORGIA).available, 1);
  assert.equal(inventoryForProvince(player, 'wheat', CALIFORNIA).available, 0);
});

test('facility order transfer preserves the province and client projections stay partitioned', () => {
  const world = createWorld(NOW);
  world.orders = [];
  const seller = ensurePlayer(world, bob, NOW);
  const buyer = ensurePlayer(world, alice, NOW);
  seller.facilityGroups = [{
    facilityTypeId: 'farm', provinceId: GEORGIA, count: 1, participatingCount: 0,
    enabled: false, status: 'stopped', statusReason: 'manual', lifetimeOutput: 0,
    activeRecipeId: 'wheat-crop', staffingRateBps: 10_000, staffingUpdatedAt: NOW,
    staffingBatchCarryBps: 0,
  }];
  buyer.credits = 1_000;
  migrateFacilityGroupWorld(world, NOW);

  assert.equal(applyFacilityGroupAction(world, bob, 'placeOrder', {
    provinceId: GEORGIA, assetKind: 'facility', assetId: 'farm', side: 'sell', quantity: 1, price: 80,
  }, NOW + 1).ok, true);
  assert.equal(applyFacilityGroupAction(world, alice, 'placeOrder', {
    provinceId: GEORGIA, assetKind: 'facility', assetId: 'farm', side: 'buy', quantity: 1, price: 80,
  }, NOW + 2).ok, true);

  assert.equal(seller.facilityGroups.some((group) => group.facilityTypeId === 'farm' && group.provinceId === GEORGIA), false);
  assert.equal(buyer.facilityGroups.some((group) => group.facilityTypeId === 'farm' && group.provinceId === GEORGIA && group.count === 1), true);
  assert.equal(buyer.facilityGroups.some((group) => group.facilityTypeId === 'farm' && group.provinceId === CALIFORNIA), false);

  const state = createFacilityGroupClientState(world, alice.id, NOW + 3);
  assert.equal(state.provinceFacilityGroups[GEORGIA].some((group) => group.facilityTypeId === 'farm'), true);
  assert.deepEqual(state.provinceFacilityGroups[CALIFORNIA] || [], []);
  assert.equal(Object.hasOwn(state.markets, 'wheat'), true);
  assert.equal(Object.hasOwn(state.provinceMarkets[GEORGIA] || {}, 'wheat'), true);
  assert.equal(state.provinceMarkets[GEORGIA].wheat.provinceId, GEORGIA);
  assert.equal(state.orders.filter((order) => order.assetKind === 'facility').every((order) => order.provinceId === GEORGIA), true);
});

test('global wealth ranking values each inventory with its local market price', () => {
  const world = createWorld(NOW);
  const player = ensurePlayer(world, alice, NOW);
  player.credits = 0;
  player.frozenCredits = 0;
  player.facilityGroups = [];
  if (player.bankAccount) player.bankAccount.depositCredits = 0;
  inventoryForProvince(player, 'wheat', CALIFORNIA).available = 2;
  inventoryForProvince(player, 'wheat', GEORGIA).available = 3;
  world.markets[provinceScopedKey(CALIFORNIA, 'wheat')].officialPrice = 4;
  world.markets[provinceScopedKey(GEORGIA, 'wheat')] = { lastTradePrice: 7, officialPrice: 7 };

  assert.equal(wealthAssetsFor(world, player), 29);
});
