from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(path):
    return (ROOT / path).read_text(encoding='utf-8')


def write(path, content):
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding='utf-8')


def replace_once(path, old, new):
    text = read(path)
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{path}: expected one occurrence, found {count}: {old[:120]!r}')
    write(path, text.replace(old, new, 1))


def insert_after(path, marker, addition):
    replace_once(path, marker, marker + addition)


def append_once(path, sentinel, addition):
    text = read(path)
    if sentinel in text:
        return
    write(path, text.rstrip() + '\n\n' + addition.strip() + '\n')


# Phase 0: precise operating funnel -------------------------------------------------
replace_once(
    'server/src/tutorial-store.js',
    """  database.exec(`\n    CREATE TABLE IF NOT EXISTS economy_tutorial_completions (\n      user_id INTEGER PRIMARY KEY,\n      completed_version INTEGER NOT NULL CHECK (completed_version >= 0),\n      completed_at INTEGER NOT NULL\n    ) STRICT;\n  `);\n\n  const selectStatus = database.prepare(`""",
    """  database.exec(`\n    CREATE TABLE IF NOT EXISTS economy_tutorial_completions (\n      user_id INTEGER PRIMARY KEY,\n      completed_version INTEGER NOT NULL CHECK (completed_version >= 0),\n      completed_at INTEGER NOT NULL,\n      completion_source TEXT NOT NULL DEFAULT 'legacy'\n        CHECK (completion_source IN ('legacy', 'migration', 'player'))\n    ) STRICT;\n  `);\n  const tutorialCompletionColumns = new Set(\n    database.prepare('PRAGMA table_info(economy_tutorial_completions)').all()\n      .map((row) => String(row.name)),\n  );\n  if (!tutorialCompletionColumns.has('completion_source')) {\n    database.exec(\"ALTER TABLE economy_tutorial_completions ADD COLUMN completion_source TEXT NOT NULL DEFAULT 'legacy' CHECK (completion_source IN ('legacy', 'migration', 'player'))\");\n  }\n\n  const selectStatus = database.prepare(`""",
)
replace_once(
    'server/src/tutorial-store.js',
    """  const upsertStatus = database.prepare(`\n    INSERT INTO economy_tutorial_completions (user_id, completed_version, completed_at)\n    VALUES (?, ?, ?)\n    ON CONFLICT(user_id) DO UPDATE SET\n      completed_version = MAX(economy_tutorial_completions.completed_version, excluded.completed_version),\n      completed_at = CASE\n        WHEN excluded.completed_version > economy_tutorial_completions.completed_version\n          THEN excluded.completed_at\n        ELSE economy_tutorial_completions.completed_at\n      END\n  `);""",
    """  const upsertStatus = database.prepare(`\n    INSERT INTO economy_tutorial_completions (user_id, completed_version, completed_at, completion_source)\n    VALUES (?, ?, ?, ?)\n    ON CONFLICT(user_id) DO UPDATE SET\n      completed_version = MAX(economy_tutorial_completions.completed_version, excluded.completed_version),\n      completed_at = CASE\n        WHEN excluded.completed_version > economy_tutorial_completions.completed_version\n          THEN excluded.completed_at\n        ELSE economy_tutorial_completions.completed_at\n      END,\n      completion_source = CASE\n        WHEN excluded.completed_version > economy_tutorial_completions.completed_version\n          THEN excluded.completion_source\n        ELSE economy_tutorial_completions.completion_source\n      END\n  `);""",\)
replace_once('server/src/tutorial-store.js', '      upsertStatus.run(userId, CURRENT_TUTORIAL_VERSION, now);', "      upsertStatus.run(userId, CURRENT_TUTORIAL_VERSION, now, 'migration');")
replace_once('server/src/tutorial-store.js', '      upsertStatus.run(normalizedUserId, version, completedAt);', "      upsertStatus.run(normalizedUserId, version, completedAt, 'player');")

replace_once(
    'server/src/player-admin-statistics.js',
    "import { PRODUCT_CATALOG } from './domain.js';\nimport { wealthAssetsFor } from './leaderboards.js';",
    "import { PRODUCT_CATALOG } from './domain.js';\nimport { wealthAssetsFor } from './leaderboards.js';\nimport { CURRENT_TUTORIAL_VERSION } from './tutorial-store.js';",
)
insert_after(
    'server/src/player-admin-statistics.js',
    "const CONFIGURED = Symbol('player-admin-statistics-configured');\n",
    "const STRATEGY_FUNNEL_COVERAGE_KEY = 'gameplay_strategy_funnel_coverage_started_at';\n",
)
insert_after(
    'server/src/player-admin-statistics.js',
    """function tableExists(database, name) {\n  const row = database.prepare(`\n    SELECT 1 AS present FROM sqlite_master WHERE type = 'table' AND name = ?\n  `).get(name);\n  return Boolean(row?.present);\n}\n""",
    """\nfunction tableColumns(database, name) {\n  return new Set(database.prepare(`PRAGMA table_info(${name})`).all().map((row) => String(row.name)));\n}\n\nfunction playerGrowthLineCompletions(database) {\n  if (!tableExists(database, 'economy_tutorial_completions')) return [];\n  if (!tableColumns(database, 'economy_tutorial_completions').has('completion_source')) return [];\n  return rowsOrEmpty(database, `\n    SELECT user_id, completed_at\n    FROM economy_tutorial_completions\n    WHERE completed_version >= ? AND completion_source = 'player'\n    ORDER BY completed_at, user_id\n  `, CURRENT_TUTORIAL_VERSION);\n}\n""",\)
replace_once(
    'server/src/player-admin-statistics.js',
    """    CREATE TABLE IF NOT EXISTS economy_player_milestones (\n      user_id INTEGER PRIMARY KEY,\n      first_economic_action_at INTEGER,\n      first_facility_at INTEGER,\n      first_production_at INTEGER,\n      first_trade_at INTEGER,\n      first_contract_at INTEGER,\n      first_auction_at INTEGER\n    ) STRICT;""",
    """    CREATE TABLE IF NOT EXISTS economy_player_milestones (\n      user_id INTEGER PRIMARY KEY,\n      first_economic_action_at INTEGER,\n      first_facility_at INTEGER,\n      first_production_at INTEGER,\n      first_trade_at INTEGER,\n      first_contract_at INTEGER,\n      first_auction_at INTEGER,\n      first_research_at INTEGER,\n      first_bank_deposit_at INTEGER\n    ) STRICT;""",\)
insert_after(
    'server/src/player-admin-statistics.js',
    """  `);\n  store.database.prepare(`\n    INSERT OR IGNORE INTO economy_player_statistics_meta (meta_key, meta_value)\n    VALUES ('coverage_started_at', ?)\n  `).run(now);\n""",
    """  const milestoneColumns = tableColumns(store.database, 'economy_player_milestones');\n  if (!milestoneColumns.has('first_research_at')) {\n    store.database.exec('ALTER TABLE economy_player_milestones ADD COLUMN first_research_at INTEGER');\n  }\n  if (!milestoneColumns.has('first_bank_deposit_at')) {\n    store.database.exec('ALTER TABLE economy_player_milestones ADD COLUMN first_bank_deposit_at INTEGER');\n  }\n  store.database.prepare(`\n    INSERT OR IGNORE INTO economy_player_statistics_meta (meta_key, meta_value)\n    VALUES (?, ?)\n  `).run(STRATEGY_FUNNEL_COVERAGE_KEY, now);\n""",\)
replace_once(
    'server/src/player-admin-statistics.js',
    """    upsertMilestones: store.database.prepare(`\n      INSERT INTO economy_player_milestones (\n        user_id, first_economic_action_at, first_facility_at, first_production_at,\n        first_trade_at, first_contract_at, first_auction_at\n      ) VALUES (?, ?, ?, ?, ?, ?, ?)\n      ON CONFLICT(user_id) DO UPDATE SET\n        first_economic_action_at = COALESCE(first_economic_action_at, excluded.first_economic_action_at),\n        first_facility_at = COALESCE(first_facility_at, excluded.first_facility_at),\n        first_production_at = COALESCE(first_production_at, excluded.first_production_at),\n        first_trade_at = COALESCE(first_trade_at, excluded.first_trade_at),\n        first_contract_at = COALESCE(first_contract_at, excluded.first_contract_at),\n        first_auction_at = COALESCE(first_auction_at, excluded.first_auction_at)\n    `),""",
    """    upsertMilestones: store.database.prepare(`\n      INSERT INTO economy_player_milestones (\n        user_id, first_economic_action_at, first_facility_at, first_production_at,\n        first_trade_at, first_contract_at, first_auction_at, first_research_at, first_bank_deposit_at\n      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)\n      ON CONFLICT(user_id) DO UPDATE SET\n        first_economic_action_at = COALESCE(first_economic_action_at, excluded.first_economic_action_at),\n        first_facility_at = COALESCE(first_facility_at, excluded.first_facility_at),\n        first_production_at = COALESCE(first_production_at, excluded.first_production_at),\n        first_trade_at = COALESCE(first_trade_at, excluded.first_trade_at),\n        first_contract_at = COALESCE(first_contract_at, excluded.first_contract_at),\n        first_auction_at = COALESCE(first_auction_at, excluded.first_auction_at),\n        first_research_at = COALESCE(first_research_at, excluded.first_research_at),\n        first_bank_deposit_at = COALESCE(first_bank_deposit_at, excluded.first_bank_deposit_at)\n    `),""",\)
replace_once(
    'server/src/player-admin-statistics.js',
    """    coverageStartedAt: () => Number(store.database.prepare(`\n      SELECT meta_value FROM economy_player_statistics_meta WHERE meta_key = 'coverage_started_at'\n    `).get()?.meta_value || now),\n  };""",
    """    coverageStartedAt: () => Number(store.database.prepare(`\n      SELECT meta_value FROM economy_player_statistics_meta WHERE meta_key = 'coverage_started_at'\n    `).get()?.meta_value || now),\n    funnelCoverageStartedAt: () => Number(store.database.prepare(`\n      SELECT meta_value FROM economy_player_statistics_meta WHERE meta_key = ?\n    `).get(STRATEGY_FUNNEL_COVERAGE_KEY)?.meta_value || now),\n  };""",\)
replace_once(
    'server/src/player-admin-statistics.js',
    """  state.upsertMilestones.run(\n    userId,\n    now,\n    null,\n    null,\n    null,\n    CONTRACT_ACTIONS.has(context.action) ? now : null,\n    AUCTION_ACTIONS.has(context.action) ? now : null,\n  );""",
    """  state.upsertMilestones.run(\n    userId,\n    now,\n    null,\n    null,\n    null,\n    CONTRACT_ACTIONS.has(context.action) ? now : null,\n    AUCTION_ACTIONS.has(context.action) ? now : null,\n    context.action === 'startResearch' ? now : null,\n    context.action === 'bankDeposit' ? now : null,\n  );""",\)
replace_once(
    'server/src/player-admin-statistics.js',
    """      state.upsertMilestones.run(\n        userId,\n        null,\n        firstFacilityAt,\n        firstProductionAt,\n        firstTradeAt,\n        null,\n        null,\n      );""",
    """      state.upsertMilestones.run(\n        userId,\n        null,\n        firstFacilityAt,\n        firstProductionAt,\n        firstTradeAt,\n        null,\n        null,\n        null,\n        null,\n      );""",\)
insert_after(
    'server/src/player-admin-statistics.js',
    """function createStatisticsSummary(store, world, rangeKey, now) {\n  const range = rangeFor(rangeKey, now);\n  const coverageStartedAt = store[CONFIGURED].coverageStartedAt();\n""",
    "  const funnelCoverageStartedAt = store[CONFIGURED].funnelCoverageStartedAt();\n",\)
insert_after(
    'server/src/player-admin-statistics.js',
    """  const milestones = rowsOrEmpty(store.database, 'SELECT * FROM economy_player_milestones ORDER BY user_id');\n  const milestonesByUser = new Map(milestones.map((row) => [Number(row.user_id), row]));\n""",
    """  const growthLineCompletions = playerGrowthLineCompletions(store.database);\n  const growthLineCompletionByUser = new Map(\n    growthLineCompletions.map((row) => [Number(row.user_id), safeTimestamp(row.completed_at)]),\n  );\n""",\)
replace_once(
    'server/src/player-admin-statistics.js',
    """  const currentMetrics = new Map(players.map((player) => [Number(player.userId), metricsForPlayer(player)]));\n  const stageCounts = {\n    registered: players.length,\n    action: players.filter((player) => hasEconomicActivity(\n      player,\n      actionUsers,\n      milestonesByUser.get(Number(player.userId)),\n    )).length,\n    facility: players.filter((player) => {\n      const userId = Number(player.userId);\n      return safeTimestamp(milestonesByUser.get(userId)?.first_facility_at) > 0\n        || currentMetrics.get(userId).facilityCount > 0;\n    }).length,\n    production: players.filter((player) => {\n      const userId = Number(player.userId);\n      return safeTimestamp(milestonesByUser.get(userId)?.first_production_at) > 0\n        || currentMetrics.get(userId).productionOutput > 0;\n    }).length,\n    trade: players.filter((player) => {\n      const userId = Number(player.userId);\n      return safeTimestamp(milestonesByUser.get(userId)?.first_trade_at) > 0\n        || currentMetrics.get(userId).tradeQuantity > 0;\n    }).length,\n  };\n  const funnelStages = [\n    { id: 'registered', label: '完成建档', count: stageCounts.registered, medianHours: 0 },\n    {\n      id: 'first-action', label: '首次经济操作', count: stageCounts.action,\n      medianHours: stageMedianHours(milestones, registrationsByUser, 'first_economic_action_at'),\n    },\n    {\n      id: 'first-facility', label: '获得第一座工厂', count: stageCounts.facility,\n      medianHours: stageMedianHours(milestones, registrationsByUser, 'first_facility_at'),\n    },\n    {\n      id: 'first-production', label: '完成首次生产', count: stageCounts.production,\n      medianHours: stageMedianHours(milestones, registrationsByUser, 'first_production_at'),\n    },\n    {\n      id: 'first-trade', label: '完成首次订单簿成交', count: stageCounts.trade,\n      medianHours: stageMedianHours(milestones, registrationsByUser, 'first_trade_at'),\n    },\n  ].map((stage, index, stages) => ({\n    ...stage,\n    conversionBps: index === 0 ? 10_000 : ratioBps(stage.count, stages[index - 1].count),\n  }));""",
    """  const currentMetrics = new Map(players.map((player) => [Number(player.userId), metricsForPlayer(player)]));\n  const trackedRegistrations = registrations.filter((row) => safeTimestamp(row.registered_at) >= funnelCoverageStartedAt);\n  const trackedUserIds = new Set(trackedRegistrations.map((row) => Number(row.user_id)));\n  const trackedPlayers = players.filter((player) => trackedUserIds.has(Number(player.userId)));\n  const trackedMilestones = milestones.filter((row) => trackedUserIds.has(Number(row.user_id)));\n  const registeredStage = trackedPlayers;\n  const actionStage = registeredStage.filter((player) => hasEconomicActivity(\n    player, actionUsers, milestonesByUser.get(Number(player.userId)),\n  ));\n  const facilityStage = actionStage.filter((player) => {\n    const userId = Number(player.userId);\n    return safeTimestamp(milestonesByUser.get(userId)?.first_facility_at) > 0\n      || currentMetrics.get(userId).facilityCount > 0;\n  });\n  const productionStage = facilityStage.filter((player) => {\n    const userId = Number(player.userId);\n    return safeTimestamp(milestonesByUser.get(userId)?.first_production_at) > 0\n      || currentMetrics.get(userId).productionOutput > 0;\n  });\n  const tradeStage = productionStage.filter((player) => {\n    const userId = Number(player.userId);\n    return safeTimestamp(milestonesByUser.get(userId)?.first_trade_at) > 0\n      || currentMetrics.get(userId).tradeQuantity > 0;\n  });\n  const researchStage = tradeStage.filter((player) => (\n    safeTimestamp(milestonesByUser.get(Number(player.userId))?.first_research_at) > 0\n  ));\n  const bankStage = researchStage.filter((player) => (\n    safeTimestamp(milestonesByUser.get(Number(player.userId))?.first_bank_deposit_at) > 0\n  ));\n  const growthLineStage = bankStage.filter((player) => (\n    safeTimestamp(growthLineCompletionByUser.get(Number(player.userId))) > 0\n  ));\n  const growthLineRows = growthLineCompletions\n    .filter((row) => trackedUserIds.has(Number(row.user_id)))\n    .map((row) => ({ user_id: row.user_id, first_growth_line_at: row.completed_at }));\n  const stageUsers = [registeredStage, actionStage, facilityStage, productionStage, tradeStage, researchStage, bankStage, growthLineStage];\n  const funnelStages = [\n    { id: 'registered', label: '完成建档', count: registeredStage.length, medianHours: 0 },\n    { id: 'first-action', label: '首次经济操作', count: actionStage.length, medianHours: stageMedianHours(trackedMilestones, registrationsByUser, 'first_economic_action_at') },\n    { id: 'first-facility', label: '获得第一座工厂', count: facilityStage.length, medianHours: stageMedianHours(trackedMilestones.filter((row) => new Set(facilityStage.map((player) => Number(player.userId))).has(Number(row.user_id))), registrationsByUser, 'first_facility_at') },\n    { id: 'first-production', label: '完成首次生产', count: productionStage.length, medianHours: stageMedianHours(trackedMilestones.filter((row) => new Set(productionStage.map((player) => Number(player.userId))).has(Number(row.user_id))), registrationsByUser, 'first_production_at') },\n    { id: 'first-trade', label: '完成首次订单簿成交', count: tradeStage.length, medianHours: stageMedianHours(trackedMilestones.filter((row) => new Set(tradeStage.map((player) => Number(player.userId))).has(Number(row.user_id))), registrationsByUser, 'first_trade_at') },\n    { id: 'first-research', label: '开始首次产业研发', count: researchStage.length, medianHours: stageMedianHours(trackedMilestones.filter((row) => new Set(researchStage.map((player) => Number(player.userId))).has(Number(row.user_id))), registrationsByUser, 'first_research_at') },\n    { id: 'first-bank-deposit', label: '完成首次银行存款', count: bankStage.length, medianHours: stageMedianHours(trackedMilestones.filter((row) => new Set(bankStage.map((player) => Number(player.userId))).has(Number(row.user_id))), registrationsByUser, 'first_bank_deposit_at') },\n    { id: 'growth-line-complete', label: '完成经营成长线', count: growthLineStage.length, medianHours: stageMedianHours(growthLineRows.filter((row) => new Set(growthLineStage.map((player) => Number(player.userId))).has(Number(row.user_id))), registrationsByUser, 'first_growth_line_at') },\n  ].map((stage, index, stages) => ({\n    ...stage,\n    conversionBps: index === 0 ? 10_000 : ratioBps(stage.count, stages[index - 1].count),\n  }));\n\n  function growthLineCompletionWithin(windowMs) {\n    let eligible = 0;\n    let completed = 0;\n    for (const registration of trackedRegistrations) {\n      const registeredAt = safeTimestamp(registration.registered_at);\n      if (registeredAt <= 0 || registeredAt + windowMs > now) continue;\n      eligible += 1;\n      const completedAt = safeTimestamp(growthLineCompletionByUser.get(Number(registration.user_id)));\n      if (completedAt >= registeredAt && completedAt <= registeredAt + windowMs) completed += 1;\n    }\n    return { eligible, retained: completed, rateBps: ratioBps(completed, eligible) };\n  }\n  const growthLineCompletion24h = growthLineCompletionWithin(DAY_MS);\n  const growthLineCompletion7d = growthLineCompletionWithin(7 * DAY_MS);\n  void stageUsers;""",\)
replace_once(
    'server/src/player-admin-statistics.js',
    "    funnel: { stages: funnelStages, retained7d: retention.d7 },",
    "    funnel: { stages: funnelStages, retained7d: retention.d7, coverageStartsAt: funnelCoverageStartedAt, completion24h: growthLineCompletion24h, completion7d: growthLineCompletion7d },",\)

replace_once(
    'src/api/admin.ts',
    """  funnel: {\n    stages: AdminPlayerStatisticsFunnelStage[];\n    retained7d: AdminPlayerStatisticsRetentionRow;\n  };""",
    """  funnel: {\n    stages: AdminPlayerStatisticsFunnelStage[];\n    retained7d: AdminPlayerStatisticsRetentionRow;\n    coverageStartsAt: number;\n    completion24h: AdminPlayerStatisticsRetentionRow;\n    completion7d: AdminPlayerStatisticsRetentionRow;\n  };""",\)
replace_once(
    'src/components/AdminPlayerStatistics.tsx',
    """        <article className=\"admin-player-statistics__card\">\n          <header><div><h3>经营成长漏斗</h3><small>阶段人数使用当前权威状态与已记录里程碑，耗时只统计精确时间</small></div></header>\n          <HorizontalPercentChart rows={funnelRows} ariaLabel=\"玩家经营成长阶段相邻转化率\" className=\"admin-echart--tall\" />\n        </article>""",
    """        <article className=\"admin-player-statistics__card\">\n          <header><div><h3>经营成长漏斗</h3><small>只统计 {formatDate(funnel.coverageStartsAt)} 起新建档玩家；阶段按真实顺序收敛，迁移完成不计入成长线完成</small></div></header>\n          <HorizontalPercentChart rows={funnelRows} ariaLabel=\"玩家经营成长阶段相邻转化率\" className=\"admin-echart--tall\" />\n          <div className=\"admin-player-statistics__acquisition\">\n            <h4>成长线完成时效</h4>\n            <dl>\n              <div><dt>24 小时内</dt><dd>{formatPercentBps(funnel.completion24h.rateBps)} · {funnel.completion24h.retained}/{funnel.completion24h.eligible}</dd></div>\n              <div><dt>7 日内</dt><dd>{formatPercentBps(funnel.completion7d.rateBps)} · {funnel.completion7d.retained}/{funnel.completion7d.eligible}</dd></div>\n            </dl>\n          </div>\n        </article>""",\)

# Phase 1: shared real-market signals and factory diagnostics -----------------------
write('src/utils/marketDecisionSignals.ts', """import type { ProductMarketState } from '../types';

export type MarketTrend = 'up' | 'down' | 'flat' | 'unknown';
export type RealTradePoint = ProductMarketState['priceHistory'][number];

export interface MarketDecisionSignal {
  price: number | null;
  previousPrice: number | null;
  changeBps: number | null;
  trend: MarketTrend;
  tradeCount: number;
  volume: number;
}

export function realTradePoints(
  market: ProductMarketState | undefined,
  from = Number.NEGATIVE_INFINITY,
  to = Number.POSITIVE_INFINITY,
) {
  return (market?.priceHistory ?? [])
    .filter((point) => (
      (point.takerSide === 'buy' || point.takerSide === 'sell')
      && Number.isFinite(point.price)
      && point.price > 0
      && Number.isFinite(point.createdAt)
      && point.createdAt >= from
      && point.createdAt <= to
    ))
    .sort((left, right) => left.createdAt - right.createdAt);
}

export function marketDecisionSignal(
  market: ProductMarketState | undefined,
  from?: number,
  to?: number,
): MarketDecisionSignal {
  const points = realTradePoints(market, from, to);
  const latest = points.at(-1);
  const previous = points.length >= 2 ? points.at(-2) : undefined;
  const fallbackPrice = Number(market?.lastTradePrice);
  const price = latest?.price ?? (Number.isFinite(fallbackPrice) && fallbackPrice > 0 ? fallbackPrice : null);
  const previousPrice = previous?.price ?? null;
  const changeBps = price !== null && previousPrice !== null && previousPrice > 0
    ? Math.round((price - previousPrice) / previousPrice * 10_000)
    : null;
  const trend: MarketTrend = changeBps === null
    ? 'unknown'
    : changeBps > 0
      ? 'up'
      : changeBps < 0
        ? 'down'
        : 'flat';
  return {
    price,
    previousPrice,
    changeBps,
    trend,
    tradeCount: points.length,
    volume: points.reduce((sum, point) => sum + Math.max(0, Number(point.quantity) || 0), 0),
  };
}

export function marketTrendGlyph(trend: MarketTrend) {
  if (trend === 'up') return '↑';
  if (trend === 'down') return '↓';
  if (trend === 'flat') return '→';
  return '—';
}

export function eventMarketFeedback(
  markets: Record<string, ProductMarketState>,
  productIds: readonly string[],
  startsAt: number,
  endsAt: number,
) {
  const signals = productIds.map((productId) => ({
    productId,
    signal: marketDecisionSignal(markets[productId], startsAt, endsAt),
  }));
  const comparable = signals.filter(({ signal }) => signal.changeBps !== null);
  const volume = signals.reduce((sum, { signal }) => sum + signal.volume, 0);
  return {
    volume,
    tradeCount: signals.reduce((sum, { signal }) => sum + signal.tradeCount, 0),
    productsWithTrades: signals.filter(({ signal }) => signal.tradeCount > 0).length,
    averageChangeBps: comparable.length > 0
      ? Math.round(comparable.reduce((sum, { signal }) => sum + Number(signal.changeBps), 0) / comparable.length)
      : null,
  };
}
""")

write('src/utils/facilityOperatingDiagnostics.ts', """import type { FacilityRecipeDefinition, ProductInventory } from '../types';

export interface FacilityInputDiagnosis {
  productId: string;
  requiredPerCycle: number;
  available: number;
  supportedCycles: number;
  shortfallThisCycle: number;
}

export interface FacilityOperatingDiagnosis {
  productionCount: number;
  inputRows: FacilityInputDiagnosis[];
  inputCycles: number | null;
  cashPerCycle: number;
  cashCycles: number | null;
  outputPerCycle: number;
  warehouseCycles: number | null;
  bottleneck: { id: string; label: string; cycles: number | null };
}

function wholeCycles(available: number, required: number) {
  if (required <= 0) return null;
  return Math.max(0, Math.floor(Math.max(0, available) / required));
}

export function buildFacilityOperatingDiagnosis({
  recipe,
  productionCount,
  inventories,
  credits,
  warehouseAvailableCapacity,
}: {
  recipe: FacilityRecipeDefinition;
  productionCount: number;
  inventories: Record<string, ProductInventory>;
  credits: number;
  warehouseAvailableCapacity: number;
}): FacilityOperatingDiagnosis {
  const count = Math.max(0, Math.floor(Number(productionCount) || 0));
  const inputRows = recipe.inputs.map((input) => {
    const requiredPerCycle = input.quantity * count;
    const available = Math.max(0, Number(inventories[input.productId]?.available || 0));
    return {
      productId: input.productId,
      requiredPerCycle,
      available,
      supportedCycles: wholeCycles(available, requiredPerCycle) ?? 0,
      shortfallThisCycle: Math.max(0, requiredPerCycle - available),
    };
  });
  const inputCycles = inputRows.length > 0
    ? Math.min(...inputRows.map((item) => item.supportedCycles))
    : null;
  const cashPerCycle = Math.max(0, Number(recipe.operatingCost || 0) * count);
  const cashCycles = wholeCycles(Math.max(0, credits), cashPerCycle);
  const outputPerCycle = Math.max(0, Number(recipe.output.quantity || 0) * count);
  const warehouseCycles = wholeCycles(Math.max(0, warehouseAvailableCapacity), outputPerCycle);
  const candidates = [
    ...(inputCycles === null ? [] : [{ id: 'inputs', label: '生产原料', cycles: inputCycles }]),
    ...(cashCycles === null ? [] : [{ id: 'cash', label: '可用资金', cycles: cashCycles }]),
    ...(warehouseCycles === null ? [] : [{ id: 'warehouse', label: '仓库空间', cycles: warehouseCycles }]),
  ];
  const bottleneck = count <= 0
    ? { id: 'capacity', label: '当前等效产能', cycles: 0 }
    : candidates.sort((left, right) => left.cycles - right.cycles)[0]
      ?? { id: 'none', label: '暂无硬性瓶颈', cycles: null };
  return { productionCount: count, inputRows, inputCycles, cashPerCycle, cashCycles, outputPerCycle, warehouseCycles, bottleneck };
}
""")

write('src/components/facilities/FacilityOperatingDiagnostics.tsx', """import type {
  FacilityRecipeDefinition,
  ProductDefinition,
  ProductInventory,
  ProductMarketState,
} from '../../types';
import { formatCurrency, formatNumber } from '../../utils/formatters';
import { buildFacilityOperatingDiagnosis } from '../../utils/facilityOperatingDiagnostics';
import { marketDecisionSignal, marketTrendGlyph } from '../../utils/marketDecisionSignals';
import { ProductArtwork } from '../products/ProductArtwork';
import '../../styles/facility-operating-diagnostics.css';

function cyclesLabel(value: number | null) {
  return value === null ? '不限' : `${formatNumber(value)} 周期`;
}

export function FacilityOperatingDiagnostics({
  recipe,
  productionCount,
  products,
  inventories,
  markets,
  credits,
  warehouseAvailableCapacity,
}: {
  recipe: FacilityRecipeDefinition;
  productionCount: number;
  products: ProductDefinition[];
  inventories: Record<string, ProductInventory>;
  markets: Record<string, ProductMarketState>;
  credits: number;
  warehouseAvailableCapacity: number;
}) {
  const productNames = new Map(products.map((product) => [product.id, product.name]));
  const diagnosis = buildFacilityOperatingDiagnosis({
    recipe,
    productionCount,
    inventories,
    credits,
    warehouseAvailableCapacity,
  });
  const marketProductIds = [...new Set([
    ...recipe.inputs.map((item) => item.productId),
    recipe.output.productId,
  ])];

  return (
    <section className="facility-operating-diagnostics mobile-detail-section" aria-label="工厂经营诊断">
      <div className="facility-operating-diagnostics__heading">
        <div>
          <strong>经营诊断</strong>
          <small>按当前等效产能、可用库存、现金、仓库和真实成交快照计算</small>
        </div>
        <span>{diagnosis.bottleneck.label}</span>
      </div>
      <div className="facility-operating-diagnostics__metrics">
        <div><span>原料续航</span><strong>{cyclesLabel(diagnosis.inputCycles)}</strong></div>
        <div><span>现金续航</span><strong>{cyclesLabel(diagnosis.cashCycles)}</strong><small>每周期 {formatCurrency(diagnosis.cashPerCycle)}</small></div>
        <div><span>仓库余量</span><strong>{cyclesLabel(diagnosis.warehouseCycles)}</strong><small>每周期入库 {formatNumber(diagnosis.outputPerCycle)}</small></div>
        <div><span>第一瓶颈</span><strong>{diagnosis.bottleneck.label}</strong><small>{cyclesLabel(diagnosis.bottleneck.cycles)}</small></div>
      </div>
      {diagnosis.inputRows.length > 0 ? (
        <div className="facility-operating-diagnostics__inputs" aria-label="原料续航明细">
          {diagnosis.inputRows.map((item) => (
            <div key={item.productId}>
              <ProductArtwork productId={item.productId} />
              <span><strong>{productNames.get(item.productId) ?? item.productId}</strong><small>每周期需 {formatNumber(item.requiredPerCycle)} · 可用 {formatNumber(item.available)}</small></span>
              <span>{cyclesLabel(item.supportedCycles)}{item.shortfallThisCycle > 0 ? ` · 缺 ${formatNumber(item.shortfallThisCycle)}` : ''}</span>
            </div>
          ))}
        </div>
      ) : null}
      <div className="facility-operating-diagnostics__markets" aria-label="上下游真实成交信号">
        {marketProductIds.map((productId) => {
          const signal = marketDecisionSignal(markets[productId]);
          const role = productId === recipe.output.productId ? '产出' : '投入';
          return (
            <div key={productId}>
              <span>{role}</span>
              <ProductArtwork productId={productId} />
              <strong>{productNames.get(productId) ?? productId}</strong>
              <span>{signal.price === null ? '暂无真实成交' : `${formatCurrency(signal.price)} ${marketTrendGlyph(signal.trend)}`}</span>
            </div>
          );
        })}
      </div>
      <p className="ui-helper-text">该区域只展示当前经营事实，不自动推荐最高利润产物、配方、采购或出售动作。</p>
    </section>
  );
}
""")
write('src/styles/facility-operating-diagnostics.css', """.facility-operating-diagnostics {
  display: grid;
  gap: var(--space-3);
}

.facility-operating-diagnostics__heading,
.facility-operating-diagnostics__heading > div,
.facility-operating-diagnostics__inputs > div,
.facility-operating-diagnostics__markets > div {
  display: flex;
  align-items: center;
}

.facility-operating-diagnostics__heading {
  justify-content: space-between;
  gap: var(--space-3);
}

.facility-operating-diagnostics__heading > div {
  align-items: flex-start;
  flex-direction: column;
  gap: var(--space-1);
}

.facility-operating-diagnostics__heading small,
.facility-operating-diagnostics__metrics small,
.facility-operating-diagnostics__inputs small {
  color: var(--text-muted);
}

.facility-operating-diagnostics__heading > span {
  color: var(--text-warning);
  font-weight: 700;
}

.facility-operating-diagnostics__metrics {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--space-2);
}

.facility-operating-diagnostics__metrics > div {
  display: grid;
  gap: var(--space-1);
  min-width: 0;
  padding: var(--space-2);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  background: var(--surface-muted);
}

.facility-operating-diagnostics__metrics > div > span,
.facility-operating-diagnostics__markets > div > span:first-child {
  color: var(--text-muted);
  font-size: var(--font-size-xs);
}

.facility-operating-diagnostics__inputs,
.facility-operating-diagnostics__markets {
  display: grid;
  gap: var(--space-2);
}

.facility-operating-diagnostics__inputs > div,
.facility-operating-diagnostics__markets > div {
  gap: var(--space-2);
  min-width: 0;
}

.facility-operating-diagnostics__inputs img,
.facility-operating-diagnostics__markets img {
  width: 28px;
  height: 28px;
  flex: 0 0 28px;
}

.facility-operating-diagnostics__inputs > div > span:nth-of-type(1) {
  display: grid;
  min-width: 0;
  margin-right: auto;
}

.facility-operating-diagnostics__markets > div > strong {
  margin-right: auto;
}

@media (max-width: 720px) {
  .facility-operating-diagnostics__metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .facility-operating-diagnostics__heading {
    align-items: flex-start;
  }
}
""")

replace_once(
    'src/pages/production/ProductionFacilityDetail.tsx',
    "import { FacilityRecipeProfitAnalysis } from '../../components/facilities/FacilityRecipeProfitAnalysis';",
    "import { FacilityRecipeProfitAnalysis } from '../../components/facilities/FacilityRecipeProfitAnalysis';\nimport { FacilityOperatingDiagnostics } from '../../components/facilities/FacilityOperatingDiagnostics';",
)
replace_once(
    'src/pages/production/ProductionFacilityDetail.tsx',
    "  ProductInventory,\n} from '../../types';",
    "  ProductInventory,\n  ProductMarketState,\n} from '../../types';",
)
replace_once(
    'src/pages/production/ProductionFacilityDetail.tsx',
    """  products: ProductDefinition[];\n  inventories: Record<string, ProductInventory>;\n  now: number;""",
    """  products: ProductDefinition[];\n  inventories: Record<string, ProductInventory>;\n  markets: Record<string, ProductMarketState>;\n  credits: number;\n  warehouseAvailableCapacity: number;\n  now: number;""",\)
replace_once(
    'src/pages/production/ProductionFacilityDetail.tsx',
    """export function FacilityClusterDetailBody({\n  entry,\n  products,\n  inventories,\n  now,\n  onRecipeChange,\n}: Omit<FacilityClusterDetailSharedProps, 'onToggle' | 'onOpenMarket'>) {\n  const { group, type } = entry;\n  const recipeState = resolveFacilityDetailRecipeState(entry);""",
    """export function FacilityClusterDetailBody({\n  entry,\n  products,\n  inventories,\n  markets,\n  credits,\n  warehouseAvailableCapacity,\n  now,\n  onRecipeChange,\n}: Omit<FacilityClusterDetailSharedProps, 'onToggle' | 'onOpenMarket'>) {\n  const { group, type } = entry;\n  const recipeState = resolveFacilityDetailRecipeState(entry);\n  const operatingScope = currentFormulaScope(group, now);""",\)
insert_after(
    'src/pages/production/ProductionFacilityDetail.tsx',
    """      <FacilityProductionFormula\n        group={group}\n        type={recipeState.formulaType}\n        products={products}\n        inventories={inventories}\n        now={now}\n      />\n""",
    """      <FacilityOperatingDiagnostics\n        recipe={recipeState.activeRecipe}\n        productionCount={operatingScope.count}\n        products={products}\n        inventories={inventories}\n        markets={markets}\n        credits={credits}\n        warehouseAvailableCapacity={warehouseAvailableCapacity}\n      />\n""",\)
replace_once(
    'src/pages/production/ProductionFacilityDetail.tsx',
    """  products,\n  inventories,\n  now,\n  onToggle,""",
    """  products,\n  inventories,\n  markets,\n  credits,\n  warehouseAvailableCapacity,\n  now,\n  onToggle,""",\)
replace_once(
    'src/pages/production/ProductionFacilityDetail.tsx',
    """        products={products}\n        inventories={inventories}\n        now={now}\n        onRecipeChange={onRecipeChange}""",
    """        products={products}\n        inventories={inventories}\n        markets={markets}\n        credits={credits}\n        warehouseAvailableCapacity={warehouseAvailableCapacity}\n        now={now}\n        onRecipeChange={onRecipeChange}""",\)
replace_once(
    'src/pages/ProductionPage.tsx',
    """                products={game.products}\n                inventories={game.inventories}\n                now={now}""",
    """                products={game.products}\n                inventories={game.inventories}\n                markets={game.markets}\n                credits={game.credits}\n                warehouseAvailableCapacity={game.warehouseAvailableCapacity}\n                now={now}""",\)
replace_once(
    'src/pages/ProductionPage.tsx',
    """        products={game.products}\n        inventories={game.inventories}\n        now={now}\n        isOpen={isFacilityDetailOpen}""",
    """        products={game.products}\n        inventories={game.inventories}\n        markets={game.markets}\n        credits={game.credits}\n        warehouseAvailableCapacity={game.warehouseAvailableCapacity}\n        now={now}\n        isOpen={isFacilityDetailOpen}""",\)

# Phase 2: research industry decision context ---------------------------------------
replace_once('src/pages/ResearchPage.tsx', "import { formatDuration, formatNumber } from '../utils/formatters';", "import { formatCurrency, formatDuration, formatNumber } from '../utils/formatters';\nimport { marketDecisionSignal, marketTrendGlyph } from '../utils/marketDecisionSignals';")
insert_after(
    'src/pages/ResearchPage.tsx',
    """      </section>\n\n      {isSelectedActive && active ? (""",
    """\n      <section className=\"research-industry-context mobile-detail-section\" aria-label=\"产业经营视角\">\n        <div className=\"research-industry-context__heading\">\n          <strong>产业经营视角</strong>\n          <small>科技只决定准入；以下使用当前持有资产、库存与最近真实成交价辅助判断产业方向。</small>\n        </div>\n        <div className=\"research-industry-context__list\">\n          {facilities.map((facility) => {\n            const recipe = facility.recipes.find((candidate) => candidate.id === facility.defaultRecipeId) ?? facility.recipes[0];\n            const held = model.game.facilityGroups.find((group) => group.facilityTypeId === facility.id)?.count ?? 0;\n            const inputs = recipe?.inputs ?? [];\n            const output = recipe?.output;\n            const signalText = (productId: string) => {\n              const product = model.game.products.find((candidate) => candidate.id === productId);\n              const signal = marketDecisionSignal(model.game.markets[productId]);\n              const inventory = model.game.inventories[productId]?.available ?? 0;\n              return `${product?.name ?? productId} · 库存 ${formatNumber(inventory)} · ${signal.price === null ? '暂无真实成交' : `${formatCurrency(signal.price)} ${marketTrendGlyph(signal.trend)}`}`;\n            };\n            return (\n              <article className=\"research-industry-context__item\" key={facility.id}>\n                <header>\n                  <span aria-hidden=\"true\"><FacilityIcon facilityTypeId={facility.id} /></span>\n                  <strong>{facility.name}</strong>\n                  <StatusTag tone={held > 0 ? 'success' : 'neutral'}>{held > 0 ? `持有 ${formatNumber(held)}` : '未持有'}</StatusTag>\n                </header>\n                <DataList className=\"compact\">\n                  <DataRow label=\"主要投入\" value={inputs.length > 0 ? inputs.map((input) => signalText(input.productId)).join('；') : '无原料生产'} />\n                  <DataRow label=\"产出市场\" value={output ? signalText(output.productId) : '—'} />\n                </DataList>\n              </article>\n            );\n          })}\n          {facilities.length === 0 ? <p className=\"ui-helper-text\">该科技没有直接解锁工厂，经营影响由后续科技节点体现。</p> : null}\n        </div>\n        <p className=\"ui-helper-text\">不提供“最佳科技”或最高利润自动推荐，玩家仍需结合供需、资金和产业链自行选择。</p>\n      </section>\n""",\)
append_once('src/styles/research-page.css', '.research-industry-context__list {', """
.research-industry-context {
  display: grid;
  gap: var(--space-3);
}

.research-industry-context__heading {
  display: grid;
  gap: var(--space-1);
}

.research-industry-context__heading small {
  color: var(--text-muted);
}

.research-industry-context__list {
  display: grid;
  gap: var(--space-2);
}

.research-industry-context__item {
  display: grid;
  gap: var(--space-2);
  padding: var(--space-3);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  background: var(--surface-muted);
}

.research-industry-context__item > header {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.research-industry-context__item > header > span:first-child {
  width: 32px;
  height: 32px;
  display: inline-grid;
  place-items: center;
}

.research-industry-context__item > header > strong {
  margin-right: auto;
}
""")

# Phase 3: contract performance profile ---------------------------------------------
insert_after(
    'server/src/contract-audit-store.js',
    """  store.listContractAuditHistory = (user, rawOptions = {}) => store.transaction(() => {""",
    """\n""",\)
# Insert the new method immediately before the existing detail method for a stable API surface.
replace_once(
    'server/src/contract-audit-store.js',
    """  store.getContractAuditDetail = (user, contractId, rawOptions = {}) => store.transaction(() => {""",
    """  store.getContractPerformance = (user) => store.transaction(() => {\n    const userId = Number(user.id);\n    const rows = store.database.prepare(`\n      SELECT * FROM economy_contract_audit_contracts\n      WHERE status NOT IN ('open', 'active')\n        AND (publisher_id = ? OR buyer_id = ? OR supplier_id = ?)\n      ORDER BY sort_at DESC, contract_id DESC\n    `).all(userId, userId, userId);\n    const settlementSummaries = contractHistorySettlementSummaries(store, rows, userId);\n    const history = rows.map((row) => publicHistoryRow(\n      row, userId, settlementSummaries.get(String(row.contract_id)) || emptyHistorySettlement(),\n    ));\n    const completed = history.filter((item) => item.status === 'completed').length;\n    const defaulted = history.filter((item) => (\n      /default/.test(String(item.endSummary?.reasonCode || ''))\n      || item.endSummary?.reasonCode === 'immediate_by_participant'\n    )).length;\n    const compensationPaid = roundInternalMoney(history.reduce(\n      (sum, item) => sum + Number(item.endSummary?.settlement?.compensationPaidByMe || 0), 0,\n    )) || 0;\n    const compensationReceived = roundInternalMoney(history.reduce(\n      (sum, item) => sum + Number(item.endSummary?.settlement?.compensationReceivedByMe || 0), 0,\n    )) || 0;\n    return {\n      totalEnded: history.length,\n      completed,\n      abnormalEnded: Math.max(0, history.length - completed),\n      defaulted,\n      completionRateBps: history.length > 0 ? Math.round(completed * 10_000 / history.length) : 0,\n      compensationPaid,\n      compensationReceived,\n      recent: history.slice(0, 5).map((item) => ({\n        id: item.id,\n        kind: item.kind,\n        status: item.status,\n        endedAt: item.endSummary.endedAt,\n        reasonCode: item.endSummary.reasonCode,\n        completionRatioBps: item.endSummary.completion.ratioBps,\n      })),\n    };\n  }, { immediate: false });\n\n  store.getContractAuditDetail = (user, contractId, rawOptions = {}) => store.transaction(() => {""",\)
replace_once(
    'server/src/app.js',
    """    if (method === 'GET' && path === '/api/game/contracts/history') {""",
    """    if (method === 'GET' && path === '/api/game/contracts/performance') {\n      sendJson(response, 200, { performance: store.getContractPerformance(user) });\n      return;\n    }\n\n    if (method === 'GET' && path === '/api/game/contracts/history') {""",\)
replace_once(
    'server/src/app.js',
    """          status: url.searchParams.get('status'),\n          productId: url.searchParams.get('productId'),""",
    """          status: url.searchParams.get('status'),\n          kind: url.searchParams.get('kind'),\n          productId: url.searchParams.get('productId'),""",\)
insert_after(
    'src/contracts/types.ts',
    """export interface ContractAuditHistoryPage {\n  items: ContractAuditHistoryItem[];\n  nextCursor: string | null;\n}\n""",
    """\nexport interface ContractPerformanceRecentItem {\n  id: string;\n  kind: ContractKind;\n  status: ProductionContractStatus;\n  endedAt: number;\n  reasonCode: string;\n  completionRatioBps: number;\n}\n\nexport interface ContractPerformanceSummary {\n  totalEnded: number;\n  completed: number;\n  abnormalEnded: number;\n  defaulted: number;\n  completionRateBps: number;\n  compensationPaid: number;\n  compensationReceived: number;\n  recent: ContractPerformanceRecentItem[];\n}\n""",\)
replace_once(
    'src/contracts/api.ts',
    """  ContractAuditHistoryPage,\n  ContractAuditDetail,""",
    """  ContractAuditHistoryPage,\n  ContractAuditDetail,\n  ContractPerformanceSummary,""",\)
insert_after(
    'src/contracts/api.ts',
    """export const productionContractAudit = {\n""",
    """  performance: async () => (await get<{ performance: ContractPerformanceSummary }>('/contracts/performance')).performance,\n""",\)
replace_once(
    'src/pages/ContractPage.tsx',
    """  type ContractAuditHistoryItem,\n  type ContractKind,""",
    """  type ContractAuditHistoryItem,\n  type ContractKind,\n  type ContractPerformanceSummary,""",\)
insert_after(
    'src/pages/ContractPage.tsx',
    """  const [republishContract, setRepublishContract] = useState<ContractAuditHistoryItem | null>(null);\n""",
    """  const [contractPerformance, setContractPerformance] = useState<ContractPerformanceSummary | null>(null);\n  const [contractPerformanceError, setContractPerformanceError] = useState('');\n""",\)
insert_after(
    'src/pages/ContractPage.tsx',
    """  const pendingContracts = activeContracts.filter(contractNeedsAttention);\n""",
    """\n  useEffect(() => {\n    let cancelled = false;\n    void productionContractAudit.performance()\n      .then((performance) => { if (!cancelled) setContractPerformance(performance); })\n      .catch((reason) => { if (!cancelled) setContractPerformanceError(reason instanceof Error ? reason.message : '履约档案读取失败'); });\n    return () => { cancelled = true; };\n  }, []);\n""",\)
insert_after(
    'src/pages/ContractPage.tsx',
    """      <div className=\"contract-summary-grid\">\n        <MetricCard label=\"进行中的合同\" value={formatNumber(productionContractSummary.active)} detail=\"供货、借贷或租赁\" tone=\"info\" />\n        <MetricCard label=\"等待我处理\" value={formatNumber(productionContractSummary.needsAttention)} detail=\"商品、货款或仓库异常\" tone={productionContractSummary.needsAttention ? 'warning' : 'success'} />\n        <MetricCard label=\"24 小时内交付\" value={formatNumber(productionContractSummary.upcomingWithin24Hours)} detail=\"即将到期批次\" />\n        <MetricCard label=\"我的公开合同\" value={formatNumber(productionContractSummary.open)} detail=\"尚未被其他玩家承接\" />\n      </div>\n""",
    """\n      <PagePanel className=\"contract-performance-panel\">\n        <WidgetHeading title=\"我的履约档案\" action={<StatusTag tone=\"info\">真实合同历史</StatusTag>} />\n        {contractPerformance ? (\n          <>\n            <div className=\"contract-performance-grid\">\n              <MetricCard label=\"已结束合同\" value={formatNumber(contractPerformance.totalEnded)} />\n              <MetricCard label=\"正常完成\" value={formatNumber(contractPerformance.completed)} detail={`完成率 ${(contractPerformance.completionRateBps / 100).toFixed(1)}%`} tone=\"success\" />\n              <MetricCard label=\"异常结束\" value={formatNumber(contractPerformance.abnormalEnded)} tone={contractPerformance.abnormalEnded > 0 ? 'warning' : 'neutral'} />\n              <MetricCard label=\"违约／主动违约\" value={formatNumber(contractPerformance.defaulted)} tone={contractPerformance.defaulted > 0 ? 'danger' : 'neutral'} />\n              <MetricCard label=\"累计赔付\" value={<CurrencyAmount>{formatCurrency(contractPerformance.compensationPaid)}</CurrencyAmount>} detail={`累计获得 ${formatCurrency(contractPerformance.compensationReceived)}`} />\n            </div>\n            {contractPerformance.recent.length > 0 ? (\n              <div className=\"contract-performance-recent\" aria-label=\"近期合同结果\">\n                {contractPerformance.recent.map((item) => (\n                  <div key={item.id}>\n                    <StatusTag tone={item.status === 'completed' ? 'success' : 'warning'}>{item.kind === 'supply' ? '商品合作' : item.kind === 'loan' ? '资金借贷' : '工厂租赁'}</StatusTag>\n                    <strong>{END_REASON_LABELS[item.reasonCode] ?? item.reasonCode}</strong>\n                    <span>完成 {(item.completionRatioBps / 100).toFixed(0)}% · {dateTimeLabel(item.endedAt)}</span>\n                  </div>\n                ))}\n              </div>\n            ) : <p className=\"ui-helper-text\">暂无已结束合同，履约事实会在合同结束后自动累计。</p>}\n          </>\n        ) : <p className={contractPerformanceError ? 'contract-issue' : 'ui-helper-text'}>{contractPerformanceError || '正在读取履约档案…'}</p>}\n        <p className=\"ui-helper-text\">只展示真实完成、异常结束、赔付和近期结果，不生成星级、信用等级或主观评分。</p>\n      </PagePanel>\n""",\)
append_once('src/styles/contracts.css', '.contract-performance-panel {', """
.contract-performance-panel {
  display: grid;
  gap: var(--space-3);
}

.contract-performance-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: var(--space-2);
}

.contract-performance-recent {
  display: grid;
  gap: var(--space-2);
}

.contract-performance-recent > div {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--space-2);
  padding-block: var(--space-2);
  border-top: 1px solid var(--border-subtle);
}

.contract-performance-recent > div > span:last-child {
  color: var(--text-muted);
  font-size: var(--font-size-xs);
}

@media (max-width: 960px) {
  .contract-performance-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 560px) {
  .contract-performance-recent > div {
    grid-template-columns: auto minmax(0, 1fr);
  }
  .contract-performance-recent > div > span:last-child {
    grid-column: 1 / -1;
  }
}
""")

# Phase 4: leaderboard current-segment goals ----------------------------------------
write('src/utils/leaderboardGoals.ts', """import type { RankedLeaderboardBoard } from '../leaderboardTypes';

export interface PersonalLeaderboardGoal {
  bandLabel: string;
  targetLabel: string;
  targetRank: number;
  distance: number;
}

function targetRank(totalPlayers: number, share: number) {
  return Math.max(1, Math.ceil(Math.max(1, totalPlayers) * share));
}

export function personalLeaderboardGoal(board: RankedLeaderboardBoard): PersonalLeaderboardGoal | null {
  const rank = Number(board.currentPlayer?.rank);
  const totalPlayers = Math.max(0, Number(board.totalPlayers) || 0);
  if (!Number.isInteger(rank) || rank <= 0 || totalPlayers <= 0) return null;
  const top50 = targetRank(totalPlayers, 0.5);
  const top25 = targetRank(totalPlayers, 0.25);
  const top10 = targetRank(totalPlayers, 0.1);
  const bandLabel = rank <= top10 ? '前 10%' : rank <= top25 ? '前 25%' : rank <= top50 ? '前 50%' : '前 100%';
  let nextRank = 1;
  let targetLabel = '榜首';
  if (rank > top50) { nextRank = top50; targetLabel = '前 50%'; }
  else if (rank > top25) { nextRank = top25; targetLabel = '前 25%'; }
  else if (rank > top10) { nextRank = top10; targetLabel = '前 10%'; }
  else if (rank > 3) { nextRank = Math.min(3, totalPlayers); targetLabel = '前三'; }
  else if (rank === 1) { nextRank = 1; targetLabel = '保持榜首'; }
  return { bandLabel, targetLabel, targetRank: nextRank, distance: Math.max(0, rank - nextRank) };
}
""")
replace_once('src/pages/LeaderboardPage.tsx', "import { formatCurrency, formatNumber, formatRank } from '../utils/formatters';", "import { formatCurrency, formatNumber, formatRank } from '../utils/formatters';\nimport { personalLeaderboardGoal } from '../utils/leaderboardGoals';")
replace_once(
    'src/pages/LeaderboardPage.tsx',
    """        {leaderboards.map((board) => (\n          <PagePanel className=\"leaderboard-board-card\" key={board.id}>""",
    """        {leaderboards.map((board) => {\n          const personalGoal = personalLeaderboardGoal(board);\n          return (\n          <PagePanel className=\"leaderboard-board-card\" key={board.id}>""",\)
replace_once(
    'src/pages/LeaderboardPage.tsx',
    """            <footer className=\"leaderboard-current-player\">\n              <span>我的排名 <strong>{formatRank(board.currentPlayer?.rank)}</strong></span>\n              <span>我的成绩 <strong>{board.currentPlayer ? scoreLabel(board, board.currentPlayer.score) : '—'}</strong></span>\n              <small>全服 {formatNumber(board.totalPlayers)} 名玩家</small>\n            </footer>\n          </PagePanel>\n        ))}""",
    """            <footer className=\"leaderboard-current-player\">\n              <span>我的排名 <strong>{formatRank(board.currentPlayer?.rank)}</strong></span>\n              <span>我的成绩 <strong>{board.currentPlayer ? scoreLabel(board, board.currentPlayer.score) : '—'}</strong></span>\n              <small>全服 {formatNumber(board.totalPlayers)} 名玩家</small>\n            </footer>\n            {personalGoal ? (\n              <div className=\"leaderboard-personal-goal\" aria-label={`${board.title}个人竞争目标`}>\n                <span>当前 {personalGoal.bandLabel}</span>\n                <strong>{personalGoal.targetLabel}</strong>\n                <small>{personalGoal.distance > 0 ? `距离目标还差 ${formatNumber(personalGoal.distance)} 名` : '当前目标已达成'}</small>\n              </div>\n            ) : null}\n          </PagePanel>\n          );\n        })}""",\)
append_once('src/styles/leaderboards.css', '.leaderboard-personal-goal {', """
.leaderboard-personal-goal {
  display: grid;
  grid-template-columns: auto auto minmax(0, 1fr);
  align-items: center;
  gap: var(--space-2);
  margin-top: var(--space-2);
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  background: var(--surface-muted);
}

.leaderboard-personal-goal > span,
.leaderboard-personal-goal > small {
  color: var(--text-muted);
}

.leaderboard-personal-goal > small {
  text-align: right;
}

@media (max-width: 560px) {
  .leaderboard-personal-goal {
    grid-template-columns: auto 1fr;
  }
  .leaderboard-personal-goal > small {
    grid-column: 1 / -1;
    text-align: left;
  }
}
""")

# Phase 5: completed economic-event feedback ----------------------------------------
replace_once('server/src/economic-events.js', "const EVENT_DURATION_MS = DAY_MS;", "const EVENT_DURATION_MS = DAY_MS;\nconst EVENT_RESULT_WINDOW_MS = DAY_MS;")
replace_once(
    'server/src/economic-events.js',
    """    .filter((event) => event.endsAt > now && event.startsAt <= visibleUntil)""",
    """    .filter((event) => event.endsAt > now - EVENT_RESULT_WINDOW_MS && event.startsAt <= visibleUntil)""",\)
replace_once('src/pages/OverviewPage.tsx', "import { orderAssetId, orderKind } from '../utils/orderIdentity';", "import { orderAssetId, orderKind } from '../utils/orderIdentity';\nimport { eventMarketFeedback } from '../utils/marketDecisionSignals';")
insert_after(
    'src/pages/OverviewPage.tsx',
    """function greetingForHour(hour: number) {\n  if (hour < 5) return '凌晨好';\n  if (hour < 12) return '早上好';\n  if (hour < 14) return '中午好';\n  if (hour < 18) return '下午好';\n  return '晚上好';\n}\n""",
    """\nfunction signedPercentBps(value: number | null) {\n  if (value === null) return '暂无足够成交';\n  const sign = value > 0 ? '+' : value < 0 ? '−' : '';\n  return `${sign}${(Math.abs(value) / 100).toFixed(1)}%`;\n}\n""",\)
replace_once('src/pages/OverviewPage.tsx', '    title="公开经济事件日历"\n    action={<StatusTag tone="info">未来 7 天</StatusTag>}', '    title="公开经济事件日历"\n    action={<StatusTag tone="info">近期结果 + 未来 7 天</StatusTag>}')
replace_once('src/pages/OverviewPage.tsx', '  <div className="overview-economic-event-list" role="list" aria-label="未来七天公开经济事件">', '  <div className="overview-economic-event-list" role="list" aria-label="近期与未来七天公开经济事件">')
replace_once(
    'src/pages/OverviewPage.tsx',
    """    {economicEvents.map((event) => {\n      const active = event.startsAt <= now && now < event.endsAt;\n      const upcoming = now < event.startsAt;\n      const remaining = active ? event.endsAt - now : event.startsAt - now;\n      const products = event.productIds.map((id) => productNames.get(id) || id).join('、');\n      return (\n        <article className={`overview-economic-event${active ? ' is-active' : ''}`} key={event.id} role=\"listitem\">\n          <header>\n            <StatusTag tone={active ? 'success' : 'info'}>{active ? '生效中' : '即将开始'}</StatusTag>\n            <time dateTime={new Date(event.startsAt).toISOString()}>{formatTime(event.startsAt)}</time>\n          </header>\n          <strong>{event.title}</strong>\n          <p>{event.description}</p>\n          <small>重点类别：{event.classLabels.join('、')} · 重点商品：{products}</small>\n          <span>{active ? '距离结束' : upcoming ? '距离开始' : '等待服务器更新'} {formatDuration(Math.max(0, remaining))}</span>\n        </article>\n      );\n    })}\n    {economicEvents.length === 0 ? <EmptyState>未来七天暂无已公布的经济事件。</EmptyState> : null}""",
    """    {economicEvents.map((event) => {\n      const completed = event.endsAt <= now;\n      const active = event.startsAt <= now && now < event.endsAt;\n      const upcoming = now < event.startsAt;\n      const remaining = active ? event.endsAt - now : event.startsAt - now;\n      const products = event.productIds.map((id) => productNames.get(id) || id).join('、');\n      const feedback = completed ? eventMarketFeedback(game.markets, event.productIds, event.startsAt, event.endsAt) : null;\n      return (\n        <article className={`overview-economic-event${active ? ' is-active' : ''}${completed ? ' is-completed' : ''}`} key={event.id} role=\"listitem\">\n          <header>\n            <StatusTag tone={active ? 'success' : completed ? 'neutral' : 'info'}>{active ? '生效中' : completed ? '已结束' : '即将开始'}</StatusTag>\n            <time dateTime={new Date(event.startsAt).toISOString()}>{formatTime(event.startsAt)}</time>\n          </header>\n          <strong>{event.title}</strong>\n          <p>{event.description}</p>\n          <small>重点类别：{event.classLabels.join('、')} · 重点商品：{products}</small>\n          {completed && feedback ? (\n            <span className=\"overview-economic-event-feedback\">\n              事件窗口真实成交 {formatNumber(feedback.volume)} 件 · 平均价格变化 {signedPercentBps(feedback.averageChangeBps)}\n            </span>\n          ) : (\n            <span>{active ? '距离结束' : upcoming ? '距离开始' : '等待服务器更新'} {formatDuration(Math.max(0, remaining))}</span>\n          )}\n        </article>\n      );\n    })}\n    {economicEvents.length === 0 ? <EmptyState>近期与未来七天暂无已公布的经济事件。</EmptyState> : null}""",\)
append_once('src/styles/overview.css', '.overview-economic-event.is-completed {', """
.overview-economic-event.is-completed {
  opacity: 0.88;
}

.overview-economic-event-feedback {
  color: var(--text-muted);
  font-size: var(--font-size-sm);
}
""")

# Tests and anti-regression -----------------------------------------------------------
insert_after(
    'server/test/tutorial-store.test.js',
    """    assert.equal(\n      tutorialStore.getStatus(oldUser.id).completedVersion,\n      CURRENT_TUTORIAL_VERSION,\n    );\n""",
    """    assert.equal(\n      store.database.prepare('SELECT completion_source FROM economy_tutorial_completions WHERE user_id = ?').get(oldUser.id)?.completion_source,\n      'migration',\n    );\n""",\)
insert_after(
    'server/test/tutorial-store.test.js',
    """    assert.equal(first.tutorial.completedAt, 3_000);\n""",
    """    assert.equal(\n      store.database.prepare('SELECT completion_source FROM economy_tutorial_completions WHERE user_id = ?').get(newUser.id)?.completion_source,\n      'player',\n    );\n""",\)
insert_after(
    'server/test/contract-audit.test.js',
    """  assert.equal(history.items[0].endSummary.settlement.compensationReceivedByMe, 0);\n""",
    """\n  const performance = store.getContractPerformance(buyerUser);\n  assert.equal(performance.totalEnded, 1);\n  assert.equal(performance.completed, 1);\n  assert.equal(performance.abnormalEnded, 0);\n  assert.equal(performance.defaulted, 0);\n  assert.equal(performance.completionRateBps, 10_000);\n  assert.equal(performance.recent[0].reasonCode, 'completed');\n""",\)
insert_after(
    'server/test/contract-audit.test.js',
    """  assert.equal(supplierHistory.endSummary.settlement.compensationReceivedByMe, 0);\n""",
    """  const buyerPerformance = store.getContractPerformance(buyerUser);\n  const supplierPerformance = store.getContractPerformance(supplierUser);\n  assert.equal(buyerPerformance.abnormalEnded, 1);\n  assert.equal(buyerPerformance.defaulted, 1);\n  assert.equal(buyerPerformance.compensationReceived, 60);\n  assert.equal(supplierPerformance.compensationPaid, 60);\n""",\)
replace_once(
    'server/test/economic-events.test.js',
    "test('公开经济事件日历只返回当前与未来七天事件，并在同一事件窗口内保持确定性', () => {",
    "test('公开经济事件日历保留最近一天已结束事件并返回未来七天事件，且窗口内保持确定性', () => {",\)
replace_once(
    'server/test/economic-events.test.js',
    "  assert.ok(first.events.every((event) => event.endsAt > now && event.startsAt <= now + 7 * 24 * 60 * 60 * 1000));",
    "  assert.ok(first.events.every((event) => event.endsAt > now - 24 * 60 * 60 * 1000 && event.startsAt <= now + 7 * 24 * 60 * 60 * 1000));",\)
insert_after(
    'server/test/economic-events.test.js',
    """  assert.ok(nextEconomicEventDeadline(now) > now);\n});\n""",
    """\ntest('事件结束后一天内继续公开结果窗口', () => {\n  const now = ECONOMIC_EVENT_EPOCH_MS + 30 * 60 * 60 * 1000;\n  const calendar = createEconomicCalendarClientState(now);\n  assert.ok(calendar.events.some((event) => event.endsAt <= now));\n  assert.ok(calendar.events.every((event) => event.endsAt > now - 24 * 60 * 60 * 1000));\n});\n""",\)

# Extend admin statistics test with precise milestone columns; static assertions below protect funnel semantics.
insert_after(
    'server/test/player-admin-statistics.test.js',
    """    assert.equal(activity.trade_quantity, 0);\n""",
    """\n    const research = store.apply(player, {\n      action: 'startResearch',\n      payload: { technologyId: 'forestry-development' },\n      requestKey: 'player-stats-research-1',\n      method: 'POST',\n      path: '/api/game/research/start',\n    }, now + 10);\n    assert.equal(research.result.ok, true);\n    const deposit = store.apply(player, {\n      action: 'bankDeposit',\n      payload: { amount: 10 },\n      requestKey: 'player-stats-bank-1',\n      method: 'POST',\n      path: '/api/game/bank/deposits',\n    }, now + 20);\n    assert.equal(deposit.result.ok, true);\n    const milestones = store.database.prepare('SELECT first_research_at, first_bank_deposit_at FROM economy_player_milestones WHERE user_id = ?').get(player.id);\n    assert.equal(milestones.first_research_at, now + 10);\n    assert.equal(milestones.first_bank_deposit_at, now + 20);\n""",\)

write('scripts/verify-gameplay-decision-support.mjs', """import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildFacilityOperatingDiagnosis } from '../src/utils/facilityOperatingDiagnostics.ts';
import { eventMarketFeedback, marketDecisionSignal } from '../src/utils/marketDecisionSignals.ts';
import { personalLeaderboardGoal } from '../src/utils/leaderboardGoals.ts';

function read(path) { return readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'); }
function requireText(path, text) { if (!read(path).includes(text)) throw new Error(`${path} 缺少: ${text}`); }
function forbidText(path, text) { if (read(path).includes(text)) throw new Error(`${path} 不应包含: ${text}`); }

const diagnosis = buildFacilityOperatingDiagnosis({
  recipe: { id: 'r', name: 'r', cycleMs: 60_000, operatingCost: 10, inputs: [{ productId: 'wheat', quantity: 2 }], output: { productId: 'flour', quantity: 1 } },
  productionCount: 2,
  inventories: { wheat: { available: 5, frozen: 0 } },
  credits: 100,
  warehouseAvailableCapacity: 6,
});
assert.equal(diagnosis.inputCycles, 1);
assert.equal(diagnosis.cashCycles, 5);
assert.equal(diagnosis.warehouseCycles, 3);
assert.equal(diagnosis.bottleneck.id, 'inputs');

const market = {
  productId: 'wheat', lastPrice: 12, lastTradePrice: 12,
  priceHistory: [
    { price: 99, quantity: 9, createdAt: 1 },
    { price: 10, quantity: 2, createdAt: 2, takerSide: 'buy' },
    { price: 12, quantity: 3, createdAt: 3, takerSide: 'sell' },
  ],
  demand: { cycleMs: 1, nextDemandAt: 1, lastBudget: 1, lastQuantity: 1, lastPrice: 1, satisfaction: 1 },
};
assert.equal(marketDecisionSignal(market).changeBps, 2000);
const feedback = eventMarketFeedback({ wheat: market }, ['wheat'], 2, 3);
assert.equal(feedback.volume, 5);
assert.equal(feedback.averageChangeBps, 2000);

const goal = personalLeaderboardGoal({
  id: 'wealth', title: '财富榜', description: '', unit: 'currency', rewarded: false,
  entries: [], currentPlayer: { userId: 1, playerName: 'P', rank: 30, score: 1, isCurrentPlayer: true }, totalPlayers: 100,
});
assert.equal(goal?.bandLabel, '前 50%');
assert.equal(goal?.targetLabel, '前 25%');
assert.equal(goal?.distance, 5);

for (const text of ['first_research_at', 'first_bank_deposit_at', 'gameplay_strategy_funnel_coverage_started_at', 'completion_source = \'player\'']) requireText('server/src/player-admin-statistics.js', text);
requireText('server/src/tutorial-store.js', "completion_source IN ('legacy', 'migration', 'player')");
requireText('src/components/facilities/FacilityOperatingDiagnostics.tsx', '不自动推荐最高利润产物');
requireText('src/pages/ResearchPage.tsx', '产业经营视角');
requireText('server/src/contract-audit-store.js', 'store.getContractPerformance');
requireText('src/pages/ContractPage.tsx', '我的履约档案');
requireText('src/pages/LeaderboardPage.tsx', 'leaderboard-personal-goal');
requireText('src/pages/OverviewPage.tsx', '事件窗口真实成交');
requireText('server/src/economic-events.js', 'EVENT_RESULT_WINDOW_MS');
forbidText('src/components/facilities/FacilityOperatingDiagnostics.tsx', '最佳配方');
forbidText('src/pages/ResearchPage.tsx', '最佳科技推荐');
forbidText('src/pages/ContractPage.tsx', '信用等级');
requireText('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', '经营决策支持固定边界');
requireText('docs/INDUSTRY_AND_PRODUCTION_DESIGN.md', '工厂经营诊断');
requireText('docs/GIFT_CODE_AND_ADMIN_DESIGN.md', '完整经营漏斗覆盖起点');
requireText('docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md', 'completion_source');

console.log('Gameplay decision support verification passed.');
""")

# Authoritative design ---------------------------------------------------------------
replace_once(
    'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
    '- 概览是公开经济事件日历的唯一玩家页面归属，完整展示当前与未来七天事件、开始／结束时间、受影响类别与商品，并明确总预算不变；市场页不得重复该日历；',
    '- 概览是公开经济事件日历的唯一玩家页面归属，完整展示最近 24 小时已结束事件、当前与未来七天事件、开始／结束时间、受影响类别与商品，并明确总预算不变；已结束事件额外展示事件窗口内重点商品的真实成交量与平均价格变化，只作为事后市场反馈，不声称事件造成了收益或价格变化；市场页不得重复该日历；',
)
insert_after(
    'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
    '## 3. 概览\n\n',
    """### 经营决策支持固定边界\n\n生产、研发、合同、排行榜和经济事件可以增加只读决策信息，但不得新增第十一个一级页面、独立任务资产或浏览器权威经济状态。所有价格方向只读取统一订单簿真实成交；缺少真实成交时必须明确显示缺失，不得用基础价伪装实时行情。决策支持只能回答“当前事实是什么”，不得自动给出最高利润商品、最佳科技、最佳合同对象或自动交易结论。\n\n""",\)
insert_after(
    'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
    '## 5. 生产\n\n',
    """工厂详情在既有单厂平均利润／分钟之外增加独立“经营诊断”。诊断按当前等效产能、当前配方、玩家可用库存、可用资金和共享仓库剩余容量计算原料可支持完整周期数、各输入当前周期缺口、现金续航周期、仓库可容纳周期和第一硬性瓶颈；同时列出投入与产出商品最近真实成交价及方向。诊断不改变生产结算，不读取未来订单，不计入资产或排行榜，也不得自动推荐最高利润配方、采购或出售动作。桌面详情与移动详情必须复用同一诊断组件。\n\n""",\)
insert_after(
    'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
    '## 6. 研发\n\n',
    """科技详情固定增加“产业经营视角”：对该科技直接解锁的工厂展示玩家当前持有数量、正式默认配方的主要投入与产出、相关商品可用库存以及最近统一订单簿真实成交价和方向。该区域只辅助选择产业方向，不改变科技前置、费用、时间和准入，也不得生成“最佳科技”或自动研发建议。\n\n""",\)
insert_after(
    'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
    '## 8. 合同\n\n',
    """合同页在实时合同摘要之外固定展示“我的履约档案”，只从服务器合同追加式审计汇总已结束合同总数、正常完成数／完成率、异常结束数、违约或主动违约次数、当前玩家方向的累计赔付／获赔和最近五份合同结果。履约档案不得生成星级、S/A/B 信用等级、黑名单分或其他主观评分，也不得暴露非参与者身份。历史合同原始条款、终态摘要和重新拟定继续保留。\n\n""",\)
insert_after(
    'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
    '## 9. 排行\n\n',
    """每个排行榜在服务器当前真实名次与总玩家数基础上显示个人竞争分段和下一目标：前 50%、前 25%、前 10%、前三、榜首。距离只用名次差表达，不增加额外奖励、段位资产或浏览器本地“历史最佳”；若未来需要个人历史纪录，必须先设计服务器权威持久化。\n\n""",\)
insert_after(
    'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
    '## 14. 防回退\n\n不得：\n',
    """- 把工厂经营诊断改成自动最高利润推荐、自动采购、自动出售或未来行情预测；\n- 在研发页按客户端算法推荐“最佳科技”，或用基础价冒充真实成交价；\n- 给合同履约档案增加主观信用分、星级、S/A/B 等级或非参与者隐私；\n- 用浏览器本地记录伪造排行榜个人历史最佳、段位或奖励；\n- 把经济事件窗口内成交变化描述成事件必然造成的利润、涨跌或投资建议；\n""",\)

insert_after(
    'docs/INDUSTRY_AND_PRODUCTION_DESIGN.md',
    '- 工厂详情只显示单厂平均利润／分钟；该指标只读取商品最近一次统一订单簿真实成交价和服务器正式配方，固定按一座工厂计算，不读取集群数量、玩家库存、公开挂单、预计交易手续费或建造费，也不得改变生产、市场、资产或统计状态。\n',
    """- 工厂经营诊断与“单厂平均利润／分钟”是两个独立只读指标。经营诊断读取当前正式配方、当前等效产能、玩家可用库存、可用资金、共享仓库剩余容量和最近真实成交价，计算原料／现金／仓库可支持完整周期及第一瓶颈；不得把玩家库存、集群规模或现金反向混入单厂平均利润指标。诊断结果不进入服务器生产结算、价格、需求、资产、就业或排行榜。\n""",\)
append_once('docs/GIFT_CODE_AND_ADMIN_DESIGN.md', '### 完整经营漏斗覆盖起点', """
### 完整经营漏斗覆盖起点

管理员“玩家”分区的经营成长漏斗从 `gameplay_strategy_funnel_coverage_started_at` 首次写入后的新建档玩家开始形成完整同代样本，固定阶段为建档／首次经济操作／首座工厂／首次生产／首次订单簿成交／首次产业研发／首次银行存款／经营成长线完成。阶段人数必须按前一阶段已经完成的玩家继续收敛，避免玩家越级使用某模块造成相邻转化率超过 100%。首次研发与首次银行存款写入 `economy_player_milestones`；成长线完成读取 `economy_tutorial_completions` 中 `completion_source = player` 的真实完成记录，版本迁移不得伪装为玩家完成。

玩家运营统计同时展示经营成长线 24 小时与 7 日内真实完成率；分母只统计已经完整经历对应观察窗口的覆盖期新玩家。该漏斗只用于运营诊断，不影响人口需求预算、排行榜、奖励、科技费用或任何玩家经济结果。
""")
append_once('docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md', '### 经营决策支持与精确漏斗', """
### 经营决策支持与精确漏斗

`economy_player_milestones` 增加 `first_research_at` 与 `first_bank_deposit_at`，并以 `economy_player_statistics_meta.gameplay_strategy_funnel_coverage_started_at` 记录完整新漏斗开始覆盖的服务器时间。`economy_tutorial_completions` 增加 `completion_source`，固定为 `legacy`、`migration` 或 `player`；历史行迁移默认 `legacy`，版本迁移写 `migration`，玩家实际完成幂等接口只写 `player`。管理员经营成长漏斗只把覆盖起点之后新建档玩家和 `player` 来源完成计入完整转化与 24h／7d 完成率。

合同新增只读 `GET /api/game/contracts/performance`，服务端直接从参与者可见的追加式合同审计汇总已结束合同、完成、异常、违约、赔付和最近结果，不进入六分区状态轮询，也不产生信用分。工厂经营诊断、研发产业视角、排行榜分段和经济事件结果反馈均由客户端对已经加载的服务器权威状态做无副作用派生；它们不得产生新的经济写操作。公开经济事件日历额外保留结束后 24 小时的事件供事后反馈，实际需求重分配仍只在正式事件生效窗口内发生。
""")
append_once('docs/PRODUCT_AND_GAMEPLAY_DESIGN.md', '## 经营决策反馈边界', """
## 经营决策反馈边界

经营成长线完成后的中期体验优先增加决策信息而不是新的权威资产：生产页回答原料、现金与仓库还能支持多少完整周期；研发页回答科技直接对应的产业链与当前市场事实；合同页展示真实履约历史；排行榜展示当前分位与下一竞争目标；已结束经济事件展示事件窗口内真实成交反馈。所有这些信息只帮助玩家形成自己的供需判断，不自动替玩家选择最高利润产物、最佳科技、合同对象、交易方向或事件投资策略。
""")

# Static verifiers and package integration ------------------------------------------
insert_after(
    'scripts/verify-admin-player-statistics.mjs',
    """  'economy_player_milestones',\n""",
    """  'first_research_at',\n  'first_bank_deposit_at',\n  'gameplay_strategy_funnel_coverage_started_at',\n  'completion_source',\n""",\)
insert_after(
    'scripts/verify-admin-player-statistics.mjs',
    """  '经营成长漏斗',\n""",
    """  '成长线完成时效',\n  'funnel.completion24h',\n  'funnel.completion7d',\n""",\)
insert_after(
    'scripts/verify-admin-player-statistics.mjs',
    """  '精确日活动覆盖起点',\n""",
    """  '完整经营漏斗覆盖起点',\n""",\)

replace_once(
    'package.json',
    '    "verify:admin-player-statistics": "node scripts/verify-admin-player-statistics.mjs",',
    '    "verify:admin-player-statistics": "node scripts/verify-admin-player-statistics.mjs",\n    "verify:gameplay-decision-support": "node --experimental-strip-types scripts/verify-gameplay-decision-support.mjs",',
)
replace_once(
    'package.json',
    '&& node scripts/verify-admin-player-statistics.mjs && node scripts/verify-runtime-efficiency.mjs',
    '&& node scripts/verify-admin-player-statistics.mjs && npm run verify:gameplay-decision-support && node scripts/verify-runtime-efficiency.mjs',
)

print('Applied gameplay strategy next-phase changes.')
