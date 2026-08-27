import { randomUUID } from 'node:crypto';
import { PRODUCT_CATALOG } from './industry-catalog.js';
import { roundInternalMoney } from './money.js';
import { creditPopulationEmployment } from './population-economy.js';
import { inventoryForProvince, normalizeProvinceId } from './provinces.js';
import { isProvinceUnlocked, provinceDistanceKm } from './province-access.js';

export const TRANSPORT_MODES = Object.freeze({
  road: Object.freeze({
    id: 'road',
    name: '公路运输',
    fixedCost: 10,
    unitCostPerKm: 0.0002,
    capacity: 100,
    timeFactor: 1.0,
  }),
  rail: Object.freeze({
    id: 'rail',
    name: '铁路运输',
    fixedCost: 50,
    unitCostPerKm: 0.0001,
    capacity: 2000,
    timeFactor: 2.0,
  }),
  air: Object.freeze({
    id: 'air',
    name: '航空运输',
    fixedCost: 100,
    unitCostPerKm: 0.0006,
    capacity: 500,
    timeFactor: 0.25,
  }),
});
export const TRANSPORT_BASE_SECONDS_PER_KM = 60 / 1000;
export const TRANSPORT_MAX_IN_TRANSIT_PER_PLAYER = 20;
export const TRANSPORT_MAX_ROUTES_PER_PLAYER = 50;
export const TRANSPORT_HISTORY_PER_PLAYER = 30;

const PRODUCT_IDS = new Set(PRODUCT_CATALOG.map((product) => product.id));

export function transportCost(mode, quantity, distanceKm) {
  const normalizedMode = TRANSPORT_MODES[mode];
  if (!normalizedMode) return null;
  const count = Math.max(0, Math.floor(Number(quantity) || 0));
  const distance = Math.max(0, Number(distanceKm) || 0);
  return roundInternalMoney(normalizedMode.fixedCost + normalizedMode.unitCostPerKm * count * distance);
}

export function transportDurationMs(mode, distanceKm) {
  const normalizedMode = TRANSPORT_MODES[mode];
  if (!normalizedMode) return null;
  const distance = Math.max(0, Number(distanceKm) || 0);
  return Math.max(1_000, Math.round(distance * TRANSPORT_BASE_SECONDS_PER_KM * normalizedMode.timeFactor * 1000));
}

function inTransitCountFor(world, playerId) {
  return (world.transportShipments || []).filter((shipment) => (
    Number(shipment.ownerId) === Number(playerId) && shipment.status === 'in-transit'
  )).length;
}

function normalizedRouteInput(player, payload = {}) {
  const sourceProvinceId = normalizeProvinceId(payload.sourceProvinceId);
  const destinationProvinceId = normalizeProvinceId(payload.destinationProvinceId);
  const productId = PRODUCT_IDS.has(String(payload.productId || '')) ? String(payload.productId) : null;
  const mode = TRANSPORT_MODES[payload.mode] ? String(payload.mode) : null;
  const quantity = Math.floor(Number(payload.quantity));
  if (!productId || !mode) return { ok: false, message: '运输路线参数无效' };
  if (sourceProvinceId === destinationProvinceId) return { ok: false, message: '起止州不能相同' };
  if (!isProvinceUnlocked(player, sourceProvinceId)) return { ok: false, message: '起始州尚未解锁' };
  if (!isProvinceUnlocked(player, destinationProvinceId)) return { ok: false, message: '目的州尚未解锁' };
  if (!Number.isSafeInteger(quantity) || quantity <= 0) {
    return { ok: false, message: '运输数量必须是不低于 1 的整数' };
  }
  if (quantity > TRANSPORT_MODES[mode].capacity) {
    return { ok: false, message: `${TRANSPORT_MODES[mode].name}单次最多运输 ${TRANSPORT_MODES[mode].capacity} 个` };
  }
  return {
    ok: true,
    route: {
      sourceProvinceId,
      destinationProvinceId,
      productId,
      quantity,
      mode,
    },
  };
}

function playerTransportRoutes(player) {
  return Array.isArray(player?.transportRoutes) ? player.transportRoutes : [];
}

function findPlayerRoute(player, routeId) {
  const id = String(routeId || '');
  return playerTransportRoutes(player).find((route) => String(route?.id || '') === id) || null;
}

export function applyCreateTransportRoute(world, user, payload = {}, now = Date.now()) {
  const player = world.players?.[String(user.id)];
  if (!player) return { ok: false, message: '玩家状态无效' };
  const routes = playerTransportRoutes(player);
  if (routes.length >= TRANSPORT_MAX_ROUTES_PER_PLAYER) {
    return { ok: false, message: `运输路线不能超过 ${TRANSPORT_MAX_ROUTES_PER_PLAYER} 条` };
  }
  const normalized = normalizedRouteInput(player, payload);
  if (!normalized.ok) return normalized;
  player.transportRoutes = [...routes, {
    id: `transport-route-${randomUUID()}`,
    ...normalized.route,
    createdAt: now,
    updatedAt: now,
  }];
  return { ok: true, message: '运输路线已创建' };
}

export function applyUpdateTransportRoute(world, user, payload = {}, now = Date.now()) {
  const player = world.players?.[String(user.id)];
  if (!player) return { ok: false, message: '玩家状态无效' };
  const route = findPlayerRoute(player, payload.routeId);
  if (!route) return { ok: false, message: '运输路线不存在' };
  const normalized = normalizedRouteInput(player, payload);
  if (!normalized.ok) return normalized;
  Object.assign(route, normalized.route, { updatedAt: now });
  return { ok: true, message: '运输路线已更新' };
}

export function applyDeleteTransportRoute(world, user, payload = {}) {
  const player = world.players?.[String(user.id)];
  if (!player) return { ok: false, message: '玩家状态无效' };
  const routes = playerTransportRoutes(player);
  const routeId = String(payload.routeId || '');
  const index = routes.findIndex((route) => String(route?.id || '') === routeId);
  if (index < 0) return { ok: false, message: '运输路线不存在' };
  player.transportRoutes = routes.filter((_, routeIndex) => routeIndex !== index);
  return { ok: true, message: '运输路线已删除' };
}

function applyTransportShipment(world, user, payload = {}, now = Date.now(), { routeId = null } = {}) {
  const player = world.players?.[String(user.id)];
  if (!player) return { ok: false, message: '玩家状态无效' };
  const sourceProvinceId = normalizeProvinceId(payload.sourceProvinceId);
  const destinationProvinceId = normalizeProvinceId(payload.destinationProvinceId);
  const productId = PRODUCT_IDS.has(String(payload.productId || '')) ? String(payload.productId) : null;
  const mode = TRANSPORT_MODES[payload.mode] ? String(payload.mode) : null;
  const quantity = Math.floor(Number(payload.quantity));
  if (!productId || !mode) return { ok: false, message: '运输参数无效' };
  if (sourceProvinceId === destinationProvinceId) return { ok: false, message: '起止州不能相同' };
  if (!isProvinceUnlocked(player, sourceProvinceId)) return { ok: false, message: '起始州尚未解锁' };
  if (!isProvinceUnlocked(player, destinationProvinceId)) return { ok: false, message: '目的州尚未解锁' };
  if (!Number.isSafeInteger(quantity) || quantity <= 0) return { ok: false, message: '运输数量必须是不低于 1 的整数' };
  if (quantity > TRANSPORT_MODES[mode].capacity) {
    return { ok: false, message: `${TRANSPORT_MODES[mode].name}单次最多运输 ${TRANSPORT_MODES[mode].capacity} 个` };
  }
  if (inTransitCountFor(world, user.id) >= TRANSPORT_MAX_IN_TRANSIT_PER_PLAYER) {
    return { ok: false, message: `同时在途运输不能超过 ${TRANSPORT_MAX_IN_TRANSIT_PER_PLAYER} 笔` };
  }
  const distanceKm = provinceDistanceKm(sourceProvinceId, destinationProvinceId);
  const cost = transportCost(mode, quantity, distanceKm);
  if (cost === null || Number(player.credits || 0) < cost) {
    return { ok: false, message: '运输资金不足' };
  }
  const inventory = inventoryForProvince(player, productId, sourceProvinceId);
  if (Number(inventory.available || 0) < quantity) return { ok: false, message: '起始州可用库存不足' };
  const product = PRODUCT_CATALOG.find((entry) => entry.id === productId);
  const arrivesAt = now + transportDurationMs(mode, distanceKm);
  player.credits = roundInternalMoney(player.credits - cost) || 0;
  creditPopulationEmployment(world, cost, 'transportService');
  inventory.available = Math.max(0, Number(inventory.available || 0) - quantity);
  inventory.inTransit = Math.max(0, Number(inventory.inTransit || 0)) + quantity;
  world.transportShipments ||= [];
  world.transportShipments.push({
    id: `transport-${randomUUID()}`,
    ownerId: Number(user.id),
    ...(routeId ? { routeId } : {}),
    sourceProvinceId,
    destinationProvinceId,
    productId,
    quantity,
    mode,
    cost,
    departsAt: now,
    arrivesAt,
    status: 'in-transit',
    createdAt: now,
  });
  return {
    ok: true,
    message: `已通过${TRANSPORT_MODES[mode].name}发运 ${quantity} 个${product?.name || productId}，预计 ${Math.ceil((arrivesAt - now) / 1000)} 秒后到达${destinationProvinceId}`,
  };
}

export function applyDispatchTransportRoute(world, user, payload = {}, now = Date.now()) {
  const player = world.players?.[String(user.id)];
  if (!player) return { ok: false, message: '玩家状态无效' };
  const route = findPlayerRoute(player, payload.routeId);
  if (!route) return { ok: false, message: '运输路线不存在' };
  return applyTransportShipment(world, user, route, now, { routeId: route.id });
}

export function applyTransportShip(world, user, payload = {}, now = Date.now()) {
  if (payload.operation === 'route-create') return applyCreateTransportRoute(world, user, payload, now);
  if (payload.operation === 'route-update') return applyUpdateTransportRoute(world, user, payload, now);
  if (payload.operation === 'route-delete') return applyDeleteTransportRoute(world, user, payload);
  if (payload.operation === 'route-dispatch') return applyDispatchTransportRoute(world, user, payload, now);
  return applyTransportShipment(world, user, payload, now);
}

export function processTransportWorld(world, now = Date.now()) {
  const shipments = world.transportShipments || (world.transportShipments = []);
  let processed = 0;
  for (const shipment of shipments) {
    if (shipment.status !== 'in-transit' || Number(shipment.arrivesAt || 0) > now) continue;
    const player = world.players?.[String(shipment.ownerId)];
    if (player) {
      const source = inventoryForProvince(player, shipment.productId, shipment.sourceProvinceId);
      const destination = inventoryForProvince(player, shipment.productId, shipment.destinationProvinceId);
      source.inTransit = Math.max(0, Number(source.inTransit || 0) - shipment.quantity);
      destination.available = Math.max(0, Number(destination.available || 0)) + shipment.quantity;
    }
    shipment.status = 'arrived';
    shipment.arrivedAt = now;
    processed += 1;
  }
  const kept = new Map();
  const next = [];
  for (const shipment of shipments) {
    if (shipment.status === 'in-transit') {
      next.push(shipment);
      continue;
    }
    const ownerKey = String(shipment.ownerId);
    const ownerHistory = kept.get(ownerKey) || [];
    ownerHistory.push(shipment);
    kept.set(ownerKey, ownerHistory);
  }
  for (const ownerHistory of kept.values()) {
    ownerHistory.sort((left, right) => Number(right.createdAt || 0) - Number(left.createdAt || 0));
    next.push(...ownerHistory.slice(0, TRANSPORT_HISTORY_PER_PLAYER));
  }
  world.transportShipments = next;
  return processed;
}

export function nextTransportDeadline(world) {
  let deadline = null;
  for (const shipment of world.transportShipments || []) {
    if (shipment.status !== 'in-transit') continue;
    const arrivesAt = Number(shipment.arrivesAt || 0);
    if (Number.isFinite(arrivesAt) && (deadline === null || arrivesAt < deadline)) deadline = arrivesAt;
  }
  return deadline;
}

export function transportRouteClientState(world, userId) {
  const player = world.players?.[String(userId)];
  const routes = Array.isArray(player?.transportRoutes) ? player.transportRoutes : [];
  return routes.map((route) => ({
    id: String(route.id || ''),
    sourceProvinceId: normalizeProvinceId(route.sourceProvinceId),
    destinationProvinceId: normalizeProvinceId(route.destinationProvinceId),
    productId: String(route.productId || ''),
    quantity: Math.max(0, Math.floor(Number(route.quantity) || 0)),
    mode: String(route.mode || ''),
    createdAt: Number(route.createdAt || 0),
    updatedAt: Number(route.updatedAt || route.createdAt || 0),
  })).filter((route) => (
    route.id
    && route.sourceProvinceId !== route.destinationProvinceId
    && PRODUCT_IDS.has(route.productId)
    && Boolean(TRANSPORT_MODES[route.mode])
    && Number.isSafeInteger(route.quantity)
    && route.quantity >= 1
    && route.quantity <= TRANSPORT_MODES[route.mode].capacity
  ));
}

export function transportShipmentClientState(world, userId) {
  const own = (world.transportShipments || []).filter((shipment) => (
    Number(shipment.ownerId) === Number(userId)
  ));
  return own.map((shipment) => ({
    id: shipment.id,
    ...(shipment.routeId ? { routeId: shipment.routeId } : {}),
    sourceProvinceId: shipment.sourceProvinceId,
    destinationProvinceId: shipment.destinationProvinceId,
    productId: shipment.productId,
    quantity: shipment.quantity,
    mode: shipment.mode,
    cost: shipment.cost,
    departsAt: shipment.departsAt,
    arrivesAt: shipment.arrivesAt,
    status: shipment.status,
    createdAt: shipment.createdAt,
    arrivedAt: shipment.arrivedAt,
  }));
}
