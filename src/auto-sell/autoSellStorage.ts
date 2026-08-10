export interface AutoSellPolicy {
  enabled: boolean;
  price: number;
  minimumFreeInventory: number;
}

export type AutoSellPolicyMap = Record<string, AutoSellPolicy>;

export const AUTO_SELL_PANEL_EVENT = 'economy:auto-sell-panel';
const STORAGE_VERSION = 1;

export function autoSellStorageKey(userId: number) {
  return `economy.online-auto-sell.v${STORAGE_VERSION}.${userId}`;
}

function panelRequestKey(userId: number) {
  return `economy.online-auto-sell-panel.v${STORAGE_VERSION}.${userId}`;
}

function normalizePolicy(value: unknown): AutoSellPolicy | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Partial<AutoSellPolicy>;
  const price = Number(raw.price);
  const minimumFreeInventory = Number(raw.minimumFreeInventory ?? 0);
  if (!Number.isFinite(price) || price < 0.01) return null;
  if (!Number.isSafeInteger(minimumFreeInventory) || minimumFreeInventory < 0) return null;
  return {
    enabled: raw.enabled === true,
    price: Math.round(price * 100) / 100,
    minimumFreeInventory,
  };
}

export function loadAutoSellPolicies(userId: number): AutoSellPolicyMap {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(autoSellStorageKey(userId));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return Object.fromEntries(Object.entries(parsed).flatMap(([productId, value]) => {
      const policy = normalizePolicy(value);
      return policy ? [[productId, policy]] : [];
    }));
  } catch {
    return {};
  }
}

export function saveAutoSellPolicies(userId: number, policies: AutoSellPolicyMap) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(autoSellStorageKey(userId), JSON.stringify(policies));
  } catch {
    // Browser-local automation preferences must never block authoritative gameplay.
  }
}

export function clearAutoSellPolicies(userId: number) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(autoSellStorageKey(userId));
    window.sessionStorage.removeItem(panelRequestKey(userId));
  } catch {
    // Optional browser-local state may be unavailable.
  }
}

export function requestAutoSellPanel(userId: number, productId: string) {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(panelRequestKey(userId), productId);
  } catch {
    // The event below still supports an already-mounted production page.
  }
  window.dispatchEvent(new CustomEvent(AUTO_SELL_PANEL_EVENT, {
    detail: { userId, productId },
  }));
}

export function consumeAutoSellPanelRequest(userId: number) {
  if (typeof window === 'undefined') return null;
  try {
    const key = panelRequestKey(userId);
    const productId = window.sessionStorage.getItem(key);
    if (productId) window.sessionStorage.removeItem(key);
    return productId || null;
  } catch {
    return null;
  }
}
