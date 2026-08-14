import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { EconomyStore } from '../src/runtime-store.js';
import {
  WORLD_STORAGE_SCHEMA_VERSION,
  cloneWorldForMutation,
  createRuntimeMutationScope,
} from '../src/world-storage-v2.js';

const alice = { id: 1, email: 'alice@example.com', name: 'Alice', role: 'user' };
const now = 1_700_000_000_000;

function action(actionName, payload, requestKey) {
  return {
    action: actionName,
    payload,
    requestKey,
    method: 'POST',
    path: actionName.startsWith('bank') ? '/api/game/bank' : '/api/game/action',
  };
}

test('segmented storage initializes one meta row, player rows, and top-level segment rows', () => {
  const store = new EconomyStore(':memory:', { scheduledProcessing: false });
  try {
    store.getState(alice, now);
    const meta = store.database.prepare('SELECT * FROM economy_world_meta WHERE id = 1').get();
    const player = store.database.prepare('SELECT * FROM economy_world_players WHERE user_id = 1').get();
    const segments = store.database.prepare('SELECT segment_key FROM economy_world_segments ORDER BY segment_key').all();

    assert.equal(Number(meta.storage_schema_version), WORLD_STORAGE_SCHEMA_VERSION);
    assert.ok(Number(meta.revision) >= 1);
    assert.ok(player?.state_json);
    assert.ok(segments.some((row) => row.segment_key === 'orders'));
    assert.ok(segments.some((row) => row.segment_key === 'markets'));
    assert.ok(segments.some((row) => row.segment_key === 'lastProcessedAt'));
  } finally {
    store.close();
  }
});

test('local bank mutation persists one player row without rewriting the orders segment', () => {
  const store = new EconomyStore(':memory:', { scheduledProcessing: true });
  try {
    store.getState(alice, now);
    const beforeMeta = store.database.prepare('SELECT revision FROM economy_world_meta WHERE id = 1').get();
    const beforeOrders = store.database.prepare(
      "SELECT updated_revision, state_json FROM economy_world_segments WHERE segment_key = 'orders'",
    ).get();

    const result = store.apply(alice, action('bankDeposit', { amount: 10 }, 'storage-v2-bank-12345678'), now + 1);
    assert.equal(result.result.ok, true);

    const afterMeta = store.database.prepare('SELECT revision FROM economy_world_meta WHERE id = 1').get();
    const afterOrders = store.database.prepare(
      "SELECT updated_revision, state_json FROM economy_world_segments WHERE segment_key = 'orders'",
    ).get();
    const player = store.database.prepare(
      'SELECT updated_revision, state_json FROM economy_world_players WHERE user_id = 1',
    ).get();
    const legacy = store.database.prepare(
      'SELECT revision, state_json FROM economy_world WHERE id = 1',
    ).get();

    assert.equal(Number(afterMeta.revision), Number(beforeMeta.revision) + 1);
    assert.equal(Number(player.updated_revision), Number(afterMeta.revision));
    assert.equal(Number(afterOrders.updated_revision), Number(beforeOrders.updated_revision));
    assert.equal(String(afterOrders.state_json), String(beforeOrders.state_json));
    assert.equal(Number(legacy.revision), Number(afterMeta.revision));
    assert.deepEqual(JSON.parse(String(legacy.state_json)), {
      version: 29,
      storageSchemaVersion: WORLD_STORAGE_SCHEMA_VERSION,
      segmented: true,
    });
  } finally {
    store.close();
  }
});

test('local mutation draft clones only the current player and declared segments', () => {
  const store = new EconomyStore(':memory:', { scheduledProcessing: true });
  try {
    store.getState(alice, now);
    const committed = store.worldCache.world;
    const scope = createRuntimeMutationScope(committed, alice.id, 'bankDeposit', { amount: 10 }, {
      scheduledProcessing: true,
    });
    const draft = cloneWorldForMutation(committed, scope);

    assert.notEqual(draft.players, committed.players);
    assert.notEqual(draft.players['1'], committed.players['1']);
    assert.equal(draft.orders, committed.orders);
    assert.equal(draft.markets, committed.markets);
    assert.notEqual(draft.bank, committed.bank);
  } finally {
    store.close();
  }
});

test('segmented rows reconstruct the authoritative world after process restart', () => {
  const directory = mkdtempSync(join(tmpdir(), 'economy-storage-v2-'));
  const databasePath = join(directory, 'economy.sqlite');
  try {
    const first = new EconomyStore(databasePath, { scheduledProcessing: false });
    first.getState(alice, now);
    const result = first.apply(alice, action('bankDeposit', { amount: 25 }, 'storage-v2-restart-12345678'), now + 1);
    const revision = result.revision;
    const credits = first.worldCache.world.players['1'].credits;
    const depositCredits = first.worldCache.world.players['1'].bankAccount.depositCredits;
    first.close();

    const second = new EconomyStore(databasePath, { scheduledProcessing: false });
    try {
      const state = second.getState(alice, now + 2);
      assert.equal(second.worldCache.revision, revision);
      assert.equal(state.credits, credits);
      assert.equal(state.bank.depositCredits, depositCredits);
      assert.equal(Number(second.database.prepare(
        'SELECT storage_schema_version FROM economy_world_meta WHERE id = 1',
      ).get().storage_schema_version), WORLD_STORAGE_SCHEMA_VERSION);
    } finally {
      second.close();
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
