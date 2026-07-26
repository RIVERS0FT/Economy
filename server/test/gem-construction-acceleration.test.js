import assert from 'node:assert/strict';
import test from 'node:test';
import { EconomyStore } from '../src/storage.js';

const user = { id: 91, email: 'builder@example.com', name: '施工玩家', role: 'user' };

test('one gem removes thirty minutes and immediately completes shorter construction', () => {
  const store = new EconomyStore(':memory:');
  const now = 1_700_000_000_000;
  try {
    store.getState(user, now);
    const loaded = store.loadWorld(now + 1);
    loaded.world.players[String(user.id)].gems = 2;
    store.saveWorld(loaded.revision, loaded.world, now + 1);

    const build = store.apply(user, {
      action: 'buildFacility', payload: { facilityTypeId: 'farm' }, requestKey: 'gem-build-0001',
      method: 'POST', path: '/api/game/facilities',
    }, now + 2);
    assert.equal(build.result.ok, true);

    const acceleration = {
      action: 'accelerateFacilityConstruction', payload: {}, requestKey: 'gem-accelerate-0001',
      method: 'POST', path: '/api/game/facilities/construction/accelerate',
    };
    const first = store.apply(user, acceleration, now + 3);
    const repeated = store.apply(user, acceleration, now + 4);
    assert.deepEqual(repeated, first);
    assert.equal(first.result.ok, true);

    const state = store.getState(user, now + 5);
    assert.equal(state.gems, 1);
    assert.equal(state.facilityConstruction, undefined);
    assert.equal(state.facilityGroups.find((group) => group.facilityTypeId === 'farm')?.count, 1);
    assert.equal(state.stats.producedGoods, 0, '施工加速不得兑换或生成工厂产量');
    assert.equal(state.inventories.wheat.available, 0, '施工加速不得直接生成商品');
    const actions = store.database.prepare('SELECT * FROM economy_facility_gem_actions').all();
    assert.equal(actions.length, 1);
    assert.equal(Number(actions[0].completed_immediately), 1);
  } finally {
    store.close();
  }
});

test('construction acceleration rejects missing gems without changing deadline', () => {
  const store = new EconomyStore(':memory:');
  const now = 1_700_100_000_000;
  try {
    store.getState(user, now);
    const build = store.apply(user, {
      action: 'buildFacility', payload: { facilityTypeId: 'orchard' }, requestKey: 'gem-build-0002',
      method: 'POST', path: '/api/game/facilities',
    }, now + 1);
    assert.equal(build.result.ok, true);
    const before = store.getState(user, now + 2).facilityConstruction?.completesAt;
    const result = store.apply(user, {
      action: 'accelerateFacilityConstruction', payload: {}, requestKey: 'gem-accelerate-0002',
      method: 'POST', path: '/api/game/facilities/construction/accelerate',
    }, now + 3);
    assert.equal(result.result.ok, false);
    assert.match(result.result.message, /宝石余额不足/);
    assert.equal(store.getState(user, now + 4).facilityConstruction?.completesAt, before);
  } finally {
    store.close();
  }
});
