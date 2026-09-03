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

type TraversalRole = 'forward' | 'return';
interface TraversalSpec {
  laneOwnerId: string;
  participantId: string;
  role: TraversalRole;
  sortKey: string;
  mode: TransportModeId;
  stops: string[];
}

const DEFAULT_LANE_GAP = 4.5;
const POINT_EPSILON = 1e-6;

function provinceEdgeKey(left: string, right: string) {
  return left < right ? `${left}:${right}` : `${right}:${left}`;
}

export function provinceMapPhysicalRouteEdgeKey(mode: TransportModeId, left: string, right: string) {
  return `${mode}|${provinceEdgeKey(left, right)}`;
}

function canonicalEdgePoints(
  left: string,
  right: string,
  mode: TransportModeId,
  pointByProvinceId: ReadonlyMap<string, ProvinceMapPoint>,
  physicalPathByEdge: ProvinceMapPhysicalPathMap,
) {
  const [fromProvinceId, toProvinceId] = left < right ? [left, right] : [right, left];
  const networkPoints = physicalPathByEdge.get(provinceMapPhysicalRouteEdgeKey(mode, fromProvinceId, toProvinceId));
  if (networkPoints && networkPoints.length >= 2) return { points: networkPoints, networkGeometry: true };
  const from = pointByProvinceId.get(fromProvinceId);
  const to = pointByProvinceId.get(toProvinceId);
  if (!from || !to) return null;
  return { points: [from, to], networkGeometry: false };
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

function localNormal(points: ProvinceMapPoint[], index: number) {
  const previous = points[Math.max(0, index - 1)];
  const next = points[Math.min(points.length - 1, index + 1)];
  const dx = next.x - previous.x;
  const dy = next.y - previous.y;
  const length = Math.hypot(dx, dy);
  if (!(length > POINT_EPSILON)) return { x: 0, y: 0 };
  return { x: -dy / length, y: dx / length };
}

function offsetPolyline(points: ProvinceMapPoint[], offset: number) {
  if (Math.abs(offset) <= POINT_EPSILON) return points.map((point) => ({ ...point }));
  return points.map((point, index) => {
    const normal = localNormal(points, index);
    return { x: point.x + normal.x * offset, y: point.y + normal.y * offset };
  });
}

function formatGeometryValue(value: number) {
  const rounded = Number(value.toFixed(2));
  return Object.is(rounded, -0) ? 0 : rounded;
}

function pathForPoints(points: ProvinceMapPoint[]) {
  return points.map((point, index) => `${index === 0 ? 'M' : 'L'}${formatGeometryValue(point.x)} ${formatGeometryValue(point.y)}`).join(' ');
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

function routeTraversals(input: ProvinceMapRouteLayoutInput): TraversalSpec[] {
  const forward: TraversalSpec = {
    laneOwnerId: input.laneOwnerId,
    participantId: `${input.laneOwnerId}:forward`,
    role: 'forward',
    sortKey: `${input.sortKey}:0`,
    mode: input.mode,
    stops: input.stops,
  };
  if (input.closed || input.tripType !== 'round') return [forward];
  return [forward, {
    laneOwnerId: input.laneOwnerId,
    participantId: `${input.laneOwnerId}:return`,
    role: 'return',
    sortKey: `${input.sortKey}:1`,
    mode: input.mode,
    stops: [...input.stops].reverse(),
  }];
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
  traversal: TraversalSpec,
  pointByProvinceId: ReadonlyMap<string, ProvinceMapPoint>,
  physicalPathByEdge: ProvinceMapPhysicalPathMap,
  offsetByParticipantAndEdge: ReadonlyMap<string, number>,
): ProvinceMapRouteTraversalLayout {
  const segments: ProvinceMapRouteSegmentLayout[] = [];
  for (let index = 0; index < traversal.stops.length - 1; index += 1) {
    const fromProvinceId = traversal.stops[index];
    const toProvinceId = traversal.stops[index + 1];
    const canonical = canonicalEdgePoints(fromProvinceId, toProvinceId, traversal.mode, pointByProvinceId, physicalPathByEdge);
    if (!canonical) continue;
    const key = provinceMapPhysicalRouteEdgeKey(traversal.mode, fromProvinceId, toProvinceId);
    const laneOffset = offsetByParticipantAndEdge.get(`${traversal.participantId}|${key}`) ?? 0;
    const shiftedCanonical = offsetPolyline(canonical.points, laneOffset);
    const points = fromProvinceId < toProvinceId ? shiftedCanonical : [...shiftedCanonical].reverse();
    if (points.length < 2) continue;
    segments.push({
      fromProvinceId,
      toProvinceId,
      start: points[0],
      end: points[points.length - 1],
      points,
      laneOffset,
      networkGeometry: canonical.networkGeometry,
    });
  }

  if (segments.length < 1) return { points: [], path: '', segments: [] };
  const pathPoints: ProvinceMapPoint[] = [];
  for (const segment of segments) {
    if (pathPoints.length === 0) pathPoints.push(...segment.points);
    else pathPoints.push(...segment.points);
  }
  const stopPoints = traversal.stops.flatMap((provinceId) => {
    const point = pointByProvinceId.get(provinceId);
    return point ? [point] : [];
  });
  return { points: stopPoints, path: pathForPoints(pathPoints), segments };
}

export function layoutProvinceMapRoutes(
  inputs: ProvinceMapRouteLayoutInput[],
  pointByProvinceId: ReadonlyMap<string, ProvinceMapPoint>,
  physicalPathByEdge: ProvinceMapPhysicalPathMap = new Map(),
  laneGap = DEFAULT_LANE_GAP,
): ProvinceMapRouteLayoutResult {
  const canonical = canonicalInputs(inputs).filter((input) => input.stops.length >= 2);
  const traversals = canonical.flatMap(routeTraversals);
  const participantsByEdge = new Map<string, Map<string, TraversalSpec>>();

  for (const traversal of traversals) {
    for (let index = 0; index < traversal.stops.length - 1; index += 1) {
      const key = provinceMapPhysicalRouteEdgeKey(traversal.mode, traversal.stops[index], traversal.stops[index + 1]);
      const participants = participantsByEdge.get(key) ?? new Map<string, TraversalSpec>();
      participants.set(traversal.participantId, traversal);
      participantsByEdge.set(key, participants);
    }
  }

  const offsetByParticipantAndEdge = new Map<string, number>();
  const laneCountByEdge = new Map<string, number>();
  for (const [key, participantMap] of participantsByEdge) {
    const participants = [...participantMap.values()].sort((left, right) => {
      const sort = left.sortKey.localeCompare(right.sortKey);
      return sort !== 0 ? sort : left.participantId.localeCompare(right.participantId);
    });
    laneCountByEdge.set(key, participants.length);
    participants.forEach((participant, index) => {
      const laneIndex = index - (participants.length - 1) / 2;
      offsetByParticipantAndEdge.set(`${participant.participantId}|${key}`, laneIndex * laneGap);
    });
  }

  const byLaneOwnerId = new Map<string, ProvinceMapRouteLayout>();
  for (const input of canonical) {
    const traversalSpecs = routeTraversals(input);
    const forward = buildTraversal(traversalSpecs[0], pointByProvinceId, physicalPathByEdge, offsetByParticipantAndEdge);
    const returnPath = traversalSpecs[1]
      ? buildTraversal(traversalSpecs[1], pointByProvinceId, physicalPathByEdge, offsetByParticipantAndEdge)
      : null;
    byLaneOwnerId.set(input.laneOwnerId, { laneOwnerId: input.laneOwnerId, forward, returnPath });
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
  return layout.forward.segments.find((segment) => segment.fromProvinceId === fromProvinceId && segment.toProvinceId === toProvinceId)
    ?? layout.returnPath?.segments.find((segment) => segment.fromProvinceId === fromProvinceId && segment.toProvinceId === toProvinceId)
    ?? null;
}
