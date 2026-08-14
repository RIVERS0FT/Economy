import { PRODUCT_CATALOG } from './industry-catalog.js';
import { normalizePlayerMoneyInput } from './money.js';
import {
  DEFAULT_PROVINCE_ID,
  installDefaultProvinceAliases,
  provinceScopedKey,
  splitProvinceScopedKey,
} from './provinces.js';

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
    for (const [sourceKey, value] of Object.entries(source)) {
      const { provinceId, assetId: productId } = splitProvinceScopedKey(sourceKey);
      if (!PRODUCT_IDS.has(productId)) continue;
      const policy = normalizeOnlineAutoBuyPolicy(value);
      if (policy) normalized[provinceScopedKey(provinceId, productId)] = policy;
    }
  }
  return installDefaultProvinceAliases(normalized);
}

function managedOrderLinksForClient(player) {
  const source = player?.onlineAutoBuyOrderIds;
  if (!source || typeof source !== 'object' || Array.isArray(source)) return {};
  return Object.fromEntries(Object.entries(source).flatMap(([sourceKey, orderId]) => {
    const { provinceId, assetId: productId } = splitProvinceScopedKey(sourceKey);
    return PRODUCT_IDS.has(productId) && String(orderId || '')
      ? [[provinceScopedKey(provinceId, productId), String(orderId)]]
      : []
  }));
}

export function createOnlineAutoBuyPolicyClientState(player) {
  return {
    onlineAutoBuyPolicies: structuredClone(ensureOnlineAutoBuyPolicies(player)),
    onlineAutoBuyManagedOrderIds: managedOrderLinksForClient(player),
  };
}

export function onlineAutoBuyPolicyFor(player, productId, provinceId = DEFAULT_PROVINCE_ID) {
  const policies = ensureOnlineAutoBuyPolicies(player);
  return policies[provinceScopedKey(provinceId, productId)] || null;
}
