import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createRequestMetricsCollector,
  normalizeMetricRoute,
} from '../src/request-metrics.js';

test('request metrics normalize route identifiers', () => {
  assert.equal(normalizeMetricRoute('/api/game/orders/123/cancel?from=test'), '/api/game/orders/:id/cancel');
  assert.equal(
    normalizeMetricRoute('/api/game/auctions/123e4567-e89b-12d3-a456-426614174000/bids'),
    '/api/game/auctions/:id/bids',
  );
  assert.equal(normalizeMetricRoute('/api/game/state?revision=4'), '/api/game/state');
});

test('request metrics aggregate duration and application response bytes', () => {
  let currentTime = 1_000;
  const logs = [];
  const warnings = [];
  const collector = createRequestMetricsCollector({
    now: () => currentTime,
    log: (...values) => logs.push(values),
    warn: (...values) => warnings.push(values),
    slowRequestMs: 1_000,
    largeResponseBytes: 200 * 1024,
  });

  collector.record({
    method: 'GET',
    url: '/api/game/state?revision=1',
    statusCode: 200,
    durationMs: 40,
    responseBytes: 800,
  });
  collector.record({
    method: 'GET',
    url: '/api/game/state?revision=2',
    statusCode: 200,
    durationMs: 80,
    responseBytes: 1_200,
  });
  collector.record({
    method: 'POST',
    url: '/api/game/orders',
    statusCode: 503,
    durationMs: 1_200,
    responseBytes: 300,
  });
  collector.record({
    method: 'GET',
    url: '/unrelated',
    statusCode: 200,
    durationMs: 2,
    responseBytes: 10,
  });

  currentTime = 61_000;
  const summary = collector.flush();
  assert.equal(summary.windowMs, 60_000);
  assert.equal(summary.routes.length, 2);
  assert.deepEqual(summary.routes[0], {
    method: 'GET',
    route: '/api/game/state',
    count: 2,
    errorCount: 0,
    averageDurationMs: 60,
    maxDurationMs: 80,
    averageResponseBytes: 1_000,
    maxResponseBytes: 1_200,
  });
  assert.equal(summary.routes[1].method, 'POST');
  assert.equal(summary.routes[1].errorCount, 1);
  assert.equal(logs.length, 1);
  assert.equal(warnings.length, 1);

  currentTime = 62_000;
  assert.deepEqual(collector.flush().routes, []);
  assert.equal(logs.length, 1);
});
