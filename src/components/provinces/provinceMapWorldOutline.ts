import { feature } from 'topojson-client';
import northAmericaCoastline110m from '../../data/north-america-coastline-110m.json';
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
const northAmericaLandTopology = northAmericaLand10m as unknown as Parameters<typeof feature>[0];
const northAmericaLandObject = (northAmericaLand10m as unknown as {
  objects: { land: Parameters<typeof feature>[1] };
}).objects.land;
const northAmericaLandFeature = feature(northAmericaLandTopology, northAmericaLandObject);
const northAmericaContextGeometry = northAmericaLandFeature.type === 'Feature'
  ? northAmericaLandFeature.geometry
  : null;
if (!northAmericaContextGeometry) throw new Error('PROVINCE_MAP_WORLD_10M_CONTEXT_REQUIRED');

// Stroke tessellation dominates viewBox camera frames. Use the matching pruned 110m
// Natural Earth geometry only for the two low-contrast background strokes; the land
// fill and the interactive contiguous-US boundary remain on their 10m sources.
const northAmericaCoastlineTopology = northAmericaCoastline110m as unknown as Parameters<typeof feature>[0];
const northAmericaCoastlineObject = (northAmericaCoastline110m as unknown as {
  objects: { land: Parameters<typeof feature>[1] };
}).objects.land;
const northAmericaCoastlineFeature = feature(northAmericaCoastlineTopology, northAmericaCoastlineObject);
const northAmericaCoastlineGeometry = northAmericaCoastlineFeature.type === 'Feature'
  ? northAmericaCoastlineFeature.geometry
  : null;
if (!northAmericaCoastlineGeometry) throw new Error('PROVINCE_MAP_WORLD_110M_COASTLINE_REQUIRED');

export function createProvinceMapWorldFillPath(projection: ProvinceMapProjection) {
  return provinceGeometryPath(northAmericaContextGeometry, projection);
}

export function createProvinceMapWorldStrokePath(projection: ProvinceMapProjection) {
  return provinceGeometryPath(northAmericaCoastlineGeometry, projection);
}

export function createProvinceMapMainlandFocusBounds(projection: ProvinceMapProjection): ProvinceMapMainlandFocusBounds {
  return {
    minX: 0,
    minY: 0,
    maxX: projection.width,
    maxY: projection.height,
  };
}
