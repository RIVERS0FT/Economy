export const COMMERCIAL_STAFFING_FULL_BPS: 10000;
export const COMMERCIAL_STAFFING_RECOVERY_MS: number;
export const COMMERCIAL_STAFFING_DECAY_MS: number;
export interface CommercialStaffingSource {
  staffingRateBps?: number;
  staffingUpdatedAt?: number;
  staffingBatchCarryBps?: number;
  enabled?: boolean;
  status?: string;
  count?: number;
  cycleActive?: boolean;
  pendingRevenue?: number;
}
export function hasCommercialCycle(group: CommercialStaffingSource): boolean;
export function projectCommercialStaffingRate(group: CommercialStaffingSource, now: number): number | null;
export function commercialStaffingCapacity(count: number, rateBps: number, carryBps?: number): { effectiveCount: number; carryBps: number };
export function commercialExpansionStaffingRate(rateBps: number, previousCount: number, nextCount: number): number;
