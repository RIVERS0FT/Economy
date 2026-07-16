import type { PricePoint } from '../types';

export const MARKET_WINDOW_MS = 24 * 60 * 60 * 1000;
export const MARKET_BUCKET_MS = 6 * 60 * 1000;
export const MARKET_BUCKET_COUNT = MARKET_WINDOW_MS / MARKET_BUCKET_MS;
export const MARKET_AXIS_SEGMENTS = 12;

export interface MarketHistoryBucket {
  startAt: number;
  price: number;
  volume: number;
}

function validPrice(value: number, fallback: number) {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export function buildMarketHistoryBuckets(
  points: PricePoint[],
  fallbackPrice: number,
  now = Date.now(),
): MarketHistoryBucket[] {
  const normalizedFallback = validPrice(Number(fallbackPrice), 1);
  const windowEnd = Math.floor(now / MARKET_BUCKET_MS) * MARKET_BUCKET_MS + MARKET_BUCKET_MS;
  const windowStart = windowEnd - MARKET_WINDOW_MS;
  const normalizedPoints = points
    .map((point) => ({
      price: validPrice(Number(point.price), normalizedFallback),
      quantity: Math.max(0, Number(point.quantity) || 0),
      createdAt: Number(point.createdAt),
    }))
    .filter((point) => Number.isFinite(point.createdAt))
    .sort((left, right) => left.createdAt - right.createdAt);

  let previousPrice: number | undefined;
  let firstWindowPrice: number | undefined;
  for (const point of normalizedPoints) {
    if (point.createdAt < windowStart) previousPrice = point.price;
    else if (point.createdAt < windowEnd && firstWindowPrice === undefined) firstWindowPrice = point.price;
  }
  let carriedPrice = previousPrice ?? firstWindowPrice ?? normalizedFallback;
  const bucketTrades = new Map<number, { price: number; volume: number; lastTradeAt: number }>();

  for (const point of normalizedPoints) {
    if (point.createdAt < windowStart || point.createdAt >= windowEnd) continue;
    const bucketIndex = Math.floor((point.createdAt - windowStart) / MARKET_BUCKET_MS);
    const current = bucketTrades.get(bucketIndex);
    if (!current) {
      bucketTrades.set(bucketIndex, {
        price: point.price,
        volume: point.quantity,
        lastTradeAt: point.createdAt,
      });
      continue;
    }
    current.volume += point.quantity;
    if (point.createdAt >= current.lastTradeAt) {
      current.price = point.price;
      current.lastTradeAt = point.createdAt;
    }
  }

  return Array.from({ length: MARKET_BUCKET_COUNT }, (_, bucketIndex) => {
    const trade = bucketTrades.get(bucketIndex);
    if (trade) carriedPrice = trade.price;
    return {
      startAt: windowStart + bucketIndex * MARKET_BUCKET_MS,
      price: carriedPrice,
      volume: trade?.volume ?? 0,
    };
  });
}

export function formatMarketAxisTime(timestamp: number, locales?: Intl.LocalesArgument) {
  return new Intl.DateTimeFormat(locales, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(timestamp);
}

export function buildMarketAxisTicks(
  buckets: MarketHistoryBucket[],
  locales?: Intl.LocalesArgument,
) {
  const startAt = buckets[0]?.startAt ?? 0;
  const segmentMs = MARKET_WINDOW_MS / MARKET_AXIS_SEGMENTS;
  return Array.from({ length: MARKET_AXIS_SEGMENTS + 1 }, (_, index) => {
    const timestamp = startAt + index * segmentMs;
    return {
      timestamp,
      label: formatMarketAxisTime(timestamp, locales),
    };
  });
}
