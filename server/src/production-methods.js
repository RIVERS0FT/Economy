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

const C1_METHOD_BLUEPRINTS = Object.freeze({
  farm: Object.freeze([
    Object.freeze({ id: 'standard', name: '基础耕作', description: '保持基础耕作，不消耗额外生产资料。', tone: 'neutral', inputs: [], outputQuantity: 1 }),
    Object.freeze({ id: 'assisted', name: '工具耕作', description: '每周期整件消耗 1 工具并提高作物产量。', tone: 'warning', inputs: [{ productId: 'tools', quantity: 1 }], outputQuantity: 51 }),
    Object.freeze({ id: 'intensive', name: '化肥耕作', description: '每周期整件消耗 2 化肥并进一步提高作物产量。', tone: 'success', inputs: [{ productId: 'fertilizer', quantity: 2 }], outputQuantity: 58 }),
    Object.freeze({ id: 'mechanized', name: '拖拉机耕作', description: '每周期整件消耗 1 拖拉机并获得最高作物产量。', tone: 'accent', inputs: [{ productId: 'tractor', quantity: 1 }], outputQuantity: 102 }),
  ]),
  orchard: Object.freeze([
    Object.freeze({ id: 'standard', name: '基础管护', description: '保持基础果园管护，不消耗额外生产资料。', tone: 'neutral', inputs: [], outputQuantity: 1 }),
    Object.freeze({ id: 'assisted', name: '工具管护', description: '每周期整件消耗 1 工具并提高水果产量。', tone: 'warning', inputs: [{ productId: 'tools', quantity: 1 }], outputQuantity: 48 }),
    Object.freeze({ id: 'intensive', name: '化肥管护', description: '每周期整件消耗 2 化肥并进一步提高水果产量。', tone: 'success', inputs: [{ productId: 'fertilizer', quantity: 2 }], outputQuantity: 55 }),
    Object.freeze({ id: 'mechanized', name: '拖拉机管护', description: '每周期整件消耗 1 拖拉机并获得最高水果产量。', tone: 'accent', inputs: [{ productId: 'tractor', quantity: 1 }], outputQuantity: 96 }),
  ]),
  ranch: Object.freeze([
    Object.freeze({ id: 'standard', name: '粗放饲养', description: '保持粗放饲养，不消耗额外生产资料。', tone: 'neutral', inputs: [], outputQuantity: 1 }),
    Object.freeze({ id: 'assisted', name: '饲料饲养', description: '每周期整件消耗 1 配合饲料并提高畜产品产量。', tone: 'warning', inputs: [{ productId: 'feed', quantity: 1 }], outputQuantity: 6 }),
    Object.freeze({ id: 'intensive', name: '药剂精养', description: '每周期整件消耗 1 养殖药剂并进一步提高畜产品产量。', tone: 'success', inputs: [{ productId: 'veterinary-medicine', quantity: 1 }], outputQuantity: 19 }),
    Object.freeze({ id: 'mechanized', name: '机械化养殖', description: '每周期整件消耗 1 机械并获得最高畜产品产量。', tone: 'accent', inputs: [{ productId: 'machinery', quantity: 1 }], outputQuantity: 35 }),
  ]),
  fishery: Object.freeze([
    Object.freeze({ id: 'standard', name: '粗放养殖', description: '保持粗放养殖，不消耗额外生产资料。', tone: 'neutral', inputs: [], outputQuantity: 1 }),
    Object.freeze({ id: 'assisted', name: '饲料精养', description: '每周期整件消耗 1 配合饲料并提高鱼类产量。', tone: 'warning', inputs: [{ productId: 'feed', quantity: 1 }], outputQuantity: 5 }),
    Object.freeze({ id: 'intensive', name: '药剂精养', description: '每周期整件消耗 1 养殖药剂并进一步提高鱼类产量。', tone: 'success', inputs: [{ productId: 'veterinary-medicine', quantity: 1 }], outputQuantity: 18 }),
    Object.freeze({ id: 'mechanized', name: '机械化养殖', description: '每周期整件消耗 1 机械并获得最高鱼类产量。', tone: 'accent', inputs: [{ productId: 'machinery', quantity: 1 }], outputQuantity: 33 }),
  ]),
});

const MONEY_DECIMALS = 2;
const MONEY_SCALE = 10 ** MONEY_DECIMALS;

function cloneItems(items) {
  return (items || []).map((item) => ({
    productId: String(item.productId),
    quantity: Math.max(0, Math.floor(Number(item.quantity) || 0)),
  }));
}

function productPriceMap(products) {
  return new Map((products || []).map((product) => [product.id, Number(product.basePrice)]));
}

function moneyUnits(value, label = '金额') {
  const numeric = Number(value);
  const units = Math.round(numeric * MONEY_SCALE);
  if (
    !Number.isFinite(numeric)
    || !Number.isSafeInteger(units)
    || Math.abs(numeric - units / MONEY_SCALE) > 1e-9
  ) throw new Error(`${label}必须为最多两位小数的安全数值`);
  return units;
}

function moneyFromUnits(units) {
  return units / MONEY_SCALE;
}

function valueOfItemsUnits(items, prices) {
  return cloneItems(items).reduce(
    (sum, item) => sum + moneyUnits(prices.get(item.productId) || 0, `${item.productId} 参考价`) * item.quantity,
    0,
  );
}

function referenceProfitPerMinute(recipe, prices) {
  const outputValueUnits = valueOfItemsUnits([recipe.output], prices);
  const inputValueUnits = valueOfItemsUnits(recipe.inputs || (recipe.input ? [recipe.input] : []), prices);
  const profitPerCycleUnits = outputValueUnits - inputValueUnits - moneyUnits(recipe.operatingCost, `${recipe.id} 周期成本`);
  const profitNumerator = profitPerCycleUnits * 60_000;
  if (!Number.isSafeInteger(profitNumerator) || profitNumerator % recipe.cycleMs !== 0) {
    throw new Error(`${recipe.id} 无法形成分币精确的参考分钟利润`);
  }
  return moneyFromUnits(profitNumerator / recipe.cycleMs);
}

function variantRecipeId(baseRecipeId, methodId) {
  return methodId === DEFAULT_PRODUCTION_METHOD_ID
    ? baseRecipeId
    : `${baseRecipeId}--${methodId}`;
}

function alignedCycleMs(baseCycleMs, expectedProfitPerMinute, mode, useCentAlignment = false) {
  const base = Math.max(1_000, Math.floor(Number(baseCycleMs) / 1_000) * 1_000);
  const target = mode === 'rapid'
    ? Math.max(1_000, Math.floor(base / 2_000) * 1_000)
    : Math.ceil((base * 3) / 2_000) * 1_000;
  const profit = useCentAlignment
    ? moneyUnits(expectedProfitPerMinute, '参考分钟利润')
    : Math.max(1, Math.floor(Number(expectedProfitPerMinute) || 1));

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

function createBalancedPlan(recipe, methodId, prices, expectedProfitPerMinute, useCentAlignment) {
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
    : alignedCycleMs(recipe.cycleMs, expectedProfitPerMinute, methodId, useCentAlignment);
  const outputValueUnits = valueOfItemsUnits([output], prices);
  const inputValueUnits = valueOfItemsUnits(inputs, prices);
  const profitNumerator = moneyUnits(expectedProfitPerMinute, '参考分钟利润') * cycleMs;
  if (!Number.isSafeInteger(profitNumerator) || profitNumerator % 60_000 !== 0) {
    throw new Error(`${baseRecipeId}/${methodId} 无法形成分币精确的参考利润`);
  }
  const operatingCostUnits = outputValueUnits - inputValueUnits - profitNumerator / 60_000;
  if (!Number.isSafeInteger(operatingCostUnits) || operatingCostUnits < 0) {
    throw new Error(`${baseRecipeId}/${methodId} 无法形成非负两位小数周期成本`);
  }
  return {
    recipeId: variantRecipeId(baseRecipeId, methodId),
    baseRecipeId,
    productionMethodId: methodId,
    cycleMs,
    operatingCost: moneyFromUnits(operatingCostUnits),
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

function createC1ProductionMethodGroups(facility) {
  const blueprints = C1_METHOD_BLUEPRINTS[facility.id];
  if (!blueprints) return null;
  const methods = blueprints.map((blueprint) => {
    const plansByRecipeId = Object.freeze(Object.fromEntries(facility.recipes.map((recipe) => [
      recipe.id,
      freezePlan({
        recipeId: variantRecipeId(recipe.id, blueprint.id),
        baseRecipeId: recipe.id,
        productionMethodId: blueprint.id,
        cycleMs: recipe.cycleMs,
        operatingCost: recipe.operatingCost,
        inputs: cloneItems(blueprint.inputs),
        output: {
          productId: String(recipe.output.productId),
          quantity: blueprint.outputQuantity,
        },
      }),
    ])));
    const { inputs: _inputs, outputQuantity: _outputQuantity, ...definition } = blueprint;
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

export function createProductionMethodGroups(facility, products) {
  const c1Groups = createC1ProductionMethodGroups(facility);
  if (c1Groups) return c1Groups;
  const prices = productPriceMap(products);
  const useCentAlignment = facility.complexity === 'C1';
  const methods = METHOD_DEFINITIONS.map((definition) => {
    const plansByRecipeId = Object.freeze(Object.fromEntries(
      facility.recipes.map((recipe) => {
        const expectedProfitPerMinute = referenceProfitPerMinute(recipe, prices);
        return [
          recipe.id,
          freezePlan(createBalancedPlan(
            recipe, definition.id, prices, expectedProfitPerMinute, useCentAlignment,
          )),
        ];
      }),
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
        id: plan.recipeId,
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
