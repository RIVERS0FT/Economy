import { projectFacilityStaffingRate, projectProductionCycles } from '../../shared/production-settlement.js';
import { commercialStaffingCapacity, projectCommercialStaffingRate, hasCommercialCycle } from '../../shared/commercial-staffing.js';
import { commercialAutoOperationPolicyFor } from '../../shared/commercial-auto-operation.js';
import { FACILITY_TYPE_CATALOG } from './industry-catalog.js';
import { COMMERCIAL_BUILDING_TYPE_CATALOG } from './commercial-catalog.js';
import { factoryAutoOperationPolicyFor } from './factory-auto-operation.js';
import { productionAvailableCount } from './facility-production-availability.js';
import { frozenForSource, freezeCommodity, releaseCommodityFreeze } from './commodity-freezes.js';
import { inventoryForProvince, normalizeProvinceId, provinceScopedKey, splitProvinceScopedKey } from './provinces.js';

const facilityTypes = new Map(FACILITY_TYPE_CATALOG.map((type) => [type.id, type]));
const commercialTypes = new Map(COMMERCIAL_BUILDING_TYPE_CATALOG.map((type) => [type.id, type]));
const safe = (value) => {
  if (!Number.isSafeInteger(value) || value < 0) throw new RangeError('经营商品数量超出系统范围');
  return value;
};

export function buildingFreezeSource(group, kind = 'production') {
  return provinceScopedKey(group.provinceId, kind === 'production' ? group.facilityTypeId : group.commercialTypeId);
}

export function buildingAvailableInput(player, group, productId, kind = 'production') {
  const inventory = player.inventories?.[provinceScopedKey(group.provinceId, productId)];
  return safe(Number(inventory?.available || 0) + frozenForSource(inventory, kind, buildingFreezeSource(group, kind)));
}

/** Read-only demand projection. Targets are server internals, not asset balances or UI fields. */
export function buildingInputPlans(world, player, now, provinceId) {
  const selected = provinceId === undefined ? null : normalizeProvinceId(provinceId);
  const plans = [];
  for (const group of player.facilityGroups || []) {
    const region = normalizeProvinceId(group.provinceId);
    if (!group.enabled || (selected !== null && region !== selected)) continue;
    const type = facilityTypes.get(group.facilityTypeId);
    const recipe = type?.recipes?.find((item) => item.id === group.activeRecipeId)
      || type?.recipes?.find((item) => item.id === type.defaultRecipeId) || type?.recipes?.[0];
    if (!recipe) continue;
    const available = productionAvailableCount(world, player, group);
    if (available < 1) continue;
    const policy = factoryAutoOperationPolicyFor(player, region, type.id);
    const count = group.status === 'running' ? Math.min(available, Number(group.participatingCount || 0)) : available;
    const basis = {
      ...group, enabled: true, status: 'running', participatingCount: count, recipe,
      cycleStartedAt: group.status === 'running' ? group.cycleStartedAt : now,
      staffingRateBps: group.status === 'running' ? group.staffingRateBps : projectFacilityStaffingRate(group, now),
      staffingUpdatedAt: group.status === 'running' ? group.staffingUpdatedAt : now,
    };
    let previousUnits = 0;
    const batches = [];
    for (let cycle = 1; cycle <= (policy.enabled ? policy.inputCoverageCycles : 1); cycle += 1) {
      const total = safe(Number(projectProductionCycles(basis, cycle).effectiveUnits));
      const effectiveCount = total - previousUnits;
      previousUnits = total;
      batches.push({ effectiveCount, inputs: (recipe.inputs || []).map((item) => ({ ...item, quantity: safe(item.quantity * effectiveCount) })) });
    }
    plans.push({ kind: 'production', sourceId: buildingFreezeSource(group), provinceId: region,
      group, type, recipe, policy, batches, operatingCost: recipe.operatingCost });
  }
  for (const group of player.commercialBuildingGroups || []) {
    const region = normalizeProvinceId(group.provinceId);
    if (!group.enabled || (selected !== null && region !== selected)) continue;
    const type = commercialTypes.get(group.commercialTypeId);
    if (!type || group.count < 1) continue;
    const policy = commercialAutoOperationPolicyFor(group);
    const batches = [];
    let carry = Number(group.staffingBatchCarryBps || 0);
    const nextStart = hasCommercialCycle(group) ? Math.max(now, Number(group.cycleCompletesAt || now)) : now;
    for (let cycle = 0; cycle < (policy.enabled ? policy.inputCoverageCycles : 1); cycle += 1) {
      const rate = projectCommercialStaffingRate({ ...group, status: 'running' }, nextStart + type.cycleMs * cycle);
      if (rate === null) break;
      const capacity = commercialStaffingCapacity(group.count, rate, carry);
      carry = capacity.carryBps;
      batches.push({ effectiveCount: capacity.effectiveCount,
        inputs: type.consumptionInputs.map((item) => ({ ...item, quantity: safe(item.quantity * capacity.effectiveCount) })) });
    }
    plans.push({ kind: 'commercial', sourceId: buildingFreezeSource(group, 'commercial'), provinceId: region,
      group, type, policy, batches, operatingCost: type.operatingCost });
  }
  return plans.sort((a, b) => a.sourceId.localeCompare(b.sourceId) || a.kind.localeCompare(b.kind));
}

export function planInputTotals(plan, through = plan.batches.length) {
  const totals = {};
  for (const batch of plan.batches.slice(0, through)) {
    for (const input of batch.inputs) totals[input.productId] = safe((totals[input.productId] || 0) + input.quantity);
  }
  return totals;
}

/** Reassign only building custody. Existing contract/auction custody is never available to borrow. */
export function reconcileBuildingInputFreezes(world, player, now, provinceId) {
  const plans = buildingInputPlans(world, player, now, provinceId);
  const bySource = new Map(plans.map((plan) => [`${plan.kind}:${plan.sourceId}`, planInputTotals(plan)]));
  const selected = provinceId === undefined ? null : normalizeProvinceId(provinceId);
  for (const [key, inventory] of Object.entries(player.inventories || {})) {
    const { provinceId: region, assetId: productId } = splitProvinceScopedKey(key);
    if (selected !== null && region !== selected) continue;
    for (const entry of Object.values(inventory.freezes || {})) {
      if (entry.kind !== 'production' && entry.kind !== 'commercial') continue;
      const target = bySource.get(`${entry.kind}:${entry.sourceId}`)?.[productId] || 0;
      if (entry.quantity > target) releaseCommodityFreeze(inventory, entry.kind, entry.sourceId, entry.quantity - target);
    }
  }
  // Fill every first cycle before any extra cycle; stable source order resolves genuine contention.
  for (let cycle = 1; cycle <= 5; cycle += 1) {
    for (const plan of plans) {
      if (cycle > plan.batches.length) continue;
      for (const [productId, target] of Object.entries(planInputTotals(plan, cycle))) {
        const inventory = inventoryForProvince(player, productId, plan.provinceId);
        const missing = Math.max(0, target - frozenForSource(inventory, plan.kind, plan.sourceId));
        const amount = Math.min(inventory.available, missing);
        if (amount > 0) freezeCommodity(inventory, plan.kind, plan.sourceId, amount);
      }
    }
  }
  return plans;
}
