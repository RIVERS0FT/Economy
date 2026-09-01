import { randomUUID } from 'node:crypto';
import { PRODUCT_CATALOG } from './industry-catalog.js';
import { roundInternalMoney } from './money.js';
import { getOrderBookSummary } from './order-book-runtime.js';
import { creditPopulationEmployment } from './population-economy.js';
import {
  inventoryForProvince,
  normalizeProvinceId,
  PROVINCE_CATALOG,
  provinceScopedKey,
} from './provinces.js';
import { isProvinceUnlocked, provinceDistanceKm } from './province-access.js';

export const TRANSPORT_MODES = Object.freeze({
  road: Object.freeze({ id: 'road', name: '公路运输', fixedCost: 10, unitCostPerKm: 0.0002, capacity: 100, timeFactor: 1.0 }),
  rail: Object.freeze({ id: 'rail', name: '铁路运输', fixedCost: 50, unitCostPerKm: 0.0001, capacity: 2000, timeFactor: 2.0 }),
  air: Object.freeze({ id: 'air', name: '航空运输', fixedCost: 100, unitCostPerKm: 0.0006, capacity: 500, timeFactor: 0.25 }),
});
export const TRANSPORT_BASE_SECONDS_PER_KM = 60 / 1000;
export const TRANSPORT_MAX_IN_TRANSIT_PER_PLAYER = 20;
export const TRANSPORT_MAX_ROUTES_PER_PLAYER = 50;
export const TRANSPORT_HISTORY_PER_PLAYER = 30;
export const TRANSPORT_ROUTE_NAME_MAX_LENGTH = 40;
export const TRANSPORT_TRIP_TYPES = Object.freeze(['round', 'one-way']);
export const TRANSPORT_DEFAULT_TRIP_TYPE = 'one-way';

const TRANSPORT_TRIP_TYPE_IDS = new Set(TRANSPORT_TRIP_TYPES);
const PRODUCT_BY_ID = new Map(PRODUCT_CATALOG.map((product) => [product.id, product]));
const PROVINCE_BY_ID = new Map(PROVINCE_CATALOG.map((province) => [province.id, province]));

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
  const rawViaProvinceIds = payload.viaProvinceIds === undefined || payload.viaProvinceIds === null ? [] : payload.viaProvinceIds;
  if (!Array.isArray(rawViaProvinceIds)) return { ok: false, message: '运输路线参数无效' };
  const viaProvinceIds = rawViaProvinceIds.map((entry) => normalizeProvinceId(entry));
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
  if (!closed && seenProvinceIds.has(destinationProvinceId)) return { ok: false, message: '运输站点不能重复' };
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

function transportViaProvinceIds(route) {
  return Array.isArray(route?.viaProvinceIds) ? route.viaProvinceIds : [];
}

export function transportRouteStops(route) {
  return [normalizeProvinceId(route?.sourceProvinceId), ...transportViaProvinceIds(route), normalizeProvinceId(route?.destinationProvinceId)];
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

function normalizeManifest(manifest) {
  if (!Array.isArray(manifest)) return [];
  return manifest.flatMap((entry) => {
    const productId = String(entry?.productId || '');
    const destinationProvinceId = normalizeProvinceId(entry?.destinationProvinceId);
    const quantity = Math.floor(Number(entry?.quantity));
    if (!PRODUCT_BY_ID.has(productId) || !Number.isSafeInteger(quantity) || quantity <= 0) return [];
    return [{ productId, destinationProvinceId, quantity }];
  });
}

function manifestQuantityAtStop(manifest, provinceId) {
  return manifest.reduce((total, entry) => entry.destinationProvinceId === provinceId ? total + entry.quantity : total, 0);
}

function manifestTotalQuantity(manifest) {
  return manifest.reduce((total, entry) => total + entry.quantity, 0);
}

export function buildTransportPlan(route, mode, rawManifest, now = Date.now()) {
  const definition = TRANSPORT_MODES[mode];
  if (!definition) return null;
  const traversalStops = transportTraversalStops(route);
  const deliveryStops = transportDeliveryStops(route);
  if (traversalStops.length < 2 || deliveryStops.length < 1) return null;
  const manifest = normalizeManifest(rawManifest);
  const initialLoad = manifestTotalQuantity(manifest);
  if (initialLoad < 1 || initialLoad > definition.capacity) return null;
  const deliveryProvinceIds = new Set(deliveryStops);
  const deliveredProvinceIds = new Set();
  const stopPlan = [];
  const legPlan = [];
  let remainingLoad = initialLoad;
  let elapsedMs = 0;
  let cost = 0;
  let distanceKm = 0;
  for (let index = 0; index < traversalStops.length - 1; index += 1) {
    const fromProvinceId = traversalStops[index];
    const toProvinceId = traversalStops[index + 1];
    const legDistanceKm = provinceDistanceKm(fromProvinceId, toProvinceId);
    const legDepartsAt = now + elapsedMs;
    const legDurationMs = transportDurationMs(mode, legDistanceKm);
    elapsedMs += legDurationMs;
    const legArrivesAt = now + elapsedMs;
    distanceKm += legDistanceKm;
    cost += transportCost(mode, remainingLoad, legDistanceKm);
    legPlan.push({ fromProvinceId, toProvinceId, departsAt: legDepartsAt, arrivesAt: legArrivesAt, remainingLoad });
    const delivers = deliveryProvinceIds.has(toProvinceId) && !deliveredProvinceIds.has(toProvinceId);
    if (delivers) {
      deliveredProvinceIds.add(toProvinceId);
      stopPlan.push({ provinceId: toProvinceId, arrivesAt: legArrivesAt, deliveredAt: null });
      remainingLoad = Math.max(0, remainingLoad - manifestQuantityAtStop(manifest, toProvinceId));
    }
  }
  return {
    manifest,
    stopPlan,
    legPlan,
    arrivesAt: now + elapsedMs,
    cost: roundInternalMoney(cost) || 0,
    distanceKm,
    deliveryCount: stopPlan.length,
    initialLoad,
    traversalStops,
  };
}

function playerTransportRoutes(player) {
  return Array.isArray(player?.transportRoutes) ? player.transportRoutes : [];
}

function findPlayerRoute(player, routeId) {
  const id = String(routeId || '');
  return playerTransportRoutes(player).find((route) => String(route?.id || '') === id) || null;
}

export function defaultTransportRouteName(sourceProvinceId, destinationProvinceId) {
  const sourceId = normalizeProvinceId(sourceProvinceId);
  const destinationId = normalizeProvinceId(destinationProvinceId);
  return `${PROVINCE_BY_ID.get(sourceId)?.name || sourceId}-${PROVINCE_BY_ID.get(destinationId)?.name || destinationId}`;
}

function normalizedTransportRouteName(value) {
  const name = String(value || '').trim();
  if (!name || name.length > TRANSPORT_ROUTE_NAME_MAX_LENGTH) return null;
  return name;
}

function normalizedRouteInput(player, payload = {}) {
  const stops = normalizeTransportStops(payload);
  if (!stops.ok) return stops;
  const mode = TRANSPORT_MODES[payload.mode] ? String(payload.mode) : null;
  if (!mode) return { ok: false, message: '运输方式无效' };
  if (!isProvinceUnlocked(player, stops.stops.sourceProvinceId)) return { ok: false, message: '起始州尚未解锁' };
  for (const provinceId of stops.stops.viaProvinceIds) {
    if (!isProvinceUnlocked(player, provinceId)) return { ok: false, message: '中间站尚未解锁' };
  }
  if (!stops.stops.closed && !isProvinceUnlocked(player, stops.stops.destinationProvinceId)) {
    return { ok: false, message: '目的州尚未解锁' };
  }
  return {
    ok: true,
    route: {
      sourceProvinceId: stops.stops.sourceProvinceId,
      destinationProvinceId: stops.stops.destinationProvinceId,
      ...(stops.stops.viaProvinceIds.length > 0 ? { viaProvinceIds: stops.stops.viaProvinceIds } : {}),
      tripType: stops.stops.tripType,
      mode,
    },
  };
}

function marketReferencePrice(world, provinceId, product) {
  const market = world.markets?.[provinceScopedKey(provinceId, product.id)];
  const bestBid = getOrderBookSummary(world, {
    provinceId,
    assetKind: 'commodity',
    assetId: product.id,
    side: 'buy',
  }).bestPrice;
  const candidates = [bestBid, market?.lastTradePrice, market?.officialPrice, market?.lastPrice, product.basePrice];
  const selected = candidates.find((value) => Number.isFinite(Number(value)) && Number(value) > 0);
  return selected === undefined ? 0 : Number(selected);
}

function forwardDistanceByDeliveryStop(route) {
  const stops = transportRouteStops(route);
  const deliveryStopSet = new Set(transportDeliveryStops(route));
  const distances = new Map();
  let distanceKm = 0;
  for (let index = 0; index < stops.length - 1; index += 1) {
    distanceKm += provinceDistanceKm(stops[index], stops[index + 1]);
    if (deliveryStopSet.has(stops[index + 1]) && !distances.has(stops[index + 1])) distances.set(stops[index + 1], distanceKm);
  }
  return distances;
}

function automaticManifestForRoute(world, player, route) {
  const definition = TRANSPORT_MODES[route.mode];
  if (!definition) return null;
  const deliveryDistance = forwardDistanceByDeliveryStop(route);
  if (deliveryDistance.size < 1) return null;
  const candidates = [];
  const availableByProduct = new Map();
  for (const product of PRODUCT_CATALOG) {
    const sourceInventory = inventoryForProvince(player, product.id, route.sourceProvinceId);
    const available = Math.max(0, Math.floor(Number(sourceInventory.available || 0)));
    if (available < 1) continue;
    availableByProduct.set(product.id, available);
    const sourcePrice = marketReferencePrice(world, route.sourceProvinceId, product);
    for (const [destinationProvinceId, distanceKm] of deliveryDistance) {
      const destinationPrice = marketReferencePrice(world, destinationProvinceId, product);
      const unitSpread = destinationPrice - sourcePrice - definition.unitCostPerKm * distanceKm;
      if (!(unitSpread > 0)) continue;
      candidates.push({ productId: product.id, destinationProvinceId, sourcePrice, destinationPrice, unitSpread });
    }
  }
  candidates.sort((left, right) => (
    right.unitSpread - left.unitSpread
    || String(left.productId).localeCompare(String(right.productId))
    || String(left.destinationProvinceId).localeCompare(String(right.destinationProvinceId))
  ));
  const manifest = [];
  let remainingCapacity = definition.capacity;
  for (const candidate of candidates) {
    if (remainingCapacity < 1) break;
    const available = availableByProduct.get(candidate.productId) || 0;
    if (available < 1) continue;
    const quantity = Math.min(available, remainingCapacity);
    manifest.push({
      productId: candidate.productId,
      destinationProvinceId: candidate.destinationProvinceId,
      quantity,
      sourceReferencePrice: candidate.sourcePrice,
      destinationReferencePrice: candidate.destinationPrice,
    });
    availableByProduct.set(candidate.productId, available - quantity);
    remainingCapacity -= quantity;
  }
  return manifest.length > 0 ? manifest : null;
}

function shipmentOpportunitySpread(manifest, cost) {
  const sourceValue = manifest.reduce((total, entry) => total + entry.sourceReferencePrice * entry.quantity, 0);
  const destinationValue = manifest.reduce((total, entry) => total + entry.destinationReferencePrice * entry.quantity, 0);
  return destinationValue - sourceValue - cost;
}

function applyAutomaticTransportShipment(world, playerId, route, now = Date.now()) {
  const player = world.players?.[String(playerId)];
  if (!player || hasActiveShipmentForRoute(world, playerId, route.id)) return false;
  if (inTransitCountFor(world, playerId) >= TRANSPORT_MAX_IN_TRANSIT_PER_PLAYER) return false;
  const manifestWithReferences = automaticManifestForRoute(world, player, route);
  if (!manifestWithReferences) return false;
  const manifest = manifestWithReferences.map(({ productId, destinationProvinceId, quantity }) => ({ productId, destinationProvinceId, quantity }));
  const plan = buildTransportPlan(route, route.mode, manifest, now);
  if (!plan || plan.deliveryCount < 1 || shipmentOpportunitySpread(manifestWithReferences, plan.cost) <= 0) return false;
  if (Number(player.credits || 0) < plan.cost) return false;
  for (const entry of manifest) {
    if (Number(inventoryForProvince(player, entry.productId, route.sourceProvinceId).available || 0) < entry.quantity) return false;
  }
  player.credits = roundInternalMoney(player.credits - plan.cost) || 0;
  creditPopulationEmployment(world, plan.cost, 'transportService');
  for (const entry of manifest) {
    const inventory = inventoryForProvince(player, entry.productId, route.sourceProvinceId);
    inventory.available = Math.max(0, Number(inventory.available || 0) - entry.quantity);
    inventory.inTransit = Math.max(0, Number(inventory.inTransit || 0)) + entry.quantity;
  }
  world.transportShipments ||= [];
  world.transportShipments.push({
    id: `transport-${randomUUID()}`,
    ownerId: Number(playerId),
    routeId: route.id,
    routeName: route.name,
    sourceProvinceId: route.sourceProvinceId,
    destinationProvinceId: route.destinationProvinceId,
    ...(transportViaProvinceIds(route).length > 0 ? { viaProvinceIds: [...transportViaProvinceIds(route)] } : {}),
    tripType: route.tripType ?? TRANSPORT_DEFAULT_TRIP_TYPE,
    stopPlan: plan.stopPlan,
    legPlan: plan.legPlan,
    manifest,
    mode: route.mode,
    cost: plan.cost,
    departsAt: now,
    arrivesAt: plan.arrivesAt,
    status: 'in-transit',
    createdAt: now,
  });
  return true;
}

export function applyCreateTransportRoute(world, user, payload = {}, now = Date.now()) {
  const player = world.players?.[String(user.id)];
  if (!player) return { ok: false, message: '玩家状态无效' };
  const routes = playerTransportRoutes(player);
  if (routes.length >= TRANSPORT_MAX_ROUTES_PER_PLAYER) return { ok: false, message: `运输路线不能超过 ${TRANSPORT_MAX_ROUTES_PER_PLAYER} 条` };
  const normalized = normalizedRouteInput(player, payload);
  if (!normalized.ok) return normalized;
  const route = {
    id: `transport-route-${randomUUID()}`,
    name: defaultTransportRouteName(normalized.route.sourceProvinceId, normalized.route.destinationProvinceId),
    ...normalized.route,
    createdAt: now,
    updatedAt: now,
  };
  player.transportRoutes = [...routes, route];
  const dispatched = applyAutomaticTransportShipment(world, user.id, route, now);
  return { ok: true, message: dispatched ? '运输路线已创建并自动发运' : '运输路线已创建，等待满足发运条件', routeId: route.id };
}

export function applyUpdateTransportRoute(world, user, payload = {}, now = Date.now()) {
  const player = world.players?.[String(user.id)];
  if (!player) return { ok: false, message: '玩家状态无效' };
  const route = findPlayerRoute(player, payload.routeId);
  if (!route) return { ok: false, message: '运输路线不存在' };
  const normalized = normalizedRouteInput(player, payload);
  if (!normalized.ok) return normalized;
  const oldDefaultName = defaultTransportRouteName(route.sourceProvinceId, route.destinationProvinceId);
  const keepsDefaultName = !normalizedTransportRouteName(route.name) || route.name === oldDefaultName;
  Object.assign(route, normalized.route, {
    ...(keepsDefaultName ? { name: defaultTransportRouteName(normalized.route.sourceProvinceId, normalized.route.destinationProvinceId) } : {}),
    updatedAt: now,
  });
  const dispatched = applyAutomaticTransportShipment(world, user.id, route, now);
  return { ok: true, message: dispatched ? '运输路线已更新并自动发运' : '运输路线已更新' };
}

export function applyRenameTransportRoute(world, user, payload = {}, now = Date.now()) {
  const player = world.players?.[String(user.id)];
  if (!player) return { ok: false, message: '玩家状态无效' };
  const route = findPlayerRoute(player, payload.routeId);
  if (!route) return { ok: false, message: '运输路线不存在' };
  const name = normalizedTransportRouteName(payload.name);
  if (!name) return { ok: false, message: `路线名称必须为 1～${TRANSPORT_ROUTE_NAME_MAX_LENGTH} 个字符` };
  route.name = name;
  route.updatedAt = now;
  return { ok: true, message: '路线名称已更新' };
}

export function applyDeleteTransportRoute(world, user, payload = {}) {
  const player = world.players?.[String(user.id)];
  if (!player) return { ok: false, message: '玩家状态无效' };
  const routes = playerTransportRoutes(player);
  const routeId = String(payload.routeId || '');
  const index = routes.findIndex((route) => String(route?.id || '') === routeId);
  if (index < 0) return { ok: false, message: '运输路线不存在' };
  if (hasActiveShipmentForRoute(world, user.id, routeId)) return { ok: false, message: '该路线有运输在途，完成后才能删除' };
  player.transportRoutes = routes.filter((_, routeIndex) => routeIndex !== index);
  return { ok: true, message: '运输路线已删除' };
}

export function applyTransportShip(world, user, payload = {}, now = Date.now()) {
  if (payload.operation === 'route-create') return applyCreateTransportRoute(world, user, payload, now);
  if (payload.operation === 'route-update') return applyUpdateTransportRoute(world, user, payload, now);
  if (payload.operation === 'route-rename') return applyRenameTransportRoute(world, user, payload, now);
  if (payload.operation === 'route-delete') return applyDeleteTransportRoute(world, user, payload);
  return { ok: false, message: '运输仅由已保存路线自动发运' };
}

export function processAutomaticTransportRoutes(world, now = Date.now()) {
  let dispatched = 0;
  for (const [playerId, player] of Object.entries(world.players || {})) {
    if (inTransitCountFor(world, playerId) >= TRANSPORT_MAX_IN_TRANSIT_PER_PLAYER) continue;
    for (const route of playerTransportRoutes(player)) {
      if (inTransitCountFor(world, playerId) >= TRANSPORT_MAX_IN_TRANSIT_PER_PLAYER) break;
      if (hasActiveShipmentForRoute(world, playerId, route.id)) continue;
      if (applyAutomaticTransportShipment(world, playerId, route, now)) dispatched += 1;
    }
  }
  return dispatched;
}

function legacyShipmentManifest(shipment) {
  const productId = String(shipment?.productId || '');
  const quantity = Math.floor(Number(shipment?.quantity));
  if (!PRODUCT_BY_ID.has(productId) || !Number.isSafeInteger(quantity) || quantity <= 0) return [];
  const deliveryProvinceIds = Array.isArray(shipment?.stopPlan) && shipment.stopPlan.length > 0
    ? shipment.stopPlan.map((stop) => normalizeProvinceId(stop?.provinceId))
    : transportDeliveryStops(shipment);
  return deliveryProvinceIds.map((destinationProvinceId) => ({ productId, destinationProvinceId, quantity }));
}

function shipmentManifest(shipment) {
  const current = normalizeManifest(shipment?.manifest);
  return current.length > 0 ? current : legacyShipmentManifest(shipment);
}

function derivedShipmentLegPlan(shipment) {
  if (Array.isArray(shipment?.legPlan) && shipment.legPlan.length > 0) {
    return shipment.legPlan.map((leg) => ({
      fromProvinceId: normalizeProvinceId(leg.fromProvinceId),
      toProvinceId: normalizeProvinceId(leg.toProvinceId),
      departsAt: Number(leg.departsAt || shipment.departsAt || shipment.createdAt || 0),
      arrivesAt: Number(leg.arrivesAt || shipment.arrivesAt || 0),
      remainingLoad: Math.max(0, Math.floor(Number(leg.remainingLoad || 0))),
    }));
  }
  const traversalStops = transportTraversalStops(shipment);
  if (traversalStops.length < 2) return [];
  const manifest = shipmentManifest(shipment);
  let remainingLoad = manifestTotalQuantity(manifest);
  let cursor = Number(shipment.departsAt || shipment.createdAt || 0);
  const result = [];
  for (let index = 0; index < traversalStops.length - 1; index += 1) {
    const fromProvinceId = traversalStops[index];
    const toProvinceId = traversalStops[index + 1];
    const departsAt = cursor;
    cursor += transportDurationMs(shipment.mode, provinceDistanceKm(fromProvinceId, toProvinceId));
    result.push({ fromProvinceId, toProvinceId, departsAt, arrivesAt: cursor, remainingLoad });
    remainingLoad = Math.max(0, remainingLoad - manifestQuantityAtStop(manifest, toProvinceId));
  }
  return result;
}

export function migrateTransportWorld(world) {
  if (!world || typeof world !== 'object') return world;
  for (const player of Object.values(world.players || {})) {
    if (!Array.isArray(player?.transportRoutes)) continue;
    player.transportRoutes = player.transportRoutes.flatMap((route) => {
      if (!route || typeof route !== 'object' || !route.id || !TRANSPORT_MODES[route.mode]) return [];
      const stops = normalizeTransportStops(route);
      if (!stops.ok) return [];
      return [{
        id: String(route.id),
        name: normalizedTransportRouteName(route.name) || defaultTransportRouteName(stops.stops.sourceProvinceId, stops.stops.destinationProvinceId),
        sourceProvinceId: stops.stops.sourceProvinceId,
        destinationProvinceId: stops.stops.destinationProvinceId,
        ...(stops.stops.viaProvinceIds.length > 0 ? { viaProvinceIds: stops.stops.viaProvinceIds } : {}),
        tripType: stops.stops.tripType,
        mode: String(route.mode),
        createdAt: Number(route.createdAt || 0),
        updatedAt: Number(route.updatedAt || route.createdAt || 0),
      }];
    });
  }
  world.transportShipments ||= [];
  for (const shipment of world.transportShipments) {
    if (!shipment || typeof shipment !== 'object') continue;
    const manifest = shipmentManifest(shipment);
    if (manifest.length > 0) shipment.manifest = manifest;
    if (!Array.isArray(shipment.legPlan) || shipment.legPlan.length === 0) shipment.legPlan = derivedShipmentLegPlan(shipment);
    if (!shipment.routeName && shipment.routeId) {
      const route = findPlayerRoute(world.players?.[String(shipment.ownerId)], shipment.routeId);
      if (route?.name) shipment.routeName = route.name;
    }
  }
  return world;
}

export function processTransportWorld(world, now = Date.now()) {
  migrateTransportWorld(world);
  world.transportShipments ||= [];
  for (const shipment of world.transportShipments) {
    if (shipment.status !== 'in-transit') continue;
    const player = world.players?.[String(shipment.ownerId)];
    if (!player) continue;
    const manifest = shipmentManifest(shipment);
    const stopPlan = Array.isArray(shipment.stopPlan) && shipment.stopPlan.length > 0
      ? shipment.stopPlan
      : [{ provinceId: shipment.destinationProvinceId, arrivesAt: shipment.arrivesAt, deliveredAt: null }];
    for (const stop of stopPlan) {
      if (stop.deliveredAt || Number(stop.arrivesAt || 0) > now) continue;
      const destinationProvinceId = normalizeProvinceId(stop.provinceId);
      for (const entry of manifest) {
        if (entry.destinationProvinceId !== destinationProvinceId) continue;
        const source = inventoryForProvince(player, entry.productId, shipment.sourceProvinceId);
        const destination = inventoryForProvince(player, entry.productId, destinationProvinceId);
        source.inTransit = Math.max(0, Number(source.inTransit || 0) - entry.quantity);
        destination.available = Math.max(0, Number(destination.available || 0)) + entry.quantity;
      }
      stop.deliveredAt = Number(stop.arrivesAt || now);
    }
    shipment.stopPlan = stopPlan;
    if (Number(shipment.arrivesAt || 0) <= now && stopPlan.every((stop) => stop.deliveredAt)) {
      shipment.status = 'arrived';
      shipment.arrivedAt = Number(shipment.arrivesAt || now);
    }
  }
  const active = world.transportShipments.filter((shipment) => shipment.status === 'in-transit');
  const historyByOwner = new Map();
  for (const shipment of world.transportShipments) {
    if (shipment.status === 'in-transit') continue;
    const ownerId = String(shipment.ownerId);
    const entries = historyByOwner.get(ownerId) || [];
    entries.push(shipment);
    historyByOwner.set(ownerId, entries);
  }
  const history = [];
  for (const entries of historyByOwner.values()) {
    history.push(...entries
      .sort((left, right) => Number(right.arrivedAt || right.createdAt) - Number(left.arrivedAt || left.createdAt))
      .slice(0, TRANSPORT_HISTORY_PER_PLAYER));
  }
  world.transportShipments = [...active, ...history];
  processAutomaticTransportRoutes(world, now);
}

export function nextTransportDeadline(world) {
  let next = null;
  for (const shipment of world.transportShipments || []) {
    if (shipment.status !== 'in-transit') continue;
    const pendingStop = (Array.isArray(shipment.stopPlan) ? shipment.stopPlan : []).find((stop) => !stop.deliveredAt);
    const candidate = Number(pendingStop?.arrivesAt || shipment.arrivesAt || 0);
    if (!(candidate > 0)) continue;
    next = next === null ? candidate : Math.min(next, candidate);
  }
  return next;
}

export function transportRouteClientState(world, userId) {
  const player = world.players?.[String(userId)];
  return playerTransportRoutes(player).map((route) => ({
    id: String(route.id),
    name: normalizedTransportRouteName(route.name) || defaultTransportRouteName(route.sourceProvinceId, route.destinationProvinceId),
    sourceProvinceId: normalizeProvinceId(route.sourceProvinceId),
    destinationProvinceId: normalizeProvinceId(route.destinationProvinceId),
    ...(transportViaProvinceIds(route).length > 0 ? { viaProvinceIds: [...transportViaProvinceIds(route)] } : {}),
    tripType: TRANSPORT_TRIP_TYPE_IDS.has(route.tripType) ? route.tripType : TRANSPORT_DEFAULT_TRIP_TYPE,
    mode: TRANSPORT_MODES[route.mode] ? route.mode : 'road',
    createdAt: Number(route.createdAt || 0),
    updatedAt: Number(route.updatedAt || route.createdAt || 0),
  }));
}

export function transportShipmentClientState(world, userId) {
  return (world.transportShipments || [])
    .filter((shipment) => Number(shipment.ownerId) === Number(userId))
    .map((shipment) => ({
      id: String(shipment.id),
      ...(shipment.routeId ? { routeId: String(shipment.routeId) } : {}),
      ...(shipment.routeName ? { routeName: String(shipment.routeName) } : {}),
      sourceProvinceId: normalizeProvinceId(shipment.sourceProvinceId),
      destinationProvinceId: normalizeProvinceId(shipment.destinationProvinceId),
      ...(transportViaProvinceIds(shipment).length > 0 ? { viaProvinceIds: [...transportViaProvinceIds(shipment)] } : {}),
      tripType: TRANSPORT_TRIP_TYPE_IDS.has(shipment.tripType) ? shipment.tripType : TRANSPORT_DEFAULT_TRIP_TYPE,
      stopPlan: (Array.isArray(shipment.stopPlan) ? shipment.stopPlan : []).map((stop) => ({
        provinceId: normalizeProvinceId(stop.provinceId),
        arrivesAt: Number(stop.arrivesAt || 0),
        deliveredAt: stop.deliveredAt ? Number(stop.deliveredAt) : null,
      })),
      legPlan: derivedShipmentLegPlan(shipment),
      manifest: shipmentManifest(shipment),
      mode: TRANSPORT_MODES[shipment.mode] ? shipment.mode : 'road',
      cost: Number(shipment.cost || 0),
      departsAt: Number(shipment.departsAt || shipment.createdAt || 0),
      arrivesAt: Number(shipment.arrivesAt || 0),
      status: shipment.status === 'arrived' ? 'arrived' : 'in-transit',
      createdAt: Number(shipment.createdAt || shipment.departsAt || 0),
      ...(shipment.arrivedAt ? { arrivedAt: Number(shipment.arrivedAt) } : {}),
    }));
}