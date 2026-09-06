import {
  PRICE_MIN_MULTIPLIER, PRICE_MAX_MULTIPLIER,
  SYSTEM_PRICE_K_BPS, SYSTEM_PRICE_MAX_CHANGE_BPS, SYSTEM_PRICE_LIQUIDITY_BASELINE,
  SYSTEM_PRICE_LIQUIDITY_VALUE, SYSTEM_PRICE_ANCHOR_BPS,
} from './market-demand/catalog.js';

const BPS = 10_000n;
function roundedRatio(numerator, denominator) {
  const magnitude = numerator < 0n ? -numerator : numerator;
  const rounded = (magnitude + denominator / 2n) / denominator;
  return numerator < 0n ? -rounded : rounded;
}
function quantity(value) {
  if (!Number.isSafeInteger(value) || value < 0) throw new RangeError('每日成交量必须是非负安全整数');
  return BigInt(value);
}
function priceCents(value) {
  const cents = Math.round(value * 100);
  if (!Number.isSafeInteger(cents) || cents < 1 || Math.abs(cents / 100 - value) > 1e-9) {
    throw new RangeError('每日商品价格必须是正数分币价格');
  }
  return BigInt(cents);
}

export function calculateDailySystemPrice(product, previousPrice, buyQuantity, sellQuantity) {
  const base = priceCents(product.basePrice);
  const previous = priceCents(previousPrice);
  const bought = quantity(buyQuantity);
  const sold = quantity(sellQuantity);
  const volume = bought + sold;
  const valueCents = BigInt(SYSTEM_PRICE_LIQUIDITY_VALUE * 100);
  const valueLiquidity = (valueCents + base - 1n) / base;
  const liquidity = valueLiquidity > BigInt(SYSTEM_PRICE_LIQUIDITY_BASELINE)
    ? valueLiquidity : BigInt(SYSTEM_PRICE_LIQUIDITY_BASELINE);
  const denominator = volume + 2n * liquidity;
  const numerator = BigInt(SYSTEM_PRICE_K_BPS) * (bought - sold) * base
    + BigInt(SYSTEM_PRICE_ANCHOR_BPS) * volume * (base - previous);
  const raw = roundedRatio(numerator, denominator * base);
  const limit = BigInt(SYSTEM_PRICE_MAX_CHANGE_BPS);
  const requested = raw < -limit ? -limit : raw > limit ? limit : raw;
  const theoretical = roundedRatio(previous * (BPS + requested), BPS);
  const dailyMinimum = (previous * (BPS - limit) + BPS - 1n) / BPS;
  const dailyMaximum = previous * (BPS + limit) / BPS;
  const absoluteMinimum = (base * BigInt(Math.round(PRICE_MIN_MULTIPLIER * 10_000)) + BPS - 1n) / BPS;
  const absoluteMaximum = base * BigInt(Math.round(PRICE_MAX_MULTIPLIER * 10_000)) / BPS;
  const minimum = dailyMinimum > absoluteMinimum ? dailyMinimum : absoluteMinimum;
  const maximum = dailyMaximum < absoluteMaximum ? dailyMaximum : absoluteMaximum;
  if (minimum > maximum) throw new RangeError('当前价格不在合法价格范围内');
  const next = theoretical < minimum ? minimum : theoretical > maximum ? maximum : theoretical;
  return {
    price: Number(next) / 100,
    changeBps: Number(roundedRatio((next - previous) * BPS, previous)),
    imbalance: Number(bought - sold) / Number(denominator),
  };
}
