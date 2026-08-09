import assert from 'node:assert/strict';
import test from 'node:test';
import { EconomyStore } from '../src/storage.js';
import { FACILITY_TYPE_CATALOG } from '../src/domain.js';

const user = { id: 91, email: 'builder@example.com', name: '建设玩家', role: 'user' };
const seller = { id: 92, email: 'supplier@example.com', name: '材料供应商', role: 'user' };

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
  store.getState(seller, now + 1);
  const loaded = store.loadWorld(now + 2);
  const buyer = loaded.world.players[String(user.id)];
  const supplier = loaded.world.players[String(seller.id)];
  buyer.credits = 100_000;
  supplier.credits = 1_000;
  for (const inventory of Object.values(buyer.inventories)) {
    inventory.available = 0;
    inventory.frozen = 0;
  }
  for (const inventory of Object.values(supplier.inventories)) {
    inventory.available = 0;
    inventory.frozen = 0;
  }
  buyer.inventoryCapacity = 500;
  if (warehouseFill > 0) buyer.inventories.wheat.available = warehouseFill;
  store.saveWorld(loaded.revision, loaded.world, now + 2);
  return store;
}

function placeMaterialSell(store, productId, quantity, price, requestKey, now) {
  const loaded = store.loadWorld(now);
  loaded.world.players[String(seller.id)].inventories[productId].available = quantity;
  store.saveWorld(loaded.revision, loaded.world, now);
  return store.apply(seller, {
    action: 'placeOrder',
    payload: { assetKind: 'commodity', assetId: productId, productId, side: 'sell', quantity, price },
    requestKey,
    method: 'POST',
    path: '/api/game/orders',
  }, now + 1);
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

test('material-backed construction rolls back completely when one material is missing', () => {
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

test('one-click construction buys every missing material from the real order book and stays idempotent', () => {
  const now = 1_700_150_000_000;
  const store = prepareProcurementStore(now);
  try {
    assert.equal(placeMaterialSell(store, 'timber', 3, 6, 'material-sell-0001', now + 10).result.ok, true);
    assert.equal(placeMaterialSell(store, 'ore', 2, 7, 'material-sell-0002', now + 20).result.ok, true);
    const before = store.getState(user, now + 30);
    const ranch = FACILITY_TYPE_CATALOG.find((item) => item.id === 'ranch');
    const request = {
      action: 'buildFacility',
      payload: {
        facilityTypeId: 'ranch',
        quantity: 1,
        autoProcure: true,
        maxProcurementTotal: 32,
        materialPriceCaps: { timber: 6, ore: 7 },
      },
      requestKey: 'instant-build-procure-0001',
      method: 'POST',
      path: '/api/game/facilities',
    };
    const first = store.apply(user, request, now + 31);
    const repeated = store.apply(user, request, now + 32);
    assert.deepEqual(repeated, first, '一键采购建造的幂等重试不得重复采购或建厂');
    assert.equal(first.result.ok, true);
    assert.match(first.result.message, /一键购齐 5 件建造材料/);

    const after = store.getState(user, now + 33);
    assert.equal(after.facilityGroups.find((group) => group.facilityTypeId === 'ranch')?.count, 1);
    assert.equal(after.credits, before.credits - ranch.buildCost - 32);
    assert.equal(after.inventories.timber.available, 0);
    assert.equal(after.inventories.ore.available, 0);
    const procurementOrders = after.orders.filter((order) => (
      order.isOwn && order.assetKind === 'commodity' && order.status === 'filled'
    ));
    assert.equal(procurementOrders.reduce((sum, order) => sum + order.quantity, 0), 5);
    assert.equal(after.markets.timber.lastTradePrice, 6);
    assert.equal(after.markets.ore.lastTradePrice, 7);
  } finally {
    store.close();
  }
});

test('one-click construction rolls back completely when market depth cannot fill every missing material', () => {
  const now = 1_700_160_000_000;
  const store = prepareProcurementStore(now);
  try {
    assert.equal(placeMaterialSell(store, 'timber', 2, 6, 'material-sell-0011', now + 10).result.ok, true);
    assert.equal(placeMaterialSell(store, 'ore', 2, 7, 'material-sell-0012', now + 20).result.ok, true);
    const beforeBuyer = store.getState(user, now + 30);
    const beforeSeller = store.getState(seller, now + 30);
    const result = store.apply(user, {
      action: 'buildFacility',
      payload: {
        facilityTypeId: 'ranch', quantity: 1, autoProcure: true,
        maxProcurementTotal: 100, materialPriceCaps: { timber: 10, ore: 10 },
      },
      requestKey: 'instant-build-procure-0002', method: 'POST', path: '/api/game/facilities',
    }, now + 31);
    assert.equal(result.result.ok, false);
    assert.match(result.result.message, /木材市场卖盘不足/);
    const afterBuyer = store.getState(user, now + 32);
    const afterSeller = store.getState(seller, now + 32);
    assert.equal(afterBuyer.credits, beforeBuyer.credits);
    assert.equal(afterBuyer.inventories.timber.available, 0);
    assert.equal(afterBuyer.inventories.ore.available, 0);
    assert.equal(afterBuyer.facilityGroups.find((group) => group.facilityTypeId === 'ranch'), undefined);
    assert.equal(afterSeller.inventories.timber.frozen, beforeSeller.inventories.timber.frozen);
    assert.equal(afterSeller.inventories.ore.frozen, beforeSeller.inventories.ore.frozen);
  } finally {
    store.close();
  }
});

test('one-click construction rejects stale price protection without buying anything', () => {
  const now = 1_700_170_000_000;
  const store = prepareProcurementStore(now);
  try {
    assert.equal(placeMaterialSell(store, 'timber', 3, 6, 'material-sell-0021', now + 10).result.ok, true);
    assert.equal(placeMaterialSell(store, 'ore', 2, 7, 'material-sell-0022', now + 20).result.ok, true);
    const before = store.getState(user, now + 30);
    const result = store.apply(user, {
      action: 'buildFacility',
      payload: {
        facilityTypeId: 'ranch', quantity: 1, autoProcure: true,
        maxProcurementTotal: 32, materialPriceCaps: { timber: 5.99, ore: 7 },
      },
      requestKey: 'instant-build-procure-0003', method: 'POST', path: '/api/game/facilities',
    }, now + 31);
    assert.equal(result.result.ok, false);
    assert.match(result.result.message, /木材市场价格已变化/);
    const after = store.getState(user, now + 32);
    assert.equal(after.credits, before.credits);
    assert.equal(after.facilityGroups.find((group) => group.facilityTypeId === 'ranch'), undefined);
    assert.equal(after.inventories.timber.available, 0);
    assert.equal(after.inventories.ore.available, 0);
  } finally {
    store.close();
  }
});

test('one-click construction still requires warehouse space for market delivery', () => {
  const now = 1_700_180_000_000;
  const store = prepareProcurementStore(now, { warehouseFill: 499 });
  try {
    assert.equal(placeMaterialSell(store, 'timber', 3, 6, 'material-sell-0031', now + 10).result.ok, true);
    assert.equal(placeMaterialSell(store, 'ore', 2, 7, 'material-sell-0032', now + 20).result.ok, true);
    const result = store.apply(user, {
      action: 'buildFacility',
      payload: {
        facilityTypeId: 'ranch', quantity: 1, autoProcure: true,
        maxProcurementTotal: 32, materialPriceCaps: { timber: 6, ore: 7 },
      },
      requestKey: 'instant-build-procure-0004', method: 'POST', path: '/api/game/facilities',
    }, now + 31);
    assert.equal(result.result.ok, false);
    assert.match(result.result.message, /共享仓库空间不足/);
    const after = store.getState(user, now + 32);
    assert.equal(after.facilityGroups.find((group) => group.facilityTypeId === 'ranch'), undefined);
    assert.equal(after.inventories.wheat.available, 499);
    assert.equal(after.inventories.timber.available, 0);
    assert.equal(after.inventories.ore.available, 0);
  } finally {
    store.close();
  }
});

test('legacy construction migrates to one completed facility without charging materials again', () => {
  const now = 1_700_200_000_000;
  const store = prepareStore(now);
  try {
    const loaded = store.loadWorld(now + 2);
    const player = loaded.world.players[String(user.id)];
    player.facilityConstruction = {
      facilityTypeId: 'farm', startedAt: now, completesAt: now + 60_000,
      buildCost: 50, employmentReleased: 20,
    };
    const timberBefore = player.inventories.timber.available;
    store.saveWorld(loaded.revision, loaded.world, now + 2);
    const state = store.getState(user, now + 3);
    assert.equal(state.facilityConstruction, undefined);
    assert.equal(state.facilityGroups.find((group) => group.facilityTypeId === 'farm')?.count, 1);
    assert.equal(state.inventories.timber.available, timberBefore, '旧任务迁移不得再次收取材料');
  } finally {
    store.close();
  }
});
