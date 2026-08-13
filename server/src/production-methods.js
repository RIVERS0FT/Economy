export const PRODUCTION_METHOD_GROUP_ID = 'operation';
export const DEFAULT_PRODUCTION_METHOD_ID = 'standard';

const METHOD_DEFINITIONS = Object.freeze([
  Object.freeze({
    id: 'standard',
    name: '标准生产',
    description: '保持正式配方的标准周期、投入、产出与成本。',
    tone: 'neutral',
    requiredTechnologyIds: Object.freeze([]),
  }),
  Object.freeze({
    id: 'rapid',
    name: '高速生产',
    description: '缩短生产周期并提高单周期成本，更快消耗资金与原料。',
    tone: 'warning',
    requiredTechnologyIds: Object.freeze([]),
  }),
  Object.freeze({
    id: 'economical',
    name: '节约生产',
    description: '延长生产周期并降低单周期成本，减少短期资金压力。',
    tone: 'success',
    requiredTechnologyIds: Object.freeze([]),
  }),
  Object.freeze({
    id: 'high-yield',
    name: '高产生产',
    description: '同周期投入与产出翻倍，提高吞吐量与仓库压力。',
    tone: 'accent',
    requiredTechnologyIds: Object.freeze([]),
  }),
]);

function dedicatedMethod(definition) {
  return Object.freeze({
    ...definition,
    additionalInputs: Object.freeze((definition.additionalInputs || []).map((item) => Object.freeze({ ...item }))),
    baseInputQuantities: definition.baseInputQuantities
      ? Object.freeze([...definition.baseInputQuantities])
      : undefined,
    requiredTechnologyIds: Object.freeze([...(definition.requiredTechnologyIds || [])]),
  });
}

const FACILITY_METHOD_BLUEPRINTS = Object.freeze({
  farm: Object.freeze([
    dedicatedMethod({ id: 'standard', name: '基础耕作', description: '保持基础耕作，不消耗额外生产资料。', tone: 'neutral', outputQuantity: 1 }),
    dedicatedMethod({ id: 'assisted', name: '工具耕作', description: '每周期整件消耗 1 工具并提高作物产量。', tone: 'warning', additionalInputs: [{ productId: 'tools', quantity: 1 }], outputQuantity: 12, requiredTechnologyIds: ['tool-operation'] }),
    dedicatedMethod({ id: 'intensive', name: '化肥耕作', description: '每周期整件消耗 2 化肥并进一步提高作物产量。', tone: 'success', additionalInputs: [{ productId: 'fertilizer', quantity: 2 }], outputQuantity: 14, requiredTechnologyIds: ['fertilizer-application'] }),
    dedicatedMethod({ id: 'mechanized', name: '拖拉机耕作', description: '每周期整件消耗 1 拖拉机并获得最高作物产量。', tone: 'accent', additionalInputs: [{ productId: 'tractor', quantity: 1 }], outputQuantity: 16, requiredTechnologyIds: ['tractor-operation'] }),
  ]),
  orchard: Object.freeze([
    dedicatedMethod({ id: 'standard', name: '基础管护', description: '保持基础果园管护，不消耗额外生产资料。', tone: 'neutral', outputQuantity: 1 }),
    dedicatedMethod({ id: 'assisted', name: '工具管护', description: '每周期整件消耗 1 工具并提高水果产量。', tone: 'warning', additionalInputs: [{ productId: 'tools', quantity: 1 }], outputQuantity: 11, requiredTechnologyIds: ['tool-operation'] }),
    dedicatedMethod({ id: 'intensive', name: '化肥管护', description: '每周期整件消耗 2 化肥并进一步提高水果产量。', tone: 'success', additionalInputs: [{ productId: 'fertilizer', quantity: 2 }], outputQuantity: 13, requiredTechnologyIds: ['fertilizer-application'] }),
    dedicatedMethod({ id: 'mechanized', name: '拖拉机管护', description: '每周期整件消耗 1 拖拉机并获得最高水果产量。', tone: 'accent', additionalInputs: [{ productId: 'tractor', quantity: 1 }], outputQuantity: 15, requiredTechnologyIds: ['tractor-operation'] }),
  ]),
  ranch: Object.freeze([
    dedicatedMethod({ id: 'standard', name: '粗放饲养', description: '保持粗放饲养，不消耗额外生产资料。', tone: 'neutral', outputQuantity: 1 }),
    dedicatedMethod({ id: 'assisted', name: '饲料饲养', description: '每周期整件消耗 1 配合饲料并提高畜产品产量。', tone: 'warning', additionalInputs: [{ productId: 'feed', quantity: 1 }], outputQuantity: 4, requiredTechnologyIds: ['feed-husbandry'] }),
    dedicatedMethod({ id: 'intensive', name: '药剂精养', description: '每周期整件消耗 1 养殖药剂并进一步提高畜产品产量。', tone: 'success', additionalInputs: [{ productId: 'veterinary-medicine', quantity: 1 }], outputQuantity: 8, requiredTechnologyIds: ['veterinary-application'] }),
    dedicatedMethod({ id: 'mechanized', name: '机械化养殖', description: '每周期整件消耗 1 机械并获得最高畜产品产量。', tone: 'accent', additionalInputs: [{ productId: 'machinery', quantity: 1 }], outputQuantity: 9, requiredTechnologyIds: ['machinery-operation'] }),
  ]),
  fishery: Object.freeze([
    dedicatedMethod({ id: 'standard', name: '粗放养殖', description: '保持粗放养殖，不消耗额外生产资料。', tone: 'neutral', outputQuantity: 1 }),
    dedicatedMethod({ id: 'assisted', name: '饲料精养', description: '每周期整件消耗 1 配合饲料并提高鱼类产量。', tone: 'warning', additionalInputs: [{ productId: 'feed', quantity: 1 }], outputQuantity: 4, requiredTechnologyIds: ['feed-husbandry'] }),
    dedicatedMethod({ id: 'intensive', name: '药剂精养', description: '每周期整件消耗 1 养殖药剂并进一步提高鱼类产量。', tone: 'success', additionalInputs: [{ productId: 'veterinary-medicine', quantity: 1 }], outputQuantity: 8, requiredTechnologyIds: ['veterinary-application'] }),
    dedicatedMethod({ id: 'mechanized', name: '机械化养殖', description: '每周期整件消耗 1 机械并获得最高鱼类产量。', tone: 'accent', additionalInputs: [{ productId: 'machinery', quantity: 1 }], outputQuantity: 9, requiredTechnologyIds: ['machinery-operation'] }),
  ]),
  'logging-camp': Object.freeze([
    dedicatedMethod({ id: 'standard', name: '基础采伐', description: '采用基础人工作业采伐木材。', tone: 'neutral', outputQuantity: 2, operatingCost: 9 }),
    dedicatedMethod({ id: 'assisted', name: '锯具采伐', description: '每周期整件消耗 1 工具，提高木材采伐量。', tone: 'warning', additionalInputs: [{ productId: 'tools', quantity: 1 }], outputQuantity: 4, operatingCost: 6, requiredTechnologyIds: ['tool-operation'] }),
    dedicatedMethod({ id: 'intensive', name: '动力采伐', description: '工具配合工业燃料形成动力采伐线。', tone: 'success', additionalInputs: [{ productId: 'tools', quantity: 1 }, { productId: 'industrial-fuel', quantity: 1 }], outputQuantity: 5, operatingCost: 5, requiredTechnologyIds: ['tool-operation', 'industrial-fuel-operation'] }),
    dedicatedMethod({ id: 'mechanized', name: '机械化采伐', description: '机械与工业燃料共同驱动最高强度采伐。', tone: 'accent', additionalInputs: [{ productId: 'machinery', quantity: 1 }, { productId: 'industrial-fuel', quantity: 2 }], outputQuantity: 7, operatingCost: 7.95, requiredTechnologyIds: ['machinery-operation', 'industrial-fuel-operation'] }),
  ]),
  mine: Object.freeze([
    dedicatedMethod({ id: 'standard', name: '常规开采', description: '保持常规矿井开采方式。', tone: 'neutral', outputQuantity: 2, operatingCost: 11 }),
    dedicatedMethod({ id: 'assisted', name: '钻具开采', description: '每周期整件消耗 1 工具，提高矿石产量。', tone: 'warning', additionalInputs: [{ productId: 'tools', quantity: 1 }], outputQuantity: 4, operatingCost: 10, requiredTechnologyIds: ['tool-operation'] }),
    dedicatedMethod({ id: 'intensive', name: '爆破开采', description: '工具与工业化学品配合进行强化开采。', tone: 'success', additionalInputs: [{ productId: 'tools', quantity: 1 }, { productId: 'industrial-chemicals', quantity: 1 }], outputQuantity: 5, operatingCost: 9, requiredTechnologyIds: ['tool-operation', 'industrial-chemical-operation'] }),
    dedicatedMethod({ id: 'mechanized', name: '机械化采矿', description: '机械、工业化学品与工业燃料组成完整机械化矿山。', tone: 'accent', additionalInputs: [{ productId: 'machinery', quantity: 1 }, { productId: 'industrial-chemicals', quantity: 1 }, { productId: 'industrial-fuel', quantity: 1 }], outputQuantity: 6, operatingCost: 6.95, requiredTechnologyIds: ['machinery-operation', 'industrial-chemical-operation', 'industrial-fuel-operation'] }),
  ]),
  'oil-field': Object.freeze([
    dedicatedMethod({ id: 'standard', name: '常规抽采', description: '保持常规油井抽采方式。', tone: 'neutral', outputQuantity: 2, operatingCost: 15 }),
    dedicatedMethod({ id: 'assisted', name: '化学辅助采油', description: '每周期整件消耗 1 工业化学品提高采收率。', tone: 'warning', additionalInputs: [{ productId: 'industrial-chemicals', quantity: 1 }], outputQuantity: 3, operatingCost: 16, requiredTechnologyIds: ['industrial-chemical-operation'] }),
    dedicatedMethod({ id: 'intensive', name: '机械增产钻采', description: '机械配合工业化学品进行强化钻采。', tone: 'success', additionalInputs: [{ productId: 'machinery', quantity: 1 }, { productId: 'industrial-chemicals', quantity: 1 }], outputQuantity: 5, operatingCost: 15.45, requiredTechnologyIds: ['machinery-operation', 'industrial-chemical-operation'] }),
    dedicatedMethod({ id: 'mechanized', name: '动力机械钻采', description: '机械、工业化学品与工业燃料组成最高强度钻采体系。', tone: 'accent', additionalInputs: [{ productId: 'machinery', quantity: 1 }, { productId: 'industrial-chemicals', quantity: 1 }, { productId: 'industrial-fuel', quantity: 1 }], outputQuantity: 6, operatingCost: 18.95, requiredTechnologyIds: ['machinery-operation', 'industrial-chemical-operation', 'industrial-fuel-operation'] }),
  ]),
  mill: Object.freeze([
    dedicatedMethod({ id: 'standard', name: '基础加工', description: '保持基础粮食或糖料加工。', tone: 'neutral', outputQuantity: 1, operatingCost: 8.6 }),
    dedicatedMethod({ id: 'assisted', name: '辊式加工', description: '扩大原料批量并整件消耗工具进行辊式加工。', tone: 'warning', baseInputQuantities: [4], additionalInputs: [{ productId: 'tools', quantity: 1 }], outputQuantity: 2, operatingCost: 5.2, requiredTechnologyIds: ['tool-operation'] }),
    dedicatedMethod({ id: 'intensive', name: '机械加工', description: '扩大原料批量并整件消耗机械进行加工。', tone: 'success', baseInputQuantities: [6], additionalInputs: [{ productId: 'machinery', quantity: 1 }], outputQuantity: 3, operatingCost: 10.25, requiredTechnologyIds: ['machinery-operation'] }),
    dedicatedMethod({ id: 'mechanized', name: '连续化加工', description: '机械与工业燃料驱动连续化加工线。', tone: 'accent', baseInputQuantities: [6], additionalInputs: [{ productId: 'machinery', quantity: 1 }, { productId: 'industrial-fuel', quantity: 1 }], outputQuantity: 4, operatingCost: 18.25, requiredTechnologyIds: ['machinery-operation', 'industrial-fuel-operation'] }),
  ]),
  sawmill: Object.freeze([
    dedicatedMethod({ id: 'standard', name: '基础锯切', description: '保持基础木材锯切方式。', tone: 'neutral', outputQuantity: 1, operatingCost: 3 }),
    dedicatedMethod({ id: 'assisted', name: '锯具流水线', description: '扩大木材批量并整件消耗工具形成锯切流水线。', tone: 'warning', baseInputQuantities: [8], additionalInputs: [{ productId: 'tools', quantity: 1 }], outputQuantity: 4, operatingCost: 4, requiredTechnologyIds: ['tool-operation'] }),
    dedicatedMethod({ id: 'intensive', name: '机械制材', description: '机械提高木材利用率与制材吞吐。', tone: 'success', baseInputQuantities: [7], additionalInputs: [{ productId: 'machinery', quantity: 1 }], outputQuantity: 4, operatingCost: 4.45, requiredTechnologyIds: ['machinery-operation'] }),
    dedicatedMethod({ id: 'mechanized', name: '动力连续制材', description: '机械与工业燃料驱动连续制材线。', tone: 'accent', baseInputQuantities: [8], additionalInputs: [{ productId: 'machinery', quantity: 1 }, { productId: 'industrial-fuel', quantity: 1 }], outputQuantity: 5, operatingCost: 10.45, requiredTechnologyIds: ['machinery-operation', 'industrial-fuel-operation'] }),
  ]),
  'feed-factory': Object.freeze([
    dedicatedMethod({ id: 'standard', name: '基础配制', description: '保持基础配合饲料配制方式。', tone: 'neutral', outputQuantity: 2, operatingCost: 4.9 }),
    dedicatedMethod({ id: 'assisted', name: '批量配料', description: '扩大原料批量并整件消耗工具辅助配料。', tone: 'warning', baseInputQuantities: [4, 2], additionalInputs: [{ productId: 'tools', quantity: 1 }], outputQuantity: 5, operatingCost: 3.6, requiredTechnologyIds: ['tool-operation'] }),
    dedicatedMethod({ id: 'intensive', name: '机械混配', description: '机械完成大批量稳定混配。', tone: 'success', baseInputQuantities: [6, 3], additionalInputs: [{ productId: 'machinery', quantity: 1 }], outputQuantity: 8, operatingCost: 10.75, requiredTechnologyIds: ['machinery-operation'] }),
    dedicatedMethod({ id: 'mechanized', name: '动力连续混配', description: '机械与工业燃料驱动连续混配生产线。', tone: 'accent', baseInputQuantities: [8, 4], additionalInputs: [{ productId: 'machinery', quantity: 1 }, { productId: 'industrial-fuel', quantity: 1 }], outputQuantity: 11, operatingCost: 18.95, requiredTechnologyIds: ['machinery-operation', 'industrial-fuel-operation'] }),
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
  let cycleMs = methodId === 'high-yield'
    ? recipe.cycleMs
    : alignedCycleMs(recipe.cycleMs, expectedProfitPerMinute, methodId);
  const outputValueUnits = valueOfItemsUnits([output], prices);
  const inputValueUnits = valueOfItemsUnits(inputs, prices);
  const profitPerMinuteUnits = moneyUnits(expectedProfitPerMinute, '参考分钟利润');
  let profitNumerator = profitPerMinuteUnits * cycleMs;
  if (!Number.isSafeInteger(profitNumerator) || profitNumerator % 60_000 !== 0) {
    throw new Error(`${baseRecipeId}/${methodId} 无法形成分币精确的参考利润`);
  }
  let operatingCostUnits = outputValueUnits - inputValueUnits - profitNumerator / 60_000;
  if (methodId === 'economical' && operatingCostUnits < 0) {
    const baseOperatingCostUnits = moneyUnits(recipe.operatingCost, '基础周期成本');
    for (let candidateCycleMs = cycleMs - 1_000; candidateCycleMs > recipe.cycleMs; candidateCycleMs -= 1_000) {
      const candidateProfitNumerator = profitPerMinuteUnits * candidateCycleMs;
      if (!Number.isSafeInteger(candidateProfitNumerator) || candidateProfitNumerator % 60_000 !== 0) continue;
      const candidateOperatingCostUnits = outputValueUnits - inputValueUnits - candidateProfitNumerator / 60_000;
      if (
        Number.isSafeInteger(candidateOperatingCostUnits)
        && candidateOperatingCostUnits >= 0
        && candidateOperatingCostUnits < baseOperatingCostUnits
      ) {
        cycleMs = candidateCycleMs;
        profitNumerator = candidateProfitNumerator;
        operatingCostUnits = candidateOperatingCostUnits;
        break;
      }
    }
  }
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

function inputsForDedicatedMethod(recipe, blueprint) {
  const baseInputs = cloneItems(recipe.inputs || (recipe.input ? [recipe.input] : []));
  const normalizedBaseInputs = blueprint.baseInputQuantities
    ? baseInputs.map((item, index) => ({
      ...item,
      quantity: Math.max(0, Math.floor(Number(blueprint.baseInputQuantities[index]) || 0)),
    }))
    : baseInputs;
  if (blueprint.baseInputQuantities && blueprint.baseInputQuantities.length !== baseInputs.length) {
    throw new Error(`${recipe.id}/${blueprint.id} 基础投入数量与配方输入数量不一致`);
  }
  return [...normalizedBaseInputs, ...cloneItems(blueprint.additionalInputs)];
}

function createDedicatedProductionMethodGroups(facility) {
  const blueprints = FACILITY_METHOD_BLUEPRINTS[facility.id];
  if (!blueprints) return null;
  const methods = blueprints.map((blueprint) => {
    const plansByRecipeId = Object.freeze(Object.fromEntries(facility.recipes.map((recipe) => [
      recipe.id,
      freezePlan({
        recipeId: variantRecipeId(recipe.id, blueprint.id),
        baseRecipeId: recipe.id,
        productionMethodId: blueprint.id,
        cycleMs: recipe.cycleMs,
        operatingCost: blueprint.operatingCost ?? recipe.operatingCost,
        inputs: inputsForDedicatedMethod(recipe, blueprint),
        output: {
          productId: String(recipe.output.productId),
          quantity: blueprint.outputQuantity ?? recipe.output.quantity,
        },
      }),
    ])));
    const {
      additionalInputs: _additionalInputs,
      baseInputQuantities: _baseInputQuantities,
      outputQuantity: _outputQuantity,
      operatingCost: _operatingCost,
      ...definition
    } = blueprint;
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
  const dedicatedGroups = createDedicatedProductionMethodGroups(facility);
  if (dedicatedGroups) return dedicatedGroups;
  const prices = productPriceMap(products);
  const methods = METHOD_DEFINITIONS.map((definition) => {
    const plansByRecipeId = Object.freeze(Object.fromEntries(
      facility.recipes.map((recipe) => {
        const expectedProfitPerMinute = referenceProfitPerMinute(recipe, prices);
        return [
          recipe.id,
          freezePlan(createBalancedPlan(recipe, definition.id, prices, expectedProfitPerMinute)),
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