import {
  ACTIVE_PLAYER_WINDOW_MS,
  ACTIVITY_WINDOW_MS,
  BUDGET_MAX_FALL,
  BUDGET_MAX_RISE,
  BUDGET_SMOOTHING,
  PLAYER_SCALE_MAX,
} from './catalog.js';
import { allocateIntegerBudget, clamp, normalizeShares, round4, smoothShares } from './math.js';

export function createDemandAllocationRuntime({
  productFor,
  recipesByOutput,
  effectivePrice,
  orderBookQuote,
  realTradeStats,
}) {
  function activePlayerCount(world, now) {
    const cutoff = now - ACTIVE_PLAYER_WINDOW_MS;
    return Object.values(world.players || {}).filter((player) => (
      Number(player.lastEconomicActivityAt || 0) >= cutoff
    )).length;
  }

  function groupTradeActivity(world, group, now) {
    const ids = new Set(group.classes.flatMap((demandClass) => demandClass.products.map((option) => option.productId)));
    return [...ids].reduce((sum, id) => sum + realTradeStats(world, id, now, ACTIVITY_WINDOW_MS).playerValue, 0);
  }

  function dynamicBudget(world, group, state, now) {
    const activePlayers = activePlayerCount(world, now);
    if (activePlayers <= 0) {
      return {
        activePlayers: 0,
        playerScaleBudget: 0,
        tradeActivityFactor: 1,
        needPressure: 1,
        targetBudget: 0,
        budget: 0,
      };
    }
    const playerScale = clamp(1, PLAYER_SCALE_MAX, 0.5 + 0.5 * Math.sqrt(activePlayers));
    const playerScaleBudget = Math.max(1, Math.floor(group.baseBudget * playerScale));
    const tradeValue = groupTradeActivity(world, group, now);
    const tradeActivityFactor = tradeValue <= 0
      ? 1
      : clamp(0.90, 1.10, 0.95 + 0.15 * Math.tanh(tradeValue / Math.max(1, playerScaleBudget * 5)));
    const needPressure = clamp(0.90, 1.12, 1 + 0.25 * (group.targetSatisfaction - state.satisfactionEma));
    const targetBudget = Math.max(1, Math.floor(playerScaleBudget * tradeActivityFactor * needPressure));
    const previousBudget = Math.max(0, Math.floor(Number(state.lastBudget ?? group.baseBudget)));
    let budget = targetBudget;
    if (Number(state.lastTargetBudget || 0) > 0 && previousBudget > 0) {
      const smoothed = Math.round(previousBudget * (1 - BUDGET_SMOOTHING) + targetBudget * BUDGET_SMOOTHING);
      budget = clamp(
        Math.ceil(previousBudget * (1 - BUDGET_MAX_FALL)),
        Math.floor(previousBudget * (1 + BUDGET_MAX_RISE)),
        smoothed,
      );
    }
    return { activePlayers, playerScaleBudget, tradeActivityFactor, needPressure, targetBudget, budget };
  }

  function allocateClassBudgets(group, state, directBudget, classDetails) {
    const minima = new Map();
    let minimumTotal = 0;
    for (const demandClass of group.classes) {
      const minimum = Math.floor(directBudget * demandClass.minBudgetShare);
      minima.set(demandClass.id, minimum);
      minimumTotal += minimum;
    }
    const remaining = Math.max(0, directBudget - minimumTotal);
    const rawScores = {};
    const minimumShares = {};
    for (const demandClass of group.classes) {
      const detail = classDetails.get(demandClass.id);
      const priceIndex = Math.max(0.25, Number(detail?.priceIndex || 1));
      const service = clamp(0.50, 1.10, Number(state.lastClassService?.[demandClass.id] || 1));
      rawScores[demandClass.id] = demandClass.budgetShare * priceIndex ** -0.45 * service;
      minimumShares[demandClass.id] = demandClass.minBudgetShare;
    }
    const targetShares = normalizeShares(rawScores, minimumShares);
    const shares = smoothShares(targetShares, state.lastClassShares, minimumShares);
    const extras = allocateIntegerBudget(group.classes.map((demandClass) => ({
      id: demandClass.id,
      weight: shares[demandClass.id],
      maxBudget: Math.max(0, Math.floor(directBudget * demandClass.maxBudgetShare) - (minima.get(demandClass.id) || 0)),
    })), remaining);
    const budgets = new Map();
    for (const demandClass of group.classes) {
      budgets.set(demandClass.id, (minima.get(demandClass.id) || 0) + (extras.get(demandClass.id) || 0));
    }
    const assigned = [...budgets.values()].reduce((sum, value) => sum + value, 0);
    if (assigned < directBudget) {
      const winner = [...group.classes]
        .sort((left, right) => rawScores[right.id] - rawScores[left.id] || left.id.localeCompare(right.id))[0];
      budgets.set(winner.id, (budgets.get(winner.id) || 0) + directBudget - assigned);
    }
    state.lastClassShares = Object.fromEntries([...budgets].map(([id, budget]) => [id, directBudget <= 0 ? 0 : budget / directBudget]));
    return budgets;
  }

  function directDemandChoices(world, group, state, directBudget, now) {
    const productBudgets = new Map();
    const classAllocation = {};
    const productDetails = new Map();
    const classDetails = new Map();

    for (const demandClass of group.classes) {
      const scores = {};
      const minima = {};
      const details = {};
      let weightedPriceIndex = 0;
      let totalBaseWeight = 0;
      for (const option of demandClass.products) {
        const product = productFor(option.productId);
        const priceState = world.marketDemand.priceTransmission.products[product.id];
        const price = effectivePrice(world, product, group.quoteUtilityDepth / Math.max(1, option.utilityPerUnit), priceState, now);
        const priceIndex = price.effective / Math.max(0.01, price.referencePrice);
        const availabilityFactor = clamp(0.35, 1.15, 0.35 + 0.80 * price.coverage);
        scores[product.id] = option.baseWeight * priceIndex ** -demandClass.elasticity * availabilityFactor;
        minima[product.id] = option.minShare || 0;
        details[product.id] = { option, product, price };
        weightedPriceIndex += option.baseWeight * priceIndex;
        totalBaseWeight += option.baseWeight;
      }
      classDetails.set(demandClass.id, {
        scores,
        minima,
        details,
        priceIndex: totalBaseWeight <= 0 ? 1 : weightedPriceIndex / totalBaseWeight,
      });
    }

    const classBudgets = allocateClassBudgets(group, state, directBudget, classDetails);
    for (const demandClass of group.classes) {
      const classBudget = classBudgets.get(demandClass.id) || 0;
      const detail = classDetails.get(demandClass.id);
      const targetShares = normalizeShares(detail.scores, detail.minima);
      const shares = smoothShares(targetShares, state.lastProductShares[demandClass.id], detail.minima);
      state.lastProductShares[demandClass.id] = shares;
      const budgets = allocateIntegerBudget(Object.entries(shares).map(([id, share]) => ({ id, weight: share, maxBudget: classBudget })), classBudget);
      classAllocation[demandClass.id] = {
        budget: classBudget,
        shares: Object.fromEntries(Object.entries(shares).map(([id, value]) => [id, round4(value)])),
      };
      for (const [productId, budget] of budgets) {
        productBudgets.set(productId, (productBudgets.get(productId) || 0) + budget);
        if (!productDetails.has(productId)) productDetails.set(productId, detail.details[productId]);
      }
    }
    return { productBudgets, productDetails, classAllocation };
  }

  function recipeUnitCost(world, recipe) {
    const transmission = world.marketDemand.priceTransmission.products;
    const cost = recipe.inputs.reduce((sum, input) => (
      sum + Number(transmission[input.productId]?.referencePrice || productFor(input.productId).basePrice) * input.quantity
    ), 0);
    return (cost + recipe.operatingCost) / recipe.output.quantity;
  }

  function recipeAvailability(world, recipe) {
    if (recipe.inputs.length === 0) return 1;
    return Math.min(...recipe.inputs.map((input) => {
      const product = productFor(input.productId);
      const priceState = world.marketDemand.priceTransmission.products[product.id];
      return orderBookQuote(
        world,
        product,
        Math.max(1, input.quantity),
        Number(priceState.referencePrice || product.basePrice),
      ).coverage;
    }));
  }

  function recipeSharesFor(world, outputProductId, state) {
    const candidates = recipesByOutput.get(outputProductId) || [];
    if (candidates.length <= 1) return candidates.length === 1 ? { [candidates[0].recipeId]: 1 } : {};
    const costs = Object.fromEntries(candidates.map((recipe) => [recipe.recipeId, recipeUnitCost(world, recipe)]));
    const minimum = Math.min(...Object.values(costs));
    const raw = Object.fromEntries(candidates.map((recipe) => {
      const costScore = Math.exp(-4 * (costs[recipe.recipeId] / Math.max(0.01, minimum) - 1));
      const availabilityScore = 0.35 + 0.65 * recipeAvailability(world, recipe);
      return [recipe.recipeId, costScore * availabilityScore];
    }));
    const minima = Object.fromEntries(candidates.map((recipe) => [recipe.recipeId, 0.05]));
    const target = normalizeShares(raw, minima);
    const previous = state.recipeShares[outputProductId] || target;
    const smoothed = smoothShares(target, previous, minima);
    state.recipeShares[outputProductId] = smoothed;
    return smoothed;
  }

  function derivedRequirements(world, state) {
    const requirements = new Map();
    const relationDetails = [];
    for (const [outputProductId, demandedQuantityRaw] of Object.entries(state.previousDemandQuantities || {})) {
      const demandedQuantity = Math.max(0, Number(demandedQuantityRaw || 0));
      if (demandedQuantity <= 0) continue;
      const candidateRecipes = recipesByOutput.get(outputProductId) || [];
      if (candidateRecipes.length === 0) continue;
      const shares = recipeSharesFor(world, outputProductId, state);
      for (const recipe of candidateRecipes) {
        const recipeShare = Number(shares[recipe.recipeId] || 0);
        if (recipeShare <= 0) continue;
        const outputCycles = demandedQuantity * recipeShare / recipe.output.quantity;
        const inputCoverage = Object.fromEntries(recipe.inputs.map((input) => {
          const product = productFor(input.productId);
          const priceState = world.marketDemand.priceTransmission.products[product.id];
          const required = Math.max(1, outputCycles * input.quantity);
          const quote = orderBookQuote(world, product, required, Number(priceState.referencePrice || product.basePrice));
          return [input.productId, quote.coverage];
        }));
        for (const input of recipe.inputs) {
          const otherCoverages = recipe.inputs
            .filter((other) => other.productId !== input.productId)
            .map((other) => Number(inputCoverage[other.productId] || 0));
          const complementGate = otherCoverages.length === 0 ? 1 : clamp(0.20, 1, Math.min(...otherCoverages));
          const quantity = outputCycles * input.quantity * complementGate;
          requirements.set(input.productId, (requirements.get(input.productId) || 0) + quantity);
          relationDetails.push({
            outputProductId,
            recipeId: recipe.recipeId,
            inputProductId: input.productId,
            recipeShare: round4(recipeShare),
            complementGate: round4(complementGate),
            quantity: round4(quantity),
          });
        }
      }
    }
    return { requirements, relationDetails };
  }

  function derivedDemandChoices(world, state, derivedBudget, now) {
    const { requirements, relationDetails } = derivedRequirements(world, state);
    const entries = [];
    const details = new Map();
    for (const [productId, requiredQuantity] of requirements) {
      const product = productFor(productId);
      const priceState = world.marketDemand.priceTransmission.products[product.id];
      const price = effectivePrice(world, product, Math.max(1, requiredQuantity), priceState, now);
      entries.push({ id: productId, weight: requiredQuantity * price.referencePrice, maxBudget: derivedBudget });
      details.set(productId, { product, price, requiredQuantity });
    }
    return {
      productBudgets: allocateIntegerBudget(entries, derivedBudget),
      productDetails: details,
      relationDetails,
    };
  }

  return { dynamicBudget, directDemandChoices, derivedDemandChoices };
}
