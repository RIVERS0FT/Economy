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
    const second = getStableAdminSummary(store, admin, now);
    assert.equal(second.revision, first.revision);
    assert.equal(second.playerCount, first.playerCount);
    assert.equal(second.openOrderCount, first.openOrderCount);
  } finally {
    store.close();
  }
});
