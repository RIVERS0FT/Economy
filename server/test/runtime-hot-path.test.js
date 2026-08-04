import assert from 'node:assert/strict';
import test from 'node:test';
import { EconomyStore } from '../src/storage.js';

const alice = { id: 9301, email: 'hot-path@example.com', name: 'Hot Path', role: 'user' };

class CountingEconomyStore extends EconomyStore {
  migrateLoadedWorld(world, now) {
    this.migrationCalls = Number(this.migrationCalls || 0) + 1;
    return super.migrateLoadedWorld(world, now);
  }

  finalizeWorldForStorage(world, now) {
    this.finalizeCalls = Number(this.finalizeCalls || 0) + 1;
    return super.finalizeWorldForStorage(world, now);
  }

  processWorldIfDue(world, now, currentUserId, options) {
    this.worldProcessCalls = Number(this.worldProcessCalls || 0) + 1;
    return super.processWorldIfDue(world, now, currentUserId, options);
  }
}

test('hot actions do not rerun cold world migrations and process global deadlines once', () => {
  const store = new CountingEconomyStore(':memory:');
  try {
    const now = 1_700_000_000_000;
    store.getStateSnapshot(alice, undefined, now);
    store.migrationCalls = 0;
    store.finalizeCalls = 0;
    store.worldProcessCalls = 0;

    const action = store.apply(alice, {
      action: 'work',
      payload: {},
      requestKey: 'hot-path-work-1',
      method: 'POST',
      path: '/api/game/work',
    }, now + 3_001);

    assert.equal(action.result.ok, true);
    assert.equal(store.migrationCalls, 0);
    assert.equal(store.worldProcessCalls, 1);
    assert.equal(store.finalizeCalls, 1);
  } finally {
    store.close();
  }
});

test('idempotency expiry cleanup is throttled instead of running on every action', () => {
  const store = new EconomyStore(':memory:');
  try {
    const now = 1_700_000_000_000;
    store.getStateSnapshot(alice, undefined, now);
    store.apply(alice, {
      action: 'work', payload: {}, requestKey: 'cleanup-initial-1', method: 'POST', path: '/api/game/work',
    }, now + 3_001);

    store.insertIdempotency.run(
      Number(alice.id),
      'expired-cleanup-probe',
      'POST',
      '/api/game/work',
      JSON.stringify({ result: { ok: true, message: '' }, revision: 1 }),
      0,
    );

    store.apply(alice, {
      action: 'work', payload: {}, requestKey: 'cleanup-within-window-1', method: 'POST', path: '/api/game/work',
    }, now + 4_001);
    assert.ok(store.selectIdempotency.get(Number(alice.id), 'expired-cleanup-probe'));

    store.apply(alice, {
      action: 'work', payload: {}, requestKey: 'cleanup-after-window-1', method: 'POST', path: '/api/game/work',
    }, now + 5 * 60 * 1_000 + 3_002);
    assert.equal(store.selectIdempotency.get(Number(alice.id), 'expired-cleanup-probe'), undefined);
  } finally {
    store.close();
  }
});
