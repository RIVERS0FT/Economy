import {
  TRANSPORT_BASE_SECONDS_PER_KM,
  TRANSPORT_FUEL_UNIT_PRICE,
  TRANSPORT_MODE_POLICY,
} from '../../shared/transport-policy.js';
import type { ProvinceDefinition, TransportModeId, TransportTripType } from '../types';


export const TRANSPORT_MODES: Record<TransportModeId, {
  id: TransportModeId;
  name: string;
  setupFixedCost: number;
  setupCostPerKm: number;
  transportFeePerKm: number;
  fuelPerKm: number;
  capacity: number;
  timeFactor: number;
  tone: 'neutral' | 'info' | 'warning';
}> = {
  road: { ...TRANSPORT_MODE_POLICY.road, tone: 'neutral' },
  rail: { ...TRANSPORT_MODE_POLICY.rail, tone: 'info' },
  air: { ...TRANSPORT_MODE_POLICY.air, tone: 'warning' },
};

export { TRANSPORT_BASE_SECONDS_PER_KM, TRANSPORT_FUEL_UNIT_PRICE };
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

export interface TransportRouteStopsInput {
  sourceProvinceId: string;
  destinationProvinceId: string;
  viaProvinceIds?: string[];
  tripType?: TransportTripType;
}

export interface TransportCycleCostBreakdown {
  distanceKm: number;
  transportFee: number;
  fuelPurchased: number;
  fuelCost: number;
  totalCost: number;
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
  return [...stops, ...stops.slice(0, -1).reverse()];
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

export function transportCycleDistanceKm(
  route: TransportRouteStopsInput,
  provinceById: Map<string, ProvinceDefinition>,
) {
  const stops = transportTraversalStopIds(route);
  if (stops.length < 2) return 0;
  let distanceKm = 0;
  for (let index = 0; index < stops.length - 1; index += 1) {
    const from = provinceById.get(stops[index]);
    const to = provinceById.get(stops[index + 1]);
    if (!from || !to) return 0;
    distanceKm += provinceDistanceKm(from, to);
  }
  return distanceKm;
}

export function transportCycleCost(
  route: TransportRouteStopsInput,
  mode: TransportModeId,
  provinceById: Map<string, ProvinceDefinition>,
): TransportCycleCostBreakdown {
  const definition = TRANSPORT_MODES[mode];
  const distanceKm = transportCycleDistanceKm(route, provinceById);
  if (!definition || distanceKm <= 0) {
    return { distanceKm: 0, transportFee: 0, fuelPurchased: 0, fuelCost: 0, totalCost: 0 };
  }
  const transportFee = Math.round(distanceKm * definition.transportFeePerKm * 1_000_000) / 1_000_000;
  const fuelPurchased = Math.round(distanceKm * definition.fuelPerKm * 1_000_000) / 1_000_000;
  const fuelCost = Math.round(fuelPurchased * TRANSPORT_FUEL_UNIT_PRICE * 1_000_000) / 1_000_000;
  return {
    distanceKm,
    transportFee,
    fuelPurchased,
    fuelCost,
    totalCost: Math.round((transportFee + fuelCost) * 1_000_000) / 1_000_000,
  };
}

export function transportCost(mode: TransportModeId, distanceKm: number) {
  const definition = TRANSPORT_MODES[mode];
  if (!definition) return 0;
  return Math.max(0, Math.round(
    definition.transportFeePerKm * Math.max(0, distanceKm) * 1_000_000,
  ) / 1_000_000);
}

export function transportFuelCost(mode: TransportModeId, distanceKm: number) {
  const definition = TRANSPORT_MODES[mode];
  if (!definition) return 0;
  const fuel = definition.fuelPerKm * Math.max(0, distanceKm);
  return Math.max(0, Math.round(fuel * TRANSPORT_FUEL_UNIT_PRICE * 1_000_000) / 1_000_000);
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
  const restSeconds = seconds % 60;
  if (minutes < 60) return restSeconds > 0 ? `${minutes} 分 ${restSeconds} 秒` : `${minutes} 分钟`;
  const hours = Math.floor(minutes / 60);
  const restMinutes = minutes % 60;
  return restMinutes > 0 ? `${hours} 小时 ${restMinutes} 分` : `${hours} 小时`;
}
