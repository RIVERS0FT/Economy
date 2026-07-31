import { randomUUID } from 'node:crypto';
import { createMarketLiquidityRuntime } from './market-liquidity.js';
import { ordersForDemandGroup, recordOrderBookReduction } from './order-book-runtime.js';
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
  DIRECT_DEMAND_SHORTAGE_PRICE_STEP,
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
import { allocateMoneyBudget, clamp, round4, roundMoney } from './market-demand/math.js';
import { floorPlayerMoney, multiplyMoneyByInteger, roundInternalMoney } from './money.js';
import { createPriceTransmissionRuntime } from './market-demand/price-transmission.js';
import { createMarketSignalRuntime } from './market-demand/signals.js';
import { createMarketDemandStateRuntime } from './market-demand/state.js';
import {
  POPULATION_MODEL_IDS,
  POPULATION_STABILIZATION_DIRECT_SHARE,
  populationClassShares,
  preparePopulationDemandCycle,
  releasePopulationOrderFunds,
  reservePopulationOrderFunding,
} from './population-economy.js';
import { economicEventClassShares, economicEventProductWeight } from './economic-events.js';

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
    productWeightMultiplier: (_world, productId, signalNow) => economicEventProductWeight(productId, signalNow),
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
    recordOrderBookReduction(world, order, removed);
    return keep;
  }

  function settlePreviousCycle(world, group, state, now) {
    const previousCycleId = Number(state.lastCycleId);
  const groupOrders = ordersForDemandGroup(world, group.id);
  const cycleOrders = groupOrders.filter((order) => (
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

    for (const order of groupOrders) {
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
    const groupOrders = ordersForDemandGroup(world, group.id)
      .filter((order) => isConsumptionOrder(order, group.id));
    for (const order of groupOrders) {
      if (!isOpenOrder(order)) continue;
      const age = cycleId - Number(order.demandCycleId || cycleId);
      if (age >= SYSTEM_ORDER_MAX_AGE_CYCLES) {
        trimOrderRemaining(world, order, 0);
        continue;
      }
      const quantity = Math.max(1, Math.floor(Number(order.quantity || 0)));
      const filled = Math.max(0, quantity - Math.max(0, Math.floor(Number(order.remaining || 0))));
      const fillRatio = filled / quantity;
      const retention = fillRatio > 0.80 ? 0 : fillRatio >= 0.25 ? 0.35 : 0.70;
      trimOrderRemaining(world, order, Math.floor(Number(order.remaining || 0) * retention));
    }
  }

  function orderValue(order, quantity = order?.remaining) {
    return multiplyMoneyByInteger(order?.price, Math.max(0, Math.floor(Number(quantity || 0)))) || 0;
  }

  function groupOpenOrderValue(world, groupId, predicate = () => true) {
  return roundMoney(ordersForDemandGroup(world, groupId).reduce((sum, order) => (
    isConsumptionOrder(order, groupId) && isOpenOrder(order) && predicate(order)
      ? sum + orderValue(order)
      : sum
  ), 0));
}

  function trimOrdersToValue(world, orders, cap) {
    let total = roundMoney(orders.reduce((sum, order) => sum + orderValue(order), 0));
    if (total <= cap) return total;
    orders.sort((left, right) => (
      Number(left.price || 0) - Number(right.price || 0)
      || Number(left.createdAt || 0) - Number(right.createdAt || 0)
    ));
    for (const order of orders) {
      if (total <= cap) break;
      const price = Math.max(0.01, Number(order.price || 0.01));
      const removeQuantity = Math.min(
        Number(order.remaining || 0),
        Math.ceil((total - cap) / price),
      );
      trimOrderRemaining(world, order, Number(order.remaining || 0) - removeQuantity);
      total = roundMoney(total - (multiplyMoneyByInteger(price, removeQuantity) || 0));
    }
    return roundMoney(total);
  }

  function enforceOrderValueCaps(world, group, cycleBudget, allocations) {
  const groupOrders = ordersForDemandGroup(world, group.id)
    .filter((order) => isConsumptionOrder(order, group.id) && isOpenOrder(order));
  for (const [productId, allocation] of Object.entries(allocations)) {
    const productCap = roundMoney(
      (Number(allocation.directBudget || 0) + Number(allocation.derivedBudget || 0)) * PRODUCT_ORDER_VALUE_CYCLES,
    );
    trimOrdersToValue(world, groupOrders.filter((order) => order.productId === productId), productCap);
  }
  const cap = roundMoney(cycleBudget * SYSTEM_ORDER_VALUE_CYCLES);
  return trimOrdersToValue(world, groupOrders, cap);
}

  function createOrder(world, group, role, product, price, quantity, cycleId, now, requestedSlices) {
    if (quantity < 1) return { filled: 0, order: null, committed: 0 };
    const committed = multiplyMoneyByInteger(price, quantity);
    if (committed === null || committed <= 0) return { filled: 0, order: null, committed: 0 };
    const fundingSlices = reservePopulationOrderFunding(world, requestedSlices);
    if (!fundingSlices) return { filled: 0, order: null, committed: 0 };
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
      fundingPool: FUNDING_POOL_BY_ROLE[role],
      fundingSlices: fundingSlices.map((slice) => ({ ...slice, fundingPool: FUNDING_POOL_BY_ROLE[role] })),
      price,
      quantity,
      remaining: quantity,
      status: 'open',
      createdAt: now,
    };
    if (fundingSlices.length === 1) order.populationModelId = fundingSlices[0].populationModelId;
    world.orders.push(order);
    matchOrder(world, order, now);
    return { filled: quantity - order.remaining, order, committed };
  }

  function priceCurveFor(product, referencePrice, pressure, role, directQuoteAnchor = referencePrice) {
    const cap = Math.max(DIRECT_DEMAND_MIN_PRICE, floorPlayerMoney(product.basePrice * PRICE_MAX_MULTIPLIER) || DIRECT_DEMAND_MIN_PRICE);
    const shortageMultiplier = pressure >= 1.15 ? DEMAND_CURVE_SHORTAGE_MULTIPLIER : 1;
    const shortageTarget = referencePrice * shortageMultiplier;
    const directBase = role === 'direct'
      ? (pressure >= 1.15
        ? Math.min(Math.max(directQuoteAnchor, shortageTarget), directQuoteAnchor * DIRECT_DEMAND_SHORTAGE_PRICE_STEP)
        : directQuoteAnchor)
      : referencePrice;
    return DEMAND_CURVE.map((tier, index) => {
      const targetPrice = role === 'direct'
        ? directBase * tier.multiplier
        : referencePrice * tier.multiplier * (index === 0 ? shortageMultiplier : 1);
      return {
        weight: tier.weight,
        price: Math.min(cap, Math.max(DIRECT_DEMAND_MIN_PRICE, floorPlayerMoney(targetPrice) || DIRECT_DEMAND_MIN_PRICE)),
      };
    });
  }

  function collectChoices(plans, role, budgets, details, populationModelId) {
    for (const [productId, budgetRaw] of budgets) {
      const detail = details.get(productId);
      const budget = roundMoney(budgetRaw);
      if (!detail || budget <= 0) continue;
      const key = `${role}:${productId}`;
      const plan = plans.get(key) || {
        role,
        productId,
        product: detail.product,
        detail,
        targetBudget: 0,
        contributions: new Map(),
      };
      plan.targetBudget = roundMoney(plan.targetBudget + budget);
      plan.contributions.set(populationModelId, roundMoney((plan.contributions.get(populationModelId) || 0) + budget));
      plans.set(key, plan);
    }
  }

  function allocateTierQuantities(curve, totalQuantity) {
    const base = curve.map((tier, index) => {
      const exact = totalQuantity * tier.weight;
      return { index, quantity: Math.floor(exact), remainder: exact - Math.floor(exact) };
    });
    let assigned = base.reduce((sum, item) => sum + item.quantity, 0);
    base.sort((left, right) => right.remainder - left.remainder || left.index - right.index);
    for (let cursor = 0; assigned < totalQuantity; cursor = (cursor + 1) % base.length) {
      base[cursor].quantity += 1;
      assigned += 1;
    }
    return base.sort((left, right) => left.index - right.index).map((item) => item.quantity);
  }

  function tierPlanForBudget(curve, budget) {
    const minimumPrice = Math.min(...curve.map((tier) => tier.price));
    let low = 0;
    let high = Math.max(0, Math.floor(budget / Math.max(DIRECT_DEMAND_MIN_PRICE, minimumPrice)));
    let best = { quantities: curve.map(() => 0), committed: 0 };
    while (low <= high) {
      const middle = Math.floor((low + high) / 2);
      const quantities = allocateTierQuantities(curve, middle);
      const committed = roundMoney(quantities.reduce((sum, quantity, index) => (
        sum + (multiplyMoneyByInteger(curve[index].price, quantity) || 0)
      ), 0));
      if (committed <= budget + 0.0000001) {
        best = { quantities, committed };
        low = middle + 1;
      } else {
        high = middle - 1;
      }
    }
    return best;
  }

  function takeFundingSlices(fundingByModel, amount) {
    let remaining = roundMoney(amount);
    const slices = [];
    for (const modelId of POPULATION_MODEL_IDS) {
      if (remaining <= 0) break;
      const available = roundMoney(fundingByModel.get(modelId) || 0);
      const take = Math.min(available, remaining);
      if (take <= 0) continue;
      slices.push({ populationModelId: modelId, reservedAmount: take });
      fundingByModel.set(modelId, roundMoney(available - take));
      remaining = roundMoney(remaining - take);
    }
    return remaining <= 0.0000001 ? slices : null;
  }

  function returnFundingSlices(fundingByModel, slices = []) {
    for (const slice of slices) {
      fundingByModel.set(slice.populationModelId, roundMoney(
        (fundingByModel.get(slice.populationModelId) || 0) + slice.reservedAmount,
      ));
    }
  }

  function materializeChoices(world, group, state, cycleId, now, plans, totals, allocations) {
    state.productBudgetDeficits ||= { direct: {}, 'derived-liquidity': {} };
    for (const role of ['direct', 'derived-liquidity']) {
      const rolePlans = [...plans.values()].filter((plan) => plan.role === role);
      if (rolePlans.length === 0) continue;
      const fundingByModel = new Map(POPULATION_MODEL_IDS.map((modelId) => [modelId, 0]));
      let roleBudget = 0;
      for (const plan of rolePlans) {
        for (const [modelId, amount] of plan.contributions) {
          fundingByModel.set(modelId, roundMoney((fundingByModel.get(modelId) || 0) + amount));
          roleBudget = roundMoney(roleBudget + amount);
        }
        const previousDeficit = Number(state.productBudgetDeficits[role]?.[plan.productId] || 0);
        state.productBudgetDeficits[role][plan.productId] = roundMoney(previousDeficit + plan.targetBudget);
        const referencePrice = Math.max(DIRECT_DEMAND_MIN_PRICE, Number(plan.detail.price.referencePrice || plan.product.basePrice));
        const pressure = Number(world.marketDemand.productPressure[plan.productId] || 1);
        const directQuoteAnchor = role === 'direct'
          ? Number(world.marketDemand.groups[group.id]?.directQuoteAnchors?.[plan.productId] || referencePrice)
          : referencePrice;
        plan.curve = priceCurveFor(plan.product, referencePrice, pressure, role, directQuoteAnchor);
        plan.topPrice = Math.max(...plan.curve.map((tier) => tier.price));
      }
      const assigned = new Map(rolePlans.map((plan) => [plan.productId, 0]));
      let remainingBudget = roleBudget;
      const eligible = [...rolePlans].sort((left, right) => {
        const leftDeficit = Number(state.productBudgetDeficits[role][left.productId] || 0);
        const rightDeficit = Number(state.productBudgetDeficits[role][right.productId] || 0);
        return rightDeficit / right.topPrice - leftDeficit / left.topPrice || left.productId.localeCompare(right.productId);
      });
      for (const plan of eligible) {
        const deficit = Number(state.productBudgetDeficits[role][plan.productId] || 0);
        if (deficit + 0.0000001 < plan.topPrice || remainingBudget + 0.0000001 < plan.topPrice) continue;
        assigned.set(plan.productId, plan.topPrice);
        remainingBudget = roundMoney(remainingBudget - plan.topPrice);
      }
      const extras = allocateMoneyBudget(rolePlans.map((plan) => {
        const deficit = Number(state.productBudgetDeficits[role][plan.productId] || 0);
        const provisional = assigned.get(plan.productId) || 0;
        const remainingDeficit = roundMoney(deficit - provisional);
        return { id: plan.productId, weight: remainingDeficit, maxBudget: remainingDeficit };
      }), remainingBudget);
      for (const plan of rolePlans) assigned.set(plan.productId, roundMoney((assigned.get(plan.productId) || 0) + (extras.get(plan.productId) || 0)));

      for (const plan of rolePlans.sort((left, right) => left.product.basePrice - right.product.basePrice || left.productId.localeCompare(right.productId))) {
        const budget = assigned.get(plan.productId) || 0;
        const tierPlan = tierPlanForBudget(plan.curve, budget);
        let totalQuantity = 0;
        let committed = 0;
        let filled = 0;
        let topPrice = 0;
        for (let index = 0; index < plan.curve.length; index += 1) {
          const quantity = tierPlan.quantities[index];
          if (quantity <= 0) continue;
          const price = plan.curve[index].price;
          const orderCommitted = multiplyMoneyByInteger(price, quantity) || 0;
          const slices = takeFundingSlices(fundingByModel, orderCommitted);
          if (!slices) continue;
          const result = createOrder(world, group, role, plan.product, price, quantity, cycleId, now, slices);
          if (!result.order) {
            returnFundingSlices(fundingByModel, slices);
            continue;
          }
          totalQuantity += quantity;
          committed = roundMoney(committed + result.committed);
          filled += result.filled;
          topPrice = Math.max(topPrice, price);
        }
        state.productBudgetDeficits[role][plan.productId] = roundMoney(
          Number(state.productBudgetDeficits[role][plan.productId] || 0) - committed,
        );
        totals.currentDemandQuantities[plan.productId] = (totals.currentDemandQuantities[plan.productId] || 0) + totalQuantity;
        if (role === 'direct') totals.directCommitted = roundMoney(totals.directCommitted + committed);
        else totals.derivedCommitted = roundMoney(totals.derivedCommitted + committed);
        const existing = allocations[plan.productId] || {
          directBudget: 0, derivedBudget: 0, directQuantity: 0, derivedQuantity: 0, filled: 0,
        };
        existing[role === 'direct' ? 'directBudget' : 'derivedBudget'] = roundMoney(
          existing[role === 'direct' ? 'directBudget' : 'derivedBudget'] + committed,
        );
        existing[role === 'direct' ? 'directQuantity' : 'derivedQuantity'] += totalQuantity;
        existing.filled += filled;
        existing.targetBudget = roundMoney((existing.targetBudget || 0) + plan.targetBudget);
        existing.budgetDeficit = state.productBudgetDeficits[role][plan.productId];
        existing.referencePrice = round4(plan.detail.price.referencePrice);
        existing.orderPrice = topPrice || Math.max(DIRECT_DEMAND_MIN_PRICE, floorPlayerMoney(plan.detail.price.referencePrice) || DIRECT_DEMAND_MIN_PRICE);
        existing.effectivePrice = round4(plan.detail.price.effective);
        existing.quote = round4(plan.detail.price.quote);
        existing.coverage = round4(plan.detail.price.coverage);
        if (plan.detail.requiredQuantity !== undefined) existing.requiredQuantity = round4(plan.detail.requiredQuantity);
        allocations[plan.productId] = existing;
        const market = marketFor(world, plan.productId, now);
        market.demand.lastPrice = existing.orderPrice;
        market.demand.lastQuantity = totalQuantity;
        market.demand.lastBudget = committed;
        market.demand.nextDemandAt = (cycleId + 1) * group.cycleMs;
      }
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
    const demandPlans = new Map();
    const totals = {
      currentDemandQuantities: {},
      directCommitted: 0,
      derivedCommitted: 0,
    };
    const classAllocationByModel = {};
    const derivedRelations = [];
    let cycleBudget = 0;

    for (const modelId of POPULATION_MODEL_IDS) {
      const modelBudget = roundMoney(Number(populationCycle.groups?.[group.id]?.[modelId] || 0));
      if (modelBudget <= 0) continue;
      cycleBudget = roundMoney(cycleBudget + modelBudget);
      const stabilizationBudget = roundMoney(Number(populationCycle.baseGroups?.[group.id]?.[modelId] || 0));
      const employmentBudget = roundMoney(modelBudget - stabilizationBudget);
      const directBudget = Math.min(modelBudget, roundMoney(
        stabilizationBudget * POPULATION_STABILIZATION_DIRECT_SHARE
          + employmentBudget * group.directBudgetShare,
      ));
      const derivedBudget = roundMoney(modelBudget - directBudget);
      const modelState = allocationStateForModel(state, modelId);
      const direct = allocationRuntime.directDemandChoices(world, group, modelState, directBudget, now, {
        classShares: economicEventClassShares(
          modelId,
          group.id,
          populationClassShares(world, modelId, group.id),
          now,
        ),
      });
      persistAllocationState(state, modelId, modelState);
      const derived = allocationRuntime.derivedDemandChoices(world, state, derivedBudget, now);
      classAllocationByModel[modelId] = direct.classAllocation;
      derivedRelations.push(...derived.relationDetails.map((relation) => ({ ...relation, populationModelId: modelId })));
      collectChoices(demandPlans, 'direct', direct.productBudgets, direct.productDetails, modelId);
      collectChoices(demandPlans, 'derived-liquidity', derived.productBudgets, derived.productDetails, modelId);
    }

    materializeChoices(world, group, state, cycleId, now, demandPlans, totals, allocations);
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
        && order.fundingPool === expectedPool
        && (
          (Array.isArray(order.fundingSlices) && order.fundingSlices.length > 0
            && order.fundingSlices.every((slice) => POPULATION_MODEL_IDS.includes(slice.populationModelId)))
          || POPULATION_MODEL_IDS.includes(order.populationModelId)
        );
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
