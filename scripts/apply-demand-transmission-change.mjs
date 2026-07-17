import { readFileSync, writeFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const write = (path, content) => writeFileSync(path, content);
const replaceExact = (source, before, after, label) => {
  if (!source.includes(before)) throw new Error(`Missing exact block: ${label}`);
  return source.replace(before, after);
};
const replaceRegex = (source, pattern, after, label) => {
  if (!pattern.test(source)) throw new Error(`Missing pattern: ${label}`);
  return source.replace(pattern, after);
};
const removeTest = (source, name) => {
  const marker = `test('${name}'`;
  const start = source.indexOf(marker);
  if (start < 0) throw new Error(`Missing test: ${name}`);
  const next = source.indexOf("\ntest('", start + marker.length);
  return source.slice(0, start) + (next < 0 ? '' : source.slice(next + 1));
};
const replaceVersionHeaders = (source) => source
  .replaceAll('客户端状态版本：`13`', '客户端状态版本：`14`')
  .replaceAll('世界状态版本：`9`', '世界状态版本：`10`')
  .replaceAll('客户端状态版本：13', '客户端状态版本：14')
  .replaceAll('世界状态版本：9', '世界状态版本：10');

write('server/src/domain.js', "import { randomUUID } from 'node:crypto';\nimport * as core from './domain-core.js';\nimport { createBalancedMarketRuntime } from './balanced-market.js';\n\nexport * from './domain-core.js';\n\nconst clone = (value) => structuredClone(value);\nconst PRICE_WINDOW_MS = 30 * 60 * 1000;\nconst PRICE_MIN_MULTIPLIER = 0.5;\nconst PRICE_MAX_MULTIPLIER = 3;\nconst PRICE_RISE_RATE = 0.3;\nconst PRICE_FALL_RATE = 0.2;\nconst PRICE_MAX_RISE_PER_CYCLE = 0.08;\nconst PRICE_MAX_FALL_PER_CYCLE = 0.06;\nconst PRICE_BASE_REVERSION = 0.02;\n\nconst PRODUCT_BALANCE = Object.freeze({\n  wheat: Object.freeze({ basePrice: 2 }),\n  rice: Object.freeze({ basePrice: 2 }),\n  cotton: Object.freeze({ basePrice: 2 }),\n  timber: Object.freeze({ basePrice: 5 }),\n  ore: Object.freeze({ basePrice: 6 }),\n  'copper-ore': Object.freeze({ basePrice: 6 }),\n  'crude-oil': Object.freeze({ basePrice: 8 }),\n  meat: Object.freeze({ basePrice: 6 }),\n  eggs: Object.freeze({ basePrice: 3 }),\n  milk: Object.freeze({ basePrice: 3 }),\n  wool: Object.freeze({ basePrice: 6 }),\n  flour: Object.freeze({ basePrice: 13 }),\n  lumber: Object.freeze({ basePrice: 15 }),\n  steel: Object.freeze({ basePrice: 24 }),\n  copper: Object.freeze({ basePrice: 24 }),\n  plastic: Object.freeze({ basePrice: 24 }),\n  textile: Object.freeze({ basePrice: 18 }),\n  food: Object.freeze({ basePrice: 15 }),\n  furniture: Object.freeze({ basePrice: 20 }),\n  clothing: Object.freeze({ basePrice: 48 }),\n  machinery: Object.freeze({ basePrice: 60 }),\n  electronics: Object.freeze({ basePrice: 64 }),\n});\n\nconst PRODUCT_DEMAND = Object.freeze({\n  wheat: Object.freeze({ populationDemandGroupId: 'food', populationDemandTier: 'raw' }),\n  rice: Object.freeze({ populationDemandGroupId: 'food', populationDemandTier: 'raw' }),\n  flour: Object.freeze({ populationDemandGroupId: 'food', populationDemandTier: 'intermediate' }),\n  food: Object.freeze({ populationDemandGroupId: 'food', populationDemandTier: 'final' }),\n  meat: Object.freeze({ populationDemandGroupId: 'food', populationDemandTier: 'final' }),\n  eggs: Object.freeze({ populationDemandGroupId: 'food', populationDemandTier: 'final' }),\n  milk: Object.freeze({ populationDemandGroupId: 'food', populationDemandTier: 'final' }),\n  timber: Object.freeze({ populationDemandGroupId: 'household', populationDemandTier: 'raw' }),\n  cotton: Object.freeze({ populationDemandGroupId: 'household', populationDemandTier: 'raw' }),\n  wool: Object.freeze({ populationDemandGroupId: 'household', populationDemandTier: 'raw' }),\n  'copper-ore': Object.freeze({ populationDemandGroupId: 'household', populationDemandTier: 'raw' }),\n  'crude-oil': Object.freeze({ populationDemandGroupId: 'household', populationDemandTier: 'raw' }),\n  lumber: Object.freeze({ populationDemandGroupId: 'household', populationDemandTier: 'intermediate' }),\n  textile: Object.freeze({ populationDemandGroupId: 'household', populationDemandTier: 'intermediate' }),\n  copper: Object.freeze({ populationDemandGroupId: 'household', populationDemandTier: 'intermediate' }),\n  plastic: Object.freeze({ populationDemandGroupId: 'household', populationDemandTier: 'intermediate' }),\n  furniture: Object.freeze({ populationDemandGroupId: 'household', populationDemandTier: 'final' }),\n  clothing: Object.freeze({ populationDemandGroupId: 'household', populationDemandTier: 'final' }),\n  electronics: Object.freeze({ populationDemandGroupId: 'household', populationDemandTier: 'final' }),\n});\n\nconst FACILITY_BALANCE = Object.freeze({\n  farm: Object.freeze({ cycleMs: 120_000, operatingCost: 6 }),\n  'logging-camp': Object.freeze({ cycleMs: 60_000, operatingCost: 9 }),\n  mine: Object.freeze({ cycleMs: 60_000, operatingCost: 11 }),\n  ranch: Object.freeze({ cycleMs: 120_000, operatingCost: 16 }),\n  'oil-field': Object.freeze({ cycleMs: 60_000, operatingCost: 15 }),\n  mill: Object.freeze({ cycleMs: 40_000, operatingCost: 7 }),\n  sawmill: Object.freeze({ cycleMs: 40_000, operatingCost: 3 }),\n  steelworks: Object.freeze({ cycleMs: 40_000, operatingCost: 4 }),\n  refinery: Object.freeze({ cycleMs: 40_000, operatingCost: 6 }),\n  'textile-mill': Object.freeze({ cycleMs: 40_000, operatingCost: 4 }),\n  'food-factory': Object.freeze({ cycleMs: 50_000, operatingCost: 14 }),\n  'furniture-factory': Object.freeze({ cycleMs: 60_000, operatingCost: 4 }),\n  'garment-factory': Object.freeze({ cycleMs: 60_000, operatingCost: 6 }),\n  'machine-factory': Object.freeze({ cycleMs: 60_000, operatingCost: 6 }),\n  'electronics-factory': Object.freeze({ cycleMs: 60_000, operatingCost: 10 }),\n});\n\nexport const PRODUCT_CATALOG = Object.freeze(core.PRODUCT_CATALOG.map((product) => {\n  const {\n    family: _family,\n    substitutionGroupId: _substitutionGroupId,\n    systemDemandMode: _systemDemandMode,\n    ...base\n  } = product;\n  return Object.freeze({\n    ...base,\n    ...PRODUCT_BALANCE[product.id],\n    ...(PRODUCT_DEMAND[product.id] || {}),\n  });\n}));\n\nexport const FACILITY_TYPE_CATALOG = Object.freeze(core.FACILITY_TYPE_CATALOG.map((facility) => {\n  const balance = FACILITY_BALANCE[facility.id] || {};\n  const recipes = facility.recipes.map((recipe) => Object.freeze({\n    ...recipe,\n    cycleMs: balance.cycleMs ?? recipe.cycleMs,\n    operatingCost: balance.operatingCost ?? recipe.operatingCost,\n    inputs: Object.freeze((recipe.inputs || []).map((item) => Object.freeze({ ...item }))),\n    output: Object.freeze({ ...recipe.output }),\n  }));\n  const defaultRecipe = recipes.find((recipe) => recipe.id === facility.defaultRecipeId) || recipes[0];\n  return Object.freeze({\n    ...facility,\n    cycleMs: defaultRecipe.cycleMs,\n    operatingCost: defaultRecipe.operatingCost,\n    inputs: defaultRecipe.inputs,\n    input: defaultRecipe.inputs.length === 1 ? defaultRecipe.inputs[0] : null,\n    output: defaultRecipe.output,\n    recipes: Object.freeze(recipes),\n  });\n}));\n\nexport const DEMAND_GROUP_CATALOG = Object.freeze([\n  Object.freeze({\n    id: 'food',\n    name: '饮食需求',\n    ownerName: '饮食需求',\n    cycleMs: core.ECONOMY_CONSTANTS.demandCycleMs,\n    baseBudget: 330,\n    priceElasticity: 3,\n    maxQuoteIndex: 2,\n    quoteUtilityDepth: 12,\n    products: Object.freeze([\n      Object.freeze({ productId: 'wheat', utilityPerUnit: 1, baseBudgetWeight: 0.05, maxBudgetShare: 0.25 }),\n      Object.freeze({ productId: 'rice', utilityPerUnit: 1, baseBudgetWeight: 0.05, maxBudgetShare: 0.25 }),\n      Object.freeze({ productId: 'flour', utilityPerUnit: 2, baseBudgetWeight: 0.20, maxBudgetShare: 0.35 }),\n      Object.freeze({ productId: 'food', utilityPerUnit: 3, baseBudgetWeight: 0.30, maxBudgetShare: 0.55 }),\n      Object.freeze({ productId: 'meat', utilityPerUnit: 2, baseBudgetWeight: 0.15, maxBudgetShare: 0.35 }),\n      Object.freeze({ productId: 'eggs', utilityPerUnit: 1, baseBudgetWeight: 0.125, maxBudgetShare: 0.25 }),\n      Object.freeze({ productId: 'milk', utilityPerUnit: 1, baseBudgetWeight: 0.125, maxBudgetShare: 0.25 }),\n    ]),\n  }),\n  Object.freeze({\n    id: 'household',\n    name: '家庭用品需求',\n    ownerName: '家庭用品需求',\n    cycleMs: core.ECONOMY_CONSTANTS.demandCycleMs,\n    baseBudget: 320,\n    priceElasticity: 2,\n    maxQuoteIndex: 2,\n    quoteUtilityDepth: 8,\n    products: Object.freeze([\n      Object.freeze({ productId: 'timber', utilityPerUnit: 1, baseBudgetWeight: 0.02, maxBudgetShare: 0.20 }),\n      Object.freeze({ productId: 'cotton', utilityPerUnit: 1, baseBudgetWeight: 0.02, maxBudgetShare: 0.20 }),\n      Object.freeze({ productId: 'wool', utilityPerUnit: 1, baseBudgetWeight: 0.02, maxBudgetShare: 0.20 }),\n      Object.freeze({ productId: 'copper-ore', utilityPerUnit: 1, baseBudgetWeight: 0.02, maxBudgetShare: 0.20 }),\n      Object.freeze({ productId: 'crude-oil', utilityPerUnit: 1, baseBudgetWeight: 0.02, maxBudgetShare: 0.20 }),\n      Object.freeze({ productId: 'lumber', utilityPerUnit: 1, baseBudgetWeight: 0.05, maxBudgetShare: 0.30 }),\n      Object.freeze({ productId: 'textile', utilityPerUnit: 1, baseBudgetWeight: 0.05, maxBudgetShare: 0.30 }),\n      Object.freeze({ productId: 'copper', utilityPerUnit: 1, baseBudgetWeight: 0.05, maxBudgetShare: 0.30 }),\n      Object.freeze({ productId: 'plastic', utilityPerUnit: 1, baseBudgetWeight: 0.05, maxBudgetShare: 0.30 }),\n      Object.freeze({ productId: 'furniture', utilityPerUnit: 1, baseBudgetWeight: 0.20, maxBudgetShare: 0.50 }),\n      Object.freeze({ productId: 'clothing', utilityPerUnit: 2, baseBudgetWeight: 0.25, maxBudgetShare: 0.55 }),\n      Object.freeze({ productId: 'electronics', utilityPerUnit: 2, baseBudgetWeight: 0.25, maxBudgetShare: 0.55 }),\n    ]),\n  }),\n]);\n\nconst PRODUCTS = new Map(PRODUCT_CATALOG.map((product) => [product.id, product]));\nconst DEMAND_GROUPS = new Map(DEMAND_GROUP_CATALOG.map((group) => [group.id, group]));\nconst POPULATION_DEMAND_PRODUCT_IDS = new Set(\n  DEMAND_GROUP_CATALOG.flatMap((group) => group.products.map((option) => option.productId)),\n);\nconst PRICE_RECIPES = Object.freeze(FACILITY_TYPE_CATALOG.flatMap((facility) => facility.recipes\n  .filter((recipe) => recipe.inputs.length > 0)\n  .map((recipe) => Object.freeze({\n    facilityTypeId: facility.id,\n    recipeId: recipe.id,\n    operatingCost: recipe.operatingCost,\n    inputs: recipe.inputs,\n    output: recipe.output,\n  }))));\nconst balancedMarket = createBalancedMarketRuntime({\n  products: PRODUCT_CATALOG,\n  constants: core.ECONOMY_CONSTANTS,\n});\n\nfunction productDefinition(productId) {\n  return PRODUCTS.get(String(productId || '')) || PRODUCTS.get('wheat');\n}\n\nfunction isOpenOrder(order) {\n  return Number(order?.remaining || 0) > 0 && (order?.status === 'open' || order?.status === 'partial');\n}\n\nfunction marketFor(world, productId) {\n  return balancedMarket.marketFor(world, productId);\n}\n\nfunction defaultDemandGroupState(group, now) {\n  return {\n    demandGroupId: group.id,\n    cycleMs: group.cycleMs,\n    nextDemandAt: now + group.cycleMs,\n    lastCycleId: Math.floor(now / group.cycleMs),\n    lastBudget: group.baseBudget,\n    lastCommitted: 0,\n    satisfaction: 0,\n    lastAllocation: {},\n  };\n}\n\nfunction defaultProductPriceState(product, cycleId) {\n  return {\n    observedPrice: product.basePrice,\n    costAnchor: null,\n    downstreamValueAnchor: null,\n    targetPrice: product.basePrice,\n    referencePrice: product.basePrice,\n    lastUpdatedCycleId: cycleId,\n  };\n}\n\nfunction defaultPriceTransmissionState(now) {\n  const cycleId = Math.floor(now / core.ECONOMY_CONSTANTS.demandCycleMs);\n  return {\n    cycleMs: core.ECONOMY_CONSTANTS.demandCycleMs,\n    lastCycleId: cycleId,\n    products: Object.fromEntries(PRODUCT_CATALOG.map((product) => [\n      product.id,\n      defaultProductPriceState(product, cycleId),\n    ])),\n  };\n}\n\nfunction normalizeDemandWorld(world, now = Date.now()) {\n  world.demandGroups ||= {};\n  const legacyGroups = world.demandGroups;\n  const normalizedGroups = {};\n  for (const group of DEMAND_GROUP_CATALOG) {\n    const legacyId = group.id === 'food' ? 'staples' : 'household-goods';\n    const current = legacyGroups[group.id] || legacyGroups[legacyId] || {};\n    const state = {\n      ...defaultDemandGroupState(group, now),\n      ...current,\n      demandGroupId: group.id,\n      cycleMs: group.cycleMs,\n    };\n    if (!Number.isFinite(Number(state.nextDemandAt))) state.nextDemandAt = now + group.cycleMs;\n    if (!Number.isFinite(Number(state.lastCycleId))) state.lastCycleId = Math.floor(now / group.cycleMs);\n    if (!state.lastAllocation || typeof state.lastAllocation !== 'object') state.lastAllocation = {};\n    normalizedGroups[group.id] = state;\n    for (const option of group.products) {\n      const market = marketFor(world, option.productId);\n      market.demand ||= {};\n      market.demand.cycleMs = group.cycleMs;\n    }\n  }\n  world.demandGroups = normalizedGroups;\n\n  const fallback = defaultPriceTransmissionState(now);\n  const currentTransmission = world.priceTransmission && typeof world.priceTransmission === 'object'\n    ? world.priceTransmission\n    : {};\n  world.priceTransmission = {\n    ...fallback,\n    ...currentTransmission,\n    cycleMs: core.ECONOMY_CONSTANTS.demandCycleMs,\n    products: {},\n  };\n  if (!Number.isFinite(Number(world.priceTransmission.lastCycleId))) {\n    world.priceTransmission.lastCycleId = fallback.lastCycleId;\n  }\n  for (const product of PRODUCT_CATALOG) {\n    const market = marketFor(world, product.id);\n    const previous = currentTransmission.products?.[product.id] || {};\n    const referenceFallback = Number(market.demand?.referencePrice || market.demand?.lastPrice || product.basePrice);\n    const state = {\n      ...defaultProductPriceState(product, world.priceTransmission.lastCycleId),\n      ...previous,\n      referencePrice: Number.isFinite(Number(previous.referencePrice))\n        ? Number(previous.referencePrice)\n        : referenceFallback,\n    };\n    for (const key of ['observedPrice', 'targetPrice']) {\n      if (!Number.isFinite(Number(state[key])) || Number(state[key]) <= 0) state[key] = product.basePrice;\n    }\n    for (const key of ['costAnchor', 'downstreamValueAnchor']) {\n      if (state[key] !== null && (!Number.isFinite(Number(state[key])) || Number(state[key]) <= 0)) state[key] = null;\n    }\n    world.priceTransmission.products[product.id] = state;\n    market.demand.referencePrice = state.referencePrice;\n    market.demand.observedPrice = state.observedPrice;\n    market.demand.costAnchor = state.costAnchor;\n    market.demand.downstreamValueAnchor = state.downstreamValueAnchor;\n    market.demand.targetPrice = state.targetPrice;\n  }\n  return world;\n}\n\nfunction realTradeStats(world, productId, now) {\n  const points = (marketFor(world, productId).priceHistory || []).filter((point) => (\n    Number(point.createdAt || 0) >= now - PRICE_WINDOW_MS\n    && (point.takerSide === 'buy' || point.takerSide === 'sell')\n    && Number(point.quantity || 0) > 0\n    && Number(point.price || 0) > 0\n  ));\n  const quantity = points.reduce((sum, point) => sum + Number(point.quantity), 0);\n  const value = points.reduce((sum, point) => sum + Number(point.quantity) * Number(point.price), 0);\n  return { quantity, vwap: quantity > 0 ? value / quantity : null };\n}\n\nfunction geometricWeightedMean(signals) {\n  const active = signals.filter((signal) => Number.isFinite(signal.value) && signal.value > 0 && signal.weight > 0);\n  const totalWeight = active.reduce((sum, signal) => sum + signal.weight, 0);\n  if (totalWeight <= 0) return null;\n  return Math.exp(active.reduce((sum, signal) => sum + signal.weight * Math.log(signal.value), 0) / totalWeight);\n}\n\nfunction productSignalPrice(snapshot, product) {\n  const state = snapshot[product.id];\n  return Math.max(\n    product.basePrice * PRICE_MIN_MULTIPLIER,\n    Number(state.referencePrice || product.basePrice) * 0.55 + Number(state.observedPrice || product.basePrice) * 0.45,\n  );\n}\n\nfunction targetProfitForRecipe(recipe) {\n  const outputProduct = productDefinition(recipe.output.productId);\n  const revenue = outputProduct.basePrice * recipe.output.quantity;\n  const inputs = recipe.inputs.reduce((sum, input) => sum + productDefinition(input.productId).basePrice * input.quantity, 0);\n  return Math.max(0, revenue - inputs - recipe.operatingCost);\n}\n\nfunction calculatePriceAnchors(world, snapshot, now) {\n  const costCandidates = new Map(PRODUCT_CATALOG.map((product) => [product.id, []]));\n  const downstreamCandidates = new Map(PRODUCT_CATALOG.map((product) => [product.id, []]));\n\n  for (const recipe of PRICE_RECIPES) {\n    const outputProduct = productDefinition(recipe.output.productId);\n    const profit = targetProfitForRecipe(recipe);\n    const inputCost = recipe.inputs.reduce((sum, input) => (\n      sum + productSignalPrice(snapshot, productDefinition(input.productId)) * input.quantity\n    ), 0);\n    const unitCost = (inputCost + recipe.operatingCost + profit) / recipe.output.quantity;\n    costCandidates.get(outputProduct.id).push(unitCost);\n\n    const outputStats = realTradeStats(world, outputProduct.id, now);\n    const outputMarket = marketFor(world, outputProduct.id);\n    const satisfaction = Math.max(0, Math.min(1, Number(outputMarket.demand?.satisfaction || 0)));\n    const activityWeight = Math.max(0.25, outputStats.quantity) * (0.25 + 0.75 * satisfaction);\n    const outputValue = productSignalPrice(snapshot, outputProduct) * recipe.output.quantity;\n    for (const input of recipe.inputs) {\n      const otherInputCost = recipe.inputs.reduce((sum, other) => (\n        other.productId === input.productId\n          ? sum\n          : sum + productSignalPrice(snapshot, productDefinition(other.productId)) * other.quantity\n      ), 0);\n      const netback = (outputValue - recipe.operatingCost - profit - otherInputCost) / input.quantity;\n      if (Number.isFinite(netback) && netback > 0) {\n        downstreamCandidates.get(input.productId).push({ value: netback, weight: activityWeight });\n      }\n    }\n  }\n\n  return Object.fromEntries(PRODUCT_CATALOG.map((product) => {\n    const costs = costCandidates.get(product.id);\n    const downstream = downstreamCandidates.get(product.id);\n    const costAnchor = costs.length > 0 ? Math.min(...costs) : null;\n    const downstreamValueAnchor = downstream.length > 0\n      ? downstream.reduce((sum, item) => sum + item.value * item.weight, 0)\n        / downstream.reduce((sum, item) => sum + item.weight, 0)\n      : null;\n    return [product.id, { costAnchor, downstreamValueAnchor }];\n  }));\n}\n\nfunction priceWeights(product) {\n  switch (product.populationDemandTier) {\n    case 'raw':\n      return { base: 0.20, observed: 0.35, cost: 0, downstream: 0.45 };\n    case 'intermediate':\n      return { base: 0.10, observed: 0.30, cost: 0.30, downstream: 0.30 };\n    case 'final':\n      return { base: 0.20, observed: 0.35, cost: 0.45, downstream: 0 };\n    default:\n      return { base: 0.35, observed: 0.45, cost: 0.10, downstream: 0.10 };\n  }\n}\n\nfunction processPriceTransmission(world, now) {\n  normalizeDemandWorld(world, now);\n  const cycleId = Math.floor(now / world.priceTransmission.cycleMs);\n  if (cycleId <= Number(world.priceTransmission.lastCycleId)) return false;\n\n  const snapshot = clone(world.priceTransmission.products);\n  const anchors = calculatePriceAnchors(world, snapshot, now);\n  for (const product of PRODUCT_CATALOG) {\n    const previous = snapshot[product.id] || defaultProductPriceState(product, cycleId - 1);\n    const tradeStats = realTradeStats(world, product.id, now);\n    const observedPrice = tradeStats.vwap === null\n      ? Number(previous.observedPrice || product.basePrice) * (1 - PRICE_BASE_REVERSION)\n        + product.basePrice * PRICE_BASE_REVERSION\n      : Number(previous.observedPrice || product.basePrice) * 0.70 + tradeStats.vwap * 0.30;\n    const { costAnchor, downstreamValueAnchor } = anchors[product.id];\n    const weights = priceWeights(product);\n    const targetRaw = geometricWeightedMean([\n      { value: product.basePrice, weight: weights.base },\n      { value: observedPrice, weight: weights.observed },\n      { value: costAnchor, weight: weights.cost },\n      { value: downstreamValueAnchor, weight: weights.downstream },\n    ]) || product.basePrice;\n    const targetPrice = Math.max(\n      product.basePrice * PRICE_MIN_MULTIPLIER,\n      Math.min(product.basePrice * PRICE_MAX_MULTIPLIER, targetRaw),\n    );\n    const oldReference = Math.max(0.01, Number(previous.referencePrice || product.basePrice));\n    const adjustmentRate = targetPrice >= oldReference ? PRICE_RISE_RATE : PRICE_FALL_RATE;\n    const unconstrained = oldReference + adjustmentRate * (targetPrice - oldReference);\n    const minimum = oldReference * (1 - PRICE_MAX_FALL_PER_CYCLE);\n    const maximum = oldReference * (1 + PRICE_MAX_RISE_PER_CYCLE);\n    const referencePrice = Math.max(\n      product.basePrice * PRICE_MIN_MULTIPLIER,\n      Math.min(product.basePrice * PRICE_MAX_MULTIPLIER, Math.max(minimum, Math.min(maximum, unconstrained))),\n    );\n    const state = {\n      observedPrice,\n      costAnchor,\n      downstreamValueAnchor,\n      targetPrice,\n      referencePrice,\n      lastUpdatedCycleId: cycleId,\n    };\n    world.priceTransmission.products[product.id] = state;\n    const market = marketFor(world, product.id);\n    market.demand.referencePrice = referencePrice;\n    market.demand.observedPrice = observedPrice;\n    market.demand.costAnchor = costAnchor;\n    market.demand.downstreamValueAnchor = downstreamValueAnchor;\n    market.demand.targetPrice = targetPrice;\n  }\n  world.priceTransmission.lastCycleId = cycleId;\n  return true;\n}\n\nfunction expireDemandGroupOrders(world, demandGroupId) {\n  for (const order of world.orders || []) {\n    if (order.ownerType === 'population' && isOpenOrder(order) && order.demandGroupId === demandGroupId) {\n      order.status = 'cancelled';\n    }\n  }\n}\n\nfunction demandQuote(world, product, group, option, limitPrice) {\n  const utilityPerUnit = Math.max(1, Number(option.utilityPerUnit || 1));\n  const quoteQuantity = Math.max(1, Math.ceil(group.quoteUtilityDepth / utilityPerUnit));\n  const asks = (world.orders || [])\n    .filter((order) => order.ownerType === 'player'\n      && order.productId === product.id\n      && order.side === 'sell'\n      && isOpenOrder(order))\n    .sort((left, right) => Number(left.price) - Number(right.price) || Number(left.createdAt) - Number(right.createdAt));\n  if (asks.length === 0) return { quote: limitPrice, quoteQuantity };\n  let remaining = quoteQuantity;\n  let cost = 0;\n  let highestPrice = limitPrice;\n  for (const ask of asks) {\n    if (remaining <= 0) break;\n    const quantity = Math.min(remaining, Math.max(0, Number(ask.remaining || 0)));\n    if (quantity <= 0) continue;\n    highestPrice = Math.max(highestPrice, Number(ask.price || limitPrice));\n    cost += quantity * Number(ask.price || limitPrice);\n    remaining -= quantity;\n  }\n  if (remaining > 0) cost += remaining * highestPrice;\n  return { quote: Math.max(1, cost / quoteQuantity), quoteQuantity };\n}\n\nfunction allocateDemandBudgets(choices, totalBudget) {\n  const budgets = new Map(choices.map((choice) => [choice.product.id, 0]));\n  let remainingBudget = totalBudget;\n  let active = choices.filter((choice) => choice.score > 0 && choice.maxBudget > 0);\n  while (remainingBudget > 0 && active.length > 0) {\n    const totalScore = active.reduce((sum, choice) => sum + choice.score, 0);\n    let distributed = 0;\n    for (const choice of active) {\n      const current = budgets.get(choice.product.id) || 0;\n      const available = Math.max(0, choice.maxBudget - current);\n      if (available < 1) continue;\n      const proportional = Math.floor(remainingBudget * choice.score / totalScore);\n      const grant = Math.min(available, proportional, remainingBudget - distributed);\n      if (grant < 1) continue;\n      budgets.set(choice.product.id, current + grant);\n      distributed += grant;\n      if (distributed >= remainingBudget) break;\n    }\n    if (distributed < 1) {\n      const choice = [...active].sort((left, right) => right.score - left.score || left.product.id.localeCompare(right.product.id))[0];\n      budgets.set(choice.product.id, (budgets.get(choice.product.id) || 0) + 1);\n      distributed = 1;\n    }\n    remainingBudget -= distributed;\n    active = active.filter((choice) => (budgets.get(choice.product.id) || 0) < choice.maxBudget);\n  }\n  return budgets;\n}\n\nfunction createGroupedDemand(world, groupId, now) {\n  const group = DEMAND_GROUPS.get(groupId);\n  if (!group) return;\n  normalizeDemandWorld(world, now);\n  const state = world.demandGroups[group.id];\n  const cycleId = Math.floor(now / group.cycleMs);\n  if (Number(state.lastCycleId) === cycleId) {\n    state.nextDemandAt = (cycleId + 1) * group.cycleMs;\n    return;\n  }\n\n  expireDemandGroupOrders(world, group.id);\n  const choices = group.products.map((option) => {\n    const product = productDefinition(option.productId);\n    const priceState = world.priceTransmission.products[product.id];\n    const limitPrice = Math.max(1, Math.round(Number(priceState.referencePrice || product.basePrice)));\n    const { quote, quoteQuantity } = demandQuote(world, product, group, option, limitPrice);\n    const utilityPerUnit = Math.max(1, Number(option.utilityPerUnit || 1));\n    const priceIndex = quote / limitPrice;\n    const score = priceIndex <= group.maxQuoteIndex\n      ? option.baseBudgetWeight * priceIndex ** -group.priceElasticity\n      : 0;\n    return {\n      option,\n      product,\n      utilityPerUnit,\n      quote,\n      quoteQuantity,\n      priceIndex,\n      score,\n      maxBudget: Math.floor(group.baseBudget * option.maxBudgetShare),\n      limitPrice,\n      quantity: 0,\n      committed: 0,\n    };\n  });\n\n  const budgetTargets = allocateDemandBudgets(choices, group.baseBudget);\n  for (const choice of choices) {\n    const target = budgetTargets.get(choice.product.id) || 0;\n    choice.quantity = choice.score > 0 ? Math.floor(target / choice.limitPrice) : 0;\n    choice.committed = choice.quantity * choice.limitPrice;\n  }\n\n  let remainingBudget = group.baseBudget - choices.reduce((sum, choice) => sum + choice.committed, 0);\n  const remainderOrder = [...choices].sort((left, right) => (\n    left.priceIndex - right.priceIndex\n    || right.score - left.score\n    || left.product.id.localeCompare(right.product.id)\n  ));\n  let progressed = true;\n  while (progressed && remainingBudget > 0) {\n    progressed = false;\n    for (const choice of remainderOrder) {\n      if (choice.score <= 0 || remainingBudget < choice.limitPrice) continue;\n      if (choice.committed + choice.limitPrice > choice.maxBudget) continue;\n      choice.quantity += 1;\n      choice.committed += choice.limitPrice;\n      remainingBudget -= choice.limitPrice;\n      progressed = true;\n    }\n  }\n\n  let requestedUtility = 0;\n  let filledUtility = 0;\n  const allocation = {};\n  for (const choice of choices) {\n    const market = marketFor(world, choice.product.id);\n    const requestedChoiceUtility = choice.quantity * choice.utilityPerUnit;\n    requestedUtility += requestedChoiceUtility;\n    allocation[choice.product.id] = {\n      tier: choice.product.populationDemandTier,\n      referencePrice: Number(world.priceTransmission.products[choice.product.id].referencePrice.toFixed(4)),\n      quote: Number(choice.quote.toFixed(4)),\n      quoteQuantity: choice.quoteQuantity,\n      priceIndex: Number(choice.priceIndex.toFixed(4)),\n      utilityPerUnit: choice.utilityPerUnit,\n      budget: choice.committed,\n      quantity: choice.quantity,\n      requestedUtility: requestedChoiceUtility,\n      filledUtility: 0,\n    };\n    market.demand.lastPrice = choice.limitPrice;\n    market.demand.lastQuantity = choice.quantity;\n    market.demand.lastBudget = choice.committed;\n    market.demand.nextDemandAt = (cycleId + 1) * group.cycleMs;\n    market.demand.satisfaction = 0;\n    if (choice.quantity < 1) continue;\n    const order = {\n      id: `population-order-${randomUUID()}`,\n      assetKind: 'commodity',\n      assetId: choice.product.id,\n      productId: choice.product.id,\n      side: 'buy',\n      ownerType: 'population',\n      ownerName: group.ownerName,\n      demandGroupId: group.id,\n      demandTier: choice.product.populationDemandTier,\n      demandCycleId: cycleId,\n      price: choice.limitPrice,\n      quantity: choice.quantity,\n      remaining: choice.quantity,\n      status: 'open',\n      createdAt: now,\n    };\n    world.orders.push(order);\n    balancedMarket.matchOrder(world, order, now);\n    const filled = choice.quantity - order.remaining;\n    const filledChoiceUtility = filled * choice.utilityPerUnit;\n    filledUtility += filledChoiceUtility;\n    allocation[choice.product.id].filledUtility = filledChoiceUtility;\n    market.demand.satisfaction = choice.quantity === 0 ? 0 : filled / choice.quantity;\n  }\n\n  state.lastCycleId = cycleId;\n  state.nextDemandAt = (cycleId + 1) * group.cycleMs;\n  state.lastBudget = group.baseBudget;\n  state.lastCommitted = choices.reduce((sum, choice) => sum + choice.committed, 0);\n  state.satisfaction = requestedUtility === 0 ? 0 : filledUtility / requestedUtility;\n  state.lastAllocation = allocation;\n}\n\nfunction processPopulationDemand(world, now) {\n  normalizeDemandWorld(world, now);\n  processPriceTransmission(world, now);\n  for (const group of DEMAND_GROUP_CATALOG) {\n    if (now >= Number(world.demandGroups[group.id].nextDemandAt)) createGroupedDemand(world, group.id, now);\n  }\n}\n\nfunction isValidPopulationOrder(order) {\n  if (order.ownerType !== 'population') return false;\n  const group = DEMAND_GROUPS.get(String(order.demandGroupId || ''));\n  if (!group || order.ownerName !== group.ownerName) return false;\n  return group.products.some((option) => option.productId === order.productId);\n}\n\nexport function createWorld(now = Date.now()) {\n  const world = core.createWorld(now);\n  balancedMarket.rebalanceNewWorld(world, now);\n  world.demandGroups = Object.fromEntries(DEMAND_GROUP_CATALOG.map((group) => [\n    group.id,\n    defaultDemandGroupState(group, now),\n  ]));\n  world.priceTransmission = defaultPriceTransmissionState(now);\n  world.version = 10;\n  return normalizeDemandWorld(world, now);\n}\n\nexport function migrateWorld(world, now = Date.now()) {\n  if (!world || typeof world !== 'object') return createWorld(now);\n  const previousVersion = Number(world.version || 0);\n  const existingMarketIds = new Set(Object.keys(world.markets || {}));\n  const legacy = {\n    price: Number.isFinite(Number(world.marketPrice)) ? Number(world.marketPrice) : undefined,\n    history: Array.isArray(world.marketPriceHistory) ? clone(world.marketPriceHistory) : undefined,\n    demand: world.demand && typeof world.demand === 'object' ? clone(world.demand) : undefined,\n    grainMarket: world.markets?.grain && typeof world.markets.grain === 'object'\n      ? clone(world.markets.grain)\n      : undefined,\n  };\n  const migrated = core.migrateWorld(world, now);\n  balancedMarket.repairMissingMarkets(migrated, existingMarketIds, now, legacy);\n  migrated.orders = (migrated.orders || []).filter((order) => {\n    if (order.ownerType === 'player') return true;\n    if (order.ownerType !== 'population') return false;\n    return previousVersion >= 10 && isValidPopulationOrder(order);\n  });\n  if (previousVersion < 9) {\n    for (const player of Object.values(migrated.players || {})) {\n      const group = (player.facilityGroups || []).find((item) => item.facilityTypeId === 'electronics-factory');\n      if (group?.enabled && group.status === 'running') group.cycleStartedAt = now;\n    }\n  }\n  migrated.version = 10;\n  return normalizeDemandWorld(migrated, now);\n}\n\nexport function ensurePlayer(world, user, now = Date.now()) {\n  const player = core.ensurePlayer(world, user, now);\n  normalizeDemandWorld(world, now);\n  return player;\n}\n\nexport function processWorld(world, now = Date.now()) {\n  migrateWorld(world, now);\n  core.processWorld(world, now);\n  processPopulationDemand(world, now);\n  return world;\n}\n\nexport function applyAction(world, user, action, payload = {}, now = Date.now()) {\n  migrateWorld(world, now);\n  const result = core.applyAction(world, user, action, payload, now);\n  processPopulationDemand(world, now);\n  return result;\n}\n\nexport function createClientState(world, userId, now = Date.now()) {\n  migrateWorld(world, now);\n  const state = core.createClientState(world, userId, now);\n  return {\n    ...state,\n    products: clone(PRODUCT_CATALOG),\n    facilityTypes: clone(FACILITY_TYPE_CATALOG),\n  };\n}\n\nexport { POPULATION_DEMAND_PRODUCT_IDS, processPriceTransmission };\n");
write('server/src/balanced-market.js', "import { randomUUID } from 'node:crypto';\n\nexport function createBalancedMarketRuntime({ products, constants }) {\n  const productMap = new Map(products.map((product) => [product.id, product]));\n  const createId = (prefix) => `${prefix}-${randomUUID()}`;\n  const productFor = (productId) => productMap.get(String(productId || '')) || productMap.get('wheat');\n  const isOpenOrder = (order) => Number(order?.remaining || 0) > 0\n    && (order?.status === 'open' || order?.status === 'partial');\n  const isCommodityOwner = (order) => order?.ownerType === 'player' || order?.ownerType === 'population';\n\n  function createMarket(product, now) {\n    const offsets = [-1, 0, 1, 0, 1, 1, 0, -1, 0, 1, 0, 0, 1, -1, 0, 1, 0, 1, 0, -1, 0, 1, 0, 0];\n    return {\n      productId: product.id,\n      lastPrice: product.basePrice,\n      priceHistory: offsets.map((offset, index) => ({\n        price: Math.max(1, product.basePrice + offset),\n        quantity: 3 + (index % 5),\n        createdAt: now - 60_000 * (offsets.length - index),\n        synthetic: true,\n      })),\n      demand: {\n        cycleMs: constants.demandCycleMs,\n        nextDemandAt: now + constants.demandCycleMs,\n        lastBudget: 0,\n        lastQuantity: 0,\n        lastPrice: product.basePrice,\n        satisfaction: 0,\n        referencePrice: product.basePrice,\n        observedPrice: product.basePrice,\n        costAnchor: null,\n        downstreamValueAnchor: null,\n        targetPrice: product.basePrice,\n      },\n    };\n  }\n\n  function marketFor(world, productId, now = Date.now()) {\n    const product = productFor(productId);\n    world.markets ||= {};\n    world.markets[product.id] ||= createMarket(product, now);\n    return world.markets[product.id];\n  }\n\n  function inventoryFor(player, productId) {\n    player.inventories ||= {};\n    player.inventories[productId] ||= { available: 0, frozen: 0 };\n    return player.inventories[productId];\n  }\n\n  function addTrade(player, trade) {\n    player.trades ||= [];\n    player.trades.unshift({ id: createId('trade'), ...trade });\n    player.trades = player.trades.slice(0, constants.maxTradesPerPlayer);\n  }\n\n  function addLedger(player, category, amount, description, createdAt) {\n    player.ledger ||= [];\n    player.ledger.unshift({\n      id: createId('ledger'),\n      category,\n      amount,\n      balanceAfter: player.credits,\n      createdAt,\n      description,\n    });\n    player.ledger = player.ledger.slice(0, constants.maxLedgerPerPlayer);\n  }\n\n  function appendFill(order, fill) {\n    if (order.ownerType !== 'player') return;\n    order.fills = Array.isArray(order.fills) ? order.fills : [];\n    order.fills.push(fill);\n    order.fills = order.fills.slice(-120);\n  }\n\n  function counterparty(order) {\n    return order.ownerName || (order.ownerType === 'population' ? '人口需求' : '玩家');\n  }\n\n  function recordPrice(world, productId, price, quantity, takerSide, createdAt) {\n    const market = marketFor(world, productId, createdAt);\n    market.lastPrice = price;\n    market.priceHistory ||= [];\n    market.priceHistory.push({ price, quantity, createdAt, takerSide });\n    market.priceHistory = market.priceHistory.slice(-constants.maxPricePoints);\n  }\n\n  function settlePlayerBuy(world, order, quantity, tradePrice, sellerName, createdAt) {\n    const player = world.players?.[String(order.ownerId)];\n    if (!player) throw new Error(`Missing buyer ${order.ownerId}`);\n    const reserved = quantity * Number(order.price);\n    const actual = quantity * tradePrice;\n    player.frozenCredits -= reserved;\n    player.credits += reserved - actual;\n    inventoryFor(player, order.productId).available += quantity;\n    player.stats ||= {};\n    player.stats.commodityVolume = Number(player.stats.commodityVolume || 0) + quantity;\n    player.stats.boughtGoods = Number(player.stats.boughtGoods || 0) + quantity;\n    const product = productFor(order.productId);\n    addTrade(player, {\n      type: 'commodity', productId: product.id, side: 'buy', quantity, price: tradePrice,\n      total: actual, counterparty: sellerName, createdAt, description: `买入 ${product.name}`,\n    });\n    addLedger(player, 'market_trade', -actual, `买入 ${quantity} 个${product.name}，成交价 ${tradePrice}`, createdAt);\n  }\n\n  function settlePlayerSell(world, order, quantity, tradePrice, buyer, createdAt) {\n    const player = world.players?.[String(order.ownerId)];\n    if (!player) throw new Error(`Missing seller ${order.ownerId}`);\n    const inventory = inventoryFor(player, order.productId);\n    const total = quantity * tradePrice;\n    inventory.frozen -= quantity;\n    player.credits += total;\n    player.stats ||= {};\n    player.stats.commodityVolume = Number(player.stats.commodityVolume || 0) + quantity;\n    player.stats.soldGoods = Number(player.stats.soldGoods || 0) + quantity;\n    if (buyer.ownerType === 'population') {\n      player.stats.populationIssued = Number(player.stats.populationIssued || 0) + total;\n    }\n    const product = productFor(order.productId);\n    addTrade(player, {\n      type: 'commodity', productId: product.id, side: 'sell', quantity, price: tradePrice,\n      total, counterparty: counterparty(buyer), createdAt, description: `卖出 ${product.name}`,\n    });\n    addLedger(\n      player,\n      buyer.ownerType === 'population' ? 'population_income' : 'market_trade',\n      total,\n      `${buyer.ownerType === 'population' ? '人口需求消费' : '卖出'} ${quantity} 个${product.name}，成交价 ${tradePrice}`,\n      createdAt,\n    );\n  }\n\n  function executeTrade(world, incoming, resting, quantity, createdAt) {\n    const buy = incoming.side === 'buy' ? incoming : resting;\n    const sell = incoming.side === 'sell' ? incoming : resting;\n    const price = Number(resting.price);\n    const fill = {\n      id: createId('order-fill'), quantity, price, total: quantity * price, createdAt,\n      makerOrderId: resting.id, takerOrderId: incoming.id,\n    };\n    incoming.remaining -= quantity;\n    resting.remaining -= quantity;\n    incoming.status = incoming.remaining === 0 ? 'filled' : 'partial';\n    resting.status = resting.remaining === 0 ? 'filled' : 'partial';\n    appendFill(buy, { ...fill, counterparty: counterparty(sell), liquidity: buy.id === resting.id ? 'maker' : 'taker' });\n    appendFill(sell, { ...fill, counterparty: counterparty(buy), liquidity: sell.id === resting.id ? 'maker' : 'taker' });\n    if (buy.ownerType === 'player') settlePlayerBuy(world, buy, quantity, price, counterparty(sell), createdAt);\n    if (sell.ownerType === 'player') settlePlayerSell(world, sell, quantity, price, buy, createdAt);\n    recordPrice(world, incoming.productId, price, quantity, incoming.side, createdAt);\n  }\n\n  function matchOrder(world, incoming, createdAt) {\n    if (!isCommodityOwner(incoming)) throw new Error(`Unsupported commodity order owner: ${incoming?.ownerType}`);\n    const opposite = incoming.side === 'buy' ? 'sell' : 'buy';\n    const candidates = (world.orders || [])\n      .filter((order) => (\n        order.id !== incoming.id\n        && isCommodityOwner(order)\n        && order.productId === incoming.productId\n        && order.side === opposite\n        && isOpenOrder(order)\n        && !(order.ownerType === 'player' && incoming.ownerType === 'player'\n          && Number(order.ownerId) === Number(incoming.ownerId))\n        && (incoming.side === 'buy'\n          ? Number(order.price) <= Number(incoming.price)\n          : Number(order.price) >= Number(incoming.price))\n      ))\n      .sort((left, right) => incoming.side === 'buy'\n        ? Number(left.price) - Number(right.price) || Number(left.createdAt) - Number(right.createdAt)\n        : Number(right.price) - Number(left.price) || Number(left.createdAt) - Number(right.createdAt));\n    for (const candidate of candidates) {\n      if (!isOpenOrder(incoming)) break;\n      executeTrade(world, incoming, candidate, Math.min(incoming.remaining, candidate.remaining), createdAt);\n    }\n  }\n\n  function rebalanceNewWorld(world, now) {\n    world.markets = Object.fromEntries(products.map((product) => [product.id, createMarket(product, now)]));\n    world.orders = (world.orders || []).filter((order) => isCommodityOwner(order));\n    return world;\n  }\n\n  function repairMissingMarkets(world, existingMarketIds, now, legacy = {}) {\n    world.markets ||= {};\n    for (const product of products) {\n      if (existingMarketIds.has(product.id)) continue;\n      const market = createMarket(product, now);\n      if (product.id === 'wheat' && legacy.grainMarket) {\n        Object.assign(market, legacy.grainMarket, { productId: 'wheat' });\n      }\n      if (product.id === 'wheat' && legacy.price !== undefined) market.lastPrice = legacy.price;\n      if (product.id === 'wheat' && legacy.history?.length) {\n        market.priceHistory = legacy.history.map((point) => ({\n          price: Number(point.price || market.lastPrice), quantity: Number(point.quantity || 1),\n          createdAt: Number(point.createdAt || now), takerSide: point.takerSide,\n        }));\n      }\n      if (product.id === 'wheat' && legacy.demand) market.demand = { ...market.demand, ...legacy.demand };\n      world.markets[product.id] = market;\n    }\n    return world;\n  }\n\n  return {\n    createMarket,\n    isOpenOrder,\n    marketFor,\n    matchOrder,\n    rebalanceNewWorld,\n    repairMissingMarkets,\n  };\n}\n");

let core = read('server/src/domain-core.js');
core = replaceRegex(core, /export const PRODUCT_CATALOG = Object\.freeze\(\[[\s\S]*?\n\]\);/, `export const PRODUCT_CATALOG = Object.freeze([
  { id: 'wheat', name: '小麦', category: 'raw', populationDemandGroupId: 'food', populationDemandTier: 'raw', basePrice: 2 },
  { id: 'rice', name: '水稻', category: 'raw', populationDemandGroupId: 'food', populationDemandTier: 'raw', basePrice: 2 },
  { id: 'cotton', name: '棉花', category: 'raw', populationDemandGroupId: 'household', populationDemandTier: 'raw', basePrice: 2 },
  { id: 'timber', name: '木材', category: 'raw', populationDemandGroupId: 'household', populationDemandTier: 'raw', basePrice: 5 },
  { id: 'ore', name: '铁矿石', category: 'raw', basePrice: 6 },
  { id: 'copper-ore', name: '铜矿石', category: 'raw', populationDemandGroupId: 'household', populationDemandTier: 'raw', basePrice: 6 },
  { id: 'crude-oil', name: '原油', category: 'raw', populationDemandGroupId: 'household', populationDemandTier: 'raw', basePrice: 8 },
  { id: 'meat', name: '肉', category: 'consumer', populationDemandGroupId: 'food', populationDemandTier: 'final', basePrice: 6 },
  { id: 'eggs', name: '蛋', category: 'consumer', populationDemandGroupId: 'food', populationDemandTier: 'final', basePrice: 3 },
  { id: 'milk', name: '奶', category: 'consumer', populationDemandGroupId: 'food', populationDemandTier: 'final', basePrice: 3 },
  { id: 'wool', name: '毛', category: 'raw', populationDemandGroupId: 'household', populationDemandTier: 'raw', basePrice: 6 },
  { id: 'flour', name: '面粉', category: 'intermediate', populationDemandGroupId: 'food', populationDemandTier: 'intermediate', basePrice: 13 },
  { id: 'lumber', name: '木板', category: 'intermediate', populationDemandGroupId: 'household', populationDemandTier: 'intermediate', basePrice: 15 },
  { id: 'steel', name: '钢材', category: 'intermediate', basePrice: 24 },
  { id: 'copper', name: '铜材', category: 'intermediate', populationDemandGroupId: 'household', populationDemandTier: 'intermediate', basePrice: 24 },
  { id: 'plastic', name: '塑料', category: 'intermediate', populationDemandGroupId: 'household', populationDemandTier: 'intermediate', basePrice: 24 },
  { id: 'textile', name: '纺织品', category: 'intermediate', populationDemandGroupId: 'household', populationDemandTier: 'intermediate', basePrice: 18 },
  { id: 'food', name: '食品', category: 'consumer', populationDemandGroupId: 'food', populationDemandTier: 'final', basePrice: 15 },
  { id: 'furniture', name: '家具', category: 'consumer', populationDemandGroupId: 'household', populationDemandTier: 'final', basePrice: 20 },
  { id: 'clothing', name: '服装', category: 'consumer', populationDemandGroupId: 'household', populationDemandTier: 'final', basePrice: 48 },
  { id: 'machinery', name: '机械', category: 'industrial', basePrice: 60 },
  { id: 'electronics', name: '电子产品', category: 'industrial', populationDemandGroupId: 'household', populationDemandTier: 'final', basePrice: 64 },
]);`, 'core product catalog');
core = replaceRegex(core, /export const DEMAND_GROUP_CATALOG = Object\.freeze\(\[[\s\S]*?\n\]\);/, `export const DEMAND_GROUP_CATALOG = Object.freeze([
  {
    id: 'food', name: '饮食需求', ownerName: '饮食需求',
    cycleMs: ECONOMY_CONSTANTS.demandCycleMs, baseBudget: 330,
    products: [
      { productId: 'wheat', preferenceWeight: 1 },
      { productId: 'rice', preferenceWeight: 1 },
      { productId: 'flour', preferenceWeight: 4 },
      { productId: 'food', preferenceWeight: 8 },
      { productId: 'meat', preferenceWeight: 4 },
      { productId: 'eggs', preferenceWeight: 3 },
      { productId: 'milk', preferenceWeight: 3 },
    ],
  },
  {
    id: 'household', name: '家庭用品需求', ownerName: '家庭用品需求',
    cycleMs: ECONOMY_CONSTANTS.demandCycleMs, baseBudget: 320,
    products: [
      { productId: 'timber', preferenceWeight: 1 },
      { productId: 'cotton', preferenceWeight: 1 },
      { productId: 'wool', preferenceWeight: 1 },
      { productId: 'copper-ore', preferenceWeight: 1 },
      { productId: 'crude-oil', preferenceWeight: 1 },
      { productId: 'lumber', preferenceWeight: 2 },
      { productId: 'textile', preferenceWeight: 2 },
      { productId: 'copper', preferenceWeight: 2 },
      { productId: 'plastic', preferenceWeight: 2 },
      { productId: 'furniture', preferenceWeight: 4 },
      { productId: 'clothing', preferenceWeight: 5 },
      { productId: 'electronics', preferenceWeight: 5 },
    ],
  },
]);`, 'core demand groups');
core = replaceRegex(core, /function seedOrders\(now\) \{[\s\S]*?\n\}/, `function seedOrders() {
  return [];
}`, 'seed orders');
core = core.replace('version: 9,', 'version: 10,');
core = core.replace('world.version = 9;', 'world.version = 10;');
core = core.replace('function recordPrice(world, productId, price, quantity, createdAt) {', 'function recordPrice(world, productId, price, quantity, takerSide, createdAt) {');
core = core.replace('market.priceHistory.push({ price, quantity, createdAt });', 'market.priceHistory.push({ price, quantity, createdAt, takerSide });');
core = core.replace('recordPrice(world, incoming.productId, price, quantity, createdAt);', 'recordPrice(world, incoming.productId, price, quantity, incoming.side, createdAt);');
core = core.replace("return order.ownerName || (order.ownerType === 'population' ? '人口需求' : '市场');", "return order.ownerName || (order.ownerType === 'population' ? '人口需求' : '玩家');");
core = replaceRegex(core, /function createPopulationDemand\(world, productId, now\) \{[\s\S]*?\n\}/, `function createPopulationDemand() {
  return undefined;
}`, 'legacy single demand');
core = replaceRegex(core, /function commodityBookPrices\(world, productId\) \{[\s\S]*?\n\}\n\nfunction commodityLiquidityPrices\(product, bestBid, bestAsk\) \{[\s\S]*?\n\}\n\nfunction refreshExternalLiquidity\(world, now\) \{[\s\S]*?\n\}/, `function refreshExternalLiquidity() {
  return undefined;
}`, 'legacy liquidity');
core = replaceRegex(core, /  const stapleDemand = world\.demandGroups\?\.staples;[\s\S]*?  refreshExternalLiquidity\(world, now\);\n/, '', 'core demand processing');
write('server/src/domain-core.js', core);

let storage = read('server/src/storage.js').replace('version: 13,', 'version: 14,');
write('server/src/storage.js', storage);
let groups = read('server/src/facility-groups.js')
  .replaceAll('world.version = 9', 'world.version = 10')
  .replaceAll('version: 13', 'version: 14');
write('server/src/facility-groups.js', groups);

let types = read('src/types.ts');
types = replaceExact(types, `  family?: string;
  substitutionGroupId?: string;
  systemDemandMode?: 'none' | 'single' | 'grouped';`, `  populationDemandGroupId?: 'food' | 'household';
  populationDemandTier?: 'raw' | 'intermediate' | 'final';`, 'product demand types');
types = types.replace("export type OrderOwnerType = 'player' | 'population' | 'market';", "export type OrderOwnerType = 'player' | 'population';");
types = types.replace('  demandGroupId?: string;\n  demandCycleId?: number;', "  demandGroupId?: 'food' | 'household';\n  demandTier?: 'raw' | 'intermediate' | 'final';\n  demandCycleId?: number;");
types = types.replace('  satisfaction: number;\n}', `  satisfaction: number;
  referencePrice: number;
  observedPrice: number;
  costAnchor: number | null;
  downstreamValueAnchor: number | null;
  targetPrice: number;
}`);
types = types.replace('  version: 13;', '  version: 14;');
write('src/types.ts', types);

let tests = read('server/test/domain.test.js');
for (const name of [
  'staple demand shifts budget to rice when wheat is expensive',
  'meat eggs and milk compete inside the fixed staple budget',
  'food competes with wheat and rice through utility-adjusted prices and capped budget shares',
  'food demand yields to grains when its utility-adjusted price exceeds the ceiling',
  'staple demand leaves budget unspent when every substitute is above the ceiling',
  'furniture and clothing share one fixed household goods budget',
  'existing worlds receive new inventories, markets, and liquidity without resetting assets',
  'world version 8 migration restarts running electronics cycle without resetting assets',
  'version 9 migration cancels incompatible legacy population orders',
  'upstream-only products never receive independent population demand',
  'commodity order fills preserve every exact resting price',
  'commodity system liquidity follows the current order book instead of last trade price',
]) tests = removeTest(tests, name);
tests = tests.replace(`function prepareStapleDemand(world) {
  world.demandGroups.staples.nextDemandAt = now;
  world.demandGroups.staples.lastCycleId = -1;
}`, `function prepareDemand(world, groupId) {
  world.demandGroups[groupId].nextDemandAt = now;
  world.demandGroups[groupId].lastCycleId = -1;
}`);
tests = tests.replace("test('client state uses version 13 and exposes no factory instances'", "test('client state uses version 14 and exposes no factory instances'");
tests = tests.replace('assert.equal(state.version, 13);', 'assert.equal(state.version, 14);');
tests += `

test('population demand only creates food and household orders within fixed budgets', () => {
  const world = createWorld(now);
  prepareDemand(world, 'food');
  prepareDemand(world, 'household');
  processWorld(world, now + 1);

  assert.ok(world.orders.every((order) => ['player', 'population'].includes(order.ownerType)));
  const populationOrders = world.orders.filter((order) => order.ownerType === 'population');
  assert.ok(populationOrders.length > 0);
  assert.deepEqual([...new Set(populationOrders.map((order) => order.ownerName))].sort(), ['家庭用品需求', '饮食需求']);
  assert.ok(populationOrders.every((order) => ['food', 'household'].includes(order.demandGroupId)));
  assert.ok(world.demandGroups.food.lastCommitted <= 330);
  assert.ok(world.demandGroups.household.lastCommitted <= 320);
  assert.deepEqual(Object.keys(world.demandGroups.food.lastAllocation).sort(), ['eggs', 'flour', 'food', 'meat', 'milk', 'rice', 'wheat']);
  assert.deepEqual(Object.keys(world.demandGroups.household.lastAllocation).sort(), [
    'clothing', 'copper', 'copper-ore', 'cotton', 'crude-oil', 'electronics',
    'furniture', 'lumber', 'plastic', 'textile', 'timber', 'wool',
  ]);
});

test('migration removes market and legacy population orders while preserving player orders', () => {
  const world = createWorld(now);
  const player = ensurePlayer(world, alice, now);
  player.credits = 777;
  player.inventories.wheat.available = 9;
  world.version = 9;
  world.orders = [
    { id: 'player-order', assetKind: 'commodity', assetId: 'wheat', productId: 'wheat', side: 'sell', ownerType: 'player', ownerId: alice.id, ownerName: 'Alice', price: 3, quantity: 2, remaining: 2, status: 'open', createdAt: now },
    { id: 'market-order', productId: 'wheat', side: 'buy', ownerType: 'market', ownerName: '市场流动采购', price: 2, quantity: 2, remaining: 2, status: 'open', createdAt: now },
    { id: 'enterprise-order', productId: 'machinery', side: 'buy', ownerType: 'population', ownerName: '企业采购', price: 60, quantity: 1, remaining: 1, status: 'open', createdAt: now },
  ];

  migrateWorld(world, now);

  assert.equal(world.version, 10);
  assert.deepEqual(world.orders.map((order) => order.id), ['player-order']);
  assert.equal(player.credits, 777);
  assert.equal(player.inventories.wheat.available, 9);
});

test('world version 8 migration restarts electronics and upgrades demand state without resetting assets', () => {
  const world = createWorld(now);
  const player = ensurePlayer(world, alice, now);
  world.version = 8;
  player.credits = 777;
  player.inventories.plastic.available = 9;
  player.inventories.copper.available = 4;
  player.facilityGroups = [{
    facilityTypeId: 'electronics-factory', count: 2, participatingCount: 2, pendingJoinCount: 0,
    enabled: true, status: 'running', activeRecipeId: 'electronics-factory-default',
    cycleStartedAt: now - 30_000, lifetimeOutput: 5,
  }];

  migrateWorld(world, now);

  assert.equal(world.version, 10);
  assert.equal(player.credits, 777);
  assert.equal(player.inventories.plastic.available, 9);
  assert.equal(player.inventories.copper.available, 4);
  assert.equal(player.facilityGroups[0].cycleStartedAt, now);
  assert.deepEqual(Object.keys(world.demandGroups).sort(), ['food', 'household']);
  assert.ok(world.priceTransmission.products.electronics);
});

test('commodity order fills preserve every exact player resting price without system liquidity', () => {
  const world = createWorld(now);
  world.orders = [];
  const buyer = ensurePlayer(world, alice, now);
  const sellerA = ensurePlayer(world, bob, now);
  const sellerB = ensurePlayer(world, carol, now);
  buyer.credits = 100;
  sellerA.inventories.wheat.available = 1;
  sellerB.inventories.wheat.available = 1;

  assert.equal(applyAction(world, bob, 'placeOrder', { productId: 'wheat', side: 'sell', quantity: 1, price: 5 }, now + 1).ok, true);
  assert.equal(applyAction(world, carol, 'placeOrder', { productId: 'wheat', side: 'sell', quantity: 1, price: 6 }, now + 2).ok, true);
  assert.equal(applyAction(world, alice, 'placeOrder', { productId: 'wheat', side: 'buy', quantity: 2, price: 20 }, now + 3).ok, true);

  const buyOrder = world.orders.find((order) => order.ownerId === alice.id && order.side === 'buy');
  assert.deepEqual(buyOrder.fills.map((fill) => ({ price: fill.price, quantity: fill.quantity })), [
    { price: 5, quantity: 1 }, { price: 6, quantity: 1 },
  ]);
  assert.equal(buyer.credits, 89);
  assert.equal(buyer.frozenCredits, 0);
  assert.equal(buyer.inventories.wheat.available, 2);
  assert.equal(world.orders.some((order) => order.ownerType === 'market'), false);
});
`;
write('server/test/domain.test.js', tests);

write('server/test/demand-transmission.test.js', `import assert from 'node:assert/strict';
import test from 'node:test';
import { createWorld, processPriceTransmission } from '../src/domain.js';

const now = 1_700_000_000_000;
const cycle = 5 * 60 * 1000;
const realTrade = (world, productId, price, createdAt) => {
  world.markets[productId].priceHistory.push({ price, quantity: 100, createdAt, takerSide: 'buy' });
};

test('upstream cost changes propagate downstream one production edge per cycle', () => {
  const world = createWorld(now);
  realTrade(world, 'wheat', 10, now + cycle - 1);
  const baseFlour = world.priceTransmission.products.flour.referencePrice;
  const baseFood = world.priceTransmission.products.food.referencePrice;

  processPriceTransmission(world, now + cycle + 1);
  assert.equal(world.priceTransmission.products.flour.referencePrice, baseFlour);
  assert.equal(world.priceTransmission.products.food.referencePrice, baseFood);

  processPriceTransmission(world, now + cycle * 2 + 1);
  assert.ok(world.priceTransmission.products.flour.referencePrice > baseFlour);
  assert.equal(world.priceTransmission.products.food.referencePrice, baseFood);

  processPriceTransmission(world, now + cycle * 3 + 1);
  assert.ok(world.priceTransmission.products.food.referencePrice > baseFood);
});

test('downstream value changes propagate upstream one production edge per cycle', () => {
  const world = createWorld(now);
  world.markets.food.demand.satisfaction = 1;
  realTrade(world, 'food', 45, now + cycle - 1);
  const baseFlour = world.priceTransmission.products.flour.referencePrice;
  const baseWheat = world.priceTransmission.products.wheat.referencePrice;

  processPriceTransmission(world, now + cycle + 1);
  assert.equal(world.priceTransmission.products.flour.referencePrice, baseFlour);
  assert.equal(world.priceTransmission.products.wheat.referencePrice, baseWheat);

  processPriceTransmission(world, now + cycle * 2 + 1);
  assert.ok(world.priceTransmission.products.flour.referencePrice > baseFlour);
  assert.equal(world.priceTransmission.products.wheat.referencePrice, baseWheat);

  processPriceTransmission(world, now + cycle * 3 + 1);
  assert.ok(world.priceTransmission.products.wheat.referencePrice > baseWheat);
});

test('multi-input downstream value reaches both copper and plastic with lag', () => {
  const world = createWorld(now);
  world.markets.electronics.demand.satisfaction = 1;
  realTrade(world, 'electronics', 120, now + cycle - 1);
  const copperBase = world.priceTransmission.products.copper.referencePrice;
  const plasticBase = world.priceTransmission.products.plastic.referencePrice;

  processPriceTransmission(world, now + cycle + 1);
  assert.equal(world.priceTransmission.products.copper.referencePrice, copperBase);
  assert.equal(world.priceTransmission.products.plastic.referencePrice, plasticBase);

  processPriceTransmission(world, now + cycle * 2 + 1);
  assert.ok(world.priceTransmission.products.copper.downstreamValueAnchor > copperBase);
  assert.ok(world.priceTransmission.products.plastic.downstreamValueAnchor > plasticBase);
  assert.ok(world.priceTransmission.products.copper.referencePrice > copperBase);
  assert.ok(world.priceTransmission.products.plastic.referencePrice > plasticBase);
});

test('price transmission is damped and also carries price decreases', () => {
  const world = createWorld(now);
  realTrade(world, 'wheat', 1, now + cycle - 1);
  const wheatBase = world.priceTransmission.products.wheat.referencePrice;
  const flourBase = world.priceTransmission.products.flour.referencePrice;

  processPriceTransmission(world, now + cycle + 1);
  assert.ok(world.priceTransmission.products.wheat.referencePrice < wheatBase);
  assert.ok(world.priceTransmission.products.wheat.referencePrice >= wheatBase * 0.94);
  processPriceTransmission(world, now + cycle * 2 + 1);
  assert.ok(world.priceTransmission.products.flour.referencePrice < flourBase);
});
`);

write('scripts/verify-staple-crops-demand.mjs', `import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DEMAND_GROUP_CATALOG, FACILITY_TYPE_CATALOG, PRODUCT_CATALOG } from '../server/src/domain.js';

const read = (path) => readFileSync(path, 'utf8');
const products = new Map(PRODUCT_CATALOG.map((product) => [product.id, product]));
assert.equal(PRODUCT_CATALOG.length, 22);
const foodIds = ['wheat', 'rice', 'flour', 'food', 'meat', 'eggs', 'milk'];
const householdIds = ['timber', 'cotton', 'wool', 'copper-ore', 'crude-oil', 'lumber', 'textile', 'copper', 'plastic', 'furniture', 'clothing', 'electronics'];
for (const id of foodIds) assert.equal(products.get(id)?.populationDemandGroupId, 'food', id);
for (const id of householdIds) assert.equal(products.get(id)?.populationDemandGroupId, 'household', id);
for (const id of ['ore', 'steel', 'machinery']) assert.equal(products.get(id)?.populationDemandGroupId, undefined, id);
assert.ok(PRODUCT_CATALOG.every((product) => !Object.hasOwn(product, 'systemDemandMode')));

const food = DEMAND_GROUP_CATALOG.find((group) => group.id === 'food');
const household = DEMAND_GROUP_CATALOG.find((group) => group.id === 'household');
assert.equal(food.ownerName, '饮食需求');
assert.equal(food.baseBudget, 330);
assert.deepEqual(food.products.map((item) => item.productId), foodIds);
assert.equal(household.ownerName, '家庭用品需求');
assert.equal(household.baseBudget, 320);
assert.deepEqual(household.products.map((item) => item.productId), householdIds);

const domain = read('server/src/domain.js');
for (const text of [
  'processPriceTransmission', 'realTradeStats', 'costAnchor', 'downstreamValueAnchor',
  'geometricWeightedMean', 'PRICE_MAX_RISE_PER_CYCLE', 'PRICE_MAX_FALL_PER_CYCLE',
  "ownerName: '饮食需求'", "ownerName: '家庭用品需求'", 'previousVersion >= 10',
]) assert.ok(domain.includes(text), 'domain.js 缺少: ' + text);
const balanced = read('server/src/balanced-market.js');
for (const forbidden of ['市场流动采购', '市场流动供给', '企业采购', "ownerType: 'market'"]) {
  assert.equal(balanced.includes(forbidden), false, forbidden);
}
const tests = read('server/test/demand-transmission.test.js');
for (const text of [
  'upstream cost changes propagate downstream one production edge per cycle',
  'downstream value changes propagate upstream one production edge per cycle',
  'multi-input downstream value reaches both copper and plastic with lag',
  'price transmission is damped and also carries price decreases',
]) assert.ok(tests.includes(text), '测试缺少: ' + text);
const facilities = new Map(FACILITY_TYPE_CATALOG.map((facility) => [facility.id, facility]));
assert.deepEqual(facilities.get('electronics-factory').recipes[0].inputs, [
  { productId: 'plastic', quantity: 1 }, { productId: 'copper', quantity: 1 },
]);
for (const [path, texts] of [
  ['README.md', ['仅允许玩家订单和人口需求订单', '饮食需求', '家庭用品需求', '双向价格传导']],
  ['docs/PRODUCT_AND_GAMEPLAY_DESIGN.md', ['成本推动', '需求拉动', '上一周期快照', '固定预算']],
  ['docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md', ["ownerType: 'player' | 'population'", '不提供系统流动性买单或卖单']],
]) {
  const content = read(path);
  for (const text of texts) assert.ok(content.includes(text), path + ' 缺少: ' + text);
}
console.log('人口需求验证通过：仅保留两类固定预算需求，并按生产链双向滞后传导价格。');
`);

let industryVerify = read('scripts/verify-industry-catalog.mjs');
industryVerify = industryVerify.replace("  assert.ok(['none', 'single', 'grouped'].includes(product.systemDemandMode), `${product.id} 缺少系统需求模式`);", "  assert.ok(product.populationDemandGroupId === undefined || ['food', 'household'].includes(product.populationDemandGroupId), `${product.id} 人口需求组无效`);");
write('scripts/verify-industry-catalog.mjs', industryVerify);

let marketVerify = read('scripts/verify-market-assets.mjs');
marketVerify = marketVerify.replace(`for (const text of ['workCooldownMs: 10_000','workClicks','boughtGoods','soldGoods','commodityBookPrices','commodityLiquidityPrices','bestAsk - 1','bestBid + 1']) {`, `for (const text of ['workCooldownMs: 10_000','workClicks','boughtGoods','soldGoods','processPriceTransmission','costAnchor','downstreamValueAnchor']) {`);
marketVerify = marketVerify.replace("  '商品市场允许服务器在某一侧没有有效系统流动性订单时补充一张系统订单',", "  '商品订单只允许玩家或人口需求作为所有者',\n  '不提供系统流动性买单或卖单',");
write('scripts/verify-market-assets.mjs', marketVerify);

let authority = read('scripts/verify-document-authority.mjs')
  .replaceAll("'客户端状态版本：`13`'", "'客户端状态版本：`14`'")
  .replaceAll("'世界状态版本：`9`'", "'世界状态版本：`10`'")
  .replaceAll("'食品、小麦、水稻、肉、蛋和奶共享同一个人口饮食需求组'", "'商品订单仅允许玩家订单和人口需求订单'")
  .replaceAll("'每 5 分钟最多 330'", "'饮食需求每 5 分钟最多 330'")
  .replaceAll("'客户端状态版本：13'", "'客户端状态版本：14'")
  .replaceAll("'世界状态版本：9'", "'世界状态版本：10'")
  .replaceAll('客户端状态版本必须为 13', '客户端状态版本必须为 14')
  .replaceAll('世界状态版本必须为 9', '世界状态版本必须为 10')
  .replaceAll('版本 13/9', '版本 14/10');
write('scripts/verify-document-authority.mjs', authority);

let readme = replaceVersionHeaders(read('README.md'));
readme = replaceExact(readme,
  '- 食品、小麦、水稻、肉、蛋和奶共享同一个人口饮食需求组，每 5 分钟最多 330 货币预算；六种商品按消费效用、订单簿价格、偏好和单品预算上限直接竞争，未使用预算不结转，任何成员不得再获得独立人口需求。',
  '- 商品订单仅允许玩家订单和人口需求订单；人口需求固定分为“饮食需求”和“家庭用品需求”，不再生成企业采购、普通人口需求、市场流动采购或市场流动供给。\n- 饮食需求每 5 分钟最多 330 货币预算，家庭用品需求每 5 分钟最多 320 货币预算；预算随参考价换算为数量，价格上涨不会扩大系统货币发行。\n- 生产链采用双向价格传导：上游成本通过成本推动滞后影响下游，下游成交价值通过需求拉动净回值滞后影响上游；每条生产边至少延迟一个需求周期，并使用阻尼、涨跌幅限制和基础价回归防止循环放大。',
  'README demand rule');
write('README.md', readme);

let productDoc = replaceVersionHeaders(read('docs/PRODUCT_AND_GAMEPLAY_DESIGN.md'));
productDoc = productDoc.replace('2. 系统市场或人口需求买入商品。', '2. 饮食需求或家庭用品需求买入商品。');
productDoc = replaceRegex(productDoc, /## 5\. 聚合需求与基础流动性[\s\S]*?\n## 6\./, `## 5. 人口需求与双向价格传导

商品订单只允许玩家订单和人口需求订单。人口需求是服务器聚合消费部门，只创建买单，不创建卖单；不设置企业采购、普通人口需求、市场流动采购或市场流动供给。订单簿允许单侧为空或完全为空，商品供给全部来自玩家。

当前需求周期为 5 分钟。人口需求固定分为：

- \`food\`：显示名称“饮食需求”，每周期最多 330 货币预算；包括小麦、水稻、面粉、食品、肉、蛋和奶。
- \`household\`：显示名称“家庭用品需求”，每周期最多 320 货币预算；包括木材、棉花、毛、铜矿石、原油、木板、纺织品、铜材、塑料、家具、服装和电子产品。
- 铁矿石、钢材和机械不生成人口订单，只由玩家交易与产业用途形成需求。

两个需求组各自共享固定预算。人口订单数量按“分配预算 ÷ 人口参考价”取整；价格上涨只减少可购买数量，不扩大预算。未使用预算不结转。

### 5.1 真实成交价格信号

价格传导只影响人口需求参考价，不直接改写市场成交价。价格信号只使用过去 30 分钟真实成交的成交量加权均价；未成交挂单、取消订单、初始合成历史和自成交不得进入信号。无真实成交时，观察价保留惯性并每周期向基础价回归 2%。

### 5.2 双向传导

- 成本推动：上游价格、运营成本和基准利润共同形成下游成本锚点。
- 需求拉动：下游成交价值扣除运营成本、基准利润和其他输入成本后，形成上游净回值锚点。
- 多输入配方必须同时计算所有输入；电子产品的价格变化必须分别传导到塑料和铜材。
- 多配方输出以有效的较低成本形成成本锚点；多个活跃下游以真实成交量和需求满足率加权形成净回值。

所有计算只读取上一周期不可变快照。同一周期不得递归传播；每经过一条生产边至少滞后一个周期。例如小麦变化在下一周期影响面粉，再下一周期影响食品；食品变化反向传播时顺序相同。

### 5.3 阻尼与稳定性

人口参考价由基础价、观察价、成本锚点和下游价值锚点按几何权重合成。每周期向目标价调整时：上涨系数 30%、下降系数 20%，单周期最多上涨 8%、下降 6%，最终限制在基础价的 50%～300%。这些限制与上一周期快照共同防止上下游循环追涨或追跌。

## 6.`, 'product demand section');
productDoc = productDoc.replace('- 六种饮食商品分别获得互不约束的人口预算；', '- 饮食或家庭用品组内商品分别获得互不约束的人口预算；')
  .replace('- 任一饮食商品在加入 `staples` 后继续生成独立人口订单；', '- 恢复企业采购、普通人口需求或市场流动性订单；')
  .replace('- 用商品件数而不是消费效用计算饮食满足率；', '- 在同一周期递归传播多层价格或绕过涨跌幅限制；');
write('docs/PRODUCT_AND_GAMEPLAY_DESIGN.md', productDoc);

let industryDoc = replaceVersionHeaders(read('docs/INDUSTRY_AND_PRODUCTION_DESIGN.md'));
industryDoc = industryDoc.replace('食品、小麦、水稻、肉、蛋和奶共享人口饮食需求，详细预算、消费效用和价格竞争规则以 `PRODUCT_AND_GAMEPLAY_DESIGN.md` 为准。', '小麦、水稻、面粉、食品、肉、蛋和奶属于饮食需求；木材、棉花、毛、铜矿石、原油、木板、纺织品、铜材、塑料、家具、服装和电子产品属于家庭用品需求。价格沿正式配方双向、逐边、滞后传导，详细规则以 `PRODUCT_AND_GAMEPLAY_DESIGN.md` 为准。');
industryDoc = industryDoc.replace('4. 旧存档自动补齐新增商品库存、市场价格历史、基础流动性和工厂集群空状态。', '4. 旧存档自动补齐新增商品库存、市场价格历史、价格传导状态和工厂集群空状态。');
write('docs/INDUSTRY_AND_PRODUCTION_DESIGN.md', industryDoc);

let orderDoc = replaceVersionHeaders(read('docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md'));
orderDoc = orderDoc.replace("  ownerType: 'player' | 'population' | 'market';", "  ownerType: 'player' | 'population';")
  .replace('  demandGroupId?: string;', "  demandGroupId?: 'food' | 'household';\n  demandTier?: 'raw' | 'intermediate' | 'final';")
  .replace('人口主食买单使用可选的 `demandGroupId` 和 `demandCycleId` 标记预算组与周期，但仍遵守同一价格优先、同价时间优先规则。主食预算、替代价格与过期规则以 `PRODUCT_AND_GAMEPLAY_DESIGN.md` 为唯一权威来源。', '人口买单使用 `demandGroupId`、`demandTier` 和 `demandCycleId` 标记需求组、产业层级与周期，但仍遵守同一价格优先、同价时间优先规则。预算与双向价格传导以 `PRODUCT_AND_GAMEPLAY_DESIGN.md` 为唯一权威来源。');
orderDoc = replaceRegex(orderDoc, /## 8\. 系统商品流动性与工厂订单来源[\s\S]*?\n## 9\./, `## 8. 订单来源

商品订单只允许玩家或人口需求作为所有者：

- 玩家可以提交商品买单和卖单。
- 人口需求只提交买单，且名称只能是“饮食需求”或“家庭用品需求”。
- 不提供系统流动性买单或卖单，不生成企业采购或普通人口需求。
- 商品订单簿允许单侧为空或完全为空；服务器不得为了填充盘口制造订单、成交量或最近成交价。
- 迁移必须删除旧 \`ownerType = market\` 商品订单和旧企业采购／普通人口需求订单，同时保留玩家订单及其冻结资产。

工厂订单仍只能由玩家提交；服务器周期、迁移、刷新和进入游戏都不得创建工厂订单。

## 9.`, 'order source section');
write('docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md', orderDoc);

let docsIndex = replaceVersionHeaders(read('docs/README.md'));
docsIndex += docsIndex.includes('双向价格传导') ? '' : '\n16. 人口需求订单来源、固定预算、生产链双向滞后价格传导和迁移清理属于产品、产业与订单簿权威规则；必须同步更新对应文档、测试和 `scripts/verify-staple-crops-demand.mjs`。\n';
write('docs/README.md', docsIndex);
for (const path of [
  'docs/WAREHOUSE_EXPANSION_DESIGN.md',
  'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
  'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md',
  'docs/LOCAL_ACTIVITY_LOG_DESIGN.md',
]) write(path, replaceVersionHeaders(read(path)));

console.log('Applied population-demand transmission changes.');
