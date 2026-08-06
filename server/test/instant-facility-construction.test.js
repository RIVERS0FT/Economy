import assert from 'node:assert/strict';
import test from 'node:test';
import { EconomyStore } from '../src/storage.js';
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


test('new players receive one starter construction material pack', () => {
  const now = 1_699_900_000_000;
  const store = new EconomyStore(':memory:');
  try {
    const state = store.getState(user, now);
    assert.equal(state.inventories.timber.available, 4);
    assert.equal(state.inventories.ore.available, 2);
  } finally {
    store.close();
  }
});

test('construction atomically consumes credits and materials and completes immediately', () => {
  const now = 1_700_000_000_000;
  const store = prepareStore(now);
  try {
    const before = store.getState(user, now + 2);
    const farm = FACILITY_TYPE_CATALOG.find((item) => item.id === 'farm');
    const request = {
      action: 'buildFacility', payload: { facilityTypeId: 'farm', quantity: 2 }, requestKey: 'instant-build-0001',
      method: 'POST', path: '/api/game/facilities',
    };
    const first = store.apply(user, request, now + 3);
    const repeated = store.apply(user, request, now + 4);
    assert.deepEqual(repeated, first, '幂等重试必须返回原结果');
    assert.equal(first.result.ok, true);

    const state = store.getState(user, now + 5);
    assert.equal(state.facilityConstruction, undefined);
    assert.equal(state.facilityGroups.find((group) => group.facilityTypeId === 'farm')?.count, 2);
    assert.equal(state.credits, before.credits - farm.buildCost * 2);
    for (const item of farm.buildInputs) {
      assert.equal(state.inventories[item.productId].available, before.inventories[item.productId].available - item.quantity * 2);
    }
    assert.equal(state.stats.facilitiesConstructed, 2);
  } finally {
    store.close();
  }
});

test('construction rolls back completely when one material is missing', () => {
  const now = 1_700_100_000_000;
  const store = prepareStore(now);
  try {
    const loaded = store.loadWorld(now + 2);
    loaded.world.players[String(user.id)].inventories.timber.available = 0;
    store.saveWorld(loaded.revision, loaded.world, now + 2);
    const before = store.getState(user, now + 3);
    const result = store.apply(user, {
      action: 'buildFacility', payload: { facilityTypeId: 'farm', quantity: 1 }, requestKey: 'instant-build-0002',
      method: 'POST', path: '/api/game/facilities',
    }, now + 4);
    assert.equal(result.result.ok, false);
    assert.match(result.result.message, /建造材料不足/);
    const after = store.getState(user, now + 5);
    assert.equal(after.credits, before.credits);
    assert.deepEqual(after.inventories, before.inventories);
    assert.equal(after.facilityGroups.find((group) => group.facilityTypeId === 'farm'), undefined);
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
