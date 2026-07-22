const MODEL_IDS = Object.freeze(['basic', 'skilled', 'professional']);
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

export const POPULATION_POLICY_CYCLE_MS = 5 * 60 * 1000;
export const POPULATION_POLICY_DEFAULTS = Object.freeze({
  stabilizationShareBps: 1_200,
  targetWalletCycles: 3,
  refillCapBps: 10_000,
  productionWageMultiplierBps: 10_000,
  modelMultipliersBps: DEFAULT_MODEL_MULTIPLIERS_BPS,
});
export const POPULATION_POLICY_LIMITS = Object.freeze({
  stabilizationShareBps: Object.freeze({ min: 0, max: 2_000 }),
  targetWalletCycles: Object.freeze({ min: 1, max: 5 }),
  refillCapBps: Object.freeze({ min: 0, max: 15_000 }),
  productionWageMultiplierBps: Object.freeze({ min: 5_000, max: 15_000 }),
  modelMultiplierBps: Object.freeze({ min: 5_000, max: 15_000 }),
  durationCycles: Object.freeze({ min: 1, max: 288 }),
  noteLength: Object.freeze({ min: 8, max: 200 }),
});

function integer(value, fallback = 0) {
  const normalized = Math.floor(Number(value));
  return Number.isSafeInteger(normalized) ? normalized : fallback;
}

function bounded(value, min, max, fallback) {
  const normalized = integer(value, fallback);
  return Math.min(max, Math.max(min, normalized));
}

function invalid(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

export function populationPolicyCycleId(now = Date.now()) {
  return Math.floor(Number(now) / POPULATION_POLICY_CYCLE_MS);
}

export function defaultPopulationPolicy({
  updatedAt = null,
  updatedBy = null,
  note = '',
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
    note: String(note || ''),
  };
}

function normalizeMultipliers(value = {}) {
  return Object.fromEntries(MODEL_IDS.map((modelId) => [
    modelId,
    bounded(
      value?.[modelId],
      POPULATION_POLICY_LIMITS.modelMultiplierBps.min,
      POPULATION_POLICY_LIMITS.modelMultiplierBps.max,
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
    stabilizationShareBps: bounded(
      policy.stabilizationShareBps,
      POPULATION_POLICY_LIMITS.stabilizationShareBps.min,
      POPULATION_POLICY_LIMITS.stabilizationShareBps.max,
      fallback.stabilizationShareBps,
    ),
    targetWalletCycles: bounded(
      policy.targetWalletCycles,
      POPULATION_POLICY_LIMITS.targetWalletCycles.min,
      POPULATION_POLICY_LIMITS.targetWalletCycles.max,
      fallback.targetWalletCycles,
    ),
    refillCapBps: bounded(
      policy.refillCapBps,
      POPULATION_POLICY_LIMITS.refillCapBps.min,
      POPULATION_POLICY_LIMITS.refillCapBps.max,
      fallback.refillCapBps,
    ),
    productionWageMultiplierBps: bounded(
      policy.productionWageMultiplierBps,
      POPULATION_POLICY_LIMITS.productionWageMultiplierBps.min,
      POPULATION_POLICY_LIMITS.productionWageMultiplierBps.max,
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
    note: String(policy.note || '').slice(0, POPULATION_POLICY_LIMITS.noteLength.max),
  };
  if (normalized.expiresAfterCycleId !== null && populationPolicyCycleId(now) >= normalized.expiresAfterCycleId) {
    return defaultPopulationPolicy({
      updatedAt: Number(now),
      updatedBy: null,
      note: '临时人口政策已到期，自动恢复默认',
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
  return Object.fromEntries(MODEL_IDS.map((id) => [id, Math.max(0, integer(value?.[id], 0))]));
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
  return {
    ...policy,
    modelMultipliersBps: { ...policy.modelMultipliersBps },
    isDefault: isDefaultPopulationPolicy(policy),
    currentCycleId,
    remainingCycles: policy.expiresAfterCycleId === null
      ? null
      : Math.max(0, policy.expiresAfterCycleId - currentCycleId),
    nextCycleAt: (currentCycleId + 1) * POPULATION_POLICY_CYCLE_MS,
    currentCycleIssued: {
      issuedByModel: { ...policyCycle.issuedByModel },
      automaticByModel: { ...policyCycle.automaticByModel },
      adminByModel: { ...policyCycle.adminByModel },
    },
  };
}

function requireInteger(value, name, min, max) {
  const normalized = Number(value);
  if (!Number.isSafeInteger(normalized) || normalized < min || normalized > max) {
    throw invalid(`${name}必须为 ${min}～${max} 的整数`);
  }
  return normalized;
}

export function normalizePopulationAdminNote(value) {
  const note = String(value || '').trim();
  if (note.length < POPULATION_POLICY_LIMITS.noteLength.min || note.length > POPULATION_POLICY_LIMITS.noteLength.max) {
    throw invalid(`管理备注必须为 ${POPULATION_POLICY_LIMITS.noteLength.min}～${POPULATION_POLICY_LIMITS.noteLength.max} 个字符`);
  }
  return note;
}

export function createPopulationPolicyFromPayload(payload, { adminUserId, now = Date.now() } = {}) {
  const currentCycleId = populationPolicyCycleId(now);
  const durationCycles = requireInteger(
    payload?.durationCycles,
    '政策有效周期',
    POPULATION_POLICY_LIMITS.durationCycles.min,
    POPULATION_POLICY_LIMITS.durationCycles.max,
  );
  const modelMultipliers = payload?.modelMultipliersBps || {};
  return {
    stabilizationShareBps: requireInteger(
      payload?.stabilizationShareBps,
      '稳定需求比例',
      POPULATION_POLICY_LIMITS.stabilizationShareBps.min,
      POPULATION_POLICY_LIMITS.stabilizationShareBps.max,
    ),
    targetWalletCycles: requireInteger(
      payload?.targetWalletCycles,
      '目标钱包周期',
      POPULATION_POLICY_LIMITS.targetWalletCycles.min,
      POPULATION_POLICY_LIMITS.targetWalletCycles.max,
    ),
    refillCapBps: requireInteger(
      payload?.refillCapBps,
      '单周期补充上限',
      POPULATION_POLICY_LIMITS.refillCapBps.min,
      POPULATION_POLICY_LIMITS.refillCapBps.max,
    ),
    productionWageMultiplierBps: requireInteger(
      payload?.productionWageMultiplierBps,
      '生产工资系数',
      POPULATION_POLICY_LIMITS.productionWageMultiplierBps.min,
      POPULATION_POLICY_LIMITS.productionWageMultiplierBps.max,
    ),
    modelMultipliersBps: Object.fromEntries(MODEL_IDS.map((modelId) => [
      modelId,
      requireInteger(
        modelMultipliers[modelId],
        `${modelId} 人口倍率`,
        POPULATION_POLICY_LIMITS.modelMultiplierBps.min,
        POPULATION_POLICY_LIMITS.modelMultiplierBps.max,
      ),
    ])),
    effectiveCycleId: currentCycleId,
    expiresAfterCycleId: currentCycleId + durationCycles,
    updatedAt: Number(now),
    updatedBy: Math.max(0, integer(adminUserId, 0)),
    note: normalizePopulationAdminNote(payload?.note),
  };
}

export function createResetPopulationPolicy({ adminUserId, note, now = Date.now() } = {}) {
  return defaultPopulationPolicy({
    updatedAt: Number(now),
    updatedBy: Math.max(0, integer(adminUserId, 0)),
    note: normalizePopulationAdminNote(note),
  });
}

function allocateByWeights(total, weights) {
  const safeTotal = Math.max(0, integer(total, 0));
  const entries = MODEL_IDS.map((id, index) => {
    const weight = Math.max(0, Number(weights[id] || 0));
    return { id, index, weight, exact: 0, value: 0, remainder: 0 };
  });
  const weightTotal = entries.reduce((sum, entry) => sum + entry.weight, 0);
  if (safeTotal <= 0 || weightTotal <= 0) return Object.fromEntries(entries.map((entry) => [entry.id, 0]));
  let assigned = 0;
  for (const entry of entries) {
    entry.exact = safeTotal * entry.weight / weightTotal;
    entry.value = Math.floor(entry.exact);
    entry.remainder = entry.exact - entry.value;
    assigned += entry.value;
  }
  entries.sort((left, right) => right.remainder - left.remainder || left.index - right.index);
  for (let cursor = 0; assigned < safeTotal; cursor = (cursor + 1) % entries.length) {
    entries[cursor].value += 1;
    assigned += 1;
  }
  return Object.fromEntries(entries.map((entry) => [entry.id, entry.value]));
}

export function calculatePopulationStabilizationBudgets(totalBaseBudget, policyValue) {
  const policy = normalizePopulationPolicy(policyValue, 0);
  const baseTotal = Math.max(0, Math.floor(Number(totalBaseBudget || 0) * policy.stabilizationShareBps / 10_000));
  const baseByModel = allocateByWeights(baseTotal, DEFAULT_MODEL_SHARES_BPS);
  const adjustedByModel = Object.fromEntries(MODEL_IDS.map((id) => [
    id,
    Math.max(0, Math.floor(baseByModel[id] * policy.modelMultipliersBps[id] / 10_000)),
  ]));
  const adjustedTotal = Object.values(adjustedByModel).reduce((sum, value) => sum + value, 0);
  const byModel = adjustedTotal > baseTotal
    ? allocateByWeights(baseTotal, adjustedByModel)
    : adjustedByModel;
  return {
    total: Object.values(byModel).reduce((sum, value) => sum + value, 0),
    maximumTotal: baseTotal,
    byModel,
  };
}

export function populationPolicyRefillCap(stabilizationBudget, policy) {
  return Math.max(0, Math.floor(Number(stabilizationBudget || 0) * Number(policy?.refillCapBps || 0) / 10_000));
}
