import { feature } from 'topojson-client';
import worldLandAtlas from '../../data/world-land-110m.json';
import { provinceGeometryPath, type ProvinceMapProjection } from './provinceMapProjection';

type GeographicPoint = [number, number];

export interface ProvinceMapWorldBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

// Vendored from world-atlas@2.0.2 land-110m.json, derived from Natural Earth
// 1:110m public-domain land boundaries. This layer has no gameplay identity.
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

export function createProvinceMapWorldBounds(projection: ProvinceMapProjection): ProvinceMapWorldBounds {
  const corners: GeographicPoint[] = [
    [-180, 90],
    [180, 90],
    [180, -90],
    [-180, -90],
  ];
  const points = corners.map((coordinate) => projection.project(coordinate));
  return {
    minX: Math.min(...points.map((point) => point.x)),
    minY: Math.min(...points.map((point) => point.y)),
    maxX: Math.max(...points.map((point) => point.x)),
    maxY: Math.max(...points.map((point) => point.y)),
  };
}
