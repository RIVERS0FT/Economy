import {
  PRODUCT_CATALOG,
  applySettledCommodityOrder,
} from './domain.js';
import { productionReservedQuantitiesForPlayer } from './facility-groups.js';
import { internalMoneyToMicros, multiplyMoneyByInteger } from './money.js';
import { isOpenOrder, orderAssetId, orderKind } from './order-identity.js';
import {
  cancelManagedOnlineAutoBuyOrder,
  linkManagedOnlineAutoBuyOrder,
  managedOnlineAutoBuyOrderFor,
} from './online-auto-buy-orders.js';
import { onlineAutoBuyPolicyFor } from './online-auto-buy-policy.js';
import { contractAvailableHoldForOnlineTrade } from './online-auto-trade-reservations.js';

const PRODUCT_BY_ID = new Map(PRODUCT_CATALOG.map((product) => [product.id, product]));

function positiveInteger(value) {
  const normalized = Math.floor(Number(value));
  return Number.isSafeInteger(normalized) && normalized > 0 ? normalized : 0;
}

function hasOwnCrossingSell(world, userId, productId, maximumPrice) {
  return (world.orders || []).some((order) => (
    orderKind(order) === 'commodity'
    && orderAssetId(order) === productId
    && order.side === 'sell'
    && isOpenOrder(order)
    && Number(order.ownerId) === Number(userId)
    && Number(order.price || 0) <= maximumPrice
  ));
}

function desiredQuantity(world, player, productId, policy) {
  const inventory = player.inventories?.[productId] || { available: 0, frozen: 0 };
  const productionReserved = positiveInteger(
    productionReservedQuantitiesForPlayer(world, player.userId)[productId],
  );
  const contractHold = positiveInteger(
    contractAvailableHoldForOnlineTrade(world, player.userId, productId),
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

function newManagedOrder(world, userId, productId, previousOrderIds) {
  return [...(world.orders || [])].reverse().find((candidate) => (
    !previousOrderIds.has(String(candidate.id))
    && Number(candidate.ownerId) === Number(userId)
    && orderKind(candidate) === 'commodity'
    && orderAssetId(candidate) === productId
    && candidate.side === 'buy'
  )) || null;
}

export function applyOnlineAutoBuy(world, user, payload = {}, now = Date.now()) {
  const userId = Number(user.id);
  const productId = String(payload.productId || payload.assetId || '');
  const product = PRODUCT_BY_ID.get(productId);
  if (!product) return { ok: false, message: '自动采购商品不存在' };

  const player = world.players?.[String(userId)];
  if (!player) return { ok: false, message: '玩家不存在' };
  const policy = onlineAutoBuyPolicyFor(player, productId);
  if (!policy?.enabled) {
    cancelManagedOnlineAutoBuyOrder(world, userId, productId);
    return { ok: false, message: '该商品未启用自动采购' };
  }
  const maximumPrice = policy.maxPrice;

  let managedOrder = managedOnlineAutoBuyOrderFor(world, userId, productId);
  if (hasOwnCrossingSell(world, userId, productId, maximumPrice)) {
    if (managedOrder) cancelManagedOnlineAutoBuyOrder(world, userId, productId);
    return { ok: false, message: '自己的卖单达到自动采购价格，请先撤销反向订单' };
  }

  const desired = desiredQuantity(world, player, productId, policy);
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
    cancelManagedOnlineAutoBuyOrder(world, userId, productId);
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
    side: 'buy',
    quantity: refreshedTarget,
    price: maximumPrice,
    execution: 'online-auto-buy',
  }, now);
  if (!placed?.ok) return placed;

  const order = newManagedOrder(world, userId, productId, previousOrderIds);
  if (!order) return { ok: false, message: '自动采购买单创建失败' };
  const filled = Math.max(0, positiveInteger(order.quantity) - positiveInteger(order.remaining));
  const remaining = isOpenOrder(order) ? positiveInteger(order.remaining) : 0;
  if (remaining > 0) linkManagedOnlineAutoBuyOrder(player, productId, order.id);

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
