import assert from 'node:assert/strict';
import test from 'node:test';
import { EconomyStore } from '../src/runtime-store.js';
import { FACILITY_TYPE_CATALOG } from '../src/domain.js';

const user = { id: 91, email: 'builder@example.com', name: '建设玩家', role: 'user' };

function prepareStore(now) {
  const store = new EconomyStore(':memory:');
  store.getState(user, now);
  const loaded = store.loadWorld(now + 1);
  const player = loaded.world.players[String(user.id)];
  player.credits = 100_000;
  for (const inventory of Object.values(player.inventories)) inventory.available = 10_000;
  store.saveWorld(loaded.revision, loaded.world, now + 1);
  return store;
}

function prepareProcurementStore(now, { warehouseFill = 0 } = {}) {
  const store = new EconomyStore(':memory:');
  store.getState(user, now);
  const loaded = store.loadWorld(now + 1);
  const buyer = loaded.world.players[String(user.id)];
  buyer.credits = 100_000;
  for (const inventory of Object.values(buyer.inventories)) {
    inventory.available = 0;
    inventory.frozen = 0;
  }
  buyer.inventoryCapacity = 500;
  if (warehouseFill > 0) buyer.inventories.wheat.available = warehouseFill;
  store.saveWorld(loaded.revision, loaded.world, now + 1);
  return store;
}

function openPlayerCommodityOrders(state) {
  return (state.orders || []).filter((order) => (
    order.isOwn
    && order.assetKind === 'commodity'
    && (order.status === 'open' || order.status === 'partial')
  ));
}

const broadPriceCaps = { timber: 999, ore: 999 };


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
      action: 'buildFacility', payload: { facilityTypeId: 'farm', quantity: 2 }, requestKey: 'instant-build-0001',
      method: 'POST', path: '/api/game/facilities',
    };
    const first = store.apply(user, farmRequest, now + 3);
    const repeated = store.apply(user, farmRequest, now + 4);
    assert.deepEqual(repeated, first, '幂等重试必须返回原结果');
    assert.equal(first.result.ok, true);

    const orchardResult = store.apply(user, {
      action: 'buildFacility', payload: { facilityTypeId: 'orchard', quantity: 3 }, requestKey: 'instant-build-0002',
      method: 'POST', path: '/api/game/facilities',
    }, now + 5);
    assert.equal(orchardResult.result.ok, true);

    const state = store.getState(user, now + 6);
    assert.equal(state.facilityConstruction, undefined);
    assert.equal(state.facilityGroups.find((group) => group.facilityTypeId === 'farm')?.count, 2);
    assert.equal(state.facilityGroups.find((group) => group.facilityTypeId === 'orchard')?.count, 3);
    assert.equal(state.credits, before.credits - farm.buildCost * 2 - orchard.buildCost * 3);
    assert.deepEqual(state.inventories, before.inventories, '现金建造不得扣除任何商品库存');
    assert.equal(state.stats.facilitiesConstructed, 5);
  } finally {
    store.close();
  }
});

test('material-backed construction rolls back completely when one material is missing and auto procurement is not requested', () => {
  const now = 1_700_100_000_000;
  const store = prepareStore(now);
  try {
    const loaded = store.loadWorld(now + 2);
    loaded.world.players[String(user.id)].inventories.timber.available = 0;
    store.saveWorld(loaded.revision, loaded.world, now + 2);
    const before = store.getState(user, now + 3);
    const result = store.apply(user, {
      action: 'buildFacility', payload: { facilityTypeId: 'ranch', quantity: 1 }, requestKey: 'instant-build-0003',
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

test('one-click construction buys every missing material at today official prices and stays idempotent', () => {
  const now = 1_700_150_000_000;
  const store = prepareProcurementStore(now);
  try {
    const before = store.getState(user, now + 10);
    const ranch = FACILITY_TYPE_CATALOG.find((item) => item.id === 'ranch');
    const request = {
      action: 'buildFacility',
      payload: {
        facilityTypeId: 'ranch',
        quantity: 1,
        autoProcure: true,
        maxProcurementTotal: 10_000,
        materialPriceCaps: broadPriceCaps,
      },
      requestKey: 'instant-build-procure-0001',
      method: 'POST',
      path: '/api/game/facilities',
    };
    const first = store.apply(user, request, now + 11);
    const repeated = store.apply(user, request, now + 12);
    assert.deepEqual(repeated, first, '一键采购建造的幂等重试不得重复采购或建厂');
    assert.equal(first.result.ok, true, first.result.message);
    assert.match(first.result.message, /一键购齐 5 件建造材料/);

    const after = store.getState(user, now + 13);
    assert.equal(after.facilityGroups.find((group) => group.facilityTypeId === 'ranch')?.count, 1);
    assert.equal(after.inventories.timber.available, 0);
    assert.equal(after.inventories.ore.available, 0);
    assert.equal(after.inventories.timber.frozen, 0);
    assert.equal(after.inventories.ore.frozen, 0);
    assert.equal(after.frozenCredits, 0);
    assert.equal(openPlayerCommodityOrders(after).length, 0);

    const procurementTrades = after.orders.filter((order) => (
      order.isOwn && order.assetKind === 'commodity' && order.status === 'filled'
    ));
    assert.equal(procurementTrades.reduce((sum, order) => sum + order.quantity, 0), 5);
    const procurementTotal = procurementTrades.reduce((sum, order) => sum + Number(order.fills?.[0]?.total || 0), 0);
    assert.equal(
      Number((before.credits - after.credits - ranch.buildCost).toFixed(6)),
      Number(procurementTotal.toFixed(6)),
      '建厂采购只支付服务器当日官方价对应的真实成交总额',
    );
  } finally {
    store.close();
  }
});

test('one-click construction rolls back completely when the confirmed procurement total is too low', () => {
  const now = 1_700_160_000_000;
  const store = prepareProcurementStore(now);
  try {
    const before = store.getState(user, now + 10);
    const result = store.apply(user, {
      action: 'buildFacility',
      payload: {
        facilityTypeId: 'ranch', quantity: 1, autoProcure: true,
        maxProcurementTotal: 0.01, materialPriceCaps: broadPriceCaps,
      },
      requestKey: 'instant-build-procure-0002', method: 'POST', path: '/api/game/facilities',
    }, now + 11);
    assert.equal(result.result.ok, false);
    assert.match(result.result.message, /预计采购总额超过确认上限/);
    const after = store.getState(user, now + 12);
    assert.equal(after.credits, before.credits);
    assert.equal(after.inventories.timber.available, 0);
    assert.equal(after.inventories.ore.available, 0);
    assert.equal(after.facilityGroups.find((group) => group.facilityTypeId === 'ranch'), undefined);
    assert.equal(after.frozenCredits, 0);
    assert.equal(openPlayerCommodityOrders(after).length, 0);
  } finally {
    store.close();
  }
});

test('one-click construction rejects stale daily-price protection without buying anything', () => {
  const now = 1_700_170_000_000;
  const store = prepareProcurementStore(now);
  try {
    const before = store.getState(user, now + 10);
    const result = store.apply(user, {
      action: 'buildFacility',
      payload: {
        facilityTypeId: 'ranch', quantity: 1, autoProcure: true,
        maxProcurementTotal: 10_000, materialPriceCaps: { timber: 0.01, ore: 999 },
      },
      requestKey: 'instant-build-procure-0003', method: 'POST', path: '/api/game/facilities',
    }, now + 11);
    assert.equal(result.result.ok, false);
    assert.match(result.result.message, /木材今日系统价已变化/);
    const after = store.getState(user, now + 12);
    assert.equal(after.credits, before.credits);
    assert.equal(after.facilityGroups.find((group) => group.facilityTypeId === 'ranch'), undefined);
    assert.equal(after.inventories.timber.available, 0);
    assert.equal(after.inventories.ore.available, 0);
    assert.equal(after.frozenCredits, 0);
  } finally {
    store.close();
  }
});

test('one-click construction ignores legacy warehouse capacity fields during immediate material delivery', () => {
  const now = 1_700_180_000_000;
  const store = prepareProcurementStore(now, { warehouseFill: 499 });
  try {
    const loaded = store.loadWorld(now + 3);
    const buyer = loaded.world.players[String(user.id)];
    buyer.inventoryCapacity = 1;
    buyer.warehouseLevel = 99;
    store.saveWorld(loaded.revision, loaded.world, now + 3);
    const result = store.apply(user, {
      action: 'buildFacility',
      payload: {
        facilityTypeId: 'ranch', quantity: 1, autoProcure: true,
        maxProcurementTotal: 10_000, materialPriceCaps: broadPriceCaps,
      },
      requestKey: 'instant-build-procure-0004', method: 'POST', path: '/api/game/facilities',
    }, now + 4);
    assert.equal(result.result.ok, true, result.result.message);
    const after = store.getState(user, now + 5);
    assert.equal(after.facilityGroups.find((group) => group.facilityTypeId === 'ranch')?.count, 1);
    assert.equal(after.inventories.wheat.available, 499);
    assert.equal(after.inventories.timber.available, 0);
    assert.equal(after.inventories.ore.available, 0);
    assert.equal(Object.hasOwn(after, 'inventoryCapacity'), false);
    assert.equal(Object.hasOwn(after, 'warehouseLevel'), false);
    assert.equal(after.frozenCredits, 0);
  } finally {
    store.close();
  }
});
