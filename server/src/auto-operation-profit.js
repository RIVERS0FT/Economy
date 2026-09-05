import { calculateCumulativeMarketSellFee } from './market-sell-fee.js';
import { internalMoneyToMicros, microsToInternalMoney } from './money.js';

const unavailable = (reason) => ({ profitable: false, profit: null, reason });

function count(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function pricedQuantity(item, units, priceFor) {
  const perUnit = count(item?.quantity);
  if (perUnit === null) return null;
  const quantity = perUnit * units;
  if (!Number.isSafeInteger(quantity)) return null;
  if (quantity === 0) return 0n;
  const price = priceFor(String(item.productId || ''));
  if (typeof price !== 'number' || !Number.isFinite(price) || price < 0.01) return null;
  const micros = internalMoneyToMicros(price);
  return micros === null || micros < 0n ? null : micros * BigInt(quantity);
}

/** Current official-price opportunity cost, including the actual commodity sale fee. */
export function evaluateProductionCycleProfit(recipe, units, priceFor) {
  if (!recipe || count(units) === null || typeof priceFor !== 'function') return unavailable('invalid_recipe');
  const operating = internalMoneyToMicros(recipe.operatingCost);
  if (operating === null || operating < 0n) return unavailable('invalid_cost');
  const grossMicros = pricedQuantity(recipe.output, units, priceFor);
  if (grossMicros === null) return unavailable('missing_price');
  let materialMicros = 0n;
  for (const input of recipe.inputs || (recipe.input ? [recipe.input] : [])) {
    const value = pricedQuantity(input, units, priceFor);
    if (value === null) return unavailable('missing_price');
    materialMicros += value;
  }
  const gross = microsToInternalMoney(grossMicros);
  if (gross === null) return unavailable('amount_range');
  const feeMicros = internalMoneyToMicros(calculateCumulativeMarketSellFee(gross));
  if (feeMicros === null) return unavailable('amount_range');
  const profitMicros = grossMicros - feeMicros - materialMicros - operating * BigInt(units);
  const profit = microsToInternalMoney(profitMicros);
  if (profit === null) return unavailable('amount_range');
  return { profitable: profitMicros > 0n, profit, reason: profitMicros > 0n ? null : 'non_positive_profit' };
}

/** Commercial revenue is not a commodity sale and must not be charged a market sale fee. */
export function evaluateCommercialCycleProfit(type, units) {
  if (!type || count(units) === null) return unavailable('invalid_recipe');
  const fixed = internalMoneyToMicros(type.profitPerCycle);
  if (fixed === null || fixed < 0n) return unavailable('invalid_cost');
  const micros = fixed * BigInt(units);
  const profit = microsToInternalMoney(micros);
  if (profit === null) return unavailable('amount_range');
  return { profitable: micros > 0n, profit, reason: micros > 0n ? null : 'non_positive_profit' };
}
