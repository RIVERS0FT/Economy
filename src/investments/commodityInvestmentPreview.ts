/** Read-only, integer-money preview. The server independently prices and validates every trade. */
export function commodityInvestmentPreview(price: number, quantity: number, side: 'buy' | 'sell', feeBps = 100) {
  if (!['buy', 'sell'].includes(side) || !Number.isFinite(price) || price < 0.01 || !Number.isSafeInteger(quantity) || quantity < 1
    || !Number.isSafeInteger(feeBps) || feeBps < 0 || feeBps > 10_000) return null;
  const cents = Math.round(price * 100);
  if (cents / 100 !== price || !Number.isSafeInteger(cents)) return null;
  const gross = BigInt(cents) * 10_000n * BigInt(quantity);
  if (gross > BigInt(Number.MAX_SAFE_INTEGER)) return null;
  const fee = side === 'sell' ? (gross * BigInt(feeBps) + 5_000n) / 10_000n : 0n;
  return { gross: Number(gross) / 1_000_000, fee: Number(fee) / 1_000_000,
    cash: Number(gross - fee) / 1_000_000 };
}

export function maximumCommodityInvestmentQuantity(credits: number, price: number) {
  if (!Number.isFinite(credits) || credits < 0 || !Number.isFinite(price) || price < 0.01) return 0;
  const micros = Math.round(credits * 1_000_000);
  const priceMicros = Math.round(price * 1_000_000);
  if (!Number.isSafeInteger(micros) || !Number.isSafeInteger(priceMicros)) return 0;
  return Number(BigInt(micros) / BigInt(priceMicros));
}
