import type { ProductMarketState } from '../types';

export type MarketTrend = 'up' | 'down' | 'flat' | 'unknown';
export type RealTradePoint = ProductMarketState['priceHistory'][number];

export interface MarketDecisionSignal {
  price: number | null;
  previousPrice: number | null;
  changeBps: number | null;
  trend: MarketTrend;
  tradeCount: number;
  volume: number;
}

export function realTradePoints(
  market: ProductMarketState | undefined,
  from = Number.NEGATIVE_INFINITY,
  to = Number.POSITIVE_INFINITY,
) {
  return (market?.priceHistory ?? [])
    .filter((point) => (
      (point.takerSide === 'buy' || point.takerSide === 'sell')
      && Number.isFinite(point.price)
      && point.price > 0
      && Number.isFinite(point.createdAt)
      && point.createdAt >= from
      && point.createdAt <= to
    ))
    .sort((left, right) => left.createdAt - right.createdAt);
}

export function marketDecisionSignal(
  market: ProductMarketState | undefined,
  from?: number,
  to?: number,
): MarketDecisionSignal {
  const points = realTradePoints(market, from, to);
  const latest = points.length > 0 ? points[points.length - 1] : undefined;
  const previous = points.length >= 2 ? points[points.length - 2] : undefined;
  const fallbackPrice = Number(market?.lastTradePrice);
  const price = latest?.price ?? (Number.isFinite(fallbackPrice) && fallbackPrice > 0 ? fallbackPrice : null);
  const previousPrice = previous?.price ?? null;
  const changeBps = price !== null && previousPrice !== null && previousPrice > 0
    ? Math.round((price - previousPrice) / previousPrice * 10_000)
    : null;
  const trend: MarketTrend = changeBps === null
    ? 'unknown'
    : changeBps > 0
      ? 'up'
      : changeBps < 0
        ? 'down'
        : 'flat';
  return {
    price,
    previousPrice,
    changeBps,
    trend,
    tradeCount: points.length,
    volume: points.reduce((sum, point) => sum + Math.max(0, Number(point.quantity) || 0), 0),
  };
}

export function marketTrendGlyph(trend: MarketTrend) {
  if (trend === 'up') return '↑';
  if (trend === 'down') return '↓';
  if (trend === 'flat') return '→';
  return '—';
}

export function eventMarketFeedback(
  markets: Record<string, ProductMarketState>,
  productIds: readonly string[],
  startsAt: number,
  endsAt: number,
) {
  const signals = productIds.map((productId) => ({
    productId,
    signal: marketDecisionSignal(markets[productId], startsAt, endsAt),
  }));
  const comparable = signals.filter(({ signal }) => signal.changeBps !== null);
  const volume = signals.reduce((sum, { signal }) => sum + signal.volume, 0);
  return {
    volume,
    tradeCount: signals.reduce((sum, { signal }) => sum + signal.tradeCount, 0),
    productsWithTrades: signals.filter(({ signal }) => signal.tradeCount > 0).length,
    averageChangeBps: comparable.length > 0
      ? Math.round(comparable.reduce((sum, { signal }) => sum + Number(signal.changeBps), 0) / comparable.length)
      : null,
  };
}
