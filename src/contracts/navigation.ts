const CONTRACT_MARKET_INTENT_KEY = 'economy.contract-market-intent.v1';

export interface ContractMarketIntent {
  productId: string;
}

export function setContractMarketIntent(productId: string) {
  if (typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(CONTRACT_MARKET_INTENT_KEY, JSON.stringify({ productId }));
  } catch {
    // Navigation hints are best-effort and never become authoritative state.
  }
}

// Consume once so a refresh never keeps forcing an old factory-origin product filter.
export function consumeContractMarketIntent(): ContractMarketIntent | null {
  if (typeof sessionStorage === 'undefined') return null;
  let raw: string | null = null;
  try {
    raw = sessionStorage.getItem(CONTRACT_MARKET_INTENT_KEY);
    sessionStorage.removeItem(CONTRACT_MARKET_INTENT_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<ContractMarketIntent>;
    return typeof parsed.productId === 'string' && parsed.productId ? { productId: parsed.productId } : null;
  } catch {
    return null;
  }
}
