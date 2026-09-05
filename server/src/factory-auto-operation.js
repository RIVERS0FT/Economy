import { FACILITY_TYPE_CATALOG, PRODUCT_CATALOG } from './industry-catalog.js';
import { reconcileBuildingInputFreezes } from './building-input-freezes.js';
import {
  installDefaultProvinceAliases,
  normalizeProvinceId,
  provinceScopedKey,
  splitProvinceScopedKey,
  syncDefaultProvinceAlias,
} from './provinces.js';
import { provinceUnlockError } from './province-access.js';

const FACILITY_TYPES = new Map(FACILITY_TYPE_CATALOG.map((type) => [type.id, type]));
const COVERAGE_CYCLES = new Set([1, 2, 3, 5]);
const MODES = new Set(['profit', 'balanced', 'supply']);
const OUTPUT_MODES = new Set(['surplus', 'keep']);

export const DEFAULT_FACTORY_AUTO_OPERATION_POLICY = Object.freeze({
  enabled: true,
  inputCoverageCycles: 2,
  mode: 'balanced',
  outputMode: 'surplus',
});

function result(ok, message) { return { ok, message }; }

export function normalizeFactoryAutoOperationPolicy(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const inputCoverageCycles = value.inputCoverageCycles;
  const mode = String(value.mode || '');
  const outputMode = String(value.outputMode || '');
  if (typeof value.enabled !== 'boolean' || !COVERAGE_CYCLES.has(inputCoverageCycles) || !MODES.has(mode) || !OUTPUT_MODES.has(outputMode)) {
    return null;
  }
  return {
    enabled: value.enabled === true,
    inputCoverageCycles,
    mode: 'balanced',
    outputMode: 'surplus',
  };
}

export function ensureFactoryAutoOperationPolicies(player) {
  if (!player || typeof player !== 'object') return {};
  const source = player.factoryAutoOperationPolicies;
  const normalized = {};
  if (source && typeof source === 'object' && !Array.isArray(source)) {
    for (const [sourceKey, value] of Object.entries(source)) {
      const { provinceId, assetId: facilityTypeId } = splitProvinceScopedKey(sourceKey);
      if (!FACILITY_TYPES.has(facilityTypeId)) continue;
      const policy = normalizeFactoryAutoOperationPolicy(value);
      if (policy) normalized[provinceScopedKey(provinceId, facilityTypeId)] = policy;
    }
  }
  return installDefaultProvinceAliases(normalized);
}

export function factoryAutoOperationPolicyFor(player, provinceId, facilityTypeId) {
  const policies = ensureFactoryAutoOperationPolicies(player);
  return policies[provinceScopedKey(provinceId, facilityTypeId)]
    || { ...DEFAULT_FACTORY_AUTO_OPERATION_POLICY };
}

export function createFactoryAutoOperationClientState(player) {
  const effective = ensureFactoryAutoOperationPolicies(player);
  for (const group of player?.facilityGroups || []) {
    const facilityTypeId = String(group?.facilityTypeId || '');
    if (!FACILITY_TYPES.has(facilityTypeId)) continue;
    const key = provinceScopedKey(group?.provinceId, facilityTypeId);
    if (!Object.hasOwn(effective, key)) effective[key] = { ...DEFAULT_FACTORY_AUTO_OPERATION_POLICY };
  }
  return {
    factoryAutoOperationPolicies: structuredClone(installDefaultProvinceAliases(effective)),
  };
}

/** Legacy commodity policies are read-only disabled compatibility fields. */
export function deriveFactoryAutoTradePolicies() {
  return Object.fromEntries(PRODUCT_CATALOG.map((product) => [product.id, {
    buy: { enabled: false, maxPrice: product.basePrice, targetFreeInventory: 0 },
    sell: { enabled: false, price: product.basePrice, minimumFreeInventory: 0 },
  }]));
}

export function factoryAutoTradeExecutionPolicyFor(player, productId) {
  return deriveFactoryAutoTradePolicies()[String(productId || '')] || null;
}

export function createFactoryAutoTradeExecutionClientState(player) {
  return {
    onlineAutoBuyPolicies: {},
    onlineAutoSellPolicies: {},
    provinceAutoSaleEnabled: Object.fromEntries(Object.entries(player?.provinceAutoSaleEnabled || {})
      .filter(([, enabled]) => enabled === true)),
    cycleAutoSaleCounts: { ...(player?.cycleAutoSaleCounts || {}) },
  };
}

export function rebuildFactoryAutoTradePoliciesForProvince(world, userId, provinceId, now = Date.now()) {
  const player = world.players?.[String(userId)];
  if (!player) return result(false, '玩家不存在');
  for (const field of ['onlineAutoBuyPolicies', 'onlineAutoSellPolicies']) {
    for (const key of Object.keys(player[field] || {})) {
      if (splitProvinceScopedKey(key).provinceId === normalizeProvinceId(provinceId)) delete player[field][key];
    }
  }
  reconcileBuildingInputFreezes(world, player, now, provinceId);
  return result(true, '周期自动经营与商品冻结已同步');
}

export function applyFactoryAutoOperationPolicyAction(world, user, payload = {}, now = Date.now()) {
  const player = world.players?.[String(user.id)];
  if (!player) return result(false, '玩家不存在');
  const provinceId = normalizeProvinceId(payload.provinceId);
  const accessError = provinceUnlockError(player, provinceId);
  if (accessError) return result(false, accessError);
  if (payload.operation === 'province-auto-sale') {
    return result(false, '地区自动出售已并入建筑自动经营，无需单独设置');
  }
  const facilityTypeId = String(payload.facilityTypeId || payload.assetId || '');
  if (!FACILITY_TYPES.has(facilityTypeId)) return result(false, '工厂类型不存在');
  const groupExists = (player.facilityGroups || []).some((candidate) => (
    normalizeProvinceId(candidate?.provinceId) === provinceId
    && candidate?.facilityTypeId === facilityTypeId
  ));
  if (!groupExists) return result(false, '工厂集群不存在');
  const policy = normalizeFactoryAutoOperationPolicy(payload.policy || payload);
  if (!policy) return result(false, '自动经营策略无效');

  const policies = ensureFactoryAutoOperationPolicies(player);
  policies[provinceScopedKey(provinceId, facilityTypeId)] = policy;
  player.factoryAutoOperationPolicies = syncDefaultProvinceAlias(policies, facilityTypeId);
  const rebuilt = rebuildFactoryAutoTradePoliciesForProvince(world, user.id, provinceId, now);
  if (!rebuilt.ok) return rebuilt;
  return result(true, policy.enabled ? '自动经营策略已保存' : '自动经营已关闭');
}

export function factoryAutoOperationPolicyKey(provinceId, facilityTypeId) {
  return provinceScopedKey(provinceId, facilityTypeId);
}
