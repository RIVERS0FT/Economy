import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import {
  createWorld,
  ensurePlayer,
  migrateWorld,
} from './domain.js';
import { stripPlayerLogs } from './asset-events.js';
import {
  applyFacilityGroupAction,
  createFacilityGroupClientState,
  migrateFacilityGroupWorld,
  processFacilityGroupWorld,
  stripLegacyFacilityInstances,
} from './facility-groups.js';
import { createWarehouseSummary, ensureWarehouse, upgradeWarehouse } from './warehouse.js';

const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

function normalizeJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function createVersionedClientState(world, userId, now) {
  const player = world.players[String(userId)];
  ensureWarehouse(player);
  const state = createFacilityGroupClientState(world, userId, now);
  const {
    trades: _serverTrades,
    ledger: _serverLedger,
    assetEvents: _serverAssetEvents,
    ...authoritativeState
  } = state;
  return {
    ...authoritativeState,
    ...createWarehouseSummary(world, player),
    version: 8,
  };
}

export class EconomyStore {
  constructor(databasePath) {
    if (databasePath !== ':memory:') mkdirSync(dirname(databasePath), { recursive: true });
    this.database = new DatabaseSync(databasePath, { timeout: 5_000 });
    this.database.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = NORMAL;
      PRAGMA foreign_keys = ON;
      CREATE TABLE IF NOT EXISTS economy_world (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        revision INTEGER NOT NULL,
        state_json TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      ) STRICT;
      CREATE TABLE IF NOT EXISTS economy_idempotency (
        user_id INTEGER NOT NULL,
        request_key TEXT NOT NULL,
        request_method TEXT NOT NULL,
        request_path TEXT NOT NULL,
        response_json TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        PRIMARY KEY (user_id, request_key)
      ) STRICT;
      CREATE INDEX IF NOT EXISTS idx_economy_idempotency_created_at
        ON economy_idempotency(created_at);
    `);
    this.selectWorld = this.database.prepare('SELECT revision, state_json FROM economy_world WHERE id = 1');
    this.insertWorld = this.database.prepare(
      'INSERT INTO economy_world (id, revision, state_json, updated_at) VALUES (1, ?, ?, ?)',
    );
    this.updateWorld = this.database.prepare(
      'UPDATE economy_world SET revision = ?, state_json = ?, updated_at = ? WHERE id = 1',
    );
    this.selectIdempotency = this.database.prepare(
      'SELECT request_method, request_path, response_json FROM economy_idempotency WHERE user_id = ? AND request_key = ?',
    );
    this.insertIdempotency = this.database.prepare(`
      INSERT INTO economy_idempotency (
        user_id, request_key, request_method, request_path, response_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?)
    `);
    this.deleteExpiredIdempotency = this.database.prepare(
      'DELETE FROM economy_idempotency WHERE created_at < ?',
    );
  }

  close() {
    this.database.close();
  }

  transaction(callback) {
    this.database.exec('BEGIN IMMEDIATE');
    try {
      const value = callback();
      this.database.exec('COMMIT');
      return value;
    } catch (error) {
      this.database.exec('ROLLBACK');
      throw error;
    }
  }

  loadWorld(now) {
    const row = this.selectWorld.get();
    if (!row) {
      const world = stripPlayerLogs(createWorld(now));
      migrateFacilityGroupWorld(world, now);
      stripLegacyFacilityInstances(world);
      this.insertWorld.run(1, JSON.stringify(world), now);
      return { revision: 1, world };
    }
    const world = migrateWorld(JSON.parse(String(row.state_json)), now);
    stripPlayerLogs(world);
    migrateFacilityGroupWorld(world, now);
    for (const player of Object.values(world.players || {})) ensureWarehouse(player);
    return { revision: Number(row.revision), world };
  }

  saveWorld(revision, world, now) {
    for (const player of Object.values(world.players || {})) ensureWarehouse(player);
    migrateFacilityGroupWorld(world, now);
    stripLegacyFacilityInstances(world);
    stripPlayerLogs(world);
    this.updateWorld.run(revision + 1, JSON.stringify(world), now);
  }

  getState(user, now = Date.now()) {
    return this.transaction(() => {
      const { revision, world } = this.loadWorld(now);
      const player = ensurePlayer(world, user, now);
      ensureWarehouse(player);
      migrateFacilityGroupWorld(world, now);
      processFacilityGroupWorld(world, now);
      ensureWarehouse(world.players[String(user.id)]);
      const state = normalizeJson(createVersionedClientState(world, Number(user.id), now));
      this.saveWorld(revision, world, now);
      return state;
    });
  }

  apply(user, { action, payload, requestKey, method, path }, now = Date.now()) {
    return this.transaction(() => {
      const cached = this.selectIdempotency.get(Number(user.id), requestKey);
      if (cached) {
        if (cached.request_method !== method || cached.request_path !== path) {
          const error = new Error('幂等键已被其他操作使用');
          error.statusCode = 409;
          throw error;
        }
        return JSON.parse(String(cached.response_json));
      }

      const { revision, world } = this.loadWorld(now);
      const player = ensurePlayer(world, user, now);
      ensureWarehouse(player);
      migrateFacilityGroupWorld(world, now);
      const gameResult = action === 'upgradeWarehouse'
        ? (() => {
            processFacilityGroupWorld(world, now);
            return upgradeWarehouse(world.players[String(user.id)]);
          })()
        : applyFacilityGroupAction(world, user, action, payload, now);
      ensureWarehouse(world.players[String(user.id)]);
      const state = createVersionedClientState(world, Number(user.id), now);
      const response = normalizeJson({ result: gameResult, state });
      this.saveWorld(revision, world, now);
      this.insertIdempotency.run(
        Number(user.id),
        requestKey,
        method,
        path,
        JSON.stringify(response),
        now,
      );
      this.deleteExpiredIdempotency.run(now - IDEMPOTENCY_TTL_MS);
      return response;
    });
  }
}
