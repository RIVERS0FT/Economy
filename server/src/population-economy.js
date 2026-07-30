import {
  calculatePopulationStabilizationBudgets,
  defaultPopulationPolicy,
  ensurePopulationPolicyState,
  POPULATION_POLICY_CYCLE_MS,
  POPULATION_POLICY_DEFAULTS,
  POPULATION_POLICY_LIMITS,
  populationPolicyRefillCap,
  populationPolicySnapshot,
} from './population-policy.js';
import { internalMoneyToMicros, microsToInternalMoney, multiplyMoneyByInteger, roundInternalMoney } from './money.js';

export const POPULATION_ECONOMY_VERSION = 6;
export const POPULATION_MODEL_IDS = Object.freeze(['basic', 'skilled', 'professional']);
export const POPULATION_CONSUMPTION_STATES = Object.freeze(['lavish', 'prosperous', 'normal', 'strained', 'subsistence']);
export const POPULATION_STABILIZATION_BUDGET_SHARE = 0.12;
export const POPULATION_STABILIZATION_TARGET_CYCLES = 3;
export const POPULATION_STABILIZATION_DIRECT_SHARE = 0.85;
const INCOME_EMA_PREVIOUS_WEIGHT = 0.85;
const BUDGET_MAX_FALL = 0.12;
const PROSPEROUS_ENTRY_CYCLES = 2;
const LAVISH_ENTRY_CYCLES = 3;
const UPPER_STATE_DOWNGRADE_CYCLES = 2;

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


export const POPULATION_GROUP_SHARES_BY_STATE = Object.freeze({
  lavish: Object.freeze({
    basic: Object.freeze({ food: 0.65, household: 0.35 }),
    skilled: Object.freeze({ food: 0.42, household: 0.58 }),
    professional: Object.freeze({ food: 0.22, household: 0.78 }),
  }),
  prosperous: Object.freeze({
    basic: Object.freeze({ food: 0.72, household: 0.28 }),
    skilled: Object.freeze({ food: 0.50, household: 0.50 }),
    professional: Object.freeze({ food: 0.30, household: 0.70 }),
  }),
  normal: Object.freeze({
    basic: MODEL_CONFIG.basic.normalGroupShares,
    skilled: MODEL_CONFIG.skilled.normalGroupShares,
    professional: MODEL_CONFIG.professional.normalGroupShares,
  }),
  strained: Object.freeze({
    basic: Object.freeze({ food: 0.88, household: 0.12 }),
    skilled: Object.freeze({ food: 0.73, household: 0.27 }),
    professional: Object.freeze({ food: 0.58, household: 0.42 }),
  }),
  subsistence: Object.freeze({
    basic: Object.freeze({ food: 0.95, household: 0.05 }),
    skilled: Object.freeze({ food: 0.90, household: 0.10 }),
    professional: Object.freeze({ food: 0.85, household: 0.15 }),
  }),
});

const CONSTRUCTION_PROFILE = Object.freeze({ basic: 0.60, skilled: 0.30, professional: 0.10 });
const WAREHOUSE_PROFILE = Object.freeze({ basic: 0.50, skilled: 0.40, professional: 0.10 });
const MARKET_SERVICE_PROFILE = Object.freeze({ basic: 0.20, skilled: 0.60, professional: 0.20 });
const BANKING_PROFILE = Object.freeze({ basic: 0.10, skilled: 0.60, professional: 0.30 });
const PRODUCTION_PROFILES = Object.freeze({
  C1: Object.freeze({ basic: 0.90, skilled: 0.09, professional: 0.01 }),
  C2: Object.freeze({ basic: 0.78, skilled: 0.20, professional: 0.02 }),
  C3: Object.freeze({ basic: 0.55, skilled: 0.40, professional: 0.05 }),
  C4: Object.freeze({ basic: 0.30, skilled: 0.60, professional: 0.10 }),
  C5: Object.freeze({ basic: 0.18, skilled: 0.55, professional: 0.27 }),
  C6: Object.freeze({ basic: 0.10, skilled: 0.40, professional: 0.50 }),
  C7: Object.freeze({ basic: 0.05, skilled: 0.25, professional: 0.70 }),
});

const LAVISH_CLASS_SHARES = Object.freeze({
  basic: Object.freeze({
    food: Object.freeze({ staples: 0.36, protein: 0.25, 'fresh-drinks': 0.16, convenience: 0.23 }),
    household: Object.freeze({ home: 0.28, wear: 0.27, daily: 0.25, durables: 0.20 }),
  }),
  skilled: Object.freeze({
    food: Object.freeze({ staples: 0.22, protein: 0.27, 'fresh-drinks': 0.22, convenience: 0.29 }),
    household: Object.freeze({ home: 0.30, wear: 0.18, daily: 0.17, durables: 0.35 }),
  }),
  professional: Object.freeze({
    food: Object.freeze({ staples: 0.10, protein: 0.24, 'fresh-drinks': 0.31, convenience: 0.35 }),
    household: Object.freeze({ home: 0.25, wear: 0.12, daily: 0.06, durables: 0.57 }),
  }),
});

const PROSPEROUS_CLASS_SHARES = Object.freeze({
  basic: Object.freeze({
    food: Object.freeze({ staples: 0.43, protein: 0.26, 'fresh-drinks': 0.13, convenience: 0.18 }),
    household: Object.freeze({ home: 0.24, wear: 0.31, daily: 0.29, durables: 0.16 }),
  }),
  skilled: Object.freeze({
    food: Object.freeze({ staples: 0.28, protein: 0.29, 'fresh-drinks': 0.18, convenience: 0.25 }),
    household: Object.freeze({ home: 0.27, wear: 0.22, daily: 0.21, durables: 0.30 }),
  }),
  professional: Object.freeze({
    food: Object.freeze({ staples: 0.15, protein: 0.28, 'fresh-drinks': 0.28, convenience: 0.29 }),
    household: Object.freeze({ home: 0.22, wear: 0.16, daily: 0.08, durables: 0.54 }),
  }),
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

const STRAINED_CLASS_SHARES = Object.freeze({
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


const CLASS_SHARES_BY_STATE = Object.freeze({
  lavish: LAVISH_CLASS_SHARES,
  prosperous: PROSPEROUS_CLASS_SHARES,
  normal: NORMAL_CLASS_SHARES,
  strained: STRAINED_CLASS_SHARES,
  subsistence: SUBSISTENCE_CLASS_SHARES,
});

const boundWorldByPlayer = new WeakMap();

function nonNegativeInteger(value) {
  const normalized = Math.floor(Number(value || 0));
  return Number.isSafeInteger(normalized) && normalized >= 0 ? normalized : 0;
}

function nonNegativeMoney(value) {
  return Math.max(0, roundInternalMoney(value || 0) || 0);
}

function emptyIncomeSources() {
  return { production: 0, construction: 0, warehouse: 0, marketService: 0, banking: 0 };
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
    stateReason: 'healthy',
    stateCycles: 0,
    prosperityCycles: 0,
    lavishCycles: 0,
    downgradeCycles: 0,
    incomeHealthBps: 10_000,
    walletCoverageBps: 0,
    incomeCoverageBps: 0,
    lastBudget: 0,
    foodBudget: 0,
    householdBudget: 0,
    stabilizationBudget: 0,
    lastStabilizationIssued: 0,
    lastAdminPopulationIssued: 0,
    totalIncome: 0,
    totalSpent: 0,
  };
}

function defaultState() {
  return {
    modelVersion: POPULATION_ECONOMY_VERSION,
    policy: defaultPopulationPolicy(),
    policyCycle: null,
    models: Object.fromEntries(POPULATION_MODEL_IDS.map((id) => [id, defaultModel(id)])),
    demandCycle: { cycleId: -1, groups: {} },
    stats: {
      totalEmploymentIncome: 0,
      productionIncome: 0,
      constructionIncome: 0,
      warehouseIncome: 0,
      marketServiceIncome: 0,
      bankingIncome: 0,
      productionWageSubsidyIssued: 0,
      productionWageWithheld: 0,
      totalConsumption: 0,
      migrationIssued: 0,
      stabilizationIssued: 0,
      adminPopulationIssued: 0,
      productionByComplexity: Object.fromEntries(Object.keys(PRODUCTION_PROFILES).map((id) => [id, 0])),
    },
  };
}

function allocateMoney(amount, profile) {
  const totalMicros = Math.max(0, Math.round(nonNegativeMoney(amount) * 1_000_000));
  const rows = POPULATION_MODEL_IDS.map((id, index) => {
    const exact = totalMicros * Number(profile[id] || 0);
    return { id, index, value: Math.floor(exact), remainder: exact - Math.floor(exact) };
  });
  let assigned = rows.reduce((sum, row) => sum + row.value, 0);
  rows.sort((left, right) => right.remainder - left.remainder || left.index - right.index);
  for (let cursor = 0; assigned < totalMicros; cursor = (cursor + 1) % rows.length) {
    rows[cursor].value += 1;
    assigned += 1;
  }
  return Object.fromEntries(rows.map((row) => [row.id, row.value / 1_000_000]));
}

function normalizeModel(modelId, previous = {}) {
  const fallback = defaultModel(modelId);
  const hadStateCycles = Object.prototype.hasOwnProperty.call(previous, 'stateCycles');
  const migratedCautious = previous.consumptionState === 'cautious';
  const model = { ...fallback, ...previous, id: modelId, name: MODEL_CONFIG[modelId].name };
  model.credits = nonNegativeMoney(model.credits);
  model.frozenCredits = nonNegativeMoney(model.frozenCredits);
  model.pendingIncome = { ...emptyIncomeSources(), ...(previous.pendingIncome || {}) };
  for (const key of Object.keys(model.pendingIncome)) model.pendingIncome[key] = nonNegativeMoney(model.pendingIncome[key]);
  for (const key of ['lastIncome', 'incomeEma', 'recentPeakIncome', 'lastBudget', 'foodBudget', 'householdBudget', 'stabilizationBudget', 'lastStabilizationIssued', 'lastAdminPopulationIssued', 'totalIncome', 'totalSpent']) model[key] = nonNegativeMoney(model[key]);
  for (const key of ['noIncomeCycles', 'stateCycles', 'prosperityCycles', 'lavishCycles', 'downgradeCycles', 'incomeHealthBps', 'walletCoverageBps', 'incomeCoverageBps']) model[key] = nonNegativeInteger(model[key]);
  if (model.consumptionState === 'cautious') model.consumptionState = 'strained';
  if (!POPULATION_CONSUMPTION_STATES.includes(model.consumptionState)) model.consumptionState = 'normal';
  if (migratedCautious) model.stateReason = 'income-strained';
  if (typeof model.stateReason !== 'string' || !model.stateReason) model.stateReason = 'healthy';
  if (!hadStateCycles) model.stateCycles = 1;
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

export function ensurePopulationEconomy(world, now = undefined) {
  const previous = world.populationEconomy && typeof world.populationEconomy === 'object'
    ? world.populationEconomy
    : null;
  const needsBootstrap = !previous || Number(previous.modelVersion || 0) < 1;
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
  const policyNow = now === undefined || now === null
    ? Math.max(0, Number(state.policyCycle?.cycleId || 0)) * POPULATION_POLICY_CYCLE_MS
    : Number(now);
  ensurePopulationPolicyState(state, policyNow);

  if (needsBootstrap) {
    const seed = bootstrapAmount(world);
    const allocation = allocateMoney(seed, CONSTRUCTION_PROFILE);
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
  if (source === 'banking') return 'banking';
  throw new Error(`Unsupported population employment source: ${source}`);
}

function profileFor(source, complexity) {
  if (source === 'production') return PRODUCTION_PROFILES[String(complexity || 'C1')] || PRODUCTION_PROFILES.C1;
  if (source === 'construction') return CONSTRUCTION_PROFILE;
  if (source === 'warehouse') return WAREHOUSE_PROFILE;
  if (source === 'marketService') return MARKET_SERVICE_PROFILE;
  if (source === 'banking') return BANKING_PROFILE;
  throw new Error(`Unsupported population employment source: ${source}`);
}

export function creditPopulationEmployment(world, amount, source, { complexity, payerAmount = amount } = {}) {
  const total = nonNegativeMoney(amount);
  if (total <= 0) return Object.fromEntries(POPULATION_MODEL_IDS.map((id) => [id, 0]));
  const state = ensurePopulationEconomy(world);
  const key = sourceKey(source);
  const allocation = allocateMoney(total, profileFor(source, complexity));
  for (const modelId of POPULATION_MODEL_IDS) {
    state.models[modelId].pendingIncome[key] += allocation[modelId];
  }
  state.stats.totalEmploymentIncome += total;
  state.stats[`${key}Income`] = roundInternalMoney(nonNegativeMoney(state.stats[`${key}Income`]) + total) || 0;
  if (key === 'production') {
    const normalizedComplexity = PRODUCTION_PROFILES[String(complexity)] ? String(complexity) : 'C1';
    state.stats.productionByComplexity[normalizedComplexity] = nonNegativeInteger(
      state.stats.productionByComplexity[normalizedComplexity],
    ) + total;
    const playerFunded = nonNegativeMoney(payerAmount);
    if (total > playerFunded) {
      state.stats.productionWageSubsidyIssued = roundInternalMoney(nonNegativeMoney(state.stats.productionWageSubsidyIssued) + total - playerFunded) || 0;
    } else if (playerFunded > total) {
      state.stats.productionWageWithheld = roundInternalMoney(nonNegativeMoney(state.stats.productionWageWithheld) + playerFunded - total) || 0;
    }
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
  return POPULATION_GROUP_SHARES_BY_STATE[state]?.[modelId] || POPULATION_GROUP_SHARES_BY_STATE.normal[modelId];
}

function incrementCounter(value, maximum = Number.MAX_SAFE_INTEGER) {
  return Math.min(maximum, nonNegativeInteger(value) + 1);
}

function ratioToBps(numerator, denominator, fallbackBps = 10_000) {
  if (denominator <= 0) return fallbackBps;
  return nonNegativeInteger(Math.round(numerator / denominator * 10_000));
}

function setConsumptionState(model, nextState, reason) {
  const changed = model.consumptionState !== nextState;
  model.consumptionState = nextState;
  model.stateReason = reason;
  model.stateCycles = changed ? 1 : incrementCounter(model.stateCycles);
  if (changed) model.downgradeCycles = 0;
}

function updateModelIncome(model) {
  const income = Object.values(model.pendingIncome).reduce((sum, value) => roundInternalMoney(sum + nonNegativeMoney(value)) || 0, 0);
  model.lastIncome = income;
  model.credits = roundInternalMoney(model.credits + income) || 0;
  model.totalIncome = roundInternalMoney(model.totalIncome + income) || 0;
  model.pendingIncome = emptyIncomeSources();
  model.incomeEma = Math.max(0, roundInternalMoney(model.incomeEma * INCOME_EMA_PREVIOUS_WEIGHT + income * (1 - INCOME_EMA_PREVIOUS_WEIGHT)) || 0);
  model.recentPeakIncome = Math.max(model.incomeEma, roundInternalMoney(model.recentPeakIncome * 0.92) || 0);
  model.noIncomeCycles = income > 0 ? 0 : incrementCounter(model.noIncomeCycles);
}

function updateModelConsumptionState(model, stabilizationBudget, targetWallet, walletTotal) {
  const incomeHealth = model.recentPeakIncome <= 0 ? 1 : model.incomeEma / model.recentPeakIncome;
  const walletCoverage = targetWallet <= 0 ? 0 : walletTotal / targetWallet;
  const incomeCoverage = stabilizationBudget <= 0 ? 0 : model.incomeEma / stabilizationBudget;
  model.incomeHealthBps = ratioToBps(model.incomeEma, model.recentPeakIncome);
  model.walletCoverageBps = ratioToBps(walletTotal, targetWallet, 0);
  model.incomeCoverageBps = ratioToBps(model.incomeEma, stabilizationBudget, 0);

  const prosperousEligible = model.lastIncome > 0
    && incomeHealth >= 0.85
    && walletCoverage >= 1
    && incomeCoverage >= 1;
  const lavishEligible = model.lastIncome > 0
    && incomeHealth >= 0.95
    && walletCoverage >= 1.5
    && incomeCoverage >= 1.5;
  model.prosperityCycles = prosperousEligible
    ? incrementCounter(model.prosperityCycles, PROSPEROUS_ENTRY_CYCLES)
    : 0;
  model.lavishCycles = lavishEligible
    ? incrementCounter(model.lavishCycles, LAVISH_ENTRY_CYCLES)
    : 0;

  if (model.noIncomeCycles >= 2) {
    model.prosperityCycles = 0;
    model.lavishCycles = 0;
    model.downgradeCycles = 0;
    setConsumptionState(model, 'subsistence', 'no-income');
    return;
  }
  if (incomeHealth < 0.35) {
    model.prosperityCycles = 0;
    model.lavishCycles = 0;
    model.downgradeCycles = 0;
    setConsumptionState(model, 'subsistence', 'income-collapse');
    return;
  }
  if (incomeHealth < 0.65) {
    model.prosperityCycles = 0;
    model.lavishCycles = 0;
    model.downgradeCycles = 0;
    setConsumptionState(model, 'strained', 'income-strained');
    return;
  }

  if (model.consumptionState === 'subsistence') {
    model.downgradeCycles = 0;
    setConsumptionState(model, 'strained', 'recovering');
    return;
  }
  if (model.consumptionState === 'strained') {
    model.downgradeCycles = 0;
    setConsumptionState(model, 'normal', 'recovering');
    return;
  }
  if (model.consumptionState === 'normal') {
    model.downgradeCycles = 0;
    if (model.prosperityCycles >= PROSPEROUS_ENTRY_CYCLES) {
      setConsumptionState(model, 'prosperous', 'prosperous-qualified');
    } else {
      setConsumptionState(model, 'normal', 'healthy');
    }
    return;
  }
  if (model.consumptionState === 'prosperous') {
    if (model.lavishCycles >= LAVISH_ENTRY_CYCLES) {
      model.downgradeCycles = 0;
      setConsumptionState(model, 'lavish', 'lavish-qualified');
      return;
    }
    if (prosperousEligible) {
      model.downgradeCycles = 0;
      setConsumptionState(model, 'prosperous', 'prosperous-qualified');
      return;
    }
    model.downgradeCycles = incrementCounter(model.downgradeCycles, UPPER_STATE_DOWNGRADE_CYCLES);
    if (model.downgradeCycles >= UPPER_STATE_DOWNGRADE_CYCLES) {
      setConsumptionState(model, 'normal', 'healthy');
    } else {
      setConsumptionState(model, 'prosperous', 'downgrade-grace');
    }
    return;
  }
  if (lavishEligible) {
    model.downgradeCycles = 0;
    setConsumptionState(model, 'lavish', 'lavish-qualified');
    return;
  }
  model.downgradeCycles = incrementCounter(model.downgradeCycles, UPPER_STATE_DOWNGRADE_CYCLES);
  if (model.downgradeCycles >= UPPER_STATE_DOWNGRADE_CYCLES) {
    setConsumptionState(model, 'prosperous', prosperousEligible ? 'prosperous-qualified' : 'downgrade-grace');
  } else {
    setConsumptionState(model, 'lavish', 'downgrade-grace');
  }
}

function modelSpendableBudget(modelId, model, stabilizationBudget = 0) {
  const config = MODEL_CONFIG[modelId];
  const targetReserve = nonNegativeMoney(model.incomeEma * config.reserveCycles);
  const baseBudget = nonNegativeMoney(model.incomeEma * config.marginalPropensityToConsume);
  const excessSavings = Math.max(0, model.credits - targetReserve);
  const target = Math.min(model.credits, Math.max(stabilizationBudget, baseBudget + nonNegativeMoney(excessSavings * config.excessReleaseRate)));
  if (model.lastBudget <= 0) return target;
  const minimum = nonNegativeMoney(model.lastBudget * (1 - BUDGET_MAX_FALL));
  const maximum = Math.max(minimum, stabilizationBudget, nonNegativeMoney(model.lastBudget * 1.15));
  return Math.min(model.credits, Math.max(minimum, Math.min(maximum, target)));
}

export function preparePopulationDemandCycle(world, cycleId, now = Date.now(), { totalBaseBudget = 5_700 } = {}) {
  const state = ensurePopulationEconomy(world, now);
  if (Number(state.demandCycle?.cycleId) === Number(cycleId)) return state.demandCycle;
  const { policy, policyCycle } = ensurePopulationPolicyState(state, now);
  const groups = { food: {}, household: {} };
  const baseGroups = { food: {}, household: {} };
  const earnedGroups = { food: {}, household: {} };
  const stabilization = calculatePopulationStabilizationBudgets(nonNegativeInteger(totalBaseBudget), policy);
  for (const modelId of POPULATION_MODEL_IDS) {
    const model = state.models[modelId];
    updateModelIncome(model);
    const stabilizationBudget = stabilization.byModel[modelId];
    const targetWallet = stabilizationBudget * policy.targetWalletCycles;
    const walletTotal = model.credits + model.frozenCredits;
    updateModelConsumptionState(model, stabilizationBudget, targetWallet, walletTotal);
    const refillCap = populationPolicyRefillCap(stabilizationBudget, policy);
    const remainingCap = Math.max(0, refillCap - nonNegativeInteger(policyCycle.issuedByModel[modelId]));
    const stabilizationIssued = Math.min(remainingCap, Math.max(0, targetWallet - walletTotal));
    if (stabilizationIssued > 0) {
      model.credits += stabilizationIssued;
      state.stats.stabilizationIssued = nonNegativeInteger(state.stats.stabilizationIssued) + stabilizationIssued;
      policyCycle.issuedByModel[modelId] += stabilizationIssued;
      policyCycle.automaticByModel[modelId] += stabilizationIssued;
    }
    model.stabilizationBudget = stabilizationBudget;
    model.lastStabilizationIssued = stabilizationIssued;
    const spendable = modelSpendableBudget(modelId, model, stabilizationBudget);
    const baseSpendable = Math.min(spendable, stabilizationBudget);
    const earnedSpendable = spendable - baseSpendable;
    const shares = groupSharesFor(modelId, model.consumptionState);
    const foodBaseBudget = nonNegativeMoney(baseSpendable * shares.food);
    const householdBaseBudget = baseSpendable - foodBaseBudget;
    const foodEarnedBudget = nonNegativeMoney(earnedSpendable * shares.food);
    const householdEarnedBudget = earnedSpendable - foodEarnedBudget;
    const foodBudget = foodBaseBudget + foodEarnedBudget;
    const householdBudget = householdBaseBudget + householdEarnedBudget;
    model.lastBudget = spendable;
    model.foodBudget = foodBudget;
    model.householdBudget = householdBudget;
    groups.food[modelId] = foodBudget;
    groups.household[modelId] = householdBudget;
    baseGroups.food[modelId] = foodBaseBudget;
    baseGroups.household[modelId] = householdBaseBudget;
    earnedGroups.food[modelId] = foodEarnedBudget;
    earnedGroups.household[modelId] = householdEarnedBudget;
  }
  state.demandCycle = {
    cycleId: Number(cycleId),
    createdAt: now,
    groups,
    baseGroups,
    earnedGroups,
    stabilizationTotal: stabilization.total,
    policy: populationPolicySnapshot(state, now),
  };
  return state.demandCycle;
}

export function populationClassShares(world, modelId, groupId) {
  const model = ensurePopulationEconomy(world).models[modelId];
  const table = CLASS_SHARES_BY_STATE[model?.consumptionState] || NORMAL_CLASS_SHARES;
  return table[modelId]?.[groupId] || {};
}

export function populationModelState(world, modelId) {
  return ensurePopulationEconomy(world).models[String(modelId || '')] || null;
}

export function reservePopulationOrder(world, modelId, amount) {
  const slices = reservePopulationOrderFunding(world, [{ populationModelId: modelId, reservedAmount: amount }]);
  return Array.isArray(slices);
}

export function reservePopulationOrderFunding(world, requestedSlices = []) {
  const aggregated = new Map();
  for (const item of requestedSlices) {
    const modelId = String(item?.populationModelId || '');
    if (!POPULATION_MODEL_IDS.includes(modelId)) return null;
    const amount = nonNegativeMoney(item?.reservedAmount);
    if (amount <= 0) continue;
    aggregated.set(modelId, nonNegativeMoney((aggregated.get(modelId) || 0) + amount));
  }
  const slices = [...aggregated].map(([populationModelId, reservedAmount]) => ({ populationModelId, reservedAmount }));
  if (slices.length === 0) return null;
  for (const slice of slices) {
    const model = populationModelState(world, slice.populationModelId);
    if (!model || internalMoneyToMicros(model.credits) < internalMoneyToMicros(slice.reservedAmount)) return null;
  }
  for (const slice of slices) {
    const model = populationModelState(world, slice.populationModelId);
    model.credits = nonNegativeMoney(model.credits - slice.reservedAmount);
    model.frozenCredits = nonNegativeMoney(model.frozenCredits + slice.reservedAmount);
  }
  return slices;
}

function orderFundingSlices(order) {
  if (Array.isArray(order?.fundingSlices) && order.fundingSlices.length > 0) return order.fundingSlices;
  if (POPULATION_MODEL_IDS.includes(order?.populationModelId)) {
    return [{ populationModelId: order.populationModelId, reservedAmount: multiplyMoneyByInteger(order.price, order.remaining) || 0 }];
  }
  return [];
}

function consumePopulationFunding(world, order, reservedAmount, actualAmount) {
  const reservedMicros = internalMoneyToMicros(nonNegativeMoney(reservedAmount));
  const actualMicros = internalMoneyToMicros(nonNegativeMoney(actualAmount));
  if (reservedMicros === null || actualMicros === null || reservedMicros <= 0n || actualMicros > reservedMicros) return 0;
  const slices = orderFundingSlices(order);
  const segments = [];
  let remaining = reservedMicros;
  for (const slice of slices) {
    if (remaining <= 0n) break;
    const available = internalMoneyToMicros(nonNegativeMoney(slice.reservedAmount)) || 0n;
    const take = available < remaining ? available : remaining;
    if (take <= 0n) continue;
    segments.push({ slice, take, actual: 0n, remainder: 0n });
    remaining -= take;
  }
  if (remaining > 0n) throw new Error('Population funding slices are insufficient');
  let assignedActual = 0n;
  for (const segment of segments) {
    const numerator = actualMicros * segment.take;
    segment.actual = numerator / reservedMicros;
    segment.remainder = numerator % reservedMicros;
    assignedActual += segment.actual;
  }
  let actualRemainder = actualMicros - assignedActual;
  segments.sort((left, right) => left.remainder === right.remainder ? 0 : left.remainder > right.remainder ? -1 : 1);
  for (let index = 0; actualRemainder > 0n; index = (index + 1) % segments.length) {
    segments[index].actual += 1n;
    actualRemainder -= 1n;
  }
  for (const segment of segments) {
    const model = populationModelState(world, segment.slice.populationModelId);
    if (!model) throw new Error(`Missing population funding model ${segment.slice.populationModelId}`);
    const frozenMicros = internalMoneyToMicros(model.frozenCredits) || 0n;
    if (frozenMicros < segment.take) throw new Error('Population frozen credits are insufficient');
    const refund = segment.take - segment.actual;
    model.frozenCredits = microsToInternalMoney(frozenMicros - segment.take) || 0;
    model.credits = nonNegativeMoney(model.credits + (microsToInternalMoney(refund) || 0));
    model.totalSpent = nonNegativeMoney(model.totalSpent + (microsToInternalMoney(segment.actual) || 0));
    if (Array.isArray(order.fundingSlices)) {
      segment.slice.reservedAmount = microsToInternalMoney((internalMoneyToMicros(segment.slice.reservedAmount) || 0n) - segment.take) || 0;
    }
  }
  return microsToInternalMoney(actualMicros) || 0;
}

export function releasePopulationOrderFunds(world, order, quantity = order?.remaining) {
  const requested = multiplyMoneyByInteger(order?.price, nonNegativeInteger(quantity));
  const requestedMicros = internalMoneyToMicros(nonNegativeMoney(requested));
  if (requestedMicros === null || requestedMicros <= 0n) return 0;
  const slices = orderFundingSlices(order);
  let remaining = requestedMicros;
  let released = 0n;
  for (const slice of slices) {
    if (remaining <= 0n) break;
    const model = populationModelState(world, slice.populationModelId);
    if (!model) continue;
    const sliceMicros = internalMoneyToMicros(nonNegativeMoney(slice.reservedAmount)) || 0n;
    const frozenMicros = internalMoneyToMicros(nonNegativeMoney(model.frozenCredits)) || 0n;
    const available = sliceMicros < frozenMicros ? sliceMicros : frozenMicros;
    const take = available < remaining ? available : remaining;
    if (take <= 0n) continue;
    model.frozenCredits = microsToInternalMoney(frozenMicros - take) || 0;
    model.credits = nonNegativeMoney(model.credits + (microsToInternalMoney(take) || 0));
    if (Array.isArray(order.fundingSlices)) {
      slice.reservedAmount = microsToInternalMoney(sliceMicros - take) || 0;
    }
    remaining -= take;
    released += take;
  }
  return microsToInternalMoney(released) || 0;
}

export function settlePopulationPurchase(world, order, quantity, tradePrice) {
  const state = ensurePopulationEconomy(world);
  const reserved = multiplyMoneyByInteger(order?.price, nonNegativeInteger(quantity));
  const actual = multiplyMoneyByInteger(tradePrice, nonNegativeInteger(quantity));
  if (reserved === null || actual === null) throw new Error('Population purchase amount is outside the supported range');
  const spent = consumePopulationFunding(world, order, reserved, actual);
  state.stats.totalConsumption = nonNegativeMoney(state.stats.totalConsumption + spent);
}

export function recordPopulationSellerIncome(player, amount) {
  player.stats ||= {};
  player.stats.populationIncome = roundInternalMoney(nonNegativeMoney(player.stats.populationIncome) + nonNegativeMoney(amount)) || 0;
}

export function createPopulationEconomySummary(world, now = Date.now(), { totalBaseBudget = 5_700 } = {}) {
  const state = ensurePopulationEconomy(world, now);
  const policy = populationPolicySnapshot(state, now);
  const policyBudget = calculatePopulationStabilizationBudgets(totalBaseBudget, policy);
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
      stateReason: model.stateReason,
      stateCycles: model.stateCycles,
      incomeHealthBps: model.incomeHealthBps,
      walletCoverageBps: model.walletCoverageBps,
      incomeCoverageBps: model.incomeCoverageBps,
      lastBudget: model.lastBudget,
      foodBudget: model.foodBudget,
      householdBudget: model.householdBudget,
      stabilizationBudget: model.stabilizationBudget,
      lastStabilizationIssued: model.lastStabilizationIssued,
      lastAdminPopulationIssued: model.lastAdminPopulationIssued,
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
      banking: nonNegativeInteger(state.stats.bankingIncome),
    },
    productionByComplexity: { ...state.stats.productionByComplexity },
    totalEmploymentIncome: nonNegativeInteger(state.stats.totalEmploymentIncome),
    totalConsumption: nonNegativeInteger(state.stats.totalConsumption),
    productionWageAdjustment: {
      subsidyIssued: nonNegativeInteger(state.stats.productionWageSubsidyIssued),
      withheld: nonNegativeInteger(state.stats.productionWageWithheld),
    },
    issuance: {
      ...issuance,
      migration: nonNegativeInteger(state.stats.migrationIssued),
      stabilization: nonNegativeInteger(state.stats.stabilizationIssued),
      adminPopulation: nonNegativeInteger(state.stats.adminPopulationIssued),
      productionWageSubsidy: nonNegativeInteger(state.stats.productionWageSubsidyIssued),
      total: issuance.work + issuance.exchange + issuance.gift + issuance.legacyPopulation
        + nonNegativeInteger(state.stats.migrationIssued)
        + nonNegativeInteger(state.stats.stabilizationIssued)
        + nonNegativeInteger(state.stats.adminPopulationIssued)
        + nonNegativeInteger(state.stats.productionWageSubsidyIssued),
    },
    policy,
    policyLimits: POPULATION_POLICY_LIMITS,
    policyBaseBudget: nonNegativeInteger(totalBaseBudget),
    policyProjectedStabilizationTotal: policyBudget.total,
  };
}
