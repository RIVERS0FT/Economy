import { randomUUID } from 'node:crypto';
import {
  applyAction,
  applyImmediateCommodityBuy,
  cancelSettledCommodityOrder,
  ECONOMY_CONSTANTS,
  FACILITY_TYPE_CATALOG,
  PRODUCT_CATALOG,
} from './domain.js';
import { findSelfCrossingOrder, SELF_CROSS_MESSAGE } from './order-book-integrity.js';
import { isOpenOrder, orderAssetId, orderKind } from './order-identity.js';
import { countOpenOrdersForOwner, orderById } from './order-book-runtime.js';
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

function inventoryFor(player, productId, provinceId) {
  return inventoryForProvince(player, productId, provinceId);
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
      : inventoryFor(player, productId, provinceId);
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

function externalSellOrders(world, userId, productId, provinceId) {
  return (world.orders || [])
    .map((order, index) => ({ order, index }))
    .filter(({ order }) => (
      isOpenOrder(order)
      && orderKind(order) === 'commodity'
      && orderAssetId(order) === productId
      && normalizeProvinceId(order.provinceId) === normalizeProvinceId(provinceId)
      && order.side === 'sell'
      && !(order.ownerType === 'player' && Number(order.ownerId) === Number(userId))
    ))
    .sort((left, right) => (
      Number(left.order.price || 0) - Number(right.order.price || 0)
      || Number(left.order.createdAt || 0) - Number(right.order.createdAt || 0)
      || left.index - right.index
    ));
}

function matchingCommodityOrders(world, productId, provinceId, side) {
  return (world.orders || [])
    .map((order, index) => ({ order, index }))
    .filter(({ order }) => (
      isOpenOrder(order)
      && orderKind(order) === 'commodity'
      && orderAssetId(order) === productId
      && normalizeProvinceId(order.provinceId) === normalizeProvinceId(provinceId)
      && order.side === side
      && Math.max(0, Math.floor(Number(order.remaining || 0))) > 0
      && typeof normalizePlayerMoneyInput(order.price, { min: 0.01 }) === 'number'
    ))
    .sort((left, right) => (
      (side === 'sell'
        ? Number(left.order.price || 0) - Number(right.order.price || 0)
        : Number(right.order.price || 0) - Number(left.order.price || 0))
      || Number(left.order.createdAt || 0) - Number(right.order.createdAt || 0)
      || left.index - right.index
    ));
}

function defaultFacilityBuildOrderPrice(world, productId, provinceId) {
  const bestAsk = matchingCommodityOrders(world, productId, provinceId, 'sell')[0]?.order?.price;
  const normalizedAsk = normalizePlayerMoneyInput(bestAsk, { min: 0.01 });
  if (typeof normalizedAsk === 'number') return normalizedAsk;
  const bestBid = matchingCommodityOrders(world, productId, provinceId, 'buy')[0]?.order?.price;
  const normalizedBid = normalizePlayerMoneyInput(bestBid, { min: 0.01 });
  return typeof normalizedBid === 'number' ? normalizedBid : 1;
}

function quoteMaterial(world, userId, productId, quantity, priceCap, provinceId) {
  const orders = externalSellOrders(world, userId, productId, provinceId);
  const allAvailable = orders.reduce((sum, { order }) => sum + Math.max(0, Number(order.remaining || 0)), 0);
  const eligible = orders.filter(({ order }) => Number(order.price || 0) <= priceCap);
  const eligibleAvailable = eligible.reduce((sum, { order }) => sum + Math.max(0, Number(order.remaining || 0)), 0);
  if (eligibleAvailable < quantity) {
    return {
      ok: false,
      priceChanged: allAvailable >= quantity,
    };
  }

  let remaining = quantity;
  let totalMicros = 0n;
  const levels = [];
  for (const { order } of eligible) {
    if (remaining <= 0) break;
    const take = Math.min(remaining, Math.max(0, Number(order.remaining || 0)));
    if (!Number.isSafeInteger(take) || take <= 0) continue;
    const price = normalizePlayerMoneyInput(order.price, { min: 0.01 });
    if (typeof price !== 'number') return { ok: false, invalid: true };
    const lineTotal = multiplyMoneyByInteger(price, take);
    const lineMicros = internalMoneyToMicros(lineTotal);
    if (lineTotal === null || lineMicros === null) return { ok: false, invalid: true };
    totalMicros += lineMicros;
    const current = levels[levels.length - 1];
    if (current && current.price === price) current.quantity += take;
    else levels.push({ price, quantity: take });
    remaining -= take;
  }
  if (remaining > 0) return { ok: false, invalid: true };
  return { ok: true, totalMicros, levels };
}

function invalidQuoteRequest(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

export function createFacilityBuildProcurementQuote(world, user, payload = {}, now = Date.now()) {
  void now;
  const requestedProvinceId = String(payload.provinceId || '');
  if (!PROVINCE_CATALOG.some((province) => province.id === requestedProvinceId)) {
    throw invalidQuoteRequest('建造地区不存在', 404);
  }
  const context = facilityBuildContext(world, user, payload, { readOnly: true });
  if (context.error) {
    const missingPlayer = context.error.message === '玩家状态不存在';
    throw invalidQuoteRequest(context.error.message, missingPlayer ? 404 : 400);
  }
  const {
    userId, player, provinceId, missing, missingQuantity,
  } = context;
  const accessError = provinceUnlockError(player, provinceId);
  if (accessError) throw invalidQuoteRequest(accessError, 403);
  let estimatedTotalMicros = 0n;
  const materialPriceCaps = {};
  const materialOrderPrices = {};
  const unavailableProductIds = [];
  const selfCrossingProductIds = [];

  for (const item of missing) {
    materialOrderPrices[item.productId] = defaultFacilityBuildOrderPrice(world, item.productId, provinceId);
    const quote = quoteMaterial(
      world,
      userId,
      item.productId,
      item.quantity,
      Number.MAX_SAFE_INTEGER,
      provinceId,
    );
    if (!quote.ok || quote.levels.length === 0) {
      unavailableProductIds.push(item.productId);
      continue;
    }
    const priceCap = quote.levels[quote.levels.length - 1].price;
    materialPriceCaps[item.productId] = priceCap;
    estimatedTotalMicros += quote.totalMicros;
    if (findSelfCrossingOrder(world, {
      ownerId: userId,
      assetKind: 'commodity',
      assetId: item.productId,
      provinceId,
      side: 'buy',
      price: priceCap,
    })) selfCrossingProductIds.push(item.productId);
  }

  const estimatedTotal = microsToInternalMoney(estimatedTotalMicros);
  const complete = unavailableProductIds.length === 0 && estimatedTotal !== null;
  return {
    complete,
    estimatedTotal: complete ? estimatedTotal : 0,
    missingQuantity,
    materialPriceCaps,
    materialOrderPrices,
    unavailableProductIds,
    selfCrossingProductIds,
  };
}

export function autoProcureFacilityBuildMaterials(world, user, payload = {}, now = Date.now()) {
  const context = facilityBuildContext(world, user, payload);
  if (context.error) return context.error;
  const {
    userId, player, type, quantity, provinceId, missing, missingQuantity,
  } = context;

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
  const materialPriceCaps = payload.materialPriceCaps && typeof payload.materialPriceCaps === 'object'
    ? payload.materialPriceCaps
    : {};

  let expectedProcurementMicros = 0n;
  const plans = [];
  for (const item of missing) {
    const product = PRODUCTS.get(item.productId);
    const priceCap = normalizePlayerMoneyInput(materialPriceCaps[item.productId], { min: 0.01 });
    if (typeof priceCap !== 'number') {
      return result(false, `${product?.name || item.productId}采购价格保护无效，请刷新后重试`);
    }
    if (findSelfCrossingOrder(world, {
      ownerId: userId,
      assetKind: 'commodity',
      assetId: item.productId,
      provinceId,
      side: 'buy',
      price: priceCap,
    })) return result(false, SELF_CROSS_MESSAGE);

    const quote = quoteMaterial(world, userId, item.productId, item.quantity, priceCap, provinceId);
    if (!quote.ok) {
      if (quote.priceChanged) return result(false, `${product?.name || item.productId}市场价格已变化，请重新确认`);
      if (quote.invalid) return result(false, `${product?.name || item.productId}市场报价超出系统可表示范围`);
      return result(false, `${product?.name || item.productId}市场卖盘不足，无法一次购齐`);
    }
    expectedProcurementMicros += quote.totalMicros;
    plans.push({ productId: item.productId, levels: quote.levels });
  }

  if (expectedProcurementMicros > maxProcurementMicros) {
    return result(false, '市场价格已变化，预计采购总额超过确认上限，请重新确认');
  }

  const buildCost = multiplyMoneyByInteger(type.buildCost, quantity);
  const buildCostMicros = internalMoneyToMicros(buildCost);
  const creditsMicros = internalMoneyToMicros(player.credits);
  if (buildCost === null || buildCostMicros === null || creditsMicros === null) {
    return result(false, '建造与采购资金超出系统可表示范围');
  }
  if (creditsMicros < buildCostMicros + expectedProcurementMicros) {
    return result(false, '建造与采购总资金不足');
  }

  for (const plan of plans) {
    for (const level of plan.levels) {
      const purchase = applyImmediateCommodityBuy(world, user, {
        productId: plan.productId,
        provinceId,
        quantity: level.quantity,
        price: level.price,
      }, now);
      if (!purchase?.ok) return result(false, purchase?.message || '市场卖盘已变化，未能一次购齐');
    }
  }

  const procurementTotal = microsToInternalMoney(expectedProcurementMicros);
  if (procurementTotal === null) return result(false, '一键采购总额超出系统可表示范围');
  return result(true, '建造材料已从统一市场一次购齐', {
    procurementTotal,
    purchasedQuantity: missingQuantity,
  });
}

export function createFacilityBuildProcurementOrders(world, user, payload = {}, now = Date.now()) {
  const context = facilityBuildContext(world, user, payload);
  if (context.error) return context.error;
  const {
    userId, player, type, quantity, provinceId, missing,
  } = context;
  if (missing.length === 0) return result(false, '建造材料库存已充足，无需提交买单');

  const materialOrderPrices = payload.materialOrderPrices && typeof payload.materialOrderPrices === 'object'
    ? payload.materialOrderPrices
    : {};
  const validatedPrices = {};
  for (const item of missing) {
    const product = PRODUCTS.get(item.productId);
    const price = normalizePlayerMoneyInput(materialOrderPrices[item.productId], { min: 0.01 });
    if (typeof price !== 'number') return result(false, `${product?.name || item.productId}买单价格无效`);
    validatedPrices[item.productId] = price;
  }

  let autoCancelledSellOrders = 0;
  for (const item of missing) {
    const price = validatedPrices[item.productId];
    while (true) {
      const crossingOrder = findSelfCrossingOrder(world, {
        ownerId: userId,
        assetKind: 'commodity',
        assetId: item.productId,
        provinceId,
        side: 'buy',
        price,
      });
      if (!crossingOrder) break;
      if (!cancelSettledCommodityOrder(world, user, crossingOrder.id)) {
        return result(false, '交叉卖单自动撤销失败');
      }
      autoCancelledSellOrders += 1;
    }
  }

  const refreshedContext = facilityBuildContext(world, user, payload);
  if (refreshedContext.error) return refreshedContext.error;
  const refreshedMissing = refreshedContext.missing;
  if (refreshedMissing.length === 0) {
    return result(
      true,
      autoCancelledSellOrders > 0
        ? `已自动撤销 ${autoCancelledSellOrders} 张交叉卖单；释放库存后建造材料已充足，无需提交买单`
        : '建造材料库存已充足，无需提交买单',
    );
  }

  const plans = [];
  let orderTotalMicros = 0n;
  for (const item of refreshedMissing) {
    const product = PRODUCTS.get(item.productId);
    const price = validatedPrices[item.productId];
    if (typeof price !== 'number') return result(false, `${product?.name || item.productId}买单价格无效`);
    const total = multiplyMoneyByInteger(price, item.quantity);
    const totalMicros = internalMoneyToMicros(total);
    if (total === null || totalMicros === null) return result(false, `${product?.name || item.productId}买单总额超出系统可表示范围`);
    orderTotalMicros += totalMicros;
    plans.push({ ...item, price });
  }

  const openOrders = countOpenOrdersForOwner(world, userId);
  if (openOrders + plans.length > ECONOMY_CONSTANTS.maxOpenOrders) {
    return result(false, `未完成订单数量不足以提交本次 ${plans.length} 张建造材料买单`);
  }

  const buildCost = multiplyMoneyByInteger(type.buildCost, quantity);
  const buildCostMicros = internalMoneyToMicros(buildCost);
  const creditsMicros = internalMoneyToMicros(player.credits);
  if (buildCost === null || buildCostMicros === null || creditsMicros === null) {
    return result(false, '建造与挂单资金超出系统可表示范围');
  }
  if (creditsMicros < buildCostMicros + orderTotalMicros) {
    return result(false, '建造与缺料买单总资金不足');
  }

  const knownOrderIds = new Set((world.orders || []).map((order) => String(order.id || '')));
  const orderRefs = [];
  for (const plan of plans) {
    const placed = applyAction(world, user, 'placeOrder', {
      assetKind: 'commodity',
      assetId: plan.productId,
      productId: plan.productId,
      provinceId,
      side: 'buy',
      quantity: plan.quantity,
      price: plan.price,
    }, now);
    if (!placed?.ok) return result(false, placed?.message || '建造材料买单提交失败');
    const createdOrder = [...(world.orders || [])].reverse().find((order) => (
      !knownOrderIds.has(String(order.id || ''))
      && Number(order.ownerId) === userId
      && orderKind(order) === 'commodity'
      && orderAssetId(order) === plan.productId
      && normalizeProvinceId(order.provinceId) === provinceId
      && order.side === 'buy'
    ));
    if (!createdOrder) return result(false, '建造材料买单创建后未找到对应订单');
    knownOrderIds.add(String(createdOrder.id));
    orderRefs.push({
      orderId: String(createdOrder.id),
      productId: plan.productId,
      quantity: plan.quantity,
      price: plan.price,
    });
  }

  const remainingQuantity = orderRefs.reduce((sum, reference) => {
    const order = orderById(world, reference.orderId);
    return sum + (isOpenOrder(order) ? Math.max(0, Number(order.remaining || 0)) : 0);
  }, 0);
  const procurementGroup = {
    id: `facility-procurement-${randomUUID()}`,
    provinceId,
    facilityTypeId: type.id,
    quantity,
    createdAt: now,
    orders: orderRefs,
  };
  const autoCancelPrefix = autoCancelledSellOrders > 0
    ? `已自动撤销 ${autoCancelledSellOrders} 张交叉卖单；`
    : '';
  return result(
    true,
    remainingQuantity > 0
      ? `${autoCancelPrefix}已提交 ${orderRefs.length} 张建造材料买单；可成交部分已立即成交，剩余 ${remainingQuantity} 件继续挂在市场`
      : `${autoCancelPrefix}建造材料买单已全部成交，请确认库存后建造`,
    { procurementGroup },
  );
}

export function cancelFacilityBuildProcurementOrders(world, user, payload = {}, now = Date.now()) {
  const userId = Number(user.id);
  const rawIds = Array.isArray(payload.orderIds) ? payload.orderIds : [];
  const orderIds = [...new Set(rawIds.map((value) => String(value || '')).filter(Boolean))];
  if (orderIds.length === 0 || orderIds.length > ECONOMY_CONSTANTS.maxOpenOrders) {
    return result(false, '建造材料买单组无效');
  }

  const knownOrders = [];
  for (const orderId of orderIds) {
    const order = orderById(world, orderId);
    if (!order) continue;
    if (
      Number(order.ownerId) !== userId
      || orderKind(order) !== 'commodity'
      || order.side !== 'buy'
    ) return result(false, '建造材料买单组包含不可取消的订单');
    knownOrders.push(order);
  }
  if (knownOrders.length === 0) return result(false, '建造材料买单已不存在');

  const player = world.players?.[String(userId)];
  const beforeFrozen = Number(player?.frozenCredits || 0);
  let cancelled = 0;
  for (const order of knownOrders) {
    if (!isOpenOrder(order)) continue;
    if (!cancelSettledCommodityOrder(world, user, order.id)) {
      return result(false, '建造材料买单取消失败');
    }
    cancelled += 1;
  }
  const afterFrozen = Number(player?.frozenCredits || 0);
  const released = Math.max(0, beforeFrozen - afterFrozen);
  const releasedText = released > 0 ? `，释放 ${released.toFixed(2)} 资金` : '';
  return result(true, cancelled > 0
    ? `已取消 ${cancelled} 张剩余建造材料买单${releasedText}；已成交材料保留在仓库`
    : '本组建造材料买单已全部成交或取消；已成交材料保留在仓库');
}
