import { randomUUID } from 'node:crypto';
import * as core from './domain-core.js';
import { createBalancedMarketRuntime } from './balanced-market.js';

export * from './domain-core.js';

const clone = (value) => structuredClone(value);
const PRICE_WINDOW_MS = 30 * 60 * 1000;
const PRICE_MIN_MULTIPLIER = 0.5;
const PRICE_MAX_MULTIPLIER = 3;
const PRICE_RISE_RATE = 0.3;
const PRICE_FALL_RATE = 0.2;
const PRICE_MAX_RISE_PER_CYCLE = 0.08;
const PRICE_MAX_FALL_PER_CYCLE = 0.06;
const PRICE_BASE_REVERSION = 0.02;
const ACTIVE_PLAYER_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const DEMAND_PLAYER_SCALE_MAX = 6;
const DEMAND_INVENTORY_BOOST_RATE = 0.10;
const DEMAND_INVENTORY_BOOST_MAX_SHARE = 0.40;
const DEMAND_BUDGET_SMOOTHING = 0.35;
const DEMAND_BUDGET_MAX_RISE = 0.20;
const DEMAND_BUDGET_MAX_FALL = 0.20;
const DEMAND_STOCK_TARGET_CYCLES = 3;

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

const PRODUCT_DEMAND = Object.freeze({
  wheat: Object.freeze({ populationDemandGroupId: 'food', populationDemandTier: 'raw' }),
  rice: Object.freeze({ populationDemandGroupId: 'food', populationDemandTier: 'raw' }),
  flour: Object.freeze({ populationDemandGroupId: 'food', populationDemandTier: 'intermediate' }),
  food: Object.freeze({ populationDemandGroupId: 'food', populationDemandTier: 'final' }),
  meat: Object.freeze({ populationDemandGroupId: 'food', populationDemandTier: 'final' }),
  eggs: Object.freeze({ populationDemandGroupId: 'food', populationDemandTier: 'final' }),
  milk: Object.freeze({ populationDemandGroupId: 'food', populationDemandTier: 'final' }),
  timber: Object.freeze({ populationDemandGroupId: 'household', populationDemandTier: 'raw' }),
  cotton: Object.freeze({ populationDemandGroupId: 'household', populationDemandTier: 'raw' }),
  wool: Object.freeze({ populationDemandGroupId: 'household', populationDemandTier: 'raw' }),
  'copper-ore': Object.freeze({ populationDemandGroupId: 'household', populationDemandTier: 'raw' }),
  'crude-oil': Object.freeze({ populationDemandGroupId: 'household', populationDemandTier: 'raw' }),
  lumber: Object.freeze({ populationDemandGroupId: 'household', populationDemandTier: 'intermediate' }),
  textile: Object.freeze({ populationDemandGroupId: 'household', populationDemandTier: 'intermediate' }),
  copper: Object.freeze({ populationDemandGroupId: 'household', populationDemandTier: 'intermediate' }),
  plastic: Object.freeze({ populationDemandGroupId: 'household', populationDemandTier: 'intermediate' }),
  furniture: Object.freeze({ populationDemandGroupId: 'household', populationDemandTier: 'final' }),
  clothing: Object.freeze({ populationDemandGroupId: 'household', populationDemandTier: 'final' }),
  electronics: Object.freeze({ populationDemandGroupId: 'household', populationDemandTier: 'final' }),
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
  return Object.freeze({
    ...base,
    ...PRODUCT_BALANCE[product.id],
    ...(PRODUCT_DEMAND[product.id] || {}),
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

export const DEMAND_GROUP_CATALOG = Object.freeze([
  Object.freeze({
    id: 'food',
    name: '饮食需求',
    ownerName: '饮食需求',
    cycleMs: core.ECONOMY_CONSTANTS.demandCycleMs,
    baseBudget: 1_000,
    priceElasticity: 3,
    maxQuoteIndex: 2,
    quoteUtilityDepth: 12,
    products: Object.freeze([
      Object.freeze({ productId: 'wheat', utilityPerUnit: 1, baseBudgetWeight: 0.05, maxBudgetShare: 0.25 }),
      Object.freeze({ productId: 'rice', utilityPerUnit: 1, baseBudgetWeight: 0.05, maxBudgetShare: 0.25 }),
      Object.freeze({ productId: 'flour', utilityPerUnit: 2, baseBudgetWeight: 0.20, maxBudgetShare: 0.35 }),
      Object.freeze({ productId: 'food', utilityPerUnit: 3, baseBudgetWeight: 0.30, maxBudgetShare: 0.55 }),
      Object.freeze({ productId: 'meat', utilityPerUnit: 2, baseBudgetWeight: 0.15, maxBudgetShare: 0.35 }),
      Object.freeze({ productId: 'eggs', utilityPerUnit: 1, baseBudgetWeight: 0.125, maxBudgetShare: 0.25 }),
      Object.freeze({ productId: 'milk', utilityPerUnit: 1, baseBudgetWeight: 0.125, maxBudgetShare: 0.25 }),
    ]),
  }),
  Object.freeze({
    id: 'household',
    name: '家庭用品需求',
    ownerName: '家庭用品需求',
    cycleMs: core.ECONOMY_CONSTANTS.demandCycleMs,
    baseBudget: 900,
    priceElasticity: 2,
    maxQuoteIndex: 2,
    quoteUtilityDepth: 8,
    products: Object.freeze([
      Object.freeze({ productId: 'timber', utilityPerUnit: 1, baseBudgetWeight: 0.02, maxBudgetShare: 0.20 }),
      Object.freeze({ productId: 'cotton', utilityPerUnit: 1, baseBudgetWeight: 0.02, maxBudgetShare: 0.20 }),
      Object.freeze({ productId: 'wool', utilityPerUnit: 1, baseBudgetWeight: 0.02, maxBudgetShare: 0.20 }),
      Object.freeze({ productId: 'copper-ore', utilityPerUnit: 1, baseBudgetWeight: 0.02, maxBudgetShare: 0.20 }),
      Object.freeze({ productId: 'crude-oil', utilityPerUnit: 1, baseBudgetWeight: 0.02, maxBudgetShare: 0.20 }),
      Object.freeze({ productId: 'lumber', utilityPerUnit: 1, baseBudgetWeight: 0.05, maxBudgetShare: 0.30 }),
      Object.freeze({ productId: 'textile', utilityPerUnit: 1, baseBudgetWeight: 0.05, maxBudgetShare: 0.30 }),
      Object.freeze({ productId: 'copper', utilityPerUnit: 1, baseBudgetWeight: 0.05, maxBudgetShare: 0.30 }),
      Object.freeze({ productId: 'plastic', utilityPerUnit: 1, baseBudgetWeight: 0.05, maxBudgetShare: 0.30 }),
      Object.freeze({ productId: 'furniture', utilityPerUnit: 1, baseBudgetWeight: 0.20, maxBudgetShare: 0.50 }),
      Object.freeze({ productId: 'clothing', utilityPerUnit: 2, baseBudgetWeight: 0.25, maxBudgetShare: 0.55 }),
      Object.freeze({ productId: 'electronics', utilityPerUnit: 2, baseBudgetWeight: 0.25, maxBudgetShare: 0.55 }),
    ]),
  }),
]);

const PRODUCTS = new Map(PRODUCT_CATALOG.map((product) => [product.id, product]));
const DEMAND_GROUPS = new Map(DEMAND_GROUP_CATALOG.map((group) => [group.id, group]));
const POPULATION_DEMAND_PRODUCT_IDS = new Set(
  DEMAND_GROUP_CATALOG.flatMap((group) => group.products.map((option) => option.productId)),
);
const PRICE_RECIPES = Object.freeze(FACILITY_TYPE_CATALOG.flatMap((facility) => facility.recipes
  .filter((recipe) => recipe.inputs.length > 0)
  .map((recipe) => Object.freeze({
    facilityTypeId: facility.id,
    recipeId: recipe.id,
    operatingCost: recipe.operatingCost,
    inputs: recipe.inputs,
    output: recipe.output,
  }))));
const balancedMarket = createBalancedMarketRuntime({
  products: PRODUCT_CATALOG,
  constants: core.ECONOMY_CONSTANTS,
});

function productDefinition(productId) {
  return PRODUCTS.get(String(productId || '')) || PRODUCTS.get('wheat');
}

function isOpenOrder(order) {
  return Number(order?.remaining || 0) > 0 && (order?.status === 'open' || order?.status === 'partial');
}

function marketFor(world, productId) {
  return balancedMarket.marketFor(world, productId);
}

function normalizePlayerActivity(world, now) {
  world.players ||= {};
  const latestOrderAt = new Map();
  for (const order of world.orders || []) {
    if (order.ownerType !== 'player' || !Number.isFinite(Number(order.ownerId))) continue;
    const ownerId = String(order.ownerId);
    latestOrderAt.set(ownerId, Math.max(latestOrderAt.get(ownerId) || 0, Number(order.createdAt || 0)));
  }
  for (const [playerId, player] of Object.entries(world.players)) {
    if (Number.isFinite(Number(player.lastEconomicActivityAt)) && Number(player.lastEconomicActivityAt) > 0) continue;
    const tradeAt = (player.trades || []).reduce((latest, item) => Math.max(latest, Number(item.createdAt || 0)), 0);
    const ledgerAt = (player.ledger || []).reduce((latest, item) => Math.max(latest, Number(item.createdAt || 0)), 0);
    const inferredActivityAt = Math.max(
      Number(player.registeredAt || 0),
      Number(player.work?.lastWorkedAt || 0),
      latestOrderAt.get(playerId) || 0,
      tradeAt,
      ledgerAt,
    );
    player.lastEconomicActivityAt = inferredActivityAt > 0 ? inferredActivityAt : now;
  }
}

function defaultDemandGroupState(group, now) {
  return {
    demandGroupId: group.id,
    cycleMs: group.cycleMs,
    nextDemandAt: now,
    lastCycleId: Math.floor(now / group.cycleMs) - 1,
    lastBudget: group.baseBudget,
    lastTargetBudget: 0,
    lastPlayerScaleBudget: group.baseBudget,
    lastInventoryBoost: 0,
    lastActivePlayerCount: 0,
    lastStockValue: 0,
    lastCommitted: 0,
    satisfaction: 0,
    lastAllocation: {},
  };
}

function defaultProductPriceState(product, cycleId) {
  return {
    observedPrice: product.basePrice,
    costAnchor: null,
    downstreamValueAnchor: null,
    targetPrice: product.basePrice,
    referencePrice: product.basePrice,
    lastUpdatedCycleId: cycleId,
  };
}

function defaultPriceTransmissionState(now) {
  const cycleId = Math.floor(now / core.ECONOMY_CONSTANTS.demandCycleMs);
  return {
    cycleMs: core.ECONOMY_CONSTANTS.demandCycleMs,
    lastCycleId: cycleId,
    products: Object.fromEntries(PRODUCT_CATALOG.map((product) => [
      product.id,
      defaultProductPriceState(product, cycleId),
    ])),
  };
}

function normalizeDemandWorld(world, now = Date.now()) {
  normalizePlayerActivity(world, now);
  world.demandGroups ||= {};
  const legacyGroups = world.demandGroups;
  const normalizedGroups = {};
  for (const group of DEMAND_GROUP_CATALOG) {
    const legacyId = group.id === 'food' ? 'staples' : 'household-goods';
    const current = legacyGroups[group.id] || legacyGroups[legacyId] || {};
    const state = {
      ...defaultDemandGroupState(group, now),
      ...current,
      demandGroupId: group.id,
      cycleMs: group.cycleMs,
    };
    if (!Number.isFinite(Number(state.nextDemandAt))) state.nextDemandAt = now + group.cycleMs;
    if (!Number.isFinite(Number(state.lastCycleId))) state.lastCycleId = Math.floor(now / group.cycleMs);
    state.lastBudget = Math.max(0, Math.floor(Number(state.lastBudget ?? group.baseBudget)));
    state.lastTargetBudget = Math.max(0, Math.floor(Number(state.lastTargetBudget || 0)));
    state.lastPlayerScaleBudget = Math.max(0, Math.floor(Number(state.lastPlayerScaleBudget || group.baseBudget)));
    state.lastInventoryBoost = Math.max(0, Math.floor(Number(state.lastInventoryBoost || 0)));
    state.lastActivePlayerCount = Math.max(0, Math.floor(Number(state.lastActivePlayerCount || 0)));
    state.lastStockValue = Math.max(0, Number(state.lastStockValue || 0));
    if (!state.lastAllocation || typeof state.lastAllocation !== 'object') state.lastAllocation = {};
    normalizedGroups[group.id] = state;
    for (const option of group.products) {
      const market = marketFor(world, option.productId);
      market.demand ||= {};
      market.demand.cycleMs = group.cycleMs;
    }
  }
  world.demandGroups = normalizedGroups;

  const fallback = defaultPriceTransmissionState(now);
  const currentTransmission = world.priceTransmission && typeof world.priceTransmission === 'object'
    ? world.priceTransmission
    : {};
  world.priceTransmission = {
    ...fallback,
    ...currentTransmission,
    cycleMs: core.ECONOMY_CONSTANTS.demandCycleMs,
    products: {},
  };
  if (!Number.isFinite(Number(world.priceTransmission.lastCycleId))) {
    world.priceTransmission.lastCycleId = fallback.lastCycleId;
  }
  for (const product of PRODUCT_CATALOG) {
    const market = marketFor(world, product.id);
    const previous = currentTransmission.products?.[product.id] || {};
    const referenceFallback = Number(market.demand?.referencePrice || market.demand?.lastPrice || product.basePrice);
    const state = {
      ...defaultProductPriceState(product, world.priceTransmission.lastCycleId),
      ...previous,
      referencePrice: Number.isFinite(Number(previous.referencePrice))
        ? Number(previous.referencePrice)
        : referenceFallback,
    };
    for (const key of ['observedPrice', 'targetPrice']) {
      if (!Number.isFinite(Number(state[key])) || Number(state[key]) <= 0) state[key] = product.basePrice;
    }
    for (const key of ['costAnchor', 'downstreamValueAnchor']) {
      if (state[key] !== null && (!Number.isFinite(Number(state[key])) || Number(state[key]) <= 0)) state[key] = null;
    }
    world.priceTransmission.products[product.id] = state;
    market.demand.referencePrice = state.referencePrice;
    market.demand.observedPrice = state.observedPrice;
    market.demand.costAnchor = state.costAnchor;
    market.demand.downstreamValueAnchor = state.downstreamValueAnchor;
    market.demand.targetPrice = state.targetPrice;
  }
  return world;
}

function realTradeStats(world, productId, now) {
  const points = (marketFor(world, productId).priceHistory || []).filter((point) => (
    Number(point.createdAt || 0) >= now - PRICE_WINDOW_MS
    && (point.takerSide === 'buy' || point.takerSide === 'sell')
    && Number(point.quantity || 0) > 0
    && Number(point.price || 0) > 0
  ));
  const quantity = points.reduce((sum, point) => sum + Number(point.quantity), 0);
  const value = points.reduce((sum, point) => sum + Number(point.quantity) * Number(point.price), 0);
  return { quantity, vwap: quantity > 0 ? value / quantity : null };
}

function geometricWeightedMean(signals) {
  const active = signals.filter((signal) => Number.isFinite(signal.value) && signal.value > 0 && signal.weight > 0);
  const totalWeight = active.reduce((sum, signal) => sum + signal.weight, 0);
  if (totalWeight <= 0) return null;
  return Math.exp(active.reduce((sum, signal) => sum + signal.weight * Math.log(signal.value), 0) / totalWeight);
}

function productSignalPrice(snapshot, product) {
  const state = snapshot[product.id];
  return Math.max(
    product.basePrice * PRICE_MIN_MULTIPLIER,
    Number(state.referencePrice || product.basePrice) * 0.55 + Number(state.observedPrice || product.basePrice) * 0.45,
  );
}

function targetProfitForRecipe(recipe) {
  const outputProduct = productDefinition(recipe.output.productId);
  const revenue = outputProduct.basePrice * recipe.output.quantity;
  const inputs = recipe.inputs.reduce((sum, input) => sum + productDefinition(input.productId).basePrice * input.quantity, 0);
  return Math.max(0, revenue - inputs - recipe.operatingCost);
}

function calculatePriceAnchors(world, snapshot, now) {
  const costCandidates = new Map(PRODUCT_CATALOG.map((product) => [product.id, []]));
  const downstreamCandidates = new Map(PRODUCT_CATALOG.map((product) => [product.id, []]));

  for (const recipe of PRICE_RECIPES) {
    const outputProduct = productDefinition(recipe.output.productId);
    const profit = targetProfitForRecipe(recipe);
    const inputCost = recipe.inputs.reduce((sum, input) => (
      sum + productSignalPrice(snapshot, productDefinition(input.productId)) * input.quantity
    ), 0);
    const unitCost = (inputCost + recipe.operatingCost + profit) / recipe.output.quantity;
    costCandidates.get(outputProduct.id).push(unitCost);

    const outputStats = realTradeStats(world, outputProduct.id, now);
    const outputMarket = marketFor(world, outputProduct.id);
    const satisfaction = Math.max(0, Math.min(1, Number(outputMarket.demand?.satisfaction || 0)));
    const activityWeight = Math.max(0.25, outputStats.quantity) * (0.25 + 0.75 * satisfaction);
    const outputValue = productSignalPrice(snapshot, outputProduct) * recipe.output.quantity;
    for (const input of recipe.inputs) {
      const otherInputCost = recipe.inputs.reduce((sum, other) => (
        other.productId === input.productId
          ? sum
          : sum + productSignalPrice(snapshot, productDefinition(other.productId)) * other.quantity
      ), 0);
      const netback = (outputValue - recipe.operatingCost - profit - otherInputCost) / input.quantity;
      if (Number.isFinite(netback) && netback > 0) {
        downstreamCandidates.get(input.productId).push({ value: netback, weight: activityWeight });
      }
    }
  }

  return Object.fromEntries(PRODUCT_CATALOG.map((product) => {
    const costs = costCandidates.get(product.id);
    const downstream = downstreamCandidates.get(product.id);
    const costAnchor = costs.length > 0 ? Math.min(...costs) : null;
    const downstreamValueAnchor = downstream.length > 0
      ? downstream.reduce((sum, item) => sum + item.value * item.weight, 0)
        / downstream.reduce((sum, item) => sum + item.weight, 0)
      : null;
    return [product.id, { costAnchor, downstreamValueAnchor }];
  }));
}

function priceWeights(product) {
  switch (product.populationDemandTier) {
    case 'raw':
      return { base: 0.20, observed: 0.35, cost: 0, downstream: 0.45 };
    case 'intermediate':
      return { base: 0.10, observed: 0.30, cost: 0.30, downstream: 0.30 };
    case 'final':
      return { base: 0.20, observed: 0.35, cost: 0.45, downstream: 0 };
    default:
      return { base: 0.35, observed: 0.45, cost: 0.10, downstream: 0.10 };
  }
}

function processPriceTransmission(world, now) {
  normalizeDemandWorld(world, now);
  const cycleId = Math.floor(now / world.priceTransmission.cycleMs);
  if (cycleId <= Number(world.priceTransmission.lastCycleId)) return false;

  const snapshot = clone(world.priceTransmission.products);
  const anchors = calculatePriceAnchors(world, snapshot, now);
  for (const product of PRODUCT_CATALOG) {
    const previous = snapshot[product.id] || defaultProductPriceState(product, cycleId - 1);
    const tradeStats = realTradeStats(world, product.id, now);
    const observedPrice = tradeStats.vwap === null
      ? Number(previous.observedPrice || product.basePrice) * (1 - PRICE_BASE_REVERSION)
        + product.basePrice * PRICE_BASE_REVERSION
      : Number(previous.observedPrice || product.basePrice) * 0.70 + tradeStats.vwap * 0.30;
    const { costAnchor, downstreamValueAnchor } = anchors[product.id];
    const weights = priceWeights(product);
    const targetRaw = geometricWeightedMean([
      { value: product.basePrice, weight: weights.base },
      { value: observedPrice, weight: weights.observed },
      { value: costAnchor, weight: weights.cost },
      { value: downstreamValueAnchor, weight: weights.downstream },
    ]) || product.basePrice;
    const targetPrice = Math.max(
      product.basePrice * PRICE_MIN_MULTIPLIER,
      Math.min(product.basePrice * PRICE_MAX_MULTIPLIER, targetRaw),
    );
    const oldReference = Math.max(0.01, Number(previous.referencePrice || product.basePrice));
    const adjustmentRate = targetPrice >= oldReference ? PRICE_RISE_RATE : PRICE_FALL_RATE;
    const unconstrained = oldReference + adjustmentRate * (targetPrice - oldReference);
    const minimum = oldReference * (1 - PRICE_MAX_FALL_PER_CYCLE);
    const maximum = oldReference * (1 + PRICE_MAX_RISE_PER_CYCLE);
    const referencePrice = Math.max(
      product.basePrice * PRICE_MIN_MULTIPLIER,
      Math.min(product.basePrice * PRICE_MAX_MULTIPLIER, Math.max(minimum, Math.min(maximum, unconstrained))),
    );
    const state = {
      observedPrice,
      costAnchor,
      downstreamValueAnchor,
      targetPrice,
      referencePrice,
      lastUpdatedCycleId: cycleId,
    };
    world.priceTransmission.products[product.id] = state;
    const market = marketFor(world, product.id);
    market.demand.referencePrice = referencePrice;
    market.demand.observedPrice = observedPrice;
    market.demand.costAnchor = costAnchor;
    market.demand.downstreamValueAnchor = downstreamValueAnchor;
    market.demand.targetPrice = targetPrice;
  }
  world.priceTransmission.lastCycleId = cycleId;
  return true;
}

function expireDemandGroupOrders(world, demandGroupId) {
  for (const order of world.orders || []) {
    if (order.ownerType === 'population' && isOpenOrder(order) && order.demandGroupId === demandGroupId) {
      order.status = 'cancelled';
    }
  }
}

function demandQuote(world, product, group, option, limitPrice) {
  const utilityPerUnit = Math.max(1, Number(option.utilityPerUnit || 1));
  const quoteQuantity = Math.max(1, Math.ceil(group.quoteUtilityDepth / utilityPerUnit));
  const asks = (world.orders || [])
    .filter((order) => order.ownerType === 'player'
      && order.productId === product.id
      && order.side === 'sell'
      && isOpenOrder(order))
    .sort((left, right) => Number(left.price) - Number(right.price) || Number(left.createdAt) - Number(right.createdAt));
  if (asks.length === 0) return { quote: limitPrice, quoteQuantity };
  let remaining = quoteQuantity;
  let cost = 0;
  let highestPrice = limitPrice;
  for (const ask of asks) {
    if (remaining <= 0) break;
    const quantity = Math.min(remaining, Math.max(0, Number(ask.remaining || 0)));
    if (quantity <= 0) continue;
    highestPrice = Math.max(highestPrice, Number(ask.price || limitPrice));
    cost += quantity * Number(ask.price || limitPrice);
    remaining -= quantity;
  }
  if (remaining > 0) cost += remaining * highestPrice;
  return { quote: Math.max(1, cost / quoteQuantity), quoteQuantity };
}

function allocateDemandBudgets(choices, totalBudget) {
  const budgets = new Map(choices.map((choice) => [choice.product.id, 0]));
  let remainingBudget = totalBudget;
  let active = choices.filter((choice) => choice.score > 0 && choice.maxBudget > 0);
  while (remainingBudget > 0 && active.length > 0) {
    const totalScore = active.reduce((sum, choice) => sum + choice.score, 0);
    let distributed = 0;
    for (const choice of active) {
      const current = budgets.get(choice.product.id) || 0;
      const available = Math.max(0, choice.maxBudget - current);
      if (available < 1) continue;
      const proportional = Math.floor(remainingBudget * choice.score / totalScore);
      const grant = Math.min(available, proportional, remainingBudget - distributed);
      if (grant < 1) continue;
      budgets.set(choice.product.id, current + grant);
      distributed += grant;
      if (distributed >= remainingBudget) break;
    }
    if (distributed < 1) {
      const choice = [...active].sort((left, right) => right.score - left.score || left.product.id.localeCompare(right.product.id))[0];
      budgets.set(choice.product.id, (budgets.get(choice.product.id) || 0) + 1);
      distributed = 1;
    }
    remainingBudget -= distributed;
    active = active.filter((choice) => (budgets.get(choice.product.id) || 0) < choice.maxBudget);
  }
  return budgets;
}

function activePlayerCount(world, now) {
  const cutoff = now - ACTIVE_PLAYER_WINDOW_MS;
  const count = Object.values(world.players || {}).filter((player) => (
    Number(player.lastEconomicActivityAt || 0) >= cutoff
  )).length;
  return Math.max(1, count);
}

function demandStockSnapshot(world, group) {
  const byProduct = Object.fromEntries(group.products.map((option) => {
    const product = productDefinition(option.productId);
    const priceState = world.priceTransmission.products[product.id];
    const referencePrice = Math.max(0.01, Number(priceState?.referencePrice || product.basePrice));
    const quantity = Object.values(world.players || {}).reduce((sum, player) => {
      const inventory = player.inventories?.[product.id] || {};
      return sum + Math.max(0, Number(inventory.available || 0)) + Math.max(0, Number(inventory.frozen || 0));
    }, 0);
    return [product.id, { quantity, referencePrice, value: quantity * referencePrice }];
  }));
  return {
    byProduct,
    totalValue: Object.values(byProduct).reduce((sum, item) => sum + item.value, 0),
  };
}

function dynamicDemandBudget(world, group, state, now, stockSnapshot) {
  const activePlayers = activePlayerCount(world, now);
  const playerScale = Math.min(DEMAND_PLAYER_SCALE_MAX, Math.max(1, 0.5 + 0.5 * Math.sqrt(activePlayers)));
  const playerScaleBudget = Math.max(1, Math.floor(group.baseBudget * playerScale));
  const inventoryBoost = Math.max(0, Math.floor(Math.min(
    playerScaleBudget * DEMAND_INVENTORY_BOOST_MAX_SHARE,
    stockSnapshot.totalValue * DEMAND_INVENTORY_BOOST_RATE,
  )));
  const targetBudget = playerScaleBudget + inventoryBoost;
  const previousBudget = Math.max(1, Math.floor(Number(state.lastBudget || group.baseBudget)));
  let budget = targetBudget;
  if (Number(state.lastTargetBudget || 0) > 0) {
    const smoothed = Math.round(previousBudget * (1 - DEMAND_BUDGET_SMOOTHING) + targetBudget * DEMAND_BUDGET_SMOOTHING);
    const minimum = Math.ceil(previousBudget * (1 - DEMAND_BUDGET_MAX_FALL));
    const maximum = Math.floor(previousBudget * (1 + DEMAND_BUDGET_MAX_RISE));
    budget = Math.max(minimum, Math.min(maximum, smoothed));
  }
  return { activePlayers, playerScale, playerScaleBudget, inventoryBoost, targetBudget, budget };
}

function createGroupedDemand(world, groupId, now) {
  const group = DEMAND_GROUPS.get(groupId);
  if (!group) return;
  normalizeDemandWorld(world, now);
  const state = world.demandGroups[group.id];
  const cycleId = Math.floor(now / group.cycleMs);
  if (Number(state.lastCycleId) === cycleId) {
    state.nextDemandAt = (cycleId + 1) * group.cycleMs;
    return;
  }

  expireDemandGroupOrders(world, group.id);
  const stockSnapshot = demandStockSnapshot(world, group);
  const dynamicBudget = dynamicDemandBudget(world, group, state, now, stockSnapshot);
  const cycleBudget = dynamicBudget.budget;
  const choices = group.products.map((option) => {
    const product = productDefinition(option.productId);
    const priceState = world.priceTransmission.products[product.id];
    const limitPrice = Math.max(1, Math.round(Number(priceState.referencePrice || product.basePrice)));
    const { quote, quoteQuantity } = demandQuote(world, product, group, option, limitPrice);
    const utilityPerUnit = Math.max(1, Number(option.utilityPerUnit || 1));
    const priceIndex = quote / limitPrice;
    const stock = stockSnapshot.byProduct[product.id];
    const targetStockValue = Math.max(
      1,
      dynamicBudget.playerScaleBudget * option.baseBudgetWeight * DEMAND_STOCK_TARGET_CYCLES,
    );
    const stockRatio = stock.value / targetStockValue;
    const inventoryFactor = Math.max(0.7, Math.min(1.8, 0.7 + 0.3 * Math.sqrt(stockRatio)));
    const score = priceIndex <= group.maxQuoteIndex
      ? option.baseBudgetWeight * priceIndex ** -group.priceElasticity * inventoryFactor
      : 0;
    return {
      option,
      product,
      utilityPerUnit,
      quote,
      quoteQuantity,
      priceIndex,
      stock,
      targetStockValue,
      stockRatio,
      inventoryFactor,
      score,
      maxBudget: Math.floor(cycleBudget * option.maxBudgetShare),
      limitPrice,
      quantity: 0,
      committed: 0,
    };
  });

  const budgetTargets = allocateDemandBudgets(choices, cycleBudget);
  for (const choice of choices) {
    const target = budgetTargets.get(choice.product.id) || 0;
    choice.quantity = choice.score > 0 ? Math.floor(target / choice.limitPrice) : 0;
    choice.committed = choice.quantity * choice.limitPrice;
  }

  let remainingBudget = cycleBudget - choices.reduce((sum, choice) => sum + choice.committed, 0);
  const remainderOrder = [...choices].sort((left, right) => (
    left.priceIndex - right.priceIndex
    || right.score - left.score
    || left.product.id.localeCompare(right.product.id)
  ));
  let progressed = true;
  while (progressed && remainingBudget > 0) {
    progressed = false;
    for (const choice of remainderOrder) {
      if (choice.score <= 0 || remainingBudget < choice.limitPrice) continue;
      if (choice.committed + choice.limitPrice > choice.maxBudget) continue;
      choice.quantity += 1;
      choice.committed += choice.limitPrice;
      remainingBudget -= choice.limitPrice;
      progressed = true;
    }
  }

  let requestedUtility = 0;
  let filledUtility = 0;
  const allocation = {};
  for (const choice of choices) {
    const market = marketFor(world, choice.product.id);
    const requestedChoiceUtility = choice.quantity * choice.utilityPerUnit;
    requestedUtility += requestedChoiceUtility;
    allocation[choice.product.id] = {
      tier: choice.product.populationDemandTier,
      referencePrice: Number(world.priceTransmission.products[choice.product.id].referencePrice.toFixed(4)),
      quote: Number(choice.quote.toFixed(4)),
      quoteQuantity: choice.quoteQuantity,
      priceIndex: Number(choice.priceIndex.toFixed(4)),
      utilityPerUnit: choice.utilityPerUnit,
      stockQuantity: choice.stock.quantity,
      stockValue: Number(choice.stock.value.toFixed(4)),
      targetStockValue: Number(choice.targetStockValue.toFixed(4)),
      stockRatio: Number(choice.stockRatio.toFixed(4)),
      inventoryFactor: Number(choice.inventoryFactor.toFixed(4)),
      budget: choice.committed,
      quantity: choice.quantity,
      requestedUtility: requestedChoiceUtility,
      filledUtility: 0,
    };
    market.demand.lastPrice = choice.limitPrice;
    market.demand.lastQuantity = choice.quantity;
    market.demand.lastBudget = choice.committed;
    market.demand.nextDemandAt = (cycleId + 1) * group.cycleMs;
    market.demand.satisfaction = 0;
    if (choice.quantity < 1) continue;
    const order = {
      id: `population-order-${randomUUID()}`,
      assetKind: 'commodity',
      assetId: choice.product.id,
      productId: choice.product.id,
      side: 'buy',
      ownerType: 'population',
      ownerName: group.ownerName,
      demandGroupId: group.id,
      demandTier: choice.product.populationDemandTier,
      demandCycleId: cycleId,
      price: choice.limitPrice,
      quantity: choice.quantity,
      remaining: choice.quantity,
      status: 'open',
      createdAt: now,
    };
    world.orders.push(order);
    balancedMarket.matchOrder(world, order, now);
    const filled = choice.quantity - order.remaining;
    const filledChoiceUtility = filled * choice.utilityPerUnit;
    filledUtility += filledChoiceUtility;
    allocation[choice.product.id].filledUtility = filledChoiceUtility;
    market.demand.satisfaction = choice.quantity === 0 ? 0 : filled / choice.quantity;
  }

  state.lastCycleId = cycleId;
  state.nextDemandAt = (cycleId + 1) * group.cycleMs;
  state.lastBudget = cycleBudget;
  state.lastTargetBudget = dynamicBudget.targetBudget;
  state.lastPlayerScaleBudget = dynamicBudget.playerScaleBudget;
  state.lastInventoryBoost = dynamicBudget.inventoryBoost;
  state.lastActivePlayerCount = dynamicBudget.activePlayers;
  state.lastStockValue = Number(stockSnapshot.totalValue.toFixed(4));
  state.lastCommitted = choices.reduce((sum, choice) => sum + choice.committed, 0);
  state.satisfaction = requestedUtility === 0 ? 0 : filledUtility / requestedUtility;
  state.lastAllocation = allocation;
}

function processPopulationDemand(world, now) {
  normalizeDemandWorld(world, now);
  processPriceTransmission(world, now);
  for (const group of DEMAND_GROUP_CATALOG) {
    if (now >= Number(world.demandGroups[group.id].nextDemandAt)) createGroupedDemand(world, group.id, now);
  }
}

function isValidPopulationOrder(order) {
  if (order.ownerType !== 'population') return false;
  const group = DEMAND_GROUPS.get(String(order.demandGroupId || ''));
  if (!group || order.ownerName !== group.ownerName) return false;
  return group.products.some((option) => option.productId === order.productId);
}

export function createWorld(now = Date.now()) {
  const world = core.createWorld(now);
  balancedMarket.rebalanceNewWorld(world, now);
  world.demandGroups = Object.fromEntries(DEMAND_GROUP_CATALOG.map((group) => [
    group.id,
    defaultDemandGroupState(group, now),
  ]));
  world.priceTransmission = defaultPriceTransmissionState(now);
  world.version = 13;
  return normalizeDemandWorld(world, now);
}

export function migrateWorld(world, now = Date.now()) {
  if (!world || typeof world !== 'object') return createWorld(now);
  const previousVersion = Number(world.version || 0);
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
    return previousVersion >= 13 && isValidPopulationOrder(order);
  });
  if (previousVersion < 9) {
    for (const player of Object.values(migrated.players || {})) {
      const group = (player.facilityGroups || []).find((item) => item.facilityTypeId === 'electronics-factory');
      if (group?.enabled && group.status === 'running') group.cycleStartedAt = now;
    }
  }
  const normalized = normalizeDemandWorld(migrated, now);
  if (previousVersion < 13) {
    for (const group of DEMAND_GROUP_CATALOG) {
      const state = normalized.demandGroups[group.id];
      const previousBudget = Math.max(1, Math.floor(Number(state.lastBudget || group.baseBudget)));
      state.nextDemandAt = now;
      state.lastCycleId = Math.floor(now / group.cycleMs) - 1;
      state.lastBudget = previousBudget;
      state.lastTargetBudget = previousBudget;
      state.lastPlayerScaleBudget = previousBudget;
      state.lastInventoryBoost = 0;
      state.lastActivePlayerCount = 0;
      state.lastStockValue = 0;
      state.lastCommitted = 0;
      state.satisfaction = 0;
      state.lastAllocation = {};
    }
  }
  normalized.version = 13;
  return normalized;
}

export function ensurePlayer(world, user, now = Date.now()) {
  const player = core.ensurePlayer(world, user, now);
  normalizeDemandWorld(world, now);
  return player;
}

export function processWorld(world, now = Date.now()) {
  migrateWorld(world, now);
  core.processWorld(world, now);
  processPopulationDemand(world, now);
  return world;
}

export function applyAction(world, user, action, payload = {}, now = Date.now()) {
  migrateWorld(world, now);
  const result = core.applyAction(world, user, action, payload, now);
  processPopulationDemand(world, now);
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

export { POPULATION_DEMAND_PRODUCT_IDS, processPriceTransmission };
