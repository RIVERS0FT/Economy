const CONTRACT_MARKET_INTENT_KEY = 'economy.contract-market-intent.v1';

export interface ContractMarketIntent {
  productId: string;
  provinceId?: string;
}

export function setContractMarketIntent(productId: string, provinceId?: string) {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(CONTRACT_MARKET_INTENT_KEY, JSON.stringify({ productId, ...(provinceId ? { provinceId } : {}) }));
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
    return typeof parsed.productId === 'string' && parsed.productId
      ? { productId: parsed.productId, ...(typeof parsed.provinceId === 'string' && parsed.provinceId ? { provinceId: parsed.provinceId } : {}) }
      : null;
  } catch { return null; }
}
