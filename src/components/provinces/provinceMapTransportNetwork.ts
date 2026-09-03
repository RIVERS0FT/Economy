import transportCapitalRoutes from '../../generated/transport-capital-routes.json';
import type { TransportModeId } from '../../types';
import {
  provinceMapPhysicalRouteEdgeKey,
  type ProvinceMapPhysicalPathMap,
  type ProvinceMapPoint,
} from './provinceMapRouteLayout';

type TransportNetworkMode = Extract<TransportModeId, 'road' | 'rail'>;
type Coordinate = [number, number];

type TransportCapitalRouteData = {
  version: number;
  kind: string;
  capitalCount: number;
  routes: Partial<Record<TransportNetworkMode, Record<string, Coordinate[]>>>;
};

const transportCapitalRouteData = transportCapitalRoutes as unknown as TransportCapitalRouteData;

export const transportCapitalRouteDataKind = transportCapitalRouteData.kind;

export function createProvinceMapTransportPhysicalPaths(
  project: (coordinate: Coordinate) => ProvinceMapPoint,
): ProvinceMapPhysicalPathMap {
  const output = new Map<string, ProvinceMapPoint[]>();
  for (const mode of ['road', 'rail'] as const) {
    for (const [pairKey, coordinates] of Object.entries(transportCapitalRouteData.routes[mode] ?? {})) {
      const [leftProvinceId, rightProvinceId] = pairKey.split(':');
      if (!leftProvinceId || !rightProvinceId || coordinates.length < 2) continue;
      const points = coordinates.map((coordinate) => project(coordinate));
      if (points.length < 2) continue;
      output.set(provinceMapPhysicalRouteEdgeKey(mode, leftProvinceId, rightProvinceId), points);
    }
  }
  return output;
}
