import { randomUUID } from 'node:crypto';
import {
  TRANSPORT_BASE_SECONDS_PER_KM,
  TRANSPORT_FUEL_UNIT_PRICE,
  TRANSPORT_FUEL_PRODUCT_ID,
  transportFuelQuantity,
  TRANSPORT_MODE_POLICY,
  createTransportCyclePolicy,
  transportCyclePolicyForShipment,
  transportPolicyDurationMs,
} from '../../shared/transport-policy.js';
import { PRODUCT_CATALOG } from './industry-catalog.js';
import { roundInternalMoney } from './money.js';
import { creditPopulationEmployment } from './population-economy.js';
import {
  inventoryForProvince,
  normalizeProvinceId,
  PROVINCE_CATALOG,
} from './provinces.js';
import { isProvinceUnlocked, provinceDistanceKm } from './province-access.js';

export const TRANSPORT_MODES = TRANSPORT_MODE_POLICY;
export { TRANSPORT_BASE_SECONDS_PER_KM, TRANSPORT_FUEL_UNIT_PRICE };
export const TRANSPORT_MAX_IN_TRANSIT_PER_PLAYER = 20;
export const TRANSPORT_MAX_ROUTES_PER_PLAYER = 50;
export const TRANSPORT_HISTORY_PER_PLAYER = 30;
export const TRANSPORT_ROUTE_NAME_MAX_LENGTH = 40;
export const TRANSPORT_TRIP_TYPES = Object.freeze(['round', 'one-way']);
export const TRANSPORT_DEFAULT_TRIP_TYPE = 'round';

const PRODUCT_BY_ID = new Map(PRODUCT_CATALOG.map((product) => [product.id, product]));
const PROVINCE_BY_ID = new Map(PROVINCE_CATALOG.map((province) => [province.id, province]));

function roundFuel(value) {
  return Math.max(0, Math.round((Number(value) || 0) * 1_000_000) / 1_000_000);
}

export function transportDurationMs(mode, distanceKm) {
  if (!TRANSPORT_MODES[mode]) return null;
  return transportPolicyDurationMs(createTransportCyclePolicy(mode), Math.max(0, Number(distanceKm) || 0));
}

export function normalizeTransportStops(payload = {}) {
  const sourceProvinceId = normalizeProvinceId(payload.sourceProvinceId);
  const destinationProvinceId = normalizeProvinceId(payload.destinationProvinceId);
  const rawViaProvinceIds = payload.viaProvinceIds === undefined || payload.viaProvinceIds === null ? [] : payload.viaProvinceIds;
  if (!Array.isArray(rawViaProvinceIds)) return { ok: false, message: '运输路线参数无效' };
  const viaProvinceIds = rawViaProvinceIds.map((entry) => normalizeProvinceId(entry));
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
      tripType: closed ? 'one-way' : 'round',
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
  return [...stops, ...stops.slice(0, -1).reverse()];
}

export function transportRouteSetupCost(route, mode = route?.mode) {
  const definition = TRANSPORT_MODES[mode];
  const stops = transportRouteStops(route);
  if (!definition || stops.length < 2) return null;
  let distanceKm = 0;
  for (let index = 0; index < stops.length - 1; index += 1) {
    distanceKm += provinceDistanceKm(stops[index], stops[index + 1]);
  }
  return roundInternalMoney(definition.setupFixedCost + definition.setupCostPerKm * distanceKm);
}

export function transportCycleDistanceKm(route) {
  const stops = transportTraversalStops(route);
  if (stops.length < 2) return 0;
  let distanceKm = 0;
  for (let index = 0; index < stops.length - 1; index += 1) {
    distanceKm += provinceDistanceKm(stops[index], stops[index + 1]);
  }
  return distanceKm;
}

export function transportCycleCost(route, mode = route?.mode) {
  const definition = TRANSPORT_MODES[mode];
  if (!definition) return null;
  const distanceKm = transportCycleDistanceKm(route);
  const transportFee = roundInternalMoney(distanceKm * definition.transportFeePerKm) || 0;
  const fuelPurchased = transportFuelQuantity(distanceKm, definition.fuelPerKm);
  const fuelCost = 0;
  return {
    distanceKm,
    transportFee,
    fuelPurchased,
    fuelCost,
    fuelProductId: TRANSPORT_FUEL_PRODUCT_ID,
    totalCost: transportFee,
  };
}

function playerTransportRoutes(player) {
  return Array.isArray(player?.transportRoutes) ? player.transportRoutes : [];
}

function findPlayerRoute(player, routeId) {
  const id = String(routeId || '');
  return playerTransportRoutes(player).find((route) => String(route?.id || '') === id) || null;
}

function activeShipmentForRoute(world, playerId, routeId) {
  return (world.transportShipments || []).find((shipment) => (
    Number(shipment.ownerId) === Number(playerId)
    && String(shipment.routeId || '') === String(routeId || '')
    && shipment.status !== 'arrived'
  )) || null;
}

function inTransitCountFor(world, playerId) {
  return (world.transportShipments || []).filter((shipment) => (
    Number(shipment.ownerId) === Number(playerId) && shipment.status === 'in-transit'
  )).length;
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

function normalizeCargoRequest(value) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) return null;
  const totals = new Map();
  for (const entry of value) {
    const productId = String(entry?.productId || '');
    const quantity = Math.floor(Number(entry?.quantity));
    if (!PRODUCT_BY_ID.has(productId) || !Number.isSafeInteger(quantity) || quantity <= 0) return null;
    const total = (totals.get(productId) || 0) + quantity;
    if (!Number.isSafeInteger(total)) return null;
    totals.set(productId, total);
  }
  return [...totals].map(([productId, quantity]) => ({ productId, quantity }));
}

function normalizeCargoLots(value, fallbackOriginProvinceId) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    const productId = String(entry?.productId || '');
    const originProvinceId = normalizeProvinceId(entry?.originProvinceId || fallbackOriginProvinceId);
    const quantity = Math.floor(Number(entry?.quantity));
    if (!PRODUCT_BY_ID.has(productId) || !Number.isSafeInteger(quantity) || quantity <= 0) return [];
    return [{ productId, originProvinceId, quantity }];
  });
}

function cargoQuantityForProduct(cargoLots, productId) {
  return cargoLots.reduce((total, entry) => entry.productId === productId ? total + entry.quantity : total, 0);
}

function cargoTotalQuantity(cargoLots) {
  return cargoLots.reduce((total, entry) => total + entry.quantity, 0);
}

function cargoManifest(cargoLots) {
  const totals = new Map();
  for (const entry of cargoLots) totals.set(entry.productId, (totals.get(entry.productId) || 0) + entry.quantity);
  return [...totals].map(([productId, quantity]) => ({ productId, quantity }));
}

function appendDeliveredManifest(shipment, productId, destinationProvinceId, quantity) {
  shipment.cycleManifest ||= [];
  const existing = shipment.cycleManifest.find((entry) => (
    entry.productId === productId && entry.destinationProvinceId === destinationProvinceId
  ));
  if (existing) existing.quantity += quantity;
  else shipment.cycleManifest.push({ productId, destinationProvinceId, quantity });
}

function departShipmentLeg(shipment, now) {
  const traversalStops = Array.isArray(shipment.traversalStops) ? shipment.traversalStops : [];
  const currentVisitIndex = Math.max(0, Math.floor(Number(shipment.currentVisitIndex || 0)));
  const nextVisitIndex = currentVisitIndex + 1;
  if (nextVisitIndex >= traversalStops.length) return false;
  const fromProvinceId = normalizeProvinceId(traversalStops[currentVisitIndex]);
  const toProvinceId = normalizeProvinceId(traversalStops[nextVisitIndex]);
  const distanceKm = provinceDistanceKm(fromProvinceId, toProvinceId);
  const policy = transportCyclePolicyForShipment(shipment);
  const durationMs = transportPolicyDurationMs(policy, distanceKm);
  const departsAt = Number(now);
  const arrivesAt = departsAt + durationMs;
  const remainingLoad = cargoTotalQuantity(shipment.cargoLots || []);
  const leg = { fromProvinceId, toProvinceId, departsAt, arrivesAt, remainingLoad, distanceKm };
  shipment.currentLeg = leg;
  shipment.legHistory ||= [];
  shipment.legHistory.push(leg);
  shipment.nextVisitIndex = nextVisitIndex;
  shipment.departsAt = departsAt;
  shipment.arrivesAt = arrivesAt;
  shipment.status = 'in-transit';
  if (!shipment.legacyCycle && policy.version < 3) {
    shipment.fuelConsumed = Math.min(
      Number(shipment.fuelPurchased || 0),
      roundFuel(Number(shipment.fuelConsumed || 0) + distanceKm * policy.fuelPerKm),
    );
  }
  return true;
}

function addCargoFromInventory(player, cargoLots, provinceId, load) {
  for (const entry of load) {
    const inventory = inventoryForProvince(player, entry.productId, provinceId);
    inventory.available = Math.max(0, Number(inventory.available || 0) - entry.quantity);
    inventory.inTransit = Math.max(0, Number(inventory.inTransit || 0)) + entry.quantity;
    const existing = cargoLots.find((lot) => lot.productId === entry.productId && lot.originProvinceId === provinceId);
    if (existing) existing.quantity += entry.quantity;
    else cargoLots.push({ productId: entry.productId, originProvinceId: provinceId, quantity: entry.quantity });
  }
}

function unloadCargoToInventory(player, shipment, provinceId, unload) {
  const cargoLots = shipment.cargoLots || [];
  for (const entry of unload) {
    let remaining = entry.quantity;
    for (const lot of cargoLots) {
      if (remaining < 1 || lot.productId !== entry.productId || lot.quantity < 1) continue;
      const moved = Math.min(remaining, lot.quantity);
      lot.quantity -= moved;
      remaining -= moved;
      const origin = inventoryForProvince(player, entry.productId, lot.originProvinceId);
      origin.inTransit = Math.max(0, Number(origin.inTransit || 0) - moved);
      const destination = inventoryForProvince(player, entry.productId, provinceId);
      destination.available = Math.max(0, Number(destination.available || 0)) + moved;
      appendDeliveredManifest(shipment, entry.productId, provinceId, moved);
    }
  }
  shipment.cargoLots = cargoLots.filter((lot) => lot.quantity > 0);
}

export function applyCreateTransportRoute(world, user, payload = {}, now = Date.now()) {
  const player = world.players?.[String(user.id)];
  if (!player) return { ok: false, message: '玩家状态无效' };
  const routes = playerTransportRoutes(player);
  if (routes.length >= TRANSPORT_MAX_ROUTES_PER_PLAYER) return { ok: false, message: `运输路线不能超过 ${TRANSPORT_MAX_ROUTES_PER_PLAYER} 条` };
  const normalized = normalizedRouteInput(player, payload);
  if (!normalized.ok) return normalized;
  const setupCost = transportRouteSetupCost(normalized.route, normalized.route.mode);
  if (!(setupCost >= 0)) return { ok: false, message: '运输路线费用无效' };
  if (Number(player.credits || 0) < setupCost) return { ok: false, message: '资金不足，无法支付运输路线建线费' };
  player.credits = roundInternalMoney(player.credits - setupCost) || 0;
  creditPopulationEmployment(world, setupCost, 'transportService');
  const route = {
    id: `transport-route-${randomUUID()}`,
    name: defaultTransportRouteName(normalized.route.sourceProvinceId, normalized.route.destinationProvinceId),
    ...normalized.route,
    setupCost,
    createdAt: now,
    updatedAt: now,
  };
  player.transportRoutes = [...routes, route];
  return { ok: true, message: '运输路线已创建，在线时将自动规划节点装卸', routeId: route.id };
}

export function applyUpdateTransportRoute(world, user, payload = {}) {
  const player = world.players?.[String(user.id)];
  if (!player) return { ok: false, message: '玩家状态无效' };
  const route = findPlayerRoute(player, payload.routeId);
  if (!route) return { ok: false, message: '运输路线不存在' };
  return { ok: false, message: '路线创建后不可修改，请删除后重新建立' };
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

export function applyDeleteTransportRoute(world, user, payload = {}, now = Date.now()) {
  const player = world.players?.[String(user.id)];
  if (!player) return { ok: false, message: '玩家状态无效' };
  const routes = playerTransportRoutes(player);
  const routeId = String(payload.routeId || '');
  const route = findPlayerRoute(player, routeId);
  if (!route) return { ok: false, message: '运输路线不存在' };
  if (activeShipmentForRoute(world, user.id, routeId)) {
    route.deletionPending = true;
    route.updatedAt = now;
    return { ok: true, message: '已预约本趟完成后删除，不再启动下一趟运输' };
  }
  player.transportRoutes = routes.filter((entry) => entry.id !== routeId);
  return { ok: true, message: '运输路线已删除' };
}

export function applyStartTransportCycle(world, user, payload = {}, now = Date.now()) {
  const player = world.players?.[String(user.id)];
  if (!player) return { ok: false, message: '玩家状态无效' };
  const route = findPlayerRoute(player, payload.routeId);
  if (!route) return { ok: false, message: '运输路线不存在' };
  if (route.deletionPending) return { ok: false, message: '该路线已预约删除，不能启动新的一趟' };
  if (activeShipmentForRoute(world, user.id, route.id)) return { ok: false, message: '该路线已有一趟运输进行中' };
  if (inTransitCountFor(world, user.id) >= TRANSPORT_MAX_IN_TRANSIT_PER_PLAYER) {
    return { ok: false, message: `同时在途运输不能超过 ${TRANSPORT_MAX_IN_TRANSIT_PER_PLAYER} 笔` };
  }
  const load = normalizeCargoRequest(payload.load);
  if (load === null) return { ok: false, message: '运输装货参数无效' };
  const definition = TRANSPORT_MODES[route.mode];
  const totalLoad = load.reduce((total, entry) => total + entry.quantity, 0);
  if (totalLoad > definition.capacity) return { ok: false, message: '装货数量超过运输方式容量' };
  const cycleCost = transportCycleCost(route, route.mode);
  if (!cycleCost) return { ok: false, message: '本趟运输费用无效' };
  const fuelInventory = inventoryForProvince(player, TRANSPORT_FUEL_PRODUCT_ID, route.sourceProvinceId);
  const fuelAvailable = Math.max(0, Math.floor(Number(fuelInventory.available) || 0));
  if (fuelAvailable < cycleCost.fuelPurchased) {
    return { ok: false, message: `燃料不足：需要 ${cycleCost.fuelPurchased}，可用 ${fuelAvailable}` };
  }
  for (const entry of load) {
    const propulsion = entry.productId === TRANSPORT_FUEL_PRODUCT_ID ? cycleCost.fuelPurchased : 0;
    if (Number(inventoryForProvince(player, entry.productId, route.sourceProvinceId).available || 0) < entry.quantity + propulsion) {
      return { ok: false, message: '起点可用库存不足，燃料不能同时用于动力和装货' };
    }
  }
  if (Number(player.credits || 0) < cycleCost.transportFee) {
    return { ok: false, message: '资金不足，无法支付本趟运费' };
  }
  const traversalStops = transportTraversalStops(route);
  if (traversalStops.length < 2) return { ok: false, message: '运输路线无效' };

  // All balance, fuel and cargo checks precede every asset mutation.
  player.credits = roundInternalMoney(player.credits - cycleCost.transportFee) || 0;
  fuelInventory.available = fuelAvailable - cycleCost.fuelPurchased;
  creditPopulationEmployment(world, cycleCost.transportFee, 'transportService');
  const cargoLots = [];
  addCargoFromInventory(player, cargoLots, route.sourceProvinceId, load);

  const shipment = {
    nodeCycleVersion: 1,
    policySnapshot: createTransportCyclePolicy(route.mode),
    id: `transport-${randomUUID()}` ,
    ownerId: Number(user.id),
    routeId: route.id,
    routeName: route.name,
    sourceProvinceId: route.sourceProvinceId,
    destinationProvinceId: route.destinationProvinceId,
    ...(transportViaProvinceIds(route).length > 0 ? { viaProvinceIds: [...transportViaProvinceIds(route)] } : {}),
    tripType: transportRouteClosed(route) ? 'one-way' : 'round',
    traversalStops,
    currentVisitIndex: 0,
    nextVisitIndex: 1,
    cargoLots,
    cycleManifest: [],
    legHistory: [],
    nodeHistory: [{ visitIndex: 0, provinceId: route.sourceProvinceId, servicedAt: now, unload: [], load: load.map((entry) => ({ ...entry })) }],
    mode: route.mode,
    cost: cycleCost.totalCost,
    transportFee: cycleCost.transportFee,
    fuelCost: cycleCost.fuelCost,
    fuelPurchased: cycleCost.fuelPurchased,
    fuelConsumed: cycleCost.fuelPurchased,
    cycleDistanceKm: cycleCost.distanceKm,
    status: 'docked',
    createdAt: now,
  };
  if (!departShipmentLeg(shipment, now)) return { ok: false, message: '运输路线无法开始' };
  world.transportShipments ||= [];
  world.transportShipments.push(shipment);
  return { ok: true, message: '本趟运输已启动，运费和燃料商品已一次性扣除', cycleId: shipment.id };
}

export function applyServiceTransportNode(world, user, payload = {}, now = Date.now()) {
  const player = world.players?.[String(user.id)];
  if (!player) return { ok: false, message: '玩家状态无效' };
  const route = findPlayerRoute(player, payload.routeId);
  if (!route) return { ok: false, message: '运输路线不存在' };
  const shipment = activeShipmentForRoute(world, user.id, route.id);
  if (!shipment || shipment.status !== 'docked') return { ok: false, message: '运输车辆当前未停靠节点' };
  if (String(payload.cycleId || '') !== String(shipment.id)) return { ok: false, message: '运输趟次已变化，请等待客户端同步' };
  const visitIndex = Math.floor(Number(payload.visitIndex));
  if (!Number.isSafeInteger(visitIndex) || visitIndex !== Number(shipment.currentVisitIndex)) {
    return { ok: false, message: '运输节点已变化，请等待客户端同步' };
  }
  const traversalStops = Array.isArray(shipment.traversalStops) ? shipment.traversalStops : transportTraversalStops(route);
  const currentProvinceId = normalizeProvinceId(traversalStops[visitIndex]);
  const finalVisit = visitIndex >= traversalStops.length - 1;
  if (!finalVisit && inTransitCountFor(world, user.id) >= TRANSPORT_MAX_IN_TRANSIT_PER_PLAYER) {
    return { ok: false, message: `同时在途运输不能超过 ${TRANSPORT_MAX_IN_TRANSIT_PER_PLAYER} 笔` };
  }
  const unload = normalizeCargoRequest(payload.unload);
  const load = normalizeCargoRequest(payload.load);
  if (unload === null || load === null) return { ok: false, message: '运输装卸参数无效' };
  if (finalVisit && load.length > 0) return { ok: false, message: '返回起点时必须先完成本趟卸货，再开始下一趟' };
  const unloadIds = new Set(unload.map((entry) => entry.productId));
  if (load.some((entry) => unloadIds.has(entry.productId))) {
    return { ok: false, message: '同一节点同一商品不能同时装货和卸货' };
  }

  const cargoLots = normalizeCargoLots(shipment.cargoLots, shipment.sourceProvinceId);
  for (const entry of unload) {
    if (cargoQuantityForProduct(cargoLots, entry.productId) < entry.quantity) {
      return { ok: false, message: '卸货数量超过车辆实际货物' };
    }
  }
  for (const entry of load) {
    if (Number(inventoryForProvince(player, entry.productId, currentProvinceId).available || 0) < entry.quantity) {
      return { ok: false, message: '当前节点可用库存不足' };
    }
  }
  const nextLoad = cargoTotalQuantity(cargoLots)
    - unload.reduce((total, entry) => total + entry.quantity, 0)
    + load.reduce((total, entry) => total + entry.quantity, 0);
  if (nextLoad > transportCyclePolicyForShipment(shipment).capacity) {
    return { ok: false, message: '装卸后车辆货量超过运输方式容量' };
  }

  if (finalVisit && nextLoad !== 0) return { ok: false, message: '返回起点时必须卸完全部车载货物' };

  shipment.cargoLots = cargoLots;
  unloadCargoToInventory(player, shipment, currentProvinceId, unload);
  addCargoFromInventory(player, shipment.cargoLots, currentProvinceId, load);
  shipment.nodeHistory ||= [];
  shipment.nodeHistory.push({
    visitIndex, provinceId: currentProvinceId, servicedAt: now,
    unload: unload.map((entry) => ({ ...entry })), load: load.map((entry) => ({ ...entry })),
  });

  if (finalVisit) {
    shipment.status = 'arrived';
    if (!shipment.legacyCycle) shipment.fuelConsumed = Number(shipment.fuelPurchased || 0);
    shipment.arrivedAt = now;
    shipment.currentLeg = null;
    shipment.nextVisitIndex = null;
    if (route.deletionPending) player.transportRoutes = playerTransportRoutes(player).filter((entry) => entry.id !== route.id);
    return { ok: true, message: route.deletionPending ? '本趟已卸货完成，路线已删除' : '本趟运输已完成并返回起点' };
  }

  if (!departShipmentLeg(shipment, now)) return { ok: false, message: '下一段运输路线无效' };
  return { ok: true, message: '节点装卸已完成，车辆已发往下一节点' };
}

export function applyTransportShip(world, user, payload = {}, now = Date.now()) {
  if (payload.operation === 'route-create') return applyCreateTransportRoute(world, user, payload, now);
  if (payload.operation === 'route-update') return applyUpdateTransportRoute(world, user, payload, now);
  if (payload.operation === 'route-rename') return applyRenameTransportRoute(world, user, payload, now);
  if (payload.operation === 'route-delete') return applyDeleteTransportRoute(world, user, payload, now);
  if (payload.operation === 'cycle-start') return applyStartTransportCycle(world, user, payload, now);
  if (payload.operation === 'node-service') return applyServiceTransportNode(world, user, payload, now);
  return { ok: false, message: '运输仅接受路线维护、新趟启动和节点装卸操作' };
}

function legacyShipmentManifest(shipment) {
  if (Array.isArray(shipment?.manifest)) {
    return shipment.manifest.flatMap((entry) => {
      const productId = String(entry?.productId || '');
      const destinationProvinceId = normalizeProvinceId(entry?.destinationProvinceId || shipment.destinationProvinceId);
      const quantity = Math.floor(Number(entry?.quantity));
      if (!PRODUCT_BY_ID.has(productId) || !Number.isSafeInteger(quantity) || quantity <= 0) return [];
      return [{ productId, destinationProvinceId, quantity }];
    });
  }
  const productId = String(shipment?.productId || '');
  const quantity = Math.floor(Number(shipment?.quantity));
  if (!PRODUCT_BY_ID.has(productId) || !Number.isSafeInteger(quantity) || quantity <= 0) return [];
  return [{ productId, destinationProvinceId: normalizeProvinceId(shipment.destinationProvinceId), quantity }];
}

function migrateLegacyShipment(world, shipment) {
  if (shipment.nodeCycleVersion === 1) return;
  const player = world.players?.[String(shipment.ownerId)];
  const route = findPlayerRoute(player, shipment.routeId) || shipment;
  const traversalStops = transportTraversalStops(route);
  shipment.routeName ||= route?.name;
  shipment.tripType = transportRouteClosed(route) ? 'one-way' : 'round';
  shipment.traversalStops = traversalStops;
  shipment.cycleDistanceKm = Number(shipment.cycleDistanceKm || transportCycleDistanceKm(route));
  shipment.transportFee = Number.isFinite(Number(shipment.transportFee)) ? Number(shipment.transportFee) : Number(shipment.cost || 0);
  shipment.fuelCost = Number.isFinite(Number(shipment.fuelCost)) ? Number(shipment.fuelCost) : 0;
  shipment.fuelPurchased = Number.isFinite(Number(shipment.fuelPurchased)) ? Number(shipment.fuelPurchased) : 0;
  shipment.fuelConsumed = Number.isFinite(Number(shipment.fuelConsumed)) ? Number(shipment.fuelConsumed) : 0;
  shipment.legacyCycle = shipment.legacyCycle === true || shipment.fuelPurchased === 0;
  shipment.legHistory ||= [];
  shipment.cycleManifest ||= [];

  if (shipment.status === 'arrived') {
    if (shipment.cycleManifest.length === 0) shipment.cycleManifest = legacyShipmentManifest(shipment);
    shipment.nodeCycleVersion = 1;
    return;
  }
  if (Array.isArray(shipment.cargoLots) && shipment.cargoLots.length > 0) {
    shipment.nodeCycleVersion = 1;
    return;
  }

  const deliveredProvinceIds = new Set((Array.isArray(shipment.stopPlan) ? shipment.stopPlan : [])
    .filter((stop) => stop?.deliveredAt)
    .map((stop) => normalizeProvinceId(stop.provinceId)));
  const manifest = legacyShipmentManifest(shipment);
  for (const entry of manifest) {
    if (deliveredProvinceIds.has(entry.destinationProvinceId)) {
      appendDeliveredManifest(shipment, entry.productId, entry.destinationProvinceId, entry.quantity);
    }
  }
  const pendingManifest = manifest.filter((entry) => !deliveredProvinceIds.has(entry.destinationProvinceId));
  shipment.cargoLots = pendingManifest.map((entry) => ({
    productId: entry.productId,
    originProvinceId: normalizeProvinceId(shipment.sourceProvinceId),
    quantity: entry.quantity,
  }));

  const pendingStop = (Array.isArray(shipment.stopPlan) ? shipment.stopPlan : []).find((stop) => !stop?.deliveredAt);
  let nextVisitIndex = pendingStop
    ? traversalStops.findIndex((provinceId, index) => index > 0 && normalizeProvinceId(provinceId) === normalizeProvinceId(pendingStop.provinceId))
    : traversalStops.length - 1;
  if (nextVisitIndex < 1) nextVisitIndex = Math.min(1, traversalStops.length - 1);
  shipment.currentVisitIndex = Math.max(0, nextVisitIndex - 1);
  shipment.nextVisitIndex = nextVisitIndex;
  const legacyLeg = (Array.isArray(shipment.legPlan) ? shipment.legPlan : []).find((leg) => (
    normalizeProvinceId(leg.toProvinceId) === normalizeProvinceId(traversalStops[nextVisitIndex])
    && Number(leg.arrivesAt || 0) > 0
  ));
  const departsAt = Number(legacyLeg?.departsAt || shipment.departsAt || shipment.createdAt || 0);
  const arrivesAt = Number(pendingStop?.arrivesAt || legacyLeg?.arrivesAt || shipment.arrivesAt || departsAt);
  shipment.currentLeg = {
    fromProvinceId: normalizeProvinceId(traversalStops[shipment.currentVisitIndex]),
    toProvinceId: normalizeProvinceId(traversalStops[nextVisitIndex]),
    departsAt,
    arrivesAt,
    remainingLoad: cargoTotalQuantity(shipment.cargoLots),
    distanceKm: provinceDistanceKm(traversalStops[shipment.currentVisitIndex], traversalStops[nextVisitIndex]),
  };
  shipment.departsAt = departsAt;
  shipment.arrivesAt = arrivesAt;
  shipment.status = 'in-transit';
  shipment.nodeCycleVersion = 1;
}

export function migrateTransportWorld(world) {
  if (!world || typeof world !== 'object') return world;
  for (const player of Object.values(world.players || {})) {
    if (!Array.isArray(player?.transportRoutes)) continue;
    player.transportRoutes = player.transportRoutes.flatMap((route) => {
      if (!route || typeof route !== 'object' || !route.id || !TRANSPORT_MODES[route.mode]) return [];
      const stops = normalizeTransportStops(route);
      if (!stops.ok) return [];
      const setupCost = Number.isFinite(Number(route.setupCost)) && Number(route.setupCost) >= 0 ? Number(route.setupCost) : 0;
      return [{
        id: String(route.id),
        name: normalizedTransportRouteName(route.name) || defaultTransportRouteName(stops.stops.sourceProvinceId, stops.stops.destinationProvinceId),
        sourceProvinceId: stops.stops.sourceProvinceId,
        destinationProvinceId: stops.stops.destinationProvinceId,
        ...(stops.stops.viaProvinceIds.length > 0 ? { viaProvinceIds: stops.stops.viaProvinceIds } : {}),
        tripType: stops.stops.tripType,
        mode: String(route.mode),
        setupCost,
        ...(route.deletionPending === true ? { deletionPending: true } : {}),
        createdAt: Number(route.createdAt || 0),
        updatedAt: Number(route.updatedAt || route.createdAt || 0),
      }];
    });
  }
  world.transportShipments ||= [];
  for (const shipment of world.transportShipments) {
    if (!shipment || typeof shipment !== 'object') continue;
    migrateLegacyShipment(world, shipment);
    if (!shipment.policySnapshot) shipment.policySnapshot = transportCyclePolicyForShipment(shipment);
  }
  return world;
}

export function processTransportWorld(world, now = Date.now()) {
  migrateTransportWorld(world);
  world.transportShipments ||= [];
  for (const shipment of world.transportShipments) {
    if (shipment.status !== 'in-transit' || Number(shipment.arrivesAt || 0) > now) continue;
    shipment.status = 'docked';
    shipment.currentVisitIndex = Number(shipment.nextVisitIndex || 0);
    shipment.dockedAt = Number(shipment.arrivesAt || now);
    shipment.currentLeg = null;
  }

  const active = world.transportShipments.filter((shipment) => shipment.status !== 'arrived');
  const historyByOwner = new Map();
  for (const shipment of world.transportShipments) {
    if (shipment.status !== 'arrived') continue;
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
}

export function nextTransportDeadline(world) {
  let next = null;
  for (const shipment of world.transportShipments || []) {
    if (shipment.status !== 'in-transit') continue;
    const candidate = Number(shipment.arrivesAt || 0);
    if (!(candidate > 0)) continue;
    next = next === null ? candidate : Math.min(next, candidate);
  }
  return next;
}

export function transportRouteClientState(world, userId) {
  const player = world.players?.[String(userId)];
  return playerTransportRoutes(player).map((route) => {
    const cycle = transportCycleCost(route, route.mode);
    return {
      id: String(route.id),
      name: normalizedTransportRouteName(route.name) || defaultTransportRouteName(route.sourceProvinceId, route.destinationProvinceId),
      sourceProvinceId: normalizeProvinceId(route.sourceProvinceId),
      destinationProvinceId: normalizeProvinceId(route.destinationProvinceId),
      ...(transportViaProvinceIds(route).length > 0 ? { viaProvinceIds: [...transportViaProvinceIds(route)] } : {}),
      tripType: transportRouteClosed(route) ? 'one-way' : 'round',
      mode: TRANSPORT_MODES[route.mode] ? route.mode : 'road',
      setupCost: Number.isFinite(Number(route.setupCost)) && Number(route.setupCost) >= 0 ? Number(route.setupCost) : 0,
      cycleDistanceKm: Number(cycle?.distanceKm || 0),
      cycleTransportFee: Number(cycle?.transportFee || 0),
      cycleFuelCost: Number(cycle?.fuelCost || 0),
      cycleFuelQuantity: Number(cycle?.fuelPurchased || 0),
      ...(route.deletionPending === true ? { deletionPending: true } : {}),
      cycleCost: Number(cycle?.totalCost || 0),
      createdAt: Number(route.createdAt || 0),
      updatedAt: Number(route.updatedAt || route.createdAt || 0),
    };
  });
}

export function transportShipmentClientState(world, userId) {
  return (world.transportShipments || [])
    .filter((shipment) => Number(shipment.ownerId) === Number(userId))
    .map((shipment) => {
      const traversalStops = Array.isArray(shipment.traversalStops) ? shipment.traversalStops : transportTraversalStops(shipment);
      const currentVisitIndex = Math.max(0, Math.floor(Number(shipment.currentVisitIndex || 0)));
      const nextVisitIndex = shipment.status === 'in-transit'
        ? Math.max(0, Math.floor(Number(shipment.nextVisitIndex || currentVisitIndex + 1)))
        : currentVisitIndex;
      const currentProvinceId = normalizeProvinceId(traversalStops[currentVisitIndex] || shipment.sourceProvinceId);
      const nextProvinceId = normalizeProvinceId(traversalStops[nextVisitIndex] || currentProvinceId);
      const cargoLots = normalizeCargoLots(shipment.cargoLots, shipment.sourceProvinceId);
      const activeManifest = cargoManifest(cargoLots);
      const historyManifest = Array.isArray(shipment.cycleManifest) ? shipment.cycleManifest : legacyShipmentManifest(shipment);
      const currentLeg = shipment.status === 'in-transit' && shipment.currentLeg ? shipment.currentLeg : null;
      return {
        id: String(shipment.id),
        cycleId: String(shipment.id),
        ...(shipment.routeId ? { routeId: String(shipment.routeId) } : {}),
        ...(shipment.routeName ? { routeName: String(shipment.routeName) } : {}),
        sourceProvinceId: normalizeProvinceId(shipment.sourceProvinceId),
        destinationProvinceId: normalizeProvinceId(shipment.destinationProvinceId),
        ...(transportViaProvinceIds(shipment).length > 0 ? { viaProvinceIds: [...transportViaProvinceIds(shipment)] } : {}),
        tripType: transportRouteClosed(shipment) ? 'one-way' : 'round',
        stopPlan: shipment.status === 'arrived' ? [] : [{
          provinceId: shipment.status === 'in-transit' ? nextProvinceId : currentProvinceId,
          arrivesAt: Number(shipment.status === 'in-transit' ? shipment.arrivesAt : shipment.dockedAt || shipment.arrivesAt || 0),
          deliveredAt: null,
        }],
        legPlan: currentLeg ? [{
          fromProvinceId: normalizeProvinceId(currentLeg.fromProvinceId),
          toProvinceId: normalizeProvinceId(currentLeg.toProvinceId),
          departsAt: Number(currentLeg.departsAt || 0),
          arrivesAt: Number(currentLeg.arrivesAt || 0),
          remainingLoad: Math.max(0, Math.floor(Number(currentLeg.remainingLoad || 0))),
        }] : [],
        manifest: shipment.status === 'arrived' ? historyManifest : activeManifest,
        mode: TRANSPORT_MODES[shipment.mode] ? shipment.mode : 'road',
        cost: Number(shipment.cost || 0),
        transportFee: Number(shipment.transportFee || 0),
        fuelCost: Number(shipment.fuelCost || 0),
        fuelPurchased: Number(shipment.fuelPurchased || 0),
        fuelConsumed: Number(shipment.fuelConsumed || 0),
        cycleDistanceKm: Number(shipment.cycleDistanceKm || 0),
        policySnapshot: transportCyclePolicyForShipment(shipment),
        nodeHistory: (shipment.nodeHistory || []).map((entry) => ({
          visitIndex: Number(entry.visitIndex), provinceId: normalizeProvinceId(entry.provinceId),
          servicedAt: Number(entry.servicedAt),
          unload: (entry.unload || []).map((cargo) => ({ productId: cargo.productId, quantity: Number(cargo.quantity) })),
          load: (entry.load || []).map((cargo) => ({ productId: cargo.productId, quantity: Number(cargo.quantity) })),
        })),
        deliveredQuantity: (shipment.cycleManifest || []).reduce((sum, entry) => sum + Math.max(0, Number(entry.quantity || 0)), 0),
        currentProvinceId,
        currentVisitIndex,
        departsAt: Number(shipment.departsAt || shipment.createdAt || 0),
        arrivesAt: Number(shipment.arrivesAt || shipment.dockedAt || shipment.arrivedAt || 0),
        status: shipment.status === 'arrived' ? 'arrived' : shipment.status === 'docked' ? 'docked' : 'in-transit',
        createdAt: Number(shipment.createdAt || shipment.departsAt || 0),
        ...(shipment.arrivedAt ? { arrivedAt: Number(shipment.arrivedAt) } : {}),
      };
    });
}
