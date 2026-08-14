import assert from 'node:assert/strict';
import test from 'node:test';
import { getStableAdminSummary } from '../src/admin-summary.js';
import { EconomyStore } from '../src/storage.js';

test('unchanged admin summary does not advance the world revision', () => {
  const store = new EconomyStore(':memory:');
  const admin = { id: 1, email: 'admin@example.com', role: 'admin' };
  const now = Date.UTC(2026, 6, 17, 12, 0, 0);
  try {
    const first = getStableAdminSummary(store, admin, now);
    const revisionBefore = store.worldCache.revision;
    const worldBefore = structuredClone(store.worldCache.world);

    store.transaction = () => { throw new Error('committed admin summary must not open a transaction'); };
    store.processWorldIfDue = () => { throw new Error('committed admin summary must not process the world'); };
    store.saveWorldIfChanged = () => { throw new Error('committed admin summary must not persist the world'); };

    const second = getStableAdminSummary(store, admin, now + 1_000);
    assert.equal(second.revision, first.revision);
    assert.equal(store.worldCache.revision, revisionBefore);
    assert.equal(second.playerCount, first.playerCount);
    assert.equal(second.openOrderCount, first.openOrderCount);
    assert.deepEqual(store.worldCache.world, worldBefore);
  } finally {
    store.close();
  }
});
