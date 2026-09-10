import type { CommercialAutoOperationPolicy } from '../../shared/commercial-auto-operation.js';
export type { CommercialAutoOperationPolicy } from '../../shared/commercial-auto-operation.js';

export interface CommercialBuildingTypeDefinition {
  id: string;
  name: string;
  description: string;
  buildCost: number;
  cycleMs: number;
  operatingCost: number;
  profitPerCycle: number;
  profitPerCycleByStar: readonly [number, number, number, number, number];
  premiumServiceCostPerCycle: number;
  promotionCostPerBuilding: number;
  consumptionInputs: { productId: string; quantity: number }[];
  systemValue: number;
}

export type CommercialStatus = 'running' | 'stopped' | 'error';
export type CommercialStatusReason = 'manual' | 'insufficient_funds' | 'insufficient_input';
export type CommercialServiceLevel = 'standard' | 'premium';

export interface CommercialBuildingGroup {
  commercialTypeId: string;
  provinceId: string;
  count: number;
  participatingCount: number;
  enabled: boolean;
  status: CommercialStatus;
  statusReason?: CommercialStatusReason;
  autoOperationPolicy?: CommercialAutoOperationPolicy;
  cycleStartedAt?: number;
  cycleCompletesAt?: number;
  cycleActive?: boolean;
  staffingRateBps?: number;
  staffingUpdatedAt?: number;
  staffingBatchCarryBps?: number;
  pendingStaffingRateBps?: number;
  pendingEffectiveCount?: number;
  popularity?: number;
  popularityProtectionCycles?: number;
  serviceLevel?: CommercialServiceLevel;
  promotionCyclesRemaining?: number;
  promotionCoveredCount?: number;
  pendingRevenue?: number;
  pendingProfit?: number;
  pendingGoodsConsumed?: number;
  pendingOperatingCost?: number;
  pendingServiceCost?: number;
  pendingInputValue?: number;
  pendingInputs?: { productId: string; quantity: number }[];
  pendingPopularity?: number;
  pendingStarRating?: number;
  pendingFootfall?: number;
  pendingTargetFootfall?: number;
  pendingPopularityChange?: number;
  pendingServiceLevel?: CommercialServiceLevel;
  pendingPromotionActive?: boolean;
  lifetimeRevenue: number;
  lifetimeProfit: number;
  lifetimeGoodsConsumed: number;
  lifetimeFootfall?: number;
  lastFootfall?: number;
  lastTargetFootfall?: number;
  lastPopularityChange?: number;
}

export interface CommercialStateFields {
  saveEpoch?: number;
  commercialBuildingTypes?: CommercialBuildingTypeDefinition[];
  commercialBuildingGroups?: CommercialBuildingGroup[];
}
