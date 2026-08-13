import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

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
  assert.match(runtime, /ensureScheduledProcessingBarrier/);
  assert.match(runtime, /schedulerBarrierPromise/);
  assert.match(runtime, /schedulerBarrierWaitMs/);
  assert.match(runtime, /captureRequestContext:\s*false/);
  assert.match(core, /filterStateForCurrentSave/);

  assert.match(executor, /captureRequestContext = true/);
  assert.match(executor, /captureRequestContext \? requestPerformanceContext\(\) : null/);

  assert.doesNotMatch(action, /createEconomicActionBoundary/);
  assert.match(action, /structuredClone\(world\.players\?\.\[String\(user\.id\)\]/);
  assert.match(action, /applySettledCommodityOrder/);
  assert.match(action, /if \(!store\.scheduledProcessing\)/);
  assert.match(action, /createActionAcknowledgement\(gameResult, revision\)/);
});