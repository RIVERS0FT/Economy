export type MarketChartVariant = 'compact' | 'full';

const MARKET_TIME_INTERVAL_HOURS = [1, 2, 3, 4, 6, 8, 12] as const;

function clampInteger(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, Math.floor(value)));
}

export function chooseMarketTimeInterval(
  plotWidth: number,
  rootFontSize: number,
  variant: MarketChartVariant,
  windowMs: number,
) {
  const minimumLabelSpacing = variant === 'compact'
    ? Math.max(52, rootFontSize * 3.25)
    : Math.max(60, rootFontSize * 3.75);
  const maximumSegments = clampInteger(Math.max(1, plotWidth) / minimumLabelSpacing, 3, 24);
  const intervalHours = MARKET_TIME_INTERVAL_HOURS.find((hours) => (
    Math.max(1, windowMs) / (hours * 60 * 60 * 1000) <= maximumSegments
  )) ?? MARKET_TIME_INTERVAL_HOURS[MARKET_TIME_INTERVAL_HOURS.length - 1];
  return intervalHours * 60 * 60 * 1000;
}

export function chooseMarketPriceTickCount(priceHeight: number, rootFontSize: number) {
  const minimumTickSpacing = Math.max(38, rootFontSize * 2.4);
  return clampInteger(Math.max(1, priceHeight) / minimumTickSpacing + 1, 3, 7);
}

export function chooseMarketVolumeTickCount(volumeHeight: number, rootFontSize: number) {
  const minimumTickSpacing = Math.max(34, rootFontSize * 2.2);
  return clampInteger(Math.max(1, volumeHeight) / minimumTickSpacing + 1, 2, 5);
}

export function resolveMarketBucketIndex(
  axisValue: number,
  windowStart: number,
  bucketCount: number,
  bucketMs: number,
) {
  if (!(bucketCount > 0) || !(bucketMs > 0) || !Number.isFinite(axisValue) || !Number.isFinite(windowStart)) return 0;
  const rawIndex = Math.floor((axisValue - windowStart) / bucketMs);
  return clampInteger(rawIndex, 0, bucketCount - 1);
}
