import {
  applyAction,
  createClientState,
  ECONOMY_CONSTANTS,
  FACILITY_TYPE_CATALOG,
  PRODUCT_CATALOG,
  processWorld,
} from './domain.js';
import { COMMERCIAL_BUILDING_TYPE_CATALOG } from './commercial-buildings.js';
import { ensureWarehouse } from './warehouse.js';
import { matchIncomingOrder } from './order-matching.js';
import { isOpenOrder, orderAssetId, orderKind } from './order-identity.js';
import { provinceUnlockError } from './province-access.js';
import { findSelfCrossingOrder, SELF_CROSS_MESSAGE } from './order-book-integrity.js';
import { closeOrderInOrderBook, countOpenOrdersForOwner, facilitySellQuantityForOwner, orderById } from './order-book-runtime.js';
import { creditPopulationEmployment, ensurePopulationEconomy } from './population-economy.js';
import { CURRENT_CLIENT_STATE_VERSION } from '../shared/economy-state-version.js';
import { createMarketSummaryStatesByProvince } from './market-state-delivery.js';
import { activeLoanLiability, ensurePlayerBankAccount, mortgagedFacilityQuantity } from './banking.js';
import {
  contractLockedFacilityQuantity,
  leasedInFacilityQuantity,
  leasedOutFacilityQuantity,
  playerLoanCollateralQuantity,
  playerLoanFinancialPosition,
} from './contract-asset-locks.js';
import { weeklySettlementLiability } from './weekly-cash-settlement.js';
import { migrateLegacyProductionMethodRecipeId } from './legacy-production-methods.js';
import { calculateRateMoney, multiplyMoneyByInteger, normalizePlayerMoneyInput, roundInternalMoney } from './money.js';
import {
  DEFAULT_PROVINCE_ID,
  installDefaultProvinceAliases,
  inventoryForProvince,
  marketStatesByProvince,
  migrateProvinceFields,
  normalizeProvinceId,
  provinceScopedKey,
  splitProvinceScopedKey,
  syncDefaultProvinceAlias,
} from './provinces.js';

const TYPES = new Map(FACILITY_TYPE_CATALOG.map((type) => [type.id, type]));
const MAX_CYCLES_PER_GROUP = 50_000;
const MAX_FACILITY_AUCTION_QUANTITY = 1_000_000;
const MAX_FACILITY_RECIPE_BATCH_TARGETS = 64;
const MAX_PRICE_POINTS = 288;
export const FACILITY_STAFFING_FULL_BPS = 10_000;
export const FACILITY_STAFFING_RECOVERY_MS = 10 * 60 * 1000;
export const FACILITY_STAFFING_DECAY_MS = 30 * 60 * 1000;
export const FACILITY_CONFIGURATION_STAFFING_PENALTY_BPS = 2_000;
export const CLIENT_RECENT_CLOSED_ORDER_LIMIT = ECONOMY_CONSTANTS.maxOpenOrders;

function result(ok, message) {
  return { ok, message };
}

function clone(value) {
  return structuredClone(value);
}

function normalizePositiveInteger(value, max = Number.MAX_SAFE_INTEGER) {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  const normalized = Math.floor(number);
  return normalized < 1 || normalized > max ? null : normalized;
}

function normalizeProductionWageMultiplier(value) {
  const normalized = Math.floor(Number(value));
  return Number.isSafeInteger(normalized) && normalized >= 5_000
    ? normalized
    : null;
}

function normalizeStaffingRate(value) {
  const normalized = Math.floor(Number(value));
  return Number.isSafeInteger(normalized)
    && normalized >= 0
    && normalized <= FACILITY_STAFFING_FULL_BPS
    ? normalized
    : null;
}

function normalizeStaffingCarry(value) {
  const normalized = Math.floor(Number(value));
  return Number.isSafeInteger(normalized) && normalized >= 0
    ? normalized % FACILITY_STAFFING_FULL_BPS
    : 0;
}

function staffingDeltaBps(elapsedMs, durationMs) {
  const elapsed = Math.max(0, Math.floor(Number(elapsedMs) || 0));
  if (elapsed <= 0) return 0;
  const delta = BigInt(elapsed) * BigInt(FACILITY_STAFFING_FULL_BPS) / BigInt(durationMs);
  return Number(delta > BigInt(FACILITY_STAFFING_FULL_BPS)
    ? BigInt(FACILITY_STAFFING_FULL_BPS)
    : delta);
}

function projectStaffingRate(group, now) {
  const baseRate = normalizeStaffingRate(group?.staffingRateBps) ?? FACILITY_STAFFING_FULL_BPS;
  const updatedAt = Number.isFinite(Number(group?.staffingUpdatedAt))
    ? Math.max(0, Number(group.staffingUpdatedAt))
    : Math.max(0, Number(now) || 0);
  const elapsed = Math.max(0, Number(now) - updatedAt);
  if (elapsed <= 0) return baseRate;
  if (group?.status === 'running' && group?.enabled) {
    return Math.min(
      FACILITY_STAFFING_FULL_BPS,
      baseRate + staffingDeltaBps(elapsed, FACILITY_STAFFING_RECOVERY_MS),
    );
  }
  return Math.max(0, baseRate - staffingDeltaBps(elapsed, FACILITY_STAFFING_DECAY_MS));
}

function commitStaffingRate(group, now) {
  const normalizedNow = Math.max(0, Number(now) || 0);
  group.staffingRateBps = projectStaffingRate(group, normalizedNow);
  group.staffingUpdatedAt = normalizedNow;
  return group.staffingRateBps;
}

function scaleStaffingRateForExpansion(rateBps, previousCount, nextCount) {
  const rate = normalizeStaffingRate(rateBps) ?? FACILITY_STAFFING_FULL_BPS;
  const previous = Math.max(0, Math.floor(Number(previousCount) || 0));
  const next = Math.max(0, Math.floor(Number(nextCount) || 0));
  if (previous <= 0 || next <= previous) return rate;
  return Number(BigInt(rate) * BigInt(previous) / BigInt(next));
}

function expandAvailableFacilities(group, previousCount, nextCount, now) {
  const previous = Math.max(0, Math.floor(Number(previousCount) || 0));
  const next = Math.max(0, Math.floor(Number(nextCount) || 0));
  if (next <= previous) return;
  const currentRate = commitStaffingRate(group, now);
  group.staffingRateBps = scaleStaffingRateForExpansion(currentRate, previous, next);
  group.staffingUpdatedAt = Math.max(0, Number(now) || 0);
  if (group.status === 'running') group.participatingCount = next;
}

function applyConfigurationStaffingPenalty(group, now) {
  const before = commitStaffingRate(group, now);
  const after = Math.max(0, before - FACILITY_CONFIGURATION_STAFFING_PENALTY_BPS);
  group.staffingRateBps = after;
  group.staffingUpdatedAt = Math.max(0, Number(now) || 0);
  group.staffingBatchCarryBps = 0;
  return { before, after };
}

function cycleCapacity(
  group,
  count,
  rateBps = group?.staffingRateBps,
  carryBps = group?.staffingBatchCarryBps,
) {
  const physicalCount = Math.max(0, Math.floor(Number(count) || 0));
  const staffingRateBps = normalizeStaffingRate(rateBps)
    ?? normalizeStaffingRate(group?.staffingRateBps)
    ?? FACILITY_STAFFING_FULL_BPS;
  const numerator = physicalCount * staffingRateBps + normalizeStaffingCarry(carryBps);
  return {
    effectiveCount: Math.floor(numerator / FACILITY_STAFFING_FULL_BPS),
    carryBps: numerator % FACILITY_STAFFING_FULL_BPS,
  };
}

function calculateProductionWage(cost, multiplierBps) {
  const normalizedCost = roundInternalMoney(cost);
  const normalizedMultiplier = normalizeProductionWageMultiplier(multiplierBps);
  if (normalizedCost === null || normalizedCost < 0 || normalizedMultiplier === null) {
    throw new Error('生产工资参数超出系统可表示范围');
  }
  const wage = calculateRateMoney(normalizedCost, normalizedMultiplier, 10_000, 'half-up');
  if (wage === null) {
    throw new Error('生产工资计算结果超出系统可表示范围');
  }
  return wage;
}

function currentProductionWageMultiplier(world, now) {
  return normalizeProductionWageMultiplier(ensurePopulationEconomy(world, now).policy.productionWageMultiplierBps) || 10_000;
}

function inventoryFor(player, productId, provinceId = DEFAULT_PROVINCE_ID) {
  return inventoryForProvince(player, productId, provinceId);
}

function typeFor(typeId) {
  return TYPES.get(String(typeId || ''));
}

function recipesFor(type) {
  if (Array.isArray(type?.recipes) && type.recipes.length > 0) return type.recipes;
  return type ? [{
    id: `${type.id}-default`,
    name: type.name,
    cycleMs: type.cycleMs,
    operatingCost: type.operatingCost,
    inputs: Array.isArray(type.inputs) ? type.inputs : type.input ? [type.input] : [],
    output: type.output,
  }] : [];
}

function recipeFor(type, recipeId) {
  const recipes = recipesFor(type);
  return recipes.find((recipe) => recipe.id === recipeId)
    || recipes.find((recipe) => recipe.id === type?.defaultRecipeId)
    || recipes[0];
}

function activeRecipeFor(type, group) {
  return recipeFor(type, group?.activeRecipeId);
}

function normalizeOrder(order) {
  const kind = orderKind(order);
  const assetId = orderAssetId(order);
  order.assetKind = kind;
  order.assetId = assetId;
  if (kind === 'facility') order.facilityTypeId = assetId;
  else order.productId = assetId;
  order.fills = Array.isArray(order.fills) ? order.fills : [];
  for (const fill of order.fills) {
    if (fill && typeof fill === 'object') delete fill.counterparty;
  }
  if (order.ownerType === 'player') delete order.ownerName;
  order.provinceId = normalizeProvinceId(order.provinceId);
  return order;
}

function publicOrderFill(fill) {
  return {
    id: String(fill.id || ''),
    quantity: Number(fill.quantity || 0),
    price: Number(fill.price || 0),
    total: Number(fill.total || 0),
    fee: Math.max(0, Number(fill.fee || 0)),
    netTotal: Math.max(0, Number(fill.netTotal ?? fill.total ?? 0)),
    createdAt: Number(fill.createdAt || 0),
  };
}

export function publicOrderView(order, userId) {
  const normalized = normalizeOrder(clone(order));
  const isOwn = Number(normalized.ownerId) === Number(userId);
  normalized.isOwn = isOwn;
  delete normalized.ownerType;
  delete normalized.ownerId;
  delete normalized.ownerName;
  delete normalized.demandGroupId;
  delete normalized.demandTier;
  delete normalized.demandCycleId;
  delete normalized.populationModelId;
  delete normalized.fundingPool;
  delete normalized.fundingSlices;
  delete normalized.marketSellFeeVersion;
  delete normalized.marketSellFeeGross;
  delete normalized.marketSellFeeCharged;
  if (isOwn) normalized.fills = normalized.fills.map(publicOrderFill);
  else delete normalized.fills;
  return normalized;
}

function orderHistoryTimestamp(order) {
  return Math.max(
    Math.max(0, Number(order?.createdAt || 0)),
    ...(Array.isArray(order?.fills) ? order.fills.map((fill) => Math.max(0, Number(fill?.createdAt || 0))) : [0]),
  );
}

function compareOrderHistory(left, right) {
  return orderHistoryTimestamp(right) - orderHistoryTimestamp(left)
    || String(right?.id || '').localeCompare(String(left?.id || ''));
}

function encodeOrderHistoryCursor(order) {
  return Buffer.from(JSON.stringify([
    orderHistoryTimestamp(order),
    String(order?.id || ''),
  ])).toString('base64url');
}

function decodeOrderHistoryCursor(value) {
  if (value === null || value === undefined || value === '') return null;
  try {
    const [createdAt, id] = JSON.parse(Buffer.from(String(value), 'base64url').toString('utf8'));
    if (!Number.isFinite(Number(createdAt)) || typeof id !== 'string' || !id) throw new Error('invalid cursor');
    return { createdAt: Number(createdAt), id };
  } catch {
    const error = new Error('订单历史游标无效');
    error.statusCode = 400;
    throw error;
  }
}

function closedOrdersForOwner(world, userId) {
  return (world.orders || [])
    .filter((order) => !isOpenOrder(order) && Number(order?.ownerId) === Number(userId))
    .sort(compareOrderHistory);
}

export function createOrderHistoryPage(world, userId, { cursor, limit } = {}) {
  const normalizedLimit = Math.min(100, Math.max(1, Number.parseInt(String(limit || '50'), 10) || 50));
  const cursorValue = decodeOrderHistoryCursor(cursor);
  const all = closedOrdersForOwner(world, userId);
  const afterCursor = cursorValue
    ? all.filter((order) => {
      const timestamp = orderHistoryTimestamp(order);
      return timestamp < cursorValue.createdAt
        || (timestamp === cursorValue.createdAt && String(order.id).localeCompare(cursorValue.id) < 0);
    })
    : all;
  const selected = afterCursor.slice(0, normalizedLimit);
  return {
    items: selected.map((order) => publicOrderView(order, userId)),
    total: all.length,
    nextCursor: afterCursor.length > normalizedLimit
      ? encodeOrderHistoryCursor(selected[selected.length - 1])
      : null,
  };
}

function clientOrdersForState(world, userId) {
  const recentClosedIds = new Set(
    closedOrdersForOwner(world, userId)
      .slice(0, CLIENT_RECENT_CLOSED_ORDER_LIMIT)
      .map((order) => String(order.id)),
  );
  return (world.orders || [])
    .filter((order) => (
      Number(order?.ownerId) === Number(userId)
      && (isOpenOrder(order) || recentClosedIds.has(String(order.id)))
    ))
    .map((order) => publicOrderView(order, userId));
}

function listedQuantity(world, ownerId, typeId, provinceId) {
  return facilitySellQuantityForOwner(world, ownerId, typeId, provinceId);
}

function auctionItems(auction) {
  if (Array.isArray(auction?.items) && auction.items.length > 0) return auction.items;
  const kind = auction?.assetKind;
  const assetId = String(auction?.assetId || auction?.facilityTypeId || auction?.productId || '');
  return kind && assetId ? [{ assetKind: kind, assetId, quantity: Math.max(1, Number(auction.quantity || 1)) }] : [];
}

function auctionedQuantity(world, ownerId, typeId, provinceId) {
  return (world.assetAuctions || []).reduce((sum, auction) => {
    if (
      Number(auction?.sellerId) !== Number(ownerId)
      || auction?.status !== 'open'
      || auction?.escrowStatus === 'released'
      || auction?.escrowStatus === 'transferred'
    ) return sum;
    return sum + auctionItems(auction).reduce((itemSum, item) => (
      item.assetKind === 'facility'
        && item.assetId === typeId
        && normalizeProvinceId(item.provinceId ?? auction.provinceId) === normalizeProvinceId(provinceId)
        ? itemSum + Math.max(0, Number(item.quantity || 0))
        : itemSum
    ), 0);
  }, 0);
}

function frozenFacilityQuantity(world, ownerId, typeId, provinceId) {
  return listedQuantity(world, ownerId, typeId, provinceId)
    + auctionedQuantity(world, ownerId, typeId, provinceId);
}

function normalizeStatusReason(value, enabled) {
  const raw = String(value || '');
  if (raw === 'warehouse_full' || raw === 'output_full') return enabled ? undefined : 'manual';
  const mapped = raw === 'listed' ? 'no_available_facility' : raw;
  const allowed = new Set([
    'manual', 'insufficient_funds',
    'insufficient_input', 'no_available_facility', 'maintenance',
  ]);
  if (!allowed.has(mapped)) return enabled ? undefined : 'manual';
  if (!enabled && mapped !== 'manual') return 'manual';
  return mapped;
}

function createGroup(typeId, overrides = {}, now = Date.now()) {
  const type = typeFor(typeId);
  const activeRecipeId = migrateLegacyProductionMethodRecipeId(typeId, overrides.activeRecipeId);
  const legacyStatus = String(overrides.status || 'stopped');
  const legacyPlanComplete = legacyStatus === 'plan_complete' || overrides.statusReason === 'plan_complete';
  const enabled = legacyPlanComplete
    ? false
    : typeof overrides.enabled === 'boolean'
    ? overrides.enabled
    : legacyStatus === 'running' || legacyStatus === 'error'
      || ['full', 'insufficient_funds', 'insufficient_input'].includes(legacyStatus);
  const status = legacyStatus === 'running'
    ? 'running'
    : enabled
      ? 'error'
      : 'stopped';
  const staffingRateBps = normalizeStaffingRate(overrides.staffingRateBps)
    ?? FACILITY_STAFFING_FULL_BPS;
  const staffingUpdatedAt = Number.isFinite(Number(overrides.staffingUpdatedAt))
    ? Math.min(Math.max(0, Number(overrides.staffingUpdatedAt)), Math.max(0, Number(now) || 0))
    : Math.max(0, Number(now) || 0);
  return {
    facilityTypeId: typeId,
    provinceId: normalizeProvinceId(overrides.provinceId),
    count: Math.max(0, Number(overrides.count || 0)),
    participatingCount: Math.max(0, Number(overrides.participatingCount || 0)),
    enabled,
    status,
    statusReason: normalizeStatusReason(overrides.statusReason || overrides.stopReason, enabled),
    cycleStartedAt: overrides.cycleStartedAt,
    cycleWageMultiplierBps: normalizeProductionWageMultiplier(overrides.cycleWageMultiplierBps) || undefined,
    staffingRateBps,
    staffingUpdatedAt,
    staffingBatchCarryBps: normalizeStaffingCarry(overrides.staffingBatchCarryBps),
    lifetimeOutput: Math.max(0, Number(overrides.lifetimeOutput ?? overrides.completedQuantity ?? 0)),
    activeRecipeId: recipeFor(type, activeRecipeId)?.id,
  };
}

function normalizeGroup(group, now = Date.now()) {
  const type = typeFor(group.facilityTypeId);
  if (!type) return null;
  const legacyPendingJoinCount = Math.max(0, Math.floor(Number(group?.pendingJoinCount || 0)));
  const legacyPendingRecipe = recipesFor(type).find((recipe) => recipe.id === group?.pendingRecipeId);
  const normalized = createGroup(type.id, group, now);
  normalized.count = Math.max(0, Math.floor(normalized.count));
  normalized.participatingCount = Math.min(normalized.count, Math.floor(normalized.participatingCount));

  if (normalized.status === 'running' && legacyPendingJoinCount > 0) {
    const previousCount = normalized.participatingCount;
    const nextCount = Math.min(normalized.count, previousCount + legacyPendingJoinCount);
    const currentRate = projectStaffingRate(normalized, now);
    normalized.staffingRateBps = scaleStaffingRateForExpansion(currentRate, previousCount, nextCount);
    normalized.staffingUpdatedAt = Math.max(0, Number(now) || 0);
    normalized.participatingCount = nextCount;
  }

  if (legacyPendingRecipe && legacyPendingRecipe.id !== normalized.activeRecipeId) {
    const currentRate = projectStaffingRate(normalized, now);
    const penalizedRate = Math.max(0, currentRate - FACILITY_CONFIGURATION_STAFFING_PENALTY_BPS);
    normalized.activeRecipeId = legacyPendingRecipe.id;
    normalized.staffingRateBps = penalizedRate;
    normalized.staffingUpdatedAt = Math.max(0, Number(now) || 0);
    normalized.staffingBatchCarryBps = 0;
    if (normalized.status === 'running') {
      normalized.cycleStartedAt = Math.max(0, Number(now) || 0);
      delete normalized.cycleWageMultiplierBps;
    }
  }

  if (!normalized.enabled || normalized.status !== 'running') {
    normalized.participatingCount = 0;
    delete normalized.cycleStartedAt;
    delete normalized.cycleWageMultiplierBps;
    normalized.status = normalized.enabled ? 'error' : 'stopped';
  }
  delete normalized.stopReason;
  return normalized;
}

function groupFor(player, typeId, create = false, now = Date.now(), provinceId = DEFAULT_PROVINCE_ID) {
  player.facilityGroups ||= [];
  const selectedProvinceId = normalizeProvinceId(provinceId);
  let group = player.facilityGroups.find((item) => (
    item.facilityTypeId === typeId && normalizeProvinceId(item.provinceId) === selectedProvinceId
  ));
  if (!group && create) {
    group = createGroup(typeId, { provinceId: selectedProvinceId }, now);
    player.facilityGroups.push(group);
  }
  return group;
}

function seedFacilityHistory(type, now) {
  const offsets = [-4, -2, 0, 2, 1, 3, 0, -1, 2, 0, 1, 0];
  return offsets.map((offset, index) => ({
    price: Math.max(1, type.systemValue + offset),
    quantity: 1 + (index % 3),
    createdAt: now - 120_000 * (offsets.length - index),
  }));
}

function createFacilityMarket(type, now, provinceId = DEFAULT_PROVINCE_ID) {
  return {
    facilityTypeId: type.id,
    provinceId: normalizeProvinceId(provinceId),
    lastPrice: type.systemValue,
    lastTradePrice: null,
    priceHistory: seedFacilityHistory(type, now),
  };
}

function facilityMarketFor(world, typeId, now = Date.now(), provinceId = DEFAULT_PROVINCE_ID) {
  const type = typeFor(typeId);
  if (!type) return null;
  const selectedProvinceId = normalizeProvinceId(provinceId);
  const key = provinceScopedKey(selectedProvinceId, type.id);
  world.facilityMarkets ||= {};
  world.facilityMarkets[key] ||= createFacilityMarket(type, now, selectedProvinceId);
  installDefaultProvinceAliases(world.facilityMarkets);
  if (selectedProvinceId === DEFAULT_PROVINCE_ID) syncDefaultProvinceAlias(world.facilityMarkets, type.id);
  return world.facilityMarkets[key];
}

function recordFacilityPrice(world, typeId, price, quantity, takerSide, createdAt, provinceId) {
  const market = facilityMarketFor(world, typeId, createdAt, provinceId);
  if (!market) return;
  market.lastPrice = price;
  market.lastTradePrice = price;
  market.priceHistory.push({ price, quantity, createdAt, takerSide });
  market.priceHistory = market.priceHistory.slice(-MAX_PRICE_POINTS);
}

function migrateLegacyListings(world) {
  world.orders ||= [];
  for (const order of world.orders) normalizeOrder(order);
  const legacyListings = Array.isArray(world.facilityListings) ? world.facilityListings : [];
  for (const listing of legacyListings) {
    const typeId = String(listing.facilityTypeId || listing.facility?.facilityTypeId || 'farm');
    const type = typeFor(typeId);
    if (!type || listing.ownerType !== 'player' || world.orders.some((order) => order.id === listing.id)) continue;
    const quantity = Math.max(1, Math.floor(Number(listing.quantity || 1)));
    world.orders.push({
      id: String(listing.id || `facility-order-${type.id}-${world.orders.length}`),
      assetKind: 'facility',
      assetId: type.id,
      facilityTypeId: type.id,
      provinceId: normalizeProvinceId(listing.provinceId),
      side: 'sell',
      ownerType: listing.ownerType === 'player' ? 'player' : 'market',
      ownerId: listing.ownerId,
      price: Math.max(1, Math.floor(Number(listing.unitPrice || listing.price || type.systemValue))),
      quantity,
      remaining: quantity,
      status: 'open',
      createdAt: Number(listing.createdAt || Date.now()),
    });
  }
  world.facilityListings = [];
}

export function removeSystemFacilityOrders(world) {
  const orders = world.orders || (world.orders = []);
  const hasSystemFacilityOrder = orders.some((order) => (
    orderKind(order) === 'facility' && order.ownerType === 'market'
  ));
  if (!hasSystemFacilityOrder) return world;
  world.orders = orders.filter((order) => !(
    orderKind(order) === 'facility' && order.ownerType === 'market'
  ));
  return world;
}

function migrateLegacyPlayer(world, player, now) {
  ensureWarehouse(player);
  player.facilityGroups ||= [];
  player.stats ||= {};
  player.stats.producedGoods = Number(player.stats.producedGoods || 0);
  player.stats.boughtGoods = Number(player.stats.boughtGoods || 0);
  player.stats.soldGoods = Number(player.stats.soldGoods || 0);
  player.stats.giftIssued = Number(player.stats.giftIssued || 0);
  player.stats.gemExchangeCredits = Number(player.stats.gemExchangeCredits || 0);
  player.stats.populationIncome = Number(player.stats.populationIncome || 0);
  player.stats.employmentPayments = Number(player.stats.employmentPayments || 0);
  player.stats.productionPayroll = Number(player.stats.productionPayroll || 0);
  player.stats.constructionPayroll = Number(player.stats.constructionPayroll || 0);
  player.stats.facilitiesConstructed = Number(player.stats.facilitiesConstructed || 0);
  player.stats.constructionMaterialsConsumed = player.stats.constructionMaterialsConsumed && typeof player.stats.constructionMaterialsConsumed === 'object'
    ? player.stats.constructionMaterialsConsumed
    : {};
  player.stats.warehousePayroll = Number(player.stats.warehousePayroll || 0);
  player.stats.marketServiceFees = Number(player.stats.marketServiceFees || 0);
  player.stats.bankCreditIssued = Number(player.stats.bankCreditIssued || 0);
  player.stats.bankPrincipalRepaid = Number(player.stats.bankPrincipalRepaid || 0);
  player.stats.bankInterestPaid = Number(player.stats.bankInterestPaid || 0);
  player.stats.bankDepositInterestEarned = Number(player.stats.bankDepositInterestEarned || 0);
  player.stats.bankDefaults = Number(player.stats.bankDefaults || 0);
  player.stats.bankFacilitiesSeized = Number(player.stats.bankFacilitiesSeized || 0);

  let migratedConstructionTypeId = null;
  if (player.facilityConstruction) {
    const construction = player.facilityConstruction;
    const constructionType = typeFor(construction.facilityTypeId);
    if (constructionType) {
      const paidBuildCost = Math.max(0, Number(construction.buildCost ?? constructionType.buildCost) || 0);
      const employmentReleased = Math.max(0, Number(construction.employmentReleased || 0));
      const remainingEmployment = Math.max(0, paidBuildCost - employmentReleased);
      if (remainingEmployment > 0) creditPopulationEmployment(world, remainingEmployment, 'construction');
      addPurchasedGroup(world, player, constructionType.id, 1, now);
      player.stats.facilitiesConstructed += 1;
      migratedConstructionTypeId = constructionType.id;
    }
    delete player.facilityConstruction;
  }

  if (Array.isArray(player.facilities) && player.facilities.length > 0) {
    const byType = new Map();
    for (const facility of player.facilities) {
      const type = typeFor(facility.facilityTypeId || 'farm');
      if (!type) continue;
      const legacyGoods = Math.max(0, Number(facility.internalGoods || 0));
      if (legacyGoods > 0) inventoryFor(player, type.output.productId, DEFAULT_PROVINCE_ID).available += legacyGoods;
      if (facility.status === 'constructing') {
        if (type.id !== migratedConstructionTypeId) {
          addPurchasedGroup(world, player, type.id, 1, now);
          player.stats.facilitiesConstructed += 1;
        }
        continue;
      }
      const bucket = byType.get(type.id) || [];
      bucket.push(facility);
      byType.set(type.id, bucket);
    }
    for (const [typeId, facilities] of byType) {
      const existing = groupFor(player, typeId, true, now, DEFAULT_PROVINCE_ID);
      if (existing.count > 0) continue;
      const allRunning = facilities.every((facility) => facility.status === 'running');
      existing.count = facilities.length;
      existing.enabled = allRunning;
      existing.status = allRunning ? 'running' : 'stopped';
      existing.statusReason = allRunning ? undefined : 'manual';
      existing.participatingCount = allRunning ? facilities.length : 0;
      existing.cycleStartedAt = allRunning ? now : undefined;
      existing.activeRecipeId = recipeFor(type)?.id;
    }
  }

  player.facilityGroups = player.facilityGroups
    .map((group) => normalizeGroup(group, now))
    .filter(Boolean);
  delete player.facilities;
}

export function migrateFacilityGroupWorld(world, now = Date.now()) {
  migrateProvinceFields(world);
  world.players ||= {};
  world.orders ||= [];
  migrateLegacyListings(world);
  removeSystemFacilityOrders(world);
  world.facilityMarkets ||= {};
  for (const type of FACILITY_TYPE_CATALOG) {
    const market = facilityMarketFor(world, type.id, now, DEFAULT_PROVINCE_ID);
    if (market.lastTradePrice === undefined) {
      const latestTrade = [...(market.priceHistory || [])].reverse().find((point) => point.takerSide === 'buy' || point.takerSide === 'sell');
      market.lastTradePrice = latestTrade ? Number(latestTrade.price) : null;
    }
  }
  for (const player of Object.values(world.players)) migrateLegacyPlayer(world, player, now);
  retireOpenFacilityMarketOrders(world, now);

  for (const player of Object.values(world.players)) {
    player.facilityGroups = (player.facilityGroups || [])
      .map((group) => normalizeGroup(group, now))
      .filter(Boolean);
    for (const group of player.facilityGroups) {
      const available = availableGroupCount(world, player, group);
      if (group.status === 'running') {
        const previousCount = group.participatingCount;
        if (available > previousCount) expandAvailableFacilities(group, previousCount, available, now);
        else group.participatingCount = available;
        if (group.participatingCount < 1) setGroupError(group, 'no_available_facility', now);
      }
      reconcileFacilityGroup(world, player, group, now);
    }
  }

  world.version = 20;
  return world;
}

export function stripLegacyFacilityInstances(world) {
  for (const player of Object.values(world.players || {})) delete player.facilities;
  world.facilityListings = [];
  world.version = 20;
  return world;
}

function withLegacyFacilitiesSuppressed(world, callback) {
  const playerSnapshots = [];
  for (const player of Object.values(world.players || {})) {
    playerSnapshots.push({ player, facilities: player.facilities });
    player.facilities = [];
  }
  const listings = world.facilityListings;
  world.facilityListings = [];
  try {
    return callback();
  } finally {
    world.facilityListings = listings || [];
    for (const snapshot of playerSnapshots) {
      if (snapshot.facilities === undefined) delete snapshot.player.facilities;
      else snapshot.player.facilities = snapshot.facilities;
    }
  }
}

function clearGroupRuntime(group) {
  group.participatingCount = 0;
  delete group.cycleStartedAt;
  delete group.cycleWageMultiplierBps;
}

function setGroupStopped(group, reason = 'manual', now = Date.now()) {
  if (group.status !== 'stopped' || group.enabled) commitStaffingRate(group, now);
  group.enabled = false;
  group.status = 'stopped';
  group.statusReason = reason;
  clearGroupRuntime(group);
}

function setGroupError(group, reason, now = Date.now()) {
  if (group.status !== 'error') commitStaffingRate(group, now);
  group.enabled = true;
  group.status = 'error';
  group.statusReason = reason;
  clearGroupRuntime(group);
}

function startGroupRuntime(world, group, count, now) {
  const staffingRateBps = commitStaffingRate(group, now);
  group.enabled = true;
  group.status = 'running';
  delete group.statusReason;
  group.participatingCount = count;
  group.cycleStartedAt = now;
  group.cycleWageMultiplierBps = currentProductionWageMultiplier(world, now);
  group.staffingRateBps = staffingRateBps;
}

function recipeInputs(recipe) {
  const items = Array.isArray(recipe?.inputs) ? recipe.inputs : recipe?.input ? [recipe.input] : [];
  const quantities = new Map();
  for (const item of items) {
    const productId = String(item?.productId || '');
    const quantity = Math.max(0, Number(item?.quantity || 0));
    if (!productId || quantity <= 0) continue;
    quantities.set(productId, (quantities.get(productId) || 0) + quantity);
  }
  return [...quantities].map(([productId, quantity]) => ({ productId, quantity }));
}

function groupRequirements(recipe, count) {
  const participating = Math.max(0, Number(count || 0));
  const inputs = recipeInputs(recipe).map((item) => ({
    productId: item.productId,
    quantity: item.quantity * participating,
  }));
  const output = recipe.output.quantity * participating;
  const cost = multiplyMoneyByInteger(recipe.operatingCost, participating) ?? Number.POSITIVE_INFINITY;
  const inputTotal = inputs.reduce((sum, item) => sum + item.quantity, 0);
  return {
    output,
    inputs,
    inputTotal,
    cost,
    netStorage: Math.max(0, output - inputTotal),
  };
}

function blockReason(world, player, group, type, physicalCount, effectiveCount = physicalCount) {
  const recipe = activeRecipeFor(type, group);
  if (physicalCount <= 0) return { reason: 'no_available_facility', message: '没有可参与生产的工厂' };
  const requirements = groupRequirements(recipe, effectiveCount);
  if (requirements.cost > player.credits) {
    return { reason: 'insufficient_funds', message: '运营资金不足' };
  }
  if (requirements.inputs.some((item) => inventoryFor(player, item.productId, group.provinceId).available < item.quantity)) {
    return { reason: 'insufficient_input', message: '生产原料不足' };
  }
  return null;
}

function availableGroupCount(world, player, group) {
  const frozen = frozenFacilityQuantity(world, player.userId, group.facilityTypeId, group.provinceId);
  const leasedOut = leasedOutFacilityQuantity(world, player.userId, group.facilityTypeId, group.provinceId);
  const leasedIn = leasedInFacilityQuantity(world, player.userId, group.facilityTypeId, group.provinceId);
  return Math.max(0, group.count - frozen - leasedOut + leasedIn);
}

function transferableGroupCount(world, player, group) {
  const frozen = frozenFacilityQuantity(world, player.userId, group.facilityTypeId, group.provinceId);
  const bankMortgaged = mortgagedFacilityQuantity(player, group.facilityTypeId, group.provinceId);
  const contractLocked = contractLockedFacilityQuantity(world, player.userId, group.facilityTypeId, group.provinceId);
  return Math.max(0, group.count - frozen - bankMortgaged - contractLocked);
}

function reconcileFacilityGroup(world, player, group, now) {
  const type = typeFor(group.facilityTypeId);
  if (!type) return;

  if (!group.enabled) {
    setGroupStopped(group, 'manual', now);
    return;
  }

  const available = availableGroupCount(world, player, group);
  if (group.status === 'running') {
    group.cycleWageMultiplierBps = normalizeProductionWageMultiplier(group.cycleWageMultiplierBps)
      || currentProductionWageMultiplier(world, now);
    const previousCount = group.participatingCount;
    if (available > previousCount) expandAvailableFacilities(group, previousCount, available, now);
    else group.participatingCount = available;
    if (group.participatingCount < 1) {
      setGroupError(group, 'no_available_facility', now);
      return;
    }
    const recipe = activeRecipeFor(type, group);
    const cycleDueAt = Number(group.cycleStartedAt || now) + recipe.cycleMs;
    const evaluationAt = Math.min(Math.max(0, Number(now) || 0), cycleDueAt);
    const liveStaffingRateBps = projectStaffingRate(group, evaluationAt);
    const capacity = cycleCapacity(group, group.participatingCount, liveStaffingRateBps);
    const blocked = blockReason(
      world,
      player,
      group,
      type,
      group.participatingCount,
      capacity.effectiveCount,
    );
    if (!blocked) return;
    setGroupError(group, blocked.reason, now);
    return;
  }

  const staffingRateBps = projectStaffingRate(group, now);
  const capacity = cycleCapacity(group, available, staffingRateBps);
  const blocked = blockReason(
    world,
    player,
    group,
    type,
    available,
    capacity.effectiveCount,
  );
  if (!blocked) {
    startGroupRuntime(world, group, available, now);
    return;
  }
  if (group.status !== 'error' || group.statusReason !== blocked.reason) {
    setGroupError(group, blocked.reason, now);
  }
}

function executeCycle(world, player, group, type, count, capacity, cycleDueAt, now) {
  const recipe = activeRecipeFor(type, group);
  const requirements = groupRequirements(recipe, capacity.effectiveCount);
  const wageMultiplierBps = normalizeProductionWageMultiplier(group.cycleWageMultiplierBps) || 10_000;
  const populationWage = calculateProductionWage(requirements.cost, wageMultiplierBps);
  player.credits -= requirements.cost;
  if (requirements.cost > 0 || populationWage > 0) {
    creditPopulationEmployment(world, populationWage, 'production', {
      complexity: type.complexity,
      payerAmount: requirements.cost,
    });
  }
  player.stats.productionPayroll = Number(player.stats.productionPayroll || 0) + requirements.cost;
  player.stats.employmentPayments = Number(player.stats.employmentPayments || 0) + requirements.cost;
  player.stats.producedGoods = Number(player.stats.producedGoods || 0) + requirements.output;
  for (const item of requirements.inputs) inventoryFor(player, item.productId, group.provinceId).available -= item.quantity;
  inventoryFor(player, recipe.output.productId, group.provinceId).available += requirements.output;
  group.lifetimeOutput += requirements.output;
  group.staffingBatchCarryBps = capacity.carryBps;
  group.cycleStartedAt = cycleDueAt;
  commitStaffingRate(group, cycleDueAt);
  group.cycleWageMultiplierBps = currentProductionWageMultiplier(world, now);
}


function processGroup(world, player, group, now) {
  reconcileFacilityGroup(world, player, group, now);
  const type = typeFor(group.facilityTypeId);
  if (!type || group.status !== 'running' || !group.cycleStartedAt) return;

  let processed = 0;
  while (processed < MAX_CYCLES_PER_GROUP && group.status === 'running') {
    const recipe = activeRecipeFor(type, group);
    if (now - group.cycleStartedAt < recipe.cycleMs) break;
    const cycleDueAt = group.cycleStartedAt + recipe.cycleMs;
    const settlementStaffingRateBps = projectStaffingRate(group, cycleDueAt);
    const capacity = cycleCapacity(group, group.participatingCount, settlementStaffingRateBps);
    const blocked = blockReason(
      world,
      player,
      group,
      type,
      group.participatingCount,
      capacity.effectiveCount,
    );
    if (blocked) {
      setGroupError(group, blocked.reason, cycleDueAt);
      break;
    }

    executeCycle(world, player, group, type, group.participatingCount, capacity, cycleDueAt, now);
    processed += 1;

    const nextStaffingRateBps = projectStaffingRate(group, group.cycleStartedAt);
    const nextCapacity = cycleCapacity(group, group.participatingCount, nextStaffingRateBps);
    const nextBlocked = blockReason(
      world,
      player,
      group,
      type,
      group.participatingCount,
      nextCapacity.effectiveCount,
    );
    if (nextBlocked) {
      setGroupError(group, nextBlocked.reason, group.cycleStartedAt);
      break;
    }
  }
}

function reconcileAllFacilityGroups(world, now) {
  for (const player of Object.values(world.players || {})) {
    ensureWarehouse(player);
    for (const group of player.facilityGroups || []) reconcileFacilityGroup(world, player, group, now);
  }
}

export function productionReservedQuantitiesForPlayer(world, userId, provinceId) {
  const player = world.players?.[String(userId)];
  const reserved = {};
  if (!player) return reserved;
  for (const group of player.facilityGroups || []) {
    if (provinceId !== undefined && normalizeProvinceId(group.provinceId) !== normalizeProvinceId(provinceId)) continue;
    if (!group.enabled) continue;
    const type = typeFor(group.facilityTypeId);
    if (!type) continue;
    const physicalCount = group.status === 'running'
      ? Math.max(0, Math.floor(Number(group.participatingCount || 0)))
      : availableGroupCount(world, player, group);
    if (physicalCount < 1) continue;
    for (const input of recipeInputs(activeRecipeFor(type, group))) {
      const quantity = Math.max(0, Math.floor(Number(input.quantity || 0))) * physicalCount;
      if (quantity > 0) reserved[input.productId] = Number(reserved[input.productId] || 0) + quantity;
    }
  }
  return reserved;
}


function addPurchasedGroup(world, player, typeId, quantity, now = Date.now(), provinceId = DEFAULT_PROVINCE_ID) {
  const group = groupFor(player, typeId, true, now, provinceId);
  const previousAvailable = availableGroupCount(world, player, group);
  group.count += quantity;
  const nextAvailable = availableGroupCount(world, player, group);
  expandAvailableFacilities(group, previousAvailable, nextAvailable, now);
  return group;
}

function matchFacilityOrder(world, incoming, createdAt) {
  const typeId = orderAssetId(incoming);
  return matchIncomingOrder({
    world,
    incoming,
    createdAt,
    canMatch: ({ resting }) => resting.ownerType === 'player' && incoming.ownerType === 'player',
    settleTrade: ({ buy, sell, quantity, price, sellerSettlement }) => {
      if (buy.ownerType === 'player') {
        const buyer = world.players[String(buy.ownerId)];
        if (!buyer) throw new Error(`Missing facility buyer ${buy.ownerId}`);
        const reserved = quantity * Number(buy.price);
        const actual = quantity * price;
        buyer.frozenCredits -= reserved;
        buyer.credits += reserved - actual;
        buyer.stats.facilityVolume = Number(buyer.stats.facilityVolume || 0) + actual;
        addPurchasedGroup(world, buyer, typeId, quantity, createdAt, incoming.provinceId);
      }

      if (sell.ownerType === 'player') {
        const seller = world.players[String(sell.ownerId)];
        if (!seller) throw new Error(`Missing facility seller ${sell.ownerId}`);
        const group = groupFor(seller, typeId, false, createdAt, incoming.provinceId);
        if (!group || group.count < quantity) throw new Error('卖方工厂数量不足');
        group.count -= quantity;
        seller.credits += sellerSettlement.netTotal;
        if (sellerSettlement.fee > 0) {
          creditPopulationEmployment(world, sellerSettlement.fee, 'marketService');
          seller.stats.marketServiceFees = Number(seller.stats.marketServiceFees || 0) + sellerSettlement.fee;
          seller.stats.employmentPayments = Number(seller.stats.employmentPayments || 0) + sellerSettlement.fee;
        }
        seller.stats.facilityVolume = Number(seller.stats.facilityVolume || 0) + quantity * price;
        if (group.count === 0) seller.facilityGroups = seller.facilityGroups.filter((item) => item !== group);
      }
    },
    recordTrade: ({ quantity, price, takerSide }) => {
      recordFacilityPrice(world, typeId, price, quantity, takerSide, createdAt, incoming.provinceId);
    },
  });
}

export function processFacilityGroupWorld(world, now = Date.now(), { migrate = true } = {}) {
  removeSystemFacilityOrders(world);
  if (migrate) migrateFacilityGroupWorld(world, now);
  if (migrate) withLegacyFacilitiesSuppressed(world, () => processWorld(world, now, { migrate: false }));
  else processWorld(world, now, { migrate: false });
  if (migrate) migrateFacilityGroupWorld(world, now);
  removeSystemFacilityOrders(world);
  for (const player of Object.values(world.players || {})) {
    ensureWarehouse(player);
    for (const group of player.facilityGroups || []) processGroup(world, player, group, now);
  }
  reconcileAllFacilityGroups(world, now);
  if (migrate) stripLegacyFacilityInstances(world);
  return world;
}

function getPlayer(world, userId) {
  const player = world.players[String(userId)];
  if (!player) throw new Error(`Missing player ${userId}`);
  return player;
}

function buildFacilityGroup(world, userId, payload, now) {
  const player = getPlayer(world, userId);
  const type = typeFor(payload.facilityTypeId);
  const provinceId = normalizeProvinceId(payload.provinceId);
  if (!type) return result(false, '工厂类型不存在');
  const quantity = normalizePositiveInteger(payload.quantity ?? 1, 100);
  if (!quantity) return result(false, '建造数量必须为 1 到 100 的整数');
  const totalCost = multiplyMoneyByInteger(type.buildCost, quantity);
  if (totalCost === null) return result(false, '建造资金超出系统可表示范围');
  if (!Array.isArray(type.buildInputs)) return result(false, '工厂建造材料目录无效');
  const buildInputs = [];
  for (const item of type.buildInputs) {
    const required = Number(item.quantity) * quantity;
    if (!Number.isSafeInteger(required) || required < 1) return result(false, '建造材料数量超出系统可表示范围');
    buildInputs.push({ productId: String(item.productId || ''), quantity: required });
  }
  if (player.credits < totalCost) return result(false, '建造资金不足');
  const missingInput = buildInputs.find((item) => inventoryFor(player, item.productId, provinceId).available < item.quantity);
  if (missingInput) {
    const product = PRODUCT_CATALOG.find((item) => item.id === missingInput.productId);
    return result(false, `${product?.name || missingInput.productId}建造材料不足`);
  }

  player.credits -= totalCost;
  for (const item of buildInputs) inventoryFor(player, item.productId, provinceId).available -= item.quantity;
  player.stats.constructionPayroll = Number(player.stats.constructionPayroll || 0) + totalCost;
  player.stats.employmentPayments = Number(player.stats.employmentPayments || 0) + totalCost;
  player.stats.facilitiesConstructed = Number(player.stats.facilitiesConstructed || 0) + quantity;
  player.stats.constructionMaterialsConsumed ||= {};
  for (const item of buildInputs) {
    player.stats.constructionMaterialsConsumed[item.productId] = Number(
      player.stats.constructionMaterialsConsumed[item.productId] || 0,
    ) + item.quantity;
  }
  creditPopulationEmployment(world, totalCost, 'construction');
  addPurchasedGroup(world, player, type.id, quantity, now, provinceId);
  return result(true, `${quantity} 座${type.name}已建成并加入同类工厂集群`);
}

function startFacilityGroup(world, userId, payload, now) {
  const player = getPlayer(world, userId);
  const type = typeFor(payload.facilityTypeId);
  const group = type ? groupFor(player, type.id, false, now, payload.provinceId) : null;
  if (!type || !group || availableGroupCount(world, player, group) < 1) return result(false, '工厂集群不存在或没有可用生产权');
  group.enabled = true;
  reconcileFacilityGroup(world, player, group, now);
  if (group.status === 'running') {
    return result(true, `${type.name}已开启生产，${group.participatingCount} 座未冻结工厂参与当前周期`);
  }
  const reason = blockReason(world, player, group, type, availableGroupCount(world, player, group));
  return result(true, `${type.name}已开启自动运行，当前${reason?.message || '等待条件恢复'}，条件满足后将自动恢复生产`);
}

function pauseFacilityGroup(world, userId, payload, now) {
  const player = getPlayer(world, userId);
  const type = typeFor(payload.facilityTypeId);
  const group = type ? groupFor(player, type.id, false, now, payload.provinceId) : null;
  if (!group) return result(false, '工厂集群不存在');
  setGroupStopped(group, 'manual', now);
  return result(true, `${type.name}已停止生产并关闭自动恢复`);
}

function productionMethodName(type, recipe) {
  const group = type?.productionMethodGroups?.find((candidate) => candidate.id === 'operation')
    || type?.productionMethodGroups?.[0];
  const methodId = recipe?.productionMethodId || group?.defaultMethodId;
  return group?.methods?.find((method) => method.id === methodId)?.name || '默认作业制度';
}

function recipeConfigurationLabel(type, recipe) {
  return `${recipe?.name || type?.name || '生产配置'} · ${productionMethodName(type, recipe)}`;
}

function setGroupRecipe(world, userId, payload, now) {
  const player = getPlayer(world, userId);
  const type = typeFor(payload.facilityTypeId);
  const group = type ? groupFor(player, type.id, false, now, payload.provinceId) : null;
  if (!group) return result(false, '工厂集群不存在');
  const recipes = recipesFor(type);
  const recipe = recipes.find((candidate) => candidate.id === payload.recipeId);
  if (!recipe) return result(false, '生产配方不存在');
  const currentRecipe = activeRecipeFor(type, group);
  if (currentRecipe?.id === recipe.id) {
    delete group.pendingRecipeId;
    return result(true, `${type.name}已经使用${recipeConfigurationLabel(type, recipe)}`);
  }

  const { before, after } = applyConfigurationStaffingPenalty(group, now);
  group.activeRecipeId = recipe.id;
  delete group.pendingRecipeId;

  if (group.status === 'running') {
    group.participatingCount = availableGroupCount(world, player, group);
    group.cycleStartedAt = now;
    group.cycleWageMultiplierBps = currentProductionWageMultiplier(world, now);
    const capacity = cycleCapacity(group, group.participatingCount, after);
    const blocked = blockReason(
      world,
      player,
      group,
      type,
      group.participatingCount,
      capacity.effectiveCount,
    );
    if (blocked) setGroupError(group, blocked.reason, now);
  } else {
    reconcileFacilityGroup(world, player, group, now);
  }

  return result(
    true,
    `已切换为${recipeConfigurationLabel(type, recipe)}，生产进度已清零，满员率由 ${Math.round(before / 100)}% 降至 ${Math.round(after / 100)}%`,
  );
}

function setGroupRecipes(world, userId, payload, now) {
  const player = getPlayer(world, userId);
  const targets = Array.isArray(payload?.targets) ? payload.targets : [];
  if (targets.length < 1 || targets.length > MAX_FACILITY_RECIPE_BATCH_TARGETS) {
    return result(false, `批量生产配置必须包含 1 到 ${MAX_FACILITY_RECIPE_BATCH_TARGETS} 个地区目标`);
  }

  const seen = new Set();
  const prepared = [];
  for (const target of targets) {
    const requestedProvinceId = String(target?.provinceId || '');
    if (!requestedProvinceId) return result(false, '批量生产配置缺少地区');
    const provinceId = normalizeProvinceId(requestedProvinceId);
    const type = typeFor(target?.facilityTypeId);
    if (!type) return result(false, '工厂类型不存在');
    const key = `${provinceId}:${type.id}`;
    if (seen.has(key)) return result(false, '批量生产配置包含重复地区工厂');
    seen.add(key);

    const accessError = provinceUnlockError(player, provinceId);
    if (accessError) return result(false, accessError);
    const group = groupFor(player, type.id, false, now, provinceId);
    if (!group) return result(false, '工厂集群不存在');
    const recipe = recipesFor(type).find((candidate) => candidate.id === target?.recipeId);
    if (!recipe) return result(false, '生产配方不存在');
    prepared.push({ provinceId, type, recipe });
  }

  for (const item of prepared) {
    const applied = setGroupRecipe(world, userId, {
      provinceId: item.provinceId,
      facilityTypeId: item.type.id,
      recipeId: item.recipe.id,
    }, now);
    if (!applied.ok) return applied;
  }
  return result(true, `已更新 ${prepared.length} 个地区的生产配置`);
}

function reduceRunningGroupForSellOrder(group, type, quantity, now = Date.now()) {
  if (group.status !== 'running') return;
  group.participatingCount = Math.max(0, group.participatingCount - quantity);
  if (group.participatingCount < 1) {
    setGroupError(group, 'no_available_facility', now);
  }
}

function placeFacilityOrder(world, userId, payload, now) {
  const player = getPlayer(world, userId);
  const side = payload.side === 'buy' ? 'buy' : payload.side === 'sell' ? 'sell' : null;
  const typeId = String(payload.assetId || payload.facilityTypeId || '');
  const type = typeFor(typeId);
  const provinceId = normalizeProvinceId(payload.provinceId);
  const quantity = normalizePositiveInteger(payload.quantity, ECONOMY_CONSTANTS.maxOrderQuantity);
  const price = normalizePlayerMoneyInput(payload.price ?? payload.unitPrice, { min: 0.01 });
  if (!side || !type || !quantity || !price) return result(false, '工厂订单参数无效');
  const total = multiplyMoneyByInteger(price, quantity);
  if (total === null) return result(false, '工厂订单总额超出系统可表示范围');
  if (countOpenOrdersForOwner(world, userId) >= ECONOMY_CONSTANTS.maxOpenOrders) return result(false, '未完成订单数量已达上限');
  if (findSelfCrossingOrder(world, {
    ownerId: userId,
    assetKind: 'facility',
    assetId: type.id,
    provinceId,
    side,
    price,
  })) return result(false, SELF_CROSS_MESSAGE);

  if (side === 'buy') {
    if (player.credits < total) return result(false, '可用资金不足');
    player.credits -= total;
    player.frozenCredits += total;
  } else {
    const group = groupFor(player, type.id, false, now, provinceId);
    const available = group ? transferableGroupCount(world, player, group) : 0;
    if (!group || quantity > available) return result(false, '可出售工厂数量不足');
    reduceRunningGroupForSellOrder(group, type, quantity, now);
  }

  const order = {
    id: `facility-order-${crypto.randomUUID()}`,
    assetKind: 'facility',
    assetId: type.id,
    facilityTypeId: type.id,
    provinceId,
    side,
    ownerType: 'player',
    ownerId: userId,
    price,
    quantity,
    remaining: quantity,
    status: 'open',
    createdAt: now,
  };
  world.orders.push(order);
  matchFacilityOrder(world, order, now);
  return result(true, order.status === 'filled' ? '工厂订单已全部成交' : order.status === 'partial' ? '工厂订单已部分成交' : '工厂订单已进入订单簿');
}

function cancelFacilityOrder(world, userId, order, now = Date.now()) {
  const player = getPlayer(world, userId);
  const group = order.side === 'sell'
    ? groupFor(player, orderAssetId(order), false, now, order.provinceId)
    : null;
  const previousAvailable = group ? availableGroupCount(world, player, group) : 0;
  if (order.side === 'buy') {
    const release = order.remaining * order.price;
    player.frozenCredits -= release;
    player.credits += release;
  }
  order.status = 'cancelled';
  closeOrderInOrderBook(world, order);
  if (group) {
    const nextAvailable = availableGroupCount(world, player, group);
    expandAvailableFacilities(group, previousAvailable, nextAvailable, now);
  }
  return result(true, '订单已撤销，冻结资产已释放');
}

function retireOpenFacilityMarketOrders(world, now = Date.now()) {
  for (const order of world.orders || []) {
    if (!isOpenOrder(order) || orderKind(order) !== 'facility' || order.ownerType !== 'player') continue;
    const ownerId = Number(order.ownerId);
    if (!Number.isSafeInteger(ownerId) || !world.players?.[String(ownerId)]) {
      order.status = 'cancelled';
      closeOrderInOrderBook(world, order);
      continue;
    }
    cancelFacilityOrder(world, ownerId, order, now);
  }
  world.facilityListings = [];
}

export function validateFacilityAuctionQuantity(world, userId, typeId, quantity, provinceId = DEFAULT_PROVINCE_ID) {
  const account = world.players?.[String(userId)];
  const type = typeFor(typeId);
  const normalizedQuantity = normalizePositiveInteger(quantity, MAX_FACILITY_AUCTION_QUANTITY);
  const group = account && type ? groupFor(account, type.id, false, Date.now(), provinceId) : null;
  const available = group ? transferableGroupCount(world, account, group) : 0;
  if (!account || !type || !group || !normalizedQuantity || normalizedQuantity > available) {
    return result(false, '可拍卖工厂数量不足');
  }
  return result(true, '工厂拍卖数量有效');
}

export function validateFacilityAuctionTransferQuantity(world, userId, typeId, quantity, provinceId = DEFAULT_PROVINCE_ID) {
  const account = world.players?.[String(userId)];
  const type = typeFor(typeId);
  const normalizedQuantity = normalizePositiveInteger(quantity, MAX_FACILITY_AUCTION_QUANTITY);
  const group = account && type ? groupFor(account, type.id, false, Date.now(), provinceId) : null;
  if (
    !account
    || !type
    || !group
    || !normalizedQuantity
    || group.count < normalizedQuantity
    || auctionedQuantity(world, userId, type.id, provinceId) < normalizedQuantity
  ) {
    return result(false, '拍卖工厂冻结数量不足');
  }
  return result(true, '拍卖工厂冻结数量有效');
}

export function reserveFacilityAuctionQuantity(world, userId, typeId, quantity, now = Date.now(), provinceId = DEFAULT_PROVINCE_ID) {
  const validation = validateFacilityAuctionQuantity(world, userId, typeId, quantity, provinceId);
  if (!validation.ok) return validation;
  const account = world.players[String(userId)];
  const type = typeFor(typeId);
  const normalizedQuantity = normalizePositiveInteger(quantity, MAX_FACILITY_AUCTION_QUANTITY);
  const group = groupFor(account, type.id, false, now, provinceId);
  reduceRunningGroupForSellOrder(group, type, normalizedQuantity, now);
  return result(true, '工厂已为拍卖冻结');
}

export function releaseFacilityAuctionQuantity(
  world,
  userId,
  typeId,
  quantity,
  now = Date.now(),
  assumeReserved = false,
  provinceId = DEFAULT_PROVINCE_ID,
) {
  const account = world.players?.[String(userId)];
  const group = account ? groupFor(account, typeId, false, now, provinceId) : null;
  const normalizedQuantity = normalizePositiveInteger(quantity, MAX_FACILITY_AUCTION_QUANTITY);
  if (!group || !normalizedQuantity) return result(false, '拍卖工厂不存在');
  delete group.pendingJoinCount;
  const currentAvailable = availableGroupCount(world, account, group);
  const previousAvailable = assumeReserved
    ? Math.max(0, currentAvailable - normalizedQuantity)
    : currentAvailable;
  const nextAvailable = Math.min(group.count, previousAvailable + normalizedQuantity);
  expandAvailableFacilities(group, previousAvailable, nextAvailable, now);
  return result(true, '工厂拍卖已解冻并直接恢复运行资格');
}

export function transferFacilityAuctionQuantity(
  world,
  sellerId,
  buyerId,
  typeId,
  quantity,
  now = Date.now(),
  provinceId = DEFAULT_PROVINCE_ID,
) {
  const seller = world.players?.[String(sellerId)];
  const buyer = world.players?.[String(buyerId)];
  const type = typeFor(typeId);
  const normalizedQuantity = normalizePositiveInteger(quantity, MAX_FACILITY_AUCTION_QUANTITY);
  const sellerGroup = seller && type ? groupFor(seller, type.id, false, now, provinceId) : null;
  if (!seller || !buyer || !type || !sellerGroup || !normalizedQuantity) return result(false, '拍卖工厂归属异常');
  if (sellerGroup.count < normalizedQuantity || auctionedQuantity(world, sellerId, type.id, provinceId) < normalizedQuantity) {
    return result(false, '拍卖工厂冻结数量不足');
  }
  sellerGroup.count -= normalizedQuantity;
  if (sellerGroup.count === 0) seller.facilityGroups = seller.facilityGroups.filter((item) => item !== sellerGroup);
  addPurchasedGroup(world, buyer, type.id, normalizedQuantity, now, provinceId);
  return result(true, '拍卖工厂已转移');
}


export function applyFacilityGroupAction(
  world,
  user,
  action,
  payload = {},
  now = Date.now(),
  { migrate = true, process = true } = {},
) {
  if (process) processFacilityGroupWorld(world, now, { migrate });
  const userId = Number(user.id);
  if (
    action !== 'chooseStartingProvince'
    && action !== 'unlockProvince'
    && payload?.provinceId !== undefined
    && payload?.provinceId !== null
    && payload?.provinceId !== ''
  ) {
    const accessError = provinceUnlockError(world.players?.[String(userId)], normalizeProvinceId(payload.provinceId));
    if (accessError) {
      return result(false, accessError);
    }
  }
  const applyBaseAction = () => applyAction(world, user, action, payload, now, { migrate: false, process: false });
  let actionResult;

  if (action === 'buildFacility') actionResult = buildFacilityGroup(world, userId, payload, now);
  else if (action === 'startFacility') actionResult = startFacilityGroup(world, userId, payload, now);
  else if (action === 'pauseFacility') actionResult = pauseFacilityGroup(world, userId, payload, now);
  else if (action === 'setFacilityRecipe') actionResult = setGroupRecipe(world, userId, payload, now);
  else if (action === 'setFacilityRecipes') actionResult = setGroupRecipes(world, userId, payload, now);
  else if (action === 'placeOrder' && payload.assetKind === 'facility') actionResult = result(false, '工厂资产仅允许通过拍卖交易');
  else if (action === 'listFacility') actionResult = result(false, '工厂资产仅允许通过拍卖交易');
  else if (action === 'cancelOrder') {
    const order = orderById(world, payload.orderId);
    actionResult = order && Number(order.ownerId) === userId && isOpenOrder(order) && orderKind(order) === 'facility'
      ? cancelFacilityOrder(world, userId, order, now)
      : (migrate ? withLegacyFacilitiesSuppressed(world, applyBaseAction) : applyBaseAction());
  } else if (action === 'cancelFacilityListing') {
    const order = orderById(world, payload.listingId);
    actionResult = order && Number(order.ownerId) === userId && isOpenOrder(order) && orderKind(order) === 'facility'
      ? cancelFacilityOrder(world, userId, order, now)
      : result(false, '工厂卖单不存在');
  } else if (action === 'buyFacility') {
    actionResult = result(false, '工厂资产仅允许通过拍卖交易');
  } else {
    actionResult = migrate ? withLegacyFacilitiesSuppressed(world, applyBaseAction) : applyBaseAction();
  }

  if (migrate) migrateFacilityGroupWorld(world, now);
  reconcileAllFacilityGroups(world, now);
  if (migrate) stripLegacyFacilityInstances(world);
  return actionResult;
}

function recentTradePriceFor(world, kind, assetId, provinceId = DEFAULT_PROVINCE_ID) {
  if (kind === 'commodity') {
    const market = world.markets?.[provinceScopedKey(provinceId, assetId)];
    if (Number.isFinite(Number(market?.officialPrice)) && Number(market.officialPrice) > 0) {
      return Math.max(0, Number(market.officialPrice));
    }
    return Number.isFinite(Number(market?.lastTradePrice)) ? Math.max(0, Number(market.lastTradePrice)) : 0;
  }
  const market = facilityMarketFor(world, assetId, Date.now(), provinceId);
  return Number.isFinite(Number(market?.lastTradePrice)) ? Math.max(0, Number(market.lastTradePrice)) : 0;
}

function assetSummaryFor(world, player) {
  const commodity = Object.entries(player.inventories || {}).reduce((summary, [key, inventory]) => {
    const { provinceId, assetId } = splitProvinceScopedKey(key);
    const price = recentTradePriceFor(world, 'commodity', assetId, provinceId);
    summary.available += Number(inventory.available || 0) * price;
    summary.frozen += Number(inventory.frozen || 0) * price;
    summary.inTransit += Number(inventory.inTransit || 0) * price;
    return summary;
  }, { available: 0, frozen: 0, inTransit: 0 });
  const facility = (player.facilityGroups || []).reduce((summary, group) => {
    const price = recentTradePriceFor(world, 'facility', group.facilityTypeId, group.provinceId);
    const frozenCount = Math.min(group.count, frozenFacilityQuantity(world, player.userId, group.facilityTypeId, group.provinceId));
    const mortgagedCount = Math.min(Math.max(0, group.count - frozenCount), mortgagedFacilityQuantity(player, group.facilityTypeId, group.provinceId));
    const loanCollateralCount = Math.min(Math.max(0, group.count - frozenCount - mortgagedCount), playerLoanCollateralQuantity(world, player.userId, group.facilityTypeId, group.provinceId));
    const leasedOutCount = Math.min(Math.max(0, group.count - frozenCount - mortgagedCount - loanCollateralCount), leasedOutFacilityQuantity(world, player.userId, group.facilityTypeId, group.provinceId));
    summary.transferable += Math.max(0, group.count - frozenCount - mortgagedCount - loanCollateralCount - leasedOutCount) * price;
    summary.mortgaged += mortgagedCount * price;
    summary.contractLocked += (loanCollateralCount + leasedOutCount) * price;
    summary.frozen += frozenCount * price;
    return summary;
  }, { transferable: 0, mortgaged: 0, contractLocked: 0, frozen: 0 });
  const commercialValue = (player.commercialBuildingGroups || []).reduce((sum, group) => {
    const type = COMMERCIAL_BUILDING_TYPE_CATALOG.find((candidate) => candidate.id === group.commercialTypeId);
    return sum + Math.max(0, Number(group.count || 0)) * Math.max(0, Number(type?.systemValue || 0));
  }, 0);
  const bankDepositValue = Number(player?.bankAccount?.depositCredits || 0);
  const availableCashValue = Number(player.credits || 0);
  const frozenCashValue = Number(player.frozenCredits || 0);
  const availableCommodityValue = commodity.available;
  const frozenCommodityValue = commodity.frozen;
  const availableFacilityValue = facility.transferable;
  const mortgagedFacilityValue = facility.mortgaged;
  const contractLockedFacilityValue = facility.contractLocked;
  const frozenFacilityValue = facility.frozen + contractLockedFacilityValue;
  const playerLoanPosition = playerLoanFinancialPosition(world, player.userId);
  const contractReceivableValue = playerLoanPosition.receivable;
  const contractLiabilityValue = playerLoanPosition.liability;
  const cashValue = availableCashValue + frozenCashValue + bankDepositValue + contractReceivableValue;
  const inTransitCommodityValue = commodity.inTransit;
  const commodityValue = availableCommodityValue + frozenCommodityValue + inTransitCommodityValue;
  const facilityValue = availableFacilityValue + mortgagedFacilityValue + frozenFacilityValue;
  const grossAssetValue = cashValue + commodityValue + facilityValue + commercialValue;
  const liabilityValue = activeLoanLiability(player) + weeklySettlementLiability(player) + contractLiabilityValue;
  const netAssetValue = grossAssetValue - liabilityValue;
  const availableAssetValue = availableCashValue + bankDepositValue + availableCommodityValue + availableFacilityValue + commercialValue - liabilityValue;
  const frozenAssetValue = frozenCashValue + frozenCommodityValue + frozenFacilityValue + mortgagedFacilityValue + contractReceivableValue;
  return {
    cashValue,
    commodityValue,
    facilityValue,
    commercialValue,
    bankDepositValue,
    contractReceivableValue,
    contractLiabilityValue,
    contractLockedFacilityValue,
    grossAssetValue,
    liabilityValue,
    netAssetValue,
    availableCashValue,
    frozenCashValue,
    availableCommodityValue,
    frozenCommodityValue,
    availableFacilityValue,
    mortgagedFacilityValue,
    frozenFacilityValue,
    availableAssetValue,
    frozenAssetValue,
    totalAssets: netAssetValue,
  };
}

function valuationPricesFor(world, player) {
  return {
    ...Object.fromEntries(PRODUCT_CATALOG.map((product) => [
      `commodity:${product.id}`,
      recentTradePriceFor(world, 'commodity', product.id, DEFAULT_PROVINCE_ID),
    ])),
    ...Object.fromEntries(FACILITY_TYPE_CATALOG.map((type) => [
      `facility:${type.id}`,
      recentTradePriceFor(world, 'facility', type.id, DEFAULT_PROVINCE_ID),
    ])),
  };
}

function createLeaderboard(world, currentUserId, now) {
  return Object.values(world.players || {})
    .map((player) => {
      const summary = assetSummaryFor(world, player);
      return {
        playerName: player.playerName,
        totalAssets: summary.totalAssets,
        cashAssets: summary.cashValue,
        facilityCount: (player.facilityGroups || []).reduce((sum, group) => sum + group.count, 0),
        weeklyChange: Number(player.stats.gemExchangeCredits || 0)
          + Number(player.stats.populationIncome || 0)
          + Number(player.stats.populationIssued || 0)
          + Number(player.stats.giftIssued || 0)
          - Number(player.stats.systemSinks || 0)
          - Number(player.stats.employmentPayments || 0),
        updatedAt: now,
        isCurrentPlayer: player.userId === currentUserId,
      };
    })
    .sort((left, right) => right.totalAssets - left.totalAssets || left.playerName.localeCompare(right.playerName))
    .slice(0, 100)
    .map((entry, index) => ({ rank: index + 1, ...entry }));
}

function clientGroup(world, player, group, now) {
  const listedCount = listedQuantity(world, player.userId, group.facilityTypeId, group.provinceId);
  const auctionedCount = auctionedQuantity(world, player.userId, group.facilityTypeId, group.provinceId);
  const frozenCount = listedCount + auctionedCount;
  const mortgagedCount = mortgagedFacilityQuantity(player, group.facilityTypeId, group.provinceId);
  const contractCollateralCount = playerLoanCollateralQuantity(world, player.userId, group.facilityTypeId, group.provinceId);
  const leasedOutCount = leasedOutFacilityQuantity(world, player.userId, group.facilityTypeId, group.provinceId);
  const leasedInCount = leasedInFacilityQuantity(world, player.userId, group.facilityTypeId, group.provinceId);
  const productionAvailableCount = Math.max(0, group.count - frozenCount - leasedOutCount + leasedInCount);
  const availableCount = Math.max(0, group.count - frozenCount - mortgagedCount - contractCollateralCount - leasedOutCount);
  const staffingRateBps = projectStaffingRate(group, now);
  const projectedResult = cycleCapacity(
    group,
    productionAvailableCount,
    staffingRateBps,
  );
  const {
    cycleWageMultiplierBps: _cycleWageMultiplierBps,
    cycleStaffingRateBps: _legacyCycleStaffingRateBps,
    productionWageCarryNumerator: _productionWageCarryNumerator,
    productionEmploymentTotalMicros: _productionEmploymentTotalMicros,
    productionEmploymentAllocatedMicros: _productionEmploymentAllocatedMicros,
    ...publicGroup
  } = clone(group);
  return {
    ...publicGroup,
    staffingRateBps,
    staffingUpdatedAt: Math.max(0, Number(now) || 0),
    productionSettlementStaffingRateBps: normalizeStaffingRate(group.staffingRateBps) ?? FACILITY_STAFFING_FULL_BPS,
    productionSettlementStaffingUpdatedAt: Number.isFinite(Number(group.staffingUpdatedAt))
      ? Math.max(0, Number(group.staffingUpdatedAt))
      : Math.max(0, Number(now) || 0),
    staffingBatchCarryBps: normalizeStaffingCarry(group.staffingBatchCarryBps),
    productionAvailableCount,
    projectedEffectiveCount: projectedResult.effectiveCount,
    listedCount,
    auctionedCount,
    frozenCount,
    mortgagedCount,
    contractCollateralCount,
    leasedOutCount,
    leasedInCount,
    availableCount,
  };
}

export function createFacilityGroupClientState(world, userId, now = Date.now()) {
  const base = createClientState(world, userId, now, { migrate: false });
  const player = getPlayer(world, userId);
  const { facilities: _legacyFacilities, ...withoutFacilities } = base;
  const normalizedOrders = clientOrdersForState(world, userId);
  const provinceFacilityGroups = {};
  for (const group of player.facilityGroups || []) {
    const provinceId = normalizeProvinceId(group.provinceId);
    provinceFacilityGroups[provinceId] ||= [];
    provinceFacilityGroups[provinceId].push(clientGroup(world, player, group, now));
  }
  const provinceFacilityMarkets = createMarketSummaryStatesByProvince(
    world.facilityMarkets,
    world,
    'facility',
    now,
  );
  return {
    ...withoutFacilities,
    version: CURRENT_CLIENT_STATE_VERSION,
    provinceFacilityGroups,
    facilityGroups: Object.values(provinceFacilityGroups).flat(),
    facilityTypes: FACILITY_TYPE_CATALOG.map(({ internalCapacity: _internalCapacity, ...type }) => clone({
      ...type,
      buildTimeMs: 0,
      recipes: recipesFor(type).filter((recipe) => {
        const group = type.productionMethodGroups?.find((candidate) => candidate.id === 'operation')
          || type.productionMethodGroups?.[0];
        return recipe.productionMethodId === group?.defaultMethodId;
      }),
    })),
    orders: normalizedOrders,
    facilityListings: [],
    provinceFacilityMarkets: clone(provinceFacilityMarkets),
    facilityMarkets: clone(provinceFacilityMarkets[DEFAULT_PROVINCE_ID] || {}),
    valuationPrices: valuationPricesFor(world, player),
    assetSummary: assetSummaryFor(world, player),
    leaderboard: createLeaderboard(world, userId, now),
  };
}
