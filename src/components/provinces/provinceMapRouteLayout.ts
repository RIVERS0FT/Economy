import type { TransportModeId, TransportTripType } from '../../types';

export interface ProvinceMapPoint { x: number; y: number; }
export type ProvinceMapPhysicalPathMap = ReadonlyMap<string, ProvinceMapPoint[]>;

export interface ProvinceMapRouteLayoutInput {
  id: string;
  laneOwnerId: string;
  sortKey: string;
  mode: TransportModeId;
  stops: string[];
  closed: boolean;
  tripType: TransportTripType;
  kind: 'draft' | 'saved' | 'highlight';
}

export interface ProvinceMapRouteSegmentLayout {
  fromProvinceId: string;
  toProvinceId: string;
  start: ProvinceMapPoint;
  end: ProvinceMapPoint;
  points: ProvinceMapPoint[];
  laneOffset: number;
  networkGeometry: boolean;
  airControlPoint?: ProvinceMapPoint;
}

export interface ProvinceMapRouteTraversalLayout {
  points: ProvinceMapPoint[];
  path: string;
  segments: ProvinceMapRouteSegmentLayout[];
}

export interface ProvinceMapRouteLayout {
  laneOwnerId: string;
  forward: ProvinceMapRouteTraversalLayout;
  returnPath: ProvinceMapRouteTraversalLayout | null;
}

export interface ProvinceMapRouteLayoutResult {
  byOverlayId: Map<string, ProvinceMapRouteLayout>;
  byLaneOwnerId: Map<string, ProvinceMapRouteLayout>;
  laneCountByEdge: Map<string, number>;
}

const POINT_EPSILON = 1e-6;
const AIR_CURVE_RATIO = 0.16;
const AIR_CURVE_MIN = 18;
const AIR_CURVE_MAX = 120;
const AIR_SAMPLE_STEPS = 28;

function provinceEdgeKey(left: string, right: string) {
  return left < right ? `${left}:${right}` : `${right}:${left}`;
}

export function provinceMapPhysicalRouteEdgeKey(mode: TransportModeId, left: string, right: string) {
  return `${mode}|${provinceEdgeKey(left, right)}`;
}

function quadraticPoint(start: ProvinceMapPoint, control: ProvinceMapPoint, end: ProvinceMapPoint, t: number) {
  const inverse = 1 - t;
  return {
    x: inverse * inverse * start.x + 2 * inverse * t * control.x + t * t * end.x,
    y: inverse * inverse * start.y + 2 * inverse * t * control.y + t * t * end.y,
  };
}

export function provinceMapAirRouteControlPoint(start: ProvinceMapPoint, end: ProvinceMapPoint) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.max(POINT_EPSILON, Math.hypot(dx, dy));
  const lift = Math.max(AIR_CURVE_MIN, Math.min(AIR_CURVE_MAX, length * AIR_CURVE_RATIO));
  return {
    x: (start.x + end.x) / 2 - (dy / length) * lift,
    y: (start.y + end.y) / 2 + (dx / length) * lift,
  };
}

function airRouteGeometry(start: ProvinceMapPoint, end: ProvinceMapPoint) {
  const control = provinceMapAirRouteControlPoint(start, end);
  const points = Array.from({ length: AIR_SAMPLE_STEPS + 1 }, (_, index) => (
    quadraticPoint(start, control, end, index / AIR_SAMPLE_STEPS)
  ));
  return { points, control };
}

function canonicalEdgePoints(
  left: string,
  right: string,
  mode: TransportModeId,
  pointByProvinceId: ReadonlyMap<string, ProvinceMapPoint>,
  physicalPathByEdge: ProvinceMapPhysicalPathMap,
) {
  const [fromProvinceId, toProvinceId] = left < right ? [left, right] : [right, left];
  const from = pointByProvinceId.get(fromProvinceId);
  const to = pointByProvinceId.get(toProvinceId);
  if (!from || !to) return null;
  if (mode === 'air') {
    const air = airRouteGeometry(from, to);
    return { points: air.points, networkGeometry: false, airControlPoint: air.control };
  }
  const networkPoints = physicalPathByEdge.get(provinceMapPhysicalRouteEdgeKey(mode, fromProvinceId, toProvinceId));
  if (networkPoints && networkPoints.length >= 2) {
    return { points: networkPoints, networkGeometry: true, airControlPoint: undefined };
  }
  return { points: [from, to], networkGeometry: false, airControlPoint: undefined };
}

export function provinceMapRouteBasePointsForDirection(
  mode: TransportModeId,
  fromProvinceId: string,
  toProvinceId: string,
  pointByProvinceId: ReadonlyMap<string, ProvinceMapPoint>,
  physicalPathByEdge: ProvinceMapPhysicalPathMap = new Map(),
) {
  const canonical = canonicalEdgePoints(fromProvinceId, toProvinceId, mode, pointByProvinceId, physicalPathByEdge);
  if (!canonical) return null;
  return fromProvinceId < toProvinceId
    ? { points: canonical.points, networkGeometry: canonical.networkGeometry }
    : { points: [...canonical.points].reverse(), networkGeometry: canonical.networkGeometry };
}

function formatGeometryValue(value: number) {
  const rounded = Number(value.toFixed(2));
  return Object.is(rounded, -0) ? 0 : rounded;
}

function pathForPoints(points: ProvinceMapPoint[]) {
  return points.map((point, index) => `${index === 0 ? 'M' : 'L'}${formatGeometryValue(point.x)} ${formatGeometryValue(point.y)}`).join(' ');
}

function pathForSegment(segment: ProvinceMapRouteSegmentLayout, mode: TransportModeId) {
  if (mode === 'air' && segment.airControlPoint) {
    return `M${formatGeometryValue(segment.start.x)} ${formatGeometryValue(segment.start.y)} Q${formatGeometryValue(segment.airControlPoint.x)} ${formatGeometryValue(segment.airControlPoint.y)} ${formatGeometryValue(segment.end.x)} ${formatGeometryValue(segment.end.y)}`;
  }
  return pathForPoints(segment.points);
}

export function provinceMapPointAlongPolyline(points: ProvinceMapPoint[], progress: number) {
  if (points.length < 1) return null;
  if (points.length === 1) return points[0];
  const clamped = Math.max(0, Math.min(1, progress));
  const segmentLengths: number[] = [];
  let totalLength = 0;
  for (let index = 1; index < points.length; index += 1) {
    const length = Math.hypot(points[index].x - points[index - 1].x, points[index].y - points[index - 1].y);
    segmentLengths.push(length);
    totalLength += length;
  }
  if (!(totalLength > POINT_EPSILON)) return points[points.length - 1];
  const targetLength = totalLength * clamped;
  let traversed = 0;
  for (let index = 0; index < segmentLengths.length; index += 1) {
    const segmentLength = segmentLengths[index];
    if (traversed + segmentLength < targetLength && index < segmentLengths.length - 1) {
      traversed += segmentLength;
      continue;
    }
    const localProgress = segmentLength > POINT_EPSILON ? (targetLength - traversed) / segmentLength : 1;
    const start = points[index];
    const end = points[index + 1];
    return {
      x: start.x + (end.x - start.x) * localProgress,
      y: start.y + (end.y - start.y) * localProgress,
    };
  }
  return points[points.length - 1];
}

function canonicalInputs(inputs: ProvinceMapRouteLayoutInput[]) {
  const candidatesByOwner = new Map<string, ProvinceMapRouteLayoutInput[]>();
  for (const input of inputs) {
    const candidates = candidatesByOwner.get(input.laneOwnerId) ?? [];
    candidates.push(input);
    candidatesByOwner.set(input.laneOwnerId, candidates);
  }
  const kindRank = { saved: 0, draft: 1, highlight: 2 } as const;
  return [...candidatesByOwner.values()].map((candidates) => [...candidates].sort((left, right) => {
    const rank = kindRank[left.kind] - kindRank[right.kind];
    if (rank !== 0) return rank;
    const sort = left.sortKey.localeCompare(right.sortKey);
    return sort !== 0 ? sort : left.id.localeCompare(right.id);
  })[0]);
}

function buildTraversal(
  input: ProvinceMapRouteLayoutInput,
  pointByProvinceId: ReadonlyMap<string, ProvinceMapPoint>,
  physicalPathByEdge: ProvinceMapPhysicalPathMap,
): ProvinceMapRouteTraversalLayout {
  const segments: ProvinceMapRouteSegmentLayout[] = [];
  for (let index = 0; index < input.stops.length - 1; index += 1) {
    const fromProvinceId = input.stops[index];
    const toProvinceId = input.stops[index + 1];
    const canonical = canonicalEdgePoints(fromProvinceId, toProvinceId, input.mode, pointByProvinceId, physicalPathByEdge);
    if (!canonical) continue;
    const points = fromProvinceId < toProvinceId ? canonical.points : [...canonical.points].reverse();
    if (points.length < 2) continue;
    segments.push({
      fromProvinceId,
      toProvinceId,
      start: points[0],
      end: points[points.length - 1],
      points,
      laneOffset: 0,
      networkGeometry: canonical.networkGeometry,
      airControlPoint: canonical.airControlPoint,
    });
  }
  const stopPoints = input.stops.flatMap((provinceId) => {
    const point = pointByProvinceId.get(provinceId);
    return point ? [point] : [];
  });
  return {
    points: stopPoints,
    path: segments.map((segment) => pathForSegment(segment, input.mode)).join(' '),
    segments,
  };
}

export function layoutProvinceMapRoutes(
  inputs: ProvinceMapRouteLayoutInput[],
  pointByProvinceId: ReadonlyMap<string, ProvinceMapPoint>,
  physicalPathByEdge: ProvinceMapPhysicalPathMap = new Map(),
  _laneGap = 0,
): ProvinceMapRouteLayoutResult {
  const canonical = canonicalInputs(inputs).filter((input) => input.stops.length >= 2);
  const byLaneOwnerId = new Map<string, ProvinceMapRouteLayout>();
  const laneCountByEdge = new Map<string, number>();

  for (const input of canonical) {
    const forward = buildTraversal(input, pointByProvinceId, physicalPathByEdge);
    byLaneOwnerId.set(input.laneOwnerId, { laneOwnerId: input.laneOwnerId, forward, returnPath: null });
    for (let index = 0; index < input.stops.length - 1; index += 1) {
      laneCountByEdge.set(provinceMapPhysicalRouteEdgeKey(input.mode, input.stops[index], input.stops[index + 1]), 1);
    }
  }

  const byOverlayId = new Map<string, ProvinceMapRouteLayout>();
  for (const input of inputs) {
    const layout = byLaneOwnerId.get(input.laneOwnerId);
    if (layout) byOverlayId.set(input.id, layout);
  }
  return { byOverlayId, byLaneOwnerId, laneCountByEdge };
}

export function routeLayoutSegmentForDirection(
  layout: ProvinceMapRouteLayout,
  fromProvinceId: string,
  toProvinceId: string,
) {
  const direct = layout.forward.segments.find((segment) => segment.fromProvinceId === fromProvinceId && segment.toProvinceId === toProvinceId);
  if (direct) return direct;
  const reverse = layout.forward.segments.find((segment) => segment.fromProvinceId === toProvinceId && segment.toProvinceId === fromProvinceId);
  if (!reverse) return null;
  return {
    ...reverse,
    fromProvinceId,
    toProvinceId,
    start: reverse.end,
    end: reverse.start,
    points: [...reverse.points].reverse(),
  };
}
