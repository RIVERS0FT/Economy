import { commercialAutoOperationPolicyFor } from '../../shared/commercial-auto-operation.js';
import { evaluateCommercialCycleProfit, evaluateProductionCycleProfit } from './auto-operation-profit.js';
import { COMMERCIAL_BUILDING_TYPE_CATALOG } from './commercial-catalog.js';
import { applySettledCommodityOrder, commoditySystemPriceFor } from './domain.js';
import { factoryAutoOperationPolicyFor } from './factory-auto-operation.js';
import { FACILITY_TYPE_CATALOG, PRODUCT_CATALOG } from './industry-catalog.js';
import {
  ensureInventoryFreezeSources,
  releaseInventoryFreezeSource,
  setInventoryFreezeTarget,
  sourceFrozenQuantity,
} from './inventory-freezes.js';
import { multiplyMoneyByInteger, roundInternalMoney } from './money.js';
import { inventoryForProvince, normalizeProvinceId } from './provinces.js';

const FACILITY_TYPES = new Map(FACILITY_TYPE_CATALOG.map((type) => [type.id, type]));
const COMMERCIAL_TYPES = new Map(COMMERCIAL_BUILDING_TYPE_CATALOG.map((type) => [type.id, type]));

function nonNegativeInteger(value) {
  const normalized = Math.floor(Number(value));
  return Number.isSafeInteger(normalized) && normalized >= 0 ? normalized : 0;
}

function activeRecipe(type, group) {
  return type?.recipes?.find((recipe) => recipe.id === group?.activeRecipeId)
    || type?.recipes?.find((recipe) => recipe.id === type?.defaultRecipeId)
    || type?.recipes?.[0]
    || null;
}

function sourceKey(kind, sourceId) {
  return `${kind}:${String(sourceId || '')}`;
}

function productionDescriptor(player, group, provinceId) {
  if (!group?.enabled || normalizeProvinceId(group.provinceId) !== provinceId) return null;
  const type = FACILITY_TYPES.get(String(group.facilityTypeId || ''));
  const recipe = activeRecipe(type, group);
  const policy = factoryAutoOperationPolicyFor(player, provinceId, group.facilityTypeId);
  const count = group.status === 'running'
    ? nonNegativeInteger(group.participatingCount)
    : nonNegativeInteger(group.productionAvailableCount ?? group.count);
  if (!type || !recipe || !policy.enabled || count < 1) return null;
  return {
    key: sourceKey('production', type.id),
    kind: 'production',
    sourceId: type.id,
    sourceLabel: type.name,
    provinceId,
    count,
    type,
    recipe,
    coverageCycles: policy.inputCoverageCycles,
    operatingCost: Number(recipe.operatingCost || 0) * count,
    inputs: (recipe.inputs || []).map((input) => ({
      productId: String(input.productId || ''),
      quantity: nonNegativeInteger(input.quantity) * count,
    })).filter((input) => input.productId && input.quantity > 0),
  };
}

function commercialDescriptor(group, provinceId) {
  if (!group?.enabled || normalizeProvinceId(group.provinceId) !== provinceId) return null;
  const type = COMMERCIAL_TYPES.get(String(group.commercialTypeId || ''));
  const policy = commercialAutoOperationPolicyFor(group);
  const count = nonNegativeInteger(group.count);
  if (!type || !policy.enabled || count < 1) return null;
  return {
    key: sourceKey('commercial', type.id),
    kind: 'commercial',
    sourceId: type.id,
    sourceLabel: type.name,
    provinceId,
    count,
    type,
    coverageCycles: policy.inputCoverageCycles,
    operatingCost: Number(type.operatingCost || 0) * count,
    inputs: type.consumptionInputs.map((input) => ({
      productId: String(input.productId || ''),
      quantity: nonNegativeInteger(input.quantity) * count,
    })).filter((input) => input.productId && input.quantity > 0),
  };
}

function descriptorsForProvince(player, provinceId) {
  return [
    ...(player.facilityGroups || []).map((group) => productionDescriptor(player, group, provinceId)),
    ...(player.commercialBuildingGroups || []).map((group) => commercialDescriptor(group, provinceId)),
  ].filter(Boolean);
}

function freezeSpec(descriptor, productId) {
  return {
    kind: descriptor.kind,
    provinceId: descriptor.provinceId,
    productId,
    sourceId: descriptor.sourceId,
    sourceLabel: descriptor.sourceLabel,
  };
}

function targetFor(descriptor, input) {
  return input.quantity * Math.max(1, nonNegativeInteger(descriptor.coverageCycles));
}

function reconcileDescriptorFromAvailable(player, descriptor) {
  const wanted = new Set(descriptor.inputs.map((input) => input.productId));
  for (const source of [...ensureInventoryFreezeSources(player)]) {
    if (
      source.kind === descriptor.kind
      && source.provinceId === descriptor.provinceId
      && source.sourceId === descriptor.sourceId
      && !wanted.has(source.productId)
    ) setInventoryFreezeTarget(player, source, 0);
  }
  for (const input of descriptor.inputs) {
    setInventoryFreezeTarget(player, freezeSpec(descriptor, input.productId), targetFor(descriptor, input));
  }
}

function releaseInactiveBuildingFreezes(player, provinceId, descriptors) {
  const active = new Set(descriptors.map((descriptor) => descriptor.key));
  const seen = new Set();
  for (const source of [...ensureInventoryFreezeSources(player)]) {
    if (source.provinceId !== provinceId) continue;
    const key = sourceKey(source.kind, source.sourceId);
    if (active.has(key) || seen.has(key)) continue;
    seen.add(key);
    releaseInventoryFreezeSource(player, {
      kind: source.kind,
      provinceId,
      sourceId: source.sourceId,
    });
  }
}

function descriptorProfitable(world, descriptor, now) {
  if (descriptor.kind === 'commercial') {
    return evaluateCommercialCycleProfit(descriptor.type, descriptor.count).profitable;
  }
  return evaluateProductionCycleProfit(
    descriptor.recipe,
    descriptor.count,
    (productId) => commoditySystemPriceFor(world, productId, descriptor.provinceId, now),
  ).profitable;
}

function missingLines(player, descriptor) {
  return descriptor.inputs.map((input) => {
    const spec = freezeSpec(descriptor, input.productId);
    return {
      ...input,
      spec,
      target: targetFor(descriptor, input),
      current: sourceFrozenQuantity(player, spec),
    };
  }).map((line) => ({ ...line, missing: Math.max(0, line.target - line.current) }))
    .filter((line) => line.missing > 0);
}

function purchaseMissingFreeze(world, player, userId, descriptor, now) {
  const lines = missingLines(player, descriptor);
  if (lines.length < 1) return true;
  let purchaseCost = 0;
  for (const line of lines) {
    const price = commoditySystemPriceFor(world, line.productId, descriptor.provinceId, now);
    const lineCost = multiplyMoneyByInteger(price, line.missing);
    if (lineCost === null) return false;
    purchaseCost += lineCost;
  }
  const requiredCash = roundInternalMoney(purchaseCost + Math.max(0, Number(descriptor.operatingCost || 0)));
  if (requiredCash === null || Number(player.credits || 0) < requiredCash) return false;

  for (const line of lines) {
    const result = applySettledCommodityOrder(world, { id: Number(userId) }, {
      assetKind: 'commodity',
      assetId: line.productId,
      productId: line.productId,
      provinceId: descriptor.provinceId,
      side: 'buy',
      quantity: line.missing,
      execution: 'cycle-auto-operation',
    }, now);
    if (!result?.ok) return false;
    setInventoryFreezeTarget(player, line.spec, line.target);
  }
  return true;
}

function sellAllAvailable(world, player, userId, provinceId, now) {
  let sold = 0;
  for (const product of PRODUCT_CATALOG) {
    const inventory = inventoryForProvince(player, product.id, provinceId);
    const quantity = nonNegativeInteger(inventory.available);
    if (quantity < 1) continue;
    const result = applySettledCommodityOrder(world, { id: Number(userId) }, {
      assetKind: 'commodity',
      assetId: product.id,
      productId: product.id,
      provinceId,
      side: 'sell',
      quantity,
      execution: 'cycle-auto-operation',
    }, now);
    if (result?.ok) sold += quantity;
  }
  return sold;
}

export function reconcileProvinceBuildingFreezes(world, userId, provinceId) {
  const player = world.players?.[String(userId)];
  if (!player) return [];
  const selectedProvinceId = normalizeProvinceId(provinceId);
  const descriptors = descriptorsForProvince(player, selectedProvinceId);
  releaseInactiveBuildingFreezes(player, selectedProvinceId, descriptors);
  for (const descriptor of descriptors) reconcileDescriptorFromAvailable(player, descriptor);
  return descriptors;
}

export function runCycleAutoOperation(world, userId, provinceId, completedSources = [], now = Date.now()) {
  const player = world.players?.[String(userId)];
  if (!player) return { purchased: false, sold: 0 };
  const selectedProvinceId = normalizeProvinceId(provinceId);
  const descriptors = reconcileProvinceBuildingFreezes(world, userId, selectedProvinceId);
  const completed = new Set(completedSources.map((source) => sourceKey(source.kind, source.sourceId)));
  const eligible = descriptors.filter((descriptor) => completed.has(descriptor.key) && descriptorProfitable(world, descriptor, now));
  if (eligible.length < 1) return { purchased: false, sold: 0 };

  let purchased = false;
  for (const descriptor of eligible) {
    purchased = purchaseMissingFreeze(world, player, userId, descriptor, now) || purchased;
  }
  const sold = sellAllAvailable(world, player, userId, selectedProvinceId, now);
  return { purchased, sold };
}
