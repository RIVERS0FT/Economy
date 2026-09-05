import { commoditySystemPriceFor } from './domain.js';
import { applyFacilityGroupAction } from './facility-groups.js';
import { FACILITY_TYPE_CATALOG } from './industry-catalog.js';
import { createProductionSettlementBasis } from './production-settlement.js';
import { normalizeProvinceId, provinceScopedKey } from './provinces.js';
import { dueProductionCycles, productionResourceUsage } from '../../shared/production-settlement.js';
import { thawInventoryFreeze } from './inventory-freezes.js';
import { reconcileProvinceBuildingFreezes, runCycleAutoOperation } from './cycle-auto-operation.js';
import {
  allocateDailySupplyReservesForSupplier,
  consumeDailySupplyForBuyer,
  processDailySupplyContracts,
  recordDailyProductProduction,
} from './daily-supply-contracts.js';

const FACILITY_TYPES = new Map(FACILITY_TYPE_CATALOG.map((type) => [type.id, type]));

function nonNegativeInteger(value) {
  const normalized = Math.floor(Number(value));
  return Number.isSafeInteger(normalized) && normalized > 0 ? normalized : 0;
}

function activeRecipe(type, recipeId) {
  if (!type) return null;
  return type.recipes?.find((recipe) => recipe.id === recipeId)
    || type.recipes?.find((recipe) => recipe.id === type.defaultRecipeId)
    || type.recipes?.[0]
    || null;
}

function dueRunningGroups(world, userId, now) {
  const basis = createProductionSettlementBasis(world, userId, now);
  return (basis.groups || []).filter((group) => (
    group.enabled
    && group.status === 'running'
    && dueProductionCycles(group, now) > 0
  ));
}

export function productionInputSourcingRequired(world, userId, now = Date.now()) {
  if (!world?.players?.[String(userId)]) return false;
  return dueRunningGroups(world, userId, now).length > 0;
}

export function captureProductionOutputBaseline(world, userId) {
  const player = world.players?.[String(userId)];
  return new Map((player?.facilityGroups || []).map((group) => [
    `${normalizeProvinceId(group.provinceId)}:${String(group.facilityTypeId || '')}`,
    nonNegativeInteger(group.lifetimeOutput),
  ]));
}

function thawProductionGuarantee(player, group, now) {
  const due = dueProductionCycles(group, now);
  if (due < 1) return;
  const usage = productionResourceUsage(group, due);
  for (const input of group.recipe?.inputs || []) {
    const required = nonNegativeInteger(usage.inputs?.[input.inventoryKey]);
    if (required < 1) continue;
    thawInventoryFreeze(player, {
      kind: 'production',
      provinceId: group.provinceId,
      productId: input.productId,
      sourceId: group.facilityTypeId,
      sourceLabel: FACILITY_TYPES.get(group.facilityTypeId)?.name || group.facilityTypeId,
    }, required);
  }
}

export function prepareProductionInputsForPlayer(world, userId, now = Date.now()) {
  const player = world.players?.[String(userId)];
  const baseline = captureProductionOutputBaseline(world, userId);
  if (!player) return baseline;
  processDailySupplyContracts(world, now);

  const groups = dueRunningGroups(world, userId, now);
  for (const group of groups) {
    thawProductionGuarantee(player, group, now);
    const due = dueProductionCycles(group, now);
    const usage = productionResourceUsage(group, due);
    for (const input of group.recipe?.inputs || []) {
      const required = nonNegativeInteger(usage.inputs?.[input.inventoryKey]);
      if (required < 1) continue;
      const inventory = player.inventories?.[provinceScopedKey(group.provinceId, input.productId)];
      const available = nonNegativeInteger(inventory?.available);
      const shortage = Math.max(0, required - available);
      if (shortage < 1) continue;
      const officialPrice = commoditySystemPriceFor(world, input.productId, group.provinceId, now);
      consumeDailySupplyForBuyer(world, userId, group.provinceId, input.productId, shortage, officialPrice, now);
    }
  }
  return baseline;
}

function recoverCompletedProductionGroups(world, userId, provinceId, completed, now) {
  const player = world.players?.[String(userId)];
  if (!player) return;
  for (const source of completed) {
    if (source.kind !== 'production') continue;
    const group = (player.facilityGroups || []).find((candidate) => (
      normalizeProvinceId(candidate.provinceId) === provinceId
      && candidate.facilityTypeId === source.sourceId
    ));
    if (!group?.enabled || group.status !== 'error') continue;
    const type = FACILITY_TYPES.get(group.facilityTypeId);
    const recipe = activeRecipe(type, group.activeRecipeId);
    const count = nonNegativeInteger(group.count);
    if (!type || !recipe || count < 1) continue;
    for (const input of recipe.inputs || []) {
      thawInventoryFreeze(player, {
        kind: 'production',
        provinceId,
        productId: input.productId,
        sourceId: type.id,
        sourceLabel: type.name,
      }, nonNegativeInteger(input.quantity) * count);
    }
    applyFacilityGroupAction(world, { id: Number(userId) }, 'startFacility', {
      provinceId,
      facilityTypeId: type.id,
    }, now, { migrate: false, process: false });
  }
  reconcileProvinceBuildingFreezes(world, userId, provinceId);
}

export function finalizeProductionOutputContracts(world, userId, baseline, now = Date.now()) {
  const player = world.players?.[String(userId)];
  if (!player || !(baseline instanceof Map)) return 0;
  let produced = 0;
  const touchedProvinces = new Set();
  const completedByProvince = new Map();

  for (const group of player.facilityGroups || []) {
    const provinceId = normalizeProvinceId(group.provinceId);
    const facilityTypeId = String(group.facilityTypeId || '');
    const key = `${provinceId}:${facilityTypeId}`;
    if (baseline.has(key)) touchedProvinces.add(provinceId);
    const before = nonNegativeInteger(baseline.get(key));
    const after = nonNegativeInteger(group.lifetimeOutput);
    const delta = Math.max(0, after - before);
    if (delta <= 0) continue;
    const type = FACILITY_TYPES.get(facilityTypeId);
    const recipe = activeRecipe(type, group.activeRecipeId);
    const productId = String(recipe?.output?.productId || '');
    if (!productId) continue;
    recordDailyProductProduction(player, provinceId, productId, delta, now);
    allocateDailySupplyReservesForSupplier(world, userId, provinceId, productId, now);
    const completed = completedByProvince.get(provinceId) || [];
    if (!completed.some((source) => source.kind === 'production' && source.sourceId === facilityTypeId)) {
      completed.push({ kind: 'production', sourceId: facilityTypeId });
    }
    completedByProvince.set(provinceId, completed);
    produced += delta;
  }

  for (const provinceId of touchedProvinces) {
    const completed = completedByProvince.get(provinceId) || [];
    if (completed.length > 0) {
      runCycleAutoOperation(world, userId, provinceId, completed, now);
      recoverCompletedProductionGroups(world, userId, provinceId, completed, now);
    } else {
      reconcileProvinceBuildingFreezes(world, userId, provinceId);
    }
  }
  return produced;
}
