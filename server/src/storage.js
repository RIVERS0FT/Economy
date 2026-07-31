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
  applyAssetAuctionAction,
  createAssetAuctionClientState,
  migrateAssetAuctionWorld,
  createAuctionBidHistoryFallback,
} from './asset-auctions.js';
import { ensureGemState } from './invitations.js';
import {
  createDailyCheckInSummary,
  dailyCheckInPeriodFor,
  dailyCheckInRewardFor,
  processDailyCheckInWorld,
} from './daily-check-in.js';
import { GemEconomyStore } from './gem-economy-store.js';
import { DEFAULT_QQ_GROUP_URL, normalizeQqGroupUrl } from './community-link.js';
import {
  applyPopulationPolicy,
  createPopulationAdminSummary,
  resetPopulationPolicy,
  topUpPopulationByPolicy,
} from './population-admin-control.js';
import { createLeaderboardSnapshot, processLeaderboardWorld } from './leaderboards.js';
import {
  applyBankAction,
  createBankClientState,
  ensureBankWorld,
  ensurePlayerBankAccount,
  migrateBankWorld,
  processBankWorld,
} from './banking.js';
import {
  activateWeeklyCashSettlement,
  collectPlayerWeeklyCashSettlement,
  ensurePlayerWeeklyCashSettlement,
  ensureWeeklyCashSettlementWorld,
  playerNeedsWeeklyLoginSettlement,
  processWeeklyCashSettlementWorld,
  settlePlayerWeeklyCashOnLogin,
} from './weekly-cash-settlement.js';
import { createWorldDeadlinePlan } from './world-deadline-planner.js';
import { CURRENT_CLIENT_STATE_VERSION } from '../shared/economy-state-version.js';
import { normalizePlayerMoneyPayload, normalizeWorldMoneyPrecision } from './money.js';
import {
  configureAuctionAuditStore,
  flushAuctionAuditEvents,
  listRecentAuctionBidEvents,
} from './auction-audit-store.js';

const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;
const WORLD_PROCESS_INTERVAL_MS = 1_000;
const AUCTION_ACTIONS = new Set(['createAuction', 'placeAuctionBid', 'cancelAuction']);
const BANK_ACTIONS = new Set(['bankDeposit', 'bankWithdraw', 'bankBorrow', 'bankRepay', 'bankSetAutoRepay']);
const ECONOMIC_ACTIVITY_ACTIONS = new Set([
  'work', 'buildFacility', 'startFacility', 'pauseFacility', 'setFacilityRecipe',
  'collectFacility', 'placeOrder', 'cancelOrder', 'listFacility',
  'cancelFacilityListing', 'buyFacility', 'upgradeWarehouse', 'redeemGift',
  'exchangeGems', 'accelerateFacilityConstruction', 'createAuction', 'placeAuctionBid', 'cancelAuction',
  'bankDeposit', 'bankWithdraw', 'bankBorrow', 'bankRepay', 'bankSetAutoRepay',
]);

function normalizeJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function createActionAcknowledgement(result, revision) {
  return normalizeJson({
    result: {
      ok: result?.ok === true,
      message: String(result?.message || ''),
    },
    revision: Number(revision),
  });
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

function migrateGemLedgerSchema(database) {
  const row = database.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'economy_gem_ledger'").get();
  const sql = String(row?.sql || '');
  if (!sql || (sql.includes('source_key') && sql.includes('weekly_full_attendance'))) return;
  database.exec('PRAGMA foreign_keys = OFF');
  try {
    database.exec(`
      BEGIN IMMEDIATE;
      DROP TABLE IF EXISTS economy_gem_ledger_v2;
      CREATE TABLE economy_gem_ledger_v2 (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        amount INTEGER NOT NULL,
        balance_after INTEGER NOT NULL CHECK (balance_after >= 0),
        category TEXT NOT NULL CHECK (category IN ('share_link_reward', 'invite_code_reward', 'daily_check_in', 'weekly_full_attendance', 'leaderboard_reward', 'admin_adjustment')),
        invitation_id INTEGER,
        description TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        source_key TEXT UNIQUE
      ) STRICT;
      INSERT INTO economy_gem_ledger_v2 (
        id, user_id, amount, balance_after, category, invitation_id, description, created_at, source_key
      )
      SELECT id, user_id, amount, balance_after, category, invitation_id, description, created_at, NULL
      FROM economy_gem_ledger;
      DROP TABLE economy_gem_ledger;
      ALTER TABLE economy_gem_ledger_v2 RENAME TO economy_gem_ledger;
      COMMIT;
    `);
  } catch (error) {
    try { database.exec('ROLLBACK'); } catch { /* no active transaction */ }
    throw error;
  } finally {
    database.exec('PRAGMA foreign_keys = ON');
  }
}

function createVersionedClientState(world, userId, now, checkIn) {
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
    checkIn,
    ...createWarehouseSummary(world, player),
    ...createAssetAuctionClientState(world, userId, now),
    ...createBankClientState(world, player, now),
    version: CURRENT_CLIENT_STATE_VERSION,
  };
}

export class EconomyStore {
  constructor(databasePath, {
    scheduledProcessing = databasePath !== ':memory:',
    nowProvider = Date.now,
    setTimeoutFn = setTimeout,
    clearTimeoutFn = clearTimeout,
    schedulerMaxDelayMs = 2_147_000_000,
  } = {}) {
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
      CREATE TABLE IF NOT EXISTS economy_daily_check_ins (
        user_id INTEGER NOT NULL,
        date_key TEXT NOT NULL,
        week_key TEXT NOT NULL,
        daily_reward_gems INTEGER NOT NULL CHECK (daily_reward_gems = 1),
        weekly_bonus_gems INTEGER NOT NULL DEFAULT 0 CHECK (weekly_bonus_gems IN (0, 5)),
        claimed_at INTEGER NOT NULL,
        request_key TEXT NOT NULL UNIQUE,
        balance_after INTEGER NOT NULL CHECK (balance_after >= 0),
        PRIMARY KEY (user_id, date_key)
      ) STRICT;
      CREATE INDEX IF NOT EXISTS idx_economy_daily_check_ins_week
        ON economy_daily_check_ins(user_id, week_key, date_key);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_economy_daily_check_ins_bonus
        ON economy_daily_check_ins(user_id, week_key) WHERE weekly_bonus_gems > 0;
      CREATE TABLE IF NOT EXISTS economy_gem_ledger (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        amount INTEGER NOT NULL,
        balance_after INTEGER NOT NULL CHECK (balance_after >= 0),
        category TEXT NOT NULL CHECK (category IN ('share_link_reward', 'invite_code_reward', 'daily_check_in', 'weekly_full_attendance', 'leaderboard_reward', 'admin_adjustment')),
        invitation_id INTEGER,
        description TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        source_key TEXT UNIQUE
      ) STRICT;
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
      CREATE TABLE IF NOT EXISTS economy_population_policy_audit (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        admin_user_id INTEGER NOT NULL,
        action_type TEXT NOT NULL,
        target_model TEXT NOT NULL,
        before_policy_json TEXT NOT NULL,
        after_policy_json TEXT NOT NULL,
        issued_credits INTEGER NOT NULL DEFAULT 0 CHECK (issued_credits >= 0),
        issued_by_model_json TEXT NOT NULL,
        revision_before INTEGER NOT NULL,
        revision_after INTEGER NOT NULL,
        request_key TEXT NOT NULL UNIQUE,
        note TEXT NOT NULL,
        created_at INTEGER NOT NULL
      ) STRICT;
      CREATE INDEX IF NOT EXISTS idx_economy_population_policy_audit_created
        ON economy_population_policy_audit(id DESC);
      CREATE TABLE IF NOT EXISTS economy_settings (
        setting_key TEXT PRIMARY KEY,
        setting_value TEXT NOT NULL,
        updated_at INTEGER NOT NULL,
        updated_by INTEGER NOT NULL
      ) STRICT;
    `);
    migrateGemLedgerSchema(this.database);
    configureAuctionAuditStore(this);
    this.gemEconomy = new GemEconomyStore(this.database);
    this.database.exec(`
      CREATE INDEX IF NOT EXISTS idx_economy_gem_ledger_user
        ON economy_gem_ledger(user_id, created_at DESC);
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
    this.selectDailyCheckInByDate = this.database.prepare(`
      SELECT * FROM economy_daily_check_ins WHERE user_id = ? AND date_key = ?
    `);
    this.selectDailyCheckInsForWeek = this.database.prepare(`
      SELECT * FROM economy_daily_check_ins
      WHERE user_id = ? AND week_key = ? ORDER BY date_key
    `);
    this.insertDailyCheckIn = this.database.prepare(`
      INSERT INTO economy_daily_check_ins (
        user_id, date_key, week_key, daily_reward_gems, weekly_bonus_gems,
        claimed_at, request_key, balance_after
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    this.insertGemLedgerEvent = this.database.prepare(`
      INSERT INTO economy_gem_ledger (
        user_id, amount, balance_after, category, invitation_id, description, created_at, source_key
      ) VALUES (?, ?, ?, ?, NULL, ?, ?, ?)
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
    this.insertPopulationPolicyAudit = this.database.prepare(`
      INSERT INTO economy_population_policy_audit (
        admin_user_id, action_type, target_model, before_policy_json, after_policy_json,
        issued_credits, issued_by_model_json, revision_before, revision_after,
        request_key, note, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
  this.nowProvider = nowProvider;
  this.setTimeoutFn = setTimeoutFn;
  this.clearTimeoutFn = clearTimeoutFn;
  this.schedulerMaxDelayMs = Math.max(1_000, Number(schedulerMaxDelayMs) || 2_147_000_000);
  this.processingTimer = null;
  this.schedulerGeneration = 0;
  this.schedulerNotBefore = 0;
  this.schedulerClosed = false;
  this.schedulerDiagnostics = {
    schedules: 0,
    wakeups: 0,
    processedWakeups: 0,
    staleWakeups: 0,
    transactions: 0,
    lastLagMs: 0,
    nextDueAt: null,
  };
  if (this.scheduledProcessing) this.scheduleWorldProcessing();
}

  clearWorldProcessingTimer() {
    if (this.processingTimer) this.clearTimeoutFn(this.processingTimer);
    this.processingTimer = null;
  }

  scheduleWorldProcessing() {
    if (!this.scheduledProcessing || this.schedulerClosed) return null;
    this.clearWorldProcessingTimer();
    const now = Math.max(0, Number(this.nowProvider()) || 0);
    const planned = this.worldCache
      ? createWorldDeadlinePlan(this.worldCache.world, now).nextDueAt
      : now;
    if (planned === null) {
      this.nextWorldProcessingAt = Number.POSITIVE_INFINITY;
      this.schedulerDiagnostics.nextDueAt = null;
      return null;
    }
    const dueAt = Math.max(Number(planned), Number(this.schedulerNotBefore || 0));
    this.nextWorldProcessingAt = dueAt;
    this.schedulerDiagnostics.nextDueAt = dueAt;
    this.schedulerDiagnostics.schedules += 1;
    const generation = ++this.schedulerGeneration;
    const delay = Math.min(this.schedulerMaxDelayMs, Math.max(0, dueAt - now));
    this.processingTimer = this.setTimeoutFn(() => this.handleScheduledWorldWake(generation), delay);
    this.processingTimer?.unref?.();
    return dueAt;
  }

  handleScheduledWorldWake(generation) {
    if (this.schedulerClosed || generation !== this.schedulerGeneration) {
      this.schedulerDiagnostics.staleWakeups += 1;
      return;
    }
    this.processingTimer = null;
    const now = Math.max(0, Number(this.nowProvider()) || 0);
    this.schedulerDiagnostics.wakeups += 1;
    if (now < this.nextWorldProcessingAt) {
      this.schedulerDiagnostics.staleWakeups += 1;
      this.scheduleWorldProcessing();
      return;
    }
    this.schedulerDiagnostics.processedWakeups += 1;
    this.schedulerDiagnostics.lastLagMs = Math.max(0, now - this.nextWorldProcessingAt);
    try {
      this.processScheduledWorld(now);
    } catch (error) {
      this.schedulerNotBefore = Math.max(this.schedulerNotBefore, now + WORLD_PROCESS_INTERVAL_MS);
      console.error('Economy scheduled world processing failed', error);
    } finally {
      if (!this.processingTimer && !this.schedulerClosed) this.scheduleWorldProcessing();
    }
  }

  getSchedulerDiagnostics() {
    return { ...this.schedulerDiagnostics };
  }

  resetSchedulerDiagnostics() {
    this.schedulerDiagnostics = {
      schedules: 0,
      wakeups: 0,
      processedWakeups: 0,
      staleWakeups: 0,
      transactions: 0,
      lastLagMs: 0,
      nextDueAt: Number.isFinite(this.nextWorldProcessingAt) ? this.nextWorldProcessingAt : null,
    };
  }

  close() {
  this.schedulerClosed = true;
  this.schedulerGeneration += 1;
  this.clearWorldProcessingTimer();
  this.database.close();
}

  transaction(callback, { immediate = true } = {}) {
  const cacheBefore = this.worldCache;
  const processingDeadlineBefore = this.nextWorldProcessingAt;
  const schedulerNotBeforeBefore = this.schedulerNotBefore;
  this.database.exec(immediate ? 'BEGIN IMMEDIATE' : 'BEGIN');
  try {
    const value = callback();
    this.database.exec('COMMIT');
    if (this.scheduledProcessing && this.worldCache !== cacheBefore) this.scheduleWorldProcessing();
    return value;
  } catch (error) {
    this.worldCache = cacheBefore;
    this.nextWorldProcessingAt = processingDeadlineBefore;
    this.schedulerNotBefore = schedulerNotBeforeBefore;
    this.database.exec('ROLLBACK');
    throw error;
  }
}

  prepareWorldForStorage(world, now) {
    processDailyCheckInWorld(world, now);
    migrateBankWorld(world, now);
    ensureWeeklyCashSettlementWorld(world, now);
    for (const player of Object.values(world.players || {})) {
      ensureWarehouse(player);
      ensureGemState(player);
      ensurePlayerBankAccount(player, now);
      ensurePlayerWeeklyCashSettlement(player, now);
    }
    migrateAssetAuctionWorld(world, now);
    migrateFacilityGroupWorld(world, now);
    stripLegacyFacilityInstances(world);
    stripPlayerLogs(world);
    normalizeWorldMoneyPrecision(world);
    world.version = 21;
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
    flushAuctionAuditEvents(this, world, revision, nextRevision);
    this.cacheWorld(nextRevision, stateJson, world);
    if (!this.scheduledProcessing) this.nextWorldProcessingAt = now + WORLD_PROCESS_INTERVAL_MS;
    return nextRevision;
  }

  saveWorldIfChanged(revision, world, now, _previousStateJson) {
    this.prepareWorldForStorage(world, now);
    const cached = this.worldCache;
    const unchanged = cached
      && cached.revision === revision
      && !cached.needsPersistence
      && isDeepStrictEqual(world, cached.world);
    if (unchanged) {
      flushAuctionAuditEvents(this, world, revision, revision);
      return revision;
    }

    world.lastProcessedAt = now;
    const stateJson = JSON.stringify(world);
    const nextRevision = revision + 1;
    this.updateWorld.run(nextRevision, stateJson, now);
    flushAuctionAuditEvents(this, world, revision, nextRevision);
    this.cacheWorld(nextRevision, stateJson, world);
    return nextRevision;
  }

  processWorldIfDue(world, now, _currentUserId, { force = false } = {}) {
  if (!force && now < this.nextWorldProcessingAt) return false;
  processLeaderboardWorld(world, now, {
    onGemReward: (reward) => this.recordGemLedgerEvent(reward),
  });
  processBankWorld(world, now);
  processWeeklyCashSettlementWorld(world, now);
  if (this.scheduledProcessing) {
    this.schedulerNotBefore = Math.max(this.schedulerNotBefore, now + WORLD_PROCESS_INTERVAL_MS);
  } else {
    this.nextWorldProcessingAt = now + WORLD_PROCESS_INTERVAL_MS;
  }
  return true;
}

  processScheduledWorld(now = this.nowProvider()) {
    if (!this.scheduledProcessing) return null;
    this.schedulerDiagnostics.transactions += 1;
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
      && !playerNeedsWeeklyLoginSettlement(this.worldCache.world.players?.[String(user.id)], now)
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
      ensureBankWorld(world, now);
      ensurePlayerBankAccount(player, now);
      if (!this.scheduledProcessing || !playerWasPresent) {
        this.processWorldIfDue(world, now, Number(user.id), { force: !playerWasPresent });
      }
      settlePlayerWeeklyCashOnLogin(world, world.players[playerId], now);
      ensureWarehouse(world.players[playerId]);
      ensureGemState(world.players[playerId]);
      ensurePlayerBankAccount(world.players[playerId], now);
      ensurePlayerWeeklyCashSettlement(world.players[playerId], now);
      const nextRevision = this.saveWorldIfChanged(revision, world, now, stateJson);
      const unchanged = normalizedKnownRevision !== undefined && normalizedKnownRevision === nextRevision;
      if (unchanged) return { revision: nextRevision, unchanged: true };
      return {
        revision: nextRevision,
        unchanged: false,
        state: normalizeJson(createVersionedClientState(
          world,
          Number(user.id),
          now,
          this.dailyCheckInSummaryFor(world.players[playerId], now),
        )),
      };
    }, { immediate: false });
  }

  getState(user, now = Date.now()) {
    return this.getStateSnapshot(user, undefined, now).state;
  }

  getAuctionBidHistory(user, auctionId, now = Date.now()) {
    return this.transaction(() => {
      const { world } = this.loadWorld(now);
      const auction = (world.assetAuctions || []).find((entry) => entry.id === String(auctionId || ''));
      if (!auction) {
        const error = new Error('拍卖不存在');
        error.statusCode = 404;
        throw error;
      }
      const audited = listRecentAuctionBidEvents(this, auction.id, 10);
      const bids = audited.length > 0
        ? audited.map((bid) => ({
          bidderLabel: bid.bidderLabel,
          amount: bid.amount,
          createdAt: bid.createdAt,
          isMine: Number(bid.actorUserId) === Number(user.id),
        }))
        : createAuctionBidHistoryFallback(auction, Number(user.id));
      return {
        auctionId: auction.id,
        bidCount: Math.max(0, Number(auction.bidCount || 0)),
        latestBidAt: auction.latestBidAt ? Number(auction.latestBidAt) : null,
        bids: bids.slice(0, 10),
      };
    }, { immediate: false });
  }

  dailyCheckInSummaryFor(player, now = Date.now()) {
    const period = dailyCheckInPeriodFor(now);
    return createDailyCheckInSummary(
      player,
      this.selectDailyCheckInsForWeek.all(Number(player.userId), period.weekKey),
      now,
    );
  }

  recordGemLedgerEvent({ userId, amount, balanceAfter, category, description, sourceKey, createdAt }) {
    this.insertGemLedgerEvent.run(
      Number(userId),
      Number(amount),
      Number(balanceAfter),
      String(category),
      String(description),
      Number(createdAt),
      String(sourceKey),
    );
  }

  checkInInTransaction(player, requestKey, now = Date.now()) {
    const period = dailyCheckInPeriodFor(now);
    if (this.selectDailyCheckInByDate.get(Number(player.userId), period.todayKey)) {
      return { ok: false, message: '今日已签到，请明天再来' };
    }
    const rows = this.selectDailyCheckInsForWeek.all(Number(player.userId), period.weekKey);
    const reward = dailyCheckInRewardFor(player, rows, now);
    if (reward.alreadyClaimed) return { ok: false, message: '今日已签到，请明天再来' };

    const balanceBefore = Number(player.gems || 0);
    const dailyBalance = balanceBefore + reward.dailyGems;
    const balanceAfter = balanceBefore + reward.totalGems;
    player.gems = balanceAfter;
    player.stats ||= {};
    player.stats.dailyCheckInGemsIssued = Number(player.stats.dailyCheckInGemsIssued || 0) + reward.dailyGems;
    player.stats.weeklyFullAttendanceGemsIssued = Number(player.stats.weeklyFullAttendanceGemsIssued || 0) + reward.weeklyBonusGems;

    this.insertDailyCheckIn.run(
      Number(player.userId),
      period.todayKey,
      period.weekKey,
      reward.dailyGems,
      reward.weeklyBonusGems,
      now,
      requestKey,
      balanceAfter,
    );
    this.recordGemLedgerEvent({
      userId: player.userId,
      amount: reward.dailyGems,
      balanceAfter: dailyBalance,
      category: 'daily_check_in',
      description: `每日签到获得 ${reward.dailyGems} 宝石`,
      sourceKey: `check-in:${player.userId}:${period.todayKey}`,
      createdAt: now,
    });
    if (reward.weeklyBonusGems > 0) {
      this.recordGemLedgerEvent({
        userId: player.userId,
        amount: reward.weeklyBonusGems,
        balanceAfter,
        category: 'weekly_full_attendance',
        description: `本周全勤额外获得 ${reward.weeklyBonusGems} 宝石`,
        sourceKey: `full-attendance:${player.userId}:${period.weekKey}`,
        createdAt: now,
      });
    }
    return {
      ok: true,
      message: reward.weeklyBonusGems > 0
        ? `签到成功，获得 ${reward.dailyGems} 宝石；本周全勤额外获得 ${reward.weeklyBonusGems} 宝石`
        : `签到成功，获得 ${reward.dailyGems} 宝石`,
    };
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
      ensureBankWorld(world, now);
      ensurePlayerBankAccount(player, now);
      if (!this.scheduledProcessing || !playerWasPresent) {
        this.processWorldIfDue(world, now, Number(user.id), { force: !playerWasPresent });
      }
      settlePlayerWeeklyCashOnLogin(world, player, now);
      this.saveWorldIfChanged(revision, world, now, stateJson);
      return this.gemEconomy.createShopSummary(player, now);
    });
  }

  apply(user, { action, payload, requestKey, method, path }, now = Date.now()) {
    payload = normalizePlayerMoneyPayload(action, payload);
    return this.transaction(() => {
      const cached = this.selectIdempotency.get(Number(user.id), requestKey);
      if (cached) {
        if (cached.request_method !== method || cached.request_path !== path) {
          const error = new Error('幂等键已被其他操作使用');
          error.statusCode = 409;
          throw error;
        }
        const cachedResponse = JSON.parse(String(cached.response_json));
        return createActionAcknowledgement(cachedResponse.result, cachedResponse.revision);
      }

      const { revision, stateJson, world } = this.loadWorld(now);
      const player = ensurePlayer(world, user, now);
      ensureWarehouse(player);
      ensureGemState(player);
      ensureBankWorld(world, now);
      ensurePlayerBankAccount(player, now);
      ensureWeeklyCashSettlementWorld(world, now);
      ensurePlayerWeeklyCashSettlement(player, now);
      this.processWorldIfDue(world, now, Number(user.id), { force: true });
      settlePlayerWeeklyCashOnLogin(world, player, now);
      const playerBeforeAction = structuredClone(world.players[String(user.id)]);
      let gameResult;
      if (action === 'checkIn') {
        gameResult = this.checkInInTransaction(player, requestKey, now);
      } else if (action === 'upgradeWarehouse') {
        gameResult = upgradeWarehouse(world.players[String(user.id)]);
      } else if (action === 'redeemGift') {
        gameResult = this.redeemGiftInTransaction(world, user, payload, now);
      } else if (action === 'exchangeGems') {
        gameResult = this.gemEconomy.exchange(player, payload.gems, requestKey, now);
      } else if (action === 'rejectGemShopQuote') {
        gameResult = this.gemEconomy.rejectQuote(player, requestKey, now);
      } else if (AUCTION_ACTIONS.has(action)) {
        gameResult = applyAssetAuctionAction(world, user, action, payload, now);
      } else if (BANK_ACTIONS.has(action)) {
        gameResult = applyBankAction(world, user, action, payload, now);
      } else {
        gameResult = applyFacilityGroupAction(world, user, action, payload, now);
      }
      if (action === 'accelerateFacilityConstruction' && gameResult?.ok) {
        this.gemEconomy.recordConstructionAcceleration(user.id, requestKey, gameResult, now);
      }
      const activePlayer = world.players[String(user.id)];
      collectPlayerWeeklyCashSettlement(world, activePlayer, now);
      if (gameResult?.ok && ECONOMIC_ACTIVITY_ACTIONS.has(action)) {
        if (activePlayer && !isDeepStrictEqual(activePlayer, playerBeforeAction)) {
          activePlayer.lastEconomicActivityAt = now;
          const activated = activateWeeklyCashSettlement(world, activePlayer, now);
          if (activated) {
            gameResult.message = String(gameResult.message || '') + '；本周已激活，存款从下一个自然日按每日 1% 计息，周末按资金净额生成 10% 结算';
          }
        }
      }
      normalizeWorldMoneyPrecision(world);
      this.processWorldIfDue(world, now, Number(user.id), { force: true });
      normalizeWorldMoneyPrecision(world);
      ensureWarehouse(world.players[String(user.id)]);
      ensureGemState(world.players[String(user.id)]);
      ensurePlayerBankAccount(world.players[String(user.id)], now);
      ensurePlayerWeeklyCashSettlement(world.players[String(user.id)], now);
      const nextRevision = this.saveWorldIfChanged(revision, world, now, stateJson);
      const response = createActionAcknowledgement(gameResult, nextRevision);
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

  updatePopulationPolicy(user, payload, requestMeta, now = Date.now()) {
    return this.adminMutation(user, requestMeta, () => {
      const { revision, stateJson, world } = this.loadWorld(now);
      this.processWorldIfDue(world, now, Number(user.id), { force: true });
      const result = applyPopulationPolicy(world, payload, { adminUserId: Number(user.id), now });
      const nextRevision = this.saveWorldIfChanged(revision, world, now, stateJson);
      this.insertPopulationPolicyAudit.run(
        Number(user.id),
        'update_policy',
        'all',
        JSON.stringify(result.beforePolicy),
        JSON.stringify(result.afterPolicy),
        0,
        JSON.stringify({ basic: 0, skilled: 0, professional: 0 }),
        revision,
        nextRevision,
        requestMeta.requestKey,
        result.afterPolicy.note,
        now,
      );
      return {
        policy: result.afterPolicy,
        populationEconomy: createPopulationAdminSummary(world, now),
        revision: nextRevision,
      };
    }, now);
  }

  resetPopulationPolicy(user, payload, requestMeta, now = Date.now()) {
    return this.adminMutation(user, requestMeta, () => {
      const { revision, stateJson, world } = this.loadWorld(now);
      this.processWorldIfDue(world, now, Number(user.id), { force: true });
      const result = resetPopulationPolicy(world, payload, { adminUserId: Number(user.id), now });
      const nextRevision = this.saveWorldIfChanged(revision, world, now, stateJson);
      this.insertPopulationPolicyAudit.run(
        Number(user.id),
        'reset_policy',
        'all',
        JSON.stringify(result.beforePolicy),
        JSON.stringify(result.afterPolicy),
        0,
        JSON.stringify({ basic: 0, skilled: 0, professional: 0 }),
        revision,
        nextRevision,
        requestMeta.requestKey,
        result.afterPolicy.note,
        now,
      );
      return {
        policy: result.afterPolicy,
        populationEconomy: createPopulationAdminSummary(world, now),
        revision: nextRevision,
      };
    }, now);
  }

  topUpPopulation(user, payload, requestMeta, now = Date.now()) {
    return this.adminMutation(user, requestMeta, () => {
      const { revision, stateJson, world } = this.loadWorld(now);
      this.processWorldIfDue(world, now, Number(user.id), { force: true });
      const beforePolicy = createPopulationAdminSummary(world, now).policy;
      const result = topUpPopulationByPolicy(world, payload, { now });
      const nextRevision = this.saveWorldIfChanged(revision, world, now, stateJson);
      this.insertPopulationPolicyAudit.run(
        Number(user.id),
        'top_up',
        result.targetModel,
        JSON.stringify(beforePolicy),
        JSON.stringify(result.policy),
        result.issuedTotal,
        JSON.stringify(result.issuedByModel),
        revision,
        nextRevision,
        requestMeta.requestKey,
        result.note,
        now,
      );
      return {
        ...result,
        populationEconomy: createPopulationAdminSummary(world, now),
        revision: nextRevision,
      };
    }, now);
  }

  listPopulationPolicyAudit(user, { cursor, limit } = {}) {
    this.requireAdmin(user);
    const normalizedLimit = Math.min(100, Math.max(1, Number.parseInt(String(limit || '50'), 10) || 50));
    const cursorId = cursor === null || cursor === undefined || cursor === ''
      ? null
      : Number.parseInt(String(cursor), 10);
    if (cursorId !== null && (!Number.isSafeInteger(cursorId) || cursorId <= 0)) {
      const error = new Error('人口调控记录游标无效');
      error.statusCode = 400;
      throw error;
    }
    const rows = cursorId === null
      ? this.database.prepare(`
        SELECT * FROM economy_population_policy_audit ORDER BY id DESC LIMIT ?
      `).all(normalizedLimit + 1)
      : this.database.prepare(`
        SELECT * FROM economy_population_policy_audit WHERE id < ? ORDER BY id DESC LIMIT ?
      `).all(cursorId, normalizedLimit + 1);
    const hasMore = rows.length > normalizedLimit;
    const selected = rows.slice(0, normalizedLimit);
    const total = Number(this.database.prepare(
      'SELECT COUNT(*) AS count FROM economy_population_policy_audit',
    ).get().count || 0);
    return {
      items: selected.map((row) => ({
        id: Number(row.id),
        adminUserId: Number(row.admin_user_id),
        actionType: String(row.action_type),
        targetModel: String(row.target_model),
        beforePolicy: JSON.parse(String(row.before_policy_json)),
        afterPolicy: JSON.parse(String(row.after_policy_json)),
        issuedCredits: Number(row.issued_credits),
        issuedByModel: JSON.parse(String(row.issued_by_model_json)),
        revisionBefore: Number(row.revision_before),
        revisionAfter: Number(row.revision_after),
        note: String(row.note),
        createdAt: Number(row.created_at),
      })),
      total,
      nextCursor: hasMore ? String(selected[selected.length - 1].id) : null,
    };
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
        openAuctionCount: world.assetAuctions.filter((auction) => auction.status === 'open').length,
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

}
