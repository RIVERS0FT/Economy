export const PROVINCE_MAP_ASPECT_SCALE = 0.75;
export const PROVINCE_MAP_WORLD_WIDTH = 1200;
export const PROVINCE_MAP_CONTAIN_INSET = 0.96;

export interface ProvinceMapPoint {
  x: number;
  y: number;
}

export interface ProvinceMapProjection {
  width: number;
  height: number;
  viewWidth: number;
  viewHeight: number;
  aspect: number;
  viewBox: string;
  project: (coordinate: [number, number]) => ProvinceMapPoint;
}

interface CoordinateBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

function isCoordinate(value: unknown): value is [number, number] {
  return Array.isArray(value)
    && value.length >= 2
    && Number.isFinite(Number(value[0]))
    && Number.isFinite(Number(value[1]));
}

function projectedRawCoordinate(coordinate: [number, number]) {
  return {
    x: Number(coordinate[0]),
    y: -Number(coordinate[1]) / PROVINCE_MAP_ASPECT_SCALE,
  };
}

function coordinateBounds(value: unknown, bounds: CoordinateBounds) {
  if (!Array.isArray(value)) return;
  if (isCoordinate(value)) {
    const point = projectedRawCoordinate(value);
    bounds.minX = Math.min(bounds.minX, point.x);
    bounds.minY = Math.min(bounds.minY, point.y);
    bounds.maxX = Math.max(bounds.maxX, point.x);
    bounds.maxY = Math.max(bounds.maxY, point.y);
    return;
  }
  for (const nested of value) coordinateBounds(nested, bounds);
}

function geometryBounds(value: unknown, bounds: CoordinateBounds) {
  if (!value || typeof value !== 'object') return;
  const geometry = value as { coordinates?: unknown; geometries?: unknown[] };
  coordinateBounds(geometry.coordinates, bounds);
  for (const nested of geometry.geometries || []) geometryBounds(nested, bounds);
}

export function createProvinceMapProjection(geometries: unknown[]): ProvinceMapProjection {
  const bounds: CoordinateBounds = {
    minX: Number.POSITIVE_INFINITY,
    minY: Number.POSITIVE_INFINITY,
    maxX: Number.NEGATIVE_INFINITY,
    maxY: Number.NEGATIVE_INFINITY,
  };
  for (const geometry of geometries) geometryBounds(geometry, bounds);
  const rawWidth = bounds.maxX - bounds.minX;
  const rawHeight = bounds.maxY - bounds.minY;
  if (!(rawWidth > 0) || !(rawHeight > 0)) {
    throw new Error('PROVINCE_MAP_PROJECTION_BOUNDS_REQUIRED');
  }
  const scale = PROVINCE_MAP_WORLD_WIDTH / rawWidth;
  const width = PROVINCE_MAP_WORLD_WIDTH;
  const height = rawHeight * scale;
  const paddingRatio = (1 / PROVINCE_MAP_CONTAIN_INSET - 1) / 2;
  const paddingX = width * paddingRatio;
  const paddingY = height * paddingRatio;
  const viewWidth = width + paddingX * 2;
  const viewHeight = height + paddingY * 2;
  const project = (coordinate: [number, number]) => {
    const raw = projectedRawCoordinate(coordinate);
    return {
      x: (raw.x - bounds.minX) * scale,
      y: (raw.y - bounds.minY) * scale,
    };
  };
  return {
    width,
    height,
    viewWidth,
    viewHeight,
    aspect: width / height,
    viewBox: `${-paddingX} ${-paddingY} ${viewWidth} ${viewHeight}`,
    project,
  };
}

function formatPathValue(value: number) {
  return Number(value.toFixed(2));
}

function ringPath(value: unknown, projection: ProvinceMapProjection) {
  if (!Array.isArray(value)) return '';
  const coordinates = value.filter(isCoordinate);
  if (coordinates.length < 3) return '';
  return coordinates.map((coordinate, index) => {
    const point = projection.project(coordinate);
    return `${index === 0 ? 'M' : 'L'}${formatPathValue(point.x)} ${formatPathValue(point.y)}`;
  }).join(' ') + ' Z';
}

export function provinceGeometryPath(geometry: unknown, projection: ProvinceMapProjection) {
  if (!geometry || typeof geometry !== 'object') return '';
  const candidate = geometry as { type?: string; coordinates?: unknown };
  if (candidate.type === 'Polygon' && Array.isArray(candidate.coordinates)) {
    return candidate.coordinates.map((ring) => ringPath(ring, projection)).filter(Boolean).join(' ');
  }
  if (candidate.type === 'MultiPolygon' && Array.isArray(candidate.coordinates)) {
    return candidate.coordinates.flatMap((polygon) => (
      Array.isArray(polygon)
        ? polygon.map((ring) => ringPath(ring, projection)).filter(Boolean)
        : []
    )).join(' ');
  }
  return '';
}

export function projectProvinceRing(value: unknown, projection: ProvinceMapProjection) {
  if (!Array.isArray(value)) return [] as ProvinceMapPoint[];
  return value
    .filter(isCoordinate)
    .map((coordinate) => projection.project(coordinate));
}
