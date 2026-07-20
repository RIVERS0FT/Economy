import { randomUUID } from 'node:crypto';
import {
  MARKET_DEMAND_GROUP_CATALOG,
  MARKET_DEMAND_PRODUCT_IDS,
  PRICE_MAX_MULTIPLIER,
  SYSTEM_ORDER_PRICE_STEP,
  SYSTEM_ORDER_RETENTION_RATE,
  SYSTEM_ORDER_VALUE_CYCLES,
} from './market-demand/catalog.js';
import { createDemandAllocationRuntime } from './market-demand/allocation.js';
import { clamp, round4 } from './market-demand/math.js';
import { createPriceTransmissionRuntime } from './market-demand/price-transmission.js';
import { createMarketSignalRuntime } from './market-demand/signals.js';
import { createMarketDemandStateRuntime } from './market-demand/state.js';

export { MARKET_DEMAND_GROUP_CATALOG, MARKET_DEMAND_MODEL_VERSION, MARKET_DEMAND_PRODUCT_IDS } from './market-demand/catalog.js';

export function createMarketDemandRuntime({ products, facilities, constants, marketFor, matchOrder, isOpenOrder }) {
  const productMap = new Map(products.map((product) => [product.id, product]));
  const groupMap = new Map(MARKET_DEMAND_GROUP_CATALOG.map((group) => [group.id, group]));
  const directProductIds = new Set(MARKET_DEMAND_PRODUCT_IDS);
  const productFor = (productId) => productMap.get(String(productId || '')) || productMap.get('wheat');
  const allRecipes = Object.freeze(facilities.flatMap((facility) => facility.recipes
    .map((recipe) => Object.freeze({
      facilityTypeId: facility.id,
      recipeId: recipe.id,
      category: facility.category,
      operatingCost: recipe.operatingCost,
      cycleMs: recipe.cycleMs,
      inputs: recipe.inputs,
      output: recipe.output,
    }))));
  const recipes = Object.freeze(allRecipes.filter((recipe) => recipe.inputs.length > 0));
  const producingProductIds = new Set(allRecipes.map((recipe) => recipe.output.productId));
  const downstreamProductIds = new Set(allRecipes.flatMap((recipe) => recipe.inputs.map((input) => input.productId)));
  const productRoles = new Map(products.map((product) => [product.id, Object.freeze({
    isDirectDemandProduct: directProductIds.has(product.id),
    hasProducingRecipe: producingProductIds.has(product.id),
    hasDownstreamRecipe: downstreamProductIds.has(product.id),
  })]));
  const recipesByOutput = new Map();
  for (const recipe of recipes) {
    const candidates = recipesByOutput.get(recipe.output.productId) || [];
    candidates.push(recipe);
    recipesByOutput.set(recipe.output.productId, candidates);
  }

  const signals = createMarketSignalRuntime({ marketFor, isOpenOrder });
  const stateRuntime = createMarketDemandStateRuntime({ products, constants, marketFor, isOpenOrder });
  const priceRuntime = createPriceTransmissionRuntime({
    products,
    recipes,
    directProductIds,
    productRoles,
    productFor,
    marketFor,
    realTradeStats: signals.realTradeStats,
    normalizeWorld: stateRuntime.normalizeWorld,
    defaultProductState: stateRuntime.defaultProductState,
  });
  const allocationRuntime = createDemandAllocationRuntime({
    productFor,
    recipesByOutput,
    effectivePrice: signals.effectivePrice,
    orderBookQuote: signals.orderBookQuote,
    realTradeStats: signals.realTradeStats,
  });

  function trimOrderRemaining(order, keepQuantity) {
    const originalRemaining = Math.max(0, Math.floor(Number(order.remaining || 0)));
    const originalQuantity = Math.max(originalRemaining, Math.floor(Number(order.quantity || 0)));
    const filledQuantity = Math.max(0, originalQuantity - originalRemaining);
    const keep = Math.max(0, Math.min(originalRemaining, Math.floor(Number(keepQuantity || 0))));
    order.quantity = filledQuantity + keep;
    order.remaining = keep;
    order.status = keep <= 0 ? (filledQuantity > 0 ? 'filled' : 'cancelled') : (filledQuantity > 0 ? 'partial' : 'open');
    return keep;
  }

  function prepareGroupOrders(world, group, state) {
    const groupOrders = (world.orders || []).filter((order) => (
      order.ownerType === 'population' && order.demandGroupId === group.id
    ));
    const cycleStartedAt = Math.max(0, Number(state.lastCycleStartedAt || 0));
    const soldProducts = new Set(groupOrders
      .filter((order) => Number(order.lastFilledAt || 0) > 0 && Number(order.lastFilledAt) >= cycleStartedAt)
      .map((order) => order.productId));
    const highestRetainedPrice = new Map();

    for (const order of groupOrders) {
      if (!isOpenOrder(order)) continue;
      if (soldProducts.has(order.productId)) {
        trimOrderRemaining(order, 0);
        continue;
      }
      const retained = trimOrderRemaining(
        order,
        Math.floor(Number(order.remaining || 0) * SYSTEM_ORDER_RETENTION_RATE),
      );
      if (retained <= 0) continue;
      highestRetainedPrice.set(
        order.productId,
        Math.max(Number(highestRetainedPrice.get(order.productId) || 0), Number(order.price || 0)),
      );
    }
    return { soldProducts, highestRetainedPrice };
  }

  function issuePriceFor(product, referencePrice, orderContext) {
    const normalPrice = Math.max(1, Math.round(Number(referencePrice || product.basePrice)));
    if (orderContext.soldProducts.has(product.id)) return normalPrice;
    const highestRetained = Number(orderContext.highestRetainedPrice.get(product.id) || 0);
    if (highestRetained <= 0) return normalPrice;
    const priceCap = Math.max(1, Math.floor(product.basePrice * PRICE_MAX_MULTIPLIER));
    return Math.min(priceCap, Math.max(normalPrice, Math.ceil(highestRetained * (1 + SYSTEM_ORDER_PRICE_STEP))));
  }

  function groupOpenOrderValue(world, groupId, predicate = () => true) {
    return (world.orders || []).filter((order) => (
      order.ownerType === 'population'
      && order.demandGroupId === groupId
      && isOpenOrder(order)
      && predicate(order)
    )).reduce((sum, order) => sum + Number(order.price || 0) * Number(order.remaining || 0), 0);
  }

  function enforceGroupOrderValueCap(world, group, cycleBudget) {
    const cap = Math.max(0, Math.floor(cycleBudget * SYSTEM_ORDER_VALUE_CYCLES));
    const orders = (world.orders || []).filter((order) => (
      order.ownerType === 'population' && order.demandGroupId === group.id && isOpenOrder(order)
    ));
    let total = orders.reduce((sum, order) => sum + Number(order.price || 0) * Number(order.remaining || 0), 0);
    if (total <= cap) return total;
    orders.sort((left, right) => (
      Number(left.price || 0) - Number(right.price || 0)
      || Number(left.createdAt || 0) - Number(right.createdAt || 0)
    ));
    for (const order of orders) {
      if (total <= cap) break;
      const price = Math.max(1, Number(order.price || 1));
      const removeQuantity = Math.min(
        Number(order.remaining || 0),
        Math.ceil((total - cap) / price),
      );
      trimOrderRemaining(order, Number(order.remaining || 0) - removeQuantity);
      total -= removeQuantity * price;
    }
    return Math.max(0, total);
  }

  function createOrder(world, group, role, product, price, quantity, cycleId, now) {
    if (quantity < 1) return { filled: 0, order: null };
    const order = {
      id: `market-demand-order-${randomUUID()}`,
      assetKind: 'commodity',
      assetId: product.id,
      productId: product.id,
      side: 'buy',
      ownerType: 'population',
      ownerName: group.ownerName,
      demandGroupId: group.id,
      demandTier: role,
      demandCycleId: cycleId,
      price,
      quantity,
      remaining: quantity,
      status: 'open',
      createdAt: now,
    };
    world.orders.push(order);
    matchOrder(world, order, now);
    return { filled: quantity - order.remaining, order };
  }

  function applyChoices(world, group, role, cycleId, now, budgets, details, orderContext, totals, allocations) {
    for (const [productId, budget] of budgets) {
      const detail = details.get(productId);
      if (!detail || budget <= 0) continue;
      const product = detail.product;
      const referencePrice = Math.max(1, Math.round(Number(detail.price.referencePrice || product.basePrice)));
      const orderPrice = issuePriceFor(product, referencePrice, orderContext);
      const quantity = Math.max(0, Math.floor(budget / orderPrice));
      const committed = quantity * orderPrice;
      const { filled } = createOrder(world, group, role, product, orderPrice, quantity, cycleId, now);
      totals.currentDemandQuantities[productId] = (totals.currentDemandQuantities[productId] || 0) + quantity;
      if (role === 'direct') {
        totals.directCommitted += committed;
        const utility = Math.max(1, Number(detail.option?.utilityPerUnit || 1));
        totals.directRequestedUtility += quantity * utility;
        totals.directFilledUtility += filled * utility;
      } else {
        totals.derivedCommitted += committed;
      }
      const existing = allocations[productId] || {
        directBudget: 0, derivedBudget: 0, directQuantity: 0, derivedQuantity: 0, filled: 0,
      };
      existing[role === 'direct' ? 'directBudget' : 'derivedBudget'] += committed;
      existing[role === 'direct' ? 'directQuantity' : 'derivedQuantity'] += quantity;
      existing.filled += filled;
      existing.referencePrice = round4(detail.price.referencePrice);
      existing.orderPrice = orderPrice;
      existing.effectivePrice = round4(detail.price.effective);
      existing.quote = round4(detail.price.quote);
      existing.coverage = round4(detail.price.coverage);
      if (detail.requiredQuantity !== undefined) existing.requiredQuantity = round4(detail.requiredQuantity);
      allocations[productId] = existing;
      const market = marketFor(world, productId, now);
      market.demand.lastPrice = orderPrice;
      market.demand.lastQuantity = quantity;
      market.demand.lastBudget = committed;
      market.demand.nextDemandAt = (cycleId + 1) * group.cycleMs;
      market.demand.satisfaction = quantity === 0 ? 0 : filled / quantity;
    }
  }

  function processGroup(world, groupId, now) {
    const group = groupMap.get(groupId);
    if (!group) return false;
    stateRuntime.normalizeWorld(world, now);
    const state = world.marketDemand.groups[group.id];
    const cycleId = Math.floor(now / group.cycleMs);
    if (Number(state.lastCycleId) === cycleId) {
      state.nextDemandAt = (cycleId + 1) * group.cycleMs;
      return false;
    }

    const orderContext = prepareGroupOrders(world, group, state);
    const budgetState = allocationRuntime.dynamicBudget(world, group, state, now);
    const cycleBudget = budgetState.budget;
    const directBudget = Math.floor(cycleBudget * group.directBudgetShare);
    const derivedBudget = cycleBudget - directBudget;
    const direct = allocationRuntime.directDemandChoices(world, group, state, directBudget, now);
    const derived = allocationRuntime.derivedDemandChoices(world, state, derivedBudget, now);
    const allocations = {};
    const totals = {
      currentDemandQuantities: {},
      directCommitted: 0,
      derivedCommitted: 0,
      directRequestedUtility: 0,
      directFilledUtility: 0,
    };
    applyChoices(world, group, 'direct', cycleId, now, direct.productBudgets, direct.productDetails, orderContext, totals, allocations);
    applyChoices(world, group, 'derived-liquidity', cycleId, now, derived.productBudgets, derived.productDetails, orderContext, totals, allocations);
    const openOrderValue = enforceGroupOrderValueCap(world, group, cycleBudget);

    const satisfaction = totals.directRequestedUtility <= 0 ? 0 : totals.directFilledUtility / totals.directRequestedUtility;
    state.satisfaction = satisfaction;
    state.satisfactionEma = clamp(0, 1, state.satisfactionEma * 0.70 + satisfaction * 0.30);
    state.lastCycleId = cycleId;
    state.nextDemandAt = (cycleId + 1) * group.cycleMs;
    state.lastBudget = cycleBudget;
    state.lastTargetBudget = budgetState.targetBudget;
    state.lastPlayerScaleBudget = budgetState.playerScaleBudget;
    state.lastActivePlayerCount = budgetState.activePlayers;
    state.lastTradeActivityFactor = round4(budgetState.tradeActivityFactor);
    state.lastNeedPressure = round4(budgetState.needPressure);
    state.lastCommitted = totals.directCommitted + totals.derivedCommitted;
    state.directCommitted = totals.directCommitted;
    state.derivedCommitted = totals.derivedCommitted;
    state.lastRetainedOrderValue = groupOpenOrderValue(
      world,
      group.id,
      (order) => Number(order.demandCycleId) !== cycleId,
    );
    state.lastOpenOrderValue = openOrderValue;
    state.lastCycleStartedAt = now;
    state.lastClassAllocation = direct.classAllocation;
    state.lastAllocation = allocations;
    state.lastDerivedRelations = derived.relationDetails;
    state.previousDemandQuantities = totals.currentDemandQuantities;
    state.lastInventoryBoost = 0;
    state.lastStockValue = 0;

    for (const [productId, allocation] of Object.entries(allocations)) {
      const requested = allocation.directQuantity + allocation.derivedQuantity;
      const fillRatio = requested <= 0 ? 1 : allocation.filled / requested;
      const tradeStats = signals.realTradeStats(world, productId, now);
      const activeImbalance = tradeStats.quantity <= 0 ? 0 : tradeStats.netActive / tradeStats.quantity;
      const pressure = clamp(0.75, 1.5, 1 + 0.30 * (1 - fillRatio) + 0.10 * activeImbalance);
      world.marketDemand.productPressure[productId] = Math.max(
        Number(world.marketDemand.productPressure[productId] || 1),
        pressure,
      );
    }
    return true;
  }

  function process(world, now = Date.now()) {
    stateRuntime.normalizeWorld(world, now);
    priceRuntime.processPriceTransmission(world, now);
    for (const group of MARKET_DEMAND_GROUP_CATALOG) {
      if (now >= Number(world.marketDemand.groups[group.id].nextDemandAt)) processGroup(world, group.id, now);
    }
    return world;
  }

  function isValidMarketOrder(order) {
    if (order?.ownerType !== 'population') return false;
    const group = groupMap.get(String(order.demandGroupId || ''));
    if (!group || order.ownerName !== group.ownerName) return false;
    if (!['direct', 'derived-liquidity'].includes(order.demandTier)) return false;
    return productMap.has(String(order.productId || ''));
  }

  return {
    initializeWorld: stateRuntime.initializeWorld,
    normalizeWorld: stateRuntime.normalizeWorld,
    process,
    processGroup,
    processPriceTransmission: priceRuntime.processPriceTransmission,
    isValidMarketOrder,
    directProductIds,
    productRoles,
    recipes,
  };
}
