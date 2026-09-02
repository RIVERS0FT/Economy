import { feature } from 'topojson-client';
import northAmericaLand10m from '../../data/north-america-land-10m.json';
import { provinceGeometryPath, type ProvinceMapProjection } from './provinceMapProjection';

export interface ProvinceMapMainlandFocusBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

// This committed topology is deterministically pruned from world-atlas@2.0.2 countries-10m.
// Runtime expands only the dissolved North-American arcs; the complete global atlas never enters GameApp.
const northAmericaTopology = northAmericaLand10m as unknown as Parameters<typeof feature>[0];
const northAmericaLandObject = (northAmericaLand10m as unknown as {
  objects: { land: Parameters<typeof feature>[1] };
}).objects.land;
const northAmericaLandFeature = feature(northAmericaTopology, northAmericaLandObject);
const northAmericaContextGeometry = northAmericaLandFeature.type === 'Feature'
  ? northAmericaLandFeature.geometry
  : null;
if (!northAmericaContextGeometry) throw new Error('PROVINCE_MAP_WORLD_10M_CONTEXT_REQUIRED');

export function createProvinceMapWorldOutlinePath(projection: ProvinceMapProjection) {
  return provinceGeometryPath(northAmericaContextGeometry, projection);
}

export function createProvinceMapMainlandFocusBounds(projection: ProvinceMapProjection): ProvinceMapMainlandFocusBounds {
  return {
    minX: 0,
    minY: 0,
    maxX: projection.width,
    maxY: projection.height,
  };
}
