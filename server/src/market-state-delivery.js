import { createHash } from 'node:crypto';
import { FACILITY_TYPE_CATALOG, PRODUCT_CATALOG } from './industry-catalog.js';
import { createEconomicCalendarClientState } from './economic-events.js';
import { checkInDateKey } from './daily-check-in.js';
import {
  getOrderBookDepth,
  getOrderBookSummary,
} from './order-book-runtime.js';
import {
  normalizeProvinceId,
  PROVINCE_CATALOG,
  provinceScopedKey,
  splitProvinceScopedKey,
} from './provinces.js';

const DAY_MS = 24 * 60 * 60 * 1_000;
const MARKET_DAILY_HISTORY_DAYS = 30;
const DETAIL_DEPTH_LIMIT = 5;
const EMPTY_PUBLIC_ORDER_BOOK = Object.freeze({
  buyVolume: 0,
  sellVolume: 0,
  buyOrderCount: 0,
  sellOrderCount: 0,
  bestBid: null,
  bestAsk: null,
});

function publicPricePoint(point) {
  return {
    price: Number(point?.price || 0),
    quantity: Math.max(0, Number(point?.quantity || 0)),
    createdAt: Math.max(0, Number(point?.createdAt || 0)),
    ...(point?.takerSide === 'buy' || point?.takerSide === 'sell'
      ? { takerSide: point.takerSide }
      : {}),
  };
}

function realTradePoints(market, now) {
  const windowStart = now - DAY_MS;
  return (market?.priceHistory || [])
    .filter((point) => (
      Number(point?.createdAt || 0) >= windowStart
      && Number(point?.createdAt || 0) <= now
      && (point?.takerSide === 'buy' || point?.takerSide === 'sell')
    ))
    .sort((left, right) => Number(left.createdAt || 0) - Number(right.createdAt || 0));
}

function realTradePointsBetween(market, startsAt, endsAt) {
  return (market?.priceHistory || [])
    .filter((point) => (
      Number(point?.createdAt || 0) >= startsAt
      && Number(point?.createdAt || 0) <= endsAt
      && (point?.takerSide === 'buy' || point?.takerSide === 'sell')
    ))
    .sort((left, right) => Number(left.createdAt || 0) - Number(right.createdAt || 0));
}

function dailyHistoryForMarket(market, assetKind, now) {
  const byDate = new Map();
  const remember = (entry) => {
    const dateKey = String(entry?.dateKey || '');
    const price = Number(entry?.price || 0);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey) || !(price > 0)) return;
    const buyVolume = Math.max(0, Number(entry?.buyQuantity ?? entry?.buyVolume) || 0);
    const sellVolume = Math.max(0, Number(entry?.sellQuantity ?? entry?.sellVolume) || 0);
    const neutralVolume = Math.max(0, Number(entry?.neutralVolume) || 0);
    byDate.set(dateKey, { dateKey, price, buyVolume, sellVolume, neutralVolume, volume: Math.max(buyVolume + sellVolume + neutralVolume, Math.max(0, Number(entry?.volume) || 0)) });
  };
  for (const entry of Array.isArray(market?.dailyHistory) ? market.dailyHistory : []) remember(entry);
  if (assetKind === 'commodity') {
    remember({ dateKey: checkInDateKey(now), price: Number(market?.officialPrice || market?.lastPrice || 0), buyQuantity: Math.max(0, Number(market?.todayBuyQuantity || 0)), sellQuantity: Math.max(0, Number(market?.todaySellQuantity || 0)) });
  } else {
    for (const point of realTradePointsBetween(market, now - MARKET_DAILY_HISTORY_DAYS * DAY_MS, now)) {
      const dateKey = checkInDateKey(Number(point.createdAt || 0));
      const current = byDate.get(dateKey) || { dateKey, price: Number(point.price || 0), buyVolume: 0, sellVolume: 0, neutralVolume: 0, volume: 0 };
      const quantity = Math.max(0, Number(point.quantity || 0));
      current.price = Number(point.price || current.price || 0);
      current.volume += quantity;
      if (point.takerSide === 'buy') current.buyVolume += quantity;
      else if (point.takerSide === 'sell') current.sellVolume += quantity;
      byDate.set(dateKey, current);
    }
  }
  return [...byDate.values()].sort((left, right) => left.dateKey.localeCompare(right.dateKey)).slice(-MARKET_DAILY_HISTORY_DAYS);
}

function completedEventWindowsByProduct(now) {
  const windows = new Map();
  for (const event of createEconomicCalendarClientState(now).events) {
    if (Number(event.endsAt || 0) > now) continue;
    for (const productId of event.productIds || []) {
      const productWindows = windows.get(productId) || [];
      productWindows.push({ id: event.id, startsAt: event.startsAt, endsAt: event.endsAt });
      windows.set(productId, productWindows);
    }
  }
  return windows;
}

function summarizeEventWindows(market, windows) {
  return Object.fromEntries((windows || []).map((window) => {
    const trades = realTradePointsBetween(market, window.startsAt, window.endsAt);
    return [window.id, {
      tradeCount: trades.length,
      volume: trades.reduce((sum, point) => sum + Math.max(0, Number(point.quantity || 0)), 0),
      firstPrice: trades.length > 0 ? Number(trades[0].price || 0) : null,
      lastPrice: trades.length > 0 ? Number(trades[trades.length - 1].price || 0) : null,
    }];
  }));
}

function orderBookSummary(world, provinceId, assetKind, assetId) {
  const buy = getOrderBookSummary(world, { provinceId, assetKind, assetId, side: 'buy' });
  const sell = getOrderBookSummary(world, { provinceId, assetKind, assetId, side: 'sell' });
  return {
    buyVolume: buy.totalQuantity,
    sellVolume: sell.totalQuantity,
    buyOrderCount: buy.orderCount,
    sellOrderCount: sell.orderCount,
    bestBid: buy.bestPrice,
    bestAsk: sell.bestPrice,
  };
}

export function createMarketSummary(market, world, {
  provinceId,
  assetKind,
  assetId,
  now = Date.now(),
  economicEventWindows,
  includeOrderBook = true,
} = {}) {
  const trades = realTradePoints(market, now);
  const firstTrade = trades[0];
  const lastTrade = trades[trades.length - 1];
  const previousTrade = trades[trades.length - 2];
  let stableMarket;
  if (assetKind === 'commodity') {
    const officialPrice = Number(market?.officialPrice);
    const nextPriceAt = Number(market?.nextPriceAt);
    const todayBuyQuantity = Math.max(0, Number(market?.todayBuyQuantity || 0));
    const todaySellQuantity = Math.max(0, Number(market?.todaySellQuantity || 0));
    const lastPriceChangeBps = Math.trunc(Number(market?.lastPriceChangeBps || 0));
    const demandLastQuantity = Math.max(0, Number(market?.demand?.lastQuantity || 0));
    const demandSatisfaction = Math.max(0, Math.min(1, Number(market?.demand?.satisfaction || 0)));
    stableMarket = {
      lastPrice: Number(market?.lastPrice || 0),
      lastTradePrice: Number.isFinite(Number(market?.lastTradePrice)) ? Number(market.lastTradePrice) : null,
      ...(Number.isFinite(officialPrice) && officialPrice > 0 ? { officialPrice } : {}),
      ...(Number.isFinite(nextPriceAt) && nextPriceAt > 0 ? { nextPriceAt } : {}),
      ...(todayBuyQuantity > 0 ? { todayBuyQuantity } : {}),
      ...(todaySellQuantity > 0 ? { todaySellQuantity } : {}),
      ...(lastPriceChangeBps !== 0 ? { lastPriceChangeBps } : {}),
      ...(demandLastQuantity > 0 ? {
        demand: { lastQuantity: demandLastQuantity, satisfaction: demandSatisfaction },
      } : {}),
    };
  } else {
    const { priceHistory: _priceHistory, ...facilityMarket } = market || {};
    stableMarket = facilityMarket;
  }
  return {
    ...stableMarket,
    provinceId: normalizeProvinceId(provinceId),
    ...(assetKind === 'facility'
      ? { facilityTypeId: String(assetId || '') }
      : { productId: String(assetId || '') }),
    priceChange24h: firstTrade && lastTrade ? Number(lastTrade.price || 0) - Number(firstTrade.price || 0) : null,
    tradeVolume24h: trades.reduce((sum, point) => sum + Math.max(0, Number(point.quantity || 0)), 0),
    tradeCount24h: trades.length,
    previousTradePrice: previousTrade ? Number(previousTrade.price || 0) : null,
    lastTradeAt: lastTrade ? Number(lastTrade.createdAt || 0) : null,
    ...(assetKind === 'commodity' && economicEventWindows?.length > 0
      ? { eventTradeWindows: summarizeEventWindows(market, economicEventWindows) }
      : {}),
    ...(includeOrderBook
      ? (assetKind === 'commodity'
        ? EMPTY_PUBLIC_ORDER_BOOK
        : orderBookSummary(world, provinceId, assetKind, assetId))
      : {}),
  };
}

export function createMarketSummaryStatesByProvince(markets, world, assetKind, now = Date.now()) {
  const states = {};
  const eventWindows = assetKind === 'commodity' ? completedEventWindowsByProduct(now) : new Map();
  for (const [key, market] of Object.entries(markets || {})) {
    const { provinceId, assetId } = splitProvinceScopedKey(key);
    states[provinceId] ||= {};
    states[provinceId][assetId] = createMarketSummary(market, world, {
      provinceId,
      assetKind,
      assetId,
      now,
      economicEventWindows: eventWindows.get(assetId),
      includeOrderBook: assetKind !== 'commodity',
    });
  }
  return states;
}

function normalizedAssetKind(value) {
  if (value === 'commodity' || value === 'facility') return value;
  const error = new Error('市场资产类型无效');
  error.statusCode = 400;
  throw error;
}

function validateMarketIdentity(provinceId, assetKind, assetId) {
  const requestedProvinceId = String(provinceId || '');
  if (!PROVINCE_CATALOG.some((province) => province.id === requestedProvinceId)) {
    const error = new Error('市场地区不存在');
    error.statusCode = 404;
    throw error;
  }
  const normalizedProvinceId = normalizeProvinceId(provinceId);
  const catalog = assetKind === 'facility' ? FACILITY_TYPE_CATALOG : PRODUCT_CATALOG;
  if (!catalog.some((asset) => asset.id === assetId)) {
    const error = new Error('市场资产不存在');
    error.statusCode = 404;
    throw error;
  }
  return normalizedProvinceId;
}

function publicDepth(levels, side) {
  return levels.map((level) => ({
    side,
    price: Number(level.price || 0),
    remaining: Math.max(0, Number(level.quantity || 0)),
    orderCount: Math.max(0, Number(level.orderCount || 0)),
  }));
}

export function createMarketDetail(world, {
  provinceId,
  assetKind: requestedAssetKind,
  assetId: requestedAssetId,
  now = Date.now(),
} = {}) {
  const assetKind = normalizedAssetKind(requestedAssetKind);
  const assetId = String(requestedAssetId || '');
  const normalizedProvinceId = validateMarketIdentity(provinceId, assetKind, assetId);
  const markets = assetKind === 'facility' ? world.facilityMarkets : world.markets;
  const market = markets?.[provinceScopedKey(normalizedProvinceId, assetId)];
  if (!market) {
    const error = new Error('市场行情不存在');
    error.statusCode = 404;
    throw error;
  }
  const summary = createMarketSummary(market, world, {
    provinceId: normalizedProvinceId,
    assetKind,
    assetId,
    now,
    economicEventWindows: assetKind === 'commodity'
      ? completedEventWindowsByProduct(now).get(assetId)
      : undefined,
  });
  const priceHistory = realTradePoints(market, now).map(publicPricePoint);
  const dailyHistory = dailyHistoryForMarket(market, assetKind, now);
  const bids = assetKind === 'commodity' ? [] : publicDepth(getOrderBookDepth(world, {
    provinceId: normalizedProvinceId,
    assetKind,
    assetId,
    side: 'buy',
    limit: DETAIL_DEPTH_LIMIT,
  }), 'buy');
  const asks = assetKind === 'commodity' ? [] : publicDepth(getOrderBookDepth(world, {
    provinceId: normalizedProvinceId,
    assetKind,
    assetId,
    side: 'sell',
    limit: DETAIL_DEPTH_LIMIT,
  }), 'sell');
  const revision = createHash('sha256')
    .update(JSON.stringify({ summary, priceHistory, dailyHistory, bids, asks }))
    .digest('base64url')
    .slice(0, 16);
  return {
    provinceId: normalizedProvinceId,
    assetKind,
    assetId,
    revision,
    market: { ...summary, priceHistory, dailyHistory },
    orderBook: { bids, asks },
  };
}
