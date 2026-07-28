import { roundInternalMoney } from './money.js';

export const MARKET_SELL_FEE_RATE_BPS = 100;
export const MARKET_SELL_FEE_MINIMUM = 0;
export const MARKET_SELL_FEE_VERSION = 3;
const BASIS_POINTS = 10_000;

function normalizedFillTotal(fill) {
  const fallback = Number(fill?.quantity || 0) * Number(fill?.price || 0);
  return Math.max(0, roundInternalMoney(fill?.total ?? fallback) || 0);
}

function initializeMarketSellFeeOrder(order) {
  if (Number(order?.marketSellFeeVersion || 0) >= MARKET_SELL_FEE_VERSION) return;
  for (const fill of order?.fills || []) {
    const total = normalizedFillTotal(fill);
    fill.fee = Math.max(0, roundInternalMoney(fill.fee || 0) || 0);
    fill.netTotal = Math.max(0, roundInternalMoney(fill.netTotal ?? total - fill.fee) || 0);
  }
  order.marketSellFeeVersion = MARKET_SELL_FEE_VERSION;
  order.marketSellFeeGross = 0;
  order.marketSellFeeCharged = 0;
}

export function calculateCumulativeMarketSellFee(grossTotal) {
  const normalizedGross = Math.max(0, roundInternalMoney(grossTotal) || 0);
  return Math.max(0, roundInternalMoney(normalizedGross * MARKET_SELL_FEE_RATE_BPS / BASIS_POINTS) || 0);
}

export function applyMarketSellFee(order, fillTotal) {
  const total = Math.max(0, roundInternalMoney(fillTotal) || 0);
  if (order?.ownerType !== 'player' || order?.side !== 'sell') return { fee: 0, netTotal: total };
  initializeMarketSellFeeOrder(order);
  const previousGross = Math.max(0, roundInternalMoney(order.marketSellFeeGross) || 0);
  const previousCharged = Math.max(0, roundInternalMoney(order.marketSellFeeCharged) || 0);
  const nextGross = roundInternalMoney(previousGross + total) || 0;
  const nextCharged = calculateCumulativeMarketSellFee(nextGross);
  const fee = Math.max(0, roundInternalMoney(nextCharged - previousCharged) || 0);
  order.marketSellFeeGross = nextGross;
  order.marketSellFeeCharged = nextCharged;
  return { fee, netTotal: Math.max(0, roundInternalMoney(total - fee) || 0) };
}
