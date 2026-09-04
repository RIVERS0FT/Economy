import { FACILITY_TYPE_CATALOG, processWorld, PRODUCT_CATALOG } from './domain.js';
import { processAssetAuctions } from './asset-auctions.js';
import { ensureGemState } from './invitations.js';
import { activeLoanLiability } from './banking.js';
import { weeklySettlementLiability } from './weekly-cash-settlement.js';
import { DEFAULT_PROVINCE_ID, provinceScopedKey, splitProvinceScopedKey } from './provinces.js';

export const LEADERBOARD_TIME_ZONE = 'Asia/Shanghai';
export const LEADERBOARD_REWARDS = Object.freeze([50, 30, 20]);
export const LEADERBOARD_TOP_LIMIT = 10;
export const LEADERBOARD_HISTORY_LIMIT = 52;

const BEIJING_OFFSET_MS = 8 * 60 * 60 * 1000;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const PRODUCTION_RULE_VERSION = 2;
const TRADING_RULE_VERSION = 2;
const LEADERBOARD_SORT_RULE_VERSION = 2;
const FACILITY_BY_ID = new Map(FACILITY_TYPE_CATALOG.map((facility) => [facility.id, facility]));
const BOARD_IDS = Object.freeze(['wealth', 'growth', 'production', 'trading']);
const REWARDED_BOARD_IDS = Object.freeze(['growth', 'production', 'trading']);

function clone(value) {
  return structuredClone(value);
}

function safeNonNegativeInteger(value) {
  const normalized = Math.floor(Number(value) || 0);
  return Number.isSafeInteger(normalized) && normalized >= 0 ? normalized : 0;
}

function safeNonNegativeNumber(value) {
  const normalized = Number(value);
  return Number.isFinite(normalized) && normalized >= 0 ? normalized : 0;
}

function safeTimestamp(value) {
  const normalized = Number(value);
  return Number.isFinite(normalized) && normalized > 0 ? normalized : 0;
}

function leaderboardActivityAt(player) {
  return safeTimestamp(player?.lastEconomicActivityAt) || safeTimestamp(player?.registeredAt);
}

function playerStats(player) {
  player.stats ||= {};
  player.stats.productionScore = safeNonNegativeInteger(player.stats.productionScore);
  player.stats.marketSellScore = safeNonNegativeNumber(player.stats.marketSellScore);
  player.stats.marketTradeCount = safeNonNegativeInteger(player.stats.marketTradeCount);
  player.stats.gemExchangeCredits = safeNonNegativeInteger(player.stats.gemExchangeCredits);
  player.stats.leaderboardGemsIssued = safeNonNegativeInteger(player.stats.leaderboardGemsIssued);
  if (!player.stats.leaderboardPersonalBests || typeof player.stats.leaderboardPersonalBests !== 'object' || Array.isArray(player.stats.leaderboardPersonalBests)) {
    player.stats.leaderboardPersonalBests = {};
  }
  return player.stats;
}

function settledPersonalBestFor(player, boardId) {
  const best = playerStats(player).leaderboardPersonalBests?.[boardId];
  const score = Number(best?.score);
  const periodKey = typeof best?.periodKey === 'string' ? best.periodKey : '';
  return Number.isFinite(score) && periodKey ? { score, periodKey } : null;
}

function updatePersonalBest(player, boardId, score, periodKey) {
  const normalizedScore = Number(score);
  if (!Number.isFinite(normalizedScore) || typeof periodKey !== 'string' || !periodKey) return;
  const stats = playerStats(player);
  const current = settledPersonalBestFor(player, boardId);
  if (current && normalizedScore <= current.score) return;
  stats.leaderboardPersonalBests[boardId] = { score: normalizedScore, periodKey };
}

function beijingDateKey(timestamp) {
  return new Date(Number(timestamp) + BEIJING_OFFSET_MS).toISOString().slice(0, 10);
}

export function leaderboardPeriodFor(now = Date.now()) {
  const timestamp = Number(now);
  const local = new Date(timestamp + BEIJING_OFFSET_MS);
  const daysSinceMonday = (local.getUTCDay() + 6) % 7;
  const localMonday = Date.UTC(
    local.getUTCFullYear(),
    local.getUTCMonth(),
    local.getUTCDate() - daysSinceMonday,
  );
  const startsAt = localMonday - BEIJING_OFFSET_MS;
  return {
    key: beijingDateKey(startsAt),
    startsAt,
    endsAt: startsAt + WEEK_MS,
  };
}

function externalCreditsFor(player) {
  const stats = playerStats(player);
  return safeNonNegativeInteger(stats.giftIssued)
    + safeNonNegativeInteger(stats.gemExchangeCredits)
    + safeNonNegativeInteger(stats.adminCreditsIssued);
}

function policyAdjustmentFor(player) {
  const stats = playerStats(player);
  return Number(stats.bankDepositInterestEarned || 0)
    - Number(stats.weeklyCashSettlementBurned || 0)
    - Number(stats.weeklyCashSettlementReserveTransferred || 0);
}

function inventoryQuantity(player, productId) {
  return Object.entries(player.inventories || {}).reduce((sum, [key, inventory]) => (
    splitProvinceScopedKey(key).assetId === productId
      ? sum + safeNonNegativeInteger(inventory.available) + safeNonNegativeInteger(inventory.frozen)
      : sum
  ), 0);
}

export function operatingAssetsFor(player) {
  const cash = safeNonNegativeInteger(player.credits)
    + safeNonNegativeInteger(player.frozenCredits)
    + safeNonNegativeInteger(player?.bankAccount?.depositCredits);
  const commodity = PRODUCT_CATALOG.reduce((sum, product) => (
    sum + inventoryQuantity(player, product.id) * product.basePrice
  ), 0);
  const facilities = (player.facilityGroups || []).reduce((sum, group) => {
    const facility = FACILITY_BY_ID.get(String(group.facilityTypeId || ''));
    return sum + (facility ? safeNonNegativeInteger(group.count) * facility.systemValue : 0);
  }, 0);
  return cash + commodity + facilities - activeLoanLiability(player) - weeklySettlementLiability(player);
}

function recentTradePriceFor(world, kind, assetId, provinceId = DEFAULT_PROVINCE_ID) {
  const marketKey = provinceScopedKey(provinceId, assetId);
  const market = kind === 'facility' ? world.facilityMarkets?.[marketKey] : world.markets?.[marketKey];
  if (kind === 'commodity' && Number.isFinite(Number(market?.officialPrice)) && Number(market.officialPrice) > 0) {
    return Math.max(0, Number(market.officialPrice));
  }
  return Number.isFinite(Number(market?.lastTradePrice)) ? safeNonNegativeInteger(market.lastTradePrice) : 0;
}

function commodityTradeValueFor(world, player) {
  return Object.entries(player.inventories || {}).reduce((sum, [key, inventory]) => {
    const { provinceId, assetId } = splitProvinceScopedKey(key);
    const quantity = safeNonNegativeInteger(inventory?.available)
      + safeNonNegativeInteger(inventory?.frozen)
      + safeNonNegativeInteger(inventory?.inTransit);
    return sum + quantity * recentTradePriceFor(world, 'commodity', assetId, provinceId);
  }, 0);
}

export function wealthAssetsFor(world, player) {
  const cash = safeNonNegativeInteger(player.credits)
    + safeNonNegativeInteger(player.frozenCredits)
    + safeNonNegativeInteger(player?.bankAccount?.depositCredits);
  const commodity = commodityTradeValueFor(world, player);
  const facility = (player.facilityGroups || []).reduce((sum, group) => (
    sum + safeNonNegativeInteger(group.count)
      * recentTradePriceFor(world, 'facility', String(group.facilityTypeId || ''), group.provinceId)
  ), 0);
  return cash + commodity + facility - activeLoanLiability(player) - weeklySettlementLiability(player);
}

function createEmptyPeriodState(period, partial) {
  return {
    version: 1,
    productionRuleVersion: PRODUCTION_RULE_VERSION,
    tradingRuleVersion: TRADING_RULE_VERSION,
    sortRuleVersion: LEADERBOARD_SORT_RULE_VERSION,
    periodKey: period.key,
    startsAt: period.startsAt,
    endsAt: period.endsAt,
    partial: Boolean(partial),
    openingAssets: {},
    openingExternalCredits: {},
    openingPolicyAdjustments: {},
    production: {},
    trading: {},
    productionCheckpoints: {},
    processedFillIds: {},
  };
}

function ensureProductionCheckpoint(state, player) {
  const userId = String(player.userId);
  state.productionCheckpoints[userId] ||= {};
  for (const group of player.facilityGroups || []) {
    const checkpointKey = provinceScopedKey(group.provinceId, group.facilityTypeId);
    state.productionCheckpoints[userId][checkpointKey] = {
      lifetimeOutput: safeNonNegativeInteger(group.lifetimeOutput),
      recipeId: String(group.activeRecipeId || ''),
    };
  }
}

function ensurePlayerPeriodState(world, state, player) {
  const userId = String(player.userId);
  playerStats(player);
  if (!Object.hasOwn(state.openingAssets, userId)) {
    state.openingAssets[userId] = operatingAssetsFor(player);
    state.openingExternalCredits[userId] = externalCreditsFor(player);
    state.openingPolicyAdjustments[userId] = policyAdjustmentFor(player);
    state.production[userId] = { score: 0, quantity: 0 };
    state.trading[userId] = { score: 0, tradeCount: 0, buyers: {} };
    ensureProductionCheckpoint(state, player);
  }
  state.openingPolicyAdjustments ||= {};
  if (!Object.hasOwn(state.openingPolicyAdjustments, userId)) {
    state.openingPolicyAdjustments[userId] = policyAdjustmentFor(player);
  }
  state.production[userId] ||= { score: 0, quantity: 0 };
  state.trading[userId] ||= { score: 0, tradeCount: 0, buyers: {} };
  state.trading[userId].buyers ||= {};
}

function ensureAllPlayers(world, state) {
  for (const player of Object.values(world.players || {})) ensurePlayerPeriodState(world, state, player);
}

function initializeLeaderboardState(world, now, partial = true) {
  const state = createEmptyPeriodState(leaderboardPeriodFor(now), partial);
  world.leaderboardState = state;
  world.leaderboardHistory = Array.isArray(world.leaderboardHistory) ? world.leaderboardHistory : [];
  ensureAllPlayers(world, state);
  return state;
}

function validLeaderboardState(state) {
  return state
    && Number(state.version) === 1
    && typeof state.periodKey === 'string'
    && Number.isFinite(Number(state.startsAt))
    && Number.isFinite(Number(state.endsAt))
    && Number(state.endsAt) > Number(state.startsAt);
}

function captureProduction(world, state) {
  ensureAllPlayers(world, state);
  for (const player of Object.values(world.players || {})) {
    const userId = String(player.userId);
    const checkpoints = state.productionCheckpoints[userId] ||= {};
    for (const group of player.facilityGroups || []) {
      const facilityTypeId = String(group.facilityTypeId || '');
      const checkpointKey = provinceScopedKey(group.provinceId, facilityTypeId);
      const currentOutput = safeNonNegativeInteger(group.lifetimeOutput);
      const previous = checkpoints[checkpointKey];
      if (!previous || currentOutput < safeNonNegativeInteger(previous.lifetimeOutput)) {
        checkpoints[checkpointKey] = {
          lifetimeOutput: currentOutput,
          recipeId: String(group.activeRecipeId || ''),
        };
        continue;
      }
      const delta = currentOutput - safeNonNegativeInteger(previous.lifetimeOutput);
      if (delta > 0) {
        state.production[userId].quantity += delta;
        state.production[userId].score = state.production[userId].quantity;
      }
      checkpoints[checkpointKey] = {
        lifetimeOutput: currentOutput,
        recipeId: String(group.activeRecipeId || ''),
      };
    }
  }
}

function fillIdentifier(order, fill) {
  return String(fill?.id || `${order.id}:${fill?.createdAt}:${fill?.quantity}:${fill?.price}`);
}

function tradeGrossFor(fill) {
  const explicitTotal = Number(fill?.total);
  if (Number.isFinite(explicitTotal) && explicitTotal >= 0) return explicitTotal;
  const quantity = safeNonNegativeInteger(fill?.quantity);
  const price = safeNonNegativeNumber(fill?.price);
  if (quantity < 1 || price <= 0) return 0;
  return quantity * price;
}

function counterpartFor(order, fill, orderById) {
  const makerId = String(fill?.makerOrderId || '');
  const takerId = String(fill?.takerOrderId || '');
  const counterpartId = makerId === String(order.id) ? takerId : makerId;
  return orderById.get(counterpartId) || null;
}

function unionOrders(...collections) {
  const byId = new Map();
  for (const collection of collections) {
    for (const order of collection || []) byId.set(String(order.id), order);
  }
  return [...byId.values()];
}

export function captureTradingFills(world, state, observedOrders = world.orders || []) {
  ensureAllPlayers(world, state);
  const orders = unionOrders(observedOrders, world.orders || []);
  const orderById = new Map(orders.map((order) => [String(order.id), order]));
  for (const order of orders) {
    if (order?.ownerType !== 'player' || order?.side !== 'sell') continue;
    const seller = world.players?.[String(order.ownerId)];
    if (!seller) continue;
    const userId = String(seller.userId);
    ensurePlayerPeriodState(world, state, seller);
    for (const fill of order.fills || []) {
      const fillId = fillIdentifier(order, fill);
      if (Object.hasOwn(state.processedFillIds, fillId)) continue;
      const createdAt = Number(fill?.createdAt || 0);
      if (createdAt < state.startsAt) {
        state.processedFillIds[fillId] = createdAt;
        continue;
      }
      if (createdAt >= state.endsAt) continue;
      const grossVolume = tradeGrossFor(fill);
      const counterpart = counterpartFor(order, fill, orderById);
      if (counterpart?.ownerType === 'player') {
        state.trading[userId].buyers[String(counterpart.ownerId || 'unknown')] = true;
      }
      if (grossVolume > 0) {
        state.trading[userId].score += grossVolume;
        state.trading[userId].tradeCount += 1;
        const stats = playerStats(seller);
        stats.marketSellScore += grossVolume;
        stats.marketTradeCount += 1;
      }
      state.processedFillIds[fillId] = createdAt;
    }
  }
}

function migrateProductionRule(world, state) {
  if (Number(state.productionRuleVersion) === PRODUCTION_RULE_VERSION) return;
  ensureAllPlayers(world, state);
  for (const [userId, production] of Object.entries(state.production || {})) {
    const quantity = safeNonNegativeInteger(production?.quantity);
    state.production[userId] = { score: quantity, quantity };
  }
  state.productionRuleVersion = PRODUCTION_RULE_VERSION;
}

function migrateTradingRule(world, state) {
  if (Number(state.tradingRuleVersion) === TRADING_RULE_VERSION) return;

  for (const [userId, trading] of Object.entries(state.trading || {})) {
    const player = world.players?.[userId];
    if (!player) continue;
    const stats = playerStats(player);
    stats.marketSellScore = Math.max(0, stats.marketSellScore - safeNonNegativeNumber(trading?.score));
    stats.marketTradeCount = Math.max(0, stats.marketTradeCount - safeNonNegativeInteger(trading?.tradeCount));
  }

  state.tradingRuleVersion = TRADING_RULE_VERSION;
  state.trading = {};
  state.processedFillIds = {};
  delete state.pairDayScores;
  ensureAllPlayers(world, state);
  captureTradingFills(world, state, world.orders || []);
}

function migrateSortRule(state) {
  state.sortRuleVersion = LEADERBOARD_SORT_RULE_VERSION;
}

function compareLeaderboardRows(left, right) {
  return right.score - left.score
    || right.activityAt - left.activityAt
    || Number(left.userId) - Number(right.userId);
}

function internalRowsFor(world, state, boardId) {
  return Object.values(world.players || {}).map((player) => {
    const userId = String(player.userId);
    const common = {
      userId: player.userId,
      playerName: player.playerName,
      activityAt: leaderboardActivityAt(player),
    };
    ensurePlayerPeriodState(world, state, player);
    if (boardId === 'wealth') {
      const score = wealthAssetsFor(world, player);
      return { ...common, score, secondary: safeNonNegativeInteger(player.credits) + safeNonNegativeInteger(player.frozenCredits), tertiary: 0 };
    }
    if (boardId === 'growth') {
      const currentAssets = operatingAssetsFor(player);
      const externalDelta = externalCreditsFor(player) - safeNonNegativeInteger(state.openingExternalCredits[userId]);
      const policyDelta = policyAdjustmentFor(player) - Number(state.openingPolicyAdjustments[userId] || 0);
      const score = currentAssets - (Number(state.openingAssets[userId]) || 0) - externalDelta - policyDelta;
      return { ...common, score, secondary: currentAssets, tertiary: 0 };
    }
    if (boardId === 'production') {
      const production = state.production[userId] || { score: 0, quantity: 0 };
      const quantity = safeNonNegativeInteger(production.quantity);
      return { ...common, score: quantity, secondary: 0, tertiary: 0 };
    }
    const trading = state.trading[userId] || { score: 0, tradeCount: 0, buyers: {} };
    return { ...common, score: safeNonNegativeNumber(trading.score), secondary: safeNonNegativeInteger(trading.tradeCount), tertiary: Object.keys(trading.buyers || {}).length };
  }).sort(compareLeaderboardRows).map((entry, index) => ({ ...entry, rank: index + 1 }));
}

function publicEntry(entry, currentUserId, rewardEnabled) {
  return {
    rank: entry.rank,
    userId: Number(entry.userId),
    playerName: entry.playerName,
    score: entry.score,
    secondary: entry.secondary,
    isCurrentPlayer: Number(entry.userId) === Number(currentUserId),
    ...(rewardEnabled && entry.rank <= 3 ? { rewardGems: LEADERBOARD_REWARDS[entry.rank - 1] } : {}),
  };
}

function boardDefinition(boardId) {
  if (boardId === 'wealth') return { title: '财富榜', description: '按最近订单簿成交价计算的实时总资产', unit: 'currency', rewarded: false };
  if (boardId === 'growth') return { title: '增长榜', description: '本周经营资产净增长', unit: 'currency', rewarded: true };
  if (boardId === 'production') return { title: '生产榜', description: '本周服务器确认完成的商品产出总数量', unit: 'quantity', rewarded: true };
  return { title: '交易榜', description: '本周即时市场实际卖出成交额', unit: 'currency', rewarded: true };
}

function readPlayerStats(player) {
  return player?.stats && typeof player.stats === 'object' ? player.stats : {};
}

function readSettledPersonalBest(player, boardId) {
  const best = readPlayerStats(player).leaderboardPersonalBests?.[boardId];
  const score = Number(best?.score);
  const periodKey = typeof best?.periodKey === 'string' ? best.periodKey : '';
  return Number.isFinite(score) && periodKey ? { score, periodKey } : null;
}

function readExternalCredits(player) {
  const stats = readPlayerStats(player);
  return safeNonNegativeInteger(stats.giftIssued)
    + safeNonNegativeInteger(stats.gemExchangeCredits)
    + safeNonNegativeInteger(stats.adminCreditsIssued);
}

function readPolicyAdjustment(player) {
  const stats = readPlayerStats(player);
  return Number(stats.bankDepositInterestEarned || 0)
    - Number(stats.weeklyCashSettlementBurned || 0)
    - Number(stats.weeklyCashSettlementReserveTransferred || 0);
}

function readOperatingAssets(player) {
  const cash = safeNonNegativeInteger(player?.credits)
    + safeNonNegativeInteger(player?.frozenCredits)
    + safeNonNegativeInteger(player?.bankAccount?.depositCredits);
  const commodity = PRODUCT_CATALOG.reduce((sum, product) => (
    sum + inventoryQuantity(player, product.id) * product.basePrice
  ), 0);
  const facilities = (player?.facilityGroups || []).reduce((sum, group) => {
    const facility = FACILITY_BY_ID.get(String(group.facilityTypeId || ''));
    return sum + (facility ? safeNonNegativeInteger(group.count) * facility.systemValue : 0);
  }, 0);
  return cash + commodity + facilities - activeLoanLiability(player) - weeklySettlementLiability(player);
}

function snapshotRowsFor(world, state, boardId) {
  return Object.values(world?.players || {}).map((player) => {
    const userId = String(player.userId);
    const common = {
      userId: player.userId,
      playerName: player.playerName,
      activityAt: leaderboardActivityAt(player),
    };
    if (boardId === 'wealth') {
      const score = wealthAssetsFor(world, player);
      return {
        ...common,
        score,
        secondary: safeNonNegativeInteger(player.credits) + safeNonNegativeInteger(player.frozenCredits),
        tertiary: 0,
      };
    }
    if (boardId === 'growth') {
      const currentAssets = readOperatingAssets(player);
      const currentExternalCredits = readExternalCredits(player);
      const currentPolicyAdjustment = readPolicyAdjustment(player);
      const openingAssetsValue = Number(state?.openingAssets?.[userId]);
      const openingExternalValue = Number(state?.openingExternalCredits?.[userId]);
      const openingPolicyValue = Number(state?.openingPolicyAdjustments?.[userId]);
      const openingAssets = Number.isFinite(openingAssetsValue) ? openingAssetsValue : currentAssets;
      const openingExternalCredits = Number.isFinite(openingExternalValue)
        ? openingExternalValue
        : currentExternalCredits;
      const openingPolicyAdjustment = Number.isFinite(openingPolicyValue)
        ? openingPolicyValue
        : currentPolicyAdjustment;
      const score = currentAssets
        - openingAssets
        - (currentExternalCredits - openingExternalCredits)
        - (currentPolicyAdjustment - openingPolicyAdjustment);
      return { ...common, score, secondary: currentAssets, tertiary: 0 };
    }
    if (boardId === 'production') {
      const production = state?.production?.[userId] || { score: 0, quantity: 0 };
      const quantity = safeNonNegativeInteger(production.quantity);
      return { ...common, score: quantity, secondary: 0, tertiary: 0 };
    }
    const trading = state?.trading?.[userId] || { score: 0, tradeCount: 0, buyers: {} };
    return {
      ...common,
      score: safeNonNegativeNumber(trading.score),
      secondary: safeNonNegativeInteger(trading.tradeCount),
      tertiary: Object.keys(trading.buyers || {}).length,
    };
  }).sort(compareLeaderboardRows).map((entry, index) => ({ ...entry, rank: index + 1 }));
}

function snapshotRowsByBoard(world, state) {
  return Object.fromEntries(BOARD_IDS.map((boardId) => [
    boardId,
    snapshotRowsFor(world, state, boardId),
  ]));
}

export function createLeaderboardSnapshot(world, currentUserId, now = Date.now()) {
  const state = validLeaderboardState(world?.leaderboardState)
    ? world.leaderboardState
    : createEmptyPeriodState(leaderboardPeriodFor(now), true);
  const rowsByBoard = snapshotRowsByBoard(world, state);
  const boards = {};
  for (const boardId of BOARD_IDS) {
    const definition = boardDefinition(boardId);
    const rows = rowsByBoard[boardId];
    const rewardEnabled = definition.rewarded && !state.partial;
    const current = rows.find((entry) => Number(entry.userId) === Number(currentUserId));
    const currentPlayer = world?.players?.[String(currentUserId)];
    const personalBest = currentPlayer ? readSettledPersonalBest(currentPlayer, boardId) : null;
    boards[boardId] = {
      id: boardId,
      ...definition,
      entries: rows.slice(0, LEADERBOARD_TOP_LIMIT).map((entry) => publicEntry(entry, currentUserId, rewardEnabled)),
      currentPlayer: current ? publicEntry(current, currentUserId, rewardEnabled) : null,
      totalPlayers: rows.length,
      personalBest: personalBest ? {
        ...personalBest,
        currentIsRecord: !state.partial && Boolean(current) && Number(current.score) > personalBest.score,
      } : null,
    };
  }
  return {
    period: {
      key: state.periodKey,
      startsAt: state.startsAt,
      endsAt: state.endsAt,
      partial: Boolean(state.partial),
      rewardEnabled: !state.partial,
      rewards: [...LEADERBOARD_REWARDS],
      timeZone: LEADERBOARD_TIME_ZONE,
    },
    boards,
  };
}

function awardPeriod(world, state, settledAt, onGemReward) {
  world.leaderboardHistory = Array.isArray(world.leaderboardHistory) ? world.leaderboardHistory : [];
  if (world.leaderboardHistory.some((period) => period.periodKey === state.periodKey)) return;
  const settledRowsByBoard = {};
  for (const boardId of BOARD_IDS) {
    const rows = internalRowsFor(world, state, boardId);
    settledRowsByBoard[boardId] = rows;
    if (!state.partial) {
      for (const entry of rows) {
        const player = world.players?.[String(entry.userId)];
        if (player) updatePersonalBest(player, boardId, entry.score, state.periodKey);
      }
    }
  }

  const historyBoards = {};
  for (const boardId of REWARDED_BOARD_IDS) {
    const rows = settledRowsByBoard[boardId].filter((entry) => entry.score > 0);
    const winners = rows.slice(0, 3).map((entry, index) => {
      const gems = state.partial ? 0 : LEADERBOARD_REWARDS[index];
      const player = world.players[String(entry.userId)];
      if (player && gems > 0) {
        ensureGemState(player);
        player.gems += gems;
        playerStats(player).leaderboardGemsIssued += gems;
        onGemReward?.({
          userId: Number(entry.userId),
          amount: gems,
          balanceAfter: player.gems,
          category: 'leaderboard_reward',
          description: `${boardDefinition(boardId).title}第 ${index + 1} 名奖励 ${gems} 宝石`,
          sourceKey: `leaderboard:${state.periodKey}:${boardId}:${entry.userId}`,
          createdAt: settledAt,
        });
      }
      return {
        rank: index + 1,
        userId: Number(entry.userId),
        playerName: entry.playerName,
        score: entry.score,
        tieBreakActivityAt: entry.activityAt,
        gems,
      };
    });
    historyBoards[boardId] = winners;
  }
  world.leaderboardHistory.push({
    periodKey: state.periodKey,
    startsAt: state.startsAt,
    endsAt: state.endsAt,
    partial: Boolean(state.partial),
    settledAt,
    boards: historyBoards,
  });
  world.leaderboardHistory = world.leaderboardHistory.slice(-LEADERBOARD_HISTORY_LIMIT);
}

function advancePeriod(world, state) {
  const next = createEmptyPeriodState(leaderboardPeriodFor(state.endsAt), false);
  next.productionCheckpoints = clone(state.productionCheckpoints || {});
  const oldestProcessedAt = next.startsAt - WEEK_MS;
  next.processedFillIds = Object.fromEntries(Object.entries(state.processedFillIds || {}).filter(([, timestamp]) => Number(timestamp) >= oldestProcessedAt));
  world.leaderboardState = next;
  ensureAllPlayers(world, next);
  return next;
}

function processWorldAt(world, now, priorOrderReferences = [], { migrate = true } = {}) {
  processWorld(world, now, { migrate: false });
  processAssetAuctions(world, now, { migrate });
  const state = world.leaderboardState;
  if (validLeaderboardState(state)) {
    captureProduction(world, state);
    captureTradingFills(world, state, unionOrders(priorOrderReferences, world.orders || []));
  }
}

export function processLeaderboardWorld(world, now = Date.now(), options = {}) {
  const migrate = options.migrate !== false;
  world.players ||= {};
  for (const player of Object.values(world.players)) playerStats(player);

  if (!validLeaderboardState(world.leaderboardState)) {
    processWorld(world, now, { migrate: false });
    processAssetAuctions(world, now, { migrate });
    const state = initializeLeaderboardState(world, now, true);
    captureTradingFills(world, state, world.orders || []);
    return world;
  }

  let state = world.leaderboardState;
  migrateProductionRule(world, state);
  migrateTradingRule(world, state);
  migrateSortRule(state);
  while (now >= state.endsAt) {
    const priorOrders = [...(world.orders || [])];
    processWorldAt(world, state.endsAt - 1, priorOrders, { migrate });
    awardPeriod(world, state, state.endsAt, options.onGemReward);
    state = advancePeriod(world, state);
    captureTradingFills(world, state, unionOrders(priorOrders, world.orders || []));
  }

  const priorOrders = [...(world.orders || [])];
  processWorldAt(world, now, priorOrders, { migrate });
  ensureAllPlayers(world, state);
  return world;
}
