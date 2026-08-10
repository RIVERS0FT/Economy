import { PRODUCT_CATALOG } from './industry-catalog.js';
import { normalizePlayerMoneyInput } from './money.js';

const PRODUCT_IDS = new Set(PRODUCT_CATALOG.map((product) => product.id));

function normalizeMinimumFreeInventory(value) {
  const normalized = Number(value ?? 0);
  return Number.isSafeInteger(normalized) && normalized >= 0 ? normalized : null;
}

export function normalizeOnlineAutoSellPolicy(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const price = normalizePlayerMoneyInput(value.price, { min: 0.01 });
  const minimumFreeInventory = normalizeMinimumFreeInventory(value.minimumFreeInventory);
  if (price === null || minimumFreeInventory === null) return null;
  return {
    enabled: value.enabled === true,
    price,
    minimumFreeInventory,
  };
}

export function ensureOnlineAutoSellPolicies(player) {
  if (!player || typeof player !== 'object') return {};
  const source = player.onlineAutoSellPolicies;
  const normalized = {};
  if (source && typeof source === 'object' && !Array.isArray(source)) {
    for (const [productId, value] of Object.entries(source)) {
      if (!PRODUCT_IDS.has(productId)) continue;
      const policy = normalizeOnlineAutoSellPolicy(value);
      if (policy) normalized[productId] = policy;
    }
  }
  return normalized;
}

export function createOnlineAutoSellPolicyClientState(player) {
  return {
    onlineAutoSellPolicies: structuredClone(ensureOnlineAutoSellPolicies(player)),
  };
}

function importLegacyOnlineAutoSellPolicies(player, payload) {
  if (Number(player.saveEpoch || 0) > 0) {
    return { ok: false, message: '旧浏览器自动出售设置不能导入已重建的经济存档' };
  }
  const source = payload.policies;
  if (!source || typeof source !== 'object' || Array.isArray(source)) {
    return { ok: false, message: '旧版自动出售设置无效' };
  }

  const existing = ensureOnlineAutoSellPolicies(player);
  const merged = { ...existing };
  for (const [productId, value] of Object.entries(source)) {
    if (!PRODUCT_IDS.has(productId) || Object.hasOwn(existing, productId)) continue;
    const policy = normalizeOnlineAutoSellPolicy(value);
    if (!policy) return { ok: false, message: '旧版自动出售设置无效' };
    merged[productId] = policy;
  }
  if (Object.keys(merged).length > Object.keys(existing).length) {
    player.onlineAutoSellPolicies = merged;
  }
  return { ok: true, message: '旧版自动出售设置已合并到当前存档' };
}

export function applyOnlineAutoSellPolicyAction(world, user, payload = {}) {
  const player = world.players?.[String(user.id)];
  if (!player) return { ok: false, message: '玩家不存在' };
  if (payload.legacyImport === true) return importLegacyOnlineAutoSellPolicies(player, payload);

  const productId = String(payload.productId || payload.assetId || '');
  if (!PRODUCT_IDS.has(productId)) {
    return { ok: false, message: '自动出售商品不存在' };
  }
  const policy = normalizeOnlineAutoSellPolicy(payload);
  if (!policy) return { ok: false, message: '自动出售设置无效' };

  const policies = ensureOnlineAutoSellPolicies(player);
  policies[productId] = policy;
  player.onlineAutoSellPolicies = policies;
  return {
    ok: true,
    message: policy.enabled
      ? `自动出售设置已保存，最低价 ${policy.price.toFixed(2)}，最低自由库存 ${policy.minimumFreeInventory}`
      : '自动出售设置已保存并关闭',
  };
}

export function onlineAutoSellPolicyFor(player, productId) {
  const policies = ensureOnlineAutoSellPolicies(player);
  return policies[String(productId || '')] || null;
}
