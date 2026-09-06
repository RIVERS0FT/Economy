import type {
  EconomyState,
  FacilityProductionMethodPlan,
  FacilityRecipeDefinition,
  FacilityTypeDefinition,
} from '../types';
import {
  createProductionSettlementBasisId,
  createProductionSettlementClaim,
  dueProductionCycles,
  PRODUCTION_SETTLEMENT_VERSION,
  type ProductionSettlementBasis,
  type ProductionSettlementClaim,
  type ProductionSettlementGroupBasis,
} from '../../shared/production-settlement.js';

function nonNegativeInteger(value: unknown) {
  const normalized = Math.floor(Number(value) || 0);
  return Number.isSafeInteger(normalized) && normalized >= 0 ? normalized : 0;
}

function moneyMicros(value: number) {
  if (!Number.isFinite(value) || value <= 0) return '0';
  const fixed = value.toFixed(6);
  const [whole, fraction = ''] = fixed.split('.');
  return (BigInt(whole) * 1_000_000n + BigInt(fraction.padEnd(6, '0').slice(0, 6))).toString();
}

function recipeFor(type: FacilityTypeDefinition, recipeId: string) {
  const direct = type.recipes.find((recipe) => recipe.id === recipeId);
  if (direct) return direct;
  for (const methodGroup of type.productionMethodGroups || []) {
    for (const method of methodGroup.methods || []) {
      for (const plan of Object.values(method.plansByRecipeId || {})) {
        if (plan.recipeId === recipeId) return plan;
      }
    }
  }
  return type.recipes.find((recipe) => recipe.id === type.defaultRecipeId)
    || type.recipes[0]
    || null;
}

function recipeInputs(recipe: FacilityRecipeDefinition | FacilityProductionMethodPlan) {
  if (Array.isArray(recipe.inputs) && recipe.inputs.length > 0) return recipe.inputs;
  return recipe.input ? [recipe.input] : [];
}

function recipeIdentifier(recipe: FacilityRecipeDefinition | FacilityProductionMethodPlan) {
  return 'id' in recipe ? recipe.id : recipe.recipeId;
}

function groupBasis(
  state: EconomyState,
  group: EconomyState['facilityGroups'][number],
  serverNow: number,
): ProductionSettlementGroupBasis | null {
  const type = state.facilityTypes.find((candidate) => candidate.id === group.facilityTypeId);
  const recipe = type ? recipeFor(type, group.activeRecipeId) : null;
  if (!type || !recipe) return null;
  const provinceId = String(group.provinceId || state.defaultProvinceId);
  return {
    groupIndex: 0,
    key: `${provinceId}:${type.id}`,
    provinceId,
    facilityTypeId: type.id,
    complexity: type.complexity,
    enabled: Boolean(group.enabled),
    status: group.status,
    productionAvailableCount: nonNegativeInteger(group.productionAvailableCount ?? group.participatingCount),
    participatingCount: nonNegativeInteger(group.participatingCount),
    cycleStartedAt: Number.isFinite(Number(group.cycleStartedAt)) ? Number(group.cycleStartedAt) : null,
    // Settlement proposal math uses the raw authoritative staffing baseline while UI fields remain projected.
    staffingRateBps: nonNegativeInteger(
      group.productionSettlementStaffingRateBps ?? group.staffingRateBps ?? 10_000,
    ),
    staffingUpdatedAt: Number.isFinite(Number(group.productionSettlementStaffingUpdatedAt))
      ? Number(group.productionSettlementStaffingUpdatedAt)
      : Number.isFinite(Number(group.staffingUpdatedAt))
        ? Number(group.staffingUpdatedAt)
        : serverNow,
    staffingBatchCarryBps: nonNegativeInteger(group.staffingBatchCarryBps) % 10_000,
    cycleWageMultiplierBps: 10_000,
    recipe: {
      id: recipeIdentifier(recipe),
      cycleMs: Math.max(1, nonNegativeInteger(recipe.cycleMs)),
      operatingCostMicros: moneyMicros(recipe.operatingCost),
      ...(group.productionLegacyRecipeId === recipeIdentifier(recipe)
        && Number.isFinite(group.productionCostChangeAt)
        && typeof group.productionLegacyOperatingCost === 'number'
        && Number.isFinite(group.productionLegacyOperatingCost)
        && group.productionLegacyOperatingCost >= 0 ? {
          costChangeAt: group.productionCostChangeAt,
          previousOperatingCostMicros: moneyMicros(group.productionLegacyOperatingCost),
        } : {}),
      inputs: recipeInputs(recipe).map((item) => ({
        productId: item.productId,
        quantity: nonNegativeInteger(item.quantity),
        inventoryKey: `${provinceId}:${item.productId}`,
      })),
      output: {
        productId: recipe.output.productId,
        quantity: nonNegativeInteger(recipe.output.quantity),
        inventoryKey: `${provinceId}:${recipe.output.productId}`,
      },
    },
  };
}

export function createClientProductionSettlementBasis(
  state: EconomyState,
  serverNow: number,
): ProductionSettlementBasis {
  const inventories: Record<string, number> = {};
  for (const [provinceId, provinceInventories] of Object.entries(state.provinceInventories || {})) {
    for (const [productId, inventory] of Object.entries(provinceInventories || {})) {
      inventories[`${provinceId}:${productId}`] = nonNegativeInteger(inventory?.available);
    }
  }
  const groups = state.facilityGroups
    .map((group) => groupBasis(state, group, serverNow))
    .filter((group): group is ProductionSettlementGroupBasis => Boolean(group))
    .sort((left, right) => left.key.localeCompare(right.key));
  const basis: ProductionSettlementBasis = {
    version: PRODUCTION_SETTLEMENT_VERSION,
    basisId: '',
    userId: state.userId,
    saveEpoch: state.saveEpoch,
    settleThrough: Math.max(0, Number(serverNow) || 0),
    resources: {
      creditsMicros: moneyMicros(state.credits),
      inventories,
    },
    groups,
  };
  basis.basisId = createProductionSettlementBasisId(basis);
  return basis;
}

export function createClientProductionSettlementClaim(
  state: EconomyState | null | undefined,
  serverNow: number,
): ProductionSettlementClaim | null {
  if (!state) return null;
  const basis = createClientProductionSettlementBasis(state, serverNow);
  const hasOverdueRunningProduction = basis.groups.some((group) => (
    group.status === 'running' && dueProductionCycles(group, basis.settleThrough) > 0
  ));
  return hasOverdueRunningProduction ? createProductionSettlementClaim(basis) : null;
}
