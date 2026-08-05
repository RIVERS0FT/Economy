import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  deserializeServerMetricBucket,
  installPersistentServerRuntimeMetrics,
  serializeServerMetricBucket,
} from '../src/persistent-server-runtime-metrics.js';
import {
  resolveServerMetricsDatabasePath,
  ServerMetricsStore,
  SERVER_METRICS_RETENTION,
} from '../src/server-metrics-store.js';

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

function histogram(value, count = 1) {
  const result = Array.from({ length: 256 }, () => 0);
  result[Math.max(0, Math.min(255, value))] = count;
  return result;
}

function metricBucket({ startsAt, bucketMs, requestCount, duration, cpuPercent, routeCount = requestCount }) {
  return deserializeServerMetricBucket({
    startsAt,
    endsAt: startsAt + bucketMs,
    windowMs: bucketMs,
    requestCount,
    clientErrorCount: 0,
    serverErrorCount: 0,
    weightedDuration: duration * requestCount,
    durationHistogram: histogram(32, requestCount),
    p50FallbackMs: duration,
    p95FallbackMs: duration,
    p99FallbackMs: duration,
    maxDurationMs: duration,
    weightedResponseBytes: 100 * requestCount,
    maxResponseBytes: 100,
    eventLoopP50Ms: 1,
    eventLoopP95Ms: 2,
    eventLoopP99Ms: 3,
    eventLoopMaxMs: 4,
    runtimeSamples: 1,
    cpuTotalPercent: cpuPercent,
    cpuMaxPercent: cpuPercent,
    rssMaxBytes: 100_000_000,
    heapUsedMaxBytes: 30_000_000,
    heapTotalMaxBytes: 80_000_000,
    routes: [{
      method: 'GET',
      route: '/api/game/state',
      count: routeCount,
      clientErrorCount: 0,
      serverErrorCount: 0,
      weightedDuration: duration * routeCount,
      p95DurationMs: duration,
      maxDurationMs: duration,
      weightedResponseBytes: 100 * routeCount,
      maxResponseBytes: 100,
      phases: { stateProjectionMs: duration / 2 },
    }],
  });
}

function createFakeInstallation({ now, requestCount, duration, cpuPercent }) {
  const startedAt = now - 10_000;
  let uninstalled = false;
  return {
    startedAt,
    snapshot({ rangeKey = '1h' } = {}) {
      const bucketMs = rangeKey === '1h' ? MINUTE_MS : rangeKey === '1d' ? HOUR_MS : DAY_MS;
      const startsAt = Math.floor(now / bucketMs) * bucketMs;
      const bucket = metricBucket({ startsAt, bucketMs, requestCount, duration, cpuPercent });
      return {
        generatedAt: now,
        startedAt,
        uptimeSeconds: 10,
        current: {
          cpuPercent,
          rssBytes: 100_000_000,
          heapUsedBytes: 30_000_000,
          heapTotalBytes: 80_000_000,
          externalBytes: 1_000,
          arrayBuffersBytes: 500,
          loadAverage1m: 0.5,
          totalMemoryBytes: 8_000_000_000,
          freeMemoryBytes: 4_000_000_000,
        },
        history: [],
        trendBuckets: [bucket],
        trendHistory: [],
      };
    },
    uninstall() {
      uninstalled = true;
    },
    get uninstalled() {
      return uninstalled;
    },
  };
}

test('server metrics database path follows the persistent economy state directory', () => {
  assert.equal(
    resolveServerMetricsDatabasePath({ ECONOMY_DB_PATH: '/var/lib/riversoft-economy/economy.sqlite' }),
    '/var/lib/riversoft-economy/server-metrics.sqlite',
  );
  assert.equal(
    resolveServerMetricsDatabasePath({
      ECONOMY_DB_PATH: '/tmp/ignored.sqlite',
      ECONOMY_SERVER_METRICS_DB_PATH: '/srv/economy/metrics.sqlite',
    }),
    '/srv/economy/metrics.sqlite',
  );
});

test('server metrics store survives close and reopen with valid SQLite state', () => {
  const directory = mkdtempSync(join(tmpdir(), 'economy-server-metrics-store-'));
  const databasePath = join(directory, 'server-metrics.sqlite');
  const now = Date.UTC(2026, 7, 5, 0, 0);
  try {
    const first = new ServerMetricsStore(databasePath, { now: () => now });
    first.startBoot('boot-a', now - MINUTE_MS, '1234567890abcdef');
    first.upsertBuckets('boot-a', 'minute', [serializeServerMetricBucket(metricBucket({
      startsAt: now - MINUTE_MS,
      bucketMs: MINUTE_MS,
      requestCount: 2,
      duration: 20,
      cpuPercent: 10,
    }))]);
    first.stopBoot('boot-a', now);
    assert.equal(first.quickCheck(), 'ok');
    first.close();

    const reopened = new ServerMetricsStore(databasePath, { now: () => now });
    assert.equal(reopened.quickCheck(), 'ok');
    const rows = reopened.listBuckets('minute', now - HOUR_MS);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].bootId, 'boot-a');
    assert.equal(rows[0].payload.requestCount, 2);
    assert.equal(reopened.listBoots(now - HOUR_MS)[0].stoppedAt, now);
    reopened.close();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('persistent runtime metrics merge prior boots without duplicating the current boot', () => {
  const directory = mkdtempSync(join(tmpdir(), 'economy-server-metrics-runtime-'));
  const databasePath = join(directory, 'server-metrics.sqlite');
  const now = Date.UTC(2026, 7, 5, 3, 15, 30);
  try {
    const firstRuntime = createFakeInstallation({ now, requestCount: 2, duration: 20, cpuPercent: 10 });
    const first = installPersistentServerRuntimeMetrics({
      installation: firstRuntime,
      databasePath,
      bootId: 'boot-a',
      now: () => now,
      persistIntervalMs: DAY_MS,
      registerSignals: false,
      warn: (message, error) => { throw new Error(`${message}: ${error}`); },
    });
    first.persist();
    first.uninstall();
    assert.equal(firstRuntime.uninstalled, true);

    const secondRuntime = createFakeInstallation({ now, requestCount: 3, duration: 40, cpuPercent: 30 });
    const second = installPersistentServerRuntimeMetrics({
      installation: secondRuntime,
      databasePath,
      bootId: 'boot-b',
      now: () => now,
      persistIntervalMs: DAY_MS,
      registerSignals: false,
      warn: (message, error) => { throw new Error(`${message}: ${error}`); },
    });
    second.persist();
    second.persist();

    const hour = second.snapshot({ rangeKey: '1h' });
    assert.equal(hour.trendBuckets.length, 1);
    assert.equal(hour.trendBuckets[0].requestCount, 5);
    assert.equal(hour.trendBuckets[0].weightedDuration, 160);
    assert.equal(hour.trendBuckets[0].runtimeSamples, 2);
    assert.equal(hour.trendBuckets[0].cpuTotalPercent, 40);
    assert.equal(hour.trendBuckets[0].routes.get('GET /api/game/state').count, 5);
    assert.equal(hour.trendHistory[0].requestCount, 5);
    assert.equal(hour.persistence.enabled, true);

    const day = second.snapshot({ rangeKey: '1d' });
    const month = second.snapshot({ rangeKey: '30d' });
    assert.equal(day.trendBuckets[0].requestCount, 5);
    assert.equal(month.trendBuckets[0].requestCount, 5);
    second.uninstall();
    assert.equal(secondRuntime.uninstalled, true);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('server metrics retention prunes high-resolution rows before long-term daily rows', () => {
  const directory = mkdtempSync(join(tmpdir(), 'economy-server-metrics-retention-'));
  const databasePath = join(directory, 'server-metrics.sqlite');
  const now = Date.UTC(2026, 7, 5, 0, 0);
  try {
    const store = new ServerMetricsStore(databasePath, { now: () => now });
    store.startBoot('boot-old', now - 200 * DAY_MS, null);
    for (const [granularity, age] of [
      ['minute', SERVER_METRICS_RETENTION.minute + MINUTE_MS],
      ['hour', SERVER_METRICS_RETENTION.hour + HOUR_MS],
      ['day', SERVER_METRICS_RETENTION.day - DAY_MS],
    ]) {
      const bucketMs = granularity === 'minute' ? MINUTE_MS : granularity === 'hour' ? HOUR_MS : DAY_MS;
      const startsAt = now - age;
      store.upsertBuckets('boot-old', granularity, [serializeServerMetricBucket(metricBucket({
        startsAt,
        bucketMs,
        requestCount: 1,
        duration: 10,
        cpuPercent: 5,
      }))]);
    }
    store.prune(now);
    assert.equal(store.listBuckets('minute', 0).length, 0);
    assert.equal(store.listBuckets('hour', 0).length, 0);
    assert.equal(store.listBuckets('day', 0).length, 1);
    store.close();
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
