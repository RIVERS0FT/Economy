export const PRODUCTION_SETTLEMENT_VERSION = 2;
export const FACILITY_STAFFING_FULL_BPS = 10_000;
export const FACILITY_STAFFING_RECOVERY_MS = 10 * 60 * 1000;
export const FACILITY_STAFFING_DECAY_MS = 30 * 60 * 1000;

/** Read-only cycle cost projection; never accepts a client price as settlement authority. */
export function productionOperatingCostForCycle(group, recipeId, currentCost) {
  return group?.status === 'running'
    && group.productionLegacyRecipeId === recipeId
    && Number.isFinite(group.cycleStartedAt)
    && Number.isFinite(group.productionCostChangeAt)
    && group.cycleStartedAt < group.productionCostChangeAt
    && Number.isFinite(group.productionLegacyOperatingCost)
    && group.productionLegacyOperatingCost >= 0
      ? group.productionLegacyOperatingCost : currentCost;
}

function safeTimestamp(value) {
  const normalized = Number(value);
  return Number.isFinite(normalized) ? Math.max(0, normalized) : 0;
}

function safeInteger(value, fallback = 0) {
  const normalized = Math.floor(Number(value));
  return Number.isSafeInteger(normalized) ? normalized : fallback;
}

function positiveInteger(value, fallback = 1) {
  const normalized = safeInteger(value, fallback);
  return normalized > 0 ? normalized : fallback;
}

function nonNegativeInteger(value) {
  return Math.max(0, safeInteger(value, 0));
}

function bigint(value) {
  try { return BigInt(value ?? 0); } catch { return 0n; }
}

function clampStaffingRate(value) {
  return Math.min(FACILITY_STAFFING_FULL_BPS, Math.max(0, safeInteger(value, FACILITY_STAFFING_FULL_BPS)));
}

function staffingDeltaBps(elapsedMs, durationMs) {
  const elapsed = BigInt(Math.max(0, safeInteger(elapsedMs, 0)));
  return Number((elapsed * BigInt(FACILITY_STAFFING_FULL_BPS)) / BigInt(durationMs));
}

export function projectFacilityStaffingRate(group, at) {
  const baseRate = clampStaffingRate(group?.staffingRateBps);
  const updatedAt = safeTimestamp(group?.staffingUpdatedAt ?? at);
  const elapsed = Math.max(0, safeTimestamp(at) - updatedAt);
  if (elapsed <= 0) return baseRate;
  if (group?.status === 'running' && group?.enabled !== false) {
    return Math.min(
      FACILITY_STAFFING_FULL_BPS,
      baseRate + staffingDeltaBps(elapsed, FACILITY_STAFFING_RECOVERY_MS),
    );
  }
  return Math.max(0, baseRate - staffingDeltaBps(elapsed, FACILITY_STAFFING_DECAY_MS));
}

export function dueProductionCycles(group, settleThrough) {
  if (group?.status !== 'running' || group?.enabled === false || !Number.isFinite(Number(group?.cycleStartedAt))) return 0;
  const cycleMs = positiveInteger(group?.recipe?.cycleMs ?? group?.cycleMs, 1);
  const elapsed = Math.max(0, safeTimestamp(settleThrough) - safeTimestamp(group.cycleStartedAt));
  return Math.min(Number.MAX_SAFE_INTEGER, Math.floor(elapsed / cycleMs));
}

function cappedArithmeticSum(firstValue, stepValue, countValue) {
  const count = nonNegativeInteger(countValue);
  if (count <= 0) return 0n;
  const first = Math.min(FACILITY_STAFFING_FULL_BPS, Math.max(0, safeInteger(firstValue, 0)));
  const step = Math.max(0, safeInteger(stepValue, 0));
  if (step === 0 || first >= FACILITY_STAFFING_FULL_BPS) return BigInt(first) * BigInt(count);
  const risingCount = Math.min(
    count,
    Math.max(0, Math.ceil((FACILITY_STAFFING_FULL_BPS - first) / step)),
  );
  const n = BigInt(risingCount);
  const arithmetic = n * (2n * BigInt(first) + BigInt(risingCount - 1) * BigInt(step)) / 2n;
  const capped = BigInt(count - risingCount) * BigInt(FACILITY_STAFFING_FULL_BPS);
  return arithmetic + capped;
}

export function projectProductionCycles(group, completedCycles) {
  const cycles = Math.max(0, safeInteger(completedCycles, 0));
  const cycleMs = positiveInteger(group?.recipe?.cycleMs ?? group?.cycleMs, 1);
  const participatingCount = nonNegativeInteger(group?.participatingCount);
  const initialCarryBps = nonNegativeInteger(group?.staffingBatchCarryBps) % FACILITY_STAFFING_FULL_BPS;
  const cycleStartedAt = safeTimestamp(group?.cycleStartedAt);
  if (cycles === 0) {
    return {
      completedCycles: 0,
      effectiveUnits: 0n,
      finalCarryBps: initialCarryBps,
      finalStaffingRateBps: clampStaffingRate(group?.staffingRateBps),
      finalCycleStartedAt: cycleStartedAt,
    };
  }

  const firstDueAt = cycleStartedAt + cycleMs;
  const firstRate = projectFacilityStaffingRate(group, firstDueAt);
  const stepRate = staffingDeltaBps(cycleMs, FACILITY_STAFFING_RECOVERY_MS);
  const staffingRateSum = cappedArithmeticSum(firstRate, stepRate, cycles);
  const numerator = BigInt(participatingCount) * staffingRateSum + BigInt(initialCarryBps);
  const effectiveUnits = numerator / BigInt(FACILITY_STAFFING_FULL_BPS);
  const finalCarryBps = Number(numerator % BigInt(FACILITY_STAFFING_FULL_BPS));
  const finalStaffingRateBps = Math.min(
    FACILITY_STAFFING_FULL_BPS,
    firstRate + Math.max(0, cycles - 1) * stepRate,
  );
  return {
    completedCycles: cycles,
    effectiveUnits,
    finalCarryBps,
    finalStaffingRateBps,
    finalCycleStartedAt: cycleStartedAt + cycles * cycleMs,
  };
}

export function productionResourceUsage(group, completedCycles) {
  const projection = projectProductionCycles(group, completedCycles);
  const recipe = group?.recipe || {};
  let costMicros = bigint(recipe.operatingCostMicros) * projection.effectiveUnits;
  if (Number.isFinite(recipe.costChangeAt) && recipe.previousOperatingCostMicros !== undefined) {
    const oldCycles = Math.min(projection.completedCycles, Math.max(0, Math.ceil(
      (recipe.costChangeAt - safeTimestamp(group.cycleStartedAt)) / positiveInteger(recipe.cycleMs),
    )));
    const oldUnits = projectProductionCycles(group, oldCycles).effectiveUnits;
    costMicros += (bigint(recipe.previousOperatingCostMicros) - bigint(recipe.operatingCostMicros)) * oldUnits;
  }
  const inputs = {};
  for (const item of recipe.inputs || []) {
    const key = String(item.inventoryKey || `${group?.provinceId || ''}:${item.productId || ''}`);
    inputs[key] = bigint(inputs[key]) + bigint(item.quantity) * projection.effectiveUnits;
  }
  const outputKey = String(recipe.output?.inventoryKey || `${group?.provinceId || ''}:${recipe.output?.productId || ''}`);
  const outputQuantity = bigint(recipe.output?.quantity) * projection.effectiveUnits;
  return {
    ...projection,
    sourceKey: String(group?.key || ''),
    costMicros,
    inputs,
    outputKey,
    outputQuantity,
  };
}

function normalizedResources(resources) {
  return {
    creditsMicros: bigint(resources?.creditsMicros),
    inventories: Object.fromEntries(Object.entries(resources?.inventories || {}).map(([key, value]) => [key, bigint(value)])),
  };
}

export function productionSettlementFits(group, completedCycles, resources) {
  const cycles = Math.max(0, safeInteger(completedCycles, 0));
  if (cycles > dueProductionCycles(group, group?.settleThrough ?? Number.MAX_SAFE_INTEGER)) return false;
  if (cycles > 0 && nonNegativeInteger(group?.participatingCount) < 1) return false;
  const available = normalizedResources(resources);
  const usage = productionResourceUsage(group, cycles);
  if (usage.costMicros > available.creditsMicros) return false;
  for (const [key, quantity] of Object.entries(usage.inputs)) {
    const owned = bigint(resources?.inputFreezes?.[String(group?.key || '')]?.[key]);
    if (quantity > (available.inventories[key] || 0n) + owned) return false;
  }
  return true;
}

export function maxProductionCyclesForResources(group, resources, settleThrough = group?.settleThrough) {
  const due = dueProductionCycles(group, settleThrough);
  if (due <= 0 || nonNegativeInteger(group?.participatingCount) < 1) return 0;
  const normalizedGroup = { ...group, settleThrough };
  let low = 0;
  let high = due;
  while (low < high) {
    const middle = low + Math.floor((high - low + 1) / 2);
    if (productionSettlementFits(normalizedGroup, middle, resources)) low = middle;
    else high = middle - 1;
  }
  return low;
}

export function applyProductionUsageToResources(resources, usage) {
  resources.creditsMicros = String(bigint(resources.creditsMicros) - bigint(usage.costMicros));
  resources.inventories ||= {};
  for (const [key, quantity] of Object.entries(usage.inputs || {})) {
    const freezes = resources.inputFreezes?.[usage.sourceKey];
    const held = bigint(freezes?.[key]);
    const consumed = held < bigint(quantity) ? held : bigint(quantity);
    if (freezes && consumed > 0n) freezes[key] = String(held - consumed);
    resources.inventories[key] = String(bigint(resources.inventories[key]) - bigint(quantity) + consumed);
  }
  if (usage.outputKey) {
    resources.inventories[usage.outputKey] = String(bigint(resources.inventories[usage.outputKey]) + bigint(usage.outputQuantity));
  }
  return resources;
}

function appendProductionBasisGroup(parts, group, resources) {
  const recipe = group?.recipe || {};
  parts.push(
    'group',
    String(group?.key || ''),
    group?.enabled === false ? '0' : '1',
    String(group?.status || ''),
    String(nonNegativeInteger(group?.productionAvailableCount)),
    String(nonNegativeInteger(group?.participatingCount)),
    Number.isFinite(Number(group?.cycleStartedAt)) ? String(Number(group.cycleStartedAt)) : '',
    String(clampStaffingRate(group?.staffingRateBps)),
    String(safeTimestamp(group?.staffingUpdatedAt)),
    String(nonNegativeInteger(group?.staffingBatchCarryBps) % FACILITY_STAFFING_FULL_BPS),
    String(recipe.id || ''),
    String(positiveInteger(recipe.cycleMs, 1)),
    String(recipe.operatingCostMicros || '0'),
  );
  if (recipe.previousOperatingCostMicros !== undefined) {
    parts.push('cost-boundary', String(recipe.costChangeAt), String(recipe.previousOperatingCostMicros));
  }
  const inventoryKeys = new Set();
  const inputs = [...(recipe.inputs || [])].sort((left, right) => (
    String(left?.inventoryKey || '').localeCompare(String(right?.inventoryKey || ''))
      || String(left?.productId || '').localeCompare(String(right?.productId || ''))
  ));
  for (const item of inputs) {
    const key = String(item?.inventoryKey || '');
    inventoryKeys.add(key);
    parts.push('input', key, String(item?.productId || ''), String(nonNegativeInteger(item?.quantity)));
  }
  const outputKey = String(recipe.output?.inventoryKey || '');
  if (outputKey) inventoryKeys.add(outputKey);
  parts.push(
    'output',
    outputKey,
    String(recipe.output?.productId || ''),
    String(nonNegativeInteger(recipe.output?.quantity)),
  );
  for (const key of [...inventoryKeys].sort()) {
    parts.push('inventory', key, String(bigint(resources?.inventories?.[key])),
      'production-freeze', String(bigint(resources?.inputFreezes?.[String(group?.key || '')]?.[key])));
  }
}

function hashProductionBasisText(text, seed) {
  let hash = seed >>> 0;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

export function createProductionSettlementBasisId(basis) {
  if (!basis || Number(basis.version) !== PRODUCTION_SETTLEMENT_VERSION) return '';
  const parts = [
    'production-settlement-basis-v2',
    String(Number(basis.userId) || 0),
    String(nonNegativeInteger(basis.saveEpoch)),
    String(bigint(basis.resources?.creditsMicros)),
  ];
  const groups = [...(basis.groups || [])].sort((left, right) => String(left?.key || '').localeCompare(String(right?.key || '')));
  for (const group of groups) appendProductionBasisGroup(parts, group, basis.resources);
  const canonical = parts.join('\u001f');
  return `${hashProductionBasisText(canonical, 2_166_136_261)}${hashProductionBasisText(canonical, 2_166_136_261 ^ 0x9e3779b9)}`;
}

export function createProductionSettlementClaim(basis) {
  if (!basis || Number(basis.version) !== PRODUCTION_SETTLEMENT_VERSION || !Array.isArray(basis.groups)) return null;
  const resources = {
    creditsMicros: String(basis.resources?.creditsMicros || '0'),
    inventories: { ...(basis.resources?.inventories || {}) },
    inputFreezes: Object.fromEntries(Object.entries(basis.resources?.inputFreezes || {}).map(([key, values]) => [key, { ...values }])),
  };
  let hasWork = false;
  const groups = basis.groups.map((group) => {
    let completedCycles = 0;
    const due = dueProductionCycles(group, basis.settleThrough);
    if (group.status === 'running' && due > 0) {
      completedCycles = maxProductionCyclesForResources(group, resources, basis.settleThrough);
      hasWork = true;
      if (completedCycles > 0) {
        applyProductionUsageToResources(resources, productionResourceUsage(group, completedCycles));
      }
    } else if (group.enabled && group.status === 'error') {
      hasWork = true;
    }
    return { key: String(group.key || ''), completedCycles };
  });
  if (!hasWork) return null;
  return {
    version: PRODUCTION_SETTLEMENT_VERSION,
    basisId: String(basis.basisId || createProductionSettlementBasisId(basis)),
    settleThrough: safeTimestamp(basis.settleThrough),
    groups,
  };
}
