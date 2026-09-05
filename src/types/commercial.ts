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
  cycleStartedAt?: number;
  cycleCompletesAt?: number;
  pendingRevenue?: number;
  pendingProfit?: number;
  pendingGoodsConsumed?: number;
  lifetimeRevenue: number;
  lifetimeProfit: number;
  lifetimeGoodsConsumed: number;
}

export interface CommercialStateFields {
  saveEpoch?: number;
  commercialBuildingTypes?: CommercialBuildingTypeDefinition[];
  commercialBuildingGroups?: CommercialBuildingGroup[];
}
