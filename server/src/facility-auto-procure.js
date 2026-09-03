import {
  applyImmediateCommodityBuy,
  commoditySystemPriceFor,
  FACILITY_TYPE_CATALOG,
  PRODUCT_CATALOG,
} from './domain.js';
import {
  internalMoneyToMicros,
  microsToInternalMoney,
  multiplyMoneyByInteger,
  normalizePlayerMoneyInput,
} from './money.js';
import {
  inventoryForProvince,
  normalizeProvinceId,
  PROVINCE_CATALOG,
  readInventoryForProvince,
} from './provinces.js';
import { provinceUnlockError } from './province-access.js';

const FACILITY_TYPES = new Map(FACILITY_TYPE_CATALOG.map((type) => [type.id, type]));
const PRODUCTS = new Map(PRODUCT_CATALOG.map((product) => [product.id, product]));

function result(ok, message, extra = {}) {
  return { ok, message, ...extra };
}

function normalizePositiveInteger(value, max = Number.MAX_SAFE_INTEGER) {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  const normalized = Math.floor(number);
  return Number.isSafeInteger(normalized) && normalized >= 1 && normalized <= max ? normalized : null;
}

function facilityBuildContext(world, user, payload = {}, { readOnly = false } = {}) {
  const userId = Number(user.id);
  const player = world.players?.[String(userId)];
  const type = FACILITY_TYPES.get(String(payload.facilityTypeId || ''));
  if (!player) return { error: result(false, '玩家状态不存在') };
  if (!type) return { error: result(false, '工厂类型不存在') };
  const quantity = normalizePositiveInteger(payload.quantity ?? 1, 100);
  const provinceId = normalizeProvinceId(payload.provinceId);
  if (!quantity) return { error: result(false, '建造数量必须为 1 到 100 的整数') };
  if (!Array.isArray(type.buildInputs)) return { error: result(false, '工厂建造材料目录无效') };

  const missing = [];
  let missingQuantity = 0;
  for (const item of type.buildInputs) {
    const required = Number(item.quantity) * quantity;
    if (!Number.isSafeInteger(required) || required < 1) {
      return { error: result(false, '建造材料数量超出系统可表示范围') };
    }
    const productId = String(item.productId || '');
    const inventory = readOnly
      ? readInventoryForProvince(player, productId, provinceId)
      : inventoryForProvince(player, productId, provinceId);
    const deficit = Math.max(0, required - Number(inventory.available || 0));
    if (deficit <= 0) continue;
    if (!Number.isSafeInteger(deficit) || !Number.isSafeInteger(missingQuantity + deficit)) {
      return { error: result(false, '建造材料数量超出系统可表示范围') };
    }
    missing.push({ productId, quantity: deficit });
    missingQuantity += deficit;
  }

  return { userId, player, type, quantity, provinceId, missing, missingQuantity };
}

function invalidQuoteRequest(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function quoteMissingAtDailyPrice(world, missing, provinceId, now) {
  let totalMicros = 0n;
  const materialPriceCaps = {};
  const materialOrderPrices = {};
  for (const item of missing) {
    const price = commoditySystemPriceFor(world, item.productId, provinceId, now);
    const lineTotal = multiplyMoneyByInteger(price, item.quantity);
    const lineMicros = internalMoneyToMicros(lineTotal);
    if (lineTotal === null || lineMicros === null) return null;
    materialPriceCaps[item.productId] = price;
    materialOrderPrices[item.productId] = price;
    totalMicros += lineMicros;
  }
  const estimatedTotal = microsToInternalMoney(totalMicros);
  if (estimatedTotal === null) return null;
  return { totalMicros, estimatedTotal, materialPriceCaps, materialOrderPrices };
}

export function createFacilityBuildProcurementQuote(world, user, payload = {}, now = Date.now()) {
  const requestedProvinceId = String(payload.provinceId || '');
  if (!PROVINCE_CATALOG.some((province) => province.id === requestedProvinceId)) {
    throw invalidQuoteRequest('建造地区不存在', 404);
  }
  const context = facilityBuildContext(world, user, payload, { readOnly: true });
  if (context.error) {
    const missingPlayer = context.error.message === '玩家状态不存在';
    throw invalidQuoteRequest(context.error.message, missingPlayer ? 404 : 400);
  }
  const { player, provinceId, missing, missingQuantity } = context;
  const accessError = provinceUnlockError(player, provinceId);
  if (accessError) throw invalidQuoteRequest(accessError, 403);
  const quote = quoteMissingAtDailyPrice(world, missing, provinceId, now);
  if (!quote) throw invalidQuoteRequest('建造材料系统价超出系统可表示范围');
  return {
    complete: true,
    estimatedTotal: quote.estimatedTotal,
    missingQuantity,
    materialPriceCaps: quote.materialPriceCaps,
    materialOrderPrices: quote.materialOrderPrices,
    unavailableProductIds: [],
    selfCrossingProductIds: [],
  };
}

function validateProtectedQuote(world, missing, provinceId, now, priceCaps) {
  let totalMicros = 0n;
  const plans = [];
  for (const item of missing) {
    const product = PRODUCTS.get(item.productId);
    const cap = normalizePlayerMoneyInput(priceCaps?.[item.productId], { min: 0.01 });
    if (typeof cap !== 'number') {
      return { error: result(false, `${product?.name || item.productId}采购价格保护无效，请刷新后重试`) };
    }
    const price = commoditySystemPriceFor(world, item.productId, provinceId, now);
    if (price > cap) {
      return { error: result(false, `${product?.name || item.productId}今日系统价已变化，请重新确认`) };
    }
    const lineTotal = multiplyMoneyByInteger(price, item.quantity);
    const lineMicros = internalMoneyToMicros(lineTotal);
    if (lineTotal === null || lineMicros === null) {
      return { error: result(false, `${product?.name || item.productId}采购总额超出系统可表示范围`) };
    }
    totalMicros += lineMicros;
    plans.push({ ...item, price, cap });
  }
  return { totalMicros, plans };
}

function ensureBuildAndProcurementFunds(player, type, quantity, procurementMicros) {
  const buildCost = multiplyMoneyByInteger(type.buildCost, quantity);
  const buildCostMicros = internalMoneyToMicros(buildCost);
  const creditsMicros = internalMoneyToMicros(player.credits);
  if (buildCost === null || buildCostMicros === null || creditsMicros === null) {
    return result(false, '建造与采购资金超出系统可表示范围');
  }
  if (creditsMicros < buildCostMicros + procurementMicros) {
    return result(false, '建造与采购总资金不足');
  }
  return null;
}

function executeImmediatePlans(world, user, provinceId, plans, now) {
  for (const plan of plans) {
    const purchase = applyImmediateCommodityBuy(world, user, {
      productId: plan.productId,
      provinceId,
      quantity: plan.quantity,
      price: plan.cap,
    }, now);
    if (!purchase?.ok) return purchase;
  }
  return null;
}

export function autoProcureFacilityBuildMaterials(world, user, payload = {}, now = Date.now()) {
  const context = facilityBuildContext(world, user, payload);
  if (context.error) return context.error;
  const { player, type, quantity, provinceId, missing, missingQuantity } = context;

  if (missing.length === 0) {
    return result(true, '建造材料库存充足，无需市场采购', {
      procurementTotal: 0,
      purchasedQuantity: 0,
    });
  }

  const maxProcurementTotal = normalizePlayerMoneyInput(payload.maxProcurementTotal, { min: 0.01 });
  if (typeof maxProcurementTotal !== 'number') return result(false, '一键采购总价保护无效，请刷新后重试');
  const maxProcurementMicros = internalMoneyToMicros(maxProcurementTotal);
  if (maxProcurementMicros === null) return result(false, '一键采购总价保护无效，请刷新后重试');

  const quoted = validateProtectedQuote(
    world,
    missing,
    provinceId,
    now,
    payload.materialPriceCaps && typeof payload.materialPriceCaps === 'object' ? payload.materialPriceCaps : {},
  );
  if (quoted.error) return quoted.error;
  if (quoted.totalMicros > maxProcurementMicros) {
    return result(false, '今日系统价已变化，预计采购总额超过确认上限，请重新确认');
  }
  const fundingError = ensureBuildAndProcurementFunds(player, type, quantity, quoted.totalMicros);
  if (fundingError) return fundingError;
  const executionError = executeImmediatePlans(world, user, provinceId, quoted.plans, now);
  if (executionError) return result(false, executionError.message || '建造材料即时采购失败');

  const procurementTotal = microsToInternalMoney(quoted.totalMicros);
  if (procurementTotal === null) return result(false, '一键采购总额超出系统可表示范围');
  return result(true, '建造材料已按今日系统价一次购齐', {
    procurementTotal,
    purchasedQuantity: missingQuantity,
  });
}

// Compatibility entry for clients that still call the former "procurement order" action.
// It now performs the same immediate purchase and never creates a resting order.
export function createFacilityBuildProcurementOrders(world, user, payload = {}, now = Date.now()) {
  const context = facilityBuildContext(world, user, payload);
  if (context.error) return context.error;
  const { player, type, quantity, provinceId, missing, missingQuantity } = context;
  if (missing.length === 0) return result(true, '建造材料库存已充足，无需采购');
  const priceCaps = payload.materialOrderPrices && typeof payload.materialOrderPrices === 'object'
    ? payload.materialOrderPrices
    : {};
  const quoted = validateProtectedQuote(world, missing, provinceId, now, priceCaps);
  if (quoted.error) return quoted.error;
  const fundingError = ensureBuildAndProcurementFunds(player, type, quantity, quoted.totalMicros);
  if (fundingError) return fundingError;
  const executionError = executeImmediatePlans(world, user, provinceId, quoted.plans, now);
  if (executionError) return result(false, executionError.message || '建造材料即时采购失败');
  return result(true, `已按今日系统价即时购齐 ${missingQuantity} 件建造材料，请确认库存后建造`);
}

export function cancelFacilityBuildProcurementOrders() {
  return result(true, '建造材料现已即时采购，不存在待取消挂单');
}
