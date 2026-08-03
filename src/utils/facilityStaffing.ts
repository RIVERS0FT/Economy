import type { FacilityGroup } from '../types';

export const FACILITY_STAFFING_FULL_BPS = 10_000;
export const FACILITY_STAFFING_RECOVERY_MS = 10 * 60 * 1000;
export const FACILITY_STAFFING_DECAY_MS = 30 * 60 * 1000;

function normalizedRate(value: number | undefined) {
  return Math.max(0, Math.min(FACILITY_STAFFING_FULL_BPS, Math.floor(Number(value ?? FACILITY_STAFFING_FULL_BPS))));
}

function normalizedCarry(value: number | undefined) {
  const normalized = Math.max(0, Math.floor(Number(value ?? 0)));
  return normalized % FACILITY_STAFFING_FULL_BPS;
}

function staffingDeltaBps(elapsedMs: number, durationMs: number) {
  const elapsed = Math.max(0, Math.floor(Number(elapsedMs) || 0));
  return Math.min(FACILITY_STAFFING_FULL_BPS, Math.floor(elapsed * FACILITY_STAFFING_FULL_BPS / durationMs));
}

export function projectFacilityStaffingRate(group: FacilityGroup, now: number) {
  const baseRate = normalizedRate(group.staffingRateBps);
  const updatedAt = Number.isFinite(Number(group.staffingUpdatedAt))
    ? Math.max(0, Number(group.staffingUpdatedAt))
    : Math.max(0, Number(now) || 0);
  const elapsed = Math.max(0, Number(now) - updatedAt);
  if (group.status === 'running' && group.enabled) {
    return Math.min(FACILITY_STAFFING_FULL_BPS, baseRate + staffingDeltaBps(elapsed, FACILITY_STAFFING_RECOVERY_MS));
  }
  return Math.max(0, baseRate - staffingDeltaBps(elapsed, FACILITY_STAFFING_DECAY_MS));
}

export function facilityEffectiveCount(group: FacilityGroup, physicalCount: number, now: number) {
  const count = Math.max(0, Math.floor(Number(physicalCount) || 0));
  const rateBps = projectFacilityStaffingRate(group, now);
  return Math.floor((count * rateBps + normalizedCarry(group.staffingBatchCarryBps)) / FACILITY_STAFFING_FULL_BPS);
}
