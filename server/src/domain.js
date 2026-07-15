import { randomUUID } from 'node:crypto';
import * as core from './domain-core.js';

export * from './domain-core.js';

const clone = (value) => structuredClone(value);

export const PRODUCT_CATALOG = Object.freeze(core.PRODUCT_CATALOG.map((product) => Object.freeze(
  product.id === 'food'
    ? { ...product, substitutionGroupId: 'staples' }
    : { ...product },
)));

export const FACILITY_TYPE_CATALOG = Object.freeze(core.FACILITY_TYPE_CATALOG.map((facility) => {
  if (facility.id !== 'farm') return facility;
  const recipes = facility.recipes.map((recipe) => Object.freeze({
    ...recipe,
    cycleMs: 45_000,
    operatingCost: 2,
    output: Object.freeze({ ...recipe.output, quantity: 4 }),
  }));
  return Object.freeze({
    ...facility,
    cycleMs: 45_000,
    operatingCost: 2,
    output: Object.freeze({ productId: 'wheat', quantity: 4 }),
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

function addTrade(player, trade) {
  player.trades ||= [];
  player.trades.unshift({ id: `trade-${randomUUID()}`, ...trade });
  player.trades = player.trades.slice(0, core.ECONOMY_CONSTANTS.maxTradesPerPlayer);
}

function addLedger(player, category, amount, description, createdAt) {
  player.ledger ||= [];
  player.ledger.unshift({
    id: `ledger-${randomUUID()}`,
    category,
    amount,
    balanceAfter: player.credits,
    createdAt,
    description,
  });
  player.ledger = player.ledger.slice(0, core.ECONOMY_CONSTANTS.maxLedgerPerPlayer);
}

function appendPlayerOrderFill(order, fill) {
  if (order.ownerType !== 'player') return;
  order.fills = Array.isArray(order.fills) ? order.fills : [];
  order.fills.push(fill);
  order.fills = order.fills.slice(-120);
}

function recordPrice(world, productId, price, quantity, createdAt) {
  const market = marketFor(world, productId);
  if (!market) return;
  market.lastPrice = price;
  market.priceHistory ||= [];
  market.priceHistory.push({ price, quantity, createdAt });
  market.priceHistory = market.priceHistory.slice(-core.ECONOMY_CONSTANTS.maxPricePoints);
}

function settlePlayerPopulationSale(world, order, quantity, tradePrice, buyer, createdAt) {
  const player = world.players?.[String(order.ownerId)];
  if (!player) throw new Error(`Missing seller ${order.ownerId}`);
  const inventory = inventoryFor(player, order.productId);
  const total = quantity * tradePrice;
  inventory.frozen -= quantity;
  player.credits += total;
  player.stats ||= {};
  player.stats.commodityVolume = Number(player.stats.commodityVolume || 0) + quantity;
  player.stats.soldGoods = Number(player.stats.soldGoods || 0) + quantity;
  player.stats.populationIssued = Number(player.stats.populationIssued || 0) + total;
  const product = productDefinition(order.productId);
  addTrade(player, {
    type: 'commodity',
    productId: product.id,
    side: 'sell',
    quantity,
    price: tradePrice,
    total,
    counterparty: buyer.ownerName || '人口饮食需求',
    createdAt,
    description: `卖出 ${product.name}`,
  });
  addLedger(player, 'population_income', total, `人口需求消费 ${quantity} 个${product.name}，成交价 ${tradePrice}`, createdAt);
}

function executePopulationTrade(world, incoming, resting, quantity, createdAt) {
  const price = Number(resting.price);
  const fillId = `order-fill-${randomUUID()}`;
  const fillBase = {
    id: fillId,
    quantity,
    price,
    total: quantity * price,
    createdAt,
    makerOrderId: resting.id,
    takerOrderId: incoming.id,
  };
  incoming.remaining -= quantity;
  resting.remaining -= quantity;
  incoming.status = incoming.remaining === 0 ? 'filled' : 'partial';
  resting.status = resting.remaining === 0 ? 'filled' : 'partial';
  appendPlayerOrderFill(resting, {
    ...fillBase,
    counterparty: incoming.ownerName,
    liquidity: 'maker',
  });
  if (resting.ownerType === 'player') {
    settlePlayerPopulationSale(world, resting, quantity, price, incoming, createdAt);
  }
  recordPrice(world, incoming.productId, price, quantity, createdAt);
}

function matchPopulationOrder(world, incoming, createdAt) {
  const candidates = (world.orders || [])
    .filter((order) => (
      order.id !== incoming.id
      && order.productId === incoming.productId
      && order.side === 'sell'
      && isOpenOrder(order)
      && Number(order.price) <= Number(incoming.price)
    ))
    .sort((left, right) => Number(left.price) - Number(right.price) || Number(left.createdAt) - Number(right.createdAt));
  for (const candidate of candidates) {
    if (!isOpenOrder(incoming)) break;
    executePopulationTrade(world, incoming, candidate, Math.min(incoming.remaining, candidate.remaining), createdAt);
  }
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
    matchPopulationOrder(world, order, now);
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
  const groupSnapshots = new Map();
  const marketSnapshots = new Map();
  const dueGroups = [];
  for (const group of DEMAND_GROUP_CATALOG) {
    const state = world.demandGroups[group.id];
    groupSnapshots.set(group.id, state.nextDemandAt);
    if (now >= Number(state.nextDemandAt)) dueGroups.push(group.id);
    state.nextDemandAt = FAR_FUTURE;
    for (const option of group.products) {
      const market = marketFor(world, option.productId);
      if (!market?.demand) continue;
      marketSnapshots.set(option.productId, market.demand.nextDemandAt);
      market.demand.nextDemandAt = FAR_FUTURE;
    }
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
      const market = marketFor(world, productId);
      if (market?.demand) market.demand.nextDemandAt = nextDemandAt;
    }
  }
  for (const groupId of dueGroups) createGroupedDemand(world, groupId, now);
  return result;
}

export function createWorld(now = Date.now()) {
  return normalizeDemandWorld(core.createWorld(now), now);
}

export function migrateWorld(world, now = Date.now()) {
  return normalizeDemandWorld(core.migrateWorld(world, now), now);
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
