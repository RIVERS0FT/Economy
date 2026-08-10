import {
  PRODUCT_CATALOG,
  applySettledCommodityOrder,
} from './domain.js';
import {
  productionReservedQuantitiesForPlayer,
} from './facility-groups.js';
import { isOpenOrder, orderAssetId, orderKind } from './order-identity.js';
import {
  cancelManagedOnlineAutoSellOrder,
  linkManagedOnlineAutoSellOrder,
  managedOnlineAutoSellOrderFor,
} from './online-auto-sell-orders.js';
import { onlineAutoSellPolicyFor } from './online-auto-sell-policy.js';

const PRODUCT_BY_ID = new Map(PRODUCT_CATALOG.map((product) => [product.id, product]));

function positiveInteger(value) {
  const normalized = Math.floor(Number(value));
  return Number.isSafeInteger(normalized) && normalized > 0 ? normalized : 0;
}

function activeSupplyContractsFor(world, userId, productId) {
  return (world.productionContracts || []).filter((contract) => (
    contract?.kind === 'supply'
    && contract?.status === 'active'
    && Number(contract?.supplierId) === Number(userId)
    && String(contract?.productId || '') === productId
    && (contract?.totalDeliveries === null
      || positiveInteger(contract?.completedDeliveries) < positiveInteger(contract?.totalDeliveries))
  ));
}

export function contractAvailableHoldForAutoSell(world, userId, productId) {
  let hold = 0;
  for (const contract of activeSupplyContractsFor(world, userId, productId)) {
    if (contract.supplierAutoReserve !== false) {
      const required = positiveInteger(contract.quantityPerDelivery);
      const frozen = Math.min(required, positiveInteger(contract.supplierReservedQuantity));
      hold += Math.max(0, required - frozen);
    }
    const proposal = contract.renewalProposal;
    if (proposal?.status === 'accepted' && contract.supplierAutoReserve !== false) {
      const required = positiveInteger(proposal.terms?.quantityPerDelivery);
      const frozen = Math.min(required, positiveInteger(proposal.supplierReservedQuantity));
      hold += Math.max(0, required - frozen);
    }
  }
  return hold;
}

function hasOwnCrossingBuy(world, userId, productId, minimumPrice) {
  return (world.orders || []).some((order) => (
    orderKind(order) === 'commodity'
    && orderAssetId(order) === productId
    && order.side === 'buy'
    && isOpenOrder(order)
    && Number(order.ownerId) === Number(userId)
    && Number(order.price || 0) >= minimumPrice
  ));
}

function standingTarget(world, player, productId, policy, managedOrder) {
  const inventory = player.inventories?.[productId] || { available: 0, frozen: 0 };
  const managedRemaining = managedOrder ? positiveInteger(managedOrder.remaining) : 0;
  const productionReserved = positiveInteger(
    productionReservedQuantitiesForPlayer(world, player.userId)[productId],
  );
  const contractHold = positiveInteger(contractAvailableHoldForAutoSell(world, player.userId, productId));
  const totalManageable = Math.min(
    Number.MAX_SAFE_INTEGER,
    positiveInteger(inventory.available) + managedRemaining,
  );
  return Math.max(
    0,
    totalManageable - productionReserved - contractHold - positiveInteger(policy.minimumFreeInventory),
  );
}

function newManagedOrder(world, userId, productId, previousOrderIds) {
  return [...(world.orders || [])].reverse().find((candidate) => (
    !previousOrderIds.has(String(candidate.id))
    && Number(candidate.ownerId) === Number(userId)
    && orderKind(candidate) === 'commodity'
    && orderAssetId(candidate) === productId
    && candidate.side === 'sell'
  )) || null;
}

export function applyOnlineAutoSell(world, user, payload = {}, now = Date.now()) {
  const userId = Number(user.id);
  const productId = String(payload.productId || payload.assetId || '');
  const product = PRODUCT_BY_ID.get(productId);
  if (!product) return { ok: false, message: '自动出售商品不存在' };

  const player = world.players?.[String(userId)];
  if (!player) return { ok: false, message: '玩家不存在' };
  const policy = onlineAutoSellPolicyFor(player, productId);
  if (!policy?.enabled) {
    cancelManagedOnlineAutoSellOrder(world, userId, productId);
    return { ok: false, message: '该商品未启用自动出售' };
  }
  const minimumPrice = policy.price;

  let managedOrder = managedOnlineAutoSellOrderFor(world, userId, productId);
  if (hasOwnCrossingBuy(world, userId, productId, minimumPrice)) {
    if (managedOrder) cancelManagedOnlineAutoSellOrder(world, userId, productId);
    return { ok: false, message: '自己的买单达到自动出售价格，请先撤销反向订单' };
  }

  const target = standingTarget(world, player, productId, policy, managedOrder);
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
    cancelManagedOnlineAutoSellOrder(world, userId, productId);
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
    side: 'sell',
    quantity: target,
    price: minimumPrice,
    execution: 'online-auto-sell',
  }, now);
  if (!placed?.ok) return placed;

  const order = newManagedOrder(world, userId, productId, previousOrderIds);
  if (!order) return { ok: false, message: '自动卖单创建失败' };
  const filled = Math.max(0, positiveInteger(order.quantity) - positiveInteger(order.remaining));
  const remaining = isOpenOrder(order) ? positiveInteger(order.remaining) : 0;
  if (remaining > 0) linkManagedOnlineAutoSellOrder(player, productId, order.id);

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
