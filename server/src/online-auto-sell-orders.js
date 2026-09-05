import { releaseLegacyOrderFreeze } from './commodity-freezes.js';
import { closeOrderInOrderBook, orderById } from './order-book-runtime.js';
import { isOpenOrder, orderAssetId, orderKind } from './order-identity.js';
import {
  installDefaultProvinceAliases,
  inventoryForProvince,
  normalizeProvinceId,
  provinceScopedKey,
  splitProvinceScopedKey,
  syncDefaultProvinceAlias,
} from './provinces.js';

function linkMap(player, create = false) {
  const source = player?.onlineAutoSellOrderIds;
  if (source && typeof source === 'object' && !Array.isArray(source)) {
    for (const [key, orderId] of Object.entries({ ...source })) {
      if (key.includes(':')) continue;
      source[provinceScopedKey(undefined, key)] = orderId;
      delete source[key];
      syncDefaultProvinceAlias(source, key);
    }
    return installDefaultProvinceAliases(source);
  }
  if (!create || !player) return {};
  player.onlineAutoSellOrderIds = {};
  return installDefaultProvinceAliases(player.onlineAutoSellOrderIds);
}

function validManagedOrder(order, userId, productId, provinceId) {
  return Boolean(
    order
    && Number(order.ownerId) === Number(userId)
    && order.ownerType === 'player'
    && orderKind(order) === 'commodity'
    && orderAssetId(order) === String(productId || '')
    && normalizeProvinceId(order.provinceId) === normalizeProvinceId(provinceId)
    && order.side === 'sell'
    && isOpenOrder(order),
  );
}

export function linkedOnlineAutoSellOrderIds(player) {
  return [...new Set(Object.values(linkMap(player)).map((value) => String(value || '')).filter(Boolean))];
}

export function managedOnlineAutoSellOrderFor(world, userId, productId, provinceId) {
  const player = world.players?.[String(userId)];
  if (!player) return null;
  const links = linkMap(player);
  const linkKey = provinceScopedKey(provinceId, productId);
  const orderId = String(links[linkKey] || '');
  if (!orderId) return null;
  const order = orderById(world, orderId);
  if (validManagedOrder(order, userId, productId, provinceId)) return order;
  delete links[linkKey];
  syncDefaultProvinceAlias(links, productId);
  return null;
}

export function linkManagedOnlineAutoSellOrder(player, productId, orderId, provinceId) {
  if (!player) return;
  const links = linkMap(player, true);
  links[provinceScopedKey(provinceId, productId)] = String(orderId || '');
  syncDefaultProvinceAlias(links, productId);
}

export function cancelManagedOnlineAutoSellOrder(world, userId, productId, provinceId) {
  const player = world.players?.[String(userId)];
  if (!player) return 0;
  const order = managedOnlineAutoSellOrderFor(world, userId, productId, provinceId);
  if (!order) return 0;
  const remaining = Math.max(0, Math.floor(Number(order.remaining || 0)));
  const inventory = inventoryForProvince(player, productId, provinceId);
  const released = releaseLegacyOrderFreeze(inventory, order.id, remaining);
  order.status = 'cancelled';
  closeOrderInOrderBook(world, order);
  const links = linkMap(player);
  delete links[provinceScopedKey(provinceId, productId)];
  syncDefaultProvinceAlias(links, productId);
  return released;
}

export function releaseManagedOnlineAutoSellInventory(world, userId, productId, requiredAvailable, provinceId) {
  const player = world.players?.[String(userId)];
  const inventory = player ? inventoryForProvince(player, productId, provinceId) : null;
  const required = Math.max(0, Math.floor(Number(requiredAvailable || 0)));
  if (!player || !inventory || Number(inventory.available || 0) >= required) return 0;
  return cancelManagedOnlineAutoSellOrder(world, userId, productId, provinceId);
}

export function cancelAllManagedOnlineAutoSellOrders(world, userId) {
  const player = world.players?.[String(userId)];
  if (!player) return 0;
  let released = 0;
  for (const key of Object.keys(linkMap(player))) {
    const { provinceId, assetId: productId } = splitProvinceScopedKey(key);
    released += cancelManagedOnlineAutoSellOrder(world, userId, productId, provinceId);
  }
  return released;
}
