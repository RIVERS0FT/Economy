export const economyConstants = {
  maxOrderQuantity: Number.MAX_SAFE_INTEGER,
} as const;

export function openOrderLimitForCatalog(productTypeCount: number, facilityTypeCount: number) {
  const products = Number.isSafeInteger(productTypeCount) ? Math.max(0, productTypeCount) : 0;
  const facilities = Number.isSafeInteger(facilityTypeCount) ? Math.max(0, facilityTypeCount) : 0;
  return products + facilities;
}
