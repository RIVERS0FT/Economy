import { FACILITY_TYPE_CATALOG } from './industry-catalog.js';
import { createProductionSettlementBasis } from './production-settlement.js';
import { normalizeProvinceId } from './provinces.js';
import { dueProductionCycles, productionResourceUsage } from '../../shared/production-settlement.js';
import {
  allocateDailySupplyReservesForSupplier,
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

function aggregateProductionDemand(world, userId, now) {
  const basis = createProductionSettlementBasis(world, userId, now);
  const demands = new Map();
  const add = (key, quantity) => {
    const amount = nonNegativeInteger(quantity);
    if (amount <= 0) return;
    demands.set(key, Math.min(Number.MAX_SAFE_INTEGER, (demands.get(key) || 0) + amount));
  };

  for (const group of basis.groups || []) {
    if (!group.enabled) continue;
    if (group.status === 'running') {
      const due = dueProductionCycles(group, now);
      if (due <= 0) continue;
      const usage = productionResourceUsage(group, due);
      for (const [key, quantity] of Object.entries(usage.inputs || {})) add(key, Number(quantity));
      continue;
    }
    if (group.status !== 'error') continue;
    const count = nonNegativeInteger(group.productionAvailableCount);
    if (count <= 0) continue;
    for (const input of group.recipe?.inputs || []) add(input.inventoryKey, nonNegativeInteger(input.quantity) * count);
  }
  return demands;
}

export function productionInputSourcingRequired(world, userId, now = Date.now()) {
  if (!world?.players?.[String(userId)]) return false;
  return aggregateProductionDemand(world, userId, now).size > 0;
}

export function captureProductionOutputBaseline(world, userId) {
  const player = world.players?.[String(userId)];
  return new Map((player?.facilityGroups || []).map((group) => [
    `${normalizeProvinceId(group.provinceId)}:${String(group.facilityTypeId || '')}`,
    nonNegativeInteger(group.lifetimeOutput),
  ]));
}

export function prepareProductionInputsForPlayer(world, userId, now = Date.now()) {
  // Contract escrow maintenance is not procurement. Goods are acquired only after cycle completion.
  processDailySupplyContracts(world, now);
  return captureProductionOutputBaseline(world, userId);
}

export function finalizeProductionOutputContracts(world, userId, baseline, now = Date.now()) {
  const player = world.players?.[String(userId)];
  if (!player || !(baseline instanceof Map)) return 0;
  let produced = 0;
  for (const group of player.facilityGroups || []) {
    const provinceId = normalizeProvinceId(group.provinceId);
    const facilityTypeId = String(group.facilityTypeId || '');
    const key = `${provinceId}:${facilityTypeId}`;
    const before = nonNegativeInteger(baseline.get(key));
    const after = nonNegativeInteger(group.lifetimeOutput);
    const delta = Math.max(0, after - Math.max(before, nonNegativeInteger(group.cycleRecordedLifetimeOutput)));
    if (delta <= 0) continue;
    const type = FACILITY_TYPES.get(facilityTypeId);
    const recipe = activeRecipe(type, group.activeRecipeId);
    const productId = String(recipe?.output?.productId || '');
    if (!productId) continue;
    recordDailyProductProduction(player, provinceId, productId, delta, now);
    allocateDailySupplyReservesForSupplier(world, userId, provinceId, productId, now);
    group.cycleRecordedLifetimeOutput = after;
    produced += delta;
  }
  return produced;
}
