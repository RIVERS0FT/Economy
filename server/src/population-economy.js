export const POPULATION_ECONOMY_VERSION = 1;
export const POPULATION_MODEL_IDS = Object.freeze(['basic', 'skilled', 'professional']);

const MODEL_CONFIG = Object.freeze({
  basic: Object.freeze({
    name: '基础人口',
    marginalPropensityToConsume: 0.95,
    reserveCycles: 0.5,
    excessReleaseRate: 0.05,
    normalGroupShares: Object.freeze({ food: 0.78, household: 0.22 }),
  }),
  skilled: Object.freeze({
    name: '技术人口',
    marginalPropensityToConsume: 0.85,
    reserveCycles: 1.5,
    excessReleaseRate: 0.03,
    normalGroupShares: Object.freeze({ food: 0.58, household: 0.42 }),
  }),
  professional: Object.freeze({
    name: '专业人口',
    marginalPropensityToConsume: 0.72,
    reserveCycles: 3,
    excessReleaseRate: 0.02,
    normalGroupShares: Object.freeze({ food: 0.38, household: 0.62 }),
  }),
});

const CONSTRUCTION_PROFILE = Object.freeze({ basic: 0.60, skilled: 0.30, professional: 0.10 });
const WAREHOUSE_PROFILE = Object.freeze({ basic: 0.50, skilled: 0.40, professional: 0.10 });
const MARKET_SERVICE_PROFILE = Object.freeze({ basic: 0.20, skilled: 0.60, professional: 0.20 });
const PRODUCTION_PROFILES = Object.freeze({
  C1: Object.freeze({ basic: 0.90, skilled: 0.09, professional: 0.01 }),
  C2: Object.freeze({ basic: 0.78, skilled: 0.20, professional: 0.02 }),
  C3: Object.freeze({ basic: 0.55, skilled: 0.40, professional: 0.05 }),
  C4: Object.freeze({ basic: 0.30, skilled: 0.60, professional: 0.10 }),
  C5: Object.freeze({ basic: 0.18, skilled: 0.55, professional: 0.27 }),
  C6: Object.freeze({ basic: 0.10, skilled: 0.40, professional: 0.50 }),
  C7: Object.freeze({ basic: 0.05, skilled: 0.25, professional: 0.70 }),
});

const NORMAL_CLASS_SHARES = Object.freeze({
  basic: Object.freeze({
    food: Object.freeze({ staples: 0.50, protein: 0.25, 'fresh-drinks': 0.10, convenience: 0.15 }),
    household: Object.freeze({ home: 0.20, wear: 0.35, daily: 0.35, durables: 0.10 }),
  }),
  skilled: Object.freeze({
    food: Object.freeze({ staples: 0.35, protein: 0.30, 'fresh-drinks': 0.15, convenience: 0.20 }),
    household: Object.freeze({ home: 0.25, wear: 0.25, daily: 0.25, durables: 0.25 }),
  }),
  professional: Object.freeze({
    food: Object.freeze({ staples: 0.20, protein: 0.30, 'fresh-drinks': 0.25, convenience: 0.25 }),
    household: Object.freeze({ home: 0.20, wear: 0.20, daily: 0.10, durables: 0.50 }),
  }),
});

const CAUTIOUS_CLASS_SHARES = Object.freeze({
  basic: Object.freeze({
    food: Object.freeze({ staples: 0.58, protein: 0.27, 'fresh-drinks': 0.07, convenience: 0.08 }),
    household: Object.freeze({ home: 0.16, wear: 0.38, daily: 0.41, durables: 0.05 }),
  }),
  skilled: Object.freeze({
    food: Object.freeze({ staples: 0.45, protein: 0.32, 'fresh-drinks': 0.10, convenience: 0.13 }),
    household: Object.freeze({ home: 0.24, wear: 0.31, daily: 0.32, durables: 0.13 }),
  }),
  professional: Object.freeze({
    food: Object.freeze({ staples: 0.33, protein: 0.34, 'fresh-drinks': 0.17, convenience: 0.16 }),
    household: Object.freeze({ home: 0.25, wear: 0.25, daily: 0.25, durables: 0.25 }),
  }),
});

const SUBSISTENCE_CLASS_SHARES = Object.freeze({
  basic: Object.freeze({
    food: Object.freeze({ staples: 0.68, protein: 0.27, 'fresh-drinks': 0.03, convenience: 0.02 }),
    household: Object.freeze({ home: 0.05, wear: 0.35, daily: 0.60, durables: 0 }),
  }),
  skilled: Object.freeze({
    food: Object.freeze({ staples: 0.60, protein: 0.30, 'fresh-drinks': 0.06, convenience: 0.04 }),
    household: Object.freeze({ home: 0.08, wear: 0.37, daily: 0.55, durables: 0 }),
  }),
  professional: Object.freeze({
    food: Object.freeze({ staples: 0.50, protein: 0.34, 'fresh-drinks': 0.10, convenience: 0.06 }),
    household: Object.freeze({ home: 0.12, wear: 0.38, daily: 0.50, durables: 0 }),
  }),
});

const boundWorldByPlayer = new WeakMap();

function nonNegativeInteger(value) {
  const normalized = Math.floor(Number(value || 0));
  return Number.isSafeInteger(normalized) && normalized >= 0 ? normalized : 0;
}

function emptyIncomeSources() {
  return { production: 0, construction: 0, warehouse: 0, marketService: 0 };
}

function defaultModel(modelId) {
  return {
    id: modelId,
    name: MODEL_CONFIG[modelId].name,
    credits: 0,
    frozenCredits: 0,
    pendingIncome: emptyIncomeSources(),
    lastIncome: 0,
    incomeEma: 0,
    recentPeakIncome: 0,
    noIncomeCycles: 0,
    consumptionState: 'normal',
    lastBudget: 0,
    foodBudget: 0,
    householdBudget: 0,
    totalIncome: 0,
    totalSpent: 0,
  };
}

function defaultState() {
  return {
    modelVersion: POPULATION_ECONOMY_VERSION,
    models: Object.fromEntries(POPULATION_MODEL_IDS.map((id) => [id, defaultModel(id)])),
    demandCycle: { cycleId: -1, groups: {} },
    stats: {
      totalEmploymentIncome: 0,
      productionIncome: 0,
      constructionIncome: 0,
      warehouseIncome: 0,
      marketServiceIncome: 0,
      totalConsumption: 0,
      migrationIssued: 0,
      productionByComplexity: Object.fromEntries(Object.keys(PRODUCTION_PROFILES).map((id) => [id, 0])),
    },
  };
}

function allocateInteger(amount, profile) {
  const total = nonNegativeInteger(amount);
  const rows = POPULATION_MODEL_IDS.map((id, index) => {
    const exact = total * Number(profile[id] || 0);
    return { id, index, exact, value: Math.floor(exact), remainder: exact - Math.floor(exact) };
  });
  let assigned = rows.reduce((sum, row) => sum + row.value, 0);
  rows.sort((left, right) => right.remainder - left.remainder || left.index - right.index);
  for (let cursor = 0; assigned < total; cursor = (cursor + 1) % rows.length) {
    rows[cursor].value += 1;
    assigned += 1;
  }
  return Object.fromEntries(rows.map((row) => [row.id, row.value]));
}

function normalizeModel(modelId, previous = {}) {
  const fallback = defaultModel(modelId);
  const model = { ...fallback, ...previous, id: modelId, name: MODEL_CONFIG[modelId].name };
  model.credits = nonNegativeInteger(model.credits);
  model.frozenCredits = nonNegativeInteger(model.frozenCredits);
  model.pendingIncome = { ...emptyIncomeSources(), ...(previous.pendingIncome || {}) };
  for (const key of Object.keys(model.pendingIncome)) model.pendingIncome[key] = nonNegativeInteger(model.pendingIncome[key]);
  for (const key of ['lastIncome', 'incomeEma', 'recentPeakIncome', 'noIncomeCycles', 'lastBudget', 'foodBudget', 'householdBudget', 'totalIncome', 'totalSpent']) {
    model[key] = nonNegativeInteger(model[key]);
  }
  if (!['normal', 'cautious', 'subsistence'].includes(model.consumptionState)) model.consumptionState = 'normal';
  return model;
}

function bootstrapAmount(world) {
  const groupTotal = Object.values(world.demandGroups || {}).reduce(
    (sum, group) => sum + nonNegativeInteger(group?.lastBudget),
    0,
  );
  return Math.max(5_700, groupTotal);
}

function bindPlayers(world) {
  for (const player of Object.values(world.players || {})) boundWorldByPlayer.set(player, world);
}

export function ensurePopulationEconomy(world, now = Date.now()) {
  const previous = world.populationEconomy && typeof world.populationEconomy === 'object'
    ? world.populationEconomy
    : null;
  const needsBootstrap = !previous || Number(previous.modelVersion || 0) < POPULATION_ECONOMY_VERSION;
  const state = previous || defaultState();
  state.modelVersion = POPULATION_ECONOMY_VERSION;
  state.models ||= {};
  for (const modelId of POPULATION_MODEL_IDS) {
    const existing = state.models[modelId] && typeof state.models[modelId] === 'object'
      ? state.models[modelId]
      : {};
    Object.assign(existing, normalizeModel(modelId, existing));
    state.models[modelId] = existing;
  }
  state.stats = { ...defaultState().stats, ...(state.stats || {}) };
  state.stats.productionByComplexity = {
    ...defaultState().stats.productionByComplexity,
    ...(state.stats.productionByComplexity || {}),
  };
  state.demandCycle = state.demandCycle && typeof state.demandCycle === 'object'
    ? state.demandCycle
    : { cycleId: -1, groups: {} };

  if (needsBootstrap) {
    const seed = bootstrapAmount(world);
    const allocation = allocateInteger(seed, CONSTRUCTION_PROFILE);
    for (const modelId of POPULATION_MODEL_IDS) {
      const amount = allocation[modelId];
      state.models[modelId].credits += amount;
      state.models[modelId].incomeEma = amount;
      state.models[modelId].recentPeakIncome = amount;
      state.models[modelId].totalIncome += amount;
    }
    state.stats.migrationIssued = nonNegativeInteger(state.stats.migrationIssued) + seed;
    state.demandCycle = { cycleId: -1, groups: {}, initializedAt: now };
  }

  world.populationEconomy = state;
  bindPlayers(world);
  return state;
}

function sourceKey(source) {
  if (source === 'production') return 'production';
  if (source === 'construction') return 'construction';
  if (source === 'warehouse') return 'warehouse';
  if (source === 'marketService') return 'marketService';
  throw new Error(`Unsupported population employment source: ${source}`);
}

function profileFor(source, complexity) {
  if (source === 'production') return PRODUCTION_PROFILES[String(complexity || 'C1')] || PRODUCTION_PROFILES.C1;
  if (source === 'construction') return CONSTRUCTION_PROFILE;
  if (source === 'warehouse') return WAREHOUSE_PROFILE;
  if (source === 'marketService') return MARKET_SERVICE_PROFILE;
  throw new Error(`Unsupported population employment source: ${source}`);
}

export function creditPopulationEmployment(world, amount, source, { complexity } = {}) {
  const total = nonNegativeInteger(amount);
  if (total <= 0) return Object.fromEntries(POPULATION_MODEL_IDS.map((id) => [id, 0]));
  const state = ensurePopulationEconomy(world);
  const key = sourceKey(source);
  const allocation = allocateInteger(total, profileFor(source, complexity));
  for (const modelId of POPULATION_MODEL_IDS) {
    state.models[modelId].pendingIncome[key] += allocation[modelId];
  }
  state.stats.totalEmploymentIncome += total;
  state.stats[`${key}Income`] = nonNegativeInteger(state.stats[`${key}Income`]) + total;
  if (key === 'production') {
    const normalizedComplexity = PRODUCTION_PROFILES[String(complexity)] ? String(complexity) : 'C1';
    state.stats.productionByComplexity[normalizedComplexity] = nonNegativeInteger(
      state.stats.productionByComplexity[normalizedComplexity],
    ) + total;
  }
  return allocation;
}

export function creditPopulationEmploymentForPlayer(player, amount, source, options = {}) {
  const world = boundWorldByPlayer.get(player);
  if (!world) return false;
  creditPopulationEmployment(world, amount, source, options);
  return true;
}

export function releaseConstructionEmployment(world, construction, now = Date.now()) {
  if (!construction) return 0;
  const buildCost = nonNegativeInteger(construction.buildCost);
  const startedAt = Number(construction.startedAt || now);
  const completesAt = Math.max(startedAt + 1, Number(construction.completesAt || startedAt + 1));
  const elapsed = Math.max(0, Math.min(completesAt - startedAt, now - startedAt));
  const targetReleased = now >= completesAt
    ? buildCost
    : Math.floor(buildCost * elapsed / Math.max(1, completesAt - startedAt));
  const alreadyReleased = nonNegativeInteger(construction.employmentReleased);
  const release = Math.max(0, targetReleased - alreadyReleased);
  if (release > 0) {
    creditPopulationEmployment(world, release, 'construction');
    construction.employmentReleased = alreadyReleased + release;
  }
  return release;
}

function groupSharesFor(modelId, state) {
  if (state === 'subsistence') {
    const food = modelId === 'basic' ? 0.95 : modelId === 'skilled' ? 0.90 : 0.85;
    return { food, household: 1 - food };
  }
  if (state === 'cautious') {
    const food = modelId === 'basic' ? 0.88 : modelId === 'skilled' ? 0.73 : 0.58;
    return { food, household: 1 - food };
  }
  return MODEL_CONFIG[modelId].normalGroupShares;
}

function updateModelIncome(model) {
  const income = Object.values(model.pendingIncome).reduce((sum, value) => sum + nonNegativeInteger(value), 0);
  model.lastIncome = income;
  model.credits += income;
  model.totalIncome += income;
  model.pendingIncome = emptyIncomeSources();
  model.incomeEma = Math.max(0, Math.round(model.incomeEma * 0.70 + income * 0.30));
  model.recentPeakIncome = Math.max(income, Math.round(model.recentPeakIncome * 0.92));
  model.noIncomeCycles = income > 0 ? 0 : model.noIncomeCycles + 1;
  const ratio = model.recentPeakIncome <= 0 ? 1 : model.incomeEma / model.recentPeakIncome;
  model.consumptionState = ratio >= 0.75
    ? 'normal'
    : ratio >= 0.35 && model.noIncomeCycles < 2
      ? 'cautious'
      : 'subsistence';
}

function modelSpendableBudget(modelId, model) {
  const config = MODEL_CONFIG[modelId];
  const targetReserve = Math.floor(model.incomeEma * config.reserveCycles);
  const baseBudget = Math.floor(model.incomeEma * config.marginalPropensityToConsume);
  const excessSavings = Math.max(0, model.credits - targetReserve);
  const target = Math.min(model.credits, baseBudget + Math.floor(excessSavings * config.excessReleaseRate));
  if (model.lastBudget <= 0) return target;
  const minimum = Math.max(0, Math.ceil(model.lastBudget * 0.80));
  const maximum = Math.max(minimum, Math.floor(model.lastBudget * 1.15));
  return Math.min(model.credits, Math.max(minimum, Math.min(maximum, target)));
}

export function preparePopulationDemandCycle(world, cycleId, now = Date.now()) {
  const state = ensurePopulationEconomy(world, now);
  if (Number(state.demandCycle?.cycleId) === Number(cycleId)) return state.demandCycle;
  const groups = { food: {}, household: {} };
  for (const modelId of POPULATION_MODEL_IDS) {
    const model = state.models[modelId];
    updateModelIncome(model);
    const spendable = modelSpendableBudget(modelId, model);
    const shares = groupSharesFor(modelId, model.consumptionState);
    const foodBudget = Math.floor(spendable * shares.food);
    const householdBudget = spendable - foodBudget;
    model.lastBudget = spendable;
    model.foodBudget = foodBudget;
    model.householdBudget = householdBudget;
    groups.food[modelId] = foodBudget;
    groups.household[modelId] = householdBudget;
  }
  state.demandCycle = { cycleId: Number(cycleId), createdAt: now, groups };
  return state.demandCycle;
}

export function populationClassShares(world, modelId, groupId) {
  const model = ensurePopulationEconomy(world).models[modelId];
  const table = model?.consumptionState === 'subsistence'
    ? SUBSISTENCE_CLASS_SHARES
    : model?.consumptionState === 'cautious'
      ? CAUTIOUS_CLASS_SHARES
      : NORMAL_CLASS_SHARES;
  return table[modelId]?.[groupId] || {};
}

export function populationModelState(world, modelId) {
  return ensurePopulationEconomy(world).models[String(modelId || '')] || null;
}

export function reservePopulationOrder(world, modelId, amount) {
  const model = populationModelState(world, modelId);
  const total = nonNegativeInteger(amount);
  if (!model || total <= 0 || model.credits < total) return false;
  model.credits -= total;
  model.frozenCredits += total;
  return true;
}

export function releasePopulationOrderFunds(world, order, quantity = order?.remaining) {
  const model = populationModelState(world, order?.populationModelId);
  const release = nonNegativeInteger(quantity) * nonNegativeInteger(order?.price);
  if (!model || release <= 0) return 0;
  const actual = Math.min(model.frozenCredits, release);
  model.frozenCredits -= actual;
  model.credits += actual;
  return actual;
}

export function settlePopulationPurchase(world, order, quantity, tradePrice) {
  const state = ensurePopulationEconomy(world);
  const model = state.models[String(order?.populationModelId || '')];
  if (!model) throw new Error(`Missing population funding model ${order?.populationModelId}`);
  const reserved = nonNegativeInteger(quantity) * nonNegativeInteger(order?.price);
  const actual = nonNegativeInteger(quantity) * nonNegativeInteger(tradePrice);
  if (model.frozenCredits < reserved) throw new Error('Population frozen credits are insufficient');
  model.frozenCredits -= reserved;
  model.credits += Math.max(0, reserved - actual);
  model.totalSpent += actual;
  state.stats.totalConsumption += actual;
}

export function recordPopulationSellerIncome(player, amount) {
  player.stats ||= {};
  player.stats.populationIncome = nonNegativeInteger(player.stats.populationIncome) + nonNegativeInteger(amount);
}

export function createPopulationEconomySummary(world) {
  const state = ensurePopulationEconomy(world);
  const models = Object.fromEntries(POPULATION_MODEL_IDS.map((modelId) => {
    const model = state.models[modelId];
    return [modelId, {
      id: modelId,
      name: model.name,
      consumptionState: model.consumptionState,
      credits: model.credits,
      frozenCredits: model.frozenCredits,
      pendingIncome: { ...model.pendingIncome },
      lastIncome: model.lastIncome,
      incomeEma: model.incomeEma,
      recentPeakIncome: model.recentPeakIncome,
      noIncomeCycles: model.noIncomeCycles,
      lastBudget: model.lastBudget,
      foodBudget: model.foodBudget,
      householdBudget: model.householdBudget,
      totalIncome: model.totalIncome,
      totalSpent: model.totalSpent,
    }];
  }));
  const constructionEscrow = Object.values(world.players || {}).reduce((sum, player) => {
    const construction = player.facilityConstruction;
    if (!construction) return sum;
    return sum + Math.max(0, nonNegativeInteger(construction.buildCost) - nonNegativeInteger(construction.employmentReleased));
  }, 0);
  const players = Object.values(world.players || {});
  const issuance = players.reduce((summary, player) => {
    const stats = player.stats || {};
    summary.work += nonNegativeInteger(stats.workIssued);
    summary.exchange += nonNegativeInteger(stats.gemExchangeCredits);
    summary.gift += nonNegativeInteger(stats.giftIssued);
    summary.legacyPopulation += nonNegativeInteger(stats.populationIssued);
    return summary;
  }, { work: 0, exchange: 0, gift: 0, legacyPopulation: 0 });
  const totals = Object.values(models).reduce((summary, model) => {
    summary.credits += model.credits;
    summary.frozenCredits += model.frozenCredits;
    summary.pendingIncome += Object.values(model.pendingIncome).reduce((sum, value) => sum + value, 0);
    summary.lastIncome += model.lastIncome;
    summary.lastBudget += model.lastBudget;
    summary.totalIncome += model.totalIncome;
    summary.totalSpent += model.totalSpent;
    return summary;
  }, { credits: 0, frozenCredits: 0, pendingIncome: 0, lastIncome: 0, lastBudget: 0, totalIncome: 0, totalSpent: 0 });
  return {
    ...totals,
    constructionEscrow,
    models,
    sources: {
      production: nonNegativeInteger(state.stats.productionIncome),
      construction: nonNegativeInteger(state.stats.constructionIncome),
      warehouse: nonNegativeInteger(state.stats.warehouseIncome),
      marketService: nonNegativeInteger(state.stats.marketServiceIncome),
    },
    productionByComplexity: { ...state.stats.productionByComplexity },
    totalEmploymentIncome: nonNegativeInteger(state.stats.totalEmploymentIncome),
    totalConsumption: nonNegativeInteger(state.stats.totalConsumption),
    issuance: {
      ...issuance,
      migration: nonNegativeInteger(state.stats.migrationIssued),
      total: issuance.work + issuance.exchange + issuance.gift + issuance.legacyPopulation + nonNegativeInteger(state.stats.migrationIssued),
    },
  };
}
