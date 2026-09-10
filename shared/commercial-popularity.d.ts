export const COMMERCIAL_POPULARITY_MAX: 100;
export const COMMERCIAL_PROMOTION_CYCLES: 3;
export const COMMERCIAL_BASE_FOOTFALL_PER_BUILDING: 100;
export const COMMERCIAL_PROMOTION_FOOTFALL_BONUS_BPS: 5000;

export type CommercialServiceLevel = 'standard' | 'premium';

export function normalizeCommercialPopularity(value: unknown): number;
export function commercialStarRating(popularity: unknown): number;
export function commercialProfitPerCycle(type: {
  profitPerCycle: number;
  profitPerCycleByStar?: readonly number[];
}, starRating?: number): number;
export function normalizeCommercialServiceLevel(value: unknown): CommercialServiceLevel | null;
export function commercialCycleFootfall(input: {
  count: number;
  effectiveCount: number;
  popularity: number;
  serviceLevel?: CommercialServiceLevel;
  promotionCoveredCount?: number;
}): { footfall: number; targetFootfall: number; starRating: number };
export function commercialPopularityChange(footfall: number, targetFootfall: number): number;
export function commercialPopularityAfterCycle(popularity: unknown, change: number): number;
