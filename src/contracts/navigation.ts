const CONTRACT_MARKET_INTENT_KEY = 'economy.contract-market-intent.v1';

export type ContractMarketDirection = 'purchase' | 'supply';

export interface ContractMarketIntent {
  productId: string;
  provinceId?: string;
  direction?: ContractMarketDirection;
}

export function setContractMarketIntent(productId: string, provinceId?: string, direction?: ContractMarketDirection) {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(CONTRACT_MARKET_INTENT_KEY, JSON.stringify({
      productId,
      ...(provinceId ? { provinceId } : {}),
      ...(direction ? { direction } : {}),
    }));
  } catch {
    // Navigation hints are best-effort and never become authoritative state.
  }
}

export function consumeContractMarketIntent(): ContractMarketIntent | null {
  if (typeof sessionStorage === 'undefined') return null;
  let raw: string | null = null;
  try {
    raw = sessionStorage.getItem(CONTRACT_MARKET_INTENT_KEY);
    sessionStorage.removeItem(CONTRACT_MARKET_INTENT_KEY);
  } catch { return null; }
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<ContractMarketIntent>;
    if (typeof parsed.productId !== 'string' || !parsed.productId) return null;
    const direction = parsed.direction === 'purchase' || parsed.direction === 'supply' ? parsed.direction : undefined;
    return {
      productId: parsed.productId,
      ...(typeof parsed.provinceId === 'string' && parsed.provinceId ? { provinceId: parsed.provinceId } : {}),
      ...(direction ? { direction } : {}),
    };
  } catch { return null; }
}
