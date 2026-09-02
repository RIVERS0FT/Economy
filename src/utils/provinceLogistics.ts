import provinceEconomicLevelPolicy from '../../shared/province-economic-level-policy.json';
import type { ProvinceDefinition, TransportModeId, TransportTripType } from '../types';
import { provinceEconomicLevelBaseCost, provinceEconomicLevelFor } from './provinceEconomicLevel';

export const PROVINCE_UNLOCK_BASE_COST = provinceEconomicLevelBaseCost(1);
export const PROVINCE_UNLOCK_DISTANCE_STEP_KM = Number(provinceEconomicLevelPolicy.distanceStepKm);
export const PROVINCE_UNLOCK_COST_PER_DISTANCE_STEP = Number(provinceEconomicLevelPolicy.distanceCostPerStep);
export const PROVINCE_UNLOCK_COST_PER_500_KM = PROVINCE_UNLOCK_COST_PER_DISTANCE_STEP;
export const PROVINCE_UNLOCK_MAX_COST = Number(provinceEconomicLevelPolicy.maxUnlockCost);

export const TRANSPORT_MODES: Record<TransportModeId, {
  id: TransportModeId;
  name: string;
  fixedCost: number;
  unitCostPerKm: number;
  setupFixedCost: number;
  setupCostPerKm: number;
  capacity: number;
  timeFactor: number;
  tone: 'neutral' | 'info' | 'warning';
}> = {
  road: {
    id: 'road',
    name: '公路运输',
    fixedCost: 10,
    unitCostPerKm: 0.0002,
    setupFixedCost: 100,
    setupCostPerKm: 0.02,
    capacity: 100,
    timeFactor: 1.0,
    tone: 'neutral',
  },
  rail: {
    id: 'rail',
    name: '铁路运输',
    fixedCost: 50,
    unitCostPerKm: 0.0001,
    setupFixedCost: 1000,
    setupCostPerKm: 0.15,
    capacity: 2000,
    timeFactor: 2.0,
    tone: 'info',
  },
  air: {
    id: 'air',
    name: '航空运输',
    fixedCost: 100,
    unitCostPerKm: 0.0006,
    setupFixedCost: 500,
    setupCostPerKm: 0.05,
    capacity: 500,
    timeFactor: 0.25,
    tone: 'warning',
  },
};

export const TRANSPORT_BASE_SECONDS_PER_KM = 60 / 1000;
export const TRANSPORT_MAX_IN_TRANSIT_PER_PLAYER = 20;
export const TRANSPORT_MAX_ROUTES_PER_PLAYER = 50;
export const TRANSPORT_DEFAULT_TRIP_TYPE: TransportTripType = 'one-way';

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

export function provinceUnlockCostBreakdown(
  provinceId: string,
  startingProvinceId: string,
  provinces: ProvinceDefinition[],
) {
  const economicLevel = provinceEconomicLevelFor(provinceId);
  const baseCost = provinceEconomicLevelBaseCost(economicLevel);
  const left = provinces.find((province) => province.id === provinceId);
  const right = provinces.find((province) => province.id === startingProvinceId);
  if (!left || !right) {
    return { economicLevel, baseCost, distanceKm: 0, distanceCost: 0, totalCost: Math.min(PROVINCE_UNLOCK_MAX_COST, baseCost) };
  }
  const distanceKm = provinceDistanceKm(left, right);
  const distanceCost = PROVINCE_UNLOCK_COST_PER_DISTANCE_STEP
    * Math.floor(distanceKm / PROVINCE_UNLOCK_DISTANCE_STEP_KM);
  return {
    economicLevel,
    baseCost,
    distanceKm,
    distanceCost,
    totalCost: Math.min(PROVINCE_UNLOCK_MAX_COST, baseCost + distanceCost),
  };
}

export function provinceUnlockCost(provinceId: string, startingProvinceId: string, provinces: ProvinceDefinition[]) {
  return provinceUnlockCostBreakdown(provinceId, startingProvinceId, provinces).totalCost;
}

export interface TransportRouteStopsInput {
  id?: string;
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
  loadQuantity: number;
  delivers: boolean;
}

export interface TransportRoutePlanMetrics {
  distanceKm: number;
  durationMs: number;
  cost: number;
  initialLoad: number;
  deliveryStops: string[];
  legs: TransportRouteLeg[];
}

const transportRouteIdByStopIds = new WeakMap<string[], string>();

export function transportRouteViaIds(route: Pick<TransportRouteStopsInput, 'viaProvinceIds'>) {
  return Array.isArray(route.viaProvinceIds) ? route.viaProvinceIds.filter(Boolean) : [];
}

export function transportRouteStopIds(route: TransportRouteStopsInput) {
  const stops = [
    route.sourceProvinceId,
    ...transportRouteViaIds(route),
    route.destinationProvinceId,
  ].filter(Boolean);
  if (typeof route.id === 'string' && route.id) transportRouteIdByStopIds.set(stops, route.id);
  return stops;
}

export function transportRouteIdForStopIds(stops: string[] | null | undefined) {
  return stops ? transportRouteIdByStopIds.get(stops) : undefined;
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

export function transportRouteSetupCost(
  route: TransportRouteStopsInput,
  mode: TransportModeId,
  provinceById: Map<string, ProvinceDefinition>,
) {
  const definition = TRANSPORT_MODES[mode];
  const stops = transportRouteStopIds(route);
  if (!definition || stops.length < 2) return 0;
  let distanceKm = 0;
  for (let index = 0; index < stops.length - 1; index += 1) {
    const from = provinceById.get(stops[index]);
    const to = provinceById.get(stops[index + 1]);
    if (!from || !to) return 0;
    distanceKm += provinceDistanceKm(from, to);
  }
  return Math.max(0, Math.round(
    (definition.setupFixedCost + definition.setupCostPerKm * distanceKm) * 1_000_000,
  ) / 1_000_000);
}

export function transportRouteMaxQuantityPerStop(route: TransportRouteStopsInput, mode: TransportModeId) {
  const definition = TRANSPORT_MODES[mode];
  const deliveryCount = transportDeliveryStopIds(route).length;
  if (!definition || deliveryCount < 1) return 0;
  return Math.floor(definition.capacity / deliveryCount);
}

export function transportRoutePlanMetrics(
  route: TransportRouteStopsInput & { mode: TransportModeId; quantity: number },
  provinceById: Map<string, ProvinceDefinition>,
): TransportRoutePlanMetrics | null {
  const traversalStopIds = transportTraversalStopIds(route);
  if (traversalStopIds.length < 2) return null;
  const deliveryStops = transportDeliveryStopIds(route);
  const deliveryStopSet = new Set(deliveryStops);
  const deliveredStops = new Set<string>();
  const normalizedQuantity = Math.max(0, Math.floor(route.quantity));
  const initialLoad = normalizedQuantity * deliveryStops.length;
  const legs: TransportRouteLeg[] = [];
  let remainingLoad = initialLoad;
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
    const legLoadQuantity = remainingLoad;
    const legCost = transportCost(route.mode, legLoadQuantity, legDistanceKm);
    if (delivers) {
      deliveredStops.add(to.id);
      remainingLoad = Math.max(0, remainingLoad - normalizedQuantity);
    }
    distanceKm += legDistanceKm;
    durationMs += legDurationMs;
    cost += legCost;
    legs.push({
      fromProvinceId,
      toProvinceId,
      distanceKm: legDistanceKm,
      durationMs: legDurationMs,
      cost: legCost,
      loadQuantity: legLoadQuantity,
      delivers,
    });
  }
  if (deliveredStops.size < 1) return null;
  return {
    distanceKm,
    durationMs,
    cost: Math.round(cost * 1_000_000) / 1_000_000,
    initialLoad,
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
