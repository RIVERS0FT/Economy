import type { TransportTripType } from '../../types';

export interface ProvinceMapPoint {
  x: number;
  y: number;
}

export interface ProvinceMapRouteLayoutInput {
  id: string;
  laneOwnerId: string;
  sortKey: string;
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
  laneOffset: number;
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
  stops: string[];
}

interface RawSegment extends ProvinceMapRouteSegmentLayout {
  originalVertexFrom: ProvinceMapPoint;
  originalVertexTo: ProvinceMapPoint;
}

const DEFAULT_LANE_GAP = 3.5;
const MITER_LIMIT_MULTIPLIER = 3.5;

function edgeKey(left: string, right: string) {
  return left < right ? `${left}:${right}` : `${right}:${left}`;
}

function canonicalEdgePoints(
  left: string,
  right: string,
  pointByProvinceId: ReadonlyMap<string, ProvinceMapPoint>,
) {
  const [fromProvinceId, toProvinceId] = left < right ? [left, right] : [right, left];
  const from = pointByProvinceId.get(fromProvinceId);
  const to = pointByProvinceId.get(toProvinceId);
  if (!from || !to) return null;
  return { from, to };
}

function canonicalNormal(
  left: string,
  right: string,
  pointByProvinceId: ReadonlyMap<string, ProvinceMapPoint>,
) {
  const points = canonicalEdgePoints(left, right, pointByProvinceId);
  if (!points) return null;
  const dx = points.to.x - points.from.x;
  const dy = points.to.y - points.from.y;
  const length = Math.hypot(dx, dy);
  if (!(length > 0)) return null;
  return { x: -dy / length, y: dx / length };
}

function shifted(point: ProvinceMapPoint, normal: ProvinceMapPoint, offset: number): ProvinceMapPoint {
  return { x: point.x + normal.x * offset, y: point.y + normal.y * offset };
}

function midpoint(left: ProvinceMapPoint, right: ProvinceMapPoint): ProvinceMapPoint {
  return { x: (left.x + right.x) / 2, y: (left.y + right.y) / 2 };
}

function distance(left: ProvinceMapPoint, right: ProvinceMapPoint) {
  return Math.hypot(right.x - left.x, right.y - left.y);
}

function lineIntersection(
  firstStart: ProvinceMapPoint,
  firstEnd: ProvinceMapPoint,
  secondStart: ProvinceMapPoint,
  secondEnd: ProvinceMapPoint,
): ProvinceMapPoint | null {
  const ax = firstEnd.x - firstStart.x;
  const ay = firstEnd.y - firstStart.y;
  const bx = secondEnd.x - secondStart.x;
  const by = secondEnd.y - secondStart.y;
  const denominator = ax * by - ay * bx;
  if (Math.abs(denominator) < 1e-6) return null;
  const cx = secondStart.x - firstStart.x;
  const cy = secondStart.y - firstStart.y;
  const t = (cx * by - cy * bx) / denominator;
  return { x: firstStart.x + ax * t, y: firstStart.y + ay * t };
}

function formatGeometryValue(value: number) {
  const rounded = Number(value.toFixed(2));
  return Object.is(rounded, -0) ? 0 : rounded;
}

function pathForPoints(points: ProvinceMapPoint[]) {
  return points.map((point, index) => `${index === 0 ? 'M' : 'L'}${formatGeometryValue(point.x)} ${formatGeometryValue(point.y)}`).join(' ');
}

function routeTraversals(input: ProvinceMapRouteLayoutInput): TraversalSpec[] {
  const forward: TraversalSpec = {
    laneOwnerId: input.laneOwnerId,
    participantId: `${input.laneOwnerId}:forward`,
    role: 'forward',
    sortKey: `${input.sortKey}:0`,
    stops: input.stops,
  };
  if (input.closed || input.tripType !== 'round') return [forward];
  return [
    forward,
    {
      laneOwnerId: input.laneOwnerId,
      participantId: `${input.laneOwnerId}:return`,
      role: 'return',
      sortKey: `${input.sortKey}:1`,
      stops: [...input.stops].reverse(),
    },
  ];
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
  offsetByParticipantAndEdge: ReadonlyMap<string, number>,
  laneGap: number,
): ProvinceMapRouteTraversalLayout {
  const rawSegments: RawSegment[] = [];
  for (let index = 0; index < traversal.stops.length - 1; index += 1) {
    const fromProvinceId = traversal.stops[index];
    const toProvinceId = traversal.stops[index + 1];
    const from = pointByProvinceId.get(fromProvinceId);
    const to = pointByProvinceId.get(toProvinceId);
    const normal = canonicalNormal(fromProvinceId, toProvinceId, pointByProvinceId);
    if (!from || !to || !normal) continue;
    const segmentEdgeKey = edgeKey(fromProvinceId, toProvinceId);
    const laneOffset = offsetByParticipantAndEdge.get(`${traversal.participantId}|${segmentEdgeKey}`) ?? 0;
    rawSegments.push({
      fromProvinceId,
      toProvinceId,
      start: shifted(from, normal, laneOffset),
      end: shifted(to, normal, laneOffset),
      laneOffset,
      originalVertexFrom: from,
      originalVertexTo: to,
    });
  }
  if (rawSegments.length < 1) return { points: [], path: '', segments: [] };

  const pathPoints: ProvinceMapPoint[] = [rawSegments[0].start];
  for (let index = 1; index < rawSegments.length; index += 1) {
    const previous = rawSegments[index - 1];
    const current = rawSegments[index];
    const fallback = midpoint(previous.end, current.start);
    const intersection = lineIntersection(previous.start, previous.end, current.start, current.end);
    const originalVertex = previous.originalVertexTo;
    const maxLaneOffset = Math.max(Math.abs(previous.laneOffset), Math.abs(current.laneOffset));
    const miterLimit = Math.max(laneGap * MITER_LIMIT_MULTIPLIER, maxLaneOffset * MITER_LIMIT_MULTIPLIER + laneGap);
    pathPoints.push(intersection && distance(intersection, originalVertex) <= miterLimit ? intersection : fallback);
  }
  pathPoints.push(rawSegments[rawSegments.length - 1].end);

  const segments = rawSegments.map((segment, index) => ({
    fromProvinceId: segment.fromProvinceId,
    toProvinceId: segment.toProvinceId,
    start: pathPoints[index],
    end: pathPoints[index + 1],
    laneOffset: segment.laneOffset,
  }));
  const points = traversal.stops.flatMap((provinceId) => {
    const point = pointByProvinceId.get(provinceId);
    return point ? [point] : [];
  });
  return { points, path: pathForPoints(pathPoints), segments };
}

export function layoutProvinceMapRoutes(
  inputs: ProvinceMapRouteLayoutInput[],
  pointByProvinceId: ReadonlyMap<string, ProvinceMapPoint>,
  laneGap = DEFAULT_LANE_GAP,
): ProvinceMapRouteLayoutResult {
  const canonical = canonicalInputs(inputs).filter((input) => input.stops.length >= 2);
  const traversals = canonical.flatMap(routeTraversals);
  const participantsByEdge = new Map<string, Map<string, TraversalSpec>>();

  for (const traversal of traversals) {
    for (let index = 0; index < traversal.stops.length - 1; index += 1) {
      const key = edgeKey(traversal.stops[index], traversal.stops[index + 1]);
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
    const forward = buildTraversal(traversalSpecs[0], pointByProvinceId, offsetByParticipantAndEdge, laneGap);
    const returnPath = traversalSpecs[1]
      ? buildTraversal(traversalSpecs[1], pointByProvinceId, offsetByParticipantAndEdge, laneGap)
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
