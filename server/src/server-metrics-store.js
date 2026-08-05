import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;

export const SERVER_METRICS_RETENTION = Object.freeze({
  minute: 2 * DAY_MS,
  hour: 35 * DAY_MS,
  day: 180 * DAY_MS,
});

const GRANULARITIES = new Set(Object.keys(SERVER_METRICS_RETENTION));

function normalizeGranularity(value) {
  const granularity = String(value || '');
  if (!GRANULARITIES.has(granularity)) {
    throw new Error(`Unsupported server metrics granularity: ${granularity}`);
  }
  return granularity;
}

function finiteTimestamp(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) throw new Error(`Invalid server metrics timestamp: ${value}`);
  return Math.floor(number);
}

function normalizedReleaseSha(value) {
  const candidate = String(value || '').trim();
  return /^[0-9a-f]{7,40}$/i.test(candidate) ? candidate.slice(0, 40).toLowerCase() : null;
}

export function resolveServerMetricsDatabasePath(environment = process.env) {
  const explicit = String(environment.ECONOMY_SERVER_METRICS_DB_PATH || '').trim();
  if (explicit) return explicit;
  const economyDatabasePath = String(
    environment.ECONOMY_DB_PATH || '/var/lib/riversoft-economy/economy.sqlite',
  ).trim();
  if (economyDatabasePath === ':memory:') return ':memory:';
  return join(dirname(economyDatabasePath), 'server-metrics.sqlite');
}

export class ServerMetricsStore {
  constructor(databasePath, { now = Date.now } = {}) {
    this.databasePath = databasePath;
    this.now = now;
    this.closed = false;
    if (databasePath !== ':memory:') mkdirSync(dirname(databasePath), { recursive: true });
    this.database = new DatabaseSync(databasePath, { timeout: 5_000 });
    this.database.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = NORMAL;
      PRAGMA foreign_keys = ON;
      PRAGMA auto_vacuum = INCREMENTAL;
      CREATE TABLE IF NOT EXISTS economy_server_metric_boots (
        boot_id TEXT PRIMARY KEY,
        started_at INTEGER NOT NULL,
        stopped_at INTEGER,
        release_sha TEXT
      ) STRICT;
      CREATE TABLE IF NOT EXISTS economy_server_metric_buckets (
        boot_id TEXT NOT NULL REFERENCES economy_server_metric_boots(boot_id) ON DELETE CASCADE,
        granularity TEXT NOT NULL CHECK (granularity IN ('minute', 'hour', 'day')),
        starts_at INTEGER NOT NULL,
        ends_at INTEGER NOT NULL,
        payload_json TEXT NOT NULL,
        updated_at INTEGER NOT NULL,
        PRIMARY KEY (boot_id, granularity, starts_at)
      ) STRICT;
      CREATE INDEX IF NOT EXISTS idx_economy_server_metric_buckets_range
        ON economy_server_metric_buckets(granularity, starts_at, boot_id);
      CREATE INDEX IF NOT EXISTS idx_economy_server_metric_boots_started
        ON economy_server_metric_boots(started_at DESC);
    `);
    this.upsertBootStatement = this.database.prepare(`
      INSERT INTO economy_server_metric_boots (boot_id, started_at, stopped_at, release_sha)
      VALUES (?, ?, NULL, ?)
      ON CONFLICT(boot_id) DO UPDATE SET
        started_at = excluded.started_at,
        stopped_at = NULL,
        release_sha = excluded.release_sha
    `);
    this.stopBootStatement = this.database.prepare(`
      UPDATE economy_server_metric_boots
      SET stopped_at = ?
      WHERE boot_id = ? AND (stopped_at IS NULL OR stopped_at < ?)
    `);
    this.upsertBucketStatement = this.database.prepare(`
      INSERT INTO economy_server_metric_buckets (
        boot_id, granularity, starts_at, ends_at, payload_json, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(boot_id, granularity, starts_at) DO UPDATE SET
        ends_at = excluded.ends_at,
        payload_json = excluded.payload_json,
        updated_at = excluded.updated_at
    `);
    this.listBucketsStatement = this.database.prepare(`
      SELECT boot_id, starts_at, ends_at, payload_json, updated_at
      FROM economy_server_metric_buckets
      WHERE granularity = ? AND ends_at > ?
      ORDER BY starts_at ASC, boot_id ASC
    `);
    this.listBucketsExcludingBootStatement = this.database.prepare(`
      SELECT boot_id, starts_at, ends_at, payload_json, updated_at
      FROM economy_server_metric_buckets
      WHERE granularity = ? AND ends_at > ? AND boot_id <> ?
      ORDER BY starts_at ASC, boot_id ASC
    `);
    this.listBootsStatement = this.database.prepare(`
      SELECT boot_id, started_at, stopped_at, release_sha
      FROM economy_server_metric_boots
      WHERE COALESCE(stopped_at, started_at) >= ?
      ORDER BY started_at ASC, boot_id ASC
    `);
    this.deleteBucketsStatement = this.database.prepare(`
      DELETE FROM economy_server_metric_buckets
      WHERE granularity = ? AND ends_at <= ?
    `);
    this.deleteEmptyBootsStatement = this.database.prepare(`
      DELETE FROM economy_server_metric_boots
      WHERE COALESCE(stopped_at, started_at) < ?
        AND NOT EXISTS (
          SELECT 1 FROM economy_server_metric_buckets AS bucket
          WHERE bucket.boot_id = economy_server_metric_boots.boot_id
        )
    `);
  }

  assertOpen() {
    if (this.closed) throw new Error('Server metrics store is closed');
  }

  startBoot(bootId, startedAt, releaseSha = null) {
    this.assertOpen();
    this.upsertBootStatement.run(
      String(bootId),
      finiteTimestamp(startedAt),
      normalizedReleaseSha(releaseSha),
    );
  }

  stopBoot(bootId, stoppedAt = this.now()) {
    this.assertOpen();
    const timestamp = finiteTimestamp(stoppedAt);
    this.stopBootStatement.run(timestamp, String(bootId), timestamp);
  }

  upsertBuckets(bootId, granularity, buckets, updatedAt = this.now()) {
    this.assertOpen();
    const normalized = normalizeGranularity(granularity);
    const timestamp = finiteTimestamp(updatedAt);
    const rows = Array.isArray(buckets) ? buckets : [];
    if (rows.length === 0) return;
    this.database.exec('BEGIN IMMEDIATE');
    try {
      for (const bucket of rows) {
        const startsAt = finiteTimestamp(bucket?.startsAt);
        const endsAt = Math.max(startsAt, finiteTimestamp(bucket?.endsAt));
        this.upsertBucketStatement.run(
          String(bootId),
          normalized,
          startsAt,
          endsAt,
          JSON.stringify(bucket),
          timestamp,
        );
      }
      this.database.exec('COMMIT');
    } catch (error) {
      try { this.database.exec('ROLLBACK'); } catch { /* no active transaction */ }
      throw error;
    }
  }

  listBuckets(granularity, cutoff, { excludeBootId = null } = {}) {
    this.assertOpen();
    const normalized = normalizeGranularity(granularity);
    const cutoffTimestamp = finiteTimestamp(cutoff);
    const rows = excludeBootId
      ? this.listBucketsExcludingBootStatement.all(normalized, cutoffTimestamp, String(excludeBootId))
      : this.listBucketsStatement.all(normalized, cutoffTimestamp);
    const result = [];
    for (const row of rows) {
      try {
        const payload = JSON.parse(String(row.payload_json));
        result.push({
          bootId: String(row.boot_id),
          startsAt: Number(row.starts_at),
          endsAt: Number(row.ends_at),
          updatedAt: Number(row.updated_at),
          payload,
        });
      } catch {
        // A malformed diagnostic row is ignored; game authority must remain available.
      }
    }
    return result;
  }

  listBoots(cutoff = 0) {
    this.assertOpen();
    return this.listBootsStatement.all(finiteTimestamp(cutoff)).map((row) => ({
      bootId: String(row.boot_id),
      startedAt: Number(row.started_at),
      stoppedAt: row.stopped_at == null ? null : Number(row.stopped_at),
      releaseSha: row.release_sha == null ? null : String(row.release_sha),
    }));
  }

  prune(referenceTime = this.now()) {
    this.assertOpen();
    const now = finiteTimestamp(referenceTime);
    this.database.exec('BEGIN IMMEDIATE');
    try {
      for (const [granularity, retentionMs] of Object.entries(SERVER_METRICS_RETENTION)) {
        this.deleteBucketsStatement.run(granularity, Math.max(0, now - retentionMs));
      }
      this.deleteEmptyBootsStatement.run(Math.max(0, now - SERVER_METRICS_RETENTION.day));
      this.database.exec('COMMIT');
    } catch (error) {
      try { this.database.exec('ROLLBACK'); } catch { /* no active transaction */ }
      throw error;
    }
  }

  quickCheck() {
    this.assertOpen();
    return String(this.database.prepare('PRAGMA quick_check(1)').get()?.quick_check || 'unknown');
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    this.database.close();
  }
}
