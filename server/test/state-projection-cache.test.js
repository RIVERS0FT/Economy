import assert from 'node:assert/strict';
import test from 'node:test';
import { EconomyStore } from '../src/runtime-store.js';
import { createPartitionedStateDelivery } from '../src/state-partitions.js';

const alice = { id: 1, email: 'alice@example.com', name: 'Alice', role: 'user' };
const bob = { id: 2, email: 'bob@example.com', name: 'Bob', role: 'user' };

test('runtime state projection cache reuses final state and partition snapshots for one revision', () => {
  const store = new EconomyStore(':memory:');
  try {
    const now = 1_700_000_000_000;
    const first = store.getStateSnapshot(alice, undefined, now);
    const originalTransaction = store.transaction;
    store.transaction = () => { throw new Error('cached projection must bypass transactions'); };

    const repeated = store.getStateSnapshot(alice, undefined, now + 1);
    assert.strictEqual(repeated.state, first.state);
    assert.strictEqual(repeated.partitions, first.partitions);
    assert.deepEqual(repeated.partitionRevisions, first.partitionRevisions);

    const unchanged = createPartitionedStateDelivery(
      repeated,
      first.partitionRevisions,
      now + 1,
    );
    assert.equal(unchanged.unchanged, true);
    assert.deepEqual(unchanged.patches, {});

    store.transaction = originalTransaction;
  } finally {
    store.close();
  }
});

test('catalog partition cache is shared across users while player partitions remain isolated', () => {
  const store = new EconomyStore(':memory:');
  try {
    const now = 1_700_000_000_000;
    const aliceSnapshot = store.getStateSnapshot(alice, undefined, now);
    const bobSnapshot = store.getStateSnapshot(bob, undefined, now + 2_000);

    assert.strictEqual(bobSnapshot.partitions.catalog, aliceSnapshot.partitions.catalog);
    assert.equal(bobSnapshot.partitionRevisions.catalog, aliceSnapshot.partitionRevisions.catalog);
    assert.notEqual(bobSnapshot.partitionRevisions.player, aliceSnapshot.partitionRevisions.player);
  } finally {
    store.close();
  }
});
