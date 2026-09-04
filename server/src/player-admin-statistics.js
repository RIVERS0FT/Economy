import { PRODUCT_CATALOG } from './domain.js';
import { wealthAssetsFor } from './leaderboards.js';
import { CURRENT_TUTORIAL_VERSION } from './tutorial-store.js';
import { roundInternalMoney } from './money.js';
import { measureRequestPhase } from './request-performance.js';
import { DEFAULT_PROVINCE_ID, normalizeProvinceId, provinceScopedKey, splitProvinceScopedKey } from './provinces.js';

export const PLAYER_STATISTICS_TIME_ZONE = 'Asia/Shanghai';
export const PLAYER_STATISTICS_RANGE_DAYS = Object.freeze({
  '7d': 7,
  '30d': 30,
  '90d': 90,
});

const DAY_MS = 24 * 60 * 60 * 1000;
const BEIJING_OFFSET_MS = 8 * 60 * 60 * 1000;
const CONFIGURED = Symbol('player-admin-statistics-configured');
const STRATEGY_FUNNEL_COVERAGE_KEY = 'gameplay_strategy_funnel_coverage_started_at';
const CONTRACT_ACTIONS = new Set([
  'createProductionContract',
  'acceptProductionContract',
  'cancelProductionContract',
  'prepareProductionContract',
  'fundProductionContract',
  'setProductionContractAutoReserve',
  'setProductionContractAutoFund',
  'requestProductionContractTermination',
  'terminateProductionContractNow',
]);
const AUCTION_ACTIONS = new Set(['createAuction', 'placeAuctionBid', 'cancelAuction']);
const FACILITY_ACTIONS = new Set([
  'buildFacility',
  'startFacility',
  'pauseFacility',
  'setFacilityRecipe',
  'collectFacility',
  'listFacility',
  'cancelFacilityListing',
  'buyFacility',
]);
const ORDER_ACTIONS = new Set(['placeOrder', 'cancelOrder']);

function safeNonNegativeInteger(value) {
  const normalized = Math.floor(Number(value) || 0);
  return Number.isSafeInteger(normalized) && normalized >= 0 ? normalized : 0;
}

function safeNonNegativeMoney(value) {
  return Math.max(0, roundInternalMoney(value) || 0);
}

function safeTimestamp(value) {
  const normalized = Number(value);
  return Number.isFinite(normalized) && normalized > 0 ? normalized : 0;
}

function clampBps(value) {
  return Math.max(0, Math.min(10_000, Math.round(Number(value) || 0)));
}

function ratioBps(numerator, denominator) {
  if (denominator <= 0) return 0;
  return clampBps(numerator / denominator * 10_000);
}

function dayStart(timestamp) {
  const shifted = new Date(Number(timestamp) + BEIJING_OFFSET_MS);
  return Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()) - BEIJING_OFFSET_MS;
}

function dayKey(timestamp) {
  return new Date(dayStart(timestamp) + BEIJING_OFFSET_MS).toISOString().slice(0, 10);
}

function rangeFor(value, now) {
  const key = Object.hasOwn(PLAYER_STATISTICS_RANGE_DAYS, value) ? value : '30d';
  const days = PLAYER_STATISTICS_RANGE_DAYS[key];
  const endsAt = Number(now);
  const startsAt = dayStart(endsAt) - (days - 1) * DAY_MS;
  return { key, days, startsAt, endsAt };
}

function isOpenOrder(order) {
  return Number(order?.remaining || 0) > 0 && (order?.status === 'open' || order?.status === 'partial');
}

function auctionItems(auction) {
  if (Array.isArray(auction?.items) && auction.items.length > 0) {
    return auction.items.filter((item) => item?.assetKind === 'commodity' || item?.assetKind === 'facility');
  }
  const assetKind = auction?.assetKind;
  const assetId = String(
    auction?.assetId
    || (assetKind === 'commodity' ? auction?.productId : auction?.facilityTypeId)
    || '',
  );
  return (assetKind === 'commodity' || assetKind === 'facility') && assetId
    ? [{
      assetKind,
      assetId,
      provinceId: normalizeProvinceId(auction?.provinceId),
      quantity: Math.max(1, safeNonNegativeInteger(auction?.quantity || 1)),
    }]
    : [];
}

function totalInventoryQuantity(player) {
  return Object.values(player?.inventories || {}).reduce((sum, inventory) => (
    sum + safeNonNegativeInteger(inventory?.available) + safeNonNegativeInteger(inventory?.frozen)
  ), 0);
}

function facilityCount(player) {
  return (player?.facilityGroups || []).reduce((sum, group) => sum + safeNonNegativeInteger(group?.count), 0);
}

function productionOutput(player) {
  return (player?.facilityGroups || []).reduce((sum, group) => sum + safeNonNegativeInteger(group?.lifetimeOutput), 0);
}

function tradeQuantity(player) {
  const stats = player?.stats || {};
  return safeNonNegativeInteger(stats.commodityVolume)
    + safeNonNegativeInteger(stats.facilityVolume);
}

function contractDeliveries(player) {
  return safeNonNegativeInteger(player?.stats?.contractDeliveriesCompleted);
}

function metricsForPlayer(player) {
  return {
    facilityCount: facilityCount(player),
    productionOutput: productionOutput(player),
    tradeQuantity: tradeQuantity(player),
    contractDeliveries: contractDeliveries(player),
  };
}

function valuationPrice(world, kind, assetId, provinceId = DEFAULT_PROVINCE_ID) {
  const marketKey = provinceScopedKey(provinceId, assetId);
  const market = kind === 'facility' ? world?.facilityMarkets?.[marketKey] : world?.markets?.[marketKey];
  if (kind === 'commodity') return safeNonNegativeMoney(market?.officialPrice);
  return safeNonNegativeMoney(market?.lastTradePrice);
}

function frozenFacilityIndexKey(userId, facilityTypeId, provinceId = DEFAULT_PROVINCE_ID) {
  return `${Number(userId)}:${provinceScopedKey(provinceId, facilityTypeId)}`;
}

function buildFrozenFacilityQuantityIndex(world) {
  const quantities = new Map();
  const add = (userId, facilityTypeId, provinceId, quantity) => {
    const normalizedUserId = Number(userId);
    const normalizedTypeId = String(facilityTypeId || '');
    const normalizedQuantity = safeNonNegativeInteger(quantity);
    if (!Number.isSafeInteger(normalizedUserId) || normalizedUserId <= 0 || !normalizedTypeId || normalizedQuantity <= 0) return;
    const key = frozenFacilityIndexKey(normalizedUserId, normalizedTypeId, provinceId);
    quantities.set(key, (quantities.get(key) || 0) + normalizedQuantity);
  };

  for (const order of world?.orders || []) {
    if (
      order?.ownerType !== 'player'
      || order?.side !== 'sell'
      || order?.assetKind !== 'facility'
      || !isOpenOrder(order)
    ) continue;
    add(order.ownerId, order.assetId || order.facilityTypeId, order.provinceId, order.remaining);
  }

  for (const auction of world?.assetAuctions || []) {
    if (
      auction?.status !== 'open'
      || auction?.escrowStatus === 'released'
      || auction?.escrowStatus === 'transferred'
    ) continue;
    for (const item of auctionItems(auction)) {
      if (item.assetKind === 'facility') add(auction.sellerId, item.assetId, item.provinceId, item.quantity);
    }
  }
  return quantities;
}

function frozenFacilityQuantity(index, userId, facilityTypeId, provinceId = DEFAULT_PROVINCE_ID) {
  return index.get(frozenFacilityIndexKey(userId, facilityTypeId, provinceId)) || 0;
}

function wealthBreakdown(world, player, frozenFacilityQuantities) {
  const cash = safeNonNegativeMoney(player?.credits) + safeNonNegativeMoney(player?.frozenCredits);
  let commodities = 0;
  let frozenCommodities = 0;
  for (const [key, inventory] of Object.entries(player?.inventories || {})) {
    const { provinceId, assetId } = splitProvinceScopedKey(key);
    if (!PRODUCT_CATALOG.some((product) => product.id === assetId)) continue;
    const price = valuationPrice(world, 'commodity', assetId, provinceId);
    const availableQuantity = safeNonNegativeInteger(inventory?.available);
    const frozenQuantity = safeNonNegativeInteger(inventory?.frozen);
    const inTransitQuantity = safeNonNegativeInteger(inventory?.inTransit);
    commodities += (availableQuantity + frozenQuantity + inTransitQuantity) * price;
    frozenCommodities += frozenQuantity * price;
  }

  let facilities = 0;
  let frozenFacilities = 0;
  for (const group of player?.facilityGroups || []) {
    const facilityTypeId = String(group?.facilityTypeId || '');
    const price = valuationPrice(world, 'facility', facilityTypeId, group?.provinceId);
    facilities += safeNonNegativeInteger(group?.count) * price;
    frozenFacilities += frozenFacilityQuantity(frozenFacilityQuantities, player?.userId, facilityTypeId, group?.provinceId) * price;
  }

  const total = wealthAssetsFor(world, player);
  const frozen = Math.min(
    total,
    safeNonNegativeMoney(player?.frozenCredits) + frozenCommodities + frozenFacilities,
  );
  return { total, cash, commodities, facilities, frozen };
}

function percentile(sortedValues, fraction) {
  if (sortedValues.length === 0) return 0;
  if (sortedValues.length === 1) return sortedValues[0];
  const position = (sortedValues.length - 1) * fraction;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sortedValues[lower];
  const weight = position - lower;
  return roundInternalMoney(sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight) || 0;
}

function median(values) {
  return percentile([...values].sort((left, right) => left - right), 0.5);
}

function stageMedianHours(rows, registrationsByUser, key) {
  const durations = [];
  for (const row of rows) {
    const completedAt = safeTimestamp(row[key]);
    const registeredAt = safeTimestamp(registrationsByUser.get(Number(row.user_id))?.registered_at);
    if (completedAt >= registeredAt && registeredAt > 0) durations.push(completedAt - registeredAt);
  }
  if (durations.length === 0) return null;
  return Math.round(median(durations) / (60 * 60 * 1000) * 10) / 10;
}

function tableExists(database, name) {
  const row = database.prepare(`
    SELECT 1 AS present FROM sqlite_master WHERE type = 'table' AND name = ?
  `).get(name);
  return Boolean(row?.present);
}

function tableColumns(database, name) {
  return new Set(database.prepare(`PRAGMA table_info(${name})`).all().map((row) => String(row.name)));
}

function playerGrowthLineCompletions(database) {
  if (!tableExists(database, 'economy_tutorial_completions')) return [];
  if (!tableColumns(database, 'economy_tutorial_completions').has('completion_source')) return [];
  return rowsOrEmpty(database, `
    SELECT user_id, completed_at
    FROM economy_tutorial_completions
    WHERE completed_version >= ? AND completion_source = 'player'
    ORDER BY completed_at, user_id
  `, CURRENT_TUTORIAL_VERSION);
}

function rowsOrEmpty(database, sql, ...parameters) {
  try {
    return database.prepare(sql).all(...parameters);
  } catch (error) {
    if (String(error?.message || '').includes('no such table')) return [];
    throw error;
  }
}

function rowOrNull(database, sql, ...parameters) {
  try {
    return database.prepare(sql).get(...parameters) || null;
  } catch (error) {
    if (String(error?.message || '').includes('no such table')) return null;
    throw error;
  }
}

function actionCounts(action) {
  return {
    facility: FACILITY_ACTIONS.has(action) ? 1 : 0,
    order: ORDER_ACTIONS.has(action) ? 1 : 0,
    contract: CONTRACT_ACTIONS.has(action) ? 1 : 0,
    auction: AUCTION_ACTIONS.has(action) ? 1 : 0,
  };
}

function configureSchema(store, now) {
  store.database.exec(`
    CREATE TABLE IF NOT EXISTS economy_player_activity_daily (
      day_key TEXT NOT NULL,
      user_id INTEGER NOT NULL,
      successful_action_count INTEGER NOT NULL DEFAULT 0 CHECK (successful_action_count >= 0),
      facility_action_count INTEGER NOT NULL DEFAULT 0 CHECK (facility_action_count >= 0),
      order_action_count INTEGER NOT NULL DEFAULT 0 CHECK (order_action_count >= 0),
      contract_action_count INTEGER NOT NULL DEFAULT 0 CHECK (contract_action_count >= 0),
      auction_action_count INTEGER NOT NULL DEFAULT 0 CHECK (auction_action_count >= 0),
      production_output_count INTEGER NOT NULL DEFAULT 0 CHECK (production_output_count >= 0),
      trade_quantity INTEGER NOT NULL DEFAULT 0 CHECK (trade_quantity >= 0),
      contract_delivery_count INTEGER NOT NULL DEFAULT 0 CHECK (contract_delivery_count >= 0),
      first_activity_at INTEGER,
      last_activity_at INTEGER,
      PRIMARY KEY (day_key, user_id)
    ) STRICT;
    CREATE INDEX IF NOT EXISTS idx_economy_player_activity_user_day
      ON economy_player_activity_daily(user_id, day_key);
    CREATE INDEX IF NOT EXISTS idx_economy_player_activity_last
      ON economy_player_activity_daily(last_activity_at);
    CREATE TABLE IF NOT EXISTS economy_player_milestones (
      user_id INTEGER PRIMARY KEY,
      first_economic_action_at INTEGER,
      first_facility_at INTEGER,
      first_production_at INTEGER,
      first_trade_at INTEGER,
      first_contract_at INTEGER,
      first_auction_at INTEGER,
      first_research_at INTEGER,
      first_bank_deposit_at INTEGER
    ) STRICT;
    CREATE TABLE IF NOT EXISTS economy_player_statistics_meta (
      meta_key TEXT PRIMARY KEY,
      meta_value INTEGER NOT NULL
    ) STRICT;
  `);
  store.database.prepare(`
    INSERT OR IGNORE INTO economy_player_statistics_meta (meta_key, meta_value)
    VALUES ('coverage_started_at', ?)
  `).run(now);
  const milestoneColumns = tableColumns(store.database, 'economy_player_milestones');
  if (!milestoneColumns.has('first_research_at')) {
    store.database.exec('ALTER TABLE economy_player_milestones ADD COLUMN first_research_at INTEGER');
  }
  if (!milestoneColumns.has('first_bank_deposit_at')) {
    store.database.exec('ALTER TABLE economy_player_milestones ADD COLUMN first_bank_deposit_at INTEGER');
  }
  store.database.prepare(`
    INSERT OR IGNORE INTO economy_player_statistics_meta (meta_key, meta_value)
    VALUES (?, ?)
  `).run(STRATEGY_FUNNEL_COVERAGE_KEY, now);

  return {
    actionContext: null,
    upsertAction: store.database.prepare(`
      INSERT INTO economy_player_activity_daily (
        day_key, user_id, successful_action_count, facility_action_count,
        order_action_count, contract_action_count, auction_action_count,
        production_output_count, trade_quantity, contract_delivery_count,
        first_activity_at, last_activity_at
      ) VALUES (?, ?, 1, ?, ?, ?, ?, 0, 0, 0, ?, ?)
      ON CONFLICT(day_key, user_id) DO UPDATE SET
        successful_action_count = successful_action_count + 1,
        facility_action_count = facility_action_count + excluded.facility_action_count,
        order_action_count = order_action_count + excluded.order_action_count,
        contract_action_count = contract_action_count + excluded.contract_action_count,
        auction_action_count = auction_action_count + excluded.auction_action_count,
        first_activity_at = COALESCE(first_activity_at, excluded.first_activity_at),
        last_activity_at = MAX(COALESCE(last_activity_at, 0), excluded.last_activity_at)
    `),
    upsertOperational: store.database.prepare(`
      INSERT INTO economy_player_activity_daily (
        day_key, user_id, successful_action_count, facility_action_count,
        order_action_count, contract_action_count, auction_action_count,
        production_output_count, trade_quantity, contract_delivery_count,
        first_activity_at, last_activity_at
      ) VALUES (?, ?, 0, 0, 0, 0, 0, ?, ?, ?, NULL, NULL)
      ON CONFLICT(day_key, user_id) DO UPDATE SET
        production_output_count = production_output_count + excluded.production_output_count,
        trade_quantity = trade_quantity + excluded.trade_quantity,
        contract_delivery_count = contract_delivery_count + excluded.contract_delivery_count
    `),
    upsertMilestones: store.database.prepare(`
      INSERT INTO economy_player_milestones (
        user_id, first_economic_action_at, first_facility_at, first_production_at,
        first_trade_at, first_contract_at, first_auction_at, first_research_at, first_bank_deposit_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        first_economic_action_at = COALESCE(first_economic_action_at, excluded.first_economic_action_at),
        first_facility_at = COALESCE(first_facility_at, excluded.first_facility_at),
        first_production_at = COALESCE(first_production_at, excluded.first_production_at),
        first_trade_at = COALESCE(first_trade_at, excluded.first_trade_at),
        first_contract_at = COALESCE(first_contract_at, excluded.first_contract_at),
        first_auction_at = COALESCE(first_auction_at, excluded.first_auction_at),
        first_research_at = COALESCE(first_research_at, excluded.first_research_at),
        first_bank_deposit_at = COALESCE(first_bank_deposit_at, excluded.first_bank_deposit_at)
    `),
    coverageStartedAt: () => Number(store.database.prepare(`
      SELECT meta_value FROM economy_player_statistics_meta WHERE meta_key = 'coverage_started_at'
    `).get()?.meta_value || now),
    funnelCoverageStartedAt: () => Number(store.database.prepare(`
      SELECT meta_value FROM economy_player_statistics_meta WHERE meta_key = ?
    `).get(STRATEGY_FUNNEL_COVERAGE_KEY)?.meta_value || now),
  };
}

function recordAction(state, context, beforeWorld, world, now) {
  if (!context || Number(context.now) !== Number(now)) return;
  const userId = Number(context.userId);
  const beforePlayer = beforeWorld?.players?.[String(userId)];
  const player = world?.players?.[String(userId)];
  if (!player) return;
  const beforeActivity = safeTimestamp(beforePlayer?.lastEconomicActivityAt);
  const afterActivity = safeTimestamp(player.lastEconomicActivityAt);
  if (afterActivity !== Number(now) || afterActivity === beforeActivity) return;

  const counts = actionCounts(context.action);
  state.upsertAction.run(
    dayKey(now),
    userId,
    counts.facility,
    counts.order,
    counts.contract,
    counts.auction,
    now,
    now,
  );
  state.upsertMilestones.run(
    userId,
    now,
    null,
    null,
    null,
    CONTRACT_ACTIONS.has(context.action) ? now : null,
    AUCTION_ACTIONS.has(context.action) ? now : null,
    context.action === 'startResearch' ? now : null,
    context.action === 'bankDeposit' ? now : null,
  );
}

function scopedPlayerIds(mutationScope) {
  if (!mutationScope || mutationScope.allPlayers || mutationScope.playerIds === null) return null;
  return [...new Set([...(mutationScope.playerIds || [])].map((value) => String(value)))];
}

function recordWorldDeltas(state, beforeWorld, world, now, mutationScope = null) {
  if (!beforeWorld?.players || !world?.players) return;
  const playerIds = scopedPlayerIds(mutationScope);
  const entries = playerIds === null
    ? Object.entries(world.players)
    : playerIds.map((userIdText) => [userIdText, world.players[userIdText]]).filter(([, player]) => Boolean(player));
  for (const [userIdText, player] of entries) {
    const beforePlayer = beforeWorld.players[userIdText];
    if (!beforePlayer) continue;
    const userId = Number(userIdText);
    if (!Number.isSafeInteger(userId) || userId <= 0) continue;
    const before = metricsForPlayer(beforePlayer);
    const after = metricsForPlayer(player);
    const productionDelta = Math.max(0, after.productionOutput - before.productionOutput);
    const tradeDelta = Math.max(0, after.tradeQuantity - before.tradeQuantity);
    const contractDelta = Math.max(0, after.contractDeliveries - before.contractDeliveries);
    if (productionDelta > 0 || tradeDelta > 0 || contractDelta > 0) {
      state.upsertOperational.run(dayKey(now), userId, productionDelta, tradeDelta, contractDelta);
    }
    const firstFacilityAt = before.facilityCount === 0 && after.facilityCount > 0 ? now : null;
    const firstProductionAt = before.productionOutput === 0 && after.productionOutput > 0 ? now : null;
    const firstTradeAt = before.tradeQuantity === 0 && after.tradeQuantity > 0 ? now : null;
    if (firstFacilityAt || firstProductionAt || firstTradeAt) {
      state.upsertMilestones.run(
        userId,
        null,
        firstFacilityAt,
        firstProductionAt,
        firstTradeAt,
        null,
        null,
        null,
        null,
      );
    }
  }
}

function activityRows(database, startsAt, endsAt) {
  return rowsOrEmpty(database, `
    SELECT * FROM economy_player_activity_daily
    WHERE day_key >= ? AND day_key <= ?
    ORDER BY day_key, user_id
  `, dayKey(startsAt), dayKey(endsAt));
}

function activeUsersSince(rows, players, threshold) {
  const users = new Set();
  for (const row of rows) {
    if (safeNonNegativeInteger(row.successful_action_count) < 1) continue;
    if (safeTimestamp(row.last_activity_at) >= threshold) users.add(Number(row.user_id));
  }
  for (const player of players) {
    const registeredAt = safeTimestamp(player.registeredAt);
    const activeAt = safeTimestamp(player.lastEconomicActivityAt);
    if (activeAt > registeredAt && activeAt >= threshold) users.add(Number(player.userId));
  }
  return users;
}

function hasEconomicActivity(player, actionUsers, milestone) {
  const registeredAt = safeTimestamp(player?.registeredAt);
  const activeAt = safeTimestamp(player?.lastEconomicActivityAt);
  return actionUsers.has(Number(player?.userId))
    || safeTimestamp(milestone?.first_economic_action_at) > 0
    || activeAt > registeredAt;
}

function currentParticipation(world, players, active7dUsers) {
  const openOrdersByPlayer = new Map();
  for (const order of world?.orders || []) {
    if (order?.ownerType !== 'player' || !isOpenOrder(order)) continue;
    const userId = Number(order.ownerId);
    openOrdersByPlayer.set(userId, (openOrdersByPlayer.get(userId) || 0) + 1);
  }
  const activeContractUsers = new Set();
  for (const contract of world?.productionContracts || []) {
    if (contract?.status !== 'active') continue;
    if (Number.isSafeInteger(Number(contract?.buyerId))) activeContractUsers.add(Number(contract.buyerId));
    if (Number.isSafeInteger(Number(contract?.supplierId))) activeContractUsers.add(Number(contract.supplierId));
  }
  const auctionUsers = new Set();
  for (const auction of world?.assetAuctions || []) {
    if (auction?.status !== 'open') continue;
    if (Number.isSafeInteger(Number(auction?.sellerId))) auctionUsers.add(Number(auction.sellerId));
    if (Number.isSafeInteger(Number(auction?.highestBidderId))) auctionUsers.add(Number(auction.highestBidderId));
  }
  const currentProduction = world?.leaderboardState?.production || {};
  const currentTrading = world?.leaderboardState?.trading || {};
  const counts = {
    hasFacility: 0,
    runningFacility: 0,
    openOrder: 0,
    currentProduction: 0,
    currentTrade: 0,
    activeContract: 0,
    openAuction: 0,
    warehouseFull: 0,
    facilityError: 0,
  };
  for (const player of players) {
    const userId = Number(player.userId);
    const groups = player.facilityGroups || [];
    if (facilityCount(player) > 0) counts.hasFacility += 1;
    if (groups.some((group) => group?.status === 'running' && safeNonNegativeInteger(group?.participatingCount) > 0)) {
      counts.runningFacility += 1;
    }
    if ((openOrdersByPlayer.get(userId) || 0) > 0) counts.openOrder += 1;
    if (safeNonNegativeInteger(currentProduction?.[String(userId)]?.quantity) > 0) counts.currentProduction += 1;
    if (safeNonNegativeInteger(currentTrading?.[String(userId)]?.tradeCount) > 0) counts.currentTrade += 1;
    if (activeContractUsers.has(userId)) counts.activeContract += 1;
    if (auctionUsers.has(userId)) counts.openAuction += 1;
    if (totalInventoryQuantity(player) >= safeNonNegativeInteger(player.inventoryCapacity)) counts.warehouseFull += 1;
    if (groups.some((group) => group?.enabled && group?.status === 'error')) counts.facilityError += 1;
  }
  const total = players.length;
  const rows = [
    ['has-facility', '持有工厂', counts.hasFacility],
    ['running-facility', '工厂正在生产', counts.runningFacility],
    ['open-order', '存在未完成订单', counts.openOrder],
    ['current-production', '本周有生产产出', counts.currentProduction],
    ['current-trade', '本周有市场成交', counts.currentTrade],
    ['active-contract', '参与进行中合同', counts.activeContract],
    ['open-auction', '参与进行中拍卖', counts.openAuction],
    ['warehouse-full', '仓库已满', counts.warehouseFull],
    ['facility-error', '存在异常工厂', counts.facilityError],
  ];
  return {
    active7d: active7dUsers.size,
    rows: rows.map(([id, label, count]) => ({ id, label, count, shareBps: ratioBps(count, total) })),
  };
}

function wealthSummary(world, players) {
  const values = [];
  const breakdowns = [];
  const frozenFacilityQuantities = buildFrozenFacilityQuantityIndex(world);
  let total = 0;
  let cash = 0;
  let commodities = 0;
  let facilities = 0;
  let frozen = 0;
  let unpricedAssetPlayers = 0;
  for (const player of players) {
    const breakdown = wealthBreakdown(world, player, frozenFacilityQuantities);
    values.push(breakdown.total);
    breakdowns.push([Number(player.userId), breakdown]);
    total += breakdown.total;
    cash += breakdown.cash;
    commodities += breakdown.commodities;
    facilities += breakdown.facilities;
    frozen += breakdown.frozen;
    const holdsAssets = totalInventoryQuantity(player) > 0 || facilityCount(player) > 0;
    if (holdsAssets && breakdown.commodities + breakdown.facilities === 0) unpricedAssetPlayers += 1;
  }
  const sorted = [...values].sort((left, right) => left - right);
  const descending = [...values].sort((left, right) => right - left);
  const top1Count = values.length > 0 ? Math.max(1, Math.ceil(values.length * 0.01)) : 0;
  const top10Count = values.length > 0 ? Math.max(1, Math.ceil(values.length * 0.1)) : 0;
  const top1 = descending.slice(0, top1Count).reduce((sum, value) => sum + value, 0);
  const top10 = descending.slice(0, top10Count).reduce((sum, value) => sum + value, 0);
  const brackets = [
    { id: '0-499', label: '0～499', min: 0, max: 499 },
    { id: '500-1999', label: '500～1,999', min: 500, max: 1_999 },
    { id: '2000-9999', label: '2,000～9,999', min: 2_000, max: 9_999 },
    { id: '10000-49999', label: '10,000～49,999', min: 10_000, max: 49_999 },
    { id: '50000+', label: '50,000 以上', min: 50_000, max: Number.MAX_SAFE_INTEGER },
  ].map((bracket) => ({
    id: bracket.id,
    label: bracket.label,
    count: values.filter((value) => value >= bracket.min && value <= bracket.max).length,
  }));
  return {
    total,
    average: values.length > 0 ? Math.round(total / values.length) : 0,
    median: percentile(sorted, 0.5),
    p25: percentile(sorted, 0.25),
    p75: percentile(sorted, 0.75),
    p90: percentile(sorted, 0.9),
    p99: percentile(sorted, 0.99),
    top1ShareBps: ratioBps(top1, total),
    top10ShareBps: ratioBps(top10, total),
    frozenShareBps: ratioBps(frozen, total),
    unpricedAssetPlayers,
    composition: { cash, commodities, facilities, frozen, total },
    brackets,
    byPlayer: new Map(breakdowns),
  };
}

function attentionSummary({
  database,
  world,
  players,
  range,
  active7dUsers,
  actionUsers,
  milestonesByUser,
  wealthByPlayer,
}) {
  const openBuyers = new Set((world?.orders || []).filter((order) => (
    order?.ownerType === 'player' && order?.side === 'buy' && isOpenOrder(order)
  )).map((order) => Number(order.ownerId)));
  let unactivatedNew = 0;
  let operatingNotStarted = 0;
  let productionBlocked = 0;
  let warehouseBlocked = 0;
  let highFrozen = 0;
  let dormant30d = 0;
  let activeNoTrade = 0;
  for (const player of players) {
    const userId = Number(player.userId);
    const milestone = milestonesByUser.get(userId);
    const hasActivity = hasEconomicActivity(player, actionUsers, milestone);
    const metrics = metricsForPlayer(player);
    const groups = player.facilityGroups || [];
    const registeredAt = safeTimestamp(player.registeredAt);
    const lastActiveAt = safeTimestamp(player.lastEconomicActivityAt);
    if (registeredAt <= range.endsAt - DAY_MS && !hasActivity) unactivatedNew += 1;
    if (hasActivity && metrics.facilityCount === 0 && metrics.productionOutput === 0 && metrics.tradeQuantity === 0) {
      operatingNotStarted += 1;
    }
    const enabledGroups = groups.filter((group) => group?.enabled);
    if (enabledGroups.length > 0 && enabledGroups.every((group) => group?.status === 'error')) productionBlocked += 1;
    const full = totalInventoryQuantity(player) >= safeNonNegativeInteger(player.inventoryCapacity);
    if (full && (enabledGroups.length > 0 || openBuyers.has(userId))) warehouseBlocked += 1;
    const wealth = wealthByPlayer.get(userId) || { total: 0, frozen: 0 };
    if (wealth.total > 0 && ratioBps(wealth.frozen, wealth.total) >= 5_000) highFrozen += 1;
    if (registeredAt <= range.endsAt - 30 * DAY_MS && lastActiveAt < range.endsAt - 30 * DAY_MS) dormant30d += 1;
    const weekTradeCount = safeNonNegativeInteger(world?.leaderboardState?.trading?.[String(userId)]?.tradeCount);
    if (active7dUsers.has(userId) && weekTradeCount === 0) activeNoTrade += 1;
  }
  const newlyBanned = tableExists(database, 'economy_account_bans')
    ? Number(rowOrNull(database, `
      SELECT COUNT(*) AS count FROM economy_account_bans
      WHERE banned_at >= ? AND banned_at <= ?
    `, range.startsAt, range.endsAt)?.count || 0)
    : 0;
  return [
    { id: 'unactivated-new', label: '注册超过 24 小时仍未激活', count: unactivatedNew, tone: 'warning' },
    { id: 'operating-not-started', label: '有经济操作但经营尚未启动', count: operatingNotStarted, tone: 'neutral' },
    { id: 'production-blocked', label: '全部开启工厂均受阻', count: productionBlocked, tone: 'danger' },
    { id: 'warehouse-blocked', label: '仓库已满且仍有生产或采购', count: warehouseBlocked, tone: 'danger' },
    { id: 'high-frozen', label: '冻结资产占比不低于 50%', count: highFrozen, tone: 'warning' },
    { id: 'dormant-30d', label: '30 日沉睡玩家', count: dormant30d, tone: 'neutral' },
    { id: 'active-no-trade', label: '7 日活跃但本周无市场成交', count: activeNoTrade, tone: 'neutral' },
    { id: 'newly-banned', label: '统计区间内新增封禁', count: newlyBanned, tone: 'danger' },
  ];
}

function createStatisticsSummary(store, world, rangeKey, now) {
  const range = rangeFor(rangeKey, now);
  const coverageStartedAt = store[CONFIGURED].coverageStartedAt();
  const funnelCoverageStartedAt = store[CONFIGURED].funnelCoverageStartedAt();
  const players = Object.values(world?.players || {});
  const registrations = rowsOrEmpty(store.database, `
    SELECT user_id, registered_at, source FROM economy_registrations
    ORDER BY registered_at, user_id
  `);
  const registrationsByUser = new Map(registrations.map((row) => [Number(row.user_id), row]));
  const milestones = rowsOrEmpty(store.database, 'SELECT * FROM economy_player_milestones ORDER BY user_id');
  const milestonesByUser = new Map(milestones.map((row) => [Number(row.user_id), row]));
  const growthLineCompletions = playerGrowthLineCompletions(store.database);
  const growthLineCompletionByUser = new Map(
    growthLineCompletions.map((row) => [Number(row.user_id), safeTimestamp(row.completed_at)]),
  );
  const activityStart = Math.min(range.startsAt, now - 30 * DAY_MS);
  const activities = activityRows(store.database, activityStart, now);
  const activitiesInRange = activities.filter((row) => row.day_key >= dayKey(range.startsAt));
  const actionUsers = new Set(
    activities.filter((row) => safeNonNegativeInteger(row.successful_action_count) > 0)
      .map((row) => Number(row.user_id)),
  );
  const active24hUsers = activeUsersSince(activities, players, now - DAY_MS);
  const active7dUsers = activeUsersSince(activities, players, now - 7 * DAY_MS);
  const active30dUsers = activeUsersSince(activities, players, now - 30 * DAY_MS);
  const activeRangeUsers = activeUsersSince(activitiesInRange, players, range.startsAt);
  const todayKey = dayKey(now);
  const registrationsInRange = registrations.filter((row) => (
    safeTimestamp(row.registered_at) >= range.startsAt && safeTimestamp(row.registered_at) <= range.endsAt
  ));
  const newToday = registrations.filter((row) => dayKey(row.registered_at) === todayKey).length;
  const activatedInRange = registrationsInRange.filter((row) => {
    const player = world.players?.[String(row.user_id)];
    return player && hasEconomicActivity(player, actionUsers, milestonesByUser.get(Number(row.user_id)));
  }).length;

  const invitationRelations = rowsOrEmpty(store.database, `
    SELECT invitee_user_id, source, status FROM economy_invitation_relations
  `);
  const invitationByInvitee = new Map(invitationRelations.map((row) => [Number(row.invitee_user_id), row]));
  const acquisition = { total: registrationsInRange.length, direct: 0, shareLink: 0, manualCode: 0, blocked: 0 };
  for (const registration of registrationsInRange) {
    const relation = invitationByInvitee.get(Number(registration.user_id));
    if (!relation) acquisition.direct += 1;
    else if (relation.status !== 'rewarded') acquisition.blocked += 1;
    else if (relation.source === 'manual_code') acquisition.manualCode += 1;
    else acquisition.shareLink += 1;
  }

  const activityByDay = new Map();
  const activityByUserDay = new Set();
  for (const row of activitiesInRange) {
    const entry = activityByDay.get(row.day_key) || {
      activeUsers: new Set(),
      firstActivities: 0,
      productionUsers: new Set(),
      tradeUsers: new Set(),
    };
    if (safeNonNegativeInteger(row.successful_action_count) > 0) {
      entry.activeUsers.add(Number(row.user_id));
      activityByUserDay.add(`${Number(row.user_id)}:${row.day_key}`);
    }
    if (safeNonNegativeInteger(row.production_output_count) > 0) entry.productionUsers.add(Number(row.user_id));
    if (safeNonNegativeInteger(row.trade_quantity) > 0) entry.tradeUsers.add(Number(row.user_id));
    activityByDay.set(row.day_key, entry);
  }
  for (const milestone of milestones) {
    const timestamp = safeTimestamp(milestone.first_economic_action_at);
    if (timestamp < range.startsAt || timestamp > range.endsAt) continue;
    const key = dayKey(timestamp);
    const entry = activityByDay.get(key) || {
      activeUsers: new Set(), firstActivities: 0, productionUsers: new Set(), tradeUsers: new Set(),
    };
    entry.firstActivities += 1;
    activityByDay.set(key, entry);
  }
  const newByDay = new Map();
  for (const registration of registrationsInRange) {
    const key = dayKey(registration.registered_at);
    newByDay.set(key, (newByDay.get(key) || 0) + 1);
  }

  const coverageDay = dayStart(coverageStartedAt);
  const series = [];
  for (let index = 0; index < range.days; index += 1) {
    const startsAt = range.startsAt + index * DAY_MS;
    const key = dayKey(startsAt);
    const activity = activityByDay.get(key);
    const fullyCovered = startsAt > coverageDay || (coverageStartedAt === coverageDay && startsAt === coverageDay);
    series.push({
      day: key,
      startsAt,
      covered: fullyCovered,
      partialCoverage: (startsAt === coverageDay && coverageStartedAt > coverageDay)
        || startsAt === dayStart(now),
      newPlayers: newByDay.get(key) || 0,
      activePlayers: fullyCovered ? activity?.activeUsers.size || 0 : null,
      firstActivities: fullyCovered ? activity?.firstActivities || 0 : null,
      productionParticipants: fullyCovered ? activity?.productionUsers.size || 0 : null,
      tradeParticipants: fullyCovered ? activity?.tradeUsers.size || 0 : null,
    });
  }

  function retentionFor(days) {
    let eligible = 0;
    let retained = 0;
    for (const registration of registrationsInRange) {
      const targetDay = dayStart(registration.registered_at) + days * DAY_MS;
      const targetDayCovered = targetDay > coverageDay
        || (targetDay === coverageDay && coverageStartedAt === coverageDay);
      if (targetDay + DAY_MS > now || !targetDayCovered) continue;
      eligible += 1;
      if (activityByUserDay.has(`${Number(registration.user_id)}:${dayKey(targetDay)}`)) retained += 1;
    }
    return { eligible, retained, rateBps: ratioBps(retained, eligible) };
  }
  const retention = { d1: retentionFor(1), d7: retentionFor(7), d30: retentionFor(30) };

  const currentMetrics = new Map(players.map((player) => [Number(player.userId), metricsForPlayer(player)]));
  const trackedRegistrations = registrations.filter((row) => safeTimestamp(row.registered_at) >= funnelCoverageStartedAt);
  const trackedUserIds = new Set(trackedRegistrations.map((row) => Number(row.user_id)));
  const trackedPlayers = players.filter((player) => trackedUserIds.has(Number(player.userId)));
  const trackedMilestones = milestones.filter((row) => trackedUserIds.has(Number(row.user_id)));
  const registeredStage = trackedPlayers;
  const actionStage = registeredStage.filter((player) => hasEconomicActivity(
    player, actionUsers, milestonesByUser.get(Number(player.userId)),
  ));
  const facilityStage = actionStage.filter((player) => {
    const userId = Number(player.userId);
    return safeTimestamp(milestonesByUser.get(userId)?.first_facility_at) > 0
      || currentMetrics.get(userId).facilityCount > 0;
  });
  const productionStage = facilityStage.filter((player) => {
    const userId = Number(player.userId);
    return safeTimestamp(milestonesByUser.get(userId)?.first_production_at) > 0
      || currentMetrics.get(userId).productionOutput > 0;
  });
  const tradeStage = productionStage.filter((player) => {
    const userId = Number(player.userId);
    return safeTimestamp(milestonesByUser.get(userId)?.first_trade_at) > 0
      || currentMetrics.get(userId).tradeQuantity > 0;
  });
  const researchStage = tradeStage.filter((player) => (
    safeTimestamp(milestonesByUser.get(Number(player.userId))?.first_research_at) > 0
  ));
  const bankStage = researchStage.filter((player) => (
    safeTimestamp(milestonesByUser.get(Number(player.userId))?.first_bank_deposit_at) > 0
  ));
  const growthLineStage = bankStage.filter((player) => (
    safeTimestamp(growthLineCompletionByUser.get(Number(player.userId))) > 0
  ));
  const growthLineRows = growthLineCompletions
    .filter((row) => trackedUserIds.has(Number(row.user_id)))
    .map((row) => ({ user_id: row.user_id, first_growth_line_at: row.completed_at }));
  const funnelStages = [
    { id: 'registered', label: '完成建档', count: registeredStage.length, medianHours: 0 },
    { id: 'first-action', label: '首次经济操作', count: actionStage.length, medianHours: stageMedianHours(trackedMilestones, registrationsByUser, 'first_economic_action_at') },
    { id: 'first-facility', label: '获得第一座工厂', count: facilityStage.length, medianHours: stageMedianHours(trackedMilestones.filter((row) => new Set(facilityStage.map((player) => Number(player.userId))).has(Number(row.user_id))), registrationsByUser, 'first_facility_at') },
    { id: 'first-production', label: '完成首次生产', count: productionStage.length, medianHours: stageMedianHours(trackedMilestones.filter((row) => new Set(productionStage.map((player) => Number(player.userId))).has(Number(row.user_id))), registrationsByUser, 'first_production_at') },
    { id: 'first-trade', label: '完成首次订单簿成交', count: tradeStage.length, medianHours: stageMedianHours(trackedMilestones.filter((row) => new Set(tradeStage.map((player) => Number(player.userId))).has(Number(row.user_id))), registrationsByUser, 'first_trade_at') },
    { id: 'first-research', label: '开始首次产业研发', count: researchStage.length, medianHours: stageMedianHours(trackedMilestones.filter((row) => new Set(researchStage.map((player) => Number(player.userId))).has(Number(row.user_id))), registrationsByUser, 'first_research_at') },
    { id: 'first-bank-deposit', label: '完成首次银行存款', count: bankStage.length, medianHours: stageMedianHours(trackedMilestones.filter((row) => new Set(bankStage.map((player) => Number(player.userId))).has(Number(row.user_id))), registrationsByUser, 'first_bank_deposit_at') },
    { id: 'growth-line-complete', label: '完成教程', count: growthLineStage.length, medianHours: stageMedianHours(growthLineRows.filter((row) => new Set(growthLineStage.map((player) => Number(player.userId))).has(Number(row.user_id))), registrationsByUser, 'first_growth_line_at') },
  ].map((stage, index, stages) => ({
    ...stage,
    conversionBps: index === 0 ? 10_000 : ratioBps(stage.count, stages[index - 1].count),
  }));

  function growthLineCompletionWithin(windowMs) {
    let eligible = 0;
    let completed = 0;
    for (const registration of trackedRegistrations) {
      const registeredAt = safeTimestamp(registration.registered_at);
      if (registeredAt <= 0 || registeredAt + windowMs > now) continue;
      eligible += 1;
      const completedAt = safeTimestamp(growthLineCompletionByUser.get(Number(registration.user_id)));
      if (completedAt >= registeredAt && completedAt <= registeredAt + windowMs) completed += 1;
    }
    return { eligible, retained: completed, rateBps: ratioBps(completed, eligible) };
  }
  const growthLineCompletion24h = growthLineCompletionWithin(DAY_MS);
  const growthLineCompletion7d = growthLineCompletionWithin(7 * DAY_MS);

  const wealth = wealthSummary(world, players);
  const participation = currentParticipation(world, players, active7dUsers);
  const attention = attentionSummary({
    database: store.database,
    world,
    players,
    range,
    active7dUsers,
    actionUsers,
    milestonesByUser,
    wealthByPlayer: wealth.byPlayer,
  });
  const fullyCoveredDays = series.filter((item) => item.covered && !item.partialCoverage);
  const coveredDays = fullyCoveredDays.length > 0
    ? fullyCoveredDays
    : series.filter((item) => item.covered);
  const peak = coveredDays.reduce((best, item) => (
    (item.activePlayers || 0) > (best?.activePlayers || 0) ? item : best
  ), null);
  const productionUsersInRange = new Set(
    activitiesInRange.filter((row) => safeNonNegativeInteger(row.production_output_count) > 0)
      .map((row) => Number(row.user_id)),
  );
  const tradeUsersInRange = new Set(
    activitiesInRange.filter((row) => safeNonNegativeInteger(row.trade_quantity) > 0)
      .map((row) => Number(row.user_id)),
  );
  const averageDailyActive = coveredDays.length > 0
    ? Math.round(coveredDays.reduce((sum, item) => sum + (item.activePlayers || 0), 0) / coveredDays.length * 10) / 10
    : 0;

  const { byPlayer: _byPlayer, ...publicWealth } = wealth;
  return {
    generatedAt: now,
    coverageStartsAt: coverageStartedAt,
    range: {
      ...range,
      timeZone: PLAYER_STATISTICS_TIME_ZONE,
      completeHistory: coverageStartedAt === coverageDay
        ? range.startsAt >= coverageDay
        : range.startsAt > coverageDay,
    },
    snapshot: {
      totalPlayers: players.length,
      newToday,
      active24h: active24hUsers.size,
      active7d: active7dUsers.size,
      active30d: active30dUsers.size,
      activeRate7dBps: ratioBps(active7dUsers.size, players.length),
      registeredInRange: registrationsInRange.length,
      activatedInRange,
      activationRateBps: ratioBps(activatedInRange, registrationsInRange.length),
      dormant30d: attention.find((item) => item.id === 'dormant-30d')?.count || 0,
    },
    acquisition,
    activity: {
      activePlayersInRange: activeRangeUsers.size,
      averageDailyActive,
      peakDailyActive: peak?.activePlayers || 0,
      peakDay: peak?.day || null,
      productionParticipantsInRange: productionUsersInRange.size,
      tradeParticipantsInRange: tradeUsersInRange.size,
    },
    retention,
    funnel: { stages: funnelStages, retained7d: retention.d7, coverageStartsAt: funnelCoverageStartedAt, completion24h: growthLineCompletion24h, completion7d: growthLineCompletion7d },
    participation,
    wealth: publicWealth,
    attention,
    series,
  };
}

function committedWorldForPlayerStatistics(store, now) {
  if (store.worldCache?.world) {
    return {
      revision: Number(store.worldCache.revision),
      world: store.worldCache.world,
    };
  }
  return store.transaction(() => {
    const { revision, world } = store.loadWorld(now);
    return { revision: Number(revision), world };
  }, { immediate: false });
}

export function configurePlayerAdminStatistics(store, now = Date.now()) {
  if (store[CONFIGURED]) return store;
  const state = configureSchema(store, now);
  Object.defineProperty(store, CONFIGURED, { value: state, enumerable: false });

  const originalSaveWorld = store.saveWorld.bind(store);
  store.saveWorld = (revision, world, savedAt, mutationScope) => {
    const beforeWorld = store.worldCache?.world || null;
    const nextRevision = originalSaveWorld(revision, world, savedAt, mutationScope);
    recordAction(state, state.actionContext, beforeWorld, world, savedAt);
    recordWorldDeltas(state, beforeWorld, world, savedAt, mutationScope);
    return nextRevision;
  };

  const originalSaveWorldIfChanged = store.saveWorldIfChanged.bind(store);
  store.saveWorldIfChanged = (revision, world, savedAt, previousStateJson, mutationScope) => {
    const beforeWorld = store.worldCache?.world || null;
    const nextRevision = originalSaveWorldIfChanged(
      revision,
      world,
      savedAt,
      previousStateJson,
      mutationScope,
    );
    if (nextRevision !== revision) {
      recordAction(state, state.actionContext, beforeWorld, world, savedAt);
      recordWorldDeltas(state, beforeWorld, world, savedAt, mutationScope);
    }
    return nextRevision;
  };

  const originalApply = store.apply.bind(store);
  store.apply = (user, requestMeta, appliedAt = Date.now()) => {
    const previousContext = state.actionContext;
    state.actionContext = {
      userId: Number(user.id),
      action: String(requestMeta?.action || ''),
      requestKey: String(requestMeta?.requestKey || ''),
      now: Number(appliedAt),
    };
    try {
      return originalApply(user, requestMeta, appliedAt);
    } finally {
      state.actionContext = previousContext;
    }
  };

  store.getPlayerStatistics = function getPlayerStatistics(user, rangeKey, generatedAt = Date.now()) {
    this.requireAdmin(user);
    const { revision, world } = committedWorldForPlayerStatistics(this, generatedAt);
    return measureRequestPhase('playerStatisticsProjectionMs', () => ({
      ...createStatisticsSummary(this, world, rangeKey, generatedAt),
      revision,
    }));
  };

  return store;
}
