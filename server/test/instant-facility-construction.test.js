import assert from 'node:assert/strict';
import test from 'node:test';
import { EconomyStore } from '../src/runtime-store.js';
import { FACILITY_TYPE_CATALOG } from '../src/domain.js';
import { DEFAULT_PROVINCE_ID } from '../src/provinces.js';

const user = { id: 91, email: 'builder@example.com', name: '建设玩家', role: 'user' };

function prepareStore(now, { fillMaterials = true, credits = 100_000 } = {}) {
  const store = new EconomyStore(':memory:');
  store.getState(user, now);
  const loaded = store.loadWorld(now + 1);
  const player = loaded.world.players[String(user.id)];
  player.credits = credits;
  for (const inventory of Object.values(player.inventories)) {
    inventory.available = fillMaterials ? 10_000 : 0;
    inventory.frozen = 0;
  }
  store.saveWorld(loaded.revision, loaded.world, now + 1);
  return store;
}

function quoteFor(store, facilityTypeId, quantity, now) {
  return store.getFacilityBuildQuote(user, {
    provinceId: DEFAULT_PROVINCE_ID,
    facilityTypeId,
    quantity,
  }, now).quote;
}

function oneClickPayload(quote, facilityTypeId, quantity = 1) {
  return {
    provinceId: DEFAULT_PROVINCE_ID,
    facilityTypeId,
    quantity,
    autoProcure: true,
    maxProcurementTotal: quote.estimatedTotal,
    materialPriceCaps: quote.materialPriceCaps,
  };
}

test('new players do not receive a starter construction material pack', () => {
  const now = 1_699_900_000_000;
  const store = new EconomyStore(':memory:');
  try {
    const state = store.getState(user, now);
    assert.equal(state.inventories.timber.available, 0);
    assert.equal(state.inventories.ore.available, 0);
  } finally {
    store.close();
  }
});

test('farm and orchard batches atomically consume only credits and complete immediately', () => {
  const now = 1_700_000_000_000;
  const store = prepareStore(now);
  try {
    const before = store.getState(user, now + 2);
    const farm = FACILITY_TYPE_CATALOG.find((item) => item.id === 'farm');
    const orchard = FACILITY_TYPE_CATALOG.find((item) => item.id === 'orchard');
    const farmRequest = {
      action: 'buildFacility',
      payload: { provinceId: DEFAULT_PROVINCE_ID, facilityTypeId: 'farm', quantity: 2 },
      requestKey: 'instant-build-0001', method: 'POST', path: '/api/game/facilities',
    };
    const first = store.apply(user, farmRequest, now + 3);
    const repeated = store.apply(user, farmRequest, now + 4);
    assert.deepEqual(repeated, first);
    assert.equal(first.result.ok, true);

    const orchardResult = store.apply(user, {
      action: 'buildFacility',
      payload: { provinceId: DEFAULT_PROVINCE_ID, facilityTypeId: 'orchard', quantity: 3 },
      requestKey: 'instant-build-0002', method: 'POST', path: '/api/game/facilities',
    }, now + 5);
    assert.equal(orchardResult.result.ok, true);

    const state = store.getState(user, now + 6);
    assert.equal(state.facilityConstruction, undefined);
    assert.equal(state.facilityGroups.find((group) => group.facilityTypeId === 'farm')?.count, 2);
    assert.equal(state.facilityGroups.find((group) => group.facilityTypeId === 'orchard')?.count, 3);
    assert.equal(state.credits, before.credits - farm.buildCost * 2 - orchard.buildCost * 3);
    assert.deepEqual(state.inventories, before.inventories);
  } finally {
    store.close();
  }
});

test('material-backed construction rolls back completely when one material is missing', () => {
  const now = 1_700_100_000_000;
  const store = prepareStore(now);
  try {
    const loaded = store.loadWorld(now + 2);
    loaded.world.players[String(user.id)].inventories.timber.available = 0;
    store.saveWorld(loaded.revision, loaded.world, now + 2);
    const before = store.getState(user, now + 3);
    const result = store.apply(user, {
      action: 'buildFacility', payload: { provinceId: DEFAULT_PROVINCE_ID, facilityTypeId: 'ranch', quantity: 1 }, requestKey: 'instant-build-0003',
      method: 'POST', path: '/api/game/facilities',
    }, now + 4);
    assert.equal(result.result.ok, false);
    assert.match(result.result.message, /建造材料不足/);
    const after = store.getState(user, now + 5);
    assert.equal(after.credits, before.credits);
    assert.deepEqual(after.inventories, before.inventories);
    assert.equal(after.facilityGroups.find((group) => group.facilityTypeId === 'ranch'), undefined);
  } finally {
    store.close();
  }
});

test('one-click construction buys every missing material from the daily official price and stays idempotent', () => {
  const now = 1_700_150_000_000;
  const store = prepareStore(now, { fillMaterials: false });
  try {
    const ranch = FACILITY_TYPE_CATALOG.find((item) => item.id === 'ranch');
    const quote = quoteFor(store, 'ranch', 1, now + 10);
    assert.equal(quote.complete, true);
    assert.ok(quote.estimatedTotal > 0);
    assert.deepEqual(quote.unavailableProductIds, []);
    assert.deepEqual(quote.selfCrossingProductIds, []);
    const before = store.getState(user, now + 11);
    const request = {
      action: 'buildFacility', payload: oneClickPayload(quote, 'ranch'), requestKey: 'instant-build-procure-0001',
      method: 'POST', path: '/api/game/facilities',
    };
    const first = store.apply(user, request, now + 12);
    const repeated = store.apply(user, request, now + 13);
    assert.deepEqual(repeated, first, '幂等重试不得重复采购或建厂');
    assert.equal(first.result.ok, true);
    assert.match(first.result.message, /一键购齐/);

    const after = store.getState(user, now + 14);
    assert.equal(after.facilityGroups.find((group) => group.facilityTypeId === 'ranch')?.count, 1);
    for (const input of ranch.buildInputs) assert.equal(after.inventories[input.productId].available, 0);
    assert.equal(
      Number((before.credits - after.credits).toFixed(6)),
      Number((ranch.buildCost + quote.estimatedTotal).toFixed(6)),
    );
    const purchasedQuantity = ranch.buildInputs.reduce((sum, input) => sum + input.quantity, 0);
    const completedPurchases = after.orders.filter((order) => order.isOwn && order.assetKind === 'commodity' && order.status === 'filled');
    assert.equal(completedPurchases.reduce((sum, order) => sum + order.quantity, 0), purchasedQuantity);
    assert.equal(completedPurchases.some((order) => ['open', 'partial'].includes(order.status)), false);
  } finally {
    store.close();
  }
});

test('one-click construction rejects stale daily-price protection atomically', () => {
  const now = 1_700_170_000_000;
  const store = prepareStore(now, { fillMaterials: false });
  try {
    const quote = quoteFor(store, 'ranch', 1, now + 10);
    const [productId, price] = Object.entries(quote.materialPriceCaps)[0];
    const before = store.getState(user, now + 11);
    const result = store.apply(user, {
      action: 'buildFacility',
      payload: {
        ...oneClickPayload(quote, 'ranch'),
        materialPriceCaps: { ...quote.materialPriceCaps, [productId]: Math.max(0.01, Number((price - 0.01).toFixed(2))) },
      },
      requestKey: 'instant-build-procure-0002', method: 'POST', path: '/api/game/facilities',
    }, now + 12);
    assert.equal(result.result.ok, false);
    assert.match(result.result.message, /今日系统价已变化|价格保护/);
    const after = store.getState(user, now + 13);
    assert.equal(after.credits, before.credits);
    assert.deepEqual(after.inventories, before.inventories);
    assert.equal(after.facilityGroups.find((group) => group.facilityTypeId === 'ranch'), undefined);
  } finally {
    store.close();
  }
});

test('one-click construction rolls back when total funds cannot cover build plus official-price procurement', () => {
  const now = 1_700_175_000_000;
  const store = prepareStore(now, { fillMaterials: false });
  try {
    const quote = quoteFor(store, 'ranch', 1, now + 10);
    const ranch = FACILITY_TYPE_CATALOG.find((item) => item.id === 'ranch');
    const loaded = store.loadWorld(now + 11);
    loaded.world.players[String(user.id)].credits = ranch.buildCost + Math.max(0, quote.estimatedTotal - 0.01);
    store.saveWorld(loaded.revision, loaded.world, now + 11);
    const before = store.getState(user, now + 12);
    const result = store.apply(user, {
      action: 'buildFacility', payload: oneClickPayload(quote, 'ranch'), requestKey: 'instant-build-procure-0003',
      method: 'POST', path: '/api/game/facilities',
    }, now + 13);
    assert.equal(result.result.ok, false);
    assert.match(result.result.message, /总资金不足/);
    const after = store.getState(user, now + 14);
    assert.equal(after.credits, before.credits);
    assert.deepEqual(after.inventories, before.inventories);
    assert.equal(after.facilityGroups.find((group) => group.facilityTypeId === 'ranch'), undefined);
  } finally {
    store.close();
  }
});

test('one-click construction ignores legacy warehouse capacity fields during official-price procurement', () => {
  const now = 1_700_180_000_000;
  const store = prepareStore(now, { fillMaterials: false });
  try {
    const quote = quoteFor(store, 'ranch', 1, now + 10);
    const loaded = store.loadWorld(now + 11);
    const player = loaded.world.players[String(user.id)];
    player.inventoryCapacity = 1;
    player.warehouseLevel = 99;
    store.saveWorld(loaded.revision, loaded.world, now + 11);
    const result = store.apply(user, {
      action: 'buildFacility', payload: oneClickPayload(quote, 'ranch'), requestKey: 'instant-build-procure-0004',
      method: 'POST', path: '/api/game/facilities',
    }, now + 12);
    assert.equal(result.result.ok, true);
    const after = store.getState(user, now + 13);
    assert.equal(after.facilityGroups.find((group) => group.facilityTypeId === 'ranch')?.count, 1);
    assert.equal(Object.hasOwn(after, 'inventoryCapacity'), false);
    assert.equal(Object.hasOwn(after, 'warehouseLevel'), false);
  } finally {
    store.close();
  }
});
