import { closeOrderInOrderBook, orderById } from './order-book-runtime.js';
import { isOpenOrder, orderAssetId, orderKind } from './order-identity.js';

function linkMap(player, create = false) {
  const source = player?.onlineAutoSellOrderIds;
  if (source && typeof source === 'object' && !Array.isArray(source)) return source;
  if (!create || !player) return {};
  player.onlineAutoSellOrderIds = {};
  return player.onlineAutoSellOrderIds;
}

function validManagedOrder(order, userId, productId) {
  return Boolean(
    order
    && Number(order.ownerId) === Number(userId)
    && order.ownerType === 'player'
    && orderKind(order) === 'commodity'
    && orderAssetId(order) === String(productId || '')
    && order.side === 'sell'
    && isOpenOrder(order),
  );
}

export function linkedOnlineAutoSellOrderIds(player) {
  return [...new Set(Object.values(linkMap(player)).map((value) => String(value || '')).filter(Boolean))];
}

export function managedOnlineAutoSellOrderFor(world, userId, productId) {
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

export function linkManagedOnlineAutoSellOrder(player, productId, orderId) {
  if (!player) return;
  const links = linkMap(player, true);
  links[String(productId || '')] = String(orderId || '');
}

export function cancelManagedOnlineAutoSellOrder(world, userId, productId) {
  const player = world.players?.[String(userId)];
  if (!player) return 0;
  const order = managedOnlineAutoSellOrderFor(world, userId, productId);
  if (!order) return 0;
  const remaining = Math.max(0, Math.floor(Number(order.remaining || 0)));
  player.inventories ||= {};
  const inventory = player.inventories[String(productId || '')] ||= { available: 0, frozen: 0 };
  const released = Math.min(Math.max(0, Math.floor(Number(inventory.frozen || 0))), remaining);
  inventory.frozen = Math.max(0, Math.floor(Number(inventory.frozen || 0)) - released);
  inventory.available = Math.max(0, Math.floor(Number(inventory.available || 0))) + released;
  order.status = 'cancelled';
  closeOrderInOrderBook(world, order);
  delete linkMap(player)[String(productId || '')];
  return released;
}

export function releaseManagedOnlineAutoSellInventory(world, userId, productId, requiredAvailable) {
  const player = world.players?.[String(userId)];
  const inventory = player?.inventories?.[String(productId || '')];
  const required = Math.max(0, Math.floor(Number(requiredAvailable || 0)));
  if (!player || !inventory || Number(inventory.available || 0) >= required) return 0;
  return cancelManagedOnlineAutoSellOrder(world, userId, productId);
}

export function cancelAllManagedOnlineAutoSellOrders(world, userId) {
  const player = world.players?.[String(userId)];
  if (!player) return 0;
  let released = 0;
  for (const productId of Object.keys(linkMap(player))) {
    released += cancelManagedOnlineAutoSellOrder(world, userId, productId);
  }
  return released;
}
