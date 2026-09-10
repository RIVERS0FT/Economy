export const COMMERCIAL_POPULARITY_MAX = 100;
export const COMMERCIAL_PROMOTION_CYCLES = 3;
export const COMMERCIAL_BASE_FOOTFALL_PER_BUILDING = 100;

const STAR_TARGET_FOOTFALL_BPS = Object.freeze([10_000, 11_000, 13_000, 16_000, 22_000]);
const SERVICE_FOOTFALL_BONUS_BPS = Object.freeze({ standard: 0, premium: 2_500 });
export const COMMERCIAL_PROMOTION_FOOTFALL_BONUS_BPS = 5_000;

export function normalizeCommercialPopularity(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(COMMERCIAL_POPULARITY_MAX, Math.floor(numeric)));
}

export function commercialStarRating(popularity) {
  const normalized = normalizeCommercialPopularity(popularity);
  return Math.max(1, Math.min(5, Math.ceil(normalized / 20)));
}

export function commercialProfitPerCycle(type, starRating = 1) {
  if (!type || typeof type !== 'object') return 0;
  const normalizedStarRating = Math.max(1, Math.min(5, Math.floor(Number(starRating) || 1)));
  const value = type.profitPerCycleByStar?.[normalizedStarRating - 1] ?? type.profitPerCycle;
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

export function normalizeCommercialServiceLevel(value) {
  return value === 'premium' ? 'premium' : value === 'standard' ? 'standard' : null;
}

function safeIntegerFromBigInt(value) {
  if (value < 0n || value > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new RangeError('Commercial footfall exceeds the safe integer range');
  }
  return Number(value);
}

export function commercialCycleFootfall({
  count,
  effectiveCount,
  popularity,
  serviceLevel = 'standard',
  promotionCoveredCount = 0,
}) {
  if (!Number.isSafeInteger(count) || count < 0 || !Number.isSafeInteger(effectiveCount) || effectiveCount < 0
    || effectiveCount > count || !Number.isSafeInteger(promotionCoveredCount) || promotionCoveredCount < 0) {
    throw new RangeError('Invalid commercial footfall inputs');
  }
  const normalizedServiceLevel = normalizeCommercialServiceLevel(serviceLevel);
  if (!normalizedServiceLevel) throw new RangeError('Invalid commercial service level');
  const starRating = commercialStarRating(popularity);
  const base = BigInt(COMMERCIAL_BASE_FOOTFALL_PER_BUILDING);
  const actualBps = 10_000 + SERVICE_FOOTFALL_BONUS_BPS[normalizedServiceLevel];
  const promotedCount = Math.min(effectiveCount, promotionCoveredCount);
  const actualNumerator = base * BigInt(effectiveCount) * BigInt(actualBps)
    + base * BigInt(promotedCount) * BigInt(COMMERCIAL_PROMOTION_FOOTFALL_BONUS_BPS);
  const targetNumerator = base * BigInt(count) * BigInt(STAR_TARGET_FOOTFALL_BPS[starRating - 1]);
  const footfall = safeIntegerFromBigInt(actualNumerator / 10_000n);
  const targetFootfall = safeIntegerFromBigInt(targetNumerator / 10_000n);
  return { footfall, targetFootfall, starRating };
}

export function commercialPopularityChange(footfall, targetFootfall) {
  if (!Number.isSafeInteger(footfall) || footfall < 0 || !Number.isSafeInteger(targetFootfall) || targetFootfall < 0) {
    throw new RangeError('Invalid commercial popularity assessment');
  }
  if (targetFootfall === 0) return 0;
  if (footfall === 0) return -2;
  const ratioBps = Number(BigInt(footfall) * 10_000n / BigInt(targetFootfall));
  if (ratioBps >= 12_000) return 3;
  if (ratioBps >= 10_000) return 2;
  if (ratioBps >= 8_000) return 1;
  if (ratioBps >= 5_000) return 0;
  return -1;
}

export function commercialPopularityAfterCycle(popularity, change) {
  if (!Number.isInteger(change) || change < -2 || change > 3) {
    throw new RangeError('Invalid commercial popularity change');
  }
  return normalizeCommercialPopularity(normalizeCommercialPopularity(popularity) + change);
}
