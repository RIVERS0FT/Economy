import type { EconomyState, ProvinceDefinition, TransportModeId } from '../types';
import type { TransportCycleCostBreakdown, TransportRouteStopsInput } from '../utils/provinceLogistics';
import type { TransportCargoEntry, TransportCycleEstimate } from './transportPlanner.js';

export type TransportPlanningRoute = TransportRouteStopsInput & { mode: TransportModeId };
export type TransportRouteEstimate = TransportCycleEstimate & TransportCycleCostBreakdown & { capacity: number; durationMs: number };
export function estimateTransportRoute(game: EconomyState, route: TransportPlanningRoute, now: number, provinceById?: Map<string, ProvinceDefinition>): TransportRouteEstimate;
export type TransportMaintenanceCommand = {
  routeId: string;
  key: string;
  fingerprint: string;
} & (
  { kind: 'start'; load: TransportCargoEntry[] }
  | { kind: 'service'; cycleId: string; visitIndex: number; unload: TransportCargoEntry[]; load: TransportCargoEntry[] }
);
export function transportMaintenanceCandidates(game: EconomyState, now: number, lastRouteId?: string | null): TransportMaintenanceCommand[];
