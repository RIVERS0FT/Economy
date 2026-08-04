import { calculateRateMoney, internalMoneyToMicros, microsToInternalMoney, multiplyMoneyByInteger, roundInternalMoney } from './money.js';

const MODEL_IDS = Object.freeze(['basic', 'skilled', 'professional']);
const MODEL_NAMES = Object.freeze({
  basic: '基础人口',
  skilled: '技术人口',
  professional: '专业人口',
});
const DEFAULT_MODEL_MULTIPLIERS_BPS = Object.freeze({
  basic: 10_000,
  skilled: 10_000,
  professional: 10_000,
});
const DEFAULT_MODEL_SHARES_BPS = Object.freeze({
  basic: 6_000,
  skilled: 3_000,
  professional: 1_000,
});
const MAX_SAFE_BIGINT = BigInt(Number.MAX_SAFE_INTEGER);

export const POPULATION_POLICY_CYCLE_MS = 5 * 60 * 1000;
export const POPULATION_POLICY_DEFAULTS = Object.freeze({
  stabilizationShareBps: 1_200,
  targetWalletCycles: 3,
  refillCapBps: 10_000,
  productionWageMultiplierBps: 10_000,
  modelMultipliersBps: DEFAULT_MODEL_MULTIPLIERS_BPS,
});
export const POPULATION_POLICY_LIMITS = Object.freeze({
  stabilizationShareBps: Object.freeze({ min: 0 }),
  targetWalletCycles: Object.freeze({ min: 1 }),
  refillCapBps: Object.freeze({ min: 0 }),
  productionWageMultiplierBps: Object.freeze({ min: 5_000 }),
  modelMultiplierBps: Object.freeze({ min: 5_000 }),
  durationCycles: Object.freeze({ min: 1 }),
});

function integer(value, fallback = 0) {
  const normalized = Math.floor(Number(value));
  return Number.isSafeInteger(normalized) ? normalized : fallback;
}

function atLeast(value, min, fallback) {
  const normalized = integer(value, fallback);
  return Math.max(min, normalized);
}

function invalid(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function requireIntegerAtLeast(value, name, min) {
  const normalized = Number(value);
  if (!Number.isSafeInteger(normalized) || normalized < min) {
    throw invalid(`${name}必须为不小于 ${min} 的安全整数`);
  }
  return normalized;
}

function safeBigIntToNumber(value, name) {
  if (value < 0n || value > MAX_SAFE_BIGINT) {
    throw invalid(`${name}计算结果超出系统可表示范围`);
  }
  return Number(value);
}

function safeMultiplyDivideFloor(value, multiplier, divisor, name) {
  const safeValue = requireIntegerAtLeast(value, name, 0);
  const safeMultiplier = requireIntegerAtLeast(multiplier, name, 0);
  const safeDivisor = requireIntegerAtLeast(divisor, name, 1);
  const result = BigInt(safeValue) * BigInt(safeMultiplier) / BigInt(safeDivisor);
  return safeBigIntToNumber(result, name);
}

function safeMultiply(value, multiplier, name) {
  const safeValue = requireIntegerAtLeast(value, name, 0);
  const safeMultiplier = requireIntegerAtLeast(multiplier, name, 0);
  return safeBigIntToNumber(BigInt(safeValue) * BigInt(safeMultiplier), name);
}

function safeSum(values, name) {
  return safeBigIntToNumber(
    values.reduce((sum, value) => sum + BigInt(requireIntegerAtLeast(value, name, 0)), 0n),
    name,
  );
}

export function populationPolicyCycleId(now = Date.now()) {
  return Math.floor(Number(now) / POPULATION_POLICY_CYCLE_MS);
}

export function defaultPopulationPolicy({
  updatedAt = null,
  updatedBy = null,
} = {}) {
  return {
    stabilizationShareBps: POPULATION_POLICY_DEFAULTS.stabilizationShareBps,
    targetWalletCycles: POPULATION_POLICY_DEFAULTS.targetWalletCycles,
    refillCapBps: POPULATION_POLICY_DEFAULTS.refillCapBps,
    productionWageMultiplierBps: POPULATION_POLICY_DEFAULTS.productionWageMultiplierBps,
    modelMultipliersBps: { ...DEFAULT_MODEL_MULTIPLIERS_BPS },
    effectiveCycleId: 0,
    expiresAfterCycleId: null,
    updatedAt,
    updatedBy,
    note: '',
  };
}

function normalizeMultipliers(value = {}) {
  return Object.fromEntries(MODEL_IDS.map((modelId) => [
    modelId,
    atLeast(
      value?.[modelId],
      POPULATION_POLICY_LIMITS.modelMultiplierBps.min,
      DEFAULT_MODEL_MULTIPLIERS_BPS[modelId],
    ),
  ]));
}

export function normalizePopulationPolicy(value, now = Date.now()) {
  const fallback = defaultPopulationPolicy();
  const policy = value && typeof value === 'object' ? value : {};
  const effectiveCycleId = Math.max(0, integer(policy.effectiveCycleId, 0));
  const rawExpiry = policy.expiresAfterCycleId;
  const expiresAfterCycleId = rawExpiry === null || rawExpiry === undefined
    ? null
    : Math.max(effectiveCycleId + 1, integer(rawExpiry, effectiveCycleId + 1));
  const normalized = {
    stabilizationShareBps: atLeast(
      policy.stabilizationShareBps,
      POPULATION_POLICY_LIMITS.stabilizationShareBps.min,
      fallback.stabilizationShareBps,
    ),
    targetWalletCycles: atLeast(
      policy.targetWalletCycles,
      POPULATION_POLICY_LIMITS.targetWalletCycles.min,
      fallback.targetWalletCycles,
    ),
    refillCapBps: atLeast(
      policy.refillCapBps,
      POPULATION_POLICY_LIMITS.refillCapBps.min,
      fallback.refillCapBps,
    ),
    productionWageMultiplierBps: atLeast(
      policy.productionWageMultiplierBps,
      POPULATION_POLICY_LIMITS.productionWageMultiplierBps.min,
      fallback.productionWageMultiplierBps,
    ),
    modelMultipliersBps: normalizeMultipliers(policy.modelMultipliersBps),
    effectiveCycleId,
    expiresAfterCycleId,
    updatedAt: policy.updatedAt === null || policy.updatedAt === undefined
      ? null
      : Math.max(0, integer(policy.updatedAt, 0)),
    updatedBy: policy.updatedBy === null || policy.updatedBy === undefined
      ? null
      : Math.max(0, integer(policy.updatedBy, 0)),
    note: '',
  };
  if (normalized.expiresAfterCycleId !== null && populationPolicyCycleId(now) >= normalized.expiresAfterCycleId) {
    return defaultPopulationPolicy({
      updatedAt: Number(now),
      updatedBy: null,
    });
  }
  return normalized;
}

export function defaultPopulationPolicyCycle(cycleId = -1) {
  return {
    cycleId: integer(cycleId, -1),
    issuedByModel: Object.fromEntries(MODEL_IDS.map((id) => [id, 0])),
    automaticByModel: Object.fromEntries(MODEL_IDS.map((id) => [id, 0])),
    adminByModel: Object.fromEntries(MODEL_IDS.map((id) => [id, 0])),
  };
}

function normalizeIssueMap(value = {}) {
  return Object.fromEntries(MODEL_IDS.map((id) => {
    const amount = roundInternalMoney(value?.[id] || 0);
    return [id, amount === null ? 0 : Math.max(0, amount)];
  }));
}

export function ensurePopulationPolicyState(state, now = Date.now()) {
  state.policy = normalizePopulationPolicy(state.policy, now);
  const currentCycleId = populationPolicyCycleId(now);
  const previousCycle = state.policyCycle && typeof state.policyCycle === 'object'
    ? state.policyCycle
    : defaultPopulationPolicyCycle();
  state.policyCycle = Number(previousCycle.cycleId) === currentCycleId
    ? {
      cycleId: currentCycleId,
      issuedByModel: normalizeIssueMap(previousCycle.issuedByModel),
      automaticByModel: normalizeIssueMap(previousCycle.automaticByModel),
      adminByModel: normalizeIssueMap(previousCycle.adminByModel),
    }
    : defaultPopulationPolicyCycle(currentCycleId);
  return { policy: state.policy, policyCycle: state.policyCycle, currentCycleId };
}

export function isDefaultPopulationPolicy(policy) {
  return Number(policy?.stabilizationShareBps) === POPULATION_POLICY_DEFAULTS.stabilizationShareBps
    && Number(policy?.targetWalletCycles) === POPULATION_POLICY_DEFAULTS.targetWalletCycles
    && Number(policy?.refillCapBps) === POPULATION_POLICY_DEFAULTS.refillCapBps
    && Number(policy?.productionWageMultiplierBps) === POPULATION_POLICY_DEFAULTS.productionWageMultiplierBps
    && MODEL_IDS.every((id) => Number(policy?.modelMultipliersBps?.[id]) === DEFAULT_MODEL_MULTIPLIERS_BPS[id])
    && policy?.expiresAfterCycleId === null;
}

export function populationPolicySnapshot(state, now = Date.now()) {
  const { policy, policyCycle, currentCycleId } = ensurePopulationPolicyState(state, now);
  const isDefault = isDefaultPopulationPolicy(policy);
  const durationCycles = policy.expiresAfterCycleId === null
    ? null
    : Math.max(1, policy.expiresAfterCycleId - policy.effectiveCycleId);
  const remainingCycles = policy.expiresAfterCycleId === null
    ? null
    : Math.max(0, policy.expiresAfterCycleId - currentCycleId);
  return {
    ...policy,
    modelMultipliersBps: { ...policy.modelMultipliersBps },
    isDefault,
    currentCycleId,
    durationCycles,
    elapsedCycles: durationCycles === null
      ? null
      : Math.min(durationCycles, Math.max(0, currentCycleId - policy.effectiveCycleId)),
    remainingCycles,
    effectiveAt: isDefault ? null : policy.effectiveCycleId * POPULATION_POLICY_CYCLE_MS,
    expiresAt: policy.expiresAfterCycleId === null
      ? null
      : policy.expiresAfterCycleId * POPULATION_POLICY_CYCLE_MS,
    nextCycleAt: (currentCycleId + 1) * POPULATION_POLICY_CYCLE_MS,
    currentCycleIssued: {
      issuedByModel: { ...policyCycle.issuedByModel },
      automaticByModel: { ...policyCycle.automaticByModel },
      adminByModel: { ...policyCycle.adminByModel },
    },
  };
}

export function createPopulationPolicyFromPayload(payload, { adminUserId, now = Date.now() } = {}) {
  const currentCycleId = populationPolicyCycleId(now);
  const durationCycles = requireIntegerAtLeast(
    payload?.durationCycles,
    '政策有效周期',
    POPULATION_POLICY_LIMITS.durationCycles.min,
  );
  const expiresAfterCycleId = currentCycleId + durationCycles;
  if (!Number.isSafeInteger(expiresAfterCycleId)) {
    throw invalid('政策到期周期超出系统可表示范围');
  }
  safeMultiply(expiresAfterCycleId, POPULATION_POLICY_CYCLE_MS, '政策到期时间');
  const modelMultipliers = payload?.modelMultipliersBps || {};
  return {
    stabilizationShareBps: requireIntegerAtLeast(
      payload?.stabilizationShareBps,
      '稳定需求比例',
      POPULATION_POLICY_LIMITS.stabilizationShareBps.min,
    ),
    targetWalletCycles: requireIntegerAtLeast(
      payload?.targetWalletCycles,
      '目标钱包周期',
      POPULATION_POLICY_LIMITS.targetWalletCycles.min,
    ),
    refillCapBps: requireIntegerAtLeast(
      payload?.refillCapBps,
      '单周期补充比例',
      POPULATION_POLICY_LIMITS.refillCapBps.min,
    ),
    productionWageMultiplierBps: requireIntegerAtLeast(
      payload?.productionWageMultiplierBps,
      '生产工资系数',
      POPULATION_POLICY_LIMITS.productionWageMultiplierBps.min,
    ),
    modelMultipliersBps: Object.fromEntries(MODEL_IDS.map((modelId) => [
      modelId,
      requireIntegerAtLeast(
        modelMultipliers[modelId],
        `${MODEL_NAMES[modelId]}倍率`,
        POPULATION_POLICY_LIMITS.modelMultiplierBps.min,
      ),
    ])),
    effectiveCycleId: currentCycleId,
    expiresAfterCycleId,
    updatedAt: Number(now),
    updatedBy: Math.max(0, integer(adminUserId, 0)),
    note: '',
  };
}

export function createResetPopulationPolicy({ adminUserId, now = Date.now() } = {}) {
  return defaultPopulationPolicy({
    updatedAt: Number(now),
    updatedBy: Math.max(0, integer(adminUserId, 0)),
  });
}

function moneyOrInvalid(value, name) {
  const normalized = roundInternalMoney(value);
  if (normalized === null || normalized < 0) throw invalid(`${name}计算结果超出系统可表示范围`);
  return normalized;
}

function normalizedWeight(value, name) {
  if (typeof value === 'bigint') {
    if (value < 0n) throw invalid(`${name}必须为非负整数`);
    return value;
  }
  return BigInt(requireIntegerAtLeast(value || 0, name, 0));
}

function allocateMoneyByWeights(total, weights) {
  const totalMicros = internalMoneyToMicros(moneyOrInvalid(total, '人口政策预算'));
  if (totalMicros === null || totalMicros < 0n) throw invalid('人口政策预算计算结果超出系统可表示范围');
  const rows = MODEL_IDS.map((id, index) => ({
    id,
    index,
    weight: normalizedWeight(weights?.[id] || 0, `${MODEL_NAMES[id]}权重`),
    value: 0n,
    remainder: 0n,
  }));
  const weightTotal = rows.reduce((sum, row) => sum + row.weight, 0n);
  if (totalMicros <= 0n || weightTotal <= 0n) return Object.fromEntries(rows.map((row) => [row.id, 0]));
  let assigned = 0n;
  for (const row of rows) {
    const numerator = totalMicros * row.weight;
    row.value = numerator / weightTotal;
    row.remainder = numerator % weightTotal;
    assigned += row.value;
  }
  rows.sort((left, right) => left.remainder === right.remainder
    ? left.index - right.index
    : left.remainder > right.remainder ? -1 : 1);
  for (let cursor = 0; assigned < totalMicros; cursor = (cursor + 1) % rows.length) {
    rows[cursor].value += 1n;
    assigned += 1n;
  }
  return Object.fromEntries(rows.map((row) => {
    const value = microsToInternalMoney(row.value);
    if (value === null) throw invalid(`${MODEL_NAMES[row.id]}稳定需求预算计算结果超出系统可表示范围`);
    return [row.id, value];
  }));
}

function sumMoney(values, name) {
  const micros = values.reduce((sum, value) => {
    const amount = internalMoneyToMicros(moneyOrInvalid(value, name));
    if (amount === null) throw invalid(`${name}计算结果超出系统可表示范围`);
    return sum + amount;
  }, 0n);
  const result = microsToInternalMoney(micros);
  if (result === null) throw invalid(`${name}计算结果超出系统可表示范围`);
  return result;
}

export function calculatePopulationStabilizationBudgets(
  totalBaseBudget,
  policyValue,
  modelWeights = DEFAULT_MODEL_SHARES_BPS,
) {
  const policy = normalizePopulationPolicy(policyValue, 0);
  const baseTotal = calculateRateMoney(
    moneyOrInvalid(totalBaseBudget, '人口参考需求预算'),
    policy.stabilizationShareBps,
    10_000,
    'half-up',
  );
  if (baseTotal === null) throw invalid('稳定需求预算计算结果超出系统可表示范围');
  const normalizedWeights = Object.fromEntries(MODEL_IDS.map((id) => [
    id,
    requireIntegerAtLeast(modelWeights?.[id] || 0, `${MODEL_NAMES[id]}人口数量`, 0),
  ]));
  const baseByModel = allocateMoneyByWeights(baseTotal, normalizedWeights);
  const adjustedByModel = Object.fromEntries(MODEL_IDS.map((id) => {
    const adjusted = calculateRateMoney(
      baseByModel[id],
      policy.modelMultipliersBps[id],
      10_000,
      'half-up',
    );
    if (adjusted === null) throw invalid(`${MODEL_NAMES[id]}稳定需求预算计算结果超出系统可表示范围`);
    return [id, adjusted];
  }));
  const adjustedTotal = sumMoney(Object.values(adjustedByModel), '稳定需求预算');
  const byModel = adjustedTotal > baseTotal
    ? allocateMoneyByWeights(baseTotal, Object.fromEntries(MODEL_IDS.map((id) => [
      id,
      internalMoneyToMicros(adjustedByModel[id]) || 0n,
    ])))
    : adjustedByModel;
  return {
    total: sumMoney(Object.values(byModel), '稳定需求预算'),
    maximumTotal: baseTotal,
    byModel,
  };
}

export function populationPolicyRefillCap(stabilizationBudget, policy) {
  const result = calculateRateMoney(
    moneyOrInvalid(stabilizationBudget, '人口稳定预算'),
    requireIntegerAtLeast(policy?.refillCapBps || 0, '单周期补充比例', 0),
    10_000,
    'half-up',
  );
  if (result === null) throw invalid('人口补充额度计算结果超出系统可表示范围');
  return result;
}

export function populationPolicyWalletTarget(stabilizationBudget, policy) {
  const result = multiplyMoneyByInteger(
    moneyOrInvalid(stabilizationBudget, '人口稳定预算'),
    requireIntegerAtLeast(policy?.targetWalletCycles || 1, '目标钱包周期', 1),
  );
  if (result === null) throw invalid('目标钱包计算结果超出系统可表示范围');
  return result;
}

export function validatePopulationPolicyCapacity(totalBaseBudget, policy, modelWeights = DEFAULT_MODEL_SHARES_BPS) {
  const budgets = calculatePopulationStabilizationBudgets(totalBaseBudget, policy, modelWeights);
  for (const modelId of MODEL_IDS) {
    populationPolicyWalletTarget(budgets.byModel[modelId], policy);
    populationPolicyRefillCap(budgets.byModel[modelId], policy);
  }
  return budgets;
}
