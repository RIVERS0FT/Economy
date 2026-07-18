import { FACILITY_TYPE_CATALOG, PRODUCT_CATALOG, ensurePlayer } from './domain.js';
import { processFacilityGroupWorld } from './facility-groups.js';
import { processCollectibleAuctions } from './collectibles.js';
import { ensureGemState } from './invitations.js';

export const LEADERBOARD_TIME_ZONE = 'Asia/Taipei';
export const LEADERBOARD_REWARDS = Object.freeze([30, 20, 10]);
export const LEADERBOARD_TOP_LIMIT = 10;
export const LEADERBOARD_HISTORY_LIMIT = 52;
export const PLAYER_PAIR_DAILY_SCORE_LIMIT = 10_000;

const TAIPEI_OFFSET_MS = 8 * 60 * 60 * 1000;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const PRODUCT_BY_ID = new Map(PRODUCT_CATALOG.map((product) => [product.id, product]));
const FACILITY_BY_ID = new Map(FACILITY_TYPE_CATALOG.map((facility) => [facility.id, facility]));
const STORE_HOOK = Symbol.for('riversoft.economy.leaderboard-store-hook');
const BOARD_IDS = Object.freeze(['wealth', 'growth', 'production', 'trading']);
const REWARDED_BOARD_IDS = Object.freeze(['growth', 'production', 'trading']);

function clone(value) {
  return structuredClone(value);
}

function safeNonNegativeInteger(value) {
  const normalized = Math.floor(Number(value) || 0);
  return Number.isSafeInteger(normalized) && normalized >= 0 ? normalized : 0;
}

function playerStats(player) {
  player.stats ||= {};
  player.stats.productionScore = safeNonNegativeInteger(player.stats.productionScore);
  player.stats.marketSellScore = safeNonNegativeInteger(player.stats.marketSellScore);
  player.stats.marketTradeCount = safeNonNegativeInteger(player.stats.marketTradeCount);
  player.stats.gemExchangeCredits = safeNonNegativeInteger(player.stats.gemExchangeCredits);
  player.stats.leaderboardGemsIssued = safeNonNegativeInteger(player.stats.leaderboardGemsIssued);
  return player.stats;
}

function localDateKey(timestamp) {
  return new Date(Number(timestamp) + TAIPEI_OFFSET_MS).toISOString().slice(0, 10);
}

export function leaderboardPeriodFor(now = Date.now()) {
  const timestamp = Number(now);
  const local = new Date(timestamp + TAIPEI_OFFSET_MS);
  const daysSinceMonday = (local.getUTCDay() + 6) % 7;
  const localMonday = Date.UTC(
    local.getUTCFullYear(),
    local.getUTCMonth(),
    local.getUTCDate() - daysSinceMonday,
  );
  const startsAt = localMonday - TAIPEI_OFFSET_MS;
  return {
    key: localDateKey(startsAt),
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

function inventoryQuantity(player, productId) {
  const inventory = player.inventories?.[productId] || {};
  return safeNonNegativeInteger(inventory.available) + safeNonNegativeInteger(inventory.frozen);
}

export function operatingAssetsFor(player) {
  const cash = safeNonNegativeInteger(player.credits) + safeNonNegativeInteger(player.frozenCredits);
  const commodity = PRODUCT_CATALOG.reduce((sum, product) => (
    sum + inventoryQuantity(player, product.id) * product.basePrice
  ), 0);
  const facilities = (player.facilityGroups || []).reduce((sum, group) => {
    const facility = FACILITY_BY_ID.get(String(group.facilityTypeId || ''));
    return sum + (facility ? safeNonNegativeInteger(group.count) * facility.systemValue : 0);
  }, 0);
  return cash + commodity + facilities;
}

function isOpenOrder(order) {
  return safeNonNegativeInteger(order?.remaining) > 0 && (order?.status === 'open' || order?.status === 'partial');
}

function orderKind(order) {
  return order?.assetKind === 'facility' || order?.facilityTypeId ? 'facility' : 'commodity';
}

function orderAssetId(order) {
  return orderKind(order) === 'facility'
    ? String(order?.assetId || order?.facilityTypeId || '')
    : String(order?.assetId || order?.productId || 'wheat');
}

function bestBidFor(world, kind, assetId, excludedUserId) {
  let best = 0;
  for (const order of world.orders || []) {
    if (
      orderKind(order) !== kind
      || orderAssetId(order) !== assetId
      || order.side !== 'buy'
      || !isOpenOrder(order)
      || Number(order.ownerId) === Number(excludedUserId)
    ) continue;
    best = Math.max(best, safeNonNegativeInteger(order.price));
  }
  return best;
}

export function wealthAssetsFor(world, player) {
  const cash = safeNonNegativeInteger(player.credits) + safeNonNegativeInteger(player.frozenCredits);
  const commodity = PRODUCT_CATALOG.reduce((sum, product) => (
    sum + inventoryQuantity(player, product.id) * bestBidFor(world, 'commodity', product.id, player.userId)
  ), 0);
  const facility = (player.facilityGroups || []).reduce((sum, group) => (
    sum + safeNonNegativeInteger(group.count)
      * bestBidFor(world, 'facility', String(group.facilityTypeId || ''), player.userId)
  ), 0);
  return cash + commodity + facility;
}

function recipeOutputProductId(group) {
  const facility = FACILITY_BY_ID.get(String(group?.facilityTypeId || ''));
  if (!facility) return null;
  const recipe = (facility.recipes || []).find((candidate) => candidate.id === group.activeRecipeId)
    || (facility.recipes || []).find((candidate) => candidate.id === facility.defaultRecipeId)
    || facility.recipes?.[0];
  return recipe?.output?.productId || facility.output?.productId || null;
}

function createEmptyPeriodState(period, partial) {
  return {
    version: 1,
    periodKey: period.key,
    startsAt: period.startsAt,
    endsAt: period.endsAt,
    partial: Boolean(partial),
    openingAssets: {},
    openingExternalCredits: {},
    production: {},
    trading: {},
    productionCheckpoints: {},
    processedFillIds: {},
    pairDayScores: {},
  };
}

function ensureProductionCheckpoint(state, player) {
  const userId = String(player.userId);
  state.productionCheckpoints[userId] ||= {};
  for (const group of player.facilityGroups || []) {
    state.productionCheckpoints[userId][String(group.facilityTypeId)] = {
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
    state.production[userId] = { score: 0, quantity: 0 };
    state.trading[userId] = { score: 0, tradeCount: 0, buyers: {} };
    ensureProductionCheckpoint(state, player);
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
      const currentOutput = safeNonNegativeInteger(group.lifetimeOutput);
      const previous = checkpoints[facilityTypeId];
      if (!previous || currentOutput < safeNonNegativeInteger(previous.lifetimeOutput)) {
        checkpoints[facilityTypeId] = {
          lifetimeOutput: currentOutput,
          recipeId: String(group.activeRecipeId || ''),
        };
        continue;
      }
      const delta = currentOutput - safeNonNegativeInteger(previous.lifetimeOutput);
      if (delta > 0) {
        const product = PRODUCT_BY_ID.get(recipeOutputProductId(group));
        const score = delta * safeNonNegativeInteger(product?.basePrice);
        state.production[userId].quantity += delta;
        state.production[userId].score += score;
        playerStats(player).productionScore += score;
      }
      checkpoints[facilityTypeId] = {
        lifetimeOutput: currentOutput,
        recipeId: String(group.activeRecipeId || ''),
      };
    }
  }
}

function fillIdentifier(order, fill) {
  return String(fill?.id || `${order.id}:${fill?.createdAt}:${fill?.quantity}:${fill?.price}`);
}

function tradeScoreFor(order, fill) {
  const quantity = safeNonNegativeInteger(fill?.quantity);
  const price = safeNonNegativeInteger(fill?.price);
  if (quantity < 1 || price < 1) return 0;
  if (orderKind(order) === 'facility') {
    const facility = FACILITY_BY_ID.get(orderAssetId(order));
    return facility ? quantity * Math.min(price, facility.systemValue * 2) : 0;
  }
  const product = PRODUCT_BY_ID.get(orderAssetId(order));
  return product ? quantity * Math.min(price, product.basePrice * 3) : 0;
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
      const rawScore = tradeScoreFor(order, fill);
      const counterpart = counterpartFor(order, fill, orderById);
      let creditedScore = rawScore;
      if (counterpart?.ownerType === 'player') {
        const buyerId = String(counterpart.ownerId || 'unknown');
        const pairKey = `${userId}:${buyerId}:${localDateKey(createdAt)}`;
        const used = safeNonNegativeInteger(state.pairDayScores[pairKey]);
        creditedScore = Math.max(0, Math.min(rawScore, PLAYER_PAIR_DAILY_SCORE_LIMIT - used));
        state.pairDayScores[pairKey] = used + creditedScore;
        state.trading[userId].buyers[buyerId] = true;
      }
      if (creditedScore > 0) {
        state.trading[userId].score += creditedScore;
        state.trading[userId].tradeCount += 1;
        const stats = playerStats(seller);
        stats.marketSellScore += creditedScore;
        stats.marketTradeCount += 1;
      }
      state.processedFillIds[fillId] = createdAt;
    }
  }
}

function internalRowsFor(world, state, boardId) {
  return Object.values(world.players || {}).map((player) => {
    const userId = String(player.userId);
    ensurePlayerPeriodState(world, state, player);
    if (boardId === 'wealth') {
      const score = wealthAssetsFor(world, player);
      return { userId: player.userId, playerName: player.playerName, registeredAt: player.registeredAt, score, secondary: safeNonNegativeInteger(player.credits) + safeNonNegativeInteger(player.frozenCredits), tertiary: 0 };
    }
    if (boardId === 'growth') {
      const currentAssets = operatingAssetsFor(player);
      const externalDelta = externalCreditsFor(player) - safeNonNegativeInteger(state.openingExternalCredits[userId]);
      const score = currentAssets - safeNonNegativeInteger(state.openingAssets[userId]) - externalDelta;
      return { userId: player.userId, playerName: player.playerName, registeredAt: player.registeredAt, score, secondary: currentAssets, tertiary: 0 };
    }
    if (boardId === 'production') {
      const production = state.production[userId] || { score: 0, quantity: 0 };
      return { userId: player.userId, playerName: player.playerName, registeredAt: player.registeredAt, score: safeNonNegativeInteger(production.score), secondary: safeNonNegativeInteger(production.quantity), tertiary: 0 };
    }
    const trading = state.trading[userId] || { score: 0, tradeCount: 0, buyers: {} };
    return { userId: player.userId, playerName: player.playerName, registeredAt: player.registeredAt, score: safeNonNegativeInteger(trading.score), secondary: safeNonNegativeInteger(trading.tradeCount), tertiary: Object.keys(trading.buyers || {}).length };
  }).sort((left, right) => (
    right.score - left.score
    || right.secondary - left.secondary
    || right.tertiary - left.tertiary
    || safeNonNegativeInteger(left.registeredAt) - safeNonNegativeInteger(right.registeredAt)
    || Number(left.userId) - Number(right.userId)
  )).map((entry, index) => ({ ...entry, rank: index + 1 }));
}

function publicEntry(entry, currentUserId, rewardEnabled) {
  return {
    rank: entry.rank,
    playerName: entry.playerName,
    score: entry.score,
    secondary: entry.secondary,
    isCurrentPlayer: Number(entry.userId) === Number(currentUserId),
    ...(rewardEnabled && entry.rank <= 3 ? { rewardGems: LEADERBOARD_REWARDS[entry.rank - 1] } : {}),
  };
}

function boardDefinition(boardId) {
  if (boardId === 'wealth') return { title: '财富榜', description: '按服务器市场估值计算的实时总资产', unit: 'currency', rewarded: false };
  if (boardId === 'growth') return { title: '增长榜', description: '本周经营资产净增长', unit: 'currency', rewarded: true };
  if (boardId === 'production') return { title: '生产榜', description: '本周产出数量 × 商品基础价', unit: 'points', rewarded: true };
  return { title: '交易榜', description: '本周有效卖出成交积分', unit: 'points', rewarded: true };
}

export function createLeaderboardSnapshot(world, currentUserId, now = Date.now()) {
  const state = validLeaderboardState(world.leaderboardState)
    ? world.leaderboardState
    : initializeLeaderboardState(world, now, true);
  ensureAllPlayers(world, state);
  const boards = {};
  for (const boardId of BOARD_IDS) {
    const definition = boardDefinition(boardId);
    const rows = internalRowsFor(world, state, boardId);
    const rewardEnabled = definition.rewarded && !state.partial;
    const current = rows.find((entry) => Number(entry.userId) === Number(currentUserId));
    boards[boardId] = {
      id: boardId,
      ...definition,
      entries: rows.slice(0, LEADERBOARD_TOP_LIMIT).map((entry) => publicEntry(entry, currentUserId, rewardEnabled)),
      currentPlayer: current ? publicEntry(current, currentUserId, rewardEnabled) : null,
      totalPlayers: rows.length,
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

function leaderboardSnapshotComparable(snapshot) {
  if (!snapshot) return null;
  const comparable = clone(snapshot);
  delete comparable.generatedAt;
  return comparable;
}

function updateViewerSnapshot(world, userId, now) {
  const player = world.players?.[String(userId)];
  if (!player) return;
  const stats = playerStats(player);
  const candidate = createLeaderboardSnapshot(world, userId, now);
  if (JSON.stringify(leaderboardSnapshotComparable(stats.leaderboards)) === JSON.stringify(candidate)) return;
  stats.leaderboards = { ...candidate, generatedAt: now };
}

function awardPeriod(world, state, settledAt) {
  world.leaderboardHistory = Array.isArray(world.leaderboardHistory) ? world.leaderboardHistory : [];
  if (world.leaderboardHistory.some((period) => period.periodKey === state.periodKey)) return;
  const historyBoards = {};
  for (const boardId of REWARDED_BOARD_IDS) {
    const rows = internalRowsFor(world, state, boardId).filter((entry) => entry.score > 0);
    const winners = rows.slice(0, 3).map((entry, index) => {
      const gems = state.partial ? 0 : LEADERBOARD_REWARDS[index];
      const player = world.players[String(entry.userId)];
      if (player && gems > 0) {
        ensureGemState(player);
        player.gems += gems;
        playerStats(player).leaderboardGemsIssued += gems;
      }
      return {
        rank: index + 1,
        userId: Number(entry.userId),
        playerName: entry.playerName,
        score: entry.score,
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

function processWorldAt(world, now, priorOrderReferences = []) {
  processFacilityGroupWorld(world, now);
  processCollectibleAuctions(world, now);
  const state = world.leaderboardState;
  if (validLeaderboardState(state)) {
    captureProduction(world, state);
    captureTradingFills(world, state, unionOrders(priorOrderReferences, world.orders || []));
  }
}

export function processLeaderboardWorld(world, now = Date.now(), currentUserId) {
  world.players ||= {};
  for (const player of Object.values(world.players)) playerStats(player);

  if (!validLeaderboardState(world.leaderboardState)) {
    processFacilityGroupWorld(world, now);
    processCollectibleAuctions(world, now);
    const state = initializeLeaderboardState(world, now, true);
    captureTradingFills(world, state, world.orders || []);
    if (currentUserId !== undefined) updateViewerSnapshot(world, currentUserId, now);
    return world;
  }

  let state = world.leaderboardState;
  while (now >= state.endsAt) {
    const priorOrders = [...(world.orders || [])];
    processWorldAt(world, state.endsAt - 1, priorOrders);
    awardPeriod(world, state, state.endsAt);
    state = advancePeriod(world, state);
    captureTradingFills(world, state, unionOrders(priorOrders, world.orders || []));
  }

  const priorOrders = [...(world.orders || [])];
  processWorldAt(world, now, priorOrders);
  ensureAllPlayers(world, state);
  if (currentUserId !== undefined) updateViewerSnapshot(world, currentUserId, now);
  return world;
}

export function prepareLeaderboardStore(store, user, now = Date.now()) {
  return store.transaction(() => {
    const { revision, stateJson, world } = store.loadWorld(now);
    if (user) ensurePlayer(world, user, now);
    processLeaderboardWorld(world, now, user?.id);
    const nextRevision = store.saveWorldIfChanged(revision, world, now, stateJson);
    return { revision: nextRevision };
  });
}

export function installLeaderboardStoreHooks(EconomyStoreClass) {
  const prototype = EconomyStoreClass?.prototype;
  if (!prototype || prototype[STORE_HOOK]) return;
  Object.defineProperty(prototype, STORE_HOOK, { value: true });

  const getStateSnapshot = prototype.getStateSnapshot;
  prototype.getStateSnapshot = function leaderboardStateSnapshot(user, knownRevision, now = Date.now()) {
    prepareLeaderboardStore(this, user, now);
    return getStateSnapshot.call(this, user, knownRevision, now);
  };

  const apply = prototype.apply;
  prototype.apply = function leaderboardApply(user, request, now = Date.now()) {
    prepareLeaderboardStore(this, user, now);
    const response = apply.call(this, user, request, now);
    prepareLeaderboardStore(this, user, now);
    return response;
  };

  const getGemShopSummary = prototype.getGemShopSummary;
  prototype.getGemShopSummary = function leaderboardGemShopSummary(user, now = Date.now()) {
    prepareLeaderboardStore(this, user, now);
    return getGemShopSummary.call(this, user, now);
  };
}
