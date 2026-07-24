import assert from 'node:assert/strict';
import test from 'node:test';
import { EconomyStore } from '../src/storage.js';
import { EconomyStore as RuntimeEconomyStore } from '../src/runtime-store.js';

const alice = { id: 1, email: 'alice@example.com', name: 'Alice', role: 'user' };

function persistedWorld(store) {
  return store.database.prepare(
    'SELECT revision, state_json, updated_at FROM economy_world WHERE id = 1',
  ).get();
}

test('idle version polling returns a compact response without writing the world', () => {
  const store = new EconomyStore(':memory:');
  try {
    const now = 1_700_000_000_000;
    const initial = store.getStateSnapshot(alice, undefined, now);
    const before = persistedWorld(store);

    assert.equal(initial.unchanged, false);
    assert.equal(initial.state.credits, 100);
    assert.equal(initial.revision, before.revision);

    const polled = store.getStateSnapshot(alice, initial.revision, now + 1_000);
    const after = persistedWorld(store);

    assert.deepEqual(polled, { revision: initial.revision, unchanged: true });
    assert.deepEqual(after, before);
  } finally {
    store.close();
  }
});

test('same-revision polls inside the processing window bypass SQLite transactions', () => {
  const store = new EconomyStore(':memory:');
  try {
    const now = 1_700_000_000_000;
    const initial = store.getStateSnapshot(alice, undefined, now);
    const originalTransaction = store.transaction;
    store.transaction = () => { throw new Error('compact polling must not enter a transaction'); };

    assert.deepEqual(
      store.getStateSnapshot(alice, initial.revision, now + 500),
      { revision: initial.revision, unchanged: true },
    );

    store.transaction = originalTransaction;
  } finally {
    store.close();
  }
});

test('an authoritative action advances the revision and invalidates an older poll', () => {
  const store = new EconomyStore(':memory:');
  try {
    const now = 1_700_000_000_000;
    const initial = store.getStateSnapshot(alice, undefined, now);
    const action = store.apply(alice, {
      action: 'work',
      payload: {},
      requestKey: 'state-poll-work-1',
      method: 'POST',
      path: '/api/game/work',
    }, now + 2_000);

    assert.equal(action.revision > initial.revision, true);
    assert.deepEqual(Object.keys(action).sort(), ['result', 'revision']);

    const changed = store.getStateSnapshot(alice, initial.revision, now + 2_001);
    assert.equal(changed.unchanged, false);
    assert.equal(changed.revision, action.revision);
    assert.equal(changed.state.credits, 101);

    const unchanged = store.getStateSnapshot(alice, action.revision, now + 3_000);
    assert.deepEqual(unchanged, { revision: action.revision, unchanged: true });
  } finally {
    store.close();
  }
});

test('due world processing advances the revision during version polling', () => {
  const store = new EconomyStore(':memory:');
  try {
    const now = 1_700_000_000_000;
    const initial = store.getStateSnapshot(alice, undefined, now);
    const processed = store.getStateSnapshot(alice, initial.revision, now + 6 * 60 * 1_000);

    assert.equal(processed.unchanged, false);
    assert.equal(processed.revision > initial.revision, true);
    assert.ok(processed.state);
  } finally {
    store.close();
  }
});

test('scheduled production polling always uses the revision fast path until the global scheduler changes it', () => {
  const store = new EconomyStore(':memory:', { scheduledProcessing: true });
  try {
    const now = 1_700_000_000_000;
    const initial = store.getStateSnapshot(alice, undefined, now);
    const originalTransaction = store.transaction;
    store.transaction = () => { throw new Error('scheduled compact polling must not enter a transaction'); };

    assert.deepEqual(
      store.getStateSnapshot(alice, initial.revision, now + 6 * 60 * 1_000),
      { revision: initial.revision, unchanged: true },
    );

    store.transaction = originalTransaction;
    const scheduledRevision = store.processScheduledWorld(now + 6 * 60 * 1_000);
    assert.equal(scheduledRevision > initial.revision, true);

    const changed = store.getStateSnapshot(alice, initial.revision, now + 6 * 60 * 1_000 + 1);
    assert.equal(changed.unchanged, false);
    assert.equal(changed.revision, scheduledRevision);
  } finally {
    store.close();
  }
});

test('rolled back transactions restore the in-memory world cache', () => {
  const store = new EconomyStore(':memory:');
  try {
    const now = 1_700_000_000_000;
    const initial = store.getStateSnapshot(alice, undefined, now);
    const before = persistedWorld(store);

    assert.throws(() => store.transaction(() => {
      const { revision, world } = store.loadWorld(now + 1_000);
      world.rollbackProbe = true;
      store.saveWorld(revision, world, now + 1_000);
      throw new Error('rollback probe');
    }), /rollback probe/);

    assert.deepEqual(persistedWorld(store), before);
    assert.equal(store.worldCache.revision, initial.revision);
    assert.equal(store.worldCache.world.rollbackProbe, undefined);
  } finally {
    store.close();
  }
});

test('runtime failed actions keep the world row unchanged and reuse the current revision', () => {
  const store = new RuntimeEconomyStore(':memory:');
  try {
    const now = 1_700_000_000_000;
    const initial = store.getStateSnapshot(alice, undefined, now);
    const before = persistedWorld(store);

    const ordinaryFailure = store.apply(alice, {
      action: 'placeOrder',
      payload: { assetKind: 'commodity', productId: 'wheat', side: 'buy', quantity: 0, price: 1 },
      requestKey: 'runtime-failed-order-1',
      method: 'POST',
      path: '/api/game/orders',
    }, now + 100);
    const contractFailure = store.apply(alice, {
      action: 'acceptProductionContract',
      payload: { contractId: 'missing-contract' },
      requestKey: 'runtime-failed-contract-1',
      method: 'POST',
      path: '/api/game/contracts/missing-contract/accept',
    }, now + 200);

    assert.equal(ordinaryFailure.result.ok, false);
    assert.equal(contractFailure.result.ok, false);
    assert.equal(ordinaryFailure.revision, initial.revision);
    assert.equal(contractFailure.revision, initial.revision);
    assert.deepEqual(persistedWorld(store), before);
  } finally {
    store.close();
  }
});

test('runtime state delivery reuses the current revision cache for the contract projection', () => {
  const store = new RuntimeEconomyStore(':memory:');
  try {
    let transactionCount = 0;
    const originalTransaction = store.transaction.bind(store);
    store.transaction = (callback, options) => {
      transactionCount += 1;
      return originalTransaction(callback, options);
    };

    const snapshot = store.getStateSnapshot(alice, undefined, 1_700_000_000_000);
    assert.equal(transactionCount, 1);
    assert.equal(snapshot.unchanged, false);
    assert.ok(Array.isArray(snapshot.state.productionContracts));
    assert.ok(snapshot.state.productionContractSummary);
  } finally {
    store.close();
  }
});
