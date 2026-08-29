import type { ProvinceDefinition, TransportModeId, TransportTripType } from '../types';

export const PROVINCE_UNLOCK_BASE_COST = 1500;
export const PROVINCE_UNLOCK_COST_PER_500_KM = 300;
export const PROVINCE_UNLOCK_MAX_COST = 20000;

export const TRANSPORT_MODES: Record<TransportModeId, {
  id: TransportModeId;
  name: string;
  fixedCost: number;
  unitCostPerKm: number;
  capacity: number;
  timeFactor: number;
  tone: 'neutral' | 'info' | 'warning';
}> = {
  road: { id: 'road', name: '公路运输', fixedCost: 10, unitCostPerKm: 0.0002, capacity: 100, timeFactor: 1.0, tone: 'neutral' },
  rail: { id: 'rail', name: '铁路运输', fixedCost: 50, unitCostPerKm: 0.0001, capacity: 2000, timeFactor: 2.0, tone: 'info' },
  air: { id: 'air', name: '航空运输', fixedCost: 100, unitCostPerKm: 0.0006, capacity: 500, timeFactor: 0.25, tone: 'warning' },
};

export const TRANSPORT_BASE_SECONDS_PER_KM = 60 / 1000;
export const TRANSPORT_MAX_IN_TRANSIT_PER_PLAYER = 20;
export const TRANSPORT_MAX_ROUTES_PER_PLAYER = 50;
export const TRANSPORT_DEFAULT_TRIP_TYPE: TransportTripType = 'round';

function toRadians(value: number) {
  return value * Math.PI / 180;
}

export function provinceDistanceKm(left: ProvinceDefinition, right: ProvinceDefinition) {
  if (left.id === right.id) return 0;
  const earthRadiusKm = 6371;
  const lat1 = toRadians(left.latitude);
  const lat2 = toRadians(right.latitude);
  const dLat = toRadians(right.latitude - left.latitude);
  const dLon = toRadians(right.longitude - left.longitude);
  const haversine = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * earthRadiusKm * Math.asin(Math.min(1, Math.sqrt(haversine)));
}

export function provinceUnlockCost(provinceId: string, startingProvinceId: string, provinces: ProvinceDefinition[]) {
  const left = provinces.find((province) => province.id === provinceId);
  const right = provinces.find((province) => province.id === startingProvinceId);
  if (!left || !right) return PROVINCE_UNLOCK_BASE_COST;
  const distanceKm = provinceDistanceKm(left, right);
  const cost = PROVINCE_UNLOCK_BASE_COST + PROVINCE_UNLOCK_COST_PER_500_KM * Math.floor(distanceKm / 500);
  return Math.min(PROVINCE_UNLOCK_MAX_COST, cost);
}

export interface TransportRouteStopsInput {
  sourceProvinceId: string;
  destinationProvinceId: string;
  viaProvinceIds?: string[];
  tripType?: TransportTripType;
}

export interface TransportRouteLeg {
  fromProvinceId: string;
  toProvinceId: string;
  distanceKm: number;
  durationMs: number;
  cost: number;
  delivers: boolean;
}

export interface TransportRoutePlanMetrics {
  distanceKm: number;
  durationMs: number;
  cost: number;
  deliveryStops: string[];
  legs: TransportRouteLeg[];
}

export function transportRouteViaIds(route: Pick<TransportRouteStopsInput, 'viaProvinceIds'>) {
  return Array.isArray(route.viaProvinceIds) ? route.viaProvinceIds.filter(Boolean) : [];
}

export function transportRouteStopIds(route: TransportRouteStopsInput) {
  return [
    route.sourceProvinceId,
    ...transportRouteViaIds(route),
    route.destinationProvinceId,
  ].filter(Boolean);
}

export function isTransportRouteClosed(route: TransportRouteStopsInput) {
  return Boolean(route.sourceProvinceId)
    && route.sourceProvinceId === route.destinationProvinceId;
}

export function transportTraversalStopIds(route: TransportRouteStopsInput) {
  const stops = transportRouteStopIds(route);
  if (isTransportRouteClosed(route)) return stops;
  if (route.tripType === 'round') return [...stops, ...stops.slice(0, -1).reverse()];
  return stops;
}

export function transportDeliveryStopIds(route: TransportRouteStopsInput) {
  const viaProvinceIds = transportRouteViaIds(route);
  if (isTransportRouteClosed(route)) return [...viaProvinceIds];
  return route.destinationProvinceId ? [...viaProvinceIds, route.destinationProvinceId] : [...viaProvinceIds];
}

export function transportRoutePlanMetrics(
  route: TransportRouteStopsInput & { mode: TransportModeId; quantity: number },
  provinceById: Map<string, ProvinceDefinition>,
): TransportRoutePlanMetrics | null {
  const traversalStopIds = transportTraversalStopIds(route);
  if (traversalStopIds.length < 2) return null;
  const deliveryStopSet = new Set(transportDeliveryStopIds(route));
  const deliveredStops = new Set<string>();
  const legs: TransportRouteLeg[] = [];
  let distanceKm = 0;
  let durationMs = 0;
  let cost = 0;
  for (let index = 0; index < traversalStopIds.length - 1; index += 1) {
    const fromProvinceId = traversalStopIds[index];
    const toProvinceId = traversalStopIds[index + 1];
    const from = provinceById.get(fromProvinceId);
    const to = provinceById.get(toProvinceId);
    if (!from || !to) return null;
    const legDistanceKm = from.id === to.id ? 0 : provinceDistanceKm(from, to);
    const legDurationMs = transportDurationMs(route.mode, legDistanceKm);
    const delivers = deliveryStopSet.has(to.id) && !deliveredStops.has(to.id);
    const legCost = transportCost(route.mode, delivers ? route.quantity : 0, legDistanceKm);
    if (delivers) deliveredStops.add(to.id);
    distanceKm += legDistanceKm;
    durationMs += legDurationMs;
    cost += legCost;
    legs.push({
      fromProvinceId,
      toProvinceId,
      distanceKm: legDistanceKm,
      durationMs: legDurationMs,
      cost: legCost,
      delivers,
    });
  }
  if (deliveredStops.size < 1) return null;
  return {
    distanceKm,
    durationMs,
    cost: Math.round(cost * 1_000_000) / 1_000_000,
    deliveryStops: [...deliveredStops],
    legs,
  };
}

export function transportCost(mode: TransportModeId, quantity: number, distanceKm: number) {
  const definition = TRANSPORT_MODES[mode];
  if (!definition) return 0;
  return Math.max(0, Math.round(
    (definition.fixedCost + definition.unitCostPerKm * Math.max(0, Math.floor(quantity)) * Math.max(0, distanceKm)) * 1_000_000,
  ) / 1_000_000);
}

export function transportDurationMs(mode: TransportModeId, distanceKm: number) {
  const definition = TRANSPORT_MODES[mode];
  if (!definition) return 0;
  return Math.max(1_000, Math.round(distanceKm * TRANSPORT_BASE_SECONDS_PER_KM * definition.timeFactor * 1000));
}

export function formatTransportDuration(ms: number) {
  const seconds = Math.max(0, Math.round(ms / 1000));
  if (seconds < 60) return `${seconds} 秒`;
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return remainder > 0 ? `${minutes} 分 ${remainder} 秒` : `${minutes} 分钟`;
}
