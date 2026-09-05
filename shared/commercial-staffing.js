export const COMMERCIAL_STAFFING_FULL_BPS = 10_000;
export const COMMERCIAL_STAFFING_RECOVERY_MS = 10 * 60 * 1000;
export const COMMERCIAL_STAFFING_DECAY_MS = 30 * 60 * 1000;

/**
 * @typedef {Object} CommercialStaffingSource
 * @property {number} [staffingRateBps]
 * @property {number} [staffingUpdatedAt]
 * @property {number} [staffingBatchCarryBps]
 * @property {boolean} [enabled]
 * @property {string} [status]
 * @property {number} [count]
 * @property {boolean} [cycleActive]
 * @property {number} [pendingRevenue]
 */

/** @param {CommercialStaffingSource} group */
export function hasCommercialCycle(group) {
  return group?.cycleActive === true || (Number.isFinite(group?.pendingRevenue) && Number(group.pendingRevenue) > 0);
}

/** Read-only projection. Missing authority stays unknown, never fabricated as full. @param {CommercialStaffingSource} group @param {number} now @returns {number | null} */
export function projectCommercialStaffingRate(group, now) {
  const rate = group?.staffingRateBps;
  const at = group?.staffingUpdatedAt;
  if (!Number.isInteger(rate) || Number(rate) < 0 || Number(rate) > COMMERCIAL_STAFFING_FULL_BPS
    || typeof at !== 'number' || !Number.isFinite(at) || at < 0 || !Number.isFinite(now)) return null;
  const recovering = group.enabled === true && group.status === 'running';
  const duration = recovering ? COMMERCIAL_STAFFING_RECOVERY_MS : COMMERCIAL_STAFFING_DECAY_MS;
  const elapsed = Math.max(0, Math.min(duration, now - at));
  const delta = Math.floor(elapsed * COMMERCIAL_STAFFING_FULL_BPS / duration);
  return Math.max(0, Math.min(COMMERCIAL_STAFFING_FULL_BPS, Number(rate) + (recovering ? delta : -delta)));
}

/** Fixed-point integer capacity, shared by authority and preview. @param {number} count @param {number} rateBps @param {number} [carryBps] */
export function commercialStaffingCapacity(count, rateBps, carryBps = 0) {
  if (!Number.isSafeInteger(count) || count < 0 || !Number.isInteger(rateBps)
    || rateBps < 0 || rateBps > COMMERCIAL_STAFFING_FULL_BPS || !Number.isInteger(carryBps)
    || carryBps < 0 || carryBps >= COMMERCIAL_STAFFING_FULL_BPS) {
    throw new RangeError('Invalid commercial staffing capacity');
  }
  const numerator = BigInt(count) * BigInt(rateBps) + BigInt(carryBps);
  return { effectiveCount: Number(numerator / 10_000n), carryBps: Number(numerator % 10_000n) };
}

/** @param {number} rateBps @param {number} previousCount @param {number} nextCount */
export function commercialExpansionStaffingRate(rateBps, previousCount, nextCount) {
  commercialStaffingCapacity(previousCount, rateBps);
  if (!Number.isSafeInteger(nextCount) || nextCount < previousCount) throw new RangeError('Invalid commercial expansion');
  return previousCount > 0 && nextCount > previousCount
    ? Number(BigInt(rateBps) * BigInt(previousCount) / BigInt(nextCount)) : rateBps;
}
