import { PRODUCT_CATALOG } from './industry-catalog.js';
import { normalizePlayerMoneyInput } from './money.js';

const PRODUCT_IDS = new Set(PRODUCT_CATALOG.map((product) => product.id));

function normalizeTargetFreeInventory(value) {
  const normalized = Number(value ?? 0);
  return Number.isSafeInteger(normalized) && normalized >= 0 ? normalized : null;
}

export function normalizeOnlineAutoBuyPolicy(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const maxPrice = normalizePlayerMoneyInput(value.maxPrice, { min: 0.01 });
  const targetFreeInventory = normalizeTargetFreeInventory(value.targetFreeInventory);
  if (maxPrice === null || targetFreeInventory === null) return null;
  return {
    enabled: value.enabled === true,
    maxPrice,
    targetFreeInventory,
  };
}

export function ensureOnlineAutoBuyPolicies(player) {
  if (!player || typeof player !== 'object') return {};
  const source = player.onlineAutoBuyPolicies;
  const normalized = {};
  if (source && typeof source === 'object' && !Array.isArray(source)) {
    for (const [productId, value] of Object.entries(source)) {
      if (!PRODUCT_IDS.has(productId)) continue;
      const policy = normalizeOnlineAutoBuyPolicy(value);
      if (policy) normalized[productId] = policy;
    }
  }
  return normalized;
}

function managedOrderLinksForClient(player) {
  const source = player?.onlineAutoBuyOrderIds;
  if (!source || typeof source !== 'object' || Array.isArray(source)) return {};
  return Object.fromEntries(Object.entries(source).flatMap(([productId, orderId]) => (
    PRODUCT_IDS.has(productId) && String(orderId || '')
      ? [[productId, String(orderId)]]
      : []
  )));
}

export function createOnlineAutoBuyPolicyClientState(player) {
  return {
    onlineAutoBuyPolicies: structuredClone(ensureOnlineAutoBuyPolicies(player)),
    onlineAutoBuyManagedOrderIds: managedOrderLinksForClient(player),
  };
}

export function onlineAutoBuyPolicyFor(player, productId) {
  const policies = ensureOnlineAutoBuyPolicies(player);
  return policies[String(productId || '')] || null;
}
