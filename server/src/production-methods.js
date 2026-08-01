export const PRODUCTION_METHOD_GROUP_ID = 'operation';
export const DEFAULT_PRODUCTION_METHOD_ID = 'standard';

const METHOD_DEFINITIONS = Object.freeze([
  Object.freeze({
    id: 'standard',
    name: '标准生产',
    description: '保持正式配方的标准周期、投入、产出与成本。',
    tone: 'neutral',
  }),
  Object.freeze({
    id: 'rapid',
    name: '高速生产',
    description: '缩短生产周期并提高单周期成本，更快消耗资金与原料。',
    tone: 'warning',
  }),
  Object.freeze({
    id: 'economical',
    name: '节约生产',
    description: '延长生产周期并降低单周期成本，减少短期资金压力。',
    tone: 'success',
  }),
  Object.freeze({
    id: 'high-yield',
    name: '高产生产',
    description: '同周期投入与产出翻倍，提高吞吐量与仓库压力。',
    tone: 'accent',
  }),
]);

function cloneItems(items) {
  return (items || []).map((item) => ({
    productId: String(item.productId),
    quantity: Math.max(0, Math.floor(Number(item.quantity) || 0)),
  }));
}

function productPriceMap(products) {
  return new Map((products || []).map((product) => [product.id, Number(product.basePrice)]));
}

function valueOfItems(items, prices) {
  return cloneItems(items).reduce((sum, item) => sum + (prices.get(item.productId) || 0) * item.quantity, 0);
}

function variantRecipeId(baseRecipeId, methodId) {
  return methodId === DEFAULT_PRODUCTION_METHOD_ID
    ? baseRecipeId
    : `${baseRecipeId}--${methodId}`;
}

function alignedCycleMs(baseCycleMs, expectedProfitPerMinute, mode) {
  const base = Math.max(1_000, Math.floor(Number(baseCycleMs) / 1_000) * 1_000);
  const target = mode === 'rapid'
    ? Math.max(1_000, Math.floor(base / 2_000) * 1_000)
    : Math.ceil((base * 3) / 2_000) * 1_000;
  const profit = Math.max(1, Math.floor(Number(expectedProfitPerMinute) || 1));

  if (mode === 'rapid') {
    for (let cycleMs = target; cycleMs < base; cycleMs += 1_000) {
      if ((profit * cycleMs) % 60_000 === 0) return cycleMs;
    }
    return base;
  }

  for (let cycleMs = target; cycleMs <= base * 3; cycleMs += 1_000) {
    if ((profit * cycleMs) % 60_000 === 0) return cycleMs;
  }
  return base * 2;
}

function createBalancedPlan(recipe, methodId, prices, expectedProfitPerMinute) {
  const baseInputs = cloneItems(recipe.inputs || (recipe.input ? [recipe.input] : []));
  const baseOutput = {
    productId: String(recipe.output.productId),
    quantity: Math.max(1, Math.floor(Number(recipe.output.quantity) || 1)),
  };
  const baseRecipeId = recipe.id;
  if (methodId === DEFAULT_PRODUCTION_METHOD_ID) {
    return {
      recipeId: baseRecipeId,
      baseRecipeId,
      productionMethodId: methodId,
      cycleMs: recipe.cycleMs,
      operatingCost: recipe.operatingCost,
      inputs: baseInputs,
      output: baseOutput,
    };
  }

  const scale = methodId === 'high-yield' ? 2 : 1;
  const inputs = baseInputs.map((item) => ({ ...item, quantity: item.quantity * scale }));
  const output = { ...baseOutput, quantity: baseOutput.quantity * scale };
  const cycleMs = methodId === 'high-yield'
    ? recipe.cycleMs
    : alignedCycleMs(recipe.cycleMs, expectedProfitPerMinute, methodId);
  const outputValue = valueOfItems([output], prices);
  const inputValue = valueOfItems(inputs, prices);
  const profitNumerator = expectedProfitPerMinute * cycleMs;
  if (profitNumerator % 60_000 !== 0) {
    throw new Error(`${baseRecipeId}/${methodId} 无法形成整数参考利润`);
  }
  const operatingCost = outputValue - inputValue - profitNumerator / 60_000;
  if (!Number.isSafeInteger(operatingCost) || operatingCost < 0) {
    throw new Error(`${baseRecipeId}/${methodId} 无法形成非负整数周期成本`);
  }
  return {
    recipeId: variantRecipeId(baseRecipeId, methodId),
    baseRecipeId,
    productionMethodId: methodId,
    cycleMs,
    operatingCost,
    inputs,
    output,
  };
}

function freezePlan(plan) {
  const inputs = Object.freeze(plan.inputs.map((item) => Object.freeze({ ...item })));
  return Object.freeze({
    ...plan,
    inputs,
    input: inputs.length === 1 ? inputs[0] : null,
    output: Object.freeze({ ...plan.output }),
  });
}

export function createProductionMethodGroups(facility, products, expectedProfitPerMinute) {
  const prices = productPriceMap(products);
  const methods = METHOD_DEFINITIONS.map((definition) => {
    const plansByRecipeId = Object.freeze(Object.fromEntries(
      facility.recipes.map((recipe) => [
        recipe.id,
        freezePlan(createBalancedPlan(recipe, definition.id, prices, expectedProfitPerMinute)),
      ]),
    ));
    return Object.freeze({ ...definition, plansByRecipeId });
  });
  return Object.freeze([
    Object.freeze({
      id: PRODUCTION_METHOD_GROUP_ID,
      name: '作业制度',
      defaultMethodId: DEFAULT_PRODUCTION_METHOD_ID,
      methods: Object.freeze(methods),
    }),
  ]);
}

export function createProductionMethodRecipes(facility, productionMethodGroups) {
  const baseRecipes = new Map(facility.recipes.map((recipe) => [recipe.id, recipe]));
  const group = productionMethodGroups.find((candidate) => candidate.id === PRODUCTION_METHOD_GROUP_ID)
    || productionMethodGroups[0];
  return Object.freeze(facility.recipes.flatMap((baseRecipe) => (
    group.methods.map((method) => {
      const plan = method.plansByRecipeId[baseRecipe.id];
      return freezePlan({
        ...plan,
        name: baseRecipe.name,
        baseRecipeId: baseRecipe.id,
        productionMethodId: method.id,
      });
    })
  )).filter((recipe) => baseRecipes.has(recipe.baseRecipeId)));
}

export function productionMethodGroupFor(type, groupId = PRODUCTION_METHOD_GROUP_ID) {
  return (type?.productionMethodGroups || []).find((group) => group.id === groupId)
    || type?.productionMethodGroups?.[0];
}

export function baseRecipeIdFor(recipe) {
  return recipe?.baseRecipeId || recipe?.id;
}

export function productionMethodIdFor(recipe) {
  return recipe?.productionMethodId || DEFAULT_PRODUCTION_METHOD_ID;
}

export function recipeVariantFor(type, baseRecipeId, productionMethodId) {
  return (type?.recipes || []).find((recipe) => (
    baseRecipeIdFor(recipe) === baseRecipeId
    && productionMethodIdFor(recipe) === productionMethodId
  ));
}

export function resolveProductionPlan(type, recipeId, selections) {
  const selectedRecipe = (type?.recipes || []).find((candidate) => candidate.id === recipeId)
    || (type?.recipes || []).find((candidate) => candidate.id === type?.defaultRecipeId)
    || type?.recipes?.[0];
  if (!selectedRecipe) return null;
  const baseRecipeId = baseRecipeIdFor(selectedRecipe);
  const group = productionMethodGroupFor(type);
  const candidateMethodId = String(selections?.[group.id] || productionMethodIdFor(selectedRecipe));
  const method = group.methods.find((candidate) => candidate.id === candidateMethodId)
    || group.methods.find((candidate) => candidate.id === group.defaultMethodId)
    || group.methods[0];
  const plan = method?.plansByRecipeId?.[baseRecipeId];
  return plan ? {
    ...plan,
    productionMethodSelections: { [group.id]: method.id },
  } : null;
}
