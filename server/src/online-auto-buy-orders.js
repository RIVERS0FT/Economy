import { cancelSettledCommodityOrder } from './domain.js';
import { isOpenOrder, orderAssetId, orderKind } from './order-identity.js';
import { orderById } from './order-book-runtime.js';
import { installDefaultProvinceAliases, normalizeProvinceId, provinceScopedKey, splitProvinceScopedKey } from './provinces.js';

function linkMap(player, create = false) {
  const source = player?.onlineAutoBuyOrderIds;
  if (source && typeof source === 'object' && !Array.isArray(source)) {
    for (const [key, orderId] of Object.entries({ ...source })) {
      if (key.includes(':')) continue;
      source[provinceScopedKey(undefined, key)] = orderId;
      delete source[key];
    }
    return installDefaultProvinceAliases(source);
  }
  if (!create || !player) return {};
  player.onlineAutoBuyOrderIds = {};
  return installDefaultProvinceAliases(player.onlineAutoBuyOrderIds);
}

function validManagedOrder(order, userId, productId, provinceId) {
  return Boolean(
    order
    && Number(order.ownerId) === Number(userId)
    && order.ownerType === 'player'
    && orderKind(order) === 'commodity'
    && orderAssetId(order) === String(productId || '')
    && normalizeProvinceId(order.provinceId) === normalizeProvinceId(provinceId)
    && order.side === 'buy'
    && isOpenOrder(order),
  );
}

export function linkedOnlineAutoBuyOrderIds(player) {
  return [...new Set(Object.values(linkMap(player)).map((value) => String(value || '')).filter(Boolean))];
}

export function managedOnlineAutoBuyOrderFor(world, userId, productId, provinceId) {
  const player = world.players?.[String(userId)];
  if (!player) return null;
  const links = linkMap(player);
  const linkKey = provinceScopedKey(provinceId, productId);
  const orderId = String(links[linkKey] || '');
  if (!orderId) return null;
  const order = orderById(world, orderId);
  if (validManagedOrder(order, userId, productId, provinceId)) return order;
  delete links[linkKey];
  return null;
}

export function linkManagedOnlineAutoBuyOrder(player, productId, orderId, provinceId) {
  if (!player) return;
  const links = linkMap(player, true);
  links[provinceScopedKey(provinceId, productId)] = String(orderId || '');
  installDefaultProvinceAliases(links);
}

export function cancelManagedOnlineAutoBuyOrder(world, userId, productId, provinceId) {
  const player = world.players?.[String(userId)];
  if (!player) return 0;
  const order = managedOnlineAutoBuyOrderFor(world, userId, productId, provinceId);
  if (!order) return 0;
  const beforeFrozen = Math.max(0, Number(player.frozenCredits || 0));
  const cancelled = cancelSettledCommodityOrder(world, { id: Number(userId) }, order.id);
  delete linkMap(player)[provinceScopedKey(provinceId, productId)];
  installDefaultProvinceAliases(player.onlineAutoBuyOrderIds);
  if (!cancelled) return 0;
  return Math.max(0, beforeFrozen - Math.max(0, Number(player.frozenCredits || 0)));
}

export function cancelAllManagedOnlineAutoBuyOrders(world, userId) {
  const player = world.players?.[String(userId)];
  if (!player) return 0;
  let released = 0;
  for (const key of Object.keys(linkMap(player))) {
    const { provinceId, assetId: productId } = splitProvinceScopedKey(key);
    released += cancelManagedOnlineAutoBuyOrder(world, userId, productId, provinceId);
  }
  return released;
}
