import assert from 'node:assert/strict';
import test from 'node:test';
import {
  addLatencyHistogramSample,
  createLatencyHistogram,
  createRequestMetricsCollector,
  latencyHistogramPercentile,
  mergeLatencyHistograms,
  normalizeMetricRoute,
} from '../src/request-metrics.js';

test('request metrics normalize route identifiers', () => {
  assert.equal(normalizeMetricRoute('/api/game/orders/order-owner-7-42/cancel?from=test'), '/api/game/orders/:id/cancel');
  assert.equal(
    normalizeMetricRoute('/api/game/auctions/auction-owner-9-sequence-3/bids'),
    '/api/game/auctions/:id/bids',
  );
  assert.equal(
    normalizeMetricRoute('/api/game/admin/gift-codes/code-123/redemptions'),
    '/api/game/admin/gift-codes/:id/redemptions',
  );
  assert.equal(normalizeMetricRoute('/api/game/state?revision=4'), '/api/game/state');
});

test('request metrics aggregate duration, errors and application response bytes', () => {
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
    phases: { worldCloneMs: 10, stateProjectionMs: 20 },
    gauges: { worldJsonBytes: 4_096 },
  });
  collector.record({
    method: 'GET',
    url: '/api/game/state?revision=2',
    statusCode: 404,
    durationMs: 80,
    responseBytes: 1_200,
    phases: { worldCloneMs: 30, stateProjectionMs: 40 },
    gauges: { worldJsonBytes: 8_192 },
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

  currentTime = 31_000;
  const partial = collector.snapshot();
  assert.equal(partial.requestCount, 3);
  assert.equal(partial.clientErrorCount, 1);
  assert.equal(partial.serverErrorCount, 1);
  assert.equal(partial.routes.length, 2);

  currentTime = 61_000;
  const summary = collector.flush();
  assert.equal(summary.windowMs, 60_000);
  assert.equal(summary.requestCount, 3);
  assert.equal(summary.clientErrorCount, 1);
  assert.equal(summary.serverErrorCount, 1);
  assert.equal(summary.averageDurationMs, 440);
  assert.equal(summary.p95DurationMs, 1_200);
  assert.equal(summary.routes.length, 2);
  assert.deepEqual(summary.routes[0], {
    method: 'GET',
    route: '/api/game/state',
    count: 2,
    errorCount: 0,
    clientErrorCount: 1,
    serverErrorCount: 0,
    averageDurationMs: 60,
    p50DurationMs: 40,
    p95DurationMs: 80,
    p99DurationMs: 80,
    maxDurationMs: 80,
    averageResponseBytes: 1_000,
    maxResponseBytes: 1_200,
    phases: {
      stateProjectionMs: { p50Ms: 20, p95Ms: 40, p99Ms: 40, maxMs: 40 },
      worldCloneMs: { p50Ms: 10, p95Ms: 30, p99Ms: 30, maxMs: 30 },
    },
    gauges: { worldJsonBytes: 8_192 },
  });
  assert.equal(summary.routes[1].method, 'POST');
  assert.equal(summary.routes[1].errorCount, 1);
  assert.equal(summary.routes[1].serverErrorCount, 1);
  assert.equal(logs.length, 1);
  assert.equal(warnings.length, 1);

  currentTime = 62_000;
  const empty = collector.flush();
  assert.deepEqual(empty.routes, []);
  assert.equal(empty.requestCount, 0);
  assert.equal(logs.length, 1);
});

test('request metrics cap route cardinality and aggregate overflow', () => {
  const collector = createRequestMetricsCollector({
    now: () => 1_000,
    log: () => {},
    warn: () => {},
    maxRouteKeys: 3,
  });

  for (let index = 0; index < 10; index += 1) {
    collector.record({
      method: 'GET',
      url: `/api/game/unknown-route-${index}`,
      statusCode: 404,
      durationMs: 1,
      responseBytes: 20,
    });
  }

  const summary = collector.flush();
  assert.equal(summary.routes.length, 3);
  assert.equal(summary.overflowedRequestCount, 8);
  assert.equal(summary.clientErrorCount, 10);
  assert.deepEqual(
    summary.routes.find((route) => route.method === 'OTHER'),
    {
      method: 'OTHER',
      route: '/api/other',
      count: 8,
      errorCount: 0,
      clientErrorCount: 8,
      serverErrorCount: 0,
      averageDurationMs: 1,
      p50DurationMs: 1,
      p95DurationMs: 1,
      p99DurationMs: 1,
      maxDurationMs: 1,
      averageResponseBytes: 20,
      maxResponseBytes: 20,
      phases: {},
      gauges: {},
    },
  );
});


test('request latency histograms merge across minute, hour, and day rollups', () => {
  const first = createLatencyHistogram();
  const second = createLatencyHistogram();
  for (const value of [10, 20, 30, 40]) addLatencyHistogramSample(first, value);
  for (const value of [100, 200, 300, 400]) addLatencyHistogramSample(second, value);
  mergeLatencyHistograms(first, second);
  const p50 = latencyHistogramPercentile(first, 0.5);
  const p95 = latencyHistogramPercentile(first, 0.95);
  const p99 = latencyHistogramPercentile(first, 0.99);
  assert.ok(p50 >= 40 && p50 < 100);
  assert.ok(p95 >= 400);
  assert.equal(p99, p95);
});
