import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { EconomyStore } from '../src/runtime-store.js';

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
const alice = { id: 1, email: 'alice@example.com', name: 'Alice', role: 'user' };

test('runtime hot path keeps one committed-world draft and scheduler barrier', () => {
  const runtime = read('server/src/runtime-store.js');
  const core = read('server/src/runtime-store-core.js');
  const executor = read('server/src/authoritative-write-executor.js');
  const action = read('server/src/runtime-action-executor.js');

  const cacheStart = runtime.indexOf('  cacheWorld(');
  const loadStart = runtime.indexOf('  loadWorld(', cacheStart);
  assert.ok(cacheStart >= 0 && loadStart > cacheStart);
  const cacheBody = runtime.slice(cacheStart, loadStart);

  assert.match(runtime, /EconomyStore as CoreEconomyStore/);
  assert.match(runtime, /worldDraftCloneMs/);
  assert.match(runtime, /world:\s*measureRequestPhase\('worldDraftCloneMs'/);
  assert.doesNotMatch(cacheBody, /structuredClone/);
  assert.match(runtime, /committedWorldForCache/);
  assert.match(runtime, /stateProjectionCacheIsolationDepth/);
  assert.match(runtime, /worldCacheIsolationCloneMs/);
  assert.match(runtime, /ensureScheduledProcessingBarrier/);
  assert.match(runtime, /schedulerBarrierPromise/);
  assert.match(runtime, /schedulerBarrierWaitMs/);
  assert.match(runtime, /settledSynchronously/);
  assert.match(runtime, /captureRequestContext:\s*false/);
  assert.match(runtime, /return executeRuntimeAction\(this, user, requestMeta, now\)/);
  assert.match(core, /filterStateForCurrentSave/);

  assert.match(executor, /captureRequestContext = true/);
  assert.match(executor, /captureRequestContext \? requestPerformanceContext\(\) : null/);

  assert.doesNotMatch(action, /createEconomicActionBoundary/);
  assert.match(action, /structuredClone\(world\.players\?\.\[String\(user\.id\)\]/);
  assert.match(action, /CONTRACT_ACTIONS/);
  assert.match(action, /applyProductionContractAction/);
  assert.match(action, /processProductionContracts/);
  assert.match(action, /applySettledCommodityOrder/);
  assert.match(action, /if \(!store\.scheduledProcessing\)/);
  assert.match(action, /createActionAcknowledgement\(gameResult, revision\)/);
});

test('state projection cannot mutate the committed cache after persistence', () => {
  const store = new EconomyStore(':memory:');
  try {
    const snapshot = store.getStateSnapshot(alice, undefined, 1_700_000_000_000);
    const persisted = store.database.prepare(
      'SELECT revision, state_json FROM economy_world WHERE id = 1',
    ).get();

    assert.equal(snapshot.revision, persisted.revision);
    assert.equal(store.worldCache.revision, persisted.revision);
    assert.equal(store.worldCache.stateJson, persisted.state_json);
    assert.equal(JSON.stringify(store.worldCache.world), persisted.state_json);
  } finally {
    store.close();
  }
});
