import { PRICE_WINDOW_MS } from './catalog.js';
import { clamp } from './math.js';

export function createMarketSignalRuntime({ marketFor, isOpenOrder }) {
  function realTradeStats(world, productId, now, windowMs = PRICE_WINDOW_MS) {
    const points = (marketFor(world, productId, now).priceHistory || []).filter((point) => (
      Number(point.createdAt || 0) >= now - windowMs
      && (point.takerSide === 'buy' || point.takerSide === 'sell')
      && Number(point.quantity || 0) > 0
      && Number(point.price || 0) > 0
    ));
    const quantity = points.reduce((sum, point) => sum + Number(point.quantity), 0);
    const value = points.reduce((sum, point) => sum + Number(point.quantity) * Number(point.price), 0);
    const netActive = points.reduce((sum, point) => sum + Number(point.quantity) * (point.takerSide === 'buy' ? 1 : -1), 0);
    return { quantity, value, netActive, vwap: quantity > 0 ? value / quantity : null };
  }

  function orderBookQuote(world, product, depth, referencePrice) {
    const asks = (world.orders || [])
      .filter((order) => order.ownerType === 'player'
        && order.productId === product.id
        && order.side === 'sell'
        && isOpenOrder(order))
      .sort((left, right) => Number(left.price) - Number(right.price) || Number(left.createdAt) - Number(right.createdAt));
    const targetDepth = Math.max(1, Math.ceil(depth));
    if (asks.length === 0) return { quote: referencePrice, available: 0, coverage: 0 };
    let remaining = targetDepth;
    let available = 0;
    let cost = 0;
    let fallbackPrice = referencePrice;
    for (const ask of asks) {
      if (remaining <= 0) break;
      const quantity = Math.min(remaining, Math.max(0, Number(ask.remaining || 0)));
      if (quantity <= 0) continue;
      fallbackPrice = Math.max(fallbackPrice, Number(ask.price || referencePrice));
      cost += quantity * Number(ask.price || referencePrice);
      available += quantity;
      remaining -= quantity;
    }
    if (remaining > 0) cost += remaining * fallbackPrice;
    return {
      quote: Math.max(1, cost / targetDepth),
      available,
      coverage: clamp(0, 1, available / targetDepth),
    };
  }

  function effectivePrice(world, product, depth, priceState, now) {
    const referencePrice = Math.max(0.01, Number(priceState?.referencePrice || product.basePrice));
    const quote = orderBookQuote(world, product, depth, referencePrice);
    const trades = realTradeStats(world, product.id, now);
    const vwap = trades.vwap === null ? referencePrice : trades.vwap;
    return {
      ...quote,
      vwap,
      effective: 0.50 * quote.quote + 0.30 * referencePrice + 0.20 * vwap,
      referencePrice,
    };
  }

  return { realTradeStats, orderBookQuote, effectivePrice };
}
