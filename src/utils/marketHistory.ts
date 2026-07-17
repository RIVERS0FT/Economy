import type { PricePoint } from '../types';

export const MARKET_WINDOW_MS = 24 * 60 * 60 * 1000;
export const MARKET_BUCKET_MS = 6 * 60 * 1000;
export const MARKET_BUCKET_COUNT = MARKET_WINDOW_MS / MARKET_BUCKET_MS;
export const MARKET_AXIS_SEGMENTS = 12;

export type MarketFlowDirection = 'buy' | 'sell' | 'neutral';

export interface MarketHistoryBucket {
  startAt: number;
  price: number;
  volume: number;
  buyVolume: number;
  sellVolume: number;
  neutralVolume: number;
  netVolume: number;
  direction: MarketFlowDirection;
}

export interface MarketFlowSummary {
  volume: number;
  buyVolume: number;
  sellVolume: number;
  neutralVolume: number;
  netVolume: number;
  direction: MarketFlowDirection;
}

function validPrice(value: number, fallback: number) {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function flowDirection(netVolume: number): MarketFlowDirection {
  if (netVolume > 0) return 'buy';
  if (netVolume < 0) return 'sell';
  return 'neutral';
}

export function getMarketWindowBounds(now = Date.now()) {
  const windowEnd = Math.floor(now / MARKET_BUCKET_MS) * MARKET_BUCKET_MS + MARKET_BUCKET_MS;
  return {
    windowStart: windowEnd - MARKET_WINDOW_MS,
    windowEnd,
  };
}

export function countMarketHistoryPointsInWindow(points: PricePoint[], now = Date.now()) {
  const { windowStart, windowEnd } = getMarketWindowBounds(now);
  return points.reduce((count, point) => (
    Number.isFinite(Number(point.createdAt))
    && Number(point.createdAt) >= windowStart
    && Number(point.createdAt) < windowEnd
      ? count + 1
      : count
  ), 0);
}

export function buildMarketHistoryBuckets(
  points: PricePoint[],
  fallbackPrice: number,
  now = Date.now(),
): MarketHistoryBucket[] {
  const normalizedFallback = validPrice(Number(fallbackPrice), 1);
  const { windowStart, windowEnd } = getMarketWindowBounds(now);
  const normalizedPoints = points
    .map((point) => ({
      price: validPrice(Number(point.price), normalizedFallback),
      quantity: Math.max(0, Number(point.quantity) || 0),
      createdAt: Number(point.createdAt),
      takerSide: point.takerSide === 'buy' || point.takerSide === 'sell' ? point.takerSide : undefined,
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
  const bucketTrades = new Map<number, {
    price: number;
    volume: number;
    buyVolume: number;
    sellVolume: number;
    neutralVolume: number;
    lastTradeAt: number;
  }>();

  for (const point of normalizedPoints) {
    if (point.createdAt < windowStart || point.createdAt >= windowEnd) continue;
    const bucketIndex = Math.floor((point.createdAt - windowStart) / MARKET_BUCKET_MS);
    const buyVolume = point.takerSide === 'buy' ? point.quantity : 0;
    const sellVolume = point.takerSide === 'sell' ? point.quantity : 0;
    const neutralVolume = point.takerSide ? 0 : point.quantity;
    const current = bucketTrades.get(bucketIndex);
    if (!current) {
      bucketTrades.set(bucketIndex, {
        price: point.price,
        volume: point.quantity,
        buyVolume,
        sellVolume,
        neutralVolume,
        lastTradeAt: point.createdAt,
      });
      continue;
    }
    current.volume += point.quantity;
    current.buyVolume += buyVolume;
    current.sellVolume += sellVolume;
    current.neutralVolume += neutralVolume;
    if (point.createdAt >= current.lastTradeAt) {
      current.price = point.price;
      current.lastTradeAt = point.createdAt;
    }
  }

  return Array.from({ length: MARKET_BUCKET_COUNT }, (_, bucketIndex) => {
    const trade = bucketTrades.get(bucketIndex);
    if (trade) carriedPrice = trade.price;
    const buyVolume = trade?.buyVolume ?? 0;
    const sellVolume = trade?.sellVolume ?? 0;
    const netVolume = buyVolume - sellVolume;
    return {
      startAt: windowStart + bucketIndex * MARKET_BUCKET_MS,
      price: carriedPrice,
      volume: trade?.volume ?? 0,
      buyVolume,
      sellVolume,
      neutralVolume: trade?.neutralVolume ?? 0,
      netVolume,
      direction: flowDirection(netVolume),
    };
  });
}

export function summarizeMarketFlow(buckets: MarketHistoryBucket[]): MarketFlowSummary {
  const totals = buckets.reduce((summary, bucket) => ({
    volume: summary.volume + bucket.volume,
    buyVolume: summary.buyVolume + bucket.buyVolume,
    sellVolume: summary.sellVolume + bucket.sellVolume,
    neutralVolume: summary.neutralVolume + bucket.neutralVolume,
  }), { volume: 0, buyVolume: 0, sellVolume: 0, neutralVolume: 0 });
  const netVolume = totals.buyVolume - totals.sellVolume;
  return { ...totals, netVolume, direction: flowDirection(netVolume) };
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
