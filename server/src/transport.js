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
export const TRANSPORT_TRIP_TYPES = Object.freeze(['round', 'one-way']);
export const TRANSPORT_DEFAULT_TRIP_TYPE = 'one-way';

const TRANSPORT_TRIP_TYPE_IDS = new Set(TRANSPORT_TRIP_TYPES);

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

function hasActiveShipmentForRoute(world, playerId, routeId) {
  return (world.transportShipments || []).some((shipment) => (
    Number(shipment.ownerId) === Number(playerId)
    && String(shipment.routeId || '') === String(routeId || '')
    && shipment.status === 'in-transit'
  ));
}

export function normalizeTransportStops(payload = {}) {
  const sourceProvinceId = normalizeProvinceId(payload.sourceProvinceId);
  const destinationProvinceId = normalizeProvinceId(payload.destinationProvinceId);
  const rawViaProvinceIds = payload.viaProvinceIds === undefined || payload.viaProvinceIds === null
    ? []
    : payload.viaProvinceIds;
  if (!Array.isArray(rawViaProvinceIds)) return { ok: false, message: '运输路线参数无效' };
  const viaProvinceIds = rawViaIdsOf(rawViaProvinceIds);
  const tripType = payload.tripType === undefined || payload.tripType === null
    ? TRANSPORT_DEFAULT_TRIP_TYPE
    : String(payload.tripType);
  if (!TRANSPORT_TRIP_TYPE_IDS.has(tripType)) return { ok: false, message: '运输路线参数无效' };
  const closed = destinationProvinceId === sourceProvinceId;
  if (closed && viaProvinceIds.length === 0) return { ok: false, message: '起止州不能相同' };
  const seenProvinceIds = new Set([sourceProvinceId]);
  for (const provinceId of viaProvinceIds) {
    if (seenProvinceIds.has(provinceId)) return { ok: false, message: '运输站点不能重复' };
    seenProvinceIds.add(provinceId);
  }
  if (!closed && seenProvinceIds.has(destinationProvinceId)) {
    return { ok: false, message: '运输站点不能重复' };
  }
  return {
    ok: true,
    stops: {
      sourceProvinceId,
      destinationProvinceId,
      viaProvinceIds,
      tripType: closed ? 'one-way' : tripType,
      closed,
    },
  };
}

function rawViaIdsOf(value) {
  return value.map((entry) => normalizeProvinceId(entry));
}

function transportViaProvinceIds(route) {
  return Array.isArray(route?.viaProvinceIds) ? route.viaProvinceIds : [];
}

export function transportRouteStops(route) {
  return [
    normalizeProvinceId(route?.sourceProvinceId),
    ...transportViaProvinceIds(route),
    normalizeProvinceId(route?.destinationProvinceId),
  ];
}

export function transportRouteClosed(route) {
  return normalizeProvinceId(route?.destinationProvinceId) === normalizeProvinceId(route?.sourceProvinceId);
}

export function transportTraversalStops(route) {
  const stops = transportRouteStops(route);
  if (transportRouteClosed(route)) return stops;
  if (route?.tripType === 'round') return [...stops, ...stops.slice(0, -1).reverse()];
  return stops;
}

export function transportDeliveryStops(route) {
  const viaProvinceIds = transportViaProvinceIds(route);
  if (transportRouteClosed(route)) return [...viaProvinceIds];
  return [...viaProvinceIds, normalizeProvinceId(route?.destinationProvinceId)];
}

function validateTransportLoad(route, mode, quantity) {
  const definition = TRANSPORT_MODES[mode];
  if (!definition) return { ok: false, message: '运输方式无效' };
  const deliveryCount = transportDeliveryStops(route).length;
  if (deliveryCount < 1) return { ok: false, message: '运输路线参数无效' };
  const initialLoad = quantity * deliveryCount;
  if (!Number.isSafeInteger(initialLoad) || initialLoad > definition.capacity) {
    const maxPerStop = Math.floor(definition.capacity / deliveryCount);
    return {
      ok: false,
      message: `${definition.name}首段总载荷不能超过 ${definition.capacity} 个；当前 ${deliveryCount} 个交付站，每站最多 ${maxPerStop} 个`,
    };
  }
  return { ok: true, deliveryCount, initialLoad };
}

export function buildTransportPlan(route, mode, quantity, now = Date.now()) {
  const traversalStops = transportTraversalStops(route);
  const deliveryStops = transportDeliveryStops(route);
  const deliveryProvinceIds = new Set(deliveryStops);
  const deliveredProvinceIds = new Set();
  const stopPlan = [];
  const normalizedQuantity = Math.max(0, Math.floor(Number(quantity) || 0));
  const initialLoad = normalizedQuantity * deliveryStops.length;
  let remainingLoad = initialLoad;
  let elapsedMs = 0;
  let cost = 0;
  let distanceKm = 0;
  for (let index = 0; index < traversalStops.length - 1; index += 1) {
    const fromProvinceId = traversalStops[index];
    const toProvinceId = traversalStops[index + 1];
    const legDistanceKm = provinceDistanceKm(fromProvinceId, toProvinceId);
    distanceKm += legDistanceKm;
    elapsedMs += transportDurationMs(mode, legDistanceKm);
    const delivers = deliveryProvinceIds.has(toProvinceId) && !deliveredProvinceIds.has(toProvinceId);
    cost += transportCost(mode, remainingLoad, legDistanceKm);
    if (delivers) {
      deliveredProvinceIds.add(toProvinceId);
      stopPlan.push({
        provinceId: toProvinceId,
        arrivesAt: now + elapsedMs,
        deliveredAt: null,
      });
      remainingLoad = Math.max(0, remainingLoad - normalizedQuantity);
    }
  }
  return {
    stopPlan,
    arrivesAt: now + elapsedMs,
    cost: roundInternalMoney(cost) || 0,
    distanceKm,
    deliveryCount: stopPlan.length,
    initialLoad,
    traversalStops,
  };
}

function normalizedRouteInput(player, payload = {}, { autoDispatchFallback = false } = {}) {
  const stops = normalizeTransportStops(payload);
  if (!stops.ok) return stops;
  const productId = PRODUCT_IDS.has(String(payload.productId || '')) ? String(payload.productId) : null;
  const mode = TRANSPORT_MODES[payload.mode] ? String(payload.mode) : null;
  const quantity = Math.floor(Number(payload.quantity));
  if (!productId || !mode) return { ok: false, message: '运输路线参数无效' };
  if (!isProvinceUnlocked(player, stops.stops.sourceProvinceId)) return { ok: false, message: '起始州尚未解锁' };
  for (const provinceId of stops.stops.viaProvinceIds) {
    if (!isProvinceUnlocked(player, provinceId)) return { ok: false, message: '中间站尚未解锁' };
  }
  if (
    !stops.stops.closed
    && !isProvinceUnlocked(player, stops.stops.destinationProvinceId)
  ) return { ok: false, message: '目的州尚未解锁' };
  if (!Number.isSafeInteger(quantity) || quantity <= 0) {
    return { ok: false, message: '运输数量必须是不低于 1 的整数' };
  }
  const load = validateTransportLoad(stops.stops, mode, quantity);
  if (!load.ok) return load;
  const autoDispatch = payload.autoDispatch === undefined
    ? autoDispatchFallback === true
    : payload.autoDispatch === true;
  return {
    ok: true,
    route: {
      sourceProvinceId: stops.stops.sourceProvinceId,
      destinationProvinceId: stops.stops.destinationProvinceId,
      ...(stops.stops.viaProvinceIds.length > 0 ? { viaProvinceIds: stops.stops.viaProvinceIds } : {}),
      tripType: stops.stops.tripType,
      productId,
      quantity,
      mode,
      autoDispatch,
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
  return { ok: true, message: normalized.route.autoDispatch ? '运输路线已创建，自动发运已开启' : '运输路线已创建' };
}

export function applyUpdateTransportRoute(world, user, payload = {}, now = Date.now()) {
  const player = world.players?.[String(user.id)];
  if (!player) return { ok: false, message: '玩家状态无效' };
  const route = findPlayerRoute(player, payload.routeId);
  if (!route) return { ok: false, message: '运输路线不存在' };
  const normalized = normalizedRouteInput(player, payload, { autoDispatchFallback: route.autoDispatch === true });
  if (!normalized.ok) return normalized;
  Object.assign(route, normalized.route, { updatedAt: now });
  return { ok: true, message: normalized.route.autoDispatch ? '运输路线已更新，自动发运已开启' : '运输路线已更新' };
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
  const stops = normalizeTransportStops(payload);
  if (!stops.ok) return stops;
  const sourceProvinceId = stops.stops.sourceProvinceId;
  const destinationProvinceId = stops.stops.destinationProvinceId;
  const productId = PRODUCT_IDS.has(String(payload.productId || '')) ? String(payload.productId) : null;
  const mode = TRANSPORT_MODES[payload.mode] ? String(payload.mode) : null;
  const quantity = Math.floor(Number(payload.quantity));
  if (!productId || !mode) return { ok: false, message: '运输参数无效' };
  if (!isProvinceUnlocked(player, sourceProvinceId)) return { ok: false, message: '起始州尚未解锁' };
  for (const provinceId of stops.stops.viaProvinceIds) {
    if (!isProvinceUnlocked(player, provinceId)) return { ok: false, message: '中间站尚未解锁' };
  }
  if (!stops.stops.closed && !isProvinceUnlocked(player, destinationProvinceId)) {
    return { ok: false, message: '目的州尚未解锁' };
  }
  if (!Number.isSafeInteger(quantity) || quantity <= 0) return { ok: false, message: '运输数量必须是不低于 1 的整数' };
  const load = validateTransportLoad(stops.stops, mode, quantity);
  if (!load.ok) return load;
  if (inTransitCountFor(world, user.id) >= TRANSPORT_MAX_IN_TRANSIT_PER_PLAYER) {
    return { ok: false, message: `同时在途运输不能超过 ${TRANSPORT_MAX_IN_TRANSIT_PER_PLAYER} 笔` };
  }
  const plan = buildTransportPlan(stops.stops, mode, quantity, now);
  if (plan.deliveryCount < 1) return { ok: false, message: '运输路线参数无效' };
  const cost = plan.cost;
  if (cost === null || Number(player.credits || 0) < cost) {
    return { ok: false, message: '运输资金不足' };
  }
  const shipmentQuantity = plan.initialLoad;
  const inventory = inventoryForProvince(player, productId, sourceProvinceId);
  if (Number(inventory.available || 0) < shipmentQuantity) return { ok: false, message: '起始州可用库存不足' };
  const product = PRODUCT_CATALOG.find((entry) => entry.id === productId);
  const arrivesAt = plan.arrivesAt;
  player.credits = roundInternalMoney(player.credits - cost) || 0;
  creditPopulationEmployment(world, cost, 'transportService');
  inventory.available = Math.max(0, Number(inventory.available || 0) - shipmentQuantity);
  inventory.inTransit = Math.max(0, Number(inventory.inTransit || 0)) + shipmentQuantity;
  world.transportShipments ||= [];
  world.transportShipments.push({
    id: `transport-${randomUUID()}`,
    ownerId: Number(user.id),
    ...(routeId ? { routeId } : {}),
    sourceProvinceId,
    destinationProvinceId,
    ...(stops.stops.viaProvinceIds.length > 0 ? { viaProvinceIds: stops.stops.viaProvinceIds } : {}),
    tripType: stops.stops.tripType,
    stopPlan: plan.stopPlan,
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
    message: `已通过${TRANSPORT_MODES[mode].name}装载 ${shipmentQuantity} 个${product?.name || productId}，按每站 ${quantity} 个发运 ${plan.deliveryCount} 站，预计 ${Math.ceil((arrivesAt - now) / 1000)} 秒后完成整链运输`,
  };
}

export function applyDispatchTransportRoute(world, user, payload = {}, now = Date.now()) {
  const player = world.players?.[String(user.id)];
  if (!player) return { ok: false, message: '玩家状态无效' };
  const route = findPlayerRoute(player, payload.routeId);
  if (!route) return { ok: false, message: '运输路线不存在' };
  if (route.autoDispatch === true && hasActiveShipmentForRoute(world, user.id, route.id)) {
    return { ok: false, message: '自动发运路线已有运输在途' };
  }
  return applyTransportShipment(world, user, route, now, { routeId: route.id });
}

export function applyTransportShip(world, user, payload = {}, now = Date.now()) {
  if (payload.operation === 'route-create') return applyCreateTransportRoute(world, user, payload, now);
  if (payload.operation === 'route-update') return applyUpdateTransportRoute(world, user, payload, now);
  if (payload.operation === 'route-delete') return applyDeleteTransportRoute(world, user, payload);
  if (payload.operation === 'route-dispatch') return applyDispatchTransportRoute(world, user, payload, now);
  return applyTransportShipment(world, user, payload, now);
}

export function processAutomaticTransportRoutes(world, now = Date.now()) {
  let dispatched = 0;
  for (const [playerId, player] of Object.entries(world.players || {})) {
    if (inTransitCountFor(world, playerId) >= TRANSPORT_MAX_IN_TRANSIT_PER_PLAYER) continue;
    for (const route of playerTransportRoutes(player)) {
      if (route?.autoDispatch !== true || !route?.id) continue;
      if (hasActiveShipmentForRoute(world, playerId, route.id)) continue;
      const result = applyTransportShipment(world, { id: Number(playerId) }, route, now, { routeId: route.id });
      if (result.ok) dispatched += 1;
      if (inTransitCountFor(world, playerId) >= TRANSPORT_MAX_IN_TRANSIT_PER_PLAYER) break;
    }
  }
  return dispatched;
}

export function processTransportWorld(world, now = Date.now()) {
  const shipments = world.transportShipments || (world.transportShipments = []);
  let processed = 0;
  for (const shipment of shipments) {
    if (shipment.status !== 'in-transit') continue;
    const hasStopPlan = Array.isArray(shipment.stopPlan) && shipment.stopPlan.length > 0;
    const finalDue = Number(shipment.arrivesAt || 0) <= now;
    if (!finalDue && !hasStopPlan) continue;
    const player = world.players?.[String(shipment.ownerId)];
    const stopPlan = hasStopPlan
      ? shipment.stopPlan
      : [{ provinceId: shipment.destinationProvinceId, arrivesAt: shipment.arrivesAt, deliveredAt: null }];
    let settled = false;
    if (player) {
      for (const stop of stopPlan) {
        if (stop.deliveredAt || Number(stop.arrivesAt || 0) > now) continue;
        const source = inventoryForProvince(player, shipment.productId, shipment.sourceProvinceId);
        const destination = inventoryForProvince(player, shipment.productId, stop.provinceId);
        source.inTransit = Math.max(0, Number(source.inTransit || 0) - shipment.quantity);
        destination.available = Math.max(0, Number(destination.available || 0)) + shipment.quantity;
        stop.deliveredAt = now;
        settled = true;
      }
    }
    if (finalDue) {
      shipment.status = 'arrived';
      shipment.arrivedAt = now;
      settled = true;
    }
    if (settled) processed += 1;
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
  processed += processAutomaticTransportRoutes(world, now);
  return processed;
}

export function nextTransportDeadline(world) {
  let deadline = null;
  for (const shipment of world.transportShipments || []) {
    if (shipment.status !== 'in-transit') continue;
    const arrivesAt = Number(shipment.arrivesAt || 0);
    if (Number.isFinite(arrivesAt) && (deadline === null || arrivesAt < deadline)) deadline = arrivesAt;
    for (const stop of Array.isArray(shipment.stopPlan) ? shipment.stopPlan : []) {
      if (stop.deliveredAt) continue;
      const stopArrivesAt = Number(stop.arrivesAt || 0);
      if (Number.isFinite(stopArrivesAt) && (deadline === null || stopArrivesAt < deadline)) {
        deadline = stopArrivesAt;
      }
    }
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
    ...(Array.isArray(route.viaProvinceIds) && route.viaProvinceIds.length > 0
      ? { viaProvinceIds: route.viaProvinceIds.map((provinceId) => normalizeProvinceId(provinceId)) }
      : {}),
    tripType: route.tripType === 'round' ? 'round' : 'one-way',
    productId: String(route.productId || ''),
    quantity: Math.max(0, Math.floor(Number(route.quantity) || 0)),
    mode: String(route.mode || ''),
    autoDispatch: route.autoDispatch === true,
    createdAt: Number(route.createdAt || 0),
    updatedAt: Number(route.updatedAt || route.createdAt || 0),
  })).filter((route) => (
    route.id
    && (
      route.sourceProvinceId !== route.destinationProvinceId
      || (Array.isArray(route.viaProvinceIds) && route.viaProvinceIds.length > 0)
    )
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
    ...(Array.isArray(shipment.viaProvinceIds) && shipment.viaProvinceIds.length > 0
      ? { viaProvinceIds: shipment.viaProvinceIds }
      : {}),
    tripType: shipment.tripType === 'round' ? 'round' : 'one-way',
    ...(Array.isArray(shipment.stopPlan) && shipment.stopPlan.length > 0
      ? {
          stopPlan: shipment.stopPlan.map((stop) => ({
            provinceId: normalizeProvinceId(stop.provinceId),
            arrivesAt: Number(stop.arrivesAt || 0),
            ...(stop.deliveredAt ? { deliveredAt: Number(stop.deliveredAt) } : {}),
          })),
        }
      : {}),
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
