import { FACILITY_TYPE_CATALOG } from './industry-catalog.js';
import { internalMoneyToMicros, microsToInternalMoney } from './money.js';

export const POPULATION_BASE_WORLD = 1_000;
export const POPULATION_STANDARD_POPULATION = 10_000;
export const POPULATION_STANDARD_BUDGET = 5_700;
export const POPULATION_C1_CAPACITY = 11;
export const POPULATION_MIGRATION_IN_BPS = 200;
export const POPULATION_MIGRATION_OUT_BPS = 50;
export const POPULATION_CLASS_CONVERSION_BPS = 100;
export const POPULATION_LABOR_PARTICIPATION_BPS = 5_500;
export const POPULATION_ACTIVE_CAPACITY_EMA_CURRENT_BPS = 2_000;
export const POPULATION_OCCUPANCY_MIN_BPS = 3_500;

export const POPULATION_COMPLEXITY_WEIGHTS_BPS = Object.freeze({
  C1: 10_000,
  C2: 15_000,
  C3: 22_000,
  C4: 32_000,
  C5: 45_000,
  C6: 62_000,
  C7: 85_000,
});

export const POPULATION_PRODUCTION_PROFILE_BPS = Object.freeze({
  C1: Object.freeze({ basic: 9_000, skilled: 900, professional: 100 }),
  C2: Object.freeze({ basic: 7_800, skilled: 2_000, professional: 200 }),
  C3: Object.freeze({ basic: 5_500, skilled: 4_000, professional: 500 }),
  C4: Object.freeze({ basic: 3_000, skilled: 6_000, professional: 1_000 }),
  C5: Object.freeze({ basic: 1_800, skilled: 5_500, professional: 2_700 }),
  C6: Object.freeze({ basic: 1_000, skilled: 4_000, professional: 5_000 }),
  C7: Object.freeze({ basic: 500, skilled: 2_500, professional: 7_000 }),
});

const MODEL_IDS = Object.freeze(['basic', 'skilled', 'professional']);
const BASE_MODEL_SHARES_BPS = Object.freeze({ basic: 6_000, skilled: 3_000, professional: 1_000 });
const CAPACITY_SCALE = 1_000_000n;
const MAX_SAFE_BIGINT = BigInt(Number.MAX_SAFE_INTEGER);
const FACILITY_BY_ID = new Map(FACILITY_TYPE_CATALOG.map((facility) => [facility.id, facility]));

function safeInteger(value, fallback = 0) {
  const normalized = Math.floor(Number(value));
  return Number.isSafeInteger(normalized) && normalized >= 0 ? normalized : fallback;
}

function safeBigIntToNumber(value, name) {
  if (value < 0n || value > MAX_SAFE_BIGINT) throw new Error(`${name}超出系统可表示范围`);
  return Number(value);
}

function clampBps(value, minimum = 0, maximum = 10_000) {
  return Math.max(minimum, Math.min(maximum, safeInteger(value)));
}

function ceilRate(value, bps) {
  const count = BigInt(safeInteger(value));
  const rate = BigInt(safeInteger(bps));
  if (count <= 0n || rate <= 0n) return 0;
  return safeBigIntToNumber((count * rate + 9_999n) / 10_000n, '人口迁移数量');
}

function ratioBps(numerator, denominator, fallback = 0) {
  const top = BigInt(safeInteger(numerator));
  const bottom = BigInt(safeInteger(denominator));
  if (bottom <= 0n) return fallback;
  return clampBps(safeBigIntToNumber((top * 10_000n + bottom / 2n) / bottom, '人口比例'));
}

function allocateIntegers(total, weights) {
  const safeTotal = safeInteger(total);
  const rows = MODEL_IDS.map((id, index) => ({
    id,
    index,
    weight: BigInt(safeInteger(weights?.[id])),
    value: 0n,
    remainder: 0n,
  }));
  const weightTotal = rows.reduce((sum, row) => sum + row.weight, 0n);
  if (safeTotal <= 0 || weightTotal <= 0n) return Object.fromEntries(rows.map((row) => [row.id, 0]));
  let assigned = 0n;
  for (const row of rows) {
    const numerator = BigInt(safeTotal) * row.weight;
    row.value = numerator / weightTotal;
    row.remainder = numerator % weightTotal;
    assigned += row.value;
  }
  rows.sort((left, right) => left.remainder === right.remainder
    ? left.index - right.index
    : left.remainder > right.remainder ? -1 : 1);
  for (let cursor = 0; assigned < BigInt(safeTotal); cursor = (cursor + 1) % rows.length) {
    rows[cursor].value += 1n;
    assigned += 1n;
  }
  return Object.fromEntries(rows.map((row) => [row.id, Number(row.value)]));
}

function capacityMicros(count, complexity, staffingRateBps = 10_000) {
  const safeCount = BigInt(safeInteger(count));
  const complexityWeight = BigInt(POPULATION_COMPLEXITY_WEIGHTS_BPS[complexity] || 10_000);
  const staffing = BigInt(clampBps(staffingRateBps));
  return safeCount * BigInt(POPULATION_C1_CAPACITY) * complexityWeight * staffing / 100n;
}

function capacityByModelMicros(capacity, complexity) {
  const profile = POPULATION_PRODUCTION_PROFILE_BPS[complexity] || POPULATION_PRODUCTION_PROFILE_BPS.C1;
  return Object.fromEntries(MODEL_IDS.map((id) => [id, capacity * BigInt(profile[id]) / 10_000n]));
}

function addBigIntMap(target, source) {
  for (const id of MODEL_IDS) target[id] += source[id];
}

function facilityCapacitySnapshot(world) {
  const structuralByModel = Object.fromEntries(MODEL_IDS.map((id) => [id, 0n]));
  const activeByModel = Object.fromEntries(MODEL_IDS.map((id) => [id, 0n]));
  const byComplexity = Object.fromEntries(Object.keys(POPULATION_COMPLEXITY_WEIGHTS_BPS).map((complexity) => [complexity, {
    count: 0,
    participatingCount: 0,
    structuralCapacityMicros: 0n,
    activeCapacityMicros: 0n,
  }]));
  let structuralCapacityMicros = 0n;
  let activeCapacityMicros = 0n;

  for (const player of Object.values(world.players || {})) {
    for (const group of player.facilityGroups || []) {
      const facility = FACILITY_BY_ID.get(String(group?.facilityTypeId || ''));
      if (!facility) continue;
      const complexity = POPULATION_COMPLEXITY_WEIGHTS_BPS[facility.complexity] ? facility.complexity : 'C1';
      const count = safeInteger(group?.count);
      const running = group?.enabled && group?.status === 'running';
      const participatingCount = running ? Math.min(count, safeInteger(group?.participatingCount)) : 0;
      const staffingRateBps = running ? clampBps(group?.staffingRateBps, 0, 10_000) : 0;
      const structural = capacityMicros(count, complexity);
      const active = capacityMicros(participatingCount, complexity, staffingRateBps);
      structuralCapacityMicros += structural;
      activeCapacityMicros += active;
      addBigIntMap(structuralByModel, capacityByModelMicros(structural, complexity));
      addBigIntMap(activeByModel, capacityByModelMicros(active, complexity));
      byComplexity[complexity].count += count;
      byComplexity[complexity].participatingCount += participatingCount;
      byComplexity[complexity].structuralCapacityMicros += structural;
      byComplexity[complexity].activeCapacityMicros += active;
    }
  }

  return { structuralCapacityMicros, activeCapacityMicros, structuralByModel, activeByModel, byComplexity };
}

function modelPopulationMap(state) {
  return Object.fromEntries(MODEL_IDS.map((id) => [id, safeInteger(state.models?.[id]?.population)]));
}

function weightedIncomeHealthBps(state, populations) {
  const total = Object.values(populations).reduce((sum, value) => sum + value, 0);
  if (total <= 0) return 10_000;
  const numerator = MODEL_IDS.reduce((sum, id) => (
    sum + BigInt(populations[id]) * BigInt(clampBps(state.models?.[id]?.incomeHealthBps, 0, 100_000))
  ), 0n);
  return Math.max(0, Math.min(100_000, safeBigIntToNumber(numerator / BigInt(total), '收入健康度')));
}

function demandSatisfactionBps(world) {
  const groups = Object.values(world.marketDemand?.groups || {});
  if (groups.length === 0) return 8_000;
  const values = groups.map((group) => {
    const satisfaction = Number(group?.satisfactionEma ?? group?.satisfaction ?? 0.8);
    return Math.max(0, Math.min(1, Number.isFinite(satisfaction) ? satisfaction : 0.8));
  });
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length * 10_000);
}

function normalizeActiveEma(previous, current) {
  const safePrevious = safeInteger(previous, -1);
  if (safePrevious < 0) return safeInteger(current);
  return safeBigIntToNumber(
    (BigInt(safePrevious) * BigInt(10_000 - POPULATION_ACTIVE_CAPACITY_EMA_CURRENT_BPS)
      + BigInt(safeInteger(current)) * BigInt(POPULATION_ACTIVE_CAPACITY_EMA_CURRENT_BPS)) / 10_000n,
    '活跃人口承载 EMA',
  );
}

function basePopulationByModel() {
  return allocateIntegers(POPULATION_BASE_WORLD, BASE_MODEL_SHARES_BPS);
}

function totalPopulation(populations) {
  return MODEL_IDS.reduce((sum, id) => sum + safeInteger(populations[id]), 0);
}

function applyMigration(populations, targetByModel, migration) {
  if (migration === 0) return populations;
  const next = { ...populations };
  if (migration > 0) {
    const deficits = Object.fromEntries(MODEL_IDS.map((id) => [id, Math.max(0, targetByModel[id] - next[id])]));
    const weights = totalPopulation(deficits) > 0 ? deficits : targetByModel;
    const allocation = allocateIntegers(migration, weights);
    for (const id of MODEL_IDS) next[id] += allocation[id];
    return next;
  }
  const removing = -migration;
  const excesses = Object.fromEntries(MODEL_IDS.map((id) => [id, Math.max(0, next[id] - targetByModel[id])]));
  const weights = totalPopulation(excesses) > 0 ? excesses : next;
  const allocation = allocateIntegers(removing, weights);
  let remainder = removing;
  for (const id of MODEL_IDS) {
    const take = Math.min(next[id], allocation[id]);
    next[id] -= take;
    remainder -= take;
  }
  for (const id of MODEL_IDS) {
    if (remainder <= 0) break;
    const take = Math.min(next[id], remainder);
    next[id] -= take;
    remainder -= take;
  }
  return next;
}

function movePopulation(populations, from, to, amount) {
  const moved = Math.max(0, Math.min(safeInteger(amount), populations[from]));
  populations[from] -= moved;
  populations[to] += moved;
  return moved;
}

function adjustStructure(populations, targetByModel, limit) {
  const total = totalPopulation(populations);
  if (total <= 0 || limit <= 0) return 0;
  const normalizedTargets = allocateIntegers(total, targetByModel);
  let remaining = limit;
  let moved = 0;
  for (let pass = 0; pass < 3 && remaining > 0; pass += 1) {
    const pairs = [
      ['basic', 'skilled'],
      ['skilled', 'basic'],
      ['skilled', 'professional'],
      ['professional', 'skilled'],
    ];
    let changed = false;
    for (const [from, to] of pairs) {
      if (remaining <= 0) break;
      const surplus = Math.max(0, populations[from] - normalizedTargets[from]);
      const deficit = Math.max(0, normalizedTargets[to] - populations[to]);
      const transfer = Math.min(remaining, surplus, deficit);
      if (transfer <= 0) continue;
      const actual = movePopulation(populations, from, to, transfer);
      remaining -= actual;
      moved += actual;
      changed = changed || actual > 0;
    }
    if (!changed) break;
  }
  return moved;
}

function initializeModelPopulation(state, total) {
  const allocation = allocateIntegers(total, BASE_MODEL_SHARES_BPS);
  for (const id of MODEL_IDS) {
    state.models[id].population = allocation[id];
    state.models[id].targetPopulation = allocation[id];
  }
  return allocation;
}

export function populationReferenceBudget(population) {
  const count = BigInt(safeInteger(population));
  const microsPerPerson = BigInt(Math.round(POPULATION_STANDARD_BUDGET * 1_000_000 / POPULATION_STANDARD_POPULATION));
  const micros = count * microsPerPerson;
  if (micros > MAX_SAFE_BIGINT) throw new Error('人口参考需求预算超出系统可表示范围');
  const result = microsToInternalMoney(micros);
  if (result === null) throw new Error('人口参考需求预算超出系统可表示范围');
  return result;
}

export function ensurePopulationDemographics(world, state, { migrateLegacy = false } = {}) {
  const fallbackTotal = migrateLegacy ? POPULATION_STANDARD_POPULATION : POPULATION_BASE_WORLD;
  const previous = state.demographics && typeof state.demographics === 'object' ? state.demographics : null;
  let populations = modelPopulationMap(state);
  if (totalPopulation(populations) <= 0) populations = initializeModelPopulation(state, fallbackTotal);
  const snapshot = facilityCapacitySnapshot(world);
  const activeByModelMicros = Object.fromEntries(MODEL_IDS.map((id) => [id, safeBigIntToNumber(snapshot.activeByModel[id], '活跃人口承载')]));
  const activeCapacityMicros = safeBigIntToNumber(snapshot.activeCapacityMicros, '活跃人口承载');
  const structuralCapacityMicros = safeBigIntToNumber(snapshot.structuralCapacityMicros, '结构人口承载');
  const baseByModel = basePopulationByModel();
  const currentPopulation = totalPopulation(populations);

  for (const id of MODEL_IDS) {
    const model = state.models[id];
    const population = Math.max(1, populations[id]);
    if (model.perCapitaIncomeEma <= 0 && model.incomeEma > 0) {
      const incomeMicros = internalMoneyToMicros(model.incomeEma);
      model.perCapitaIncomeEma = incomeMicros === null ? 0 : microsToInternalMoney(incomeMicros / BigInt(population)) || 0;
    }
    if (model.recentPeakPerCapitaIncome <= 0 && model.recentPeakIncome > 0) {
      const peakMicros = internalMoneyToMicros(model.recentPeakIncome);
      model.recentPeakPerCapitaIncome = peakMicros === null ? 0 : microsToInternalMoney(peakMicros / BigInt(population)) || 0;
    }
  }

  state.demographics = {
    currentPopulation,
    targetPopulation: safeInteger(previous?.targetPopulation, currentPopulation),
    structuralCapacity: safeInteger(previous?.structuralCapacity, POPULATION_BASE_WORLD + Math.floor(structuralCapacityMicros / 1_000_000)),
    activeCapacity: safeInteger(previous?.activeCapacity, Math.floor(activeCapacityMicros / 1_000_000)),
    activeCapacityEma: safeInteger(previous?.activeCapacityEma, Math.floor(activeCapacityMicros / 1_000_000)),
    activeCapacityEmaMicros: safeInteger(previous?.activeCapacityEmaMicros, activeCapacityMicros),
    activeCapacityEmaByModelMicros: Object.fromEntries(MODEL_IDS.map((id) => [id,
      safeInteger(previous?.activeCapacityEmaByModelMicros?.[id], activeByModelMicros[id]),
    ])),
    occupancyRateBps: clampBps(previous?.occupancyRateBps, POPULATION_OCCUPANCY_MIN_BPS),
    industryOperatingRateBps: clampBps(previous?.industryOperatingRateBps),
    incomeHealthBps: Math.max(0, safeInteger(previous?.incomeHealthBps, 10_000)),
    demandSatisfactionBps: clampBps(previous?.demandSatisfactionBps, 0, 10_000),
    lastMigration: safeInteger(previous?.lastMigration),
    lastMigrationDirection: ['in', 'out', 'none'].includes(previous?.lastMigrationDirection)
      ? previous.lastMigrationDirection
      : 'none',
    lastClassConversions: safeInteger(previous?.lastClassConversions),
    lastPopulationCycleId: Number.isSafeInteger(Number(previous?.lastPopulationCycleId))
      ? Number(previous.lastPopulationCycleId)
      : -1,
    referenceBudget: populationReferenceBudget(currentPopulation),
    basePopulationByModel: baseByModel,
    targetByModel: Object.fromEntries(MODEL_IDS.map((id) => [id, safeInteger(previous?.targetByModel?.[id], populations[id])])),
    structuralCapacityByComplexity: Object.fromEntries(Object.entries(snapshot.byComplexity).map(([id, row]) => [id, {
      count: row.count,
      participatingCount: row.participatingCount,
      structuralCapacity: Math.floor(safeBigIntToNumber(row.structuralCapacityMicros, '复杂度结构承载') / 1_000_000),
      activeCapacity: Math.floor(safeBigIntToNumber(row.activeCapacityMicros, '复杂度活跃承载') / 1_000_000),
    }])),
  };
  return state.demographics;
}

export function advancePopulationDemographics(world, state, cycleId, now = Date.now()) {
  const demographics = ensurePopulationDemographics(world, state);
  if (Number(demographics.lastPopulationCycleId) >= Number(cycleId)) return demographics;

  const snapshot = facilityCapacitySnapshot(world);
  const structuralCapacityMicros = safeBigIntToNumber(snapshot.structuralCapacityMicros, '结构人口承载');
  const activeCapacityMicros = safeBigIntToNumber(snapshot.activeCapacityMicros, '活跃人口承载');
  const activeEmaMicros = normalizeActiveEma(demographics.activeCapacityEmaMicros, activeCapacityMicros);
  const activeEmaByModelMicros = Object.fromEntries(MODEL_IDS.map((id) => [id, normalizeActiveEma(
    demographics.activeCapacityEmaByModelMicros?.[id],
    safeBigIntToNumber(snapshot.activeByModel[id], '人口类别活跃承载'),
  )]));
  const populationsBefore = modelPopulationMap(state);
  const incomeHealth = weightedIncomeHealthBps(state, populationsBefore);
  const satisfaction = demandSatisfactionBps(world);
  const operatingRate = structuralCapacityMicros <= 0
    ? 0
    : ratioBps(activeEmaMicros, structuralCapacityMicros);
  const occupancyRateBps = clampBps(
    POPULATION_OCCUPANCY_MIN_BPS
      + Math.round(operatingRate * 0.40)
      + Math.round(Math.min(10_000, incomeHealth) * 0.15)
      + Math.round(satisfaction * 0.10),
    POPULATION_OCCUPANCY_MIN_BPS,
    10_000,
  );

  const industrialTarget = safeBigIntToNumber(
    BigInt(structuralCapacityMicros) * BigInt(occupancyRateBps) / 10_000n / CAPACITY_SCALE,
    '目标产业人口',
  );
  const structuralByModelWeights = Object.fromEntries(MODEL_IDS.map((id) => [id,
    safeBigIntToNumber(snapshot.structuralByModel[id], '人口类别结构承载'),
  ]));
  const industrialByModel = allocateIntegers(industrialTarget, structuralByModelWeights);
  const baseByModel = basePopulationByModel();
  const targetByModel = Object.fromEntries(MODEL_IDS.map((id) => [id, baseByModel[id] + industrialByModel[id]]));
  const targetPopulation = totalPopulation(targetByModel);
  const currentBefore = totalPopulation(populationsBefore);
  const gap = targetPopulation - currentBefore;
  const migrationMagnitude = Math.min(
    Math.abs(gap),
    ceilRate(Math.abs(gap), gap >= 0 ? POPULATION_MIGRATION_IN_BPS : POPULATION_MIGRATION_OUT_BPS),
  );
  const migration = gap === 0 ? 0 : gap > 0 ? migrationMagnitude : -migrationMagnitude;
  const populations = applyMigration(populationsBefore, targetByModel, migration);
  const conversionLimit = Math.max(1, ceilRate(totalPopulation(populations), POPULATION_CLASS_CONVERSION_BPS));
  const classConversions = adjustStructure(populations, targetByModel, conversionLimit);
  const currentPopulation = totalPopulation(populations);

  for (const id of MODEL_IDS) {
    const model = state.models[id];
    model.population = populations[id];
    model.targetPopulation = targetByModel[id];
    model.laborForce = Math.floor(populations[id] * POPULATION_LABOR_PARTICIPATION_BPS / 10_000);
    const jobs = safeBigIntToNumber(
      BigInt(activeEmaByModelMicros[id]) * BigInt(POPULATION_LABOR_PARTICIPATION_BPS)
        / 10_000n / CAPACITY_SCALE,
      '人口就业岗位',
    );
    model.employed = Math.min(model.laborForce, jobs);
    model.unemployed = Math.max(0, model.laborForce - model.employed);
    model.vacancies = Math.max(0, jobs - model.laborForce);
  }

  demographics.currentPopulation = currentPopulation;
  demographics.targetPopulation = targetPopulation;
  demographics.structuralCapacity = POPULATION_BASE_WORLD + Math.floor(structuralCapacityMicros / 1_000_000);
  demographics.activeCapacity = Math.floor(activeCapacityMicros / 1_000_000);
  demographics.activeCapacityEma = Math.floor(activeEmaMicros / 1_000_000);
  demographics.activeCapacityEmaMicros = activeEmaMicros;
  demographics.activeCapacityEmaByModelMicros = activeEmaByModelMicros;
  demographics.occupancyRateBps = occupancyRateBps;
  demographics.industryOperatingRateBps = operatingRate;
  demographics.incomeHealthBps = incomeHealth;
  demographics.demandSatisfactionBps = satisfaction;
  demographics.lastMigration = Math.abs(migration);
  demographics.lastMigrationDirection = migration > 0 ? 'in' : migration < 0 ? 'out' : 'none';
  demographics.lastClassConversions = classConversions;
  demographics.lastPopulationCycleId = Number(cycleId);
  demographics.referenceBudget = populationReferenceBudget(currentPopulation);
  demographics.basePopulationByModel = baseByModel;
  demographics.targetByModel = targetByModel;
  demographics.updatedAt = Number(now);
  demographics.structuralCapacityByComplexity = Object.fromEntries(Object.entries(snapshot.byComplexity).map(([id, row]) => [id, {
    count: row.count,
    participatingCount: row.participatingCount,
    structuralCapacity: Math.floor(safeBigIntToNumber(row.structuralCapacityMicros, '复杂度结构承载') / 1_000_000),
    activeCapacity: Math.floor(safeBigIntToNumber(row.activeCapacityMicros, '复杂度活跃承载') / 1_000_000),
  }]));
  return demographics;
}

export function populationDemographicBudgetInputs(state) {
  const populations = modelPopulationMap(state);
  const currentPopulation = totalPopulation(populations);
  return {
    totalBaseBudget: populationReferenceBudget(currentPopulation),
    modelWeights: populations,
  };
}
