import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import {
  createAdminServerStatus,
  normalizeServerStatusRange,
} from '../src/server-status.js';

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

test('server status range is constrained to the supported windows', () => {
  assert.equal(normalizeServerStatusRange('1h'), '1h');
  assert.equal(normalizeServerStatusRange('invalid'), '15m');
});

test('server status is read-only and returns bounded diagnostics', () => {
  const fixture = createFixture();
  try {
    const before = fixture.store.database.prepare('SELECT revision, state_json, updated_at FROM economy_world WHERE id = 1').get();
    const status = createAdminServerStatus({
      store: fixture.store,
      databasePath: fixture.databasePath,
      range: '15m',
      now: () => 1_700_000_000_000,
      requestMetricsSnapshot,
      runtimeMetricsSnapshot,
    });
    const after = fixture.store.database.prepare('SELECT revision, state_json, updated_at FROM economy_world WHERE id = 1').get();
    assert.deepEqual(after, before);
    assert.equal(status.range.key, '15m');
    assert.equal(status.health.level, 'healthy');
    assert.equal(status.requests.requestCount, 100);
    assert.equal(status.requests.routes[0].route, '/api/game/state');
    assert.equal(status.scheduler.transactions, 2);
    assert.equal(status.database.worldRevision, 17);
    assert.equal(status.database.journalMode, 'wal');
    assert.equal(status.history.length, 4);
    assert.equal(JSON.stringify(status).includes(fixture.databasePath), false);
  } finally {
    fixture.close();
  }
});
