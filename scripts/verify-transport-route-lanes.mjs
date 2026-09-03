import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  layoutProvinceMapRoutes,
  provinceMapPhysicalRouteEdgeKey,
  provinceMapPointAlongPolyline,
  provinceMapRouteBasePointsForDirection,
  routeLayoutSegmentForDirection,
} from '../src/components/provinces/provinceMapRouteLayout.ts';
import {
  buildCapitalPairRoutes,
  buildTransportNetworkGraph,
  capitalPairKey,
} from './transport-capital-route-core.mjs';

const read = (path) => readFileSync(path, 'utf8');
const uiDesign = read('docs/UI_DESIGN_SYSTEM.md');
const networkDesign = read('docs/TRANSPORT_NETWORK_GEOMETRY_DESIGN.md');
const warehouseDesign = read('docs/WAREHOUSE_EXPANSION_DESIGN.md');
const strategicWorkspace = read('src/components/shell/StrategicWorkspace.tsx');
const gameShell = read('src/components/shell/GameShell.tsx');
const routeDraftContext = read('src/components/shell/TransportRouteDraftContext.tsx');
const transportPage = read('src/pages/TransportPage.tsx');
const mapComponent = read('src/components/provinces/UsMainlandMap.tsx');
const networkAdapter = read('src/components/provinces/provinceMapTransportNetwork.ts');
const layoutSource = read('src/components/provinces/provinceMapRouteLayout.ts');
const generator = read('scripts/generate-transport-capital-routes.mjs');
const viteConfig = read('vite.config.ts');
const provinces = JSON.parse(read('shared/provinces.json'));
const generated = JSON.parse(read('src/generated/transport-capital-routes.json'));
const expectedPairCount = provinces.length * (provinces.length - 1) / 2;
const naturalEarthCommit = 'ca96624a56bd078437bca8184e78163e5039ad19';

for (const text of [
  '地图几何不得共线覆盖',
  '无方向的“州 A—州 B”区段',
  '正向、反向和非闭环 `round` 返程分别占用独立车道',
  '按 `routeId` 精确对应原路线',
  '所有路线站点标记必须落在同一个首府投影点',
  '在途运输标记沿对应路线实际并排后的当前运输段插值',
]) assert.ok(uiDesign.includes(text), `UI 设计缺少运输路线并排规则：${text}`);

for (const text of [
  'Natural Earth 1:10m Roads / Railroads',
  '1128',
  '该派生快照必须提交到仓库',
  '构建与浏览器运行只能读取已提交快照',
  '单个首府对控制在最多 96 个折点',
  '航空不读取地面路网',
  '不得用占位数据通过正式构建',
  '真实公路／铁路绕行长度不得反向进入经济数值',
]) assert.ok(networkDesign.includes(text), `运输路网几何设计缺少规则：${text}`);
assert.ok(
  warehouseDesign.includes('距离统一使用 `shared/provinces.json` 州中心经纬度的球面距离；首府坐标只用于可视化，不参与经济数值'),
  '运输经济距离必须继续使用州中心球面距离，真实路网只用于可视化。',
);

for (const text of [
  'laneOwnerId: route.id',
  "laneOwnerId: 'draft-route'",
  'const highlightedRouteId = routeDraft?.highlightedRouteId;',
  'transportRoutes.find((route) => route.id === highlightedRouteId)',
  'laneOwnerId: highlightedRoute.id',
  'mode: highlightedRoute.mode',
  'sortKey:',
  'mode: route.mode',
]) assert.ok(strategicWorkspace.includes(text), `战略地图路线 overlay 缺少稳定车道元数据：${text}`);

for (const text of [
  'highlightedRouteId: string | null;',
  'setHighlightedRouteId: (routeId: string | null) => void;',
]) assert.ok(routeDraftContext.includes(text), `运输路线高亮上下文缺少精确路线身份：${text}`);
assert.ok(
  gameShell.includes('const [highlightedRouteId, setHighlightedRouteId] = useState<string | null>(null);'),
  'GameShell 必须按路线 ID 保存悬浮高亮状态。',
);
for (const text of [
  'onMouseEnter={() => setHighlightedRouteId(route.id)}',
  'onFocus={() => setHighlightedRouteId(route.id)}',
]) assert.ok(transportPage.includes(text), `运输路线卡必须按路线 ID 触发高亮：${text}`);

for (const text of [
  'createProvinceMapTransportPhysicalPaths',
  'transportPhysicalPathByEdge',
  'provinceMapPointAlongPolyline',
  'provinceMapRouteBasePointsForDirection',
  'layoutProvinceMapRoutes(routeOverlays, capitalPointByProvinceId, transportPhysicalPathByEdge)',
  'data-route-geometry-source',
  'data-route-network-segment-count',
  'data-route-network-kind',
  'data-route-physical-edge-count',
  'data-route-lane-owner-id',
  'data-route-forward-lanes',
  'routeLayout.byLaneOwnerId',
]) assert.ok(mapComponent.includes(text), `战略地图缺少真实路网渲染边界：${text}`);

for (const text of [
  "for (const mode of ['road', 'rail'] as const)",
  'transportCapitalRoutes',
  'provinceMapPhysicalRouteEdgeKey',
  'coordinates.map((coordinate) => project(coordinate))',
]) assert.ok(networkAdapter.includes(text), `路网投影适配器缺少：${text}`);

for (const text of [
  'provinceMapPhysicalRouteEdgeKey',
  'provinceMapRouteBasePointsForDirection',
  'canonicalPathNormal',
  'provinceMapPointAlongPolyline',
  'participantsByEdge',
  'laneIndex = index - (participants.length - 1) / 2',
  'points: ProvinceMapPoint[];',
  'networkGeometry: canonical.networkGeometry',
  'const stopPoints = traversal.stops.flatMap',
  'returnPath',
]) assert.ok(layoutSource.includes(text), `路线布局算法缺少真实路网或稳定车道边界：${text}`);

for (const text of [
  naturalEarthCommit,
  'ne_10m_roads.geojson',
  'ne_10m_railroads.geojson',
  'insideContiguousUnitedStates',
  'segmentizeNaturalEarthFeatures',
  'buildTransportNetworkGraph',
  'buildCapitalPairRoutes',
  'TRANSPORT_NETWORK_REQUIRES_48_CAPITALS',
  'assertCompleteRouteSet',
  "kind: 'natural-earth-capital-pairs'",
]) assert.ok(generator.includes(text), `首府路网显式生成器缺少：${text}`);
assert.ok(!generator.includes("kind: 'placeholder'"), '运输路网生成器不得恢复正式占位数据模式。');
assert.ok(!viteConfig.includes('generateTransportCapitalRoutes'), 'Vite 启动和构建不得调用外部路网生成器。');
assert.ok(!viteConfig.includes('raw.githubusercontent.com'), 'Vite 配置不得依赖外部路网数据源。');

assert.equal(provinces.length, 48, '运输路网快照必须对应连续 48 州首府目录');
assert.equal(generated.version, 1, '运输路网快照 schema 必须保持版本 1');
assert.equal(generated.kind, 'natural-earth-capital-pairs', '仓库必须提交正式首府路网快照');
assert.equal(generated.capitalCount, 48, '正式首府路网快照必须声明连续 48 州');
assert.equal(generated.pairCountPerMode, expectedPairCount, '正式首府路网快照必须声明每种方式 1128 个首府对');
assert.equal(generated.sourceCommit, naturalEarthCommit, '首府路网快照必须固定到设计认可的上游版本');
for (const mode of ['road', 'rail']) {
  const routes = generated.routes?.[mode] ?? {};
  assert.equal(Object.keys(routes).length, expectedPairCount, `${mode} 首府对快照必须完整`);
  for (let leftIndex = 0; leftIndex < provinces.length - 1; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < provinces.length; rightIndex += 1) {
      const left = provinces[leftIndex];
      const right = provinces[rightIndex];
      const key = capitalPairKey(left.id, right.id);
      const coordinates = routes[key];
      assert.ok(Array.isArray(coordinates) && coordinates.length >= 2, `${mode} 缺少首府对 ${key}`);
      assert.ok(coordinates.length <= 96, `${mode} 首府对 ${key} 超过 96 个折点`);
      const canonicalLeft = left.id < right.id ? left : right;
      const canonicalRight = left.id < right.id ? right : left;
      assert.deepEqual(coordinates[0], [Number(canonicalLeft.capitalLongitude.toFixed(5)), Number(canonicalLeft.capitalLatitude.toFixed(5))], `${mode} ${key} 必须从真实首府坐标开始`);
      assert.deepEqual(coordinates.at(-1), [Number(canonicalRight.capitalLongitude.toFixed(5)), Number(canonicalRight.capitalLatitude.toFixed(5))], `${mode} ${key} 必须在真实首府坐标结束`);
    }
  }
}
assert.notDeepEqual(generated.routes.road['110000:US-TX'], generated.routes.rail['110000:US-TX'], '同一首府对的公路和铁路不得共用同一中心线');

const points = new Map([
  ['A', { x: 0, y: 0 }],
  ['B', { x: 100, y: 0 }],
  ['C', { x: 200, y: 50 }],
  ['D', { x: 100, y: 100 }],
]);
const physicalPaths = new Map([
  [provinceMapPhysicalRouteEdgeKey('road', 'A', 'B'), [{ x: 0, y: 0 }, { x: 40, y: 20 }, { x: 100, y: 0 }]],
  [provinceMapPhysicalRouteEdgeKey('rail', 'A', 'B'), [{ x: 0, y: 0 }, { x: 55, y: -18 }, { x: 100, y: 0 }]],
  [provinceMapPhysicalRouteEdgeKey('road', 'B', 'C'), [{ x: 100, y: 0 }, { x: 145, y: 35 }, { x: 200, y: 50 }]],
  [provinceMapPhysicalRouteEdgeKey('road', 'B', 'D'), [{ x: 100, y: 0 }, { x: 112, y: 45 }, { x: 100, y: 100 }]],
]);
const route = (id, stops, extras = {}) => ({
  id,
  laneOwnerId: id,
  sortKey: id,
  mode: 'road',
  stops,
  closed: false,
  tripType: 'one-way',
  kind: 'saved',
  ...extras,
});

const sameDirection = layoutProvinceMapRoutes([
  route('route-1', ['A', 'B']),
  route('route-2', ['A', 'B']),
], points, physicalPaths);
const sameFirst = sameDirection.byLaneOwnerId.get('route-1');
const sameSecond = sameDirection.byLaneOwnerId.get('route-2');
assert.ok(sameFirst && sameSecond);
assert.notEqual(sameFirst.forward.path, sameSecond.forward.path, '同一路网区段的两条路线不得共线');
assert.equal(sameDirection.laneCountByEdge.get('road|A:B'), 2);
assert.equal(sameFirst.forward.segments[0].laneOffset, -sameSecond.forward.segments[0].laneOffset);
assert.equal(sameFirst.forward.segments[0].networkGeometry, true);
assert.equal(sameFirst.forward.segments[0].points.length, 3, '真实路网折点不得退化为首府直线');
assert.deepEqual(sameFirst.forward.points, [{ x: 0, y: 0 }, { x: 100, y: 0 }], '共享路线站点必须使用首府原始点');
assert.deepEqual(sameSecond.forward.points, sameFirst.forward.points, '共享路线不得为站点拆分偏移点');
assert.notDeepEqual(sameFirst.forward.segments[0].start, sameFirst.forward.points[0], '共享线路必须在首府点之间使用并排车道');

const threeLanes = layoutProvinceMapRoutes([
  route('route-1', ['A', 'B']),
  route('route-2', ['A', 'B']),
  route('route-3', ['A', 'B']),
], points, physicalPaths);
const threeOffsets = ['route-1', 'route-2', 'route-3'].map((id) => threeLanes.byLaneOwnerId.get(id)?.forward.segments[0].laneOffset);
assert.equal(threeLanes.laneCountByEdge.get('road|A:B'), 3);
assert.deepEqual(threeOffsets, [-4.5, 0, 4.5], '三条共享路线必须保持稳定对称车道');
assert.equal(new Set(['route-1', 'route-2', 'route-3'].map((id) => threeLanes.byLaneOwnerId.get(id)?.forward.path)).size, 3);

const reverseDirection = layoutProvinceMapRoutes([
  route('route-1', ['A', 'B']),
  route('route-2', ['B', 'A']),
], points, physicalPaths);
const reverseFirst = reverseDirection.byLaneOwnerId.get('route-1');
const reverseSecond = reverseDirection.byLaneOwnerId.get('route-2');
assert.ok(reverseFirst && reverseSecond);
assert.notEqual(reverseFirst.forward.path, reverseSecond.forward.path, '反向路线仍必须使用不同并排车道');
assert.equal(reverseFirst.forward.segments[0].laneOffset, -reverseSecond.forward.segments[0].laneOffset);
const forwardBase = provinceMapRouteBasePointsForDirection('road', 'A', 'B', points, physicalPaths);
const reverseBase = provinceMapRouteBasePointsForDirection('road', 'B', 'A', points, physicalPaths);
assert.deepEqual(reverseBase?.points, [...(forwardBase?.points ?? [])].reverse(), '正反向必须复用同一物理中心线并反转');

const roundTrip = layoutProvinceMapRoutes([
  route('round-route', ['A', 'B', 'C'], { tripType: 'round' }),
], points, physicalPaths);
const roundLayout = roundTrip.byLaneOwnerId.get('round-route');
assert.ok(roundLayout?.returnPath);
assert.notEqual(roundLayout.forward.path, roundLayout.returnPath.path, '往返路线的正程与返程不得重叠');
assert.equal(roundTrip.laneCountByEdge.get('road|A:B'), 2);
assert.equal(roundTrip.laneCountByEdge.get('road|B:C'), 2);
assert.ok(routeLayoutSegmentForDirection(roundLayout, 'A', 'B'));
assert.ok(routeLayoutSegmentForDirection(roundLayout, 'B', 'A'));

const partial = layoutProvinceMapRoutes([
  route('route-1', ['A', 'B', 'C']),
  route('route-2', ['D', 'B', 'C']),
], points, physicalPaths);
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
], points, physicalPaths);
const savedGeometry = highlight.byOverlayId.get('saved-overlay');
const highlightedGeometry = highlight.byOverlayId.get('highlight-overlay');
assert.ok(savedGeometry && highlightedGeometry);
assert.equal(savedGeometry.forward.path, highlightedGeometry.forward.path, '高亮必须完全复用原路线车道');
assert.equal(highlight.laneCountByEdge.get('road|A:B'), 2, '高亮不得增加共享区段的车道数');

const crossMode = layoutProvinceMapRoutes([
  route('road-route', ['A', 'B']),
  route('rail-route', ['A', 'B'], { mode: 'rail' }),
], points, physicalPaths);
const roadGeometry = crossMode.byLaneOwnerId.get('road-route');
const railGeometry = crossMode.byLaneOwnerId.get('rail-route');
assert.ok(roadGeometry && railGeometry);
assert.equal(crossMode.laneCountByEdge.get('road|A:B'), 1);
assert.equal(crossMode.laneCountByEdge.get('rail|A:B'), 1);
assert.notEqual(roadGeometry.forward.path, railGeometry.forward.path, '公路和铁路必须使用各自物理中心线，不能共享同一折线');

const air = layoutProvinceMapRoutes([
  route('air-route', ['A', 'B'], { mode: 'air' }),
], points, physicalPaths);
const airSegment = air.byLaneOwnerId.get('air-route')?.forward.segments[0];
assert.equal(airSegment?.networkGeometry, false, '航空必须保持首府直接航线');
assert.equal(airSegment?.points.length, 2);

assert.deepEqual(
  provinceMapPointAlongPolyline([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 30 }], 0.5),
  { x: 10, y: 10 },
  '在途标记必须按整条折线累计长度插值，而不是首尾端点直线插值',
);

const graph = buildTransportNetworkGraph([
  { type: 'Feature', properties: { KM: 10 }, geometry: { type: 'LineString', coordinates: [[-100, 40], [-99, 40]] } },
  { type: 'Feature', properties: { KM: 10 }, geometry: { type: 'LineString', coordinates: [[-99, 40], [-98, 40]] } },
], 'road');
const capitalRoutes = buildCapitalPairRoutes(graph, [
  { id: 'P1', capitalLongitude: -100, capitalLatitude: 40 },
  { id: 'P2', capitalLongitude: -98, capitalLatitude: 40 },
]);
assert.equal(capitalPairKey('P2', 'P1'), 'P1:P2');
assert.equal(Object.keys(capitalRoutes.routes).length, 1);
assert.deepEqual(capitalRoutes.routes['P1:P2'][0], [-100, 40]);
assert.deepEqual(capitalRoutes.routes['P1:P2'].at(-1), [-98, 40]);

console.log('transport route lane and capital network verification passed');
