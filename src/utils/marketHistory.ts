import type { MarketDailyHistoryPoint, PricePoint } from '../types';

const SHANGHAI_OFFSET_MS = 8 * 60 * 60 * 1000;
export const MARKET_BUCKET_MS = 24 * 60 * 60 * 1000;
export const MARKET_BUCKET_COUNT = 30;
export const MARKET_WINDOW_MS = MARKET_BUCKET_COUNT * MARKET_BUCKET_MS;

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

function shanghaiDayIndex(timestamp: number) {
  return Math.floor((timestamp + SHANGHAI_OFFSET_MS) / MARKET_BUCKET_MS);
}

function shanghaiDayStart(dayIndex: number) {
  return dayIndex * MARKET_BUCKET_MS - SHANGHAI_OFFSET_MS;
}

function dateKeyForDayIndex(dayIndex: number) {
  return new Date(dayIndex * MARKET_BUCKET_MS).toISOString().slice(0, 10);
}

function dayIndexForDateKey(dateKey: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return null;
  const timestamp = Date.parse(`${dateKey}T00:00:00+08:00`);
  return Number.isFinite(timestamp) ? shanghaiDayIndex(timestamp) : null;
}

export function getMarketWindowBounds(now = Date.now()) {
  const currentDayIndex = shanghaiDayIndex(now);
  const firstDayIndex = currentDayIndex - (MARKET_BUCKET_COUNT - 1);
  return {
    windowStart: shanghaiDayStart(firstDayIndex),
    windowEnd: shanghaiDayStart(currentDayIndex + 1),
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
  dailyHistory: MarketDailyHistoryPoint[] = [],
): MarketHistoryBucket[] {
  const normalizedFallback = validPrice(Number(fallbackPrice), 1);
  const currentDayIndex = shanghaiDayIndex(now);
  const firstDayIndex = currentDayIndex - (MARKET_BUCKET_COUNT - 1);
  const lastDayIndex = currentDayIndex;
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
  for (const point of normalizedPoints) {
    if (shanghaiDayIndex(point.createdAt) < firstDayIndex) previousPrice = point.price;
    else break;
  }

  type Aggregate = {
    price: number;
    volume: number;
    buyVolume: number;
    sellVolume: number;
    neutralVolume: number;
    lastTradeAt: number;
  };
  const bucketsByDay = new Map<number, Aggregate>();

  for (const item of dailyHistory) {
    const dayIndex = dayIndexForDateKey(String(item?.dateKey || ''));
    if (dayIndex === null || dayIndex < firstDayIndex || dayIndex > lastDayIndex) continue;
    const buyVolume = Math.max(0, Number(item.buyVolume) || 0);
    const sellVolume = Math.max(0, Number(item.sellVolume) || 0);
    const neutralVolume = Math.max(0, Number(item.neutralVolume) || 0);
    const volume = Math.max(
      buyVolume + sellVolume + neutralVolume,
      Math.max(0, Number(item.volume) || 0),
    );
    bucketsByDay.set(dayIndex, {
      price: validPrice(Number(item.price), normalizedFallback),
      volume,
      buyVolume,
      sellVolume,
      neutralVolume,
      lastTradeAt: shanghaiDayStart(dayIndex) + MARKET_BUCKET_MS - 1,
    });
  }

  if (dailyHistory.length === 0) {
    for (const point of normalizedPoints) {
      const dayIndex = shanghaiDayIndex(point.createdAt);
      if (dayIndex < firstDayIndex || dayIndex > lastDayIndex) continue;
      const buyVolume = point.takerSide === 'buy' ? point.quantity : 0;
      const sellVolume = point.takerSide === 'sell' ? point.quantity : 0;
      const neutralVolume = point.takerSide ? 0 : point.quantity;
      const current = bucketsByDay.get(dayIndex);
      if (!current) {
        bucketsByDay.set(dayIndex, {
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
  }

  const firstKnown = [...bucketsByDay.entries()]
    .sort((left, right) => left[0] - right[0])
    .find(([, bucket]) => bucket.price > 0)?.[1].price;
  let carriedPrice = previousPrice ?? firstKnown ?? normalizedFallback;

  return Array.from({ length: MARKET_BUCKET_COUNT }, (_, offset) => {
    const dayIndex = firstDayIndex + offset;
    const trade = bucketsByDay.get(dayIndex);
    if (trade) carriedPrice = trade.price;
    const buyVolume = trade?.buyVolume ?? 0;
    const sellVolume = trade?.sellVolume ?? 0;
    const neutralVolume = trade?.neutralVolume ?? 0;
    const netVolume = buyVolume - sellVolume;
    return {
      startAt: shanghaiDayStart(dayIndex),
      price: carriedPrice,
      volume: trade?.volume ?? 0,
      buyVolume,
      sellVolume,
      neutralVolume,
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
    month: '2-digit',
    day: '2-digit',
    timeZone: 'Asia/Shanghai',
  }).format(timestamp);
}

export function marketBucketDateKey(bucket: MarketHistoryBucket) {
  return dateKeyForDayIndex(shanghaiDayIndex(bucket.startAt));
}
