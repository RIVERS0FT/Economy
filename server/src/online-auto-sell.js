import {
  PRODUCT_CATALOG,
  applySettledCommodityOrder,
} from './domain.js';
import { factoryAutoTradeExecutionPolicyFor } from './factory-auto-operation.js';
import {
  productionReservedQuantitiesForPlayer,
} from './facility-groups.js';
import { isOpenOrder, orderAssetId, orderKind } from './order-identity.js';
import {
  cancelManagedOnlineAutoSellOrder,
  linkManagedOnlineAutoSellOrder,
  managedOnlineAutoSellOrderFor,
} from './online-auto-sell-orders.js';
import { contractAvailableHoldForOnlineTrade } from './online-auto-trade-reservations.js';
import { inventoryForProvince, normalizeProvinceId } from './provinces.js';

const PRODUCT_BY_ID = new Map(PRODUCT_CATALOG.map((product) => [product.id, product]));

function positiveInteger(value) {
  const normalized = Math.floor(Number(value));
  return Number.isSafeInteger(normalized) && normalized > 0 ? normalized : 0;
}

export const contractAvailableHoldForAutoSell = contractAvailableHoldForOnlineTrade;

function hasOwnCrossingBuy(world, userId, productId, minimumPrice, provinceId) {
  return (world.orders || []).some((order) => (
    orderKind(order) === 'commodity'
    && orderAssetId(order) === productId
    && normalizeProvinceId(order.provinceId) === normalizeProvinceId(provinceId)
    && order.side === 'buy'
    && isOpenOrder(order)
    && Number(order.ownerId) === Number(userId)
    && Number(order.price || 0) >= minimumPrice
  ));
}

function standingTarget(world, player, productId, policy, managedOrder, provinceId) {
  const inventory = inventoryForProvince(player, productId, provinceId);
  const managedRemaining = managedOrder ? positiveInteger(managedOrder.remaining) : 0;
  const productionReserved = positiveInteger(
    productionReservedQuantitiesForPlayer(world, player.userId, provinceId)[productId],
  );
  const contractHold = positiveInteger(contractAvailableHoldForOnlineTrade(world, player.userId, productId, provinceId));
  const totalManageable = Math.min(
    Number.MAX_SAFE_INTEGER,
    positiveInteger(inventory.available) + managedRemaining,
  );
  return Math.max(
    0,
    totalManageable - productionReserved - contractHold - positiveInteger(policy.minimumFreeInventory),
  );
}

function newManagedOrder(world, userId, productId, previousOrderIds, provinceId) {
  return [...(world.orders || [])].reverse().find((candidate) => (
    !previousOrderIds.has(String(candidate.id))
    && Number(candidate.ownerId) === Number(userId)
    && orderKind(candidate) === 'commodity'
    && orderAssetId(candidate) === productId
    && normalizeProvinceId(candidate.provinceId) === normalizeProvinceId(provinceId)
    && candidate.side === 'sell'
  )) || null;
}

export function applyOnlineAutoSell(world, user, payload = {}, now = Date.now()) {
  const userId = Number(user.id);
  const productId = String(payload.productId || payload.assetId || '');
  const provinceId = normalizeProvinceId(payload.provinceId);
  const product = PRODUCT_BY_ID.get(productId);
  if (!product) return { ok: false, message: '自动出售商品不存在' };

  const player = world.players?.[String(userId)];
  if (!player) return { ok: false, message: '玩家不存在' };
  const policy = factoryAutoTradeExecutionPolicyFor(player, productId, provinceId)?.sell;
  if (!policy?.enabled) {
    cancelManagedOnlineAutoSellOrder(world, userId, productId, provinceId);
    return { ok: false, message: '当前工厂策略无需自动出售该商品' };
  }
  const minimumPrice = policy.price;

  let managedOrder = managedOnlineAutoSellOrderFor(world, userId, productId, provinceId);
  if (hasOwnCrossingBuy(world, userId, productId, minimumPrice, provinceId)) {
    if (managedOrder) cancelManagedOnlineAutoSellOrder(world, userId, productId, provinceId);
    return { ok: false, message: '自己的买单达到自动出售价格，请先撤销反向订单' };
  }

  const target = standingTarget(world, player, productId, policy, managedOrder, provinceId);
  if (
    managedOrder
    && Number(managedOrder.price || 0) === minimumPrice
    && positiveInteger(managedOrder.remaining) === target
  ) {
    return {
      ok: true,
      message: `已维持 ${target} 个${product.name}的自动卖单，最低价 ${minimumPrice.toFixed(2)}`,
    };
  }

  if (managedOrder) {
    cancelManagedOnlineAutoSellOrder(world, userId, productId, provinceId);
    managedOrder = null;
  }
  if (target < 1) {
    return {
      ok: true,
      message: '当前没有扣除生产预定、合同预定和最低自由库存后的可自动挂单库存',
    };
  }

  const previousOrderIds = new Set((world.orders || []).map((order) => String(order.id)));
  const placed = applySettledCommodityOrder(world, user, {
    assetKind: 'commodity',
    assetId: productId,
    productId,
    provinceId,
    side: 'sell',
    quantity: target,
    price: minimumPrice,
    execution: 'online-auto-sell',
  }, now);
  if (!placed?.ok) return placed;

  const order = newManagedOrder(world, userId, productId, previousOrderIds, provinceId);
  if (!order) return { ok: false, message: '自动卖单创建失败' };
  const filled = Math.max(0, positiveInteger(order.quantity) - positiveInteger(order.remaining));
  const remaining = isOpenOrder(order) ? positiveInteger(order.remaining) : 0;
  if (remaining > 0) linkManagedOnlineAutoSellOrder(player, productId, order.id, provinceId);

  if (filled > 0 && remaining > 0) {
    return {
      ok: true,
      message: `已按不低于 ${minimumPrice.toFixed(2)} 的价格自动出售 ${filled} 个${product.name}，另有 ${remaining} 个继续挂单供应`,
    };
  }
  if (filled > 0) {
    return {
      ok: true,
      message: `已按不低于 ${minimumPrice.toFixed(2)} 的价格自动出售 ${filled} 个${product.name}`,
    };
  }
  return {
    ok: true,
    message: `已挂出 ${remaining} 个${product.name}的自动卖单，最低价 ${minimumPrice.toFixed(2)}`,
  };
}
