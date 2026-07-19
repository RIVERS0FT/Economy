import * as core from './domain-core.js';
import { createBalancedMarketRuntime } from './balanced-market.js';
import {
  createMarketDemandRuntime,
  MARKET_DEMAND_GROUP_CATALOG,
  MARKET_DEMAND_PRODUCT_IDS,
} from './market-demand.js';

export * from './domain-core.js';
export { MARKET_DEMAND_GROUP_CATALOG, MARKET_DEMAND_PRODUCT_IDS } from './market-demand.js';

const clone = (value) => structuredClone(value);

const PRODUCT_BALANCE = Object.freeze({
  wheat: Object.freeze({ basePrice: 2 }),
  rice: Object.freeze({ basePrice: 2 }),
  cotton: Object.freeze({ basePrice: 2 }),
  timber: Object.freeze({ basePrice: 5 }),
  ore: Object.freeze({ basePrice: 6 }),
  'copper-ore': Object.freeze({ basePrice: 6 }),
  'crude-oil': Object.freeze({ basePrice: 8 }),
  meat: Object.freeze({ basePrice: 6 }),
  eggs: Object.freeze({ basePrice: 3 }),
  milk: Object.freeze({ basePrice: 3 }),
  wool: Object.freeze({ basePrice: 6 }),
  flour: Object.freeze({ basePrice: 13 }),
  lumber: Object.freeze({ basePrice: 15 }),
  steel: Object.freeze({ basePrice: 24 }),
  copper: Object.freeze({ basePrice: 24 }),
  plastic: Object.freeze({ basePrice: 24 }),
  textile: Object.freeze({ basePrice: 18 }),
  food: Object.freeze({ basePrice: 15 }),
  furniture: Object.freeze({ basePrice: 20 }),
  clothing: Object.freeze({ basePrice: 48 }),
  machinery: Object.freeze({ basePrice: 60 }),
  electronics: Object.freeze({ basePrice: 64 }),
});

const PRODUCT_MARKET_DEMAND = Object.freeze({
  wheat: Object.freeze({ marketDemandGroupId: 'food', marketDemandRole: 'direct', marketDemandTier: 'raw' }),
  rice: Object.freeze({ marketDemandGroupId: 'food', marketDemandRole: 'direct', marketDemandTier: 'raw' }),
  flour: Object.freeze({ marketDemandGroupId: 'food', marketDemandRole: 'direct', marketDemandTier: 'intermediate' }),
  food: Object.freeze({ marketDemandGroupId: 'food', marketDemandRole: 'direct', marketDemandTier: 'final' }),
  meat: Object.freeze({ marketDemandGroupId: 'food', marketDemandRole: 'direct', marketDemandTier: 'final' }),
  eggs: Object.freeze({ marketDemandGroupId: 'food', marketDemandRole: 'direct', marketDemandTier: 'final' }),
  milk: Object.freeze({ marketDemandGroupId: 'food', marketDemandRole: 'direct', marketDemandTier: 'final' }),
  timber: Object.freeze({ marketDemandGroupId: 'household', marketDemandRole: 'derived-liquidity', marketDemandTier: 'raw' }),
  cotton: Object.freeze({ marketDemandGroupId: 'household', marketDemandRole: 'derived-liquidity', marketDemandTier: 'raw' }),
  wool: Object.freeze({ marketDemandGroupId: 'household', marketDemandRole: 'derived-liquidity', marketDemandTier: 'raw' }),
  'copper-ore': Object.freeze({ marketDemandGroupId: 'household', marketDemandRole: 'derived-liquidity', marketDemandTier: 'raw' }),
  'crude-oil': Object.freeze({ marketDemandGroupId: 'household', marketDemandRole: 'derived-liquidity', marketDemandTier: 'raw' }),
  lumber: Object.freeze({ marketDemandGroupId: 'household', marketDemandRole: 'derived-liquidity', marketDemandTier: 'intermediate' }),
  textile: Object.freeze({ marketDemandGroupId: 'household', marketDemandRole: 'derived-liquidity', marketDemandTier: 'intermediate' }),
  copper: Object.freeze({ marketDemandGroupId: 'household', marketDemandRole: 'derived-liquidity', marketDemandTier: 'intermediate' }),
  plastic: Object.freeze({ marketDemandGroupId: 'household', marketDemandRole: 'derived-liquidity', marketDemandTier: 'intermediate' }),
  furniture: Object.freeze({ marketDemandGroupId: 'household', marketDemandRole: 'direct', marketDemandTier: 'final' }),
  clothing: Object.freeze({ marketDemandGroupId: 'household', marketDemandRole: 'direct', marketDemandTier: 'final' }),
  electronics: Object.freeze({ marketDemandGroupId: 'household', marketDemandRole: 'direct', marketDemandTier: 'final' }),
});

const FACILITY_BALANCE = Object.freeze({
  farm: Object.freeze({ cycleMs: 120_000, operatingCost: 6 }),
  'logging-camp': Object.freeze({ cycleMs: 60_000, operatingCost: 9 }),
  mine: Object.freeze({ cycleMs: 60_000, operatingCost: 11 }),
  ranch: Object.freeze({ cycleMs: 120_000, operatingCost: 16 }),
  'oil-field': Object.freeze({ cycleMs: 60_000, operatingCost: 15 }),
  mill: Object.freeze({ cycleMs: 40_000, operatingCost: 7 }),
  sawmill: Object.freeze({ cycleMs: 40_000, operatingCost: 3 }),
  steelworks: Object.freeze({ cycleMs: 40_000, operatingCost: 4 }),
  refinery: Object.freeze({ cycleMs: 40_000, operatingCost: 6 }),
  'textile-mill': Object.freeze({ cycleMs: 40_000, operatingCost: 4 }),
  'food-factory': Object.freeze({ cycleMs: 50_000, operatingCost: 14 }),
  'furniture-factory': Object.freeze({ cycleMs: 60_000, operatingCost: 4 }),
  'garment-factory': Object.freeze({ cycleMs: 60_000, operatingCost: 6 }),
  'machine-factory': Object.freeze({ cycleMs: 60_000, operatingCost: 6 }),
  'electronics-factory': Object.freeze({ cycleMs: 60_000, operatingCost: 10 }),
});

export const PRODUCT_CATALOG = Object.freeze(core.PRODUCT_CATALOG.map((product) => {
  const {
    family: _family,
    substitutionGroupId: _substitutionGroupId,
    systemDemandMode: _systemDemandMode,
    ...base
  } = product;
  const marketDemand = PRODUCT_MARKET_DEMAND[product.id] || {};
  return Object.freeze({
    ...base,
    ...PRODUCT_BALANCE[product.id],
    ...marketDemand,
    // 兼容旧客户端字段；业务规则只读取 marketDemand*。
    ...(marketDemand.marketDemandGroupId ? {
      populationDemandGroupId: marketDemand.marketDemandGroupId,
      populationDemandTier: marketDemand.marketDemandTier,
    } : {}),
  });
}));

export const FACILITY_TYPE_CATALOG = Object.freeze(core.FACILITY_TYPE_CATALOG.map((facility) => {
  const balance = FACILITY_BALANCE[facility.id] || {};
  const recipes = facility.recipes.map((recipe) => Object.freeze({
    ...recipe,
    cycleMs: balance.cycleMs ?? recipe.cycleMs,
    operatingCost: balance.operatingCost ?? recipe.operatingCost,
    inputs: Object.freeze((recipe.inputs || []).map((item) => Object.freeze({ ...item }))),
    output: Object.freeze({ ...recipe.output }),
  }));
  const defaultRecipe = recipes.find((recipe) => recipe.id === facility.defaultRecipeId) || recipes[0];
  return Object.freeze({
    ...facility,
    cycleMs: defaultRecipe.cycleMs,
    operatingCost: defaultRecipe.operatingCost,
    inputs: defaultRecipe.inputs,
    input: defaultRecipe.inputs.length === 1 ? defaultRecipe.inputs[0] : null,
    output: defaultRecipe.output,
    recipes: Object.freeze(recipes),
  });
}));

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
  const hadMarketDemandModel = Number(world.marketDemand?.modelVersion || 0) >= 1;
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
    return hadMarketDemandModel && marketDemand.isValidMarketOrder(order);
  });
  if (previousVersion < 9) {
    for (const player of Object.values(migrated.players || {})) {
      const group = (player.facilityGroups || []).find((item) => item.facilityTypeId === 'electronics-factory');
      if (group?.enabled && group.status === 'running') group.cycleStartedAt = now;
    }
  }
  marketDemand.normalizeWorld(migrated, now, { forceRebuild: !hadMarketDemandModel || previousVersion < 13 });
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
