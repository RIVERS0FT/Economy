export const MARKET_SELL_FEE_RATE_BPS = 100;
export const MARKET_SELL_FEE_MINIMUM = 0;
export const MARKET_SELL_FEE_VERSION = 2;

const BASIS_POINTS = 10_000;

function normalizedFillTotal(fill) {
  const fallback = Number(fill?.quantity || 0) * Number(fill?.price || 0);
  return Math.max(0, Math.floor(Number(fill?.total ?? fallback) || 0));
}

function initializeMarketSellFeeOrder(order) {
  if (Number(order?.marketSellFeeVersion || 0) >= MARKET_SELL_FEE_VERSION) return;
  for (const fill of order?.fills || []) {
    const total = normalizedFillTotal(fill);
    fill.fee = Math.max(0, Math.floor(Number(fill.fee || 0)));
    fill.netTotal = Math.max(0, Math.floor(Number(fill.netTotal ?? total - fill.fee)));
  }
  order.marketSellFeeVersion = MARKET_SELL_FEE_VERSION;
  order.marketSellFeeGross = 0;
  order.marketSellFeeCharged = 0;
}

export function calculateCumulativeMarketSellFee(grossTotal) {
  const normalizedGross = Math.max(0, Math.floor(Number(grossTotal) || 0));
  return Math.floor(normalizedGross * MARKET_SELL_FEE_RATE_BPS / BASIS_POINTS);
}

export function applyMarketSellFee(order, fillTotal) {
  if (order?.ownerType !== 'player' || order?.side !== 'sell') {
    const total = Math.max(0, Math.floor(Number(fillTotal) || 0));
    return { fee: 0, netTotal: total };
  }

  initializeMarketSellFeeOrder(order);
  const total = Math.max(0, Math.floor(Number(fillTotal) || 0));
  const previousGross = Math.max(0, Math.floor(Number(order.marketSellFeeGross) || 0));
  const previousCharged = Math.max(0, Math.floor(Number(order.marketSellFeeCharged) || 0));
  const nextGross = previousGross + total;
  const nextCharged = calculateCumulativeMarketSellFee(nextGross);
  const fee = Math.max(0, nextCharged - previousCharged);

  order.marketSellFeeGross = nextGross;
  order.marketSellFeeCharged = nextCharged;
  return {
    fee,
    netTotal: total - fee,
  };
}
