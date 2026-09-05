export const PRODUCTION_SETTLEMENT_VERSION: 2;
export const FACILITY_STAFFING_FULL_BPS: 10000;
export const FACILITY_STAFFING_RECOVERY_MS: number;
export const FACILITY_STAFFING_DECAY_MS: number;

export interface ProductionSettlementRecipeItem {
  productId: string;
  quantity: number;
  inventoryKey: string;
}

export interface ProductionSettlementGroupBasis {
  groupIndex: number;
  key: string;
  provinceId: string;
  facilityTypeId: string;
  complexity: string;
  enabled: boolean;
  status: 'running' | 'stopped' | 'error' | string;
  productionAvailableCount: number;
  participatingCount: number;
  cycleStartedAt: number | null;
  staffingRateBps: number;
  staffingUpdatedAt: number;
  staffingBatchCarryBps: number;
  cycleWageMultiplierBps: number;
  recipe: {
    id: string;
    cycleMs: number;
    operatingCostMicros: string;
    inputs: ProductionSettlementRecipeItem[];
    output: ProductionSettlementRecipeItem;
  };
}

export interface ProductionSettlementBasis {
  version: 2;
  basisId: string;
  userId: number;
  saveEpoch: number;
  settleThrough: number;
  resources: {
    creditsMicros: string;
    inventories: Record<string, number | string>;
    inputFreezes?: Record<string, Record<string, number | string>>;
  };
  groups: ProductionSettlementGroupBasis[];
}

export interface ProductionSettlementClaim {
  version: 2;
  basisId: string;
  settleThrough: number;
  groups: Array<{ key: string; completedCycles: number }>;
}

export interface ProductionSettlementProjection {
  completedCycles: number;
  effectiveUnits: bigint;
  finalCarryBps: number;
  finalStaffingRateBps: number;
  finalCycleStartedAt: number;
}

export function projectFacilityStaffingRate(group: Partial<ProductionSettlementGroupBasis>, at: number): number;
export function dueProductionCycles(group: Partial<ProductionSettlementGroupBasis>, settleThrough: number): number;
export function projectProductionCycles(group: ProductionSettlementGroupBasis, completedCycles: number): ProductionSettlementProjection;
export function productionResourceUsage(group: ProductionSettlementGroupBasis, completedCycles: number): ProductionSettlementProjection & {
  sourceKey: string;
  costMicros: bigint;
  inputs: Record<string, bigint>;
  outputKey: string;
  outputQuantity: bigint;
};
export function productionSettlementFits(
  group: ProductionSettlementGroupBasis,
  completedCycles: number,
  resources: ProductionSettlementBasis['resources'],
): boolean;
export function maxProductionCyclesForResources(
  group: ProductionSettlementGroupBasis,
  resources: ProductionSettlementBasis['resources'],
  settleThrough?: number,
): number;
export function applyProductionUsageToResources(
  resources: ProductionSettlementBasis['resources'],
  usage: ReturnType<typeof productionResourceUsage>,
): ProductionSettlementBasis['resources'];
export function createProductionSettlementBasisId(basis: ProductionSettlementBasis | null | undefined): string;
export function createProductionSettlementClaim(basis: ProductionSettlementBasis | null | undefined): ProductionSettlementClaim | null;
