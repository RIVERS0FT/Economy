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

function projectedRing(value: unknown, projection: ProvinceMapProjection) {
  if (!Array.isArray(value)) return [] as ProvinceMapPoint[];
  return value.filter(isCoordinate).map((coordinate) => projection.project(coordinate));
}

function pathForProjectedRing(points: ProvinceMapPoint[]) {
  if (points.length < 3) return '';
  return points.map((point, index) => (
    `${index === 0 ? 'M' : 'L'}${formatPathValue(point.x)} ${formatPathValue(point.y)}`
  )).join(' ') + ' Z';
}

function ringPath(value: unknown, projection: ProvinceMapProjection) {
  return pathForProjectedRing(projectedRing(value, projection));
}

function pointDistanceSquared(left: ProvinceMapPoint, right: ProvinceMapPoint) {
  const dx = right.x - left.x;
  const dy = right.y - left.y;
  return dx * dx + dy * dy;
}

function segmentDistanceSquared(point: ProvinceMapPoint, start: ProvinceMapPoint, end: ProvinceMapPoint) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (dx === 0 && dy === 0) return pointDistanceSquared(point, start);
  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / (dx * dx + dy * dy)));
  const projected = { x: start.x + dx * t, y: start.y + dy * t };
  return pointDistanceSquared(point, projected);
}

function simplifyOpenPoints(points: ProvinceMapPoint[], toleranceSquared: number) {
  if (points.length <= 2) return [...points];
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const stack: Array<[number, number]> = [[0, points.length - 1]];
  while (stack.length > 0) {
    const [startIndex, endIndex] = stack.pop()!;
    let farthestIndex = -1;
    let farthestDistance = toleranceSquared;
    for (let index = startIndex + 1; index < endIndex; index += 1) {
      const distance = segmentDistanceSquared(points[index], points[startIndex], points[endIndex]);
      if (distance > farthestDistance) {
        farthestDistance = distance;
        farthestIndex = index;
      }
    }
    if (farthestIndex < 0) continue;
    keep[farthestIndex] = 1;
    stack.push([startIndex, farthestIndex], [farthestIndex, endIndex]);
  }
  return points.filter((_, index) => keep[index] === 1);
}

function simplifyClosedRing(points: ProvinceMapPoint[], tolerance: number) {
  if (points.length < 4 || !(tolerance > 0)) return points;
  const normalized = [...points];
  if (pointDistanceSquared(normalized[0], normalized[normalized.length - 1]) < 0.0001) normalized.pop();
  if (normalized.length < 4) return normalized;

  let splitIndex = 1;
  let splitDistance = 0;
  for (let index = 1; index < normalized.length; index += 1) {
    const distance = pointDistanceSquared(normalized[0], normalized[index]);
    if (distance > splitDistance) {
      splitDistance = distance;
      splitIndex = index;
    }
  }
  const toleranceSquared = tolerance * tolerance;
  const first = simplifyOpenPoints(normalized.slice(0, splitIndex + 1), toleranceSquared);
  const second = simplifyOpenPoints([...normalized.slice(splitIndex), normalized[0]], toleranceSquared);
  const merged = [...first, ...second.slice(1, -1)];
  return merged.length >= 3 ? merged : normalized;
}

function simplifiedRingPath(value: unknown, projection: ProvinceMapProjection, tolerance: number) {
  return pathForProjectedRing(simplifyClosedRing(projectedRing(value, projection), tolerance));
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

export function provinceGeometrySimplifiedPath(
  geometry: unknown,
  projection: ProvinceMapProjection,
  tolerance: number,
) {
  if (!geometry || typeof geometry !== 'object') return '';
  const candidate = geometry as { type?: string; coordinates?: unknown };
  if (candidate.type === 'Polygon' && Array.isArray(candidate.coordinates)) {
    return candidate.coordinates
      .map((ring) => simplifiedRingPath(ring, projection, tolerance))
      .filter(Boolean)
      .join(' ');
  }
  if (candidate.type === 'MultiPolygon' && Array.isArray(candidate.coordinates)) {
    return candidate.coordinates.flatMap((polygon) => (
      Array.isArray(polygon)
        ? polygon.map((ring) => simplifiedRingPath(ring, projection, tolerance)).filter(Boolean)
        : []
    )).join(' ');
  }
  return '';
}

export function projectProvinceRing(value: unknown, projection: ProvinceMapProjection) {
  return projectedRing(value, projection);
}
