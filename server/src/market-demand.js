import { randomUUID } from 'node:crypto';
import { createMarketLiquidityRuntime } from './market-liquidity.js';
import {
  DEMAND_CURVE,
  DEMAND_CURVE_SHORTAGE_MULTIPLIER,
  DIRECT_DEMAND_BELOW_REFERENCE_RECOVERY_RATE,
  DIRECT_DEMAND_MIN_PRICE,
  DIRECT_DEMAND_OVERSUPPLY_DELAY_SCORE,
  DIRECT_DEMAND_OVERSUPPLY_ENTRY_CYCLES,
  DIRECT_DEMAND_OVERSUPPLY_FILL_RATIO,
  DIRECT_DEMAND_OVERSUPPLY_PRICE_STEP,
  DIRECT_DEMAND_PRICE_RECOVERY_RATE,
  DIRECT_DEMAND_UNFILLED_PRICE_STEP,
  DIRECT_DEMAND_UNFILLED_REFERENCE_GAP_RATE,
  DIRECT_DEMAND_UNFILLED_REFERENCE_MAX_RATE,
  DERIVED_BACKLOG_WEIGHT,
  DERIVED_UNMET_WEIGHT,
  MARKET_DEMAND_GROUP_CATALOG,
  MARKET_DEMAND_MODEL_VERSION,
  MARKET_DEMAND_PRODUCT_IDS,
  PRICE_MAX_MULTIPLIER,
  PRODUCT_ORDER_VALUE_CYCLES,
  PRODUCT_PRESSURE_MAX,
  PRODUCT_PRESSURE_MIN,
  PRODUCT_PRESSURE_ACTIVE_IMBALANCE_WEIGHT,
  PRODUCT_PRESSURE_SUPPLY_RELIEF_WEIGHT,
  PRODUCT_PRESSURE_EVIDENCE_TARGET,
  PRODUCT_PRESSURE_SMOOTHING,
  SYSTEM_ORDER_MAX_AGE_CYCLES,
  SYSTEM_ORDER_RETENTION_RATE,
  SYSTEM_ORDER_VALUE_CYCLES,
} from './market-demand/catalog.js';
import { createDemandAllocationRuntime } from './market-demand/allocation.js';
import { clamp, round4 } from './market-demand/math.js';
import { createPriceTransmissionRuntime } from './market-demand/price-transmission.js';
import { createMarketSignalRuntime } from './market-demand/signals.js';
import { createMarketDemandStateRuntime } from './market-demand/state.js';
import {
  POPULATION_MODEL_IDS,
  POPULATION_STABILIZATION_DIRECT_SHARE,
  populationClassShares,
  preparePopulationDemandCycle,
  releasePopulationOrderFunds,
  reservePopulationOrder,
} from './population-economy.js';

export { MARKET_DEMAND_GROUP_CATALOG, MARKET_DEMAND_MODEL_VERSION, MARKET_DEMAND_PRODUCT_IDS } from './market-demand/catalog.js';

const CONSUMPTION_TIERS = new Set(['direct', 'derived-liquidity']);
const LIQUIDITY_TIERS = new Set(['liquidity-buy', 'liquidity-sell']);
const FUNDING_POOL_BY_ROLE = Object.freeze({ direct: 'direct', 'derived-liquidity': 'derived' });

export function createMarketDemandRuntime({ products, facilities, constants, marketFor, matchOrder, isOpenOrder }) {
  const productMap = new Map(products.map((product) => [product.id, product]));
  const groupMap = new Map(MARKET_DEMAND_GROUP_CATALOG.map((group) => [group.id, group]));
  const totalPopulationBaseBudget = MARKET_DEMAND_GROUP_CATALOG.reduce((sum, group) => sum + Number(group.baseBudget || 0), 0);
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
  const groupUtility = new Map(MARKET_DEMAND_GROUP_CATALOG.map((group) => [group.id, new Map()]));
  for (const group of MARKET_DEMAND_GROUP_CATALOG) {
    const utilities = groupUtility.get(group.id);
    for (const demandClass of group.classes) {
      for (const option of demandClass.products) {
        utilities.set(option.productId, Math.max(Number(utilities.get(option.productId) || 0), Number(option.utilityPerUnit || 1)));
      }
    }
  }

  const signals = createMarketSignalRuntime({ marketFor, isOpenOrder });
  const stateRuntime = createMarketDemandStateRuntime({ products, constants, marketFor, isOpenOrder });
  const allocationRuntime = createDemandAllocationRuntime({
    productFor,
    recipesByOutput,
    effectivePrice: signals.effectivePrice,
    orderBookQuote: signals.orderBookQuote,
    realTradeStats: signals.realTradeStats,
  });
  const liquidityRuntime = createMarketLiquidityRuntime({
    products,
    groups: MARKET_DEMAND_GROUP_CATALOG,
    marketFor,
    matchOrder,
    isOpenOrder,
    realTradeStats: signals.realTradeStats,
  });

  function normalizeWorld(world, now = Date.now(), options = {}) {
    const previousVersion = Number(world.marketDemand?.modelVersion || 0);
    stateRuntime.normalizeWorld(world, now, options);
    liquidityRuntime.normalizeWorld(world, {
      seed: Boolean(options.forceRebuild) || previousVersion < MARKET_DEMAND_MODEL_VERSION,
    });
    return world;
  }

  function initializeWorld(world, now = Date.now()) {
    stateRuntime.initializeWorld(world, now);
    liquidityRuntime.normalizeWorld(world, { seed: true });
    return world;
  }

  const priceRuntime = createPriceTransmissionRuntime({
    products,
    recipes,
    directProductIds,
    productRoles,
    productFor,
    marketFor,
    realTradeStats: signals.realTradeStats,
    normalizeWorld,
    defaultProductState: stateRuntime.defaultProductState,
  });

  function isConsumptionOrder(order, groupId) {
    return order?.ownerType === 'population'
      && order?.demandGroupId === groupId
      && CONSUMPTION_TIERS.has(order?.demandTier);
  }

  function trimOrderRemaining(world, order, keepQuantity) {
    const originalRemaining = Math.max(0, Math.floor(Number(order.remaining || 0)));
    const originalQuantity = Math.max(originalRemaining, Math.floor(Number(order.quantity || 0)));
    const filledQuantity = Math.max(0, originalQuantity - originalRemaining);
    const keep = Math.max(0, Math.min(originalRemaining, Math.floor(Number(keepQuantity || 0))));
    const removed = originalRemaining - keep;
    if (removed > 0) releasePopulationOrderFunds(world, order, removed);
    order.quantity = filledQuantity + keep;
    order.remaining = keep;
    order.status = keep <= 0 ? (filledQuantity > 0 ? 'filled' : 'cancelled') : (filledQuantity > 0 ? 'partial' : 'open');
    return keep;
  }

  function settlePreviousCycle(world, group, state, now) {
    const previousCycleId = Number(state.lastCycleId);
    const cycleOrders = (world.orders || []).filter((order) => (
      isConsumptionOrder(order, group.id) && Number(order.demandCycleId) === previousCycleId
    ));
    if (cycleOrders.length === 0) {
      return {
        hasOrders: false,
        satisfaction: Number(state.satisfaction || group.targetSatisfaction),
        products: {},
        classService: state.lastClassService || {},
        effectiveDemandQuantities: state.previousDemandQuantities || {},
      };
    }

    const productStats = {};
    let directRequestedUtility = 0;
    let directFilledUtility = 0;
    let delayWeightedUtility = 0;
    let directOpenValue = 0;
    const utilities = groupUtility.get(group.id);

    for (const order of cycleOrders) {
      const quantity = Math.max(0, Math.floor(Number(order.quantity || 0)));
      const remaining = Math.max(0, Math.min(quantity, Math.floor(Number(order.remaining || 0))));
      const filled = Math.max(0, quantity - remaining);
      const productId = String(order.productId || '');
      const stats = productStats[productId] || {
        requested: 0,
        filled: 0,
        unmet: 0,
        backlog: 0,
        openValue: 0,
        fillValue: 0,
        delayWeight: 0,
        delayScoreTotal: 0,
        directRequested: 0,
        directFilled: 0,
        directDelayWeight: 0,
        directDelayScoreTotal: 0,
      };
      stats.requested += quantity;
      stats.filled += filled;
      stats.unmet += remaining;
      stats.openValue += remaining * Number(order.price || 0);
      stats.fillValue += filled * Number(order.price || 0);
      if (filled > 0) {
        const delay = Math.max(0, Number(order.lastFilledAt || order.createdAt || now) - Number(order.createdAt || now));
        const delayScore = Math.exp(-delay / Math.max(1, group.cycleMs));
        stats.delayWeight += filled;
        stats.delayScoreTotal += filled * delayScore;
      }
      productStats[productId] = stats;
      if (order.demandTier === 'direct') {
        stats.directRequested += quantity;
        stats.directFilled += filled;
        if (filled > 0) {
          const directDelay = Math.max(0, Number(order.lastFilledAt || order.createdAt || now) - Number(order.createdAt || now));
          const directDelayScore = Math.exp(-directDelay / Math.max(1, group.cycleMs));
          stats.directDelayWeight += filled;
          stats.directDelayScoreTotal += filled * directDelayScore;
        }
        const utility = Math.max(1, Number(utilities.get(productId) || 1));
        directRequestedUtility += quantity * utility;
        directFilledUtility += filled * utility;
        directOpenValue += remaining * Number(order.price || 0);
        if (filled > 0) {
          const delay = Math.max(0, Number(order.lastFilledAt || order.createdAt || now) - Number(order.createdAt || now));
          delayWeightedUtility += filled * utility * Math.exp(-delay / Math.max(1, group.cycleMs));
        }
      }
    }

    for (const order of world.orders || []) {
      if (!isConsumptionOrder(order, group.id) || !isOpenOrder(order)) continue;
      if (Number(order.demandCycleId) >= previousCycleId) continue;
      const productId = String(order.productId || '');
      const stats = productStats[productId] || {
        requested: 0,
        filled: 0,
        unmet: 0,
        backlog: 0,
        openValue: 0,
        fillValue: 0,
        delayWeight: 0,
        delayScoreTotal: 0,
        directRequested: 0,
        directFilled: 0,
        directDelayWeight: 0,
        directDelayScoreTotal: 0,
      };
      stats.backlog += Math.max(0, Number(order.remaining || 0));
      productStats[productId] = stats;
    }

    const fillRatio = directRequestedUtility <= 0 ? 1 : directFilledUtility / directRequestedUtility;
    const delayScore = directFilledUtility <= 0 ? 0 : delayWeightedUtility / directFilledUtility;
    const backlogScore = 1 - clamp(0, 1, directOpenValue / Math.max(1, Number(state.lastBudget || group.baseBudget) * 2));
    const satisfaction = clamp(0, 1, 0.65 * fillRatio + 0.20 * delayScore + 0.15 * backlogScore);
    const effectiveDemandQuantities = {};
    const productService = {};

    for (const [productId, stats] of Object.entries(productStats)) {
      const productFillRatio = stats.requested <= 0 ? 1 : stats.filled / stats.requested;
      const productDelayScore = stats.delayWeight <= 0 ? 0 : stats.delayScoreTotal / stats.delayWeight;
      const productBacklogScore = 1 - clamp(0, 1, stats.openValue / Math.max(1, stats.fillValue + stats.openValue));
      const service = clamp(0, 1, 0.65 * productFillRatio + 0.20 * productDelayScore + 0.15 * productBacklogScore);
      productService[productId] = service;
      effectiveDemandQuantities[productId] = round4(
        stats.filled + DERIVED_UNMET_WEIGHT * stats.unmet + DERIVED_BACKLOG_WEIGHT * stats.backlog,
      );
      Object.assign(stats, {
        fillRatio: round4(productFillRatio),
        directFillRatio: stats.directRequested <= 0 ? null : round4(stats.directFilled / stats.directRequested),
        directDelayScore: stats.directDelayWeight <= 0 ? 0 : round4(stats.directDelayScoreTotal / stats.directDelayWeight),
        delayScore: round4(productDelayScore),
        service: round4(service),
      });
    }

    const classService = {};
    for (const demandClass of group.classes) {
      let weighted = 0;
      let totalWeight = 0;
      for (const option of demandClass.products) {
        const service = Number(productService[option.productId] ?? satisfaction);
        weighted += service * Number(option.baseWeight || 1);
        totalWeight += Number(option.baseWeight || 1);
      }
      classService[demandClass.id] = round4(totalWeight <= 0 ? satisfaction : weighted / totalWeight);
    }

    return {
      hasOrders: true,
      satisfaction,
      fillRatio: round4(fillRatio),
      delayScore: round4(delayScore),
      backlogScore: round4(backlogScore),
      requestedUtility: round4(directRequestedUtility),
      filledUtility: round4(directFilledUtility),
      products: productStats,
      productService,
      classService,
      effectiveDemandQuantities,
    };
  }

  function updateDirectQuoteAnchors(world, group, state, settlement) {
    state.directQuoteAnchors ||= {};
    state.directOversupplyCycles ||= {};
    const productIds = new Set(group.classes.flatMap((demandClass) => (
      demandClass.products.map((option) => option.productId)
    )));
    for (const productId of productIds) {
      const product = productFor(productId);
      const referencePrice = Math.max(DIRECT_DEMAND_MIN_PRICE, Number(
        world.marketDemand.priceTransmission.products[productId]?.referencePrice || product.basePrice,
      ));
      const maximum = Math.max(DIRECT_DEMAND_MIN_PRICE, product.basePrice * PRICE_MAX_MULTIPLIER);
      const stored = Number(state.directQuoteAnchors[productId]);
      const previous = clamp(
        DIRECT_DEMAND_MIN_PRICE,
        maximum,
        Number.isFinite(stored) && stored > 0 ? stored : referencePrice,
      );
      const stats = settlement.products?.[productId];
      const requested = Math.max(0, Number(stats?.directRequested || 0));
      const filled = Math.max(0, Number(stats?.directFilled || 0));
      const fillRatio = requested <= 0 ? null : clamp(0, 1, filled / requested);
      const directDelayScore = Math.max(0, Number(stats?.directDelayScore || 0));
      let oversupplyCycles = Math.max(0, Math.floor(Number(state.directOversupplyCycles[productId] || 0)));
      let next = previous;

      if (requested > 0 && filled <= 0) {
        const referenceGap = Math.max(0, referencePrice - previous);
        const increase = Math.max(
          previous * (DIRECT_DEMAND_UNFILLED_PRICE_STEP - 1),
          Math.min(
            referenceGap * DIRECT_DEMAND_UNFILLED_REFERENCE_GAP_RATE,
            referencePrice * DIRECT_DEMAND_UNFILLED_REFERENCE_MAX_RATE,
          ),
        );
        next = previous + increase;
        oversupplyCycles = 0;
      } else if (requested > 0 && fillRatio < group.targetSatisfaction) {
        next = previous < referencePrice
          ? previous + (referencePrice - previous) * DIRECT_DEMAND_BELOW_REFERENCE_RECOVERY_RATE
          : previous;
        oversupplyCycles = 0;
      } else if (
        requested > 0
        && fillRatio >= DIRECT_DEMAND_OVERSUPPLY_FILL_RATIO
        && directDelayScore >= DIRECT_DEMAND_OVERSUPPLY_DELAY_SCORE
      ) {
        oversupplyCycles += 1;
        next = oversupplyCycles >= DIRECT_DEMAND_OVERSUPPLY_ENTRY_CYCLES
          ? previous * DIRECT_DEMAND_OVERSUPPLY_PRICE_STEP
          : previous + (referencePrice - previous) * DIRECT_DEMAND_PRICE_RECOVERY_RATE;
      } else {
        next = previous + (referencePrice - previous) * DIRECT_DEMAND_PRICE_RECOVERY_RATE;
        oversupplyCycles = 0;
      }

      state.directQuoteAnchors[productId] = round4(clamp(
        DIRECT_DEMAND_MIN_PRICE,
        maximum,
        next,
      ));
      state.directOversupplyCycles[productId] = oversupplyCycles;
    }
  }

  function prepareGroupOrders(world, group, state, cycleId) {
    const groupOrders = (world.orders || []).filter((order) => isConsumptionOrder(order, group.id));
    const cycleStartedAt = Math.max(0, Number(state.lastCycleStartedAt || 0));
    const soldProducts = new Set(groupOrders
      .filter((order) => Number(order.lastFilledAt || 0) > 0 && Number(order.lastFilledAt) >= cycleStartedAt)
      .map((order) => order.productId));

    for (const order of groupOrders) {
      if (!isOpenOrder(order)) continue;
      const age = cycleId - Number(order.demandCycleId || cycleId);
      if (age >= SYSTEM_ORDER_MAX_AGE_CYCLES || soldProducts.has(order.productId)) {
        trimOrderRemaining(world, order, 0);
        continue;
      }
      trimOrderRemaining(world, order, Math.floor(Number(order.remaining || 0) * SYSTEM_ORDER_RETENTION_RATE));
    }
    return { soldProducts };
  }

  function groupOpenOrderValue(world, groupId, predicate = () => true) {
    return (world.orders || []).filter((order) => (
      isConsumptionOrder(order, groupId)
      && isOpenOrder(order)
      && predicate(order)
    )).reduce((sum, order) => sum + Number(order.price || 0) * Number(order.remaining || 0), 0);
  }

  function trimOrdersToValue(world, orders, cap) {
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
      trimOrderRemaining(world, order, Number(order.remaining || 0) - removeQuantity);
      total -= removeQuantity * price;
    }
    return Math.max(0, total);
  }

  function enforceOrderValueCaps(world, group, cycleBudget, allocations) {
    for (const [productId, allocation] of Object.entries(allocations)) {
      const productCap = Math.max(0, Math.floor(
        (Number(allocation.directBudget || 0) + Number(allocation.derivedBudget || 0)) * PRODUCT_ORDER_VALUE_CYCLES,
      ));
      trimOrdersToValue(world, (world.orders || []).filter((order) => (
        isConsumptionOrder(order, group.id) && order.productId === productId && isOpenOrder(order)
      )), productCap);
    }
    const cap = Math.max(0, Math.floor(cycleBudget * SYSTEM_ORDER_VALUE_CYCLES));
    const orders = (world.orders || []).filter((order) => isConsumptionOrder(order, group.id) && isOpenOrder(order));
    return trimOrdersToValue(world, orders, cap);
  }

  function createOrder(world, group, role, product, price, quantity, cycleId, now, populationModelId) {
    if (quantity < 1) return { filled: 0, order: null, committed: 0 };
    const committed = price * quantity;
    if (!reservePopulationOrder(world, populationModelId, committed)) {
      return { filled: 0, order: null, committed: 0 };
    }
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
      populationModelId,
      fundingPool: FUNDING_POOL_BY_ROLE[role],
      price,
      quantity,
      remaining: quantity,
      status: 'open',
      createdAt: now,
    };
    world.orders.push(order);
    matchOrder(world, order, now);
    return { filled: quantity - order.remaining, order, committed };
  }

  function priceCurveFor(product, referencePrice, pressure, role, directQuoteAnchor = referencePrice) {
    const cap = Math.max(DIRECT_DEMAND_MIN_PRICE, Math.floor(product.basePrice * PRICE_MAX_MULTIPLIER));
    const shortageMultiplier = pressure >= 1.15 ? DEMAND_CURVE_SHORTAGE_MULTIPLIER : 1;
    const directBase = role === 'direct'
      ? (pressure >= 1.15 ? Math.max(directQuoteAnchor, referencePrice * shortageMultiplier) : directQuoteAnchor)
      : referencePrice;
    return DEMAND_CURVE.map((tier, index) => {
      const targetPrice = role === 'direct'
        ? directBase * tier.multiplier
        : referencePrice * tier.multiplier * (index === 0 ? shortageMultiplier : 1);
      return {
        weight: tier.weight,
        price: Math.min(cap, Math.max(DIRECT_DEMAND_MIN_PRICE, Math.round(targetPrice))),
      };
    });
  }

  function applyChoices(world, group, role, cycleId, now, budgets, details, totals, allocations, populationModelId) {
    for (const [productId, budget] of budgets) {
      const detail = details.get(productId);
      if (!detail || budget <= 0) continue;
      const product = detail.product;
      const referencePrice = Math.max(1, Math.round(Number(detail.price.referencePrice || product.basePrice)));
      const pressure = Number(world.marketDemand.productPressure[productId] || 1);
      const directQuoteAnchor = role === 'direct'
        ? Number(world.marketDemand.groups[group.id]?.directQuoteAnchors?.[productId] || referencePrice)
        : referencePrice;
      const curve = priceCurveFor(product, referencePrice, pressure, role, directQuoteAnchor);
      const budgetByPrice = new Map();
      let assignedBudget = 0;
      curve.forEach((tier, index) => {
        const tierBudget = index === curve.length - 1
          ? Math.max(0, Math.floor(budget) - assignedBudget)
          : Math.max(0, Math.floor(budget * tier.weight));
        assignedBudget += tierBudget;
        budgetByPrice.set(tier.price, (budgetByPrice.get(tier.price) || 0) + tierBudget);
      });

      let totalQuantity = 0;
      let committed = 0;
      let filled = 0;
      let topPrice = 0;
      for (const [price, tierBudget] of [...budgetByPrice.entries()].sort((left, right) => right[0] - left[0])) {
        const quantity = Math.max(0, Math.floor(tierBudget / price));
        if (quantity <= 0) continue;
        const result = createOrder(world, group, role, product, price, quantity, cycleId, now, populationModelId);
        if (!result.order) continue;
        totalQuantity += quantity;
        committed += result.committed;
        filled += result.filled;
        topPrice = Math.max(topPrice, price);
      }
      totals.currentDemandQuantities[productId] = (totals.currentDemandQuantities[productId] || 0) + totalQuantity;
      if (role === 'direct') totals.directCommitted += committed;
      else totals.derivedCommitted += committed;
      const existing = allocations[productId] || {
        directBudget: 0, derivedBudget: 0, directQuantity: 0, derivedQuantity: 0, filled: 0,
      };
      existing[role === 'direct' ? 'directBudget' : 'derivedBudget'] += committed;
      existing[role === 'direct' ? 'directQuantity' : 'derivedQuantity'] += totalQuantity;
      existing.filled += filled;
      existing.referencePrice = round4(detail.price.referencePrice);
      existing.orderPrice = topPrice || referencePrice;
      existing.effectivePrice = round4(detail.price.effective);
      existing.quote = round4(detail.price.quote);
      existing.coverage = round4(detail.price.coverage);
      if (detail.requiredQuantity !== undefined) existing.requiredQuantity = round4(detail.requiredQuantity);
      allocations[productId] = existing;
      const market = marketFor(world, productId, now);
      market.demand.lastPrice = topPrice || referencePrice;
      market.demand.lastQuantity = totalQuantity;
      market.demand.lastBudget = committed;
      market.demand.nextDemandAt = (cycleId + 1) * group.cycleMs;
    }
  }

  function updateProductPressure(world, group, settlement, allocations, now) {
    const productIds = new Set([
      ...Object.keys(settlement.products || {}),
      ...Object.keys(allocations || {}),
    ]);
    for (const productId of productIds) {
      const product = productFor(productId);
      const settled = settlement.products?.[productId];
      const requested = Math.max(1, Number(settled?.requested || allocations?.[productId]?.directQuantity || 1));
      const fillRatio = settled ? Number(settled.fillRatio || 0) : group.targetSatisfaction;
      const priceState = world.marketDemand.priceTransmission.products[productId];
      const quote = signals.orderBookQuote(
        world,
        product,
        requested,
        Number(priceState?.referencePrice || product.basePrice),
      );
      const tradeStats = signals.realTradeStats(world, productId, now);
      const activeImbalance = tradeStats.playerQuantity <= 0 ? 0 : tradeStats.playerNetActive / tradeStats.playerQuantity;
      const supplyRelief = Math.max(0, quote.coverage - 0.75);
      const evidenceQuantity = Math.max(0, Number(tradeStats.playerQuantity || 0) + Number(tradeStats.consumptionQuantity || 0));
      const evidenceConfidence = clamp(0, 1, evidenceQuantity / Math.max(PRODUCT_PRESSURE_EVIDENCE_TARGET, requested));
      const target = clamp(
        PRODUCT_PRESSURE_MIN,
        PRODUCT_PRESSURE_MAX,
        1 + 0.55 * (group.targetSatisfaction - fillRatio)
          + evidenceConfidence * (
            PRODUCT_PRESSURE_ACTIVE_IMBALANCE_WEIGHT * activeImbalance
            - PRODUCT_PRESSURE_SUPPLY_RELIEF_WEIGHT * supplyRelief
          ),
      );
      const previous = Number(world.marketDemand.productPressure[productId] || 1);
      world.marketDemand.productPressure[productId] = round4(
        previous * (1 - PRODUCT_PRESSURE_SMOOTHING) + target * PRODUCT_PRESSURE_SMOOTHING,
      );
      marketFor(world, productId, now).demand.satisfaction = Number(settlement.productService?.[productId] ?? settlement.satisfaction);
    }
  }

  function allocationStateForModel(state, modelId) {
    state.populationAllocationState ||= {};
    state.populationAllocationState[modelId] ||= {
      lastClassShares: {},
      lastProductShares: {},
    };
    return {
      ...state,
      lastClassShares: state.populationAllocationState[modelId].lastClassShares,
      lastProductShares: state.populationAllocationState[modelId].lastProductShares,
    };
  }

  function persistAllocationState(state, modelId, modelState) {
    state.populationAllocationState ||= {};
    state.populationAllocationState[modelId] = {
      lastClassShares: modelState.lastClassShares || {},
      lastProductShares: modelState.lastProductShares || {},
    };
  }

  function processGroup(world, groupId, now) {
    const group = groupMap.get(groupId);
    if (!group) return false;
    normalizeWorld(world, now);
    const state = world.marketDemand.groups[group.id];
    const cycleId = Math.floor(now / group.cycleMs);
    if (Number(state.lastCycleId) === cycleId) {
      state.nextDemandAt = (cycleId + 1) * group.cycleMs;
      return false;
    }

    const settlement = settlePreviousCycle(world, group, state, now);
    if (settlement.hasOrders) {
      state.satisfaction = settlement.satisfaction;
      state.satisfactionEma = clamp(0, 1, state.satisfactionEma * 0.70 + settlement.satisfaction * 0.30);
      state.lastCycleSettlement = settlement;
      state.lastProductService = settlement.productService;
      state.lastClassService = settlement.classService;
      state.previousDemandQuantities = settlement.effectiveDemandQuantities;
    }

    updateDirectQuoteAnchors(world, group, state, settlement);
    prepareGroupOrders(world, group, state, cycleId);
    const populationCycle = preparePopulationDemandCycle(world, cycleId, now, { totalBaseBudget: totalPopulationBaseBudget });
    const allocations = {};
    const totals = {
      currentDemandQuantities: {},
      directCommitted: 0,
      derivedCommitted: 0,
    };
    const classAllocationByModel = {};
    const derivedRelations = [];
    let cycleBudget = 0;

    for (const modelId of POPULATION_MODEL_IDS) {
      const modelBudget = Math.max(0, Math.floor(Number(populationCycle.groups?.[group.id]?.[modelId] || 0)));
      if (modelBudget <= 0) continue;
      cycleBudget += modelBudget;
      const stabilizationBudget = Math.max(0, Math.floor(Number(populationCycle.baseGroups?.[group.id]?.[modelId] || 0)));
      const employmentBudget = Math.max(0, modelBudget - stabilizationBudget);
      const directBudget = Math.min(modelBudget,
        Math.floor(stabilizationBudget * POPULATION_STABILIZATION_DIRECT_SHARE)
          + Math.floor(employmentBudget * group.directBudgetShare));
      const derivedBudget = modelBudget - directBudget;
      const modelState = allocationStateForModel(state, modelId);
      const direct = allocationRuntime.directDemandChoices(world, group, modelState, directBudget, now, {
        classShares: populationClassShares(world, modelId, group.id),
      });
      persistAllocationState(state, modelId, modelState);
      const derived = allocationRuntime.derivedDemandChoices(world, state, derivedBudget, now);
      classAllocationByModel[modelId] = direct.classAllocation;
      derivedRelations.push(...derived.relationDetails.map((relation) => ({ ...relation, populationModelId: modelId })));
      applyChoices(
        world,
        group,
        'direct',
        cycleId,
        now,
        direct.productBudgets,
        direct.productDetails,
        totals,
        allocations,
        modelId,
      );
      applyChoices(
        world,
        group,
        'derived-liquidity',
        cycleId,
        now,
        derived.productBudgets,
        derived.productDetails,
        totals,
        allocations,
        modelId,
      );
    }

    const openOrderValue = enforceOrderValueCaps(world, group, cycleBudget, allocations);
    updateProductPressure(world, group, settlement, allocations, now);

    state.lastCycleId = cycleId;
    state.nextDemandAt = (cycleId + 1) * group.cycleMs;
    state.lastBudget = cycleBudget;
    state.lastTargetBudget = cycleBudget;
    state.lastPlayerScaleBudget = 0;
    state.lastActivePlayerCount = 0;
    state.lastTradeActivityFactor = 1;
    state.lastNeedPressure = 1;
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
    state.lastClassAllocation = classAllocationByModel;
    state.lastAllocation = allocations;
    state.lastDerivedRelations = derivedRelations;
    state.lastInventoryBoost = 0;
    state.lastStockValue = 0;

    liquidityRuntime.processGroup(world, group, state, cycleId, now);
    return true;
  }

  function process(world, now = Date.now()) {
    normalizeWorld(world, now);
    priceRuntime.processPriceTransmission(world, now);
    for (const group of MARKET_DEMAND_GROUP_CATALOG) {
      if (now >= Number(world.marketDemand.groups[group.id].nextDemandAt)) processGroup(world, group.id, now);
    }
    return world;
  }

  function isValidMarketOrder(order) {
    if (order?.ownerType !== 'population') return false;
    const group = groupMap.get(String(order.demandGroupId || ''));
    const product = productMap.get(String(order.productId || ''));
    if (!group || !product || product.marketDemandGroupId !== group.id) return false;
    if (CONSUMPTION_TIERS.has(order.demandTier)) {
      const expectedPool = FUNDING_POOL_BY_ROLE[order.demandTier];
      return order.side === 'buy'
        && order.ownerName === group.ownerName
        && POPULATION_MODEL_IDS.includes(order.populationModelId)
        && order.fundingPool === expectedPool;
    }
    if (LIQUIDITY_TIERS.has(order.demandTier)) {
      const expectedSide = order.demandTier === 'liquidity-buy' ? 'buy' : 'sell';
      return order.side === expectedSide && order.ownerName === group.ownerName;
    }
    return false;
  }

  return {
    initializeWorld,
    normalizeWorld,
    process,
    processGroup,
    processPriceTransmission: priceRuntime.processPriceTransmission,
    isValidMarketOrder,
    directProductIds,
    productRoles,
    recipes,
  };
}
