import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_QQ_GROUP_URL, normalizeQqGroupUrl } from '../src/community-link.js';
import { EconomyStore } from '../src/storage.js';

const admin = { id: 99, email: 'admin@example.com', role: 'admin' };
const player = { id: 1, email: 'player@example.com', role: 'user' };
const requestMeta = (requestKey = 'community-link-0001') => ({
  requestKey,
  method: 'PUT',
  path: '/api/game/admin/community-link',
});

test('community link has a stable default and persists an idempotent admin update', () => {
  const store = new EconomyStore(':memory:');
  try {
    assert.deepEqual(store.getCommunityLink(), { qqGroupUrl: DEFAULT_QQ_GROUP_URL, updatedAt: null });

    const updated = store.updateCommunityLink(
      admin,
      { qqGroupUrl: '  https://example.com/community?q=qq  ' },
      requestMeta(),
      1_700_000_000_000,
    );
    assert.deepEqual(updated, {
      qqGroupUrl: 'https://example.com/community?q=qq',
      updatedAt: 1_700_000_000_000,
    });
    assert.deepEqual(store.updateCommunityLink(
      admin,
      { qqGroupUrl: 'https://ignored.example.com' },
      requestMeta(),
      1_700_000_000_001,
    ), updated);
    assert.deepEqual(store.getCommunityLink(), updated);
  } finally {
    store.close();
  }
});

test('community link rejects unsafe URLs and non-admin updates', () => {
  const store = new EconomyStore(':memory:');
  try {
    assert.throws(() => normalizeQqGroupUrl('javascript:alert(1)'), { statusCode: 400 });
    assert.throws(() => normalizeQqGroupUrl('http://qm.qq.com/q/example'), { statusCode: 400 });
    assert.throws(() => normalizeQqGroupUrl('https://user:secret@example.com'), { statusCode: 400 });
    assert.throws(() => store.updateCommunityLink(
      player,
      { qqGroupUrl: 'https://example.com/community' },
      requestMeta('community-link-player'),
    ), { statusCode: 403 });
  } finally {
    store.close();
  }
});
