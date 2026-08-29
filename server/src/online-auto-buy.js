import {
  PRODUCT_CATALOG,
  applySettledCommodityOrder,
} from './domain.js';
import { factoryAutoTradeExecutionPolicyFor } from './factory-auto-operation.js';
import { productionReservedQuantitiesForPlayer } from './facility-groups.js';
import { internalMoneyToMicros, multiplyMoneyByInteger } from './money.js';
import { isOpenOrder, orderAssetId, orderKind } from './order-identity.js';
import {
  cancelManagedOnlineAutoBuyOrder,
  linkManagedOnlineAutoBuyOrder,
  managedOnlineAutoBuyOrderFor,
} from './online-auto-buy-orders.js';
import { contractAvailableHoldForOnlineTrade } from './online-auto-trade-reservations.js';
import { inventoryForProvince, normalizeProvinceId } from './provinces.js';

const PRODUCT_BY_ID = new Map(PRODUCT_CATALOG.map((product) => [product.id, product]));

function positiveInteger(value) {
  const normalized = Math.floor(Number(value));
  return Number.isSafeInteger(normalized) && normalized > 0 ? normalized : 0;
}

function hasOwnCrossingSell(world, userId, productId, maximumPrice, provinceId) {
  return (world.orders || []).some((order) => (
    orderKind(order) === 'commodity'
    && orderAssetId(order) === productId
    && normalizeProvinceId(order.provinceId) === normalizeProvinceId(provinceId)
    && order.side === 'sell'
    && isOpenOrder(order)
    && Number(order.ownerId) === Number(userId)
    && Number(order.price || 0) <= maximumPrice
  ));
}

function desiredQuantity(world, player, productId, policy, provinceId) {
  const inventory = inventoryForProvince(player, productId, provinceId);
  const productionReserved = positiveInteger(
    productionReservedQuantitiesForPlayer(world, player.userId, provinceId)[productId],
  );
  const contractHold = positiveInteger(
    contractAvailableHoldForOnlineTrade(world, player.userId, productId, provinceId),
  );
  const requiredAvailable = Math.min(
    Number.MAX_SAFE_INTEGER,
    productionReserved + contractHold + positiveInteger(policy.targetFreeInventory),
  );
  return Math.max(0, requiredAvailable - positiveInteger(inventory.available));
}

function affordableQuantity(player, maximumPrice, managedOrder, desired) {
  const priceMicros = internalMoneyToMicros(maximumPrice);
  const creditsMicros = internalMoneyToMicros(Math.max(0, Number(player.credits || 0)));
  if (priceMicros === null || creditsMicros === null || priceMicros <= 0n) return 0;

  let reusableMicros = 0n;
  if (managedOrder && isOpenOrder(managedOrder)) {
    const reusable = multiplyMoneyByInteger(
      Number(managedOrder.price || 0),
      positiveInteger(managedOrder.remaining),
    );
    reusableMicros = reusable === null ? 0n : (internalMoneyToMicros(reusable) ?? 0n);
  }

  const affordable = (creditsMicros + reusableMicros) / priceMicros;
  const capped = affordable > BigInt(Number.MAX_SAFE_INTEGER)
    ? Number.MAX_SAFE_INTEGER
    : Number(affordable);
  return Math.min(desired, Math.max(0, capped));
}

function newManagedOrder(world, userId, productId, previousOrderIds, provinceId) {
  return [...(world.orders || [])].reverse().find((candidate) => (
    !previousOrderIds.has(String(candidate.id))
    && Number(candidate.ownerId) === Number(userId)
    && orderKind(candidate) === 'commodity'
    && orderAssetId(candidate) === productId
    && normalizeProvinceId(candidate.provinceId) === normalizeProvinceId(provinceId)
    && candidate.side === 'buy'
  )) || null;
}

export function applyOnlineAutoBuy(world, user, payload = {}, now = Date.now()) {
  const userId = Number(user.id);
  const productId = String(payload.productId || payload.assetId || '');
  const provinceId = normalizeProvinceId(payload.provinceId);
  const product = PRODUCT_BY_ID.get(productId);
  if (!product) return { ok: false, message: '自动采购商品不存在' };

  const player = world.players?.[String(userId)];
  if (!player) return { ok: false, message: '玩家不存在' };
  let managedOrder = managedOnlineAutoBuyOrderFor(world, userId, productId, provinceId);
  const policy = factoryAutoTradeExecutionPolicyFor(player, productId, provinceId)?.buy;
  if (!policy?.enabled) {
    if (managedOrder) {
      cancelManagedOnlineAutoBuyOrder(world, userId, productId, provinceId);
      return { ok: true, message: '当前工厂策略无需采购，已撤销旧托管买单' };
    }
    return { ok: false, message: '当前工厂策略无需自动采购该商品' };
  }
  const maximumPrice = policy.maxPrice;

  if (hasOwnCrossingSell(world, userId, productId, maximumPrice, provinceId)) {
    if (managedOrder) {
      cancelManagedOnlineAutoBuyOrder(world, userId, productId, provinceId);
      return { ok: true, message: '自己的卖单达到采购价格，已撤销托管买单' };
    }
    return { ok: false, message: '自己的卖单达到自动采购价格，请先撤销反向订单' };
  }

  const desired = desiredQuantity(world, player, productId, policy, provinceId);
  const target = affordableQuantity(player, maximumPrice, managedOrder, desired);
  if (
    managedOrder
    && Number(managedOrder.price || 0) === maximumPrice
    && positiveInteger(managedOrder.remaining) === target
  ) {
    return {
      ok: true,
      message: target < desired
        ? `已维持 ${target} 个${product.name}的自动买单，当前受可用资金限制`
        : `已维持 ${target} 个${product.name}的自动买单，最高价 ${maximumPrice.toFixed(2)}`,
    };
  }

  if (managedOrder) {
    cancelManagedOnlineAutoBuyOrder(world, userId, productId, provinceId);
    managedOrder = null;
  }
  if (desired < 1) {
    return { ok: true, message: '当前库存已达到自动采购目标' };
  }

  const refreshedTarget = affordableQuantity(player, maximumPrice, null, desired);
  if (refreshedTarget < 1) {
    return { ok: true, message: '当前可用资金不足，未创建自动采购买单' };
  }

  const previousOrderIds = new Set((world.orders || []).map((order) => String(order.id)));
  const placed = applySettledCommodityOrder(world, user, {
    assetKind: 'commodity',
    assetId: productId,
    productId,
    provinceId,
    side: 'buy',
    quantity: refreshedTarget,
    price: maximumPrice,
    execution: 'online-auto-buy',
  }, now);
  if (!placed?.ok) return placed;

  const order = newManagedOrder(world, userId, productId, previousOrderIds, provinceId);
  if (!order) return { ok: false, message: '自动采购买单创建失败' };
  const filled = Math.max(0, positiveInteger(order.quantity) - positiveInteger(order.remaining));
  const remaining = isOpenOrder(order) ? positiveInteger(order.remaining) : 0;
  if (remaining > 0) linkManagedOnlineAutoBuyOrder(player, productId, order.id, provinceId);

  const fundingNote = refreshedTarget < desired ? '，当前采购数量受可用资金限制' : '';
  if (filled > 0 && remaining > 0) {
    return {
      ok: true,
      message: `已按不高于 ${maximumPrice.toFixed(2)} 的价格自动采购 ${filled} 个${product.name}，另有 ${remaining} 个继续挂单${fundingNote}`,
    };
  }
  if (filled > 0) {
    return {
      ok: true,
      message: `已按不高于 ${maximumPrice.toFixed(2)} 的价格自动采购 ${filled} 个${product.name}${fundingNote}`,
    };
  }
  return {
    ok: true,
    message: `已挂出 ${remaining} 个${product.name}的自动买单，最高价 ${maximumPrice.toFixed(2)}${fundingNote}`,
  };
}
