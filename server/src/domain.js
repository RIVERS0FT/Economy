import * as core from './domain-core.js';
import { createBalancedMarketRuntime } from './balanced-market.js';
import {
  createMarketDemandRuntime,
  MARKET_DEMAND_GROUP_CATALOG,
  MARKET_DEMAND_MODEL_VERSION,
  MARKET_DEMAND_PRODUCT_IDS,
} from './market-demand.js';

export * from './domain-core.js';
export {
  MARKET_DEMAND_GROUP_CATALOG,
  MARKET_DEMAND_MODEL_VERSION,
  MARKET_DEMAND_PRODUCT_IDS,
} from './market-demand.js';

const clone = (value) => structuredClone(value);

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

export function createWorld(now = Date.now()) {
  const world = core.createWorld(now);
  balancedMarket.rebalanceNewWorld(world, now);
  marketDemand.initializeWorld(world, now);
  world.version = 13;
  return world;
}

export function migrateWorld(world, now = Date.now()) {
  if (!world || typeof world !== 'object') return createWorld(now);
  const previousVersion = Number(world.version || 0);
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
  migrated.version = 13;
  return migrated;
}

export function ensurePlayer(world, user, now = Date.now()) {
  const player = core.ensurePlayer(world, user, now);
  marketDemand.normalizeWorld(world, now);
  return player;
}

export function processWorld(world, now = Date.now()) {
  migrateWorld(world, now);
  core.processWorld(world, now);
  marketDemand.process(world, now);
  return world;
}

export function applyAction(world, user, action, payload = {}, now = Date.now()) {
  migrateWorld(world, now);
  const result = core.applyAction(world, user, action, payload, now);
  marketDemand.process(world, now);
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
