from pathlib import Path


def replace_once(path: str, old: str, new: str):
    file = Path(path)
    text = file.read_text()
    if old not in text:
        raise SystemExit(f'patch anchor missing in {path}: {old[:120]!r}')
    file.write_text(text.replace(old, new, 1))


route_layout = r'''import type { TransportTripType } from '../../types';

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

const DEFAULT_LANE_GAP = 4.5;
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

  const points: ProvinceMapPoint[] = [rawSegments[0].start];
  for (let index = 1; index < rawSegments.length; index += 1) {
    const previous = rawSegments[index - 1];
    const current = rawSegments[index];
    const fallback = midpoint(previous.end, current.start);
    const intersection = lineIntersection(previous.start, previous.end, current.start, current.end);
    const originalVertex = previous.originalVertexTo;
    const maxLaneOffset = Math.max(Math.abs(previous.laneOffset), Math.abs(current.laneOffset));
    const miterLimit = Math.max(laneGap * MITER_LIMIT_MULTIPLIER, maxLaneOffset * MITER_LIMIT_MULTIPLIER + laneGap);
    points.push(intersection && distance(intersection, originalVertex) <= miterLimit ? intersection : fallback);
  }
  points.push(rawSegments[rawSegments.length - 1].end);

  const segments = rawSegments.map((segment, index) => ({
    fromProvinceId: segment.fromProvinceId,
    toProvinceId: segment.toProvinceId,
    start: points[index],
    end: points[index + 1],
    laneOffset: segment.laneOffset,
  }));
  return { points, path: pathForPoints(points), segments };
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
'''
Path('src/components/provinces/provinceMapRouteLayout.ts').write_text(route_layout)

replace_once(
    'src/components/shell/StrategicWorkspace.tsx',
    "        overlays.push({ id: `saved-${route.mode}-${route.id}`, stops, closed: isTransportRouteClosed(route), tripType: route.tripType ?? 'one-way', kind: 'saved' });",
    "        overlays.push({\n          id: `saved-${route.mode}-${route.id}`,\n          routeId: route.id,\n          laneOwnerId: route.id,\n          sortKey: `${String(route.createdAt).padStart(16, '0')}-${route.id}`,\n          mode: route.mode,\n          stops,\n          closed: isTransportRouteClosed(route),\n          tripType: route.tripType ?? 'one-way',\n          kind: 'saved',\n        });",
)
replace_once(
    'src/components/shell/StrategicWorkspace.tsx',
    "        id: highlightedRoute ? `highlighted-${highlightedRoute.mode}-route` : 'highlighted-route',\n        stops: highlightedStops,",
    "        id: highlightedRoute ? `highlighted-${highlightedRoute.mode}-route` : 'highlighted-route',\n        routeId: highlightedRoute?.id,\n        laneOwnerId: highlightedRoute?.id ?? 'highlighted-route',\n        sortKey: highlightedRoute ? `${String(highlightedRoute.createdAt).padStart(16, '0')}-${highlightedRoute.id}` : 'zzzz-highlighted-route',\n        mode: highlightedRoute?.mode ?? 'road',\n        stops: highlightedStops,",
)
replace_once(
    'src/components/shell/StrategicWorkspace.tsx',
    "        id: `draft-${routeDraft.draft.mode}-route`,\n        stops: draftStops,",
    "        id: `draft-${routeDraft.draft.mode}-route`,\n        laneOwnerId: 'draft-route',\n        sortKey: 'zzzz-draft-route',\n        mode: routeDraft.draft.mode,\n        stops: draftStops,",
)

replace_once(
    'src/components/provinces/UsMainlandMap.tsx',
    "import { createProvinceMapProjection, provinceGeometryPath } from './provinceMapProjection';",
    "import { createProvinceMapProjection, provinceGeometryPath } from './provinceMapProjection';\nimport {\n  layoutProvinceMapRoutes,\n  routeLayoutSegmentForDirection,\n  type ProvinceMapRouteLayout,\n} from './provinceMapRouteLayout';",
)
replace_once(
    'src/components/provinces/UsMainlandMap.tsx',
    "export interface ProvinceMapRouteOverlay {\n  id: string;\n  stops: string[];",
    "export interface ProvinceMapRouteOverlay {\n  id: string;\n  routeId?: string;\n  laneOwnerId: string;\n  sortKey: string;\n  mode: TransportModeId;\n  stops: string[];",
)
old_shipment_position = '''function currentShipmentPosition(shipment: ProvinceMapShipmentOverlay, now: number) {
  if (shipment.legPlan.length < 1) return null;
  const leg = shipment.legPlan.find((candidate) => now >= candidate.departsAt && now < candidate.arrivesAt)
    ?? shipment.legPlan.find((candidate) => now < candidate.arrivesAt)
    ?? shipment.legPlan[shipment.legPlan.length - 1];
  const from = capitalPointByProvinceId.get(leg.fromProvinceId);
  const to = capitalPointByProvinceId.get(leg.toProvinceId);
  if (!from || !to) return null;
  const duration = Math.max(1, leg.arrivesAt - leg.departsAt);
  const progress = Math.max(0, Math.min(1, (now - leg.departsAt) / duration));
  return {
    x: from.x + (to.x - from.x) * progress,
    y: from.y + (to.y - from.y) * progress,
    fromProvinceId: leg.fromProvinceId,
    toProvinceId: leg.toProvinceId,
    remainingLoad: leg.remainingLoad,
  };
}'''
new_shipment_position = '''function currentShipmentPosition(
  shipment: ProvinceMapShipmentOverlay,
  now: number,
  routeLayoutByOwnerId: ReadonlyMap<string, ProvinceMapRouteLayout>,
) {
  if (shipment.legPlan.length < 1) return null;
  const leg = shipment.legPlan.find((candidate) => now >= candidate.departsAt && now < candidate.arrivesAt)
    ?? shipment.legPlan.find((candidate) => now < candidate.arrivesAt)
    ?? shipment.legPlan[shipment.legPlan.length - 1];
  const routeLayout = shipment.routeId ? routeLayoutByOwnerId.get(shipment.routeId) : undefined;
  const laneSegment = routeLayout ? routeLayoutSegmentForDirection(routeLayout, leg.fromProvinceId, leg.toProvinceId) : null;
  const from = laneSegment?.start ?? capitalPointByProvinceId.get(leg.fromProvinceId);
  const to = laneSegment?.end ?? capitalPointByProvinceId.get(leg.toProvinceId);
  if (!from || !to) return null;
  const duration = Math.max(1, leg.arrivesAt - leg.departsAt);
  const progress = Math.max(0, Math.min(1, (now - leg.departsAt) / duration));
  return {
    x: from.x + (to.x - from.x) * progress,
    y: from.y + (to.y - from.y) * progress,
    fromProvinceId: leg.fromProvinceId,
    toProvinceId: leg.toProvinceId,
    remainingLoad: leg.remainingLoad,
  };
}'''
replace_once('src/components/provinces/UsMainlandMap.tsx', old_shipment_position, new_shipment_position)
replace_once(
    'src/components/provinces/UsMainlandMap.tsx',
    "  const hoveredDatum = hoveredProvinceId ? datumByProvinceId.get(hoveredProvinceId) ?? null : null;\n  const hoveredShipment = hoveredShipmentId ? shipmentOverlays.find((shipment) => shipment.id === hoveredShipmentId) ?? null : null;\n  const hoveredShipmentPosition = hoveredShipment ? currentShipmentPosition(hoveredShipment, now) : null;\n  const routePickingActive = Boolean(routePicking?.active);",
    "  const hoveredDatum = hoveredProvinceId ? datumByProvinceId.get(hoveredProvinceId) ?? null : null;\n  const hoveredShipment = hoveredShipmentId ? shipmentOverlays.find((shipment) => shipment.id === hoveredShipmentId) ?? null : null;\n  const routePickingActive = Boolean(routePicking?.active);\n  const routeLayout = useMemo(() => layoutProvinceMapRoutes(routeOverlays, capitalPointByProvinceId), [routeOverlays]);\n  const hoveredShipmentPosition = hoveredShipment ? currentShipmentPosition(hoveredShipment, now, routeLayout.byLaneOwnerId) : null;",
)
old_route_markup = '''  const routeOverlaysMarkup = useMemo(() => routeOverlays.map((overlay) => {
    const points = overlay.stops.map((provinceId) => capitalPointByProvinceId.get(provinceId)).filter((point): point is { x: number; y: number } => Boolean(point));
    if (points.length < 2) return null;
    const forwardPath = points.map((point, index) => `${index === 0 ? 'M' : 'L'}${formatGeometryValue(point.x)} ${formatGeometryValue(point.y)}`).join(' ');
    const returnPoints = overlay.closed || overlay.tripType !== 'round' ? [] : [points[points.length - 1], ...points.slice(1, -1).reverse(), points[0]];
    const returnPath = returnPoints.length < 2 ? '' : returnPoints.map((point, index) => `${index === 0 ? 'M' : 'L'}${formatGeometryValue(point.x)} ${formatGeometryValue(point.y)}`).join(' ');
    return (
      <g key={overlay.id} className="province-map-route" data-route-id={overlay.id} data-route-kind={overlay.kind} data-route-stop-count={overlay.stops.length} data-route-closed={overlay.closed ? 'true' : 'false'} data-route-trip-type={overlay.tripType}>
        <path className="province-map-route-path" d={forwardPath} vectorEffect="non-scaling-stroke" />
        {returnPath ? <path className="province-map-route-return-path" d={returnPath} vectorEffect="non-scaling-stroke" /> : null}
        {points.map((point, index) => (
          <circle key={`${overlay.id}-stop-${index}`} className="province-map-route-stop" data-stop-index={index} data-stop-first={index === 0 ? 'true' : 'false'} data-stop-last={index === points.length - 1 ? 'true' : 'false'} cx={formatGeometryValue(point.x)} cy={formatGeometryValue(point.y)} r={index === 0 || index === points.length - 1 ? 5 : 4} />
        ))}
      </g>
    );
  }), [routeOverlays]);'''
new_route_markup = '''  const routeOverlaysMarkup = useMemo(() => routeOverlays.map((overlay) => {
    const geometry = routeLayout.byOverlayId.get(overlay.id);
    if (!geometry || geometry.forward.points.length < 2) return null;
    const points = geometry.forward.points;
    const forwardPath = geometry.forward.path;
    const returnPath = geometry.returnPath?.path ?? '';
    return (
      <g
        key={overlay.id}
        className="province-map-route"
        data-route-id={overlay.id}
        data-route-owner-id={overlay.routeId ?? overlay.laneOwnerId}
        data-route-lane-owner-id={overlay.laneOwnerId}
        data-route-kind={overlay.kind}
        data-transport-mode={overlay.mode}
        data-route-stop-count={overlay.stops.length}
        data-route-closed={overlay.closed ? 'true' : 'false'}
        data-route-trip-type={overlay.tripType}
        data-route-forward-lanes={geometry.forward.segments.map((segment) => formatGeometryValue(segment.laneOffset)).join(',')}
      >
        <path className="province-map-route-path" d={forwardPath} vectorEffect="non-scaling-stroke" />
        {returnPath ? <path className="province-map-route-return-path" d={returnPath} vectorEffect="non-scaling-stroke" /> : null}
        {points.map((point, index) => (
          <circle key={`${overlay.id}-stop-${index}`} className="province-map-route-stop" data-stop-index={index} data-stop-first={index === 0 ? 'true' : 'false'} data-stop-last={index === points.length - 1 ? 'true' : 'false'} cx={formatGeometryValue(point.x)} cy={formatGeometryValue(point.y)} r={index === 0 || index === points.length - 1 ? 5 : 4} />
        ))}
      </g>
    );
  }), [routeLayout, routeOverlays]);'''
replace_once('src/components/provinces/UsMainlandMap.tsx', old_route_markup, new_route_markup)
replace_once(
    'src/components/provinces/UsMainlandMap.tsx',
    "    const position = currentShipmentPosition(shipment, now);",
    "    const position = currentShipmentPosition(shipment, now, routeLayout.byLaneOwnerId);",
)
replace_once(
    'src/components/provinces/UsMainlandMap.tsx',
    "data-route-picking={routePickingActive ? 'true' : 'false'} data-route-overlay-count={routeOverlays.length} data-shipment-overlay-count={shipmentOverlays.length}",
    "data-route-picking={routePickingActive ? 'true' : 'false'} data-route-overlay-count={routeOverlays.length} data-route-lane-edge-count={routeLayout.laneCountByEdge.size} data-shipment-overlay-count={shipmentOverlays.length}",
)

design_rule = "- 多条运输路线共享同一州际物理区段时，地图几何不得共线覆盖；按无方向的“州 A—州 B”区段统一计算稳定车道，并沿该区段唯一标准法线对称并排。正向、反向和非闭环 `round` 返程分别占用独立车道，创建中的草稿也参与车道分配；卡片 hover／focus 高亮必须复用原路线车道，不得作为新路线再次挤占车道。在途运输标记沿对应路线实际并排后的当前运输段插值。车道几何只在路线集合变化时于静态 SVG 世界坐标系重算，缩放／平移期间仍只复用 `.province-map-camera-surface` 的单一合成变换，不得为避让执行 DOM 测量、高频重投影或相机期重排。\n"
design_anchor = "- 路线线型必须直接表达运输方式而不能只依赖颜色："
replace_once('docs/UI_DESIGN_SYSTEM.md', design_anchor, design_rule + design_anchor)

verifier = r'''import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { layoutProvinceMapRoutes, routeLayoutSegmentForDirection } from '../src/components/provinces/provinceMapRouteLayout.ts';

const read = (path) => readFileSync(path, 'utf8');
const uiDesign = read('docs/UI_DESIGN_SYSTEM.md');
const strategicWorkspace = read('src/components/shell/StrategicWorkspace.tsx');
const mapComponent = read('src/components/provinces/UsMainlandMap.tsx');
const layoutSource = read('src/components/provinces/provinceMapRouteLayout.ts');

for (const text of [
  '地图几何不得共线覆盖',
  '无方向的“州 A—州 B”区段',
  '正向、反向和非闭环 `round` 返程分别占用独立车道',
  '高亮必须复用原路线车道',
  '在途运输标记沿对应路线实际并排后的当前运输段插值',
]) assert.ok(uiDesign.includes(text), `UI 设计缺少运输路线并排规则：${text}`);

for (const text of [
  'laneOwnerId: route.id',
  "laneOwnerId: 'draft-route'",
  'laneOwnerId: highlightedRoute?.id',
  'sortKey:',
  'mode: route.mode',
]) assert.ok(strategicWorkspace.includes(text), `战略地图路线 overlay 缺少稳定车道元数据：${text}`);

for (const text of [
  'layoutProvinceMapRoutes',
  'routeLayoutSegmentForDirection',
  'data-route-lane-owner-id',
  'data-route-forward-lanes',
  'routeLayout.byLaneOwnerId',
  'data-route-lane-edge-count',
]) assert.ok(mapComponent.includes(text), `战略地图缺少并排路线渲染：${text}`);

for (const text of [
  'canonicalNormal',
  'participantsByEdge',
  'laneIndex = index - (participants.length - 1) / 2',
  'MITER_LIMIT_MULTIPLIER',
  'returnPath',
]) assert.ok(layoutSource.includes(text), `路线布局算法缺少稳定车道边界：${text}`);

const points = new Map([
  ['A', { x: 0, y: 0 }],
  ['B', { x: 100, y: 0 }],
  ['C', { x: 200, y: 50 }],
  ['D', { x: 100, y: 100 }],
]);
const route = (id, stops, extras = {}) => ({
  id,
  laneOwnerId: id,
  sortKey: id,
  stops,
  closed: false,
  tripType: 'one-way',
  kind: 'saved',
  ...extras,
});

const sameDirection = layoutProvinceMapRoutes([
  route('route-1', ['A', 'B']),
  route('route-2', ['A', 'B']),
], points);
const sameFirst = sameDirection.byLaneOwnerId.get('route-1');
const sameSecond = sameDirection.byLaneOwnerId.get('route-2');
assert.ok(sameFirst && sameSecond);
assert.notEqual(sameFirst.forward.path, sameSecond.forward.path, '同一区段的两条路线不得共线');
assert.equal(sameDirection.laneCountByEdge.get('A:B'), 2);
assert.equal(sameFirst.forward.segments[0].laneOffset, -sameSecond.forward.segments[0].laneOffset);

const reverseDirection = layoutProvinceMapRoutes([
  route('route-1', ['A', 'B']),
  route('route-2', ['B', 'A']),
], points);
const reverseFirst = reverseDirection.byLaneOwnerId.get('route-1');
const reverseSecond = reverseDirection.byLaneOwnerId.get('route-2');
assert.ok(reverseFirst && reverseSecond);
assert.notEqual(reverseFirst.forward.path, reverseSecond.forward.path, '反向路线仍必须使用不同并排车道');
assert.equal(reverseFirst.forward.segments[0].laneOffset, -reverseSecond.forward.segments[0].laneOffset);

const roundTrip = layoutProvinceMapRoutes([
  route('round-route', ['A', 'B', 'C'], { tripType: 'round' }),
], points);
const roundLayout = roundTrip.byLaneOwnerId.get('round-route');
assert.ok(roundLayout?.returnPath);
assert.notEqual(roundLayout.forward.path, roundLayout.returnPath.path, '往返路线的正程与返程不得重叠');
assert.equal(roundTrip.laneCountByEdge.get('A:B'), 2);
assert.equal(roundTrip.laneCountByEdge.get('B:C'), 2);
assert.ok(routeLayoutSegmentForDirection(roundLayout, 'A', 'B'));
assert.ok(routeLayoutSegmentForDirection(roundLayout, 'B', 'A'));

const partial = layoutProvinceMapRoutes([
  route('route-1', ['A', 'B', 'C']),
  route('route-2', ['D', 'B', 'C']),
], points);
const partialFirst = partial.byLaneOwnerId.get('route-1');
const partialSecond = partial.byLaneOwnerId.get('route-2');
assert.ok(partialFirst && partialSecond);
assert.equal(partialFirst.forward.segments[0].laneOffset, 0, '未共享的 A-B 区段不得无意义偏移');
assert.equal(partialSecond.forward.segments[0].laneOffset, 0, '未共享的 D-B 区段不得无意义偏移');
assert.notEqual(partialFirst.forward.segments[1].laneOffset, partialSecond.forward.segments[1].laneOffset, '共享 B-C 区段必须并排');

const highlight = layoutProvinceMapRoutes([
  route('saved-overlay', ['A', 'B'], { laneOwnerId: 'route-1' }),
  route('highlight-overlay', ['A', 'B'], { laneOwnerId: 'route-1', kind: 'highlight', sortKey: 'zz-highlight' }),
  route('route-2', ['A', 'B']),
], points);
const savedGeometry = highlight.byOverlayId.get('saved-overlay');
const highlightedGeometry = highlight.byOverlayId.get('highlight-overlay');
assert.ok(savedGeometry && highlightedGeometry);
assert.equal(savedGeometry.forward.path, highlightedGeometry.forward.path, '高亮必须完全复用原路线车道');
assert.equal(highlight.laneCountByEdge.get('A:B'), 2, '高亮不得增加共享区段的车道数');

console.log('transport route lane verification passed');
'''
Path('scripts/verify-transport-route-lanes.mjs').write_text(verifier)

replace_once(
    'package.json',
    '    "verify:provincial-unlock-transport": "node scripts/verify-provincial-unlock-transport.mjs",',
    '    "verify:provincial-unlock-transport": "node scripts/verify-provincial-unlock-transport.mjs",\n    "verify:transport-route-lanes": "node --experimental-strip-types scripts/verify-transport-route-lanes.mjs",',
)
replace_once(
    'package.json',
    'node scripts/verify-provincial-unlock-transport.mjs && npm run verify:province-map-focus',
    'node scripts/verify-provincial-unlock-transport.mjs && npm run verify:transport-route-lanes && npm run verify:province-map-focus',
)
