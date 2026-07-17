import { createHash, randomBytes } from 'node:crypto';
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
import {
  applyCollectibleAction,
  canResetCollectibles,
  collectibleOwnershipHistory,
  createCollectibleClientState,
  importCollectibles,
  listCollectiblesForAdmin,
  migrateCollectibleWorld,
  processCollectibleAuctions,
} from './collectibles.js';

const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;
const COLLECTIBLE_ACTIONS = new Set([
  'createCollectibleAuction',
  'placeCollectibleBid',
  'cancelCollectibleAuction',
]);

function normalizeJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeGiftCode(value) {
  return String(value || '').trim().toUpperCase().replace(/\s+/g, '');
}

function hashGiftCode(value) {
  return createHash('sha256').update(normalizeGiftCode(value)).digest('hex');
}

function generateGiftCode() {
  const token = randomBytes(6).toString('hex').toUpperCase();
  return `RIVER-${token.slice(0, 4)}-${token.slice(4, 8)}-${token.slice(8, 12)}`;
}

function createVersionedClientState(world, userId, now) {
  const player = world.players[String(userId)];
  ensureWarehouse(player);
  processCollectibleAuctions(world, now);
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
    ...createCollectibleClientState(world, userId, now),
    version: 14,
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
      CREATE TABLE IF NOT EXISTS economy_gift_codes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code_hash TEXT NOT NULL UNIQUE,
        reward_credits INTEGER NOT NULL CHECK (reward_credits > 0),
        max_redemptions INTEGER NOT NULL CHECK (max_redemptions > 0),
        redeemed_count INTEGER NOT NULL DEFAULT 0 CHECK (redeemed_count >= 0),
        starts_at INTEGER NOT NULL,
        expires_at INTEGER,
        enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
        created_by INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        note TEXT NOT NULL DEFAULT ''
      ) STRICT;
      CREATE TABLE IF NOT EXISTS economy_gift_redemptions (
        gift_code_id INTEGER NOT NULL REFERENCES economy_gift_codes(id),
        user_id INTEGER NOT NULL,
        reward_credits INTEGER NOT NULL,
        redeemed_at INTEGER NOT NULL,
        PRIMARY KEY (gift_code_id, user_id)
      ) STRICT;
      CREATE INDEX IF NOT EXISTS idx_economy_gift_redemptions_user
        ON economy_gift_redemptions(user_id, redeemed_at DESC);
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
    this.selectGiftCode = this.database.prepare(`
      SELECT id, reward_credits, max_redemptions, redeemed_count, starts_at, expires_at, enabled
      FROM economy_gift_codes WHERE code_hash = ?
    `);
    this.selectGiftRedemption = this.database.prepare(
      'SELECT 1 FROM economy_gift_redemptions WHERE gift_code_id = ? AND user_id = ?',
    );
    this.insertGiftRedemption = this.database.prepare(`
      INSERT INTO economy_gift_redemptions (gift_code_id, user_id, reward_credits, redeemed_at)
      VALUES (?, ?, ?, ?)
    `);
    this.incrementGiftRedemption = this.database.prepare(`
      UPDATE economy_gift_codes SET redeemed_count = redeemed_count + 1
      WHERE id = ? AND redeemed_count < max_redemptions
    `);
    this.insertGiftCode = this.database.prepare(`
      INSERT INTO economy_gift_codes (
        code_hash, reward_credits, max_redemptions, redeemed_count,
        starts_at, expires_at, enabled, created_by, created_at, note
      ) VALUES (?, ?, ?, 0, ?, ?, 1, ?, ?, ?)
    `);
    this.disableGiftCodeStatement = this.database.prepare(
      'UPDATE economy_gift_codes SET enabled = 0 WHERE id = ?',
    );
    this.listGiftCodesStatement = this.database.prepare(`
      SELECT id, reward_credits, max_redemptions, redeemed_count, starts_at, expires_at,
             enabled, created_by, created_at, note
      FROM economy_gift_codes ORDER BY id DESC LIMIT 200
    `);
    this.listGiftRedemptionsStatement = this.database.prepare(`
      SELECT user_id, reward_credits, redeemed_at
      FROM economy_gift_redemptions WHERE gift_code_id = ?
      ORDER BY redeemed_at DESC LIMIT 500
    `);
  }

  close() {
    this.database.close();
  }

  transaction(callback, { immediate = true } = {}) {
    this.database.exec(immediate ? 'BEGIN IMMEDIATE' : 'BEGIN');
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
      migrateCollectibleWorld(world, now);
      stripLegacyFacilityInstances(world);
      const stateJson = JSON.stringify(world);
      this.insertWorld.run(1, stateJson, now);
      return { revision: 1, stateJson, world };
    }
    const stateJson = String(row.state_json);
    const world = migrateWorld(JSON.parse(stateJson), now);
    stripPlayerLogs(world);
    migrateFacilityGroupWorld(world, now);
    migrateCollectibleWorld(world, now);
    for (const player of Object.values(world.players || {})) ensureWarehouse(player);
    return { revision: Number(row.revision), stateJson, world };
  }

  serializeWorld(world, now) {
    for (const player of Object.values(world.players || {})) ensureWarehouse(player);
    migrateFacilityGroupWorld(world, now);
    migrateCollectibleWorld(world, now);
    stripLegacyFacilityInstances(world);
    stripPlayerLogs(world);
    return JSON.stringify(world);
  }

  saveWorld(revision, world, now) {
    world.lastProcessedAt = now;
    this.updateWorld.run(revision + 1, this.serializeWorld(world, now), now);
    return revision + 1;
  }

  saveWorldIfChanged(revision, world, now, previousStateJson) {
    const candidate = this.serializeWorld(world, now);
    if (candidate === previousStateJson) return revision;
    world.lastProcessedAt = now;
    this.updateWorld.run(revision + 1, this.serializeWorld(world, now), now);
    return revision + 1;
  }

  getStateSnapshot(user, knownRevision, now = Date.now()) {
    return this.transaction(() => {
      const { revision, stateJson, world } = this.loadWorld(now);
      const player = ensurePlayer(world, user, now);
      ensureWarehouse(player);
      migrateFacilityGroupWorld(world, now);
      processFacilityGroupWorld(world, now);
      processCollectibleAuctions(world, now);
      ensureWarehouse(world.players[String(user.id)]);
      const nextRevision = this.saveWorldIfChanged(revision, world, now, stateJson);
      const unchanged = Number.isInteger(knownRevision) && knownRevision === nextRevision;
      if (unchanged) return { revision: nextRevision, unchanged: true };
      return {
        revision: nextRevision,
        unchanged: false,
        state: normalizeJson(createVersionedClientState(world, Number(user.id), now)),
      };
    }, { immediate: false });
  }

  getState(user, now = Date.now()) {
    return this.getStateSnapshot(user, undefined, now).state;
  }

  redeemGiftInTransaction(world, user, payload, now) {
    const code = normalizeGiftCode(payload.code);
    if (!/^[A-Z0-9-]{6,64}$/.test(code)) return { ok: false, message: '礼品兑换码格式无效' };
    const row = this.selectGiftCode.get(hashGiftCode(code));
    if (!row) return { ok: false, message: '礼品兑换码不存在' };
    if (!Number(row.enabled)) return { ok: false, message: '礼品兑换码已停用' };
    if (now < Number(row.starts_at)) return { ok: false, message: '礼品兑换码尚未生效' };
    if (row.expires_at !== null && now > Number(row.expires_at)) return { ok: false, message: '礼品兑换码已过期' };
    if (Number(row.redeemed_count) >= Number(row.max_redemptions)) return { ok: false, message: '礼品兑换码使用次数已满' };
    if (this.selectGiftRedemption.get(Number(row.id), Number(user.id))) {
      return { ok: false, message: '当前账号已经兑换过该礼品' };
    }
    const changed = this.incrementGiftRedemption.run(Number(row.id));
    if (Number(changed.changes || 0) !== 1) return { ok: false, message: '礼品兑换码使用次数已满' };
    this.insertGiftRedemption.run(Number(row.id), Number(user.id), Number(row.reward_credits), now);
    const player = ensurePlayer(world, user, now);
    player.credits += Number(row.reward_credits);
    player.stats ||= {};
    player.stats.giftIssued = Number(player.stats.giftIssued || 0) + Number(row.reward_credits);
    return { ok: true, message: `礼品兑换成功，获得 ¤${Number(row.reward_credits)}` };
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
      processCollectibleAuctions(world, now);
      let gameResult;
      if (action === 'upgradeWarehouse') {
        processFacilityGroupWorld(world, now);
        gameResult = upgradeWarehouse(world.players[String(user.id)]);
      } else if (action === 'redeemGift') {
        processFacilityGroupWorld(world, now);
        gameResult = this.redeemGiftInTransaction(world, user, payload, now);
      } else if (COLLECTIBLE_ACTIONS.has(action)) {
        processFacilityGroupWorld(world, now);
        gameResult = applyCollectibleAction(world, user, action, payload, now);
      } else if (action === 'resetPlayer') {
        const resetCheck = canResetCollectibles(world, Number(user.id), now);
        gameResult = resetCheck.ok
          ? applyFacilityGroupAction(world, user, action, payload, now)
          : resetCheck;
      } else {
        gameResult = applyFacilityGroupAction(world, user, action, payload, now);
      }
      processFacilityGroupWorld(world, now);
      processCollectibleAuctions(world, now);
      ensureWarehouse(world.players[String(user.id)]);
      const nextRevision = this.saveWorld(revision, world, now);
      const state = createVersionedClientState(world, Number(user.id), now);
      const response = normalizeJson({ result: gameResult, revision: nextRevision, state });
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

  requireAdmin(user) {
    if (user?.role !== 'admin') {
      const error = new Error('需要管理员权限');
      error.statusCode = 403;
      throw error;
    }
  }

  adminMutation(user, { requestKey, method, path }, callback, now = Date.now()) {
    this.requireAdmin(user);
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
      const response = normalizeJson(callback());
      this.insertIdempotency.run(Number(user.id), requestKey, method, path, JSON.stringify(response), now);
      this.deleteExpiredIdempotency.run(now - IDEMPOTENCY_TTL_MS);
      return response;
    });
  }

  getAdminSummary(user, now = Date.now()) {
    this.requireAdmin(user);
    return this.transaction(() => {
      const { revision, world } = this.loadWorld(now);
      processFacilityGroupWorld(world, now);
      processCollectibleAuctions(world, now);
      const openOrders = (world.orders || []).filter((order) => (
        order.remaining > 0 && (order.status === 'open' || order.status === 'partial')
      ));
      const summary = {
        playerCount: Object.keys(world.players || {}).length,
        openOrderCount: openOrders.length,
        commodityOrderCount: openOrders.filter((order) => order.assetKind !== 'facility').length,
        facilityOrderCount: openOrders.filter((order) => order.assetKind === 'facility').length,
        collectibleCount: world.collectibles.length,
        openAuctionCount: world.collectibleAuctions.filter((auction) => auction.status === 'open').length,
        worldVersion: Number(world.version || 0),
        revision,
        lastProcessedAt: Number(world.lastProcessedAt || now),
        apiStatus: 'ok',
      };
      this.saveWorld(revision, world, now);
      return summary;
    });
  }

  listGiftCodes(user) {
    this.requireAdmin(user);
    return this.listGiftCodesStatement.all().map((row) => ({
      ...row,
      enabled: Boolean(row.enabled),
    }));
  }

  createGiftCode(user, payload, requestMeta, now = Date.now()) {
    return this.adminMutation(user, requestMeta, () => {
      const code = normalizeGiftCode(payload.code || generateGiftCode());
      const rewardCredits = Math.floor(Number(payload.rewardCredits || 0));
      const maxRedemptions = Math.floor(Number(payload.maxRedemptions || 0));
      const startsAt = Number(payload.startsAt || now);
      const expiresAt = payload.expiresAt === null || payload.expiresAt === undefined || payload.expiresAt === ''
        ? null
        : Number(payload.expiresAt);
      const note = String(payload.note || '').trim().slice(0, 240);
      if (!/^[A-Z0-9-]{6,64}$/.test(code)) throw Object.assign(new Error('礼品码格式无效'), { statusCode: 400 });
      if (!Number.isInteger(rewardCredits) || rewardCredits < 1 || rewardCredits > 1_000_000) {
        throw Object.assign(new Error('奖励金额无效'), { statusCode: 400 });
      }
      if (!Number.isInteger(maxRedemptions) || maxRedemptions < 1 || maxRedemptions > 1_000_000) {
        throw Object.assign(new Error('最大兑换次数无效'), { statusCode: 400 });
      }
      if (!Number.isFinite(startsAt) || (expiresAt !== null && (!Number.isFinite(expiresAt) || expiresAt <= startsAt))) {
        throw Object.assign(new Error('礼品码有效期无效'), { statusCode: 400 });
      }
      try {
        const inserted = this.insertGiftCode.run(
          hashGiftCode(code), rewardCredits, maxRedemptions, startsAt, expiresAt,
          Number(user.id), now, note,
        );
        return { id: Number(inserted.lastInsertRowid), code, rewardCredits, maxRedemptions, startsAt, expiresAt, note };
      } catch (error) {
        if (String(error?.message || '').includes('UNIQUE')) {
          throw Object.assign(new Error('礼品码已存在'), { statusCode: 409 });
        }
        throw error;
      }
    }, now);
  }

  disableGiftCode(user, giftCodeId, requestMeta, now = Date.now()) {
    return this.adminMutation(user, requestMeta, () => {
      const id = Math.floor(Number(giftCodeId));
      if (!Number.isInteger(id) || id < 1) throw Object.assign(new Error('礼品码 ID 无效'), { statusCode: 400 });
      const changed = this.disableGiftCodeStatement.run(id);
      if (Number(changed.changes || 0) !== 1) throw Object.assign(new Error('礼品码不存在'), { statusCode: 404 });
      return { ok: true, id };
    }, now);
  }

  listGiftRedemptions(user, giftCodeId) {
    this.requireAdmin(user);
    const id = Math.floor(Number(giftCodeId));
    if (!Number.isInteger(id) || id < 1) throw Object.assign(new Error('礼品码 ID 无效'), { statusCode: 400 });
    return this.listGiftRedemptionsStatement.all(id);
  }

  listCollectibles(user, now = Date.now()) {
    this.requireAdmin(user);
    return this.transaction(() => {
      const { revision, world } = this.loadWorld(now);
      processFacilityGroupWorld(world, now);
      processCollectibleAuctions(world, now);
      const collectibles = listCollectiblesForAdmin(world, now);
      this.saveWorld(revision, world, now);
      return normalizeJson(collectibles);
    });
  }

  importCollectibles(user, payload, requestMeta, now = Date.now()) {
    return this.adminMutation(user, requestMeta, () => {
      const { revision, world } = this.loadWorld(now);
      ensurePlayer(world, user, now);
      processFacilityGroupWorld(world, now);
      processCollectibleAuctions(world, now);
      const imported = importCollectibles(world, user, payload, now);
      this.saveWorld(revision, world, now);
      return imported;
    }, now);
  }

  listCollectibleOwnership(user, collectibleId, now = Date.now()) {
    this.requireAdmin(user);
    return this.transaction(() => {
      const { revision, world } = this.loadWorld(now);
      processFacilityGroupWorld(world, now);
      processCollectibleAuctions(world, now);
      const history = collectibleOwnershipHistory(world, String(collectibleId || ''), now);
      this.saveWorld(revision, world, now);
      return normalizeJson(history);
    });
  }
}
