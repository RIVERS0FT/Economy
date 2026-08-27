import { iterateOrderBookSide, recordOrderBookVisit } from '../order-book-runtime.js';
import { PRICE_WINDOW_MS } from './catalog.js';
import { clamp } from './math.js';

export function createMarketSignalRuntime({ marketFor, isOpenOrder }) {
  let planningCache = null;

  function activePlanningCache(world, now = null) {
    if (!planningCache || planningCache.world !== world) return null;
    if (now !== null && planningCache.now !== Number(now)) return null;
    return planningCache;
  }

  function beginPlanningCache(world, now) {
    planningCache = {
      world,
      now: Number(now),
      tradeStats: new Map(),
      quotes: new Map(),
    };
  }

  function endPlanningCache(world) {
    if (!world || planningCache?.world === world) planningCache = null;
  }

  function realTradeStats(world, productId, now, windowMs = PRICE_WINDOW_MS, provinceId) {
    const cache = activePlanningCache(world, now);
    const cacheKey = `${String(provinceId || '')}:${String(productId || '')}:${Number(windowMs)}`;
    if (cache?.tradeStats.has(cacheKey)) return cache.tradeStats.get(cacheKey);
    const points = (marketFor(world, productId, now, provinceId).priceHistory || []).filter((point) => (
      Number(point.createdAt || 0) >= now - windowMs
      && (point.takerSide === 'buy' || point.takerSide === 'sell')
      && Number(point.quantity || 0) > 0
      && Number(point.price || 0) > 0
    ));
    const weightedQuantity = (point) => Number(point.quantity) * clamp(0, 1, Number(point.signalWeight ?? 1));
    const summarize = (selected) => {
      const quantity = selected.reduce((sum, point) => sum + weightedQuantity(point), 0);
      const value = selected.reduce((sum, point) => sum + weightedQuantity(point) * Number(point.price), 0);
      const netActive = selected.reduce((sum, point) => (
        sum + weightedQuantity(point) * (point.takerSide === 'buy' ? 1 : -1)
      ), 0);
      return { quantity, value, netActive, vwap: quantity > 0 ? value / quantity : null };
    };
    const all = summarize(points);
    const player = summarize(points.filter((point) => point.marketRole === 'player'));
    const consumption = summarize(points.filter((point) => point.marketRole === 'consumption'));
    const liquidity = summarize(points.filter((point) => point.marketRole === 'liquidity'));
    const result = {
      ...all,
      playerQuantity: player.quantity,
      playerValue: player.value,
      playerNetActive: player.netActive,
      consumptionQuantity: consumption.quantity,
      consumptionValue: consumption.value,
      liquidityQuantity: liquidity.quantity,
      liquidityValue: liquidity.value,
    };
    cache?.tradeStats.set(cacheKey, result);
    return result;
  }

  function orderBookQuote(world, product, depth, referencePrice, provinceId) {
    const cache = activePlanningCache(world);
    const cacheKey = `${String(provinceId || '')}:${product.id}:${Number(depth)}:${Number(referencePrice)}`;
    if (cache?.quotes.has(cacheKey)) return cache.quotes.get(cacheKey);
    const asks = iterateOrderBookSide(world, {
      provinceId,
      assetKind: 'commodity',
      assetId: product.id,
      side: 'sell',
    });
    const targetDepth = Math.max(1, Math.ceil(depth));
    let remaining = targetDepth;
    let available = 0;
    let cost = 0;
    let fallbackPrice = referencePrice;
    let visited = 0;
    for (const ask of asks) {
      visited += 1;
      if (remaining <= 0) break;
      if (ask.ownerType !== 'player' || !isOpenOrder(ask)) continue;
      const quantity = Math.min(remaining, Math.max(0, Number(ask.remaining || 0)));
      if (quantity <= 0) continue;
      fallbackPrice = Math.max(fallbackPrice, Number(ask.price || referencePrice));
      cost += quantity * Number(ask.price || referencePrice);
      available += quantity;
      remaining -= quantity;
    }
    recordOrderBookVisit(world, visited);
    const result = available === 0
      ? { quote: referencePrice, available: 0, coverage: 0 }
      : {
        quote: Math.max(1, (cost + (remaining > 0 ? remaining * fallbackPrice : 0)) / targetDepth),
        available,
        coverage: clamp(0, 1, available / targetDepth),
      };
    cache?.quotes.set(cacheKey, result);
    return result;
  }

  function effectivePrice(world, product, depth, priceState, now, provinceId) {
    const referencePrice = Math.max(0.01, Number(priceState?.referencePrice || product.basePrice));
    const quote = orderBookQuote(world, product, depth, referencePrice, provinceId);
    const trades = realTradeStats(world, product.id, now, PRICE_WINDOW_MS, provinceId);
    const vwap = trades.vwap === null ? referencePrice : trades.vwap;
    return {
      ...quote,
      vwap,
      effective: 0.50 * quote.quote + 0.30 * referencePrice + 0.20 * vwap,
      referencePrice,
    };
  }

  return {
    realTradeStats,
    orderBookQuote,
    effectivePrice,
    beginPlanningCache,
    endPlanningCache,
  };
}
