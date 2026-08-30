import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateStressBudget, percentile, StressMetrics } from './metrics.mjs';
import { runStressTest } from './run.mjs';
import { validateStressSafety } from './safety.mjs';

test('stress metrics calculate percentiles and enforce budgets', () => {
  assert.equal(percentile([10, 20, 30, 40], 0.95), 40);
  const metrics = new StressMetrics();
  metrics.record({ method: 'POST', route: '/api/login', statusCode: 200, responseBytes: 100, expected: true });
  metrics.record({ method: 'GET', route: '/api/game/state', statusCode: 200, serverDurationMs: 10, responseBytes: 100, expected: true });
  metrics.record({ method: 'GET', route: '/api/game/state', statusCode: 200, serverDurationMs: 20, responseBytes: 200, expected: true });
  const summary = metrics.summarize(1_000);
  assert.equal(summary.requests, 3);
  assert.equal(summary.timedRequests, 2);
  assert.equal(summary.untimedRequests, 1);
  assert.equal(summary.requestsPerSecond, 3);
  assert.equal(summary.routes['GET /api/game/state'].p95Ms, 20);
  assert.deepEqual(evaluateStressBudget(summary, {
    maxTimeouts: 0,
    maxServerErrors: 0,
    maxUnexpectedStatuses: 0,
    maxP95Ms: 100,
    maxP99Ms: 100,
  }), { passed: true, failures: [] });
});

test('budgeted routes must provide server-local timing instead of client end-to-end timing', () => {
  const metrics = new StressMetrics();
  metrics.record({ method: 'GET', route: '/api/game/state', statusCode: 200, responseBytes: 100, expected: true });
  const summary = metrics.summarize(1_000);
  const result = evaluateStressBudget(summary, {
    maxTimeouts: 0,
    maxServerErrors: 0,
    maxUnexpectedStatuses: 0,
    maxP95Ms: 100,
    maxP99Ms: 100,
    routes: {
      'GET /api/game/state': { maxP95Ms: 100, maxP99Ms: 100 },
    },
  });
  assert.equal(result.passed, false);
  assert.ok(result.failures.includes('缺少任何服务端本地耗时，不能执行性能预算'));
  assert.ok(result.failures.includes('GET /api/game/state 有 1 个响应缺少服务端本地耗时'));
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
  assert.throws(() => validateStressSafety({
    ...base,
    targetMode: 'staging',
    profile: 'transaction-mix',
    authUrl: 'https://staging.example.com/api/login',
    gameBaseUrl: 'https://staging.example.com/api/game',
  }), /只能在本地隔离环境/);
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

test('isolated transaction mix exercises state, orders, facilities, recipes, builds and research', { timeout: 40_000 }, async () => {
  const report = await runStressTest({
    targetMode: 'local',
    profile: 'transaction-mix',
    users: 4,
    durationSeconds: 6,
    pollIntervalMs: 200,
    enforcePerformanceBudget: false,
  });
  assert.equal(report.passed, true, report.failures.join('\n'));
  assert.equal(report.configuration.transactionMixWeights.state, 60);
  assert.equal(report.configuration.transactionMixWeights.order, 15);
  assert.equal(report.configuration.transactionMixWeights.facilityToggle, 10);
  assert.equal(report.configuration.transactionMixWeights.recipe, 5);
  assert.equal(report.configuration.transactionMixWeights.build, 5);
  assert.equal(report.configuration.transactionMixWeights.research, 5);
  for (const [category, count] of Object.entries(report.invariants.transactionMix)) {
    assert.ok(count > 0, `事务混合场景未覆盖 ${category}`);
  }
  assert.ok(report.invariants.actionConfirmations > 0);
  assert.ok(report.invariants.stateResponses > 4);
  assert.equal(report.metrics.serverErrorCount, 0);
  assert.equal(report.metrics.timeoutCount, 0);
  assert.equal(report.metrics.unexpectedStatusCount, 0);
  assert.ok(report.storage.after.databaseBytes > 0);
});
