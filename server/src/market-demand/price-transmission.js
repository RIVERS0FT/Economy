import {
  PRICE_BASE_REVERSION,
  PRICE_FALL_RATE,
  PRICE_MAX_MULTIPLIER,
  PRICE_MIN_MULTIPLIER,
  PRICE_RISE_RATE,
  RELATION_LAG_WEIGHTS,
} from './catalog.js';
import { clamp, clone, geometricWeightedMean, round4 } from './math.js';

export function createPriceTransmissionRuntime({
  products,
  recipes,
  directProductIds,
  productFor,
  marketFor,
  realTradeStats,
  normalizeWorld,
  defaultProductState,
}) {
  const relationId = (recipe, input) => `${recipe.facilityTypeId}/${recipe.recipeId}:${input.productId}`;
  const roundNullable = (value) => value === null ? null : round4(value);

  function signalPrice(snapshot, product) {
    const state = snapshot[product.id] || defaultProductState(product, 0);
    return Math.max(
      product.basePrice * PRICE_MIN_MULTIPLIER,
      Number(state.referencePrice || product.basePrice) * 0.55 + Number(state.observedPrice || product.basePrice) * 0.45,
    );
  }

  function targetProfit(recipe) {
    const output = productFor(recipe.output.productId);
    const revenue = output.basePrice * recipe.output.quantity;
    const inputValue = recipe.inputs.reduce((sum, input) => sum + productFor(input.productId).basePrice * input.quantity, 0);
    return Math.max(0, revenue - inputValue - recipe.operatingCost);
  }

  function laggedRelationValue(world, id, fallbackValue) {
    const history = world.marketDemand.relations[id]?.lagSignals;
    if (!Array.isArray(history) || history.length === 0) return fallbackValue;
    let weighted = 0;
    let totalWeight = 0;
    for (let index = 0; index < RELATION_LAG_WEIGHTS.length; index += 1) {
      const value = Number(history[index]);
      if (!Number.isFinite(value) || value <= 0) continue;
      weighted += value * RELATION_LAG_WEIGHTS[index];
      totalWeight += RELATION_LAG_WEIGHTS[index];
    }
    return totalWeight > 0 ? weighted / totalWeight : fallbackValue;
  }

  function calculatePriceAnchors(world, snapshot, now) {
    const costCandidates = new Map(products.map((product) => [product.id, []]));
    const downstreamCandidates = new Map(products.map((product) => [product.id, []]));

    for (const recipe of recipes) {
      const outputProduct = productFor(recipe.output.productId);
      const profit = targetProfit(recipe);
      const inputCost = recipe.inputs.reduce((sum, input) => sum + signalPrice(snapshot, productFor(input.productId)) * input.quantity, 0);
      costCandidates.get(outputProduct.id).push((inputCost + recipe.operatingCost + profit) / recipe.output.quantity);
      const outputStats = realTradeStats(world, outputProduct.id, now);
      const outputPressure = clamp(0.75, 1.5, Number(world.marketDemand.productPressure[outputProduct.id] || 1));
      const activityWeight = Math.max(0.25, outputStats.quantity) * outputPressure;
      for (const input of recipe.inputs) {
        const id = relationId(recipe, input);
        const lagged = laggedRelationValue(world, id, productFor(input.productId).basePrice);
        downstreamCandidates.get(input.productId).push({ value: lagged, weight: activityWeight });
      }
    }

    return Object.fromEntries(products.map((product) => {
      const costs = costCandidates.get(product.id);
      const downstream = downstreamCandidates.get(product.id);
      return [product.id, {
        costAnchor: costs.length > 0 ? Math.min(...costs) : null,
        downstreamValueAnchor: downstream.length > 0
          ? downstream.reduce((sum, item) => sum + item.value * item.weight, 0)
            / downstream.reduce((sum, item) => sum + item.weight, 0)
          : null,
      }];
    }));
  }

  function calculatePendingSignals(currentStates) {
    const pendingSignals = new Map();
    for (const recipe of recipes) {
      const outputProduct = productFor(recipe.output.productId);
      const profit = targetProfit(recipe);
      const outputValue = signalPrice(currentStates, outputProduct) * recipe.output.quantity;
      for (const input of recipe.inputs) {
        const otherInputCost = recipe.inputs.reduce((sum, other) => (
          other.productId === input.productId
            ? sum
            : sum + signalPrice(currentStates, productFor(other.productId)) * other.quantity
        ), 0);
        const netback = (outputValue - recipe.operatingCost - profit - otherInputCost) / input.quantity;
        if (!Number.isFinite(netback) || netback <= 0) continue;
        pendingSignals.set(relationId(recipe, input), round4(netback));
      }
    }
    return pendingSignals;
  }

  function priceWeights(product) {
    if (directProductIds.has(product.id)) return { base: 0.15, observed: 0.35, cost: 0.30, downstream: 0, demand: 0.20 };
    if (product.category === 'raw') return { base: 0.15, observed: 0.25, cost: 0, downstream: 0.45, demand: 0.15 };
    if (product.category === 'intermediate') return { base: 0.10, observed: 0.25, cost: 0.25, downstream: 0.30, demand: 0.10 };
    return { base: 0.35, observed: 0.45, cost: 0.10, downstream: 0.10, demand: 0 };
  }

  function priceLimits(product) {
    if (directProductIds.has(product.id)) return { rise: 0.08, fall: 0.06 };
    if (product.category === 'intermediate') return { rise: 0.06, fall: 0.05 };
    if (product.category === 'raw') return { rise: 0.05, fall: 0.04 };
    return { rise: 0.06, fall: 0.05 };
  }

  function processPriceTransmission(world, now = Date.now()) {
    normalizeWorld(world, now);
    const transmission = world.marketDemand.priceTransmission;
    const cycleId = Math.floor(now / transmission.cycleMs);
    if (cycleId <= Number(transmission.lastCycleId)) return false;
    for (const product of products) {
      const previousPressure = Number(world.marketDemand.productPressure[product.id] || 1);
      world.marketDemand.productPressure[product.id] = round4(1 + (previousPressure - 1) * 0.70);
    }
    const snapshot = clone(transmission.products);
    const anchors = calculatePriceAnchors(world, snapshot, now);

    for (const product of products) {
      const previous = snapshot[product.id] || defaultProductState(product, cycleId - 1);
      const trades = realTradeStats(world, product.id, now);
      const observedPriceRaw = trades.vwap === null
        ? Number(previous.observedPrice || product.basePrice) * (1 - PRICE_BASE_REVERSION) + product.basePrice * PRICE_BASE_REVERSION
        : Number(previous.observedPrice || product.basePrice) * 0.70 + trades.vwap * 0.30;
      const pressure = clamp(0.75, 1.5, Number(world.marketDemand.productPressure[product.id] || 1));
      const demandPressureAnchorRaw = product.basePrice * pressure;
      const { costAnchor: costAnchorRaw, downstreamValueAnchor: downstreamValueAnchorRaw } = anchors[product.id];
      const observedPrice = round4(observedPriceRaw);
      const demandPressureAnchor = round4(demandPressureAnchorRaw);
      const costAnchor = roundNullable(costAnchorRaw);
      const downstreamValueAnchor = roundNullable(downstreamValueAnchorRaw);
      const weights = priceWeights(product);
      const targetRaw = geometricWeightedMean([
        { value: product.basePrice, weight: weights.base },
        { value: observedPrice, weight: weights.observed },
        { value: costAnchor, weight: weights.cost },
        { value: downstreamValueAnchor, weight: weights.downstream },
        { value: demandPressureAnchor, weight: weights.demand },
      ]) || product.basePrice;
      const targetPrice = round4(clamp(
        product.basePrice * PRICE_MIN_MULTIPLIER,
        product.basePrice * PRICE_MAX_MULTIPLIER,
        targetRaw,
      ));
      const oldReference = Math.max(0.01, Number(previous.referencePrice || product.basePrice));
      const unconstrained = oldReference + (targetPrice >= oldReference ? PRICE_RISE_RATE : PRICE_FALL_RATE) * (targetPrice - oldReference);
      const limits = priceLimits(product);
      const referencePrice = round4(clamp(
        product.basePrice * PRICE_MIN_MULTIPLIER,
        product.basePrice * PRICE_MAX_MULTIPLIER,
        clamp(oldReference * (1 - limits.fall), oldReference * (1 + limits.rise), unconstrained),
      ));
      transmission.products[product.id] = {
        observedPrice,
        costAnchor,
        downstreamValueAnchor,
        demandPressureAnchor,
        targetPrice,
        referencePrice,
        lastUpdatedCycleId: cycleId,
      };
      Object.assign(marketFor(world, product.id, now).demand, transmission.products[product.id]);
    }

    const pendingSignals = calculatePendingSignals(transmission.products);
    for (const [id, value] of pendingSignals) {
      const previous = world.marketDemand.relations[id]?.lagSignals || [];
      world.marketDemand.relations[id] = {
        lagSignals: [value, ...previous].slice(0, 3),
        lastUpdatedCycleId: cycleId,
      };
    }
    transmission.lastCycleId = cycleId;
    world.priceTransmission = transmission;
    return true;
  }

  return { processPriceTransmission };
}
