import { randomUUID } from 'node:crypto';
import * as core from './domain-core.js';
import { createBalancedMarketRuntime } from './balanced-market.js';

export * from './domain-core.js';

const clone = (value) => structuredClone(value);

const PRODUCT_BALANCE = Object.freeze({
  wheat: Object.freeze({ basePrice: 2 }),
  rice: Object.freeze({ basePrice: 2 }),
  timber: Object.freeze({ basePrice: 5 }),
  ore: Object.freeze({ basePrice: 6 }),
  'crude-oil': Object.freeze({ basePrice: 8 }),
  flour: Object.freeze({ basePrice: 13 }),
  lumber: Object.freeze({ basePrice: 15 }),
  steel: Object.freeze({ basePrice: 24 }),
  plastic: Object.freeze({ basePrice: 24 }),
  food: Object.freeze({ basePrice: 15 }),
  furniture: Object.freeze({ basePrice: 20 }),
  machinery: Object.freeze({ basePrice: 60 }),
  electronics: Object.freeze({ basePrice: 64 }),
});

const FACILITY_BALANCE = Object.freeze({
  farm: Object.freeze({ cycleMs: 120_000, operatingCost: 6, outputQuantity: 4 }),
  'logging-camp': Object.freeze({ cycleMs: 60_000, operatingCost: 9 }),
  mine: Object.freeze({ cycleMs: 60_000, operatingCost: 11 }),
  'oil-field': Object.freeze({ cycleMs: 60_000, operatingCost: 15 }),
  mill: Object.freeze({ cycleMs: 40_000, operatingCost: 7 }),
  sawmill: Object.freeze({ cycleMs: 40_000, operatingCost: 3 }),
  steelworks: Object.freeze({ cycleMs: 40_000, operatingCost: 4 }),
  refinery: Object.freeze({ cycleMs: 40_000, operatingCost: 6 }),
  'food-factory': Object.freeze({ cycleMs: 50_000, operatingCost: 14 }),
  'furniture-factory': Object.freeze({ cycleMs: 60_000, operatingCost: 4 }),
  'machine-factory': Object.freeze({ cycleMs: 60_000, operatingCost: 6 }),
  'electronics-factory': Object.freeze({ cycleMs: 60_000, operatingCost: 10 }),
});

export const PRODUCT_CATALOG = Object.freeze(core.PRODUCT_CATALOG.map((product) => Object.freeze({
  ...product,
  ...PRODUCT_BALANCE[product.id],
  ...(product.id === 'food' ? { substitutionGroupId: 'staples' } : {}),
})));

export const FACILITY_TYPE_CATALOG = Object.freeze(core.FACILITY_TYPE_CATALOG.map((facility) => {
  const balance = FACILITY_BALANCE[facility.id] || {};
  const cycleMs = balance.cycleMs ?? facility.cycleMs;
  const operatingCost = balance.operatingCost ?? facility.operatingCost;
  const outputQuantity = balance.outputQuantity ?? facility.output.quantity;
  const recipes = facility.recipes.map((recipe) => Object.freeze({
    ...recipe,
    cycleMs,
    operatingCost,
    output: Object.freeze({ ...recipe.output, quantity: balance.outputQuantity ?? recipe.output.quantity }),
  }));
  return Object.freeze({
    ...facility,
    cycleMs,
    operatingCost,
    output: Object.freeze({ ...facility.output, quantity: outputQuantity }),
    recipes: Object.freeze(recipes),
  });
}));

export const DEMAND_GROUP_CATALOG = Object.freeze([
  Object.freeze({
    id: 'staples',
    name: '人口饮食需求',
    ownerName: '人口饮食需求',
    cycleMs: core.ECONOMY_CONSTANTS.demandCycleMs,
    baseBudget: 330,
    referenceUtilityPrice: 6,
    priceElasticity: 3,
    maxPriceIndex: 2,
    quoteUtilityDepth: 12,
    products: Object.freeze([
      Object.freeze({ productId: 'wheat', utilityPerUnit: 1, preferenceWeight: 1, maxBudgetShare: 0.5 }),
      Object.freeze({ productId: 'rice', utilityPerUnit: 1, preferenceWeight: 1, maxBudgetShare: 0.5 }),
      Object.freeze({ productId: 'food', utilityPerUnit: 3, preferenceWeight: 8, maxBudgetShare: 0.8 }),
    ]),
  }),
]);

const PRODUCTS = new Map(PRODUCT_CATALOG.map((product) => [product.id, product]));
const DEMAND_GROUPS = new Map(DEMAND_GROUP_CATALOG.map((group) => [group.id, group]));
const GROUPED_DEMAND_PRODUCT_IDS = new Set(
  DEMAND_GROUP_CATALOG.flatMap((group) => group.products.map((option) => option.productId)),
);
const FAR_FUTURE = Number.MAX_SAFE_INTEGER;
const balancedMarket = createBalancedMarketRuntime({
  products: PRODUCT_CATALOG,
  constants: core.ECONOMY_CONSTANTS,
});

function productDefinition(productId) {
  return PRODUCTS.get(String(productId || '')) || PRODUCTS.get('wheat');
}

function defaultDemandGroupState(group, now) {
  return {
    demandGroupId: group.id,
    cycleMs: group.cycleMs,
    nextDemandAt: now + group.cycleMs,
    lastCycleId: -1,
    lastBudget: group.baseBudget,
    lastCommitted: 0,
    satisfaction: 0,
    lastAllocation: {},
  };
}

function normalizeDemandWorld(world, now = Date.now()) {
  world.demandGroups ||= {};
  for (const group of DEMAND_GROUP_CATALOG) {
    const current = world.demandGroups[group.id] || {};
    const state = {
      ...defaultDemandGroupState(group, now),
      ...current,
      demandGroupId: group.id,
      cycleMs: group.cycleMs,
    };
    if (!Number.isFinite(Number(state.nextDemandAt))) state.nextDemandAt = now + group.cycleMs;
    if (!Number.isFinite(Number(state.lastCycleId))) state.lastCycleId = -1;
    if (!state.lastAllocation || typeof state.lastAllocation !== 'object') state.lastAllocation = {};
    world.demandGroups[group.id] = state;

    for (const option of group.products) {
      const market = world.markets?.[option.productId];
      if (!market?.demand) continue;
      market.demand.cycleMs = group.cycleMs;
    }
  }
  return world;
}

function isOpenOrder(order) {
  return Number(order?.remaining || 0) > 0 && (order?.status === 'open' || order?.status === 'partial');
}

function marketFor(world, productId) {
  return world.markets?.[productId];
}

function inventoryFor(player, productId) {
  player.inventories ||= {};
  player.inventories[productId] ||= { available: 0, frozen: 0 };
  return player.inventories[productId];
}

function expireDemandGroupOrders(world, demandGroupId) {
  const productIds = new Set(DEMAND_GROUPS.get(demandGroupId)?.products.map((item) => item.productId) || []);
  for (const order of world.orders || []) {
    if (order.ownerType !== 'population' || !isOpenOrder(order)) continue;
    if (order.demandGroupId === demandGroupId || (!order.demandGroupId && productIds.has(order.productId))) {
      order.status = 'cancelled';
    }
  }
}

function demandQuote(world, product, group, option) {
  const utilityPerUnit = Math.max(1, Number(option.utilityPerUnit || 1));
  const quoteQuantity = Math.max(1, Math.ceil(group.quoteUtilityDepth / utilityPerUnit));
  const asks = (world.orders || [])
    .filter((order) => order.productId === product.id && order.side === 'sell' && isOpenOrder(order))
    .sort((left, right) => Number(left.price) - Number(right.price) || Number(left.createdAt) - Number(right.createdAt));
  let remaining = quoteQuantity;
  let cost = 0;
  let highestPrice = Math.max(1, Number(marketFor(world, product.id)?.lastPrice || product.basePrice));
  for (const ask of asks) {
    if (remaining <= 0) break;
    const quantity = Math.min(remaining, Math.max(0, Number(ask.remaining || 0)));
    if (quantity <= 0) continue;
    highestPrice = Math.max(highestPrice, Number(ask.price || product.basePrice));
    cost += quantity * Number(ask.price || product.basePrice);
    remaining -= quantity;
  }
  if (remaining > 0) {
    cost += remaining * Math.ceil(highestPrice * (1 + 0.25 * remaining / quoteQuantity));
  }
  return {
    quote: Math.max(1, Math.ceil(cost / quoteQuantity)),
    quoteQuantity,
  };
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
  const choices = group.products.map((option) => {
    const product = productDefinition(option.productId);
    const utilityPerUnit = Math.max(1, Number(option.utilityPerUnit || 1));
    const { quote, quoteQuantity } = demandQuote(world, product, group, option);
    const effectivePrice = quote / utilityPerUnit;
    const priceIndex = effectivePrice / group.referenceUtilityPrice;
    const score = priceIndex <= group.maxPriceIndex
      ? option.preferenceWeight * priceIndex ** -group.priceElasticity
      : 0;
    const maxBudget = Math.floor(group.baseBudget * option.maxBudgetShare);
    const limitPrice = Math.min(
      Math.floor(group.referenceUtilityPrice * group.maxPriceIndex * utilityPerUnit),
      Math.max(1, Math.ceil(quote)),
    );
    return {
      option,
      product,
      utilityPerUnit,
      quote,
      quoteQuantity,
      effectivePrice,
      priceIndex,
      score,
      maxBudget,
      limitPrice,
      quantity: 0,
      committed: 0,
    };
  });

  const budgetTargets = allocateDemandBudgets(choices, group.baseBudget);
  for (const choice of choices) {
    const target = budgetTargets.get(choice.product.id) || 0;
    choice.quantity = choice.score > 0 ? Math.floor(target / choice.limitPrice) : 0;
    choice.committed = choice.quantity * choice.limitPrice;
  }

  let remainingBudget = group.baseBudget - choices.reduce((sum, choice) => sum + choice.committed, 0);
  const remainderOrder = [...choices].sort((left, right) => (
    left.effectivePrice - right.effectivePrice
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
      quote: choice.quote,
      quoteQuantity: choice.quoteQuantity,
      effectivePrice: Number(choice.effectivePrice.toFixed(4)),
      priceIndex: Number(choice.priceIndex.toFixed(4)),
      utilityPerUnit: choice.utilityPerUnit,
      budget: choice.committed,
      quantity: choice.quantity,
      requestedUtility: requestedChoiceUtility,
      filledUtility: 0,
    };
    if (market?.demand) {
      market.demand.lastPrice = choice.limitPrice;
      market.demand.lastQuantity = choice.quantity;
      market.demand.lastBudget = choice.committed;
      market.demand.nextDemandAt = (cycleId + 1) * group.cycleMs;
      market.demand.satisfaction = 0;
    }
    if (choice.quantity < 1) continue;
    const order = {
      id: `population-order-${randomUUID()}`,
      productId: choice.product.id,
      side: 'buy',
      ownerType: 'population',
      ownerName: group.ownerName,
      demandGroupId: group.id,
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
    if (market?.demand) market.demand.satisfaction = choice.quantity === 0 ? 0 : filled / choice.quantity;
  }

  state.lastCycleId = cycleId;
  state.nextDemandAt = (cycleId + 1) * group.cycleMs;
  state.lastBudget = group.baseBudget;
  state.lastCommitted = choices.reduce((sum, choice) => sum + choice.committed, 0);
  state.satisfaction = requestedUtility === 0 ? 0 : filledUtility / requestedUtility;
  state.lastAllocation = allocation;
}

function withLegacyDemandSuppressed(world, now, callback) {
  normalizeDemandWorld(world, now);
  balancedMarket.refreshExternalLiquidity(world, now);
  const groupSnapshots = new Map();
  const marketSnapshots = new Map();
  const dueGroups = [];
  const dueProducts = [];

  for (const group of DEMAND_GROUP_CATALOG) {
    const state = world.demandGroups[group.id];
    groupSnapshots.set(group.id, state.nextDemandAt);
    if (now >= Number(state.nextDemandAt)) dueGroups.push(group.id);
    state.nextDemandAt = FAR_FUTURE;
  }
  for (const product of PRODUCT_CATALOG) {
    const market = balancedMarket.marketFor(world, product.id, now);
    marketSnapshots.set(product.id, market.demand.nextDemandAt);
    if (!GROUPED_DEMAND_PRODUCT_IDS.has(product.id) && now >= Number(market.demand.nextDemandAt)) {
      dueProducts.push(product.id);
    }
    market.demand.nextDemandAt = FAR_FUTURE;
  }

  let result;
  try {
    result = callback();
  } finally {
    normalizeDemandWorld(world, now);
    for (const [groupId, nextDemandAt] of groupSnapshots) {
      world.demandGroups[groupId].nextDemandAt = nextDemandAt;
    }
    for (const [productId, nextDemandAt] of marketSnapshots) {
      balancedMarket.marketFor(world, productId, now).demand.nextDemandAt = nextDemandAt;
    }
  }

  for (const groupId of dueGroups) createGroupedDemand(world, groupId, now);
  for (const productId of dueProducts) balancedMarket.createPopulationDemand(world, productId, now);
  balancedMarket.refreshExternalLiquidity(world, now);
  return result;
}

export function createWorld(now = Date.now()) {
  const world = core.createWorld(now);
  balancedMarket.rebalanceNewWorld(world, now);
  world.demandGroups = Object.fromEntries(DEMAND_GROUP_CATALOG.map((group) => [
    group.id,
    defaultDemandGroupState(group, now),
  ]));
  return normalizeDemandWorld(world, now);
}

export function migrateWorld(world, now = Date.now()) {
  if (!world || typeof world !== 'object') return createWorld(now);
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
  return normalizeDemandWorld(migrated, now);
}

export function ensurePlayer(world, user, now = Date.now()) {
  const player = core.ensurePlayer(world, user, now);
  normalizeDemandWorld(world, now);
  return player;
}

export function processWorld(world, now = Date.now()) {
  migrateWorld(world, now);
  withLegacyDemandSuppressed(world, now, () => core.processWorld(world, now));
  return world;
}

export function applyAction(world, user, action, payload = {}, now = Date.now()) {
  migrateWorld(world, now);
  return withLegacyDemandSuppressed(world, now, () => core.applyAction(world, user, action, payload, now));
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

export { GROUPED_DEMAND_PRODUCT_IDS };
