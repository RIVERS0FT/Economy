import { cancelSettledCommodityOrder } from './domain.js';
import { isOpenOrder, orderAssetId, orderKind } from './order-identity.js';
import { orderById } from './order-book-runtime.js';

function linkMap(player, create = false) {
  const source = player?.onlineAutoBuyOrderIds;
  if (source && typeof source === 'object' && !Array.isArray(source)) return source;
  if (!create || !player) return {};
  player.onlineAutoBuyOrderIds = {};
  return player.onlineAutoBuyOrderIds;
}

function validManagedOrder(order, userId, productId) {
  return Boolean(
    order
    && Number(order.ownerId) === Number(userId)
    && order.ownerType === 'player'
    && orderKind(order) === 'commodity'
    && orderAssetId(order) === String(productId || '')
    && order.side === 'buy'
    && isOpenOrder(order),
  );
}

export function linkedOnlineAutoBuyOrderIds(player) {
  return [...new Set(Object.values(linkMap(player)).map((value) => String(value || '')).filter(Boolean))];
}

export function managedOnlineAutoBuyOrderFor(world, userId, productId) {
  const player = world.players?.[String(userId)];
  if (!player) return null;
  const links = linkMap(player);
  const orderId = String(links[String(productId || '')] || '');
  if (!orderId) return null;
  const order = orderById(world, orderId);
  if (validManagedOrder(order, userId, productId)) return order;
  delete links[String(productId || '')];
  return null;
}

export function linkManagedOnlineAutoBuyOrder(player, productId, orderId) {
  if (!player) return;
  const links = linkMap(player, true);
  links[String(productId || '')] = String(orderId || '');
}

export function cancelManagedOnlineAutoBuyOrder(world, userId, productId) {
  const player = world.players?.[String(userId)];
  if (!player) return 0;
  const order = managedOnlineAutoBuyOrderFor(world, userId, productId);
  if (!order) return 0;
  const beforeFrozen = Math.max(0, Number(player.frozenCredits || 0));
  const cancelled = cancelSettledCommodityOrder(world, { id: Number(userId) }, order.id);
  delete linkMap(player)[String(productId || '')];
  if (!cancelled) return 0;
  return Math.max(0, beforeFrozen - Math.max(0, Number(player.frozenCredits || 0)));
}

export function cancelAllManagedOnlineAutoBuyOrders(world, userId) {
  const player = world.players?.[String(userId)];
  if (!player) return 0;
  let released = 0;
  for (const productId of Object.keys(linkMap(player))) {
    released += cancelManagedOnlineAutoBuyOrder(world, userId, productId);
  }
  return released;
}
