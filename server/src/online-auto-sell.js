import {
  PRODUCT_CATALOG,
  applySettledCommodityOrder,
  cancelSettledCommodityOrder,
} from './domain.js';
import {
  productionReservedQuantitiesForPlayer,
} from './facility-groups.js';
import { isOpenOrder, orderAssetId, orderKind } from './order-identity.js';
import { normalizePlayerMoneyInput } from './money.js';

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
    && positiveInteger(contract?.completedDeliveries) < positiveInteger(contract?.totalDeliveries)
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

function qualifyingBuyOrders(world, userId, productId, minimumPrice) {
  return (world.orders || []).filter((order) => (
    orderKind(order) === 'commodity'
    && orderAssetId(order) === productId
    && order.side === 'buy'
    && isOpenOrder(order)
    && positiveInteger(order.remaining) > 0
    && Number(order.price || 0) >= minimumPrice
    && Number(order.ownerId) !== Number(userId)
  ));
}

export function crossingBuyQuantityForAutoSell(world, userId, productId, minimumPrice) {
  let total = 0;
  for (const order of qualifyingBuyOrders(world, userId, productId, minimumPrice)) {
    total = Math.min(Number.MAX_SAFE_INTEGER, total + positiveInteger(order.remaining));
  }
  return total;
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

export function applyOnlineAutoSell(world, user, payload = {}, now = Date.now()) {
  const userId = Number(user.id);
  const productId = String(payload.productId || payload.assetId || '');
  const product = PRODUCT_BY_ID.get(productId);
  const minimumPrice = normalizePlayerMoneyInput(payload.price, { min: 0.01 });
  if (!product || minimumPrice === null) return { ok: false, message: '自动出售参数无效' };

  const player = world.players?.[String(userId)];
  if (!player) return { ok: false, message: '玩家不存在' };
  if (hasOwnCrossingBuy(world, userId, productId, minimumPrice)) {
    return { ok: false, message: '自己的买单达到自动出售价格，请先撤销反向订单' };
  }

  const inventory = player.inventories?.[productId] || { available: 0, frozen: 0 };
  const productionReserved = positiveInteger(
    productionReservedQuantitiesForPlayer(world, userId)[productId],
  );
  const contractHold = positiveInteger(contractAvailableHoldForAutoSell(world, userId, productId));
  const eligible = Math.max(0, positiveInteger(inventory.available) - productionReserved - contractHold);
  if (eligible < 1) return { ok: false, message: '当前没有扣除生产预定和合同预定后的可自动出售库存' };

  const crossingQuantity = crossingBuyQuantityForAutoSell(world, userId, productId, minimumPrice);
  const quantity = Math.min(eligible, crossingQuantity);
  if (quantity < 1) return { ok: false, message: '当前没有达到自动出售最低价的买单' };

  const existingOrderIds = new Set((world.orders || []).map((order) => String(order.id)));
  const placed = applySettledCommodityOrder(world, user, {
    assetKind: 'commodity',
    assetId: productId,
    productId,
    side: 'sell',
    quantity,
    price: minimumPrice,
    execution: 'online-auto-sell',
  }, now);
  if (!placed?.ok) return placed;

  const order = [...(world.orders || [])].reverse().find((candidate) => (
    !existingOrderIds.has(String(candidate.id))
    && Number(candidate.ownerId) === userId
    && orderKind(candidate) === 'commodity'
    && orderAssetId(candidate) === productId
    && candidate.side === 'sell'
  ));
  const filled = order
    ? Math.max(0, positiveInteger(order.quantity) - positiveInteger(order.remaining))
    : 0;

  if (order && isOpenOrder(order)) {
    cancelSettledCommodityOrder(world, user, order.id);
  }
  if (filled < 1) return { ok: false, message: '买盘已变化，本次没有发生自动出售' };
  return {
    ok: true,
    message: `已按不低于 ${minimumPrice.toFixed(2)} 的价格自动出售 ${filled} 个${product.name}`,
  };
}
