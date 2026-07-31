import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateStressBudget, percentile, StressMetrics } from './metrics.mjs';
import { runStressTest } from './run.mjs';
import { validateStressSafety } from './safety.mjs';

test('stress metrics calculate percentiles and enforce budgets', () => {
  assert.equal(percentile([10, 20, 30, 40], 0.95), 40);
  const metrics = new StressMetrics();
  metrics.record({ method: 'GET', route: '/api/game/state', statusCode: 200, durationMs: 10, responseBytes: 100, expected: true });
  metrics.record({ method: 'GET', route: '/api/game/state', statusCode: 200, durationMs: 20, responseBytes: 200, expected: true });
  const summary = metrics.summarize(1_000);
  assert.equal(summary.requests, 2);
  assert.equal(summary.requestsPerSecond, 2);
  assert.equal(summary.routes['GET /api/game/state'].p95Ms, 20);
  assert.deepEqual(evaluateStressBudget(summary, {
    maxTimeouts: 0,
    maxServerErrors: 0,
    maxUnexpectedStatuses: 0,
    maxP95Ms: 100,
    maxP99Ms: 100,
  }), { passed: true, failures: [] });
});

test('stress safety prevents production writes and unsafe targets', () => {
  const base = {
    users: 4,
    durationSeconds: 30,
    pollIntervalMs: 5_000,
    authUrl: 'https://game.riversoft.top/economy-api/login',
    gameBaseUrl: 'https://game.riversoft.top/economy-api/game',
    confirmation: 'ECONOMY_PRODUCTION_READ_ONLY',
  };
  assert.throws(() => validateStressSafety({ ...base, targetMode: 'production-readonly', profile: 'mixed' }), /禁止写入场景/);
  assert.throws(() => validateStressSafety({ ...base, targetMode: 'production-readonly', profile: 'poll', confirmation: '' }), /确认词/);
  assert.throws(() => validateStressSafety({
    ...base,
    targetMode: 'local',
    profile: 'smoke',
  }), /回环地址/);
});

test('isolated mixed stress exercises real authentication, state delivery, writes and idempotency', { timeout: 30_000 }, async () => {
  const report = await runStressTest({
    targetMode: 'local',
    profile: 'mixed',
    users: 4,
    durationSeconds: 4,
    pollIntervalMs: 200,
    enforcePerformanceBudget: false,
  });
  assert.equal(report.passed, true, report.failures.join('\n'));
  assert.equal(report.users, 4);
  assert.equal(report.invariants.fullStateResponses, 4);
  assert.equal(report.invariants.idempotencyChecks, 4);
  assert.ok(report.invariants.actionConfirmations >= 8);
  assert.ok(report.invariants.stateResponses > 4);
  assert.ok(report.metrics.requests > 20);
  assert.equal(report.metrics.serverErrorCount, 0);
  assert.equal(report.metrics.timeoutCount, 0);
  assert.ok(report.storage.after.databaseBytes > 0);
  const serialized = JSON.stringify(report);
  assert.equal(serialized.includes('@riversoft.top'), false);
  assert.equal(serialized.includes('session='), false);
  assert.equal(serialized.includes('local-stress-'), false);
});
