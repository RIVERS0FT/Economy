import assert from 'node:assert/strict';
import test from 'node:test';
import {
  loadPageTabPreference,
  pageTabPreferenceKey,
  savePageTabPreference,
} from '../../src/hooks/usePageTabPreference.ts';

class MemoryStorage {
  readonly values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

const contractOptions = (storage: MemoryStorage, userId = 7) => ({
  userId,
  pageId: 'contracts',
  allowed: ['workbench', 'market', 'active', 'history'] as const,
  fallback: 'workbench' as const,
  storage,
});

test('page tab preference persists valid values and isolates users and pages', () => {
  const storage = new MemoryStorage();

  assert.equal(loadPageTabPreference(contractOptions(storage)), 'workbench');
  assert.equal(savePageTabPreference(contractOptions(storage), 'active'), 'active');
  assert.equal(loadPageTabPreference(contractOptions(storage)), 'active');
  assert.equal(loadPageTabPreference(contractOptions(storage, 8)), 'workbench');

  const leaderboardOptions = {
    userId: 7,
    pageId: 'leaderboard',
    allowed: ['wealth', 'growth', 'production', 'trading'] as const,
    fallback: 'wealth' as const,
    storage,
  };
  assert.equal(loadPageTabPreference(leaderboardOptions), 'wealth');
  assert.equal(savePageTabPreference(leaderboardOptions, 'trading'), 'trading');
  assert.equal(loadPageTabPreference(leaderboardOptions), 'trading');
  assert.equal(loadPageTabPreference(contractOptions(storage)), 'active');
});

test('page tab preference rejects stale values and tolerates storage failures', () => {
  const storage = new MemoryStorage();
  storage.setItem(pageTabPreferenceKey(7, 'contracts'), 'removed-tab');
  assert.equal(loadPageTabPreference(contractOptions(storage)), 'workbench');

  const failingStorage = {
    getItem() { throw new Error('read failed'); },
    setItem() { throw new Error('write failed'); },
  };
  const options = {
    userId: 7,
    pageId: 'contracts',
    allowed: ['workbench', 'market'] as const,
    fallback: 'workbench' as const,
    storage: failingStorage,
  };
  assert.equal(loadPageTabPreference(options), 'workbench');
  assert.equal(savePageTabPreference(options, 'market'), 'market');
});