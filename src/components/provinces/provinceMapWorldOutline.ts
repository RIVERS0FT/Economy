import { feature } from 'topojson-client';
import worldLandAtlas from 'world-atlas/land-10m.json';
import { provinceGeometryPath, type ProvinceMapProjection } from './provinceMapProjection';

export interface ProvinceMapMainlandFocusBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

// world-atlas@2.0.2 land-10m.json is derived from Natural Earth 1:10m public-domain land data.
// This layer has no gameplay identity; the contiguous-US interaction layer remains us-atlas states-10m.
const worldTopology = worldLandAtlas as unknown as Parameters<typeof feature>[0];
const worldLandObject = (worldLandAtlas as unknown as {
  objects: { land: Parameters<typeof feature>[1] };
}).objects.land;
const worldLandFeature = feature(worldTopology, worldLandObject);
const worldLandGeometries = worldLandFeature.type === 'FeatureCollection'
  ? worldLandFeature.features.map((entry) => entry.geometry)
  : [worldLandFeature.geometry];

export function createProvinceMapWorldOutlinePath(projection: ProvinceMapProjection) {
  return worldLandGeometries
    .map((geometry) => provinceGeometryPath(geometry, projection))
    .filter(Boolean)
    .join(' ');
}

export function createProvinceMapMainlandFocusBounds(projection: ProvinceMapProjection): ProvinceMapMainlandFocusBounds {
  return {
    minX: 0,
    minY: 0,
    maxX: projection.width,
    maxY: projection.height,
  };
}
