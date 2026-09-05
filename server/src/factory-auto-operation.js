import { COMMERCIAL_BUILDING_TYPE_CATALOG } from './commercial-catalog.js';
import { commercialAutoOperationPolicyFor } from '../../shared/commercial-auto-operation.js';
import { FACILITY_TYPE_CATALOG, PRODUCT_CATALOG } from './industry-catalog.js';
import { applyOnlineAutoTradePolicyAction } from './online-auto-trade-policy.js';
import { releaseInventoryFreezeSource } from './inventory-freezes.js';
import {
  installDefaultProvinceAliases,
  normalizeProvinceId,
  provinceScopedKey,
  splitProvinceScopedKey,
  syncDefaultProvinceAlias,
} from './provinces.js';
import { provinceUnlockError } from './province-access.js';

const FACILITY_TYPES = new Map(FACILITY_TYPE_CATALOG.map((type) => [type.id, type]));
const PRODUCT_BY_ID = new Map(PRODUCT_CATALOG.map((product) => [product.id, product]));
const COVERAGE_CYCLES = new Set([1, 2, 3, 5]);
const MODES = new Set(['profit', 'balanced', 'supply']);
const OUTPUT_MODES = new Set(['surplus', 'keep']);

export const DEFAULT_FACTORY_AUTO_OPERATION_POLICY = Object.freeze({
  enabled: true,
  inputCoverageCycles: 2,
  mode: 'balanced',
  outputMode: 'surplus',
});

const MODE_PRICE_MULTIPLIERS = Object.freeze({
  profit: Object.freeze({ buy: 0.95, sell: 1.1 }),
  balanced: Object.freeze({ buy: 1.05, sell: 1 }),
  supply: Object.freeze({ buy: 1.15, sell: 0.95 }),
});

function result(ok, message) {
  return { ok, message };
}

function roundPrice(value) {
  const rounded = Math.round(Math.max(0.01, Number(value) || 0.01) * 100) / 100;
  return Math.max(0.01, rounded);
}

function nonNegativeInteger(value) {
  const normalized = Math.floor(Number(value));
  return Number.isSafeInteger(normalized) && normalized >= 0 ? normalized : 0;
}

export function normalizeFactoryAutoOperationPolicy(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const inputCoverageCycles = Math.floor(Number(value.inputCoverageCycles));
  const mode = String(value.mode || '');
  const outputMode = String(value.outputMode || '');
  if (!COVERAGE_CYCLES.has(inputCoverageCycles) || !MODES.has(mode) || !OUTPUT_MODES.has(outputMode)) {
    return null;
  }
  return {
    enabled: value.enabled === true,
    inputCoverageCycles,
    mode,
    outputMode,
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

function activeRecipe(type, group) {
  if (!type) return null;
  return type.recipes?.find((recipe) => recipe.id === group?.activeRecipeId)
    || type.recipes?.find((recipe) => recipe.id === type.defaultRecipeId)
    || type.recipes?.[0]
    || null;
}

function productionCount(group) {
  if (!group?.enabled) return 0;
  if (group.status === 'running') return nonNegativeInteger(group.participatingCount);
  return nonNegativeInteger(group.productionAvailableCount ?? group.count);
}

function priceFor(productId, mode, side) {
  const product = PRODUCT_BY_ID.get(productId);
  const basePrice = Math.max(0.01, Number(product?.basePrice || 1));
  return roundPrice(basePrice * MODE_PRICE_MULTIPLIERS[mode][side]);
}

function ensureProductIntent(intents, productId) {
  intents[productId] ||= {
    extraProtected: 0,
    buyEnabled: false,
    buyPrice: 0,
    sellEnabled: false,
    sellPrice: 0,
    keepOutput: false,
  };
  return intents[productId];
}

// Compatibility projection only. New automatic trading is settled by the server at building-cycle completion.
export function deriveFactoryAutoTradePolicies(player, provinceId) {
  const selectedProvinceId = normalizeProvinceId(provinceId);
  const intents = {};

  for (const group of player?.facilityGroups || []) {
    if (normalizeProvinceId(group?.provinceId) !== selectedProvinceId) continue;
    const type = FACILITY_TYPES.get(String(group?.facilityTypeId || ''));
    const policy = factoryAutoOperationPolicyFor(player, selectedProvinceId, group?.facilityTypeId);
    const recipe = activeRecipe(type, group);
    const count = productionCount(group);
    if (!policy.enabled || !type || !recipe || count < 1) continue;

    for (const input of recipe.inputs || []) {
      const perCycle = nonNegativeInteger(input?.quantity) * count;
      if (perCycle < 1) continue;
      const productId = String(input.productId || '');
      const intent = ensureProductIntent(intents, productId);
      intent.extraProtected += perCycle * Math.max(0, policy.inputCoverageCycles - 1);
      intent.buyEnabled = true;
      intent.buyPrice = Math.max(intent.buyPrice, priceFor(productId, policy.mode, 'buy'));
    }

    const outputProductId = String(recipe.output?.productId || '');
    if (outputProductId) {
      const intent = ensureProductIntent(intents, outputProductId);
      if (policy.outputMode === 'keep') intent.keepOutput = true;
      else {
        intent.sellEnabled = true;
        intent.sellPrice = Math.max(intent.sellPrice, priceFor(outputProductId, policy.mode, 'sell'));
      }
    }
  }

  for (const group of player?.commercialBuildingGroups || []) {
    if (!group.enabled || normalizeProvinceId(group.provinceId) !== selectedProvinceId) continue;
    const type = COMMERCIAL_BUILDING_TYPE_CATALOG.find((candidate) => candidate.id === group.commercialTypeId);
    const policy = commercialAutoOperationPolicyFor(group);
    const count = nonNegativeInteger(group.count);
    if (!type || !policy.enabled || count < 1) continue;
    for (const input of type.consumptionInputs) {
      const intent = ensureProductIntent(intents, input.productId);
      intent.extraProtected += input.quantity * count * Math.max(0, policy.inputCoverageCycles - 1);
      intent.buyEnabled = true;
      intent.buyPrice = Math.max(intent.buyPrice, priceFor(input.productId, 'balanced', 'buy'));
    }
  }

  return Object.fromEntries(PRODUCT_CATALOG.map((product) => {
    const intent = intents[product.id] || {
      extraProtected: 0,
      buyEnabled: false,
      buyPrice: 0,
      sellEnabled: false,
      sellPrice: 0,
      keepOutput: false,
    };
    const buyPrice = intent.buyEnabled ? roundPrice(intent.buyPrice || product.basePrice) : roundPrice(product.basePrice);
    let sellPrice = intent.sellEnabled ? roundPrice(intent.sellPrice || product.basePrice) : roundPrice(product.basePrice);
    const sellEnabled = intent.sellEnabled && !intent.keepOutput;
    if (intent.buyEnabled && sellEnabled && sellPrice <= buyPrice) sellPrice = roundPrice(buyPrice + 0.01);
    const protectedQuantity = nonNegativeInteger(intent.extraProtected);
    return [product.id, {
      buy: {
        enabled: false,
        maxPrice: buyPrice,
        targetFreeInventory: protectedQuantity,
      },
      sell: {
        enabled: false,
        price: sellPrice,
        minimumFreeInventory: protectedQuantity,
      },
    }];
  }));
}

export function factoryAutoTradeExecutionPolicyFor(player, productId, provinceId) {
  return deriveFactoryAutoTradePolicies(player, provinceId)[String(productId || '')] || null;
}

export function createFactoryAutoTradeExecutionClientState(player) {
  return {
    onlineAutoBuyPolicies: {},
    onlineAutoSellPolicies: {},
  };
}

export function rebuildFactoryAutoTradePoliciesForProvince(world, userId, provinceId) {
  const player = world.players?.[String(userId)];
  if (!player) return result(false, '玩家不存在');
  const selectedProvinceId = normalizeProvinceId(provinceId);
  const policies = deriveFactoryAutoTradePolicies(player, selectedProvinceId);
  for (const [productId, policy] of Object.entries(policies)) {
    const update = applyOnlineAutoTradePolicyAction(world, { id: userId }, {
      provinceId: selectedProvinceId,
      productId,
      buy: policy.buy,
      sell: policy.sell,
    });
    if (!update.ok) return update;
  }
  return result(true, '建筑自动经营已切换为周期结算执行');
}

export function applyFactoryAutoOperationPolicyAction(world, user, payload = {}) {
  const player = world.players?.[String(user.id)];
  if (!player) return result(false, '玩家不存在');
  const provinceId = normalizeProvinceId(payload.provinceId);
  const accessError = provinceUnlockError(player, provinceId);
  if (accessError) return result(false, accessError);
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
  if (!policy.enabled) {
    releaseInventoryFreezeSource(player, { kind: 'production', provinceId, sourceId: facilityTypeId });
  }
  const rebuilt = rebuildFactoryAutoTradePoliciesForProvince(world, user.id, provinceId);
  if (!rebuilt.ok) return rebuilt;
  return result(true, policy.enabled ? '自动经营策略已保存，将在生产周期完成时执行' : '自动经营已关闭');
}

export function factoryAutoOperationPolicyKey(provinceId, facilityTypeId) {
  return provinceScopedKey(provinceId, facilityTypeId);
}
