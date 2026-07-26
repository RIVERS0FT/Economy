import {
  calculateNextGemShopRate,
  createGemShopSummary,
  exchangeGems,
  GEM_SHOP_CREDITS_PER_GEM,
  GEM_SHOP_EFFECTIVE_DEMAND_GEMS_PER_PLAYER,
  gemShopPeriodFor,
} from './gem-shop.js';

function tableColumns(database, tableName) {
  return new Set(database.prepare(`PRAGMA table_info(${tableName})`).all().map((row) => String(row.name)));
}

function migrateGemShopExchangeSchema(database) {
  const columns = tableColumns(database, 'economy_gem_shop_exchanges');
  if (!columns.has('date_key')) {
    database.exec("ALTER TABLE economy_gem_shop_exchanges ADD COLUMN date_key TEXT NOT NULL DEFAULT ''");
  }
  if (!columns.has('credits_per_gem')) {
    database.exec(`ALTER TABLE economy_gem_shop_exchanges
      ADD COLUMN credits_per_gem INTEGER NOT NULL DEFAULT ${GEM_SHOP_CREDITS_PER_GEM}`);
  }
  database.exec(`
    UPDATE economy_gem_shop_exchanges
    SET date_key = strftime('%Y-%m-%d', created_at / 1000, 'unixepoch', '+8 hours')
    WHERE date_key = ''
  `);
}

function normalizedRateRow(row, nextRateAt) {
  return {
    dateKey: String(row.date_key),
    creditsPerGem: Number(row.credits_per_gem),
    previousRate: Number(row.previous_rate),
    demandPressurePpm: Number(row.demand_pressure_ppm),
    demandTone: String(row.demand_tone),
    nextRateAt: Number(nextRateAt),
  };
}

export class GemEconomyStore {
  constructor(database) {
    this.database = database;
    migrateGemShopExchangeSchema(database);
    database.exec(`
      CREATE TABLE IF NOT EXISTS economy_gem_shop_daily_rates (
        date_key TEXT PRIMARY KEY,
        credits_per_gem INTEGER NOT NULL CHECK (credits_per_gem BETWEEN 6 AND 14),
        previous_rate INTEGER NOT NULL CHECK (previous_rate BETWEEN 6 AND 14),
        demand_pressure_ppm INTEGER NOT NULL CHECK (demand_pressure_ppm >= 0),
        demand_tone TEXT NOT NULL CHECK (demand_tone IN ('high', 'neutral', 'low', 'returning')),
        created_at INTEGER NOT NULL
      ) STRICT;
      CREATE TABLE IF NOT EXISTS economy_gem_shop_quote_decisions (
        user_id INTEGER NOT NULL,
        date_key TEXT NOT NULL,
        decision TEXT NOT NULL CHECK (decision IN ('accepted', 'rejected')),
        quote_rate INTEGER NOT NULL CHECK (quote_rate BETWEEN 6 AND 14),
        gems_spent INTEGER NOT NULL DEFAULT 0 CHECK (gems_spent >= 0),
        credits_received INTEGER NOT NULL DEFAULT 0 CHECK (credits_received >= 0),
        request_key TEXT NOT NULL UNIQUE,
        decided_at INTEGER NOT NULL,
        PRIMARY KEY (user_id, date_key)
      ) STRICT;
      CREATE INDEX IF NOT EXISTS idx_economy_gem_shop_quote_date
        ON economy_gem_shop_quote_decisions(date_key, decision);
      CREATE TABLE IF NOT EXISTS economy_facility_gem_actions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        request_key TEXT NOT NULL UNIQUE,
        action_type TEXT NOT NULL CHECK (action_type = 'construction_acceleration'),
        facility_type_id TEXT NOT NULL,
        gems_spent INTEGER NOT NULL CHECK (gems_spent > 0),
        balance_after INTEGER NOT NULL CHECK (balance_after >= 0),
        reduced_ms INTEGER NOT NULL CHECK (reduced_ms > 0),
        remaining_ms_before INTEGER NOT NULL CHECK (remaining_ms_before > 0),
        remaining_ms_after INTEGER NOT NULL CHECK (remaining_ms_after >= 0),
        completed_immediately INTEGER NOT NULL CHECK (completed_immediately IN (0, 1)),
        created_at INTEGER NOT NULL
      ) STRICT;
      CREATE INDEX IF NOT EXISTS idx_economy_facility_gem_actions_user
        ON economy_facility_gem_actions(user_id, created_at DESC);
    `);
    database.exec(`
      INSERT OR IGNORE INTO economy_gem_shop_quote_decisions (
        user_id, date_key, decision, quote_rate, gems_spent, credits_received, request_key, decided_at
      )
      SELECT user_id, date_key, 'accepted', MAX(credits_per_gem), SUM(gems_spent),
             SUM(credits_received), 'legacy:' || user_id || ':' || date_key, MIN(created_at)
      FROM economy_gem_shop_exchanges
      WHERE date_key <> ''
      GROUP BY user_id, date_key
    `);

    this.selectRate = database.prepare(`
      SELECT * FROM economy_gem_shop_daily_rates WHERE date_key = ?
    `);
    this.selectPreviousRate = database.prepare(`
      SELECT * FROM economy_gem_shop_daily_rates
      WHERE date_key < ? ORDER BY date_key DESC LIMIT 1
    `);
    this.insertRate = database.prepare(`
      INSERT INTO economy_gem_shop_daily_rates (
        date_key, credits_per_gem, previous_rate, demand_pressure_ppm, demand_tone, created_at
      ) VALUES (?, ?, ?, ?, ?, ?)
    `);
    this.aggregateDecisionDate = database.prepare(`
      SELECT
        COALESCE(SUM(CASE WHEN decision = 'accepted'
          THEN MIN(gems_spent, ${GEM_SHOP_EFFECTIVE_DEMAND_GEMS_PER_PLAYER}) ELSE 0 END), 0) AS effective_gems,
        COALESCE(SUM(CASE WHEN decision = 'accepted' THEN 1 ELSE 0 END), 0) AS accepted_count,
        COALESCE(SUM(CASE WHEN decision = 'rejected' THEN 1 ELSE 0 END), 0) AS rejected_count
      FROM economy_gem_shop_quote_decisions WHERE date_key = ?
    `);
    // Compare yesterday with earlier complete days; including it would dilute its own demand signal.
    this.listRecentEffectiveDemand = database.prepare(`
      SELECT date_key,
        COALESCE(SUM(CASE WHEN decision = 'accepted'
          THEN MIN(gems_spent, ${GEM_SHOP_EFFECTIVE_DEMAND_GEMS_PER_PLAYER}) ELSE 0 END), 0) AS effective_gems
      FROM economy_gem_shop_quote_decisions
      WHERE date_key < ?
      GROUP BY date_key
      ORDER BY date_key DESC
      LIMIT 7
    `);
    this.selectDecision = database.prepare(`
      SELECT * FROM economy_gem_shop_quote_decisions WHERE user_id = ? AND date_key = ?
    `);
    this.insertDecision = database.prepare(`
      INSERT INTO economy_gem_shop_quote_decisions (
        user_id, date_key, decision, quote_rate, gems_spent, credits_received, request_key, decided_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    this.insertExchange = database.prepare(`
      INSERT INTO economy_gem_shop_exchanges (
        user_id, request_key, gems_spent, credits_received, created_at, date_key, credits_per_gem
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    this.sumExchanges = database.prepare(`
      SELECT COALESCE(SUM(gems_spent), 0) AS total_gems_spent,
             COALESCE(SUM(credits_received), 0) AS total_credits_received
      FROM economy_gem_shop_exchanges WHERE user_id = ?
    `);
    this.listExchanges = database.prepare(`
      SELECT gems_spent, credits_received, credits_per_gem, date_key, created_at
      FROM economy_gem_shop_exchanges
      WHERE user_id = ? ORDER BY created_at DESC LIMIT 20
    `);
    this.listRates = database.prepare(`
      SELECT date_key, credits_per_gem, previous_rate, demand_pressure_ppm, demand_tone
      FROM economy_gem_shop_daily_rates
      WHERE date_key <= ? ORDER BY date_key DESC LIMIT 14
    `);
    this.insertFacilityGemAction = database.prepare(`
      INSERT INTO economy_facility_gem_actions (
        user_id, request_key, action_type, facility_type_id, gems_spent, balance_after,
        reduced_ms, remaining_ms_before, remaining_ms_after, completed_immediately, created_at
      ) VALUES (?, ?, 'construction_acceleration', ?, ?, ?, ?, ?, ?, ?, ?)
    `);
  }

  ensureDailyRate(now = Date.now()) {
    const period = gemShopPeriodFor(now);
    const existing = this.selectRate.get(period.dateKey);
    if (existing) return normalizedRateRow(existing, period.nextRateAt);

    const previousRow = this.selectPreviousRate.get(period.dateKey);
    const previousRate = Number(previousRow?.credits_per_gem || GEM_SHOP_CREDITS_PER_GEM);
    const yesterday = this.aggregateDecisionDate.get(period.previousDateKey);
    const recentEffectiveGems = this.listRecentEffectiveDemand
      .all(period.previousDateKey)
      .map((row) => Number(row.effective_gems || 0));
    const next = calculateNextGemShopRate({
      previousRate,
      yesterdayEffectiveGems: Number(yesterday?.effective_gems || 0),
      recentEffectiveGems,
      acceptedCount: Number(yesterday?.accepted_count || 0),
      rejectedCount: Number(yesterday?.rejected_count || 0),
    });
    this.insertRate.run(
      period.dateKey,
      next.creditsPerGem,
      previousRate,
      next.demandPressurePpm,
      next.demandTone,
      Number(now),
    );
    return {
      dateKey: period.dateKey,
      creditsPerGem: next.creditsPerGem,
      previousRate,
      demandPressurePpm: next.demandPressurePpm,
      demandTone: next.demandTone,
      nextRateAt: period.nextRateAt,
    };
  }

  createShopSummary(player, now = Date.now()) {
    const rate = this.ensureDailyRate(now);
    const decision = this.selectDecision.get(Number(player.userId), rate.dateKey) || null;
    return createGemShopSummary(player, {
      rate,
      decision,
      totals: this.sumExchanges.get(Number(player.userId)),
      recentExchanges: this.listExchanges.all(Number(player.userId)),
      rateHistory: this.listRates.all(rate.dateKey),
    });
  }

  exchange(player, rawAmount, requestKey, now = Date.now()) {
    const rate = this.ensureDailyRate(now);
    const existing = this.selectDecision.get(Number(player.userId), rate.dateKey);
    if (existing) {
      return {
        ok: false,
        message: existing.decision === 'accepted'
          ? '今日终端报价已经使用，请等待明日新报价'
          : '今日终端报价已经放弃，请等待明日新报价',
      };
    }
    const result = exchangeGems(player, rawAmount, rate.creditsPerGem, now);
    if (!result.ok) return result;
    this.insertDecision.run(
      Number(player.userId), rate.dateKey, 'accepted', rate.creditsPerGem,
      result.gemsSpent, result.creditsReceived, String(requestKey), Number(now),
    );
    this.insertExchange.run(
      Number(player.userId), String(requestKey), result.gemsSpent, result.creditsReceived,
      Number(now), rate.dateKey, rate.creditsPerGem,
    );
    return { ...result, quoteDateKey: rate.dateKey };
  }

  rejectQuote(player, requestKey, now = Date.now()) {
    const rate = this.ensureDailyRate(now);
    const existing = this.selectDecision.get(Number(player.userId), rate.dateKey);
    if (existing) {
      return {
        ok: false,
        message: existing.decision === 'accepted'
          ? '今日终端报价已经使用，不能再放弃'
          : '今日终端报价已经放弃',
      };
    }
    this.insertDecision.run(
      Number(player.userId), rate.dateKey, 'rejected', rate.creditsPerGem,
      0, 0, String(requestKey), Number(now),
    );
    return { ok: true, message: '已放弃今日终端报价，明日将获得新报价' };
  }

  recordConstructionAcceleration(userId, requestKey, actionResult, now = Date.now()) {
    this.insertFacilityGemAction.run(
      Number(userId),
      String(requestKey),
      String(actionResult.facilityTypeId),
      Number(actionResult.gemsSpent),
      Number(actionResult.balanceAfter),
      Number(actionResult.reducedMs),
      Number(actionResult.remainingMsBefore),
      Number(actionResult.remainingMsAfter),
      actionResult.completedImmediately ? 1 : 0,
      Number(now),
    );
  }
}
