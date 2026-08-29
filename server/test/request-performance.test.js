import assert from 'node:assert/strict';
import test from 'node:test';
import {
  addRequestPhase,
  createRequestPerformanceContext,
  measureRequestPhase,
  requestProcessingMs,
  runWithRequestPerformance,
  setRequestGauge,
  snapshotRequestPerformance,
} from '../src/request-performance.js';

test('request performance aggregates nested phases and gauges inside one request context', async () => {
  const context = createRequestPerformanceContext();
  await runWithRequestPerformance(context, async () => {
    addRequestPhase('worldCloneMs', 4);
    addRequestPhase('worldCloneMs', 6);
    setRequestGauge('worldJsonBytes', 8_192);
    await measureRequestPhase('asyncPhaseMs', async () => Promise.resolve());
  });
  const snapshot = snapshotRequestPerformance(context);
  assert.equal(snapshot.phases.worldCloneMs, 10);
  assert.ok(snapshot.phases.asyncPhaseMs >= 0);
  assert.equal(snapshot.gauges.worldJsonBytes, 8_192);
  assert.equal(requestProcessingMs(context), 10 + snapshot.phases.asyncPhaseMs);
});

test('request performance does nothing outside a request context', () => {
  addRequestPhase('ignored', 10);
  setRequestGauge('ignored', 10);
  assert.deepEqual(snapshotRequestPerformance(), { phases: {}, gauges: {} });
});
