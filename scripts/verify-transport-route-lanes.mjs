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
const mapDesign = read('docs/STRATEGIC_MAP_RENDERING_DESIGN.md');
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
  '多条玩家路线使用同一种运输方式并经过同一物理区段时允许完全共线',
  '不得生成平行车道',
  '非闭环往返路线到达终点后只反转同一条正式几何',
  '运输路线身份以 `routeId` 为唯一键',
  '高亮必须在这一个实例上',
  '二次贝塞尔抛物线',
]) assert.ok(mapDesign.includes(text), `战略地图渲染设计缺少运输显示规则：${text}`);

for (const text of [
  'Natural Earth 1:10m Roads / Railroads',
  '1128',
  '该派生快照必须提交到仓库',
  '构建与浏览器运行只能读取已提交快照',
  '单个首府对控制在最多 96 个折点',
  '航空不读取地面路网',
  '二次贝塞尔抛物线虚拟航路',
  '共享同一运输方式和物理区段时允许完全共线',
  '不得为了区分玩家路线生成平行车道',
  '公路沿公路折线、铁路沿铁路折线、航空沿抛物线采样点',
  '真实公路／铁路绕行长度不得反向进入经济数值',
  '航空抛物线弧长同样不得反向进入经济数值',
]) assert.ok(networkDesign.includes(text), `运输路网几何设计缺少规则：${text}`);
assert.ok(
  warehouseDesign.includes('距离统一使用 `shared/provinces.json` 州中心经纬度的球面距离；首府坐标只用于可视化，不参与经济数值'),
  '运输经济距离必须继续使用州中心球面距离，地图路网只用于可视化。',
);

for (const text of [
  'laneOwnerId: route.id',
  "laneOwnerId: 'draft-route'",
  'const highlightedRouteId = routeDraft?.highlightedRouteId ?? null;',
  "kind: route.id === highlightedRouteId ? 'highlight' : 'saved'",
  'sortKey:',
  'mode: route.mode',
]) assert.ok(strategicWorkspace.includes(text), `战略地图路线 overlay 缺少最终身份语义：${text}`);
for (const forbidden of [
  'transportRoutes.find((route) => route.id === highlightedRouteId)',
  'laneOwnerId: highlightedRoute.id',
]) assert.equal(strategicWorkspace.includes(forbidden), false, `路线高亮不得恢复第二 overlay：${forbidden}`);

for (const text of [
  'highlightedRouteId: string | null;',
  'setHighlightedRouteId: (routeId: string | null) => void;',
]) assert.ok(routeDraftContext.includes(text), `运输路线高亮上下文缺少精确路线身份：${text}`);
assert.ok(
  gameShell.includes('const [highlightedRouteId, setHighlightedRouteId] = useState<string | null>(null);'),
  'GameShell 必须按路线 ID 保存高亮状态。',
);
for (const text of [
  'onMouseEnter={() => setHighlightedRouteId(route.id)}',
  'onFocus={() => setHighlightedRouteId(route.id)}',
  'setHighlightedRouteId(detailRouteId);',
]) assert.ok(transportPage.includes(text), `运输路线列表或详情缺少 routeId 高亮：${text}`);

for (const text of [
  'createProvinceMapTransportPhysicalPaths',
  'transportPhysicalPathByEdge',
  'provinceMapPointAlongPolyline',
  'provinceMapRouteBasePointsForDirection',
  'layoutProvinceMapRoutes(routeOverlays, capitalPointByProvinceId, transportPhysicalPathByEdge)',
  'data-route-geometry-source',
  'data-route-network-segment-count',
  'data-route-lane-owner-id',
  'data-route-forward-lanes',
  'routeLayout.byLaneOwnerId',
]) assert.ok(mapComponent.includes(text), `战略地图缺少真实运输几何：${text}`);

for (const text of [
  "for (const mode of ['road', 'rail'] as const)",
  'transportCapitalRoutes',
  'provinceMapPhysicalRouteEdgeKey',
  'coordinates.map((coordinate) => project(coordinate))',
]) assert.ok(networkAdapter.includes(text), `地面路网投影适配器缺少：${text}`);

for (const text of [
  'provinceMapPhysicalRouteEdgeKey',
  'provinceMapRouteBasePointsForDirection',
  'provinceMapPointAlongPolyline',
  'AIR_CURVE_RATIO',
  'AIR_SAMPLE_STEPS',
  'quadraticPoint',
  'pathForSegment',
  "if (mode === 'air' && segment.airControlPoint)",
  'laneOffset: 0',
  'returnPath: null',
  'points: [...reverse.points].reverse()',
]) assert.ok(layoutSource.includes(text), `路线布局缺少真实路网、航空抛物线或共线边界：${text}`);
for (const forbidden of ['DEFAULT_LANE_GAP', 'offsetPolyline(', 'participantsByEdge', 'laneIndex =', 'canonicalPathNormal(']) {
  assert.equal(layoutSource.includes(forbidden), false, `路线布局不得恢复并排车道算法：${forbidden}`);
}

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
]) assert.ok(generator.includes(text), `首府地面路网显式生成器缺少：${text}`);
assert.ok(!generator.includes("kind: 'placeholder'"), '运输路网生成器不得恢复正式占位数据模式。');
assert.ok(!viteConfig.includes('generateTransportCapitalRoutes'), 'Vite 启动和构建不得调用外部路网生成器。');
assert.ok(!viteConfig.includes('raw.githubusercontent.com'), 'Vite 配置不得依赖外部路网数据源。');

assert.equal(provinces.length, 48, '运输路网快照必须对应连续 48 州首府目录');
assert.equal(generated.version, 1, '运输路网快照 schema 必须保持版本 1');
assert.equal(generated.kind, 'natural-earth-capital-pairs', '仓库必须提交正式首府地面路网快照');
assert.equal(generated.capitalCount, 48, '正式首府路网快照必须声明连续 48 州');
assert.equal(generated.pairCountPerMode, expectedPairCount, '正式首府路网快照必须声明每种地面方式 1128 个首府对');
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

const shared = layoutProvinceMapRoutes([
  route('route-1', ['A', 'B']),
  route('route-2', ['A', 'B']),
], points, physicalPaths);
const sharedFirst = shared.byLaneOwnerId.get('route-1');
const sharedSecond = shared.byLaneOwnerId.get('route-2');
assert.ok(sharedFirst && sharedSecond);
assert.equal(sharedFirst.forward.path, sharedSecond.forward.path, '同一路网区段的多条路线必须完全共线');
assert.equal(sharedFirst.forward.segments[0].laneOffset, 0);
assert.equal(sharedSecond.forward.segments[0].laneOffset, 0);
assert.equal(shared.laneCountByEdge.get('road|A:B'), 1, '物理区段不得按玩家路线数量分配车道');
assert.equal(sharedFirst.forward.segments[0].networkGeometry, true);
assert.equal(sharedFirst.forward.segments[0].points.length, 3, '真实路网折点不得退化为首府直线');
assert.equal(sharedFirst.returnPath, null);
assert.equal(sharedSecond.returnPath, null);

const reverse = layoutProvinceMapRoutes([
  route('reverse-route', ['B', 'A']),
], points, physicalPaths).byLaneOwnerId.get('reverse-route');
assert.ok(reverse);
const forwardBase = provinceMapRouteBasePointsForDirection('road', 'A', 'B', points, physicalPaths);
const reverseBase = provinceMapRouteBasePointsForDirection('road', 'B', 'A', points, physicalPaths);
assert.deepEqual(reverseBase?.points, [...(forwardBase?.points ?? [])].reverse(), '公路正反向必须复用同一中心线并只反转点序');

const round = layoutProvinceMapRoutes([
  route('round-route', ['A', 'B', 'C'], { tripType: 'round' }),
], points, physicalPaths).byLaneOwnerId.get('round-route');
assert.ok(round);
assert.equal(round.returnPath, null, '往返路线不得创建第二条返程几何');
const reverseSegment = routeLayoutSegmentForDirection(round, 'B', 'A');
assert.ok(reverseSegment, '往返运输必须能从同一正程中心线反向取得运输段');
assert.deepEqual(reverseSegment.points, [...round.forward.segments[0].points].reverse());

const partial = layoutProvinceMapRoutes([
  route('route-1', ['A', 'B', 'C']),
  route('route-2', ['D', 'B', 'C']),
], points, physicalPaths);
const partialFirst = partial.byLaneOwnerId.get('route-1');
const partialSecond = partial.byLaneOwnerId.get('route-2');
assert.ok(partialFirst && partialSecond);
assert.equal(partialFirst.forward.segments[0].laneOffset, 0, '未共享 A-B 区段必须保持物理中心线');
assert.equal(partialSecond.forward.segments[0].laneOffset, 0, '未共享 D-B 区段必须保持物理中心线');
assert.equal(partialFirst.forward.segments[1].laneOffset, 0, '共享 B-C 区段也不得偏移');
assert.equal(partialSecond.forward.segments[1].laneOffset, 0, '共享 B-C 区段也不得偏移');
assert.equal(partialFirst.forward.segments[1].path, partialSecond.forward.segments[1].path, '共享 B-C 区段必须完全共线');

const crossMode = layoutProvinceMapRoutes([
  route('road-route', ['A', 'B']),
  route('rail-route', ['A', 'B'], { mode: 'rail' }),
], points, physicalPaths);
const roadGeometry = crossMode.byLaneOwnerId.get('road-route');
const railGeometry = crossMode.byLaneOwnerId.get('rail-route');
assert.ok(roadGeometry && railGeometry);
assert.equal(crossMode.laneCountByEdge.get('road|A:B'), 1);
assert.equal(crossMode.laneCountByEdge.get('rail|A:B'), 1);
assert.notEqual(roadGeometry.forward.path, railGeometry.forward.path, '公路和铁路必须使用各自物理中心线');

const air = layoutProvinceMapRoutes([
  route('air-route', ['A', 'B'], { mode: 'air' }),
], points, physicalPaths).byLaneOwnerId.get('air-route');
assert.ok(air);
assert.match(air.forward.path, /\sQ[-\d.]+\s[-\d.]+\s[-\d.]+\s[-\d.]+/u, '航空路线必须使用 SVG Q 二次贝塞尔曲线');
assert.ok(air.forward.segments[0].points.length > 10, '航空运输必须拥有同源曲线采样点');
assert.equal(air.forward.segments[0].networkGeometry, false, '航空不属于地面物理路网');
const airBase = provinceMapRouteBasePointsForDirection('air', 'A', 'B', points, physicalPaths);
const airReverseBase = provinceMapRouteBasePointsForDirection('air', 'B', 'A', points, physicalPaths);
assert.ok(airBase && airReverseBase);
assert.deepEqual(airReverseBase.points, [...airBase.points].reverse(), '航空正反向必须复用同一条抛物线');
const airMid = provinceMapPointAlongPolyline(airBase.points, 0.5);
assert.ok(airMid && Math.abs(airMid.y) > 5, '航空运输中点必须明显偏离首府直线');

const roadMid = provinceMapPointAlongPolyline(forwardBase?.points ?? [], 0.5);
assert.ok(roadMid && roadMid.y > 0, '公路运输位置必须沿公路折线路径长度插值');
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

console.log('运输路网验证通过：Natural Earth 固定版本、1128×2 首府快照、首尾首府坐标与核心寻路继续受保护；公路与铁路复用各自真实中心线，重复路线完全共线且无车道偏移，往返只反转同一几何，航空使用唯一 Q 抛物线并沿同源采样点运动，路线列表与详情按 routeId 高亮，经济距离仍与地图几何解耦。');