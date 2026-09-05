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
  consumptionInputs: { productId: string; quantity: number }[];
  systemValue: number;
}

export type CommercialStatus = 'running' | 'stopped' | 'error';
export type CommercialStatusReason = 'manual' | 'insufficient_funds' | 'insufficient_input';

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
  pendingRevenue?: number;
  pendingProfit?: number;
  pendingGoodsConsumed?: number;
  pendingOperatingCost?: number;
  pendingInputValue?: number;
  pendingInputs?: { productId: string; quantity: number }[];
  lifetimeRevenue: number;
  lifetimeProfit: number;
  lifetimeGoodsConsumed: number;
}

export interface CommercialStateFields {
  saveEpoch?: number;
  commercialBuildingTypes?: CommercialBuildingTypeDefinition[];
  commercialBuildingGroups?: CommercialBuildingGroup[];
}
