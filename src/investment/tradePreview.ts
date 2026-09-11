import type { CommodityInvestmentQuote, CommodityInvestmentTradeInput } from '../types';

const SCALE = 1_000_000;
const LIMIT = BigInt(Number.MAX_SAFE_INTEGER);

function micros(value: number) {
  if (!Number.isFinite(value) || value < 0) return null;
  const scaled = Math.round(value * SCALE);
  return Number.isSafeInteger(scaled) && scaled / SCALE === value ? BigInt(scaled) : null;
}

export function investmentDateKey(now: number) {
  if (!Number.isFinite(now) || now < 0 || now > 8_640_000_000_000_000 - 8 * 60 * 60 * 1000) return '';
  return new Date(now + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function availableInvestmentQuote(quote: CommodityInvestmentQuote | undefined, now: number): quote is CommodityInvestmentQuote & {
  available: true; price: number; contractId: string; priceDateKey: string; expiresAt: number; feeBps: number;
} {
  return quote?.available === true && typeof quote.price === 'number' && quote.price >= 0.01
    && Number.isFinite(quote.price) && typeof quote.contractId === 'string' && quote.contractId.length > 0
    && quote.priceDateKey === investmentDateKey(now) && Number.isSafeInteger(quote.expiresAt) && (quote.expiresAt ?? 0) > now
    && Number.isSafeInteger(quote.feeBps) && (quote.feeBps ?? -1) >= 0 && (quote.feeBps ?? 10001) <= 10000;
}

/** Display only. The server rechecks the immutable contract identity, current quote and all balances. */
export function investmentTradePreview({ quote, now, side, draft, credits, heldQuantity, closeGross = 0, feesPaid = 0 }: {
  quote: CommodityInvestmentQuote | undefined; now: number; side: 'buy' | 'sell'; draft: string;
  credits: number; heldQuantity: number; closeGross?: number; feesPaid?: number;
}) {
  if (!availableInvestmentQuote(quote, now)) return null;
  const price = micros(quote.price); const cash = micros(credits);
  const previousGross = micros(closeGross); const previousFee = micros(feesPaid);
  if (price === null || price <= 0n || cash === null || previousGross === null || previousFee === null
    || !Number.isSafeInteger(heldQuantity) || heldQuantity < 0) return null;
  if (previousFee !== (previousGross * BigInt(quote.feeBps) + 5000n) / 10000n) return null;
  const maxQuantity = side === 'buy' ? Number(cash / price) : heldQuantity;
  const quantity = /^\d+$/.test(draft.trim()) ? Number(draft.trim()) : NaN;
  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > maxQuantity) return { maxQuantity, quantity: null, gross: null, fee: null, amount: null, input: null };
  const gross = price * BigInt(quantity);
  const cumulativeFee = ((previousGross + gross) * BigInt(quote.feeBps) + 5000n) / 10000n;
  const fee = side === 'sell' ? cumulativeFee - previousFee : 0n;
  const amount = side === 'buy' ? gross : gross - fee;
  if (gross > LIMIT || fee < 0n || amount < 0n || amount > LIMIT) return null;
  const input: CommodityInvestmentTradeInput = {
    productId: quote.productId, contractId: quote.contractId, priceDateKey: quote.priceDateKey, side, quantity,
  };
  return { maxQuantity, quantity, gross: Number(gross) / SCALE, fee: Number(fee) / SCALE, amount: Number(amount) / SCALE, input };
}

export function formatInvestmentExpiry(at: number) {
  if (!Number.isSafeInteger(at) || at < 0 || at > 8_640_000_000_000_000) return '待核对';
  return new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit',
    day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(at);
}
