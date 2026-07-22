import { randomUUID } from 'node:crypto';
import * as core from './domain-core.js';
import { createBalancedMarketRuntime } from './balanced-market.js';
import {
  createMarketDemandRuntime,
  MARKET_DEMAND_GROUP_CATALOG,
  MARKET_DEMAND_MODEL_VERSION,
  MARKET_DEMAND_PRODUCT_IDS,
} from './market-demand.js';
import { findSelfCrossingOrder, SELF_CROSS_MESSAGE } from './order-book-integrity.js';
import { orderAssetId, orderKind } from './order-identity.js';
import { ensurePopulationEconomy } from './population-economy.js';

export * from './domain-core.js';
export {
  MARKET_DEMAND_GROUP_CATALOG,
  MARKET_DEMAND_MODEL_VERSION,
  MARKET_DEMAND_PRODUCT_IDS,
} from './market-demand.js';

const clone = (value) => structuredClone(value);
const ORDER_BOOK_INTEGRITY_VERSION = 1;
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
    const groups = [...(reachableGroups.get(product.id) || [])].sort();
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
  marketFor: (world, productId, now) => balancedMarket.marketFor(world, productId, now),
  matchOrder: (world, order, now) => balancedMarket.matchOrder(world, order, now),
  isOpenOrder: (order) => balancedMarket.isOpenOrder(order),
});

function newestOrdersFirst(left, right) {
  return Number(right.createdAt || 0) - Number(left.createdAt || 0)
    || String(right.id || '').localeCompare(String(left.id || ''));
}

function cancelLegacyCommodityOrder(world, order) {
  if (!balancedMarket.isOpenOrder(order) || order.ownerType !== 'player') return false;
  const player = world.players?.[String(order.ownerId)];
  const remaining = Math.max(0, Math.floor(Number(order.remaining || 0)));
  if (player && order.side === 'buy') {
    const expectedRelease = remaining * Math.max(1, Math.floor(Number(order.price || 1)));
    const release = Math.min(Math.max(0, Number(player.frozenCredits || 0)), expectedRelease);
    player.frozenCredits = Math.max(0, Number(player.frozenCredits || 0) - release);
    player.credits = Number(player.credits || 0) + release;
  } else if (player && order.side === 'sell') {
    player.inventories ||= {};
    const productId = orderAssetId(order);
    const inventory = player.inventories[productId] ||= { available: 0, frozen: 0 };
    const release = Math.min(Math.max(0, Number(inventory.frozen || 0)), remaining);
    inventory.frozen = Math.max(0, Number(inventory.frozen || 0) - release);
    inventory.available = Math.max(0, Number(inventory.available || 0)) + release;
  }
  order.status = 'cancelled';
  return true;
}

function reconcileCommodityOrderBook(world, now) {
  const playerOrders = (world.orders || [])
    .filter((order) => (
      order.ownerType === 'player'
      && orderKind(order) === 'commodity'
      && balancedMarket.isOpenOrder(order)
    ))
    .sort(newestOrdersFirst);

  for (const order of playerOrders) {
    if (balancedMarket.isOpenOrder(order)) balancedMarket.matchOrder(world, order, now);
  }

  for (const order of playerOrders) {
    if (!balancedMarket.isOpenOrder(order)) continue;
    if (findSelfCrossingOrder(world, {
      ownerId: order.ownerId,
      assetKind: 'commodity',
      assetId: orderAssetId(order),
      side: order.side,
      price: order.price,
    })) cancelLegacyCommodityOrder(world, order);
  }
}

export function createWorld(now = Date.now()) {
  const world = core.createWorld(now);
  balancedMarket.rebalanceNewWorld(world, now);
  marketDemand.initializeWorld(world, now);
  ensurePopulationEconomy(world, now);
  world.orderBookIntegrityVersion = ORDER_BOOK_INTEGRITY_VERSION;
  world.version = 14;
  return world;
}

export function migrateWorld(world, now = Date.now()) {
  if (!world || typeof world !== 'object') return createWorld(now);
  const previousVersion = Number(world.version || 0);
  const needsOrderBookRepair = Number(world.orderBookIntegrityVersion || 0) < ORDER_BOOK_INTEGRITY_VERSION;
  const hadCurrentMarketDemandModel = Number(world.marketDemand?.modelVersion || 0) >= MARKET_DEMAND_MODEL_VERSION;
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
  balancedMarket.repairMissingMarkets(migrated, existingMarketIds, now, legacy);
  migrated.orders = (migrated.orders || []).filter((order) => {
    if (order.ownerType === 'player') return true;
    if (order.ownerType !== 'population') return false;
    return hadCurrentMarketDemandModel && marketDemand.isValidMarketOrder(order);
  });
  if (previousVersion < 9) {
    for (const player of Object.values(migrated.players || {})) {
      const group = (player.facilityGroups || []).find((item) => item.facilityTypeId === 'electronics-factory');
      if (group?.enabled && group.status === 'running') group.cycleStartedAt = now;
    }
  }
  marketDemand.normalizeWorld(migrated, now, {
    forceRebuild: !hadCurrentMarketDemandModel || previousVersion < 13,
  });
  if (needsOrderBookRepair) reconcileCommodityOrderBook(migrated, now);
  ensurePopulationEconomy(migrated, now);
  migrated.orderBookIntegrityVersion = ORDER_BOOK_INTEGRITY_VERSION;
  migrated.version = 14;
  return migrated;
}

export function ensurePlayer(world, user, now = Date.now()) {
  const player = core.ensurePlayer(world, user, now);
  ensurePopulationEconomy(world, now);
  marketDemand.normalizeWorld(world, now);
  return player;
}

export function processWorld(world, now = Date.now()) {
  if (processedWorldAt.get(world) === now) return world;
  migrateWorld(world, now);
  ensurePopulationEconomy(world, now);
  core.processWorld(world, now);
  marketDemand.process(world, now);
  processedWorldAt.set(world, now);
  return world;
}

function normalizePositiveInteger(value, max = Number.MAX_SAFE_INTEGER) {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  const normalized = Math.floor(number);
  return normalized >= 1 && normalized <= max ? normalized : null;
}

function playerInventoryFor(player, productId) {
  player.inventories ||= {};
  player.inventories[productId] ||= { available: 0, frozen: 0 };
  return player.inventories[productId];
}

function playerInventoryUsed(player) {
  return Object.values(player.inventories || {}).reduce((sum, inventory) => (
    sum + Math.max(0, Number(inventory.available || 0)) + Math.max(0, Number(inventory.frozen || 0))
  ), 0);
}

function pendingPlayerBuyQuantity(world, userId) {
  return (world.orders || []).reduce((sum, order) => (
    Number(order.ownerId) === userId
      && order.ownerType === 'player'
      && orderKind(order) === 'commodity'
      && order.side === 'buy'
      && balancedMarket.isOpenOrder(order)
      ? sum + Math.max(0, Number(order.remaining || 0))
      : sum
  ), 0);
}

function applyCommodityOrder(world, user, payload, now) {
  const userId = Number(user.id);
  const side = payload.side === 'buy' ? 'buy' : payload.side === 'sell' ? 'sell' : null;
  const productId = productIds.has(String(payload.productId || payload.assetId || 'wheat'))
    ? String(payload.productId || payload.assetId || 'wheat')
    : null;
  const quantity = normalizePositiveInteger(payload.quantity, core.ECONOMY_CONSTANTS.maxOrderQuantity);
  const price = normalizePositiveInteger(payload.price, 1_000_000);
  if (!side || !productId || !quantity || !price) return { ok: false, message: '订单参数无效' };
  if (findSelfCrossingOrder(world, {
    ownerId: userId,
    assetKind: 'commodity',
    assetId: productId,
    side,
    price,
  })) return { ok: false, message: SELF_CROSS_MESSAGE };

  world.orders ||= [];
  const openOrders = world.orders.filter((order) => (
    Number(order.ownerId) === userId && balancedMarket.isOpenOrder(order)
  ));
  if (openOrders.length >= core.ECONOMY_CONSTANTS.maxOpenOrders) {
    return { ok: false, message: '未完成订单数量已达上限' };
  }

  const player = core.ensurePlayer(world, user, now);
  if (side === 'buy') {
    const total = quantity * price;
    if (Number(player.credits || 0) < total) return { ok: false, message: '可用资金不足' };
    const capacity = Math.max(0, Number(player.inventoryCapacity || 0))
      - playerInventoryUsed(player)
      - pendingPlayerBuyQuantity(world, userId);
    if (capacity < quantity) return { ok: false, message: '仓库容量不足' };
    player.credits -= total;
    player.frozenCredits = Number(player.frozenCredits || 0) + total;
  } else {
    const inventory = playerInventoryFor(player, productId);
    if (Number(inventory.available || 0) < quantity) return { ok: false, message: '可用商品库存不足' };
    inventory.available -= quantity;
    inventory.frozen = Number(inventory.frozen || 0) + quantity;
  }

  const incoming = {
    id: `order-${randomUUID()}`,
    assetKind: 'commodity',
    assetId: productId,
    productId,
    side,
    ownerType: 'player',
    ownerId: userId,
    ownerName: player.playerName,
    price,
    quantity,
    remaining: quantity,
    status: 'open',
    fills: [],
    createdAt: now,
  };
  world.orders.push(incoming);
  balancedMarket.matchOrder(world, incoming, now);
  if (incoming.status === 'filled') return { ok: true, message: '订单已全部成交' };
  if (incoming.status === 'partial') return { ok: true, message: '订单已部分成交' };
  return { ok: true, message: '订单已进入订单簿' };
}

export function applyAction(world, user, action, payload = {}, now = Date.now()) {
  migrateWorld(world, now);
  if (processedWorldAt.get(world) !== now) processWorld(world, now);
  const result = action === 'placeOrder' && payload.assetKind !== 'facility'
    ? applyCommodityOrder(world, user, payload, now)
    : core.applyAction(world, user, action, payload, now);
  processedWorldAt.delete(world);
  return result;
}

export function createClientState(world, userId, now = Date.now()) {
  migrateWorld(world, now);
  const state = core.createClientState(world, userId, now);
  return {
    ...state,
    products: clone(PRODUCT_CATALOG),
    facilityTypes: clone(FACILITY_TYPE_CATALOG),
  };
}

export const processPriceTransmission = (world, now = Date.now()) => marketDemand.processPriceTransmission(world, now);
export const processMarketDemand = (world, now = Date.now()) => marketDemand.process(world, now);
