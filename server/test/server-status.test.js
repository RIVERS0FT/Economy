import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import {
  createAdminServerStatus,
  installServerRuntimeMetrics,
  normalizeServerStatusRange,
} from '../src/server-status.js';
import { addLatencyHistogramSample, createLatencyHistogram } from '../src/request-metrics.js';

function createFixture() {
  const directory = mkdtempSync(join(tmpdir(), 'economy-server-status-'));
  const databasePath = join(directory, 'economy.sqlite');
  const database = new DatabaseSync(databasePath);
  database.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE economy_world (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      revision INTEGER NOT NULL,
      state_json TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    ) STRICT;
    INSERT INTO economy_world (id, revision, state_json, updated_at)
    VALUES (1, 17, '{"players":{}}', 1234567890);
  `);
  const diagnostics = {
    schedules: 4,
    wakeups: 3,
    processedWakeups: 2,
    staleWakeups: 1,
    transactions: 2,
    lastLagMs: 20,
    nextDueAt: 1_700_000_060_000,
  };
  return {
    directory,
    databasePath,
    store: { database, getSchedulerDiagnostics: () => ({ ...diagnostics }) },
    close() {
      database.close();
      rmSync(directory, { recursive: true, force: true });
    },
  };
}

function histogram(values) {
  const result = createLatencyHistogram();
  for (const value of values) addLatencyHistogramSample(result, value);
  return result;
}

const requestMetricsSnapshot = {
  generatedAt: 1_700_000_000_000,
  current: {
    windowStartedAt: 1_699_999_940_000,
    windowEndedAt: 1_700_000_000_000,
    windowMs: 60_000,
    requestCount: 100,
    clientErrorCount: 4,
    serverErrorCount: 0,
    averageDurationMs: 45,
    p50DurationMs: 20,
    p95DurationMs: 120,
    p99DurationMs: 180,
    maxDurationMs: 250,
    averageResponseBytes: 900,
    maxResponseBytes: 3_000,
    durationHistogram: histogram([20, 20, 40, 120, 180]),
    eventLoopDelay: { p50Ms: 1, p95Ms: 4, p99Ms: 8, maxMs: 12 },
    routes: [{
      method: 'GET', route: '/api/game/state', count: 100, clientErrorCount: 4,
      serverErrorCount: 0, averageDurationMs: 45, p95DurationMs: 120, maxDurationMs: 250,
      averageResponseBytes: 900, maxResponseBytes: 3_000,
      phases: { stateProjectionMs: { p95Ms: 40 } },
    }],
  },
  history: [],
};

const runtimeMetricsSnapshot = {
  generatedAt: 1_700_000_000_000,
  startedAt: 1_699_999_000_000,
  uptimeSeconds: 1_000,
  current: {
    cpuPercent: 20,
    rssBytes: 100_000_000,
    heapUsedBytes: 30_000_000,
    heapTotalBytes: 80_000_000,
    externalBytes: 1_000,
    arrayBuffersBytes: 500,
    loadAverage1m: 0.5,
    totalMemoryBytes: 8_000_000_000,
    freeMemoryBytes: 4_000_000_000,
  },
  history: [
    { startsAt: 1_699_999_820_000, endsAt: 1_699_999_879_999, samples: 12, cpuAveragePercent: 20, cpuMaxPercent: 30, rssAverageBytes: 90_000_000, rssMaxBytes: 100_000_000, heapUsedAverageBytes: 25_000_000, heapUsedMaxBytes: 30_000_000, heapTotalMaxBytes: 80_000_000 },
    { startsAt: 1_699_999_880_000, endsAt: 1_699_999_939_999, samples: 12, cpuAveragePercent: 20, cpuMaxPercent: 30, rssAverageBytes: 90_000_000, rssMaxBytes: 100_000_000, heapUsedAverageBytes: 25_000_000, heapUsedMaxBytes: 30_000_000, heapTotalMaxBytes: 80_000_000 },
    { startsAt: 1_699_999_940_000, endsAt: 1_700_000_000_000, samples: 12, cpuAveragePercent: 20, cpuMaxPercent: 30, rssAverageBytes: 90_000_000, rssMaxBytes: 100_000_000, heapUsedAverageBytes: 25_000_000, heapUsedMaxBytes: 30_000_000, heapTotalMaxBytes: 80_000_000 },
  ],
};

test('server status range is constrained to hour, day, and month windows', () => {
  assert.equal(normalizeServerStatusRange('1h'), '1h');
  assert.equal(normalizeServerStatusRange('1d'), '1d');
  assert.equal(normalizeServerStatusRange('30d'), '30d');
  assert.equal(normalizeServerStatusRange('invalid'), '1h');
});

test('server status is read-only and returns bounded diagnostics', () => {
  const fixture = createFixture();
  try {
    const before = fixture.store.database.prepare('SELECT revision, state_json, updated_at FROM economy_world WHERE id = 1').get();
    const status = createAdminServerStatus({
      store: fixture.store,
      databasePath: fixture.databasePath,
      range: '1h',
      now: () => 1_700_000_000_000,
      requestMetricsSnapshot,
      runtimeMetricsSnapshot,
    });
    const after = fixture.store.database.prepare('SELECT revision, state_json, updated_at FROM economy_world WHERE id = 1').get();
    assert.deepEqual(after, before);
    assert.equal(status.range.key, '1h');
    assert.equal(status.range.granularity, 'minute');
    assert.equal(status.range.bucketMilliseconds, 60_000);
    assert.equal(status.health.level, 'healthy');
    assert.equal(status.requests.requestCount, 100);
    assert.equal(status.requests.routes[0].route, '/api/game/state');
    assert.equal(status.scheduler.transactions, 2);
    assert.equal(status.database.worldRevision, 17);
    assert.equal(status.database.journalMode, 'wal');
    assert.equal(status.history.length, 4);
    assert.equal(status.history.at(-1).eventLoopP99Ms, 8);
    assert.equal(JSON.stringify(status).includes(fixture.databasePath), false);
  } finally {
    fixture.close();
  }
});

test('server status changes bucket granularity for hour, day, and month ranges', () => {
  const fixture = createFixture();
  try {
    const now = 1_700_000_000_000;
    const history = Array.from({ length: 180 }, (_, index) => {
      const endedAt = now - (179 - index) * 60_000;
      const value = 10 + index;
      return {
        windowStartedAt: endedAt - 60_000,
        windowEndedAt: endedAt,
        windowMs: 60_000,
        requestCount: 1,
        clientErrorCount: 0,
        serverErrorCount: 0,
        averageDurationMs: value,
        p50DurationMs: value,
        p95DurationMs: value,
        p99DurationMs: value,
        maxDurationMs: value,
        averageResponseBytes: 100,
        maxResponseBytes: 100,
        durationHistogram: histogram([value]),
        eventLoopDelay: { p50Ms: 1, p95Ms: 2, p99Ms: 3, maxMs: 4 },
        routes: [],
      };
    });
    const requestSnapshot = { generatedAt: now, current: null, history };
    const hourStatus = createAdminServerStatus({
      store: fixture.store,
      databasePath: fixture.databasePath,
      range: '1h',
      now: () => now,
      requestMetricsSnapshot: requestSnapshot,
      runtimeMetricsSnapshot,
    });
    const dayStatus = createAdminServerStatus({
      store: fixture.store,
      databasePath: fixture.databasePath,
      range: '1d',
      now: () => now,
      requestMetricsSnapshot: requestSnapshot,
      runtimeMetricsSnapshot,
    });
    const monthStatus = createAdminServerStatus({
      store: fixture.store,
      databasePath: fixture.databasePath,
      range: '30d',
      now: () => now,
      requestMetricsSnapshot: requestSnapshot,
      runtimeMetricsSnapshot,
    });

    assert.equal(hourStatus.range.granularity, 'minute');
    assert.equal(dayStatus.range.granularity, 'hour');
    assert.equal(monthStatus.range.granularity, 'day');
    assert.ok(hourStatus.history.length > dayStatus.history.length);
    assert.ok(dayStatus.history.length >= monthStatus.history.length);
    assert.notEqual(hourStatus.history[0].startsAt, dayStatus.history[0].startsAt);
    assert.ok(dayStatus.history.every((bucket) => bucket.p50DurationMs <= bucket.p95DurationMs));
    assert.ok(dayStatus.history.every((bucket) => bucket.p95DurationMs <= bucket.p99DurationMs));
  } finally {
    fixture.close();
  }
});

test('runtime collector rolls completed minutes into bounded hour and day buckets', () => {
  let currentTime = Date.UTC(2026, 7, 4, 0, 0);
  let performanceTime = 0;
  let cpuMicros = 0;
  const requestHistory = [];
  const requestSnapshot = () => ({
    generatedAt: currentTime,
    current: null,
    history: requestHistory.map((window) => ({ ...window, durationHistogram: [...window.durationHistogram] })),
  });
  const installation = installServerRuntimeMetrics({
    sampleMs: 86_400_000,
    historyMinutes: 360,
    now: () => currentTime,
    performanceNow: () => performanceTime,
    cpuUsage: () => ({ user: cpuMicros, system: 0 }),
    memoryUsage: () => ({
      rss: 100_000_000,
      heapUsed: 30_000_000,
      heapTotal: 80_000_000,
      external: 1_000,
      arrayBuffers: 500,
    }),
    requestSnapshot,
  });

  try {
    for (let index = 0; index < 125; index += 1) {
      const windowStartedAt = currentTime;
      currentTime += 60_000;
      performanceTime += 60_000;
      cpuMicros += 6_000_000;
      const duration = 10 + index;
      requestHistory.push({
        windowStartedAt,
        windowEndedAt: currentTime,
        windowMs: 60_000,
        requestCount: 1,
        clientErrorCount: 0,
        serverErrorCount: 0,
        averageDurationMs: duration,
        p50DurationMs: duration,
        p95DurationMs: duration,
        p99DurationMs: duration,
        maxDurationMs: duration,
        averageResponseBytes: 100,
        maxResponseBytes: 100,
        durationHistogram: histogram([duration]),
        eventLoopDelay: { p50Ms: 1, p95Ms: 2, p99Ms: 3, maxMs: 4 },
        routes: [],
      });
      installation.sample();
    }

    const hour = installation.snapshot({ rangeKey: '1h', requestMetricsSnapshot: requestSnapshot() });
    const day = installation.snapshot({ rangeKey: '1d', requestMetricsSnapshot: requestSnapshot() });
    const month = installation.snapshot({ rangeKey: '30d', requestMetricsSnapshot: requestSnapshot() });

    assert.equal(hour.trendHistory.length, 60);
    assert.equal(day.trendHistory.length, 3);
    assert.equal(month.trendHistory.length, 1);
    assert.ok(day.trendHistory.every((bucket) => bucket.p50DurationMs <= bucket.p95DurationMs));
    assert.ok(day.trendHistory.every((bucket) => bucket.p95DurationMs <= bucket.p99DurationMs));
    assert.equal(day.trendHistory.reduce((total, bucket) => total + bucket.requestCount, 0), 125);
    assert.equal(month.trendHistory[0].requestCount, 125);
  } finally {
    installation.uninstall();
  }
});

