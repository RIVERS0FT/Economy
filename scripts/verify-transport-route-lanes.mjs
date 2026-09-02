import assert from 'node:assert/strict';
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
