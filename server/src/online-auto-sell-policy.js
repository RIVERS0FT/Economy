import { PRODUCT_CATALOG } from './industry-catalog.js';
import { normalizePlayerMoneyInput } from './money.js';
import { ensureOnlineAutoBuyPolicies } from './online-auto-buy-policy.js';
import { cancelManagedOnlineAutoSellOrder } from './online-auto-sell-orders.js';
import {
  DEFAULT_PROVINCE_ID,
  installDefaultProvinceAliases,
  provinceScopedKey,
  splitProvinceScopedKey,
} from './provinces.js';

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
    for (const [sourceKey, value] of Object.entries(source)) {
      const { provinceId, assetId: productId } = splitProvinceScopedKey(sourceKey);
      if (!PRODUCT_IDS.has(productId)) continue;
      const policy = normalizeOnlineAutoSellPolicy(value);
      if (policy) normalized[provinceScopedKey(provinceId, productId)] = policy;
    }
  }
  return installDefaultProvinceAliases(normalized);
}

function managedOrderLinksForClient(player) {
  const source = player?.onlineAutoSellOrderIds;
  if (!source || typeof source !== 'object' || Array.isArray(source)) return {};
  return Object.fromEntries(Object.entries(source).flatMap(([sourceKey, orderId]) => {
    const { provinceId, assetId: productId } = splitProvinceScopedKey(sourceKey);
    return PRODUCT_IDS.has(productId) && String(orderId || '')
      ? [[provinceScopedKey(provinceId, productId), String(orderId)]]
      : []
  }));
}

export function createOnlineAutoSellPolicyClientState(player) {
  return {
    onlineAutoSellPolicies: structuredClone(ensureOnlineAutoSellPolicies(player)),
    onlineAutoSellManagedOrderIds: managedOrderLinksForClient(player),
  };
}

function conflictsWithAutoBuy(player, productId, sellPolicy) {
  if (!sellPolicy.enabled) return null;
  const buyPolicy = ensureOnlineAutoBuyPolicies(player)[productId];
  if (!buyPolicy?.enabled) return null;
  if (buyPolicy.targetFreeInventory > sellPolicy.minimumFreeInventory) {
    return '自动采购目标自由库存不能高于自动出售最低自由库存';
  }
  if (buyPolicy.maxPrice >= sellPolicy.price) {
    return '最高自动采购价格必须低于最低自动出售价格';
  }
  return null;
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
    const policyKey = provinceScopedKey(DEFAULT_PROVINCE_ID, productId);
    if (!PRODUCT_IDS.has(productId) || Object.hasOwn(existing, policyKey)) continue;
    const policy = normalizeOnlineAutoSellPolicy(value);
    if (!policy) return { ok: false, message: '旧版自动出售设置无效' };
    const conflict = conflictsWithAutoBuy(player, policyKey, policy);
    if (conflict) return { ok: false, message: conflict };
    merged[provinceScopedKey(DEFAULT_PROVINCE_ID, productId)] = policy;
  }
  if (Object.keys(merged).length > Object.keys(existing).length) {
    player.onlineAutoSellPolicies = installDefaultProvinceAliases(merged);
  }
  return { ok: true, message: '旧版自动出售设置已合并到当前存档' };
}

function samePolicy(left, right) {
  return Boolean(
    left
    && right
    && left.enabled === right.enabled
    && Number(left.price) === Number(right.price)
    && Number(left.minimumFreeInventory) === Number(right.minimumFreeInventory),
  );
}

export function applyOnlineAutoSellPolicyAction(world, user, payload = {}) {
  const player = world.players?.[String(user.id)];
  if (!player) return { ok: false, message: '玩家不存在' };
  if (payload.legacyImport === true) return importLegacyOnlineAutoSellPolicies(player, payload);

  const productId = String(payload.productId || payload.assetId || '');
  const policyKey = provinceScopedKey(payload.provinceId, productId);
  if (!PRODUCT_IDS.has(productId)) {
    return { ok: false, message: '自动出售商品不存在' };
  }
  const policy = normalizeOnlineAutoSellPolicy(payload);
  if (!policy) return { ok: false, message: '自动出售设置无效' };
  const conflict = conflictsWithAutoBuy(player, policyKey, policy);
  if (conflict) return { ok: false, message: conflict };

  const policies = ensureOnlineAutoSellPolicies(player);
  const previous = policies[policyKey] || null;
  if (!samePolicy(previous, policy)) cancelManagedOnlineAutoSellOrder(world, user.id, productId, payload.provinceId);
  policies[policyKey] = policy;
  player.onlineAutoSellPolicies = installDefaultProvinceAliases(policies);
  return {
    ok: true,
    message: policy.enabled
      ? `自动出售设置已保存，最低价 ${policy.price.toFixed(2)}，最低自由库存 ${policy.minimumFreeInventory}`
      : '自动出售设置已保存并关闭',
  };
}

export function onlineAutoSellPolicyFor(player, productId, provinceId = DEFAULT_PROVINCE_ID) {
  const policies = ensureOnlineAutoSellPolicies(player);
  return policies[provinceScopedKey(provinceId, productId)] || null;
}
