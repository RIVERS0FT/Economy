import { applyImmediateCommodityBuy, FACILITY_TYPE_CATALOG } from './domain.js';
import { isOpenOrder, orderAssetId, orderKind } from './order-identity.js';
import { createProductionSettlementBasis } from './production-settlement.js';
import { normalizeProvinceId, provinceScopedKey, splitProvinceScopedKey } from './provinces.js';
import { dueProductionCycles, productionResourceUsage } from '../../shared/production-settlement.js';
import {
  allocateDailySupplyReservesForSupplier,
  consumeDailySupplyForBuyer,
  processDailySupplyContracts,
  recordDailyProductProduction,
} from './daily-supply-contracts.js';

const FACILITY_TYPES = new Map(FACILITY_TYPE_CATALOG.map((type) => [type.id, type]));

function nonNegativeInteger(value) {
  const normalized = Math.floor(Number(value));
  return Number.isSafeInteger(normalized) && normalized > 0 ? normalized : 0;
}

function activeRecipe(type, recipeId) {
  if (!type) return null;
  return type.recipes?.find((recipe) => recipe.id === recipeId)
    || type.recipes?.find((recipe) => recipe.id === type.defaultRecipeId)
    || type.recipes?.[0]
    || null;
}

function externalSellOrders(world, userId, productId, provinceId) {
  const selectedProvinceId = normalizeProvinceId(provinceId);
  return (world.orders || [])
    .map((order, index) => ({ order, index }))
    .filter(({ order }) => (
      isOpenOrder(order)
      && orderKind(order) === 'commodity'
      && orderAssetId(order) === String(productId)
      && normalizeProvinceId(order.provinceId) === selectedProvinceId
      && order.side === 'sell'
      && Number(order.remaining || 0) > 0
      && !(order.ownerType === 'player' && Number(order.ownerId) === Number(userId))
      && Number(order.price || 0) > 0
    ))
    .sort((left, right) => Number(left.order.price) - Number(right.order.price)
      || Number(left.order.createdAt || 0) - Number(right.order.createdAt || 0)
      || left.index - right.index);
}

function marginalMarketPrice(world, userId, productId, provinceId, quantity) {
  let remaining = Math.max(1, nonNegativeInteger(quantity));
  let price = Number.POSITIVE_INFINITY;
  for (const { order } of externalSellOrders(world, userId, productId, provinceId)) {
    const take = Math.min(remaining, nonNegativeInteger(order.remaining));
    if (take <= 0) continue;
    price = Number(order.price);
    remaining -= take;
    if (remaining <= 0) return price;
  }
  return Number.POSITIVE_INFINITY;
}

function aggregateProductionDemand(world, userId, now) {
  const basis = createProductionSettlementBasis(world, userId, now);
  const demands = new Map();
  const add = (key, quantity) => {
    const amount = nonNegativeInteger(quantity);
    if (amount <= 0) return;
    demands.set(key, Math.min(Number.MAX_SAFE_INTEGER, (demands.get(key) || 0) + amount));
  };

  for (const group of basis.groups || []) {
    if (!group.enabled) continue;
    if (group.status === 'running') {
      const due = dueProductionCycles(group, now);
      if (due <= 0) continue;
      const usage = productionResourceUsage(group, due);
      for (const [key, quantity] of Object.entries(usage.inputs || {})) add(key, Number(quantity));
      continue;
    }
    if (group.status !== 'error') continue;
    const count = nonNegativeInteger(group.productionAvailableCount);
    if (count <= 0) continue;
    for (const input of group.recipe?.inputs || []) add(input.inventoryKey, nonNegativeInteger(input.quantity) * count);
  }
  return demands;
}

function buyMarketShortage(world, userId, productId, provinceId, shortage, now) {
  const amount = nonNegativeInteger(shortage);
  if (amount <= 0) return 0;
  const orders = externalSellOrders(world, userId, productId, provinceId);
  let depth = 0;
  let cap = 0;
  for (const { order } of orders) {
    depth += nonNegativeInteger(order.remaining);
    cap = Number(order.price || cap);
    if (depth >= amount) break;
  }
  if (depth < amount || !(cap > 0)) return 0;
  const purchase = applyImmediateCommodityBuy(world, { id: Number(userId) }, {
    productId,
    provinceId,
    quantity: amount,
    price: cap,
  }, now);
  return purchase?.ok ? amount : 0;
}

export function captureProductionOutputBaseline(world, userId) {
  const player = world.players?.[String(userId)];
  return new Map((player?.facilityGroups || []).map((group) => [
    `${normalizeProvinceId(group.provinceId)}:${String(group.facilityTypeId || '')}`,
    nonNegativeInteger(group.lifetimeOutput),
  ]));
}

export function prepareProductionInputsForPlayer(world, userId, now = Date.now()) {
  const player = world.players?.[String(userId)];
  if (!player) return captureProductionOutputBaseline(world, userId);
  processDailySupplyContracts(world, now);
  const demands = aggregateProductionDemand(world, userId, now);
  for (const [inventoryKey, required] of demands) {
    const { provinceId, assetId: productId } = splitProvinceScopedKey(inventoryKey);
    const marketPrice = marginalMarketPrice(world, userId, productId, provinceId, required);
    consumeDailySupplyForBuyer(world, userId, provinceId, productId, required, marketPrice, now);
    const inventory = player.inventories?.[provinceScopedKey(provinceId, productId)];
    const available = nonNegativeInteger(inventory?.available);
    if (available >= required) continue;
    buyMarketShortage(world, userId, productId, provinceId, required - available, now);
  }
  return captureProductionOutputBaseline(world, userId);
}

export function finalizeProductionOutputContracts(world, userId, baseline, now = Date.now()) {
  const player = world.players?.[String(userId)];
  if (!player || !(baseline instanceof Map)) return 0;
  let produced = 0;
  for (const group of player.facilityGroups || []) {
    const provinceId = normalizeProvinceId(group.provinceId);
    const facilityTypeId = String(group.facilityTypeId || '');
    const key = `${provinceId}:${facilityTypeId}`;
    const before = nonNegativeInteger(baseline.get(key));
    const after = nonNegativeInteger(group.lifetimeOutput);
    const delta = Math.max(0, after - before);
    if (delta <= 0) continue;
    const type = FACILITY_TYPES.get(facilityTypeId);
    const recipe = activeRecipe(type, group.activeRecipeId);
    const productId = String(recipe?.output?.productId || '');
    if (!productId) continue;
    recordDailyProductProduction(player, provinceId, productId, delta, now);
    allocateDailySupplyReservesForSupplier(world, userId, provinceId, productId, now);
    produced += delta;
  }
  return produced;
}
