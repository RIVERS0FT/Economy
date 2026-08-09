import {
  applyImmediateCommodityBuy,
  FACILITY_TYPE_CATALOG,
  PRODUCT_CATALOG,
} from './domain.js';
import { findSelfCrossingOrder, SELF_CROSS_MESSAGE } from './order-book-integrity.js';
import { isOpenOrder, orderAssetId, orderKind } from './order-identity.js';
import {
  internalMoneyToMicros,
  microsToInternalMoney,
  multiplyMoneyByInteger,
  normalizePlayerMoneyInput,
} from './money.js';

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

function inventoryFor(player, productId) {
  player.inventories ||= {};
  player.inventories[productId] ||= { available: 0, frozen: 0 };
  return player.inventories[productId];
}

function externalSellOrders(world, userId, productId) {
  return (world.orders || [])
    .map((order, index) => ({ order, index }))
    .filter(({ order }) => (
      isOpenOrder(order)
      && orderKind(order) === 'commodity'
      && orderAssetId(order) === productId
      && order.side === 'sell'
      && !(order.ownerType === 'player' && Number(order.ownerId) === Number(userId))
    ))
    .sort((left, right) => (
      Number(left.order.price || 0) - Number(right.order.price || 0)
      || Number(left.order.createdAt || 0) - Number(right.order.createdAt || 0)
      || left.index - right.index
    ));
}

function quoteMaterial(world, userId, productId, quantity, priceCap) {
  const orders = externalSellOrders(world, userId, productId);
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

export function autoProcureFacilityBuildMaterials(world, user, payload = {}, now = Date.now()) {
  const userId = Number(user.id);
  const player = world.players?.[String(userId)];
  const type = FACILITY_TYPES.get(String(payload.facilityTypeId || ''));
  if (!player) return result(false, '玩家状态不存在');
  if (!type) return result(false, '工厂类型不存在');
  const quantity = normalizePositiveInteger(payload.quantity ?? 1, 100);
  if (!quantity) return result(false, '建造数量必须为 1 到 100 的整数');
  if (!Array.isArray(type.buildInputs)) return result(false, '工厂建造材料目录无效');

  const missing = [];
  let missingQuantity = 0;
  for (const item of type.buildInputs) {
    const required = Number(item.quantity) * quantity;
    if (!Number.isSafeInteger(required) || required < 1) return result(false, '建造材料数量超出系统可表示范围');
    const productId = String(item.productId || '');
    const deficit = Math.max(0, required - Number(inventoryFor(player, productId).available || 0));
    if (deficit <= 0) continue;
    if (!Number.isSafeInteger(deficit) || !Number.isSafeInteger(missingQuantity + deficit)) {
      return result(false, '建造材料数量超出系统可表示范围');
    }
    missing.push({ productId, quantity: deficit });
    missingQuantity += deficit;
  }

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
      side: 'buy',
      price: priceCap,
    })) return result(false, SELF_CROSS_MESSAGE);

    const quote = quoteMaterial(world, userId, item.productId, item.quantity, priceCap);
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
