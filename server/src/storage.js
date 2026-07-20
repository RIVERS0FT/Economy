import { createHash, randomBytes } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
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
  stripLegacyFacilityInstances,
} from './facility-groups.js';
import { createWarehouseSummary, ensureWarehouse, upgradeWarehouse } from './warehouse.js';
import {
  applyCollectibleAction,
  collectibleOwnershipHistory,
  createCollectibleClientState,
  importCollectibles,
  listCollectiblesForAdmin,
  migrateCollectibleWorld,
} from './collectibles.js';
import { ensureGemState } from './invitations.js';
import { createGemShopSummary, exchangeGems } from './gem-shop.js';
import { DEFAULT_QQ_GROUP_URL, normalizeQqGroupUrl } from './community-link.js';
import { createLeaderboardSnapshot, processLeaderboardWorld } from './leaderboards.js';

const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;
const WORLD_PROCESS_INTERVAL_MS = 1_000;
const COLLECTIBLE_ACTIONS = new Set([
  'createAuction',
  'placeAuctionBid',
  'cancelAuction',
  'createCollectibleAuction',
  'placeCollectibleBid',
  'cancelCollectibleAuction',
]);
const ECONOMIC_ACTIVITY_ACTIONS = new Set([
  'work', 'buildFacility', 'startFacility', 'pauseFacility', 'setFacilityRecipe',
  'collectFacility', 'placeOrder', 'cancelOrder', 'listFacility',
  'cancelFacilityListing', 'buyFacility', 'upgradeWarehouse', 'redeemGift',
  'exchangeGems', 'createAuction', 'placeAuctionBid', 'cancelAuction',
  'createCollectibleAuction', 'placeCollectibleBid', 'cancelCollectibleAuction',
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
  ensureGemState(player);
  const state = createFacilityGroupClientState(world, userId, now);
  const {
    trades: _serverTrades,
    ledger: _serverLedger,
    assetEvents: _serverAssetEvents,
    ...authoritativeState
  } = state;
  return {
    ...authoritativeState,
    stats: {
      ...authoritativeState.stats,
      leaderboards: { ...createLeaderboardSnapshot(world, userId, now), generatedAt: now },
    },
    gems: player.gems,
    ...createWarehouseSummary(world, player),
    ...createCollectibleClientState(world, userId, now),
    version: 15,
  };
}

export class EconomyStore {
  constructor(databasePath, { scheduledProcessing = databasePath !== ':memory:' } = {}) {
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
      CREATE TABLE IF NOT EXISTS economy_gem_shop_exchanges (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        request_key TEXT NOT NULL UNIQUE,
        gems_spent INTEGER NOT NULL CHECK (gems_spent > 0),
        credits_received INTEGER NOT NULL CHECK (credits_received > 0),
        created_at INTEGER NOT NULL
      ) STRICT;
      CREATE INDEX IF NOT EXISTS idx_economy_gem_shop_exchanges_user
        ON economy_gem_shop_exchanges(user_id, created_at DESC);
      CREATE TABLE IF NOT EXISTS economy_settings (
        setting_key TEXT PRIMARY KEY,
        setting_value TEXT NOT NULL,
        updated_at INTEGER NOT NULL,
        updated_by INTEGER NOT NULL
      ) STRICT;
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
    this.insertGemShopExchange = this.database.prepare(`
      INSERT INTO economy_gem_shop_exchanges (
        user_id, request_key, gems_spent, credits_received, created_at
      ) VALUES (?, ?, ?, ?, ?)
    `);
    this.sumGemShopExchanges = this.database.prepare(`
      SELECT COALESCE(SUM(gems_spent), 0) AS total_gems_spent,
             COALESCE(SUM(credits_received), 0) AS total_credits_received
      FROM economy_gem_shop_exchanges WHERE user_id = ?
    `);
    this.listGemShopExchanges = this.database.prepare(`
      SELECT gems_spent, credits_received, created_at
      FROM economy_gem_shop_exchanges
      WHERE user_id = ? ORDER BY created_at DESC LIMIT 20
    `);
    this.selectSetting = this.database.prepare(
      'SELECT setting_value, updated_at FROM economy_settings WHERE setting_key = ?',
    );
    this.upsertSetting = this.database.prepare(`
      INSERT INTO economy_settings (setting_key, setting_value, updated_at, updated_by)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(setting_key) DO UPDATE SET
        setting_value = excluded.setting_value,
        updated_at = excluded.updated_at,
        updated_by = excluded.updated_by
    `);
    this.worldCache = null;
    this.nextWorldProcessingAt = 0;
    this.scheduledProcessing = Boolean(scheduledProcessing);
    this.processingTimer = this.scheduledProcessing
      ? setInterval(() => {
        try {
          this.processScheduledWorld();
        } catch (error) {
          console.error('Economy scheduled world processing failed', error);
        }
      }, WORLD_PROCESS_INTERVAL_MS)
      : null;
    this.processingTimer?.unref();
  }

  close() {
    if (this.processingTimer) clearInterval(this.processingTimer);
    this.processingTimer = null;
    this.database.close();
  }

  transaction(callback, { immediate = true } = {}) {
    const cacheBefore = this.worldCache;
    const processingDeadlineBefore = this.nextWorldProcessingAt;
    this.database.exec(immediate ? 'BEGIN IMMEDIATE' : 'BEGIN');
    try {
      const value = callback();
      this.database.exec('COMMIT');
      return value;
    } catch (error) {
      this.worldCache = cacheBefore;
      this.nextWorldProcessingAt = processingDeadlineBefore;
      this.database.exec('ROLLBACK');
      throw error;
    }
  }

  prepareWorldForStorage(world, now) {
    for (const player of Object.values(world.players || {})) {
      ensureWarehouse(player);
      ensureGemState(player);
    }
    migrateFacilityGroupWorld(world, now);
    migrateCollectibleWorld(world, now);
    stripLegacyFacilityInstances(world);
    stripPlayerLogs(world);
    world.version = 13;
    return world;
  }

  cacheWorld(revision, stateJson, world, needsPersistence = false) {
    this.worldCache = {
      revision: Number(revision),
      stateJson,
      world: structuredClone(world),
      needsPersistence: Boolean(needsPersistence),
    };
  }

  loadWorld(now) {
    if (this.worldCache) {
      return {
        revision: this.worldCache.revision,
        stateJson: this.worldCache.stateJson,
        world: structuredClone(this.worldCache.world),
      };
    }

    const row = this.selectWorld.get();
    if (!row) {
      const world = this.prepareWorldForStorage(stripPlayerLogs(createWorld(now)), now);
      const stateJson = JSON.stringify(world);
      this.insertWorld.run(1, stateJson, now);
      this.cacheWorld(1, stateJson, world);
      return { revision: 1, stateJson, world: structuredClone(world) };
    }

    const persistedStateJson = String(row.state_json);
    const world = this.prepareWorldForStorage(migrateWorld(JSON.parse(persistedStateJson), now), now);
    const stateJson = JSON.stringify(world);
    this.cacheWorld(Number(row.revision), stateJson, world, stateJson !== persistedStateJson);
    return { revision: Number(row.revision), stateJson, world: structuredClone(world) };
  }

  serializeWorld(world, now) {
    return JSON.stringify(this.prepareWorldForStorage(world, now));
  }

  saveWorld(revision, world, now) {
    world.lastProcessedAt = now;
    const stateJson = this.serializeWorld(world, now);
    const nextRevision = revision + 1;
    this.updateWorld.run(nextRevision, stateJson, now);
    this.cacheWorld(nextRevision, stateJson, world);
    this.nextWorldProcessingAt = now + WORLD_PROCESS_INTERVAL_MS;
    return nextRevision;
  }

  saveWorldIfChanged(revision, world, now, _previousStateJson) {
    this.prepareWorldForStorage(world, now);
    const cached = this.worldCache;
    const unchanged = cached
      && cached.revision === revision
      && !cached.needsPersistence
      && isDeepStrictEqual(world, cached.world);
    if (unchanged) return revision;

    world.lastProcessedAt = now;
    const stateJson = JSON.stringify(world);
    const nextRevision = revision + 1;
    this.updateWorld.run(nextRevision, stateJson, now);
    this.cacheWorld(nextRevision, stateJson, world);
    return nextRevision;
  }

  processWorldIfDue(world, now, _currentUserId, { force = false } = {}) {
    if (!force && now < this.nextWorldProcessingAt) return false;
    processLeaderboardWorld(world, now);
    this.nextWorldProcessingAt = now + WORLD_PROCESS_INTERVAL_MS;
    return true;
  }

  processScheduledWorld(now = Date.now()) {
    if (!this.scheduledProcessing) return null;
    return this.transaction(() => {
      const { revision, stateJson, world } = this.loadWorld(now);
      this.processWorldIfDue(world, now, undefined, { force: true });
      return this.saveWorldIfChanged(revision, world, now, stateJson);
    });
  }

  getStateSnapshot(user, knownRevision, now = Date.now()) {
    const normalizedKnownRevision = Number.isInteger(knownRevision) ? knownRevision : undefined;
    if (
      normalizedKnownRevision !== undefined
      && this.worldCache
      && normalizedKnownRevision === this.worldCache.revision
      && (this.scheduledProcessing || now < this.nextWorldProcessingAt)
    ) {
      return { revision: normalizedKnownRevision, unchanged: true };
    }

    return this.transaction(() => {
      const { revision, stateJson, world } = this.loadWorld(now);
      const playerId = String(user.id);
      const playerWasPresent = Boolean(world.players?.[playerId]);
      const player = ensurePlayer(world, user, now);
      ensureWarehouse(player);
      ensureGemState(player);
      if (!this.scheduledProcessing || !playerWasPresent) {
        this.processWorldIfDue(world, now, Number(user.id), { force: !playerWasPresent });
      }
      ensureWarehouse(world.players[playerId]);
      ensureGemState(world.players[playerId]);
      const nextRevision = this.saveWorldIfChanged(revision, world, now, stateJson);
      const unchanged = normalizedKnownRevision !== undefined && normalizedKnownRevision === nextRevision;
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

  getGemShopSummary(user, now = Date.now()) {
    return this.transaction(() => {
      const { revision, stateJson, world } = this.loadWorld(now);
      const playerId = String(user.id);
      const playerWasPresent = Boolean(world.players?.[playerId]);
      const player = ensurePlayer(world, user, now);
      ensureGemState(player);
      if (!this.scheduledProcessing || !playerWasPresent) {
        this.processWorldIfDue(world, now, Number(user.id), { force: !playerWasPresent });
      }
      this.saveWorldIfChanged(revision, world, now, stateJson);
      return createGemShopSummary(
        player,
        this.sumGemShopExchanges.get(Number(user.id)),
        this.listGemShopExchanges.all(Number(user.id)),
      );
    }, { immediate: false });
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
      ensureGemState(player);
      this.processWorldIfDue(world, now, Number(user.id), { force: true });
      let gameResult;
      if (action === 'upgradeWarehouse') {
        gameResult = upgradeWarehouse(world.players[String(user.id)]);
      } else if (action === 'redeemGift') {
        gameResult = this.redeemGiftInTransaction(world, user, payload, now);
      } else if (action === 'exchangeGems') {
        gameResult = exchangeGems(player, payload.gems, now);
        if (gameResult.ok) {
          this.insertGemShopExchange.run(
            Number(user.id),
            requestKey,
            gameResult.gemsSpent,
            gameResult.creditsReceived,
            now,
          );
        }
      } else if (COLLECTIBLE_ACTIONS.has(action)) {
        gameResult = applyCollectibleAction(world, user, action, payload, now);
      } else {
        gameResult = applyFacilityGroupAction(world, user, action, payload, now);
      }
      if (gameResult?.ok && ECONOMIC_ACTIVITY_ACTIONS.has(action)) {
        const activePlayer = world.players[String(user.id)];
        if (activePlayer) activePlayer.lastEconomicActivityAt = now;
      }
      this.processWorldIfDue(world, now, Number(user.id), { force: true });
      ensureWarehouse(world.players[String(user.id)]);
      ensureGemState(world.players[String(user.id)]);
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

  getCommunityLink() {
    const row = this.selectSetting.get('qq_group_url');
    return {
      qqGroupUrl: row ? String(row.setting_value) : DEFAULT_QQ_GROUP_URL,
      updatedAt: row ? Number(row.updated_at) : null,
    };
  }

  updateCommunityLink(user, payload, requestMeta, now = Date.now()) {
    return this.adminMutation(user, requestMeta, () => {
      const qqGroupUrl = normalizeQqGroupUrl(payload?.qqGroupUrl);
      this.upsertSetting.run('qq_group_url', qqGroupUrl, now, Number(user.id));
      return { qqGroupUrl, updatedAt: now };
    }, now);
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
      const { revision, stateJson, world } = this.loadWorld(now);
      this.processWorldIfDue(world, now, user.id, { force: true });
      const openOrders = (world.orders || []).filter((order) => (
        order.remaining > 0 && (order.status === 'open' || order.status === 'partial')
      ));
      const nextRevision = this.saveWorldIfChanged(revision, world, now, stateJson);
      return {
        playerCount: Object.keys(world.players || {}).length,
        openOrderCount: openOrders.length,
        commodityOrderCount: openOrders.filter((order) => order.assetKind !== 'facility').length,
        facilityOrderCount: openOrders.filter((order) => order.assetKind === 'facility').length,
        collectibleCount: world.collectibles.length,
        openAuctionCount: world.collectibleAuctions.filter((auction) => auction.status === 'open').length,
        worldVersion: Number(world.version || 0),
        revision: nextRevision,
        lastProcessedAt: Number(world.lastProcessedAt || now),
        apiStatus: 'ok',
        demandGroups: Object.fromEntries(Object.entries(world.demandGroups || {}).map(([groupId, group]) => [groupId, {
          lastBudget: Number(group.lastBudget || 0),
          lastTargetBudget: Number(group.lastTargetBudget || 0),
          lastPlayerScaleBudget: Number(group.lastPlayerScaleBudget || 0),
          lastInventoryBoost: Number(group.lastInventoryBoost || 0),
          lastActivePlayerCount: Number(group.lastActivePlayerCount || 0),
          lastStockValue: Number(group.lastStockValue || 0),
          lastCommitted: Number(group.lastCommitted || 0),
          satisfaction: Number(group.satisfaction || 0),
        }])),
      };
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
      const { revision, stateJson, world } = this.loadWorld(now);
      this.processWorldIfDue(world, now, undefined, { force: true });
      const collectibles = listCollectiblesForAdmin(world, now);
      this.saveWorldIfChanged(revision, world, now, stateJson);
      return normalizeJson(collectibles);
    });
  }

  importCollectibles(user, payload, requestMeta, now = Date.now()) {
    return this.adminMutation(user, requestMeta, () => {
      const { revision, world } = this.loadWorld(now);
      ensurePlayer(world, user, now);
      this.processWorldIfDue(world, now, Number(user.id), { force: true });
      const imported = importCollectibles(world, user, payload, now);
      this.saveWorld(revision, world, now);
      return imported;
    }, now);
  }

  listCollectibleOwnership(user, collectibleId, now = Date.now()) {
    this.requireAdmin(user);
    return this.transaction(() => {
      const { revision, stateJson, world } = this.loadWorld(now);
      this.processWorldIfDue(world, now, undefined, { force: true });
      const history = collectibleOwnershipHistory(world, String(collectibleId || ''), now);
      this.saveWorldIfChanged(revision, world, now, stateJson);
      return normalizeJson(history);
    });
  }
}
