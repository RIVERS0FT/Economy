import { multiplyMoneyByInteger, normalizePlayerMoneyInput, normalizeWorldMoneyPrecision } from './money.js';
import { randomUUID } from 'node:crypto';
import * as core from './domain-core.js';
import { createBalancedMarketRuntime } from './balanced-market.js';
import {
  createMarketDemandRuntime,
  MARKET_DEMAND_GROUP_CATALOG,
  MARKET_DEMAND_MODEL_VERSION,
  MARKET_DEMAND_PRESERVE_STATE_FROM_VERSION,
  MARKET_DEMAND_PRODUCT_IDS,
} from './market-demand.js';
import { orderAssetId, orderKind } from './order-identity.js';
import { closeOrderInOrderBook } from './order-book-runtime.js';
import { ensurePopulationEconomy, releasePopulationOrderFunds } from './population-economy.js';
import { stripMutablePlayerIdentityMirrors } from './player-identity.js';
import {
  applyChooseStartingProvince,
  applyUnlockProvince,
  migrateProvinceAccess,
  provinceUnlockError,
} from './province-access.js';
import { DEFAULT_PROVINCE_ID, inventoryForProvince, normalizeProvinceId, provinceScopedKey } from './provinces.js';
import {
  applyTransportShip,
  processTransportWorld,
  transportRouteClientState,
  transportShipmentClientState,
} from './transport.js';

export * from './domain-core.js';
export {
  MARKET_DEMAND_GROUP_CATALOG,
  MARKET_DEMAND_MODEL_VERSION,
  MARKET_DEMAND_PRESERVE_STATE_FROM_VERSION,
  MARKET_DEMAND_PRODUCT_IDS,
} from './market-demand.js';

const clone = (value) => structuredClone(value);
const ORDER_BOOK_INTEGRITY_VERSION = 1;
const PLAYER_COMMODITY_INSTANT_TRADE_VERSION = 1;
const C1_INPUT_BALANCE_MODEL_VERSION = 18;
const C1_INPUT_BALANCE_PRODUCT_IDS = Object.freeze([
  'tools',
  'fertilizer',
  'tractor',
  'feed',
  'veterinary-medicine',
  'machinery',
]);
const C1_INPUT_BALANCE_PRODUCT_ID_SET = new Set(C1_INPUT_BALANCE_PRODUCT_IDS);
const processedWorldAt = new WeakMap();

function buildMarketDemandMetadata() {
  const directGroups = new Map();
  for (const group of MARKET_DEMAND_GROUP_CATALOG) {
    for (const demandClass of group.classes) {
      for (const option of demandClass.products) {
        const groups = directGroups.get(option.productId) || new Set();
        groups.add(group.id);
        directGroups.set(option.productId, groups);
      }
    }
  }

  const reachableGroups = new Map([...directGroups].map(([productId, groups]) => [productId, new Set(groups)]));
  let changed = true;
  while (changed) {
    changed = false;
    for (const facility of core.FACILITY_TYPE_CATALOG) {
      for (const recipe of facility.recipes) {
        const outputGroups = reachableGroups.get(recipe.output.productId);
        if (!outputGroups || outputGroups.size === 0) continue;
        for (const input of recipe.inputs) {
          const inputGroups = reachableGroups.get(input.productId) || new Set();
          const sizeBefore = inputGroups.size;
          for (const groupId of outputGroups) inputGroups.add(groupId);
          if (inputGroups.size !== sizeBefore) changed = true;
          reachableGroups.set(input.productId, inputGroups);
        }
      }
    }
  }

  return Object.fromEntries(core.PRODUCT_CATALOG.map((product) => {
    const direct = directGroups.has(product.id);
    const groups = [...(
      direct
        ? directGroups.get(product.id)
        : reachableGroups.get(product.id)
    ) || []].sort();
    if (groups.length === 0) return [product.id, Object.freeze({})];
    const tier = product.category === 'raw'
      ? 'raw'
      : product.category === 'intermediate' || !direct
        ? 'intermediate'
        : 'final';
    return [product.id, Object.freeze({
      marketDemandGroupId: groups[0],
      marketDemandRole: direct ? 'direct' : 'derived-liquidity',
      marketDemandTier: tier,
    })];
  }));
}

const PRODUCT_MARKET_DEMAND = Object.freeze(buildMarketDemandMetadata());

export const PRODUCT_CATALOG = Object.freeze(core.PRODUCT_CATALOG.map((product) => {
  const {
    family: _family,
    substitutionGroupId: _substitutionGroupId,
    systemDemandMode: _systemDemandMode,
    populationDemandGroupId: _populationDemandGroupId,
    populationDemandTier: _populationDemandTier,
    ...base
  } = product;
  const marketDemand = PRODUCT_MARKET_DEMAND[product.id] || {};
  return Object.freeze({
    ...base,
    ...marketDemand,
    // 兼容旧客户端字段；业务规则只读取 marketDemand*。
    ...(marketDemand.marketDemandGroupId ? {
      populationDemandGroupId: marketDemand.marketDemandGroupId,
      populationDemandTier: marketDemand.marketDemandTier,
    } : {}),
  });
}));

export const FACILITY_TYPE_CATALOG = core.FACILITY_TYPE_CATALOG;
export const DEMAND_GROUP_CATALOG = MARKET_DEMAND_GROUP_CATALOG;
export const POPULATION_DEMAND_PRODUCT_IDS = new Set(MARKET_DEMAND_PRODUCT_IDS);

const productIds = new Set(PRODUCT_CATALOG.map((product) => product.id));
const balancedMarket = createBalancedMarketRuntime({
  products: PRODUCT_CATALOG,
  constants: core.ECONOMY_CONSTANTS,
});

const marketDemand = createMarketDemandRuntime({
  products: PRODUCT_CATALOG,
  facilities: FACILITY_TYPE_CATALOG,
  constants: core.ECONOMY_CONSTANTS,
  marketFor: (world, productId, now, provinceId) => balancedMarket.marketFor(world, productId, now, provinceId),
  matchOrder: (world, order, now) => balancedMarket.matchOrder(world, order, now),
  isOpenOrder: (order) => balancedMarket.isOpenOrder(order),
});

function cancelLegacyCommodityOrder(world, order) {
  if (!balancedMarket.isOpenOrder(order) || order.ownerType !== 'player') return false;
  const player = world.players?.[String(order.ownerId)];
  const remaining = Math.max(0, Math.floor(Number(order.remaining || 0)));
  if (player && order.side === 'buy') {
    const expectedRelease = multiplyMoneyByInteger(Number(order.price || 0), remaining) || 0;
    const release = Math.min(Math.max(0, Number(player.frozenCredits || 0)), expectedRelease);
    player.frozenCredits = Math.max(0, Number(player.frozenCredits || 0) - release);
    player.credits = Number(player.credits || 0) + release;
  } else if (player && order.side === 'sell') {
    const productId = orderAssetId(order);
    const inventory = inventoryForProvince(player, productId, order.provinceId);
    const release = Math.min(Math.max(0, Number(inventory.frozen || 0)), remaining);
    inventory.frozen = Math.max(0, Number(inventory.frozen || 0) - release);
    inventory.available = Math.max(0, Number(inventory.available || 0)) + release;
  }
  order.status = 'cancelled';
  closeOrderInOrderBook(world, order);
  return true;
}

function migrateLegacyPlayerCommodityOrders(world) {
  for (const order of world.orders || []) {
    if (
      order.ownerType === 'player'
      && orderKind(order) === 'commodity'
      && balancedMarket.isOpenOrder(order)
    ) cancelLegacyCommodityOrder(world, order);
  }
  world.playerCommodityInstantTradeVersion = PLAYER_COMMODITY_INSTANT_TRADE_VERSION;
}

function migrateC1InputBalance(world) {
  for (const order of world.orders || []) {
    if (
      order.ownerType === 'player'
      && orderKind(order) === 'commodity'
      && C1_INPUT_BALANCE_PRODUCT_ID_SET.has(orderAssetId(order))
      && balancedMarket.isOpenOrder(order)
    ) cancelLegacyCommodityOrder(world, order);
  }

  const productMap = new Map(PRODUCT_CATALOG.map((product) => [product.id, product]));
  for (const productId of C1_INPUT_BALANCE_PRODUCT_IDS) {
    const product = productMap.get(productId);
    const market = world.markets?.[provinceScopedKey(DEFAULT_PROVINCE_ID, productId)];
    if (!product || !market) continue;
    market.lastPrice = product.basePrice;
    market.lastTradePrice = null;
    market.demand ||= {};
    Object.assign(market.demand, {
      lastPrice: product.basePrice,
      referencePrice: product.basePrice,
      observedPrice: product.basePrice,
      costAnchor: null,
      downstreamValueAnchor: null,
      demandPressureAnchor: product.basePrice,
      targetPrice: product.basePrice,
    });
    if (world.marketDemand?.priceTransmission?.products) {
      delete world.marketDemand.priceTransmission.products[productId];
    }
    if (world.priceTransmission?.products) delete world.priceTransmission.products[productId];
    if (world.marketDemand?.productPressure) world.marketDemand.productPressure[productId] = 1;
  }
  if (world.marketDemand && typeof world.marketDemand === 'object') world.marketDemand.relations = {};
}

export function createWorld(now = Date.now()) {
  const world = core.createWorld(now);
  balancedMarket.rebalanceNewWorld(world, now);
  marketDemand.initializeWorld(world, now);
  ensurePopulationEconomy(world, now);
  world.orderBookIntegrityVersion = ORDER_BOOK_INTEGRITY_VERSION;
  world.playerCommodityInstantTradeVersion = PLAYER_COMMODITY_INSTANT_TRADE_VERSION;
  world.auctionFeeEscrowCredits = Math.max(0, Number(world.auctionFeeEscrowCredits || 0));
  world.version = 32;
  normalizeWorldMoneyPrecision(world);
  return world;
}

export function migrateWorld(world, now = Date.now()) {
  if (!world || typeof world !== 'object') return createWorld(now);
  const previousVersion = Number(world.version || 0);
  const previousMarketDemandModelVersion = Number(world.marketDemand?.modelVersion || 0);
  const needsC1InputBalanceMigration = previousMarketDemandModelVersion < C1_INPUT_BALANCE_MODEL_VERSION;
  const hadCompatibleMarketDemandModel = previousMarketDemandModelVersion
    >= MARKET_DEMAND_PRESERVE_STATE_FROM_VERSION
    && !needsC1InputBalanceMigration;
  const hadCurrentPopulationModel = Number(world.populationEconomy?.modelVersion || 0) >= 7;
  const hadCompatibleDemandSystem = hadCompatibleMarketDemandModel && hadCurrentPopulationModel;
  const existingMarketIds = new Set(Object.keys(world.markets || {}));
  const legacy = {
    price: Number.isFinite(Number(world.marketPrice)) ? Number(world.marketPrice) : undefined,
    history: Array.isArray(world.marketPriceHistory) ? clone(world.marketPriceHistory) : undefined,
    demand: world.demand && typeof world.demand === 'object' ? clone(world.demand) : undefined,
    grainMarket: world.markets?.grain && typeof world.markets.grain === 'object'
      ? clone(world.markets.grain)
      : undefined,
  };
  const migrated = core.migrateWorld(world, now);
  stripMutablePlayerIdentityMirrors(migrated);
  balancedMarket.repairMissingMarkets(migrated, existingMarketIds, now, legacy);
  balancedMarket.normalizeSystemPrices(migrated, now);
  migrateProvinceAccess(migrated, now);
  migrateLegacyPlayerCommodityOrders(migrated);
  if (needsC1InputBalanceMigration) migrateC1InputBalance(migrated);
  if (!hadCompatibleDemandSystem) {
    ensurePopulationEconomy(migrated, now);
    for (const order of migrated.orders || []) {
      if (order.ownerType !== 'population' || !balancedMarket.isOpenOrder(order)) continue;
      if (order.demandTier !== 'direct' && order.demandTier !== 'derived-liquidity') continue;
      releasePopulationOrderFunds(migrated, order);
    }
  }
  const migratedOrders = migrated.orders || (migrated.orders = []);
  const retainedOrders = migratedOrders.filter((order) => {
    if (order.ownerType === 'player') {
      return orderKind(order) !== 'commodity' || !balancedMarket.isOpenOrder(order);
    }
    if (order.ownerType !== 'population') return false;
    return hadCompatibleDemandSystem && marketDemand.isValidMarketOrder(order);
  });
  if (retainedOrders.length !== migratedOrders.length) migrated.orders = retainedOrders;
  if (previousVersion < 9) {
    for (const player of Object.values(migrated.players || {})) {
      const group = (player.facilityGroups || []).find((item) => item.facilityTypeId === 'electronics-factory');
      if (group?.enabled && group.status === 'running') group.cycleStartedAt = now;
    }
  }
  marketDemand.normalizeWorld(migrated, now, {
    forceRebuild: !hadCompatibleDemandSystem,
  });
  ensurePopulationEconomy(migrated, now);
  migrated.orderBookIntegrityVersion = ORDER_BOOK_INTEGRITY_VERSION;
  migrated.playerCommodityInstantTradeVersion = PLAYER_COMMODITY_INSTANT_TRADE_VERSION;
  migrated.auctionFeeEscrowCredits = Math.max(0, Number(migrated.auctionFeeEscrowCredits || 0));
  migrated.version = 32;
  normalizeWorldMoneyPrecision(migrated);
  return migrated;
}

export function ensurePlayer(world, user, now = Date.now(), { migrate = true } = {}) {
  const player = core.ensurePlayer(world, user, now, { migrate });
  if (migrate) {
    ensurePopulationEconomy(world, now);
    marketDemand.normalizeWorld(world, now);
  }
  return player;
}

export function processWorld(world, now = Date.now(), { migrate = true } = {}) {
  if (processedWorldAt.get(world) === now) return world;
  if (migrate) {
    migrateWorld(world, now);
    ensurePopulationEconomy(world, now);
  }
  core.processWorld(world, now, { migrate: false });
  marketDemand.process(world, now);
  balancedMarket.processPriceCycles(world, now);
  processTransportWorld(world, now);
  processedWorldAt.set(world, now);
  return world;
}

function normalizePositiveInteger(value, max = Number.MAX_SAFE_INTEGER) {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  const normalized = Math.floor(number);
  return normalized >= 1 && normalized <= max ? normalized : null;
}

export function commoditySystemPriceFor(world, productId, provinceId = DEFAULT_PROVINCE_ID, now = Date.now()) {
  return balancedMarket.systemPriceFor(world, productId, now, provinceId);
}

function applyCommodityOrder(world, user, payload, now) {
  const userId = Number(user.id);
  const side = payload.side === 'buy' ? 'buy' : payload.side === 'sell' ? 'sell' : null;
  const productId = productIds.has(String(payload.productId || payload.assetId || 'wheat'))
    ? String(payload.productId || payload.assetId || 'wheat')
    : null;
  const quantity = normalizePositiveInteger(payload.quantity, core.ECONOMY_CONSTANTS.maxOrderQuantity);
  const provinceId = normalizeProvinceId(payload.provinceId);
  if (!side || !productId || !quantity) return { ok: false, message: '交易参数无效' };

  const player = core.ensurePlayer(world, user, now, { migrate: false });
  const provinceError = provinceUnlockError(player, provinceId);
  if (provinceError) return { ok: false, message: provinceError };

  const officialPrice = balancedMarket.systemPriceFor(world, productId, now, provinceId);
  const requestedPrice = normalizePlayerMoneyInput(payload.price, { min: 0.01 });
  const execution = String(payload.execution || '');
  if (
    (execution === 'online-auto-buy' || execution === 'fill-or-kill' || execution === 'facility-build-procurement')
    && typeof requestedPrice === 'number'
    && officialPrice > requestedPrice
  ) return { ok: false, message: '今日系统价高于本次最高买价' };
  if (
    execution === 'online-auto-sell'
    && typeof requestedPrice === 'number'
    && officialPrice < requestedPrice
  ) return { ok: false, message: '今日系统价低于自动出售最低价' };

  const settlement = balancedMarket.settleImmediatePlayerTrade(world, {
    userId,
    productId,
    provinceId,
    side,
    quantity,
    createdAt: now,
  });
  if (!settlement?.ok) return settlement;

  world.orders ||= [];
  const closedTrade = {
    id: `order-${randomUUID()}`,
    assetKind: 'commodity',
    assetId: productId,
    productId,
    provinceId,
    side,
    ownerType: 'player',
    ownerId: userId,
    price: settlement.price,
    quantity,
    remaining: 0,
    status: 'filled',
    fills: [settlement.fill],
    createdAt: now,
    lastFilledAt: now,
  };
  world.orders.push(closedTrade);
  return {
    ok: true,
    message: '已按今日系统价即时成交',
    executedPrice: settlement.price,
    quantity,
    total: settlement.total,
    fee: settlement.fee,
    netTotal: settlement.netTotal,
  };
}

export function applySettledCommodityOrder(world, user, payload = {}, now = Date.now()) {
  return applyCommodityOrder(world, user, payload, now);
}

export function cancelSettledCommodityOrder(world, user, orderId) {
  const order = (world.orders || []).find((candidate) => String(candidate?.id || '') === String(orderId || ''));
  if (
    !order
    || Number(order.ownerId) !== Number(user.id)
    || orderKind(order) !== 'commodity'
    || !balancedMarket.isOpenOrder(order)
  ) return false;
  return cancelLegacyCommodityOrder(world, order);
}

export function applyImmediateCommodityBuy(world, user, payload = {}, now = Date.now()) {
  return applyCommodityOrder(world, user, {
    ...payload,
    assetKind: 'commodity',
    side: 'buy',
    execution: 'fill-or-kill',
  }, now);
}

export function applyAction(
  world,
  user,
  action,
  payload = {},
  now = Date.now(),
  { migrate = true, process = true } = {},
) {
  if (migrate) migrateWorld(world, now);
  if (process && processedWorldAt.get(world) !== now) processWorld(world, now, { migrate: false });
  const result = action === 'placeOrder' && payload.assetKind !== 'facility'
    ? applyCommodityOrder(world, user, payload, now)
    : action === 'chooseStartingProvince'
      ? applyChooseStartingProvince(world, user, payload)
      : action === 'unlockProvince'
        ? applyUnlockProvince(world, user, payload)
        : action === 'transportShip'
          ? applyTransportShip(world, user, payload, now)
          : core.applyAction(world, user, action, payload, now, { migrate: false, process: false });
  if (process) processedWorldAt.delete(world);
  return result;
}

export function createClientState(world, userId, now = Date.now(), { migrate = true } = {}) {
  if (migrate) migrateWorld(world, now);
  const state = core.createClientState(world, userId, now, { migrate });
  return {
    ...state,
    startingProvinceId: state.startingProvinceId,
    startingProvinceChosen: state.startingProvinceChosen,
    unlockedProvinces: state.unlockedProvinces,
    transportRoutes: transportRouteClientState(world, userId),
    transportShipments: transportShipmentClientState(world, userId),
    products: clone(PRODUCT_CATALOG),
    facilityTypes: clone(FACILITY_TYPE_CATALOG),
  };
}

export const processPriceTransmission = (world, now = Date.now()) => marketDemand.processPriceTransmission(world, now);
export const processMarketDemand = (world, now = Date.now()) => marketDemand.process(world, now);
