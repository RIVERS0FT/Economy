import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { feature } from 'topojson-client';
import usStateAtlas from 'us-atlas/states-10m.json' with { type: 'json' };
import { CURRENT_CLIENT_STATE_VERSION } from '../server/shared/economy-state-version.js';
import { AUTHORITATIVE_WORLD_VERSION } from '../server/src/world-storage-v2.js';
import { DEFAULT_PROVINCE_ID, PROVINCE_CATALOG } from '../server/src/provinces.js';

const read = (path) => readFileSync(path, 'utf8');
const requiredFiles = [
  'shared/provinces.json',
  'server/src/provinces.js',
  'server/src/banking.js',
  'server/src/commercial-contracts.js',
  'server/test/provinces.test.js',
  'src/pages/MapPage.tsx',
  'src/pages/ProvincePage.tsx',
  'src/components/shell/StrategicWorkspace.tsx',
  'src/components/provinces/UsMainlandMap.tsx',
  'src/components/provinces/provinceMapProjection.ts',
  'src/components/provinces/provinceMapCamera.ts',
  'src/components/provinces/provinceMapStaticLabels.ts',
  'src/components/provinces/provinceMapRouteLayout.ts',
  'src/components/provinces/provinceMapTransportNetwork.ts',
  'src/data/north-america-land-10m.json',
  'scripts/generate-province-map-world-context.mjs',
  'src/styles/performance.css',
  'src/styles/province-map.css',
  'src/styles/strategic-map-rendering.css',
  'src/styles/strategic-game-shell.css',
  'src/utils/provinceScope.ts',
  'tests/browser/province-map.spec.ts',
  'tests/browser/map-reset-sync.spec.ts',
  'tests/browser/map-zoom-transient.spec.ts',
  'tests/browser/map-zoom-render-sync.spec.ts',
  'tests/browser/map-zoom-out-boundary.spec.ts',
  'tests/browser/map-mobile-pinch.spec.ts',
  'tests/browser/province-map-world-boundary.spec.ts',
  'docs/README.md',
  'docs/STRATEGIC_MAP_RENDERING_DESIGN.md',
  'docs/TRANSPORT_NETWORK_GEOMETRY_DESIGN.md',
  'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
  'docs/UI_DESIGN_SYSTEM.md',
  'docs/LIQUID_GLASS_CHROME_DESIGN.md',
];
for (const path of requiredFiles) assert.equal(existsSync(path), true, `缺少州级经济文件: ${path}`);
for (const retiredPath of [
  'src/components/provinces/ProvinceSelect.tsx',
  'src/components/provinces/provinceMapLayoutCamera.ts',
  'src/components/provinces/provinceMapLabels.ts',
  'src/components/provinces/provinceMapZoomInterpolator.ts',
]) assert.equal(existsSync(retiredPath), false, `不得恢复已退役地图实现: ${retiredPath}`);

assert.equal(PROVINCE_CATALOG.length, 48, '州级地区目录必须包含美国连续 48 州');
assert.equal(new Set(PROVINCE_CATALOG.map((province) => province.id)).size, 48, '州级地区 ID 必须唯一');
assert.equal(new Set(PROVINCE_CATALOG.map((province) => province.name)).size, 48, '州级地区中文短名必须唯一');
assert.equal(PROVINCE_CATALOG.every((province) => !/州$/.test(province.name)), true, '玩家可见州名必须省略末尾“州”');
assert.equal(PROVINCE_CATALOG.every((province) => typeof province.capitalName === 'string' && province.capitalName.length > 0), true, '每个州必须记录中文首府');
assert.equal(PROVINCE_CATALOG.every((province) => typeof province.capitalMapName === 'string' && province.capitalMapName.length > 0), true, '每个州必须记录英文首府');
assert.equal(PROVINCE_CATALOG.every((province) => Number.isFinite(province.capitalLongitude) && Number.isFinite(province.capitalLatitude)), true, '每个州必须记录首府经纬度');
const legacyRegionIds = [
  '110000', '120000', '130000', '140000', '150000', '210000', '220000', '230000',
  '310000', '320000', '330000', '340000', '350000', '360000', '370000', '410000',
  '420000', '430000', '440000', '450000', '460000', '500000', '510000', '520000',
  '530000', '540000', '610000', '620000', '630000', '640000', '650000', '710000',
  '810000', '820000',
];
assert.equal(legacyRegionIds.every((id) => PROVINCE_CATALOG.some((province) => province.id === id)), true, '既有 34 个地区 ID 必须原位保留');
assert.equal(DEFAULT_PROVINCE_ID, '110000', '默认地区 ID 必须保持稳定');
assert.equal(PROVINCE_CATALOG.find((province) => province.id === DEFAULT_PROVINCE_ID)?.mapName, 'California', '旧默认地区必须继续映射加利福尼亚');
assert.equal(CURRENT_CLIENT_STATE_VERSION, 39, '州级状态协议必须使用客户端版本 39');
assert.equal(AUTHORITATIVE_WORLD_VERSION, 32, '州级持久化必须使用世界版本 32');

const provinceTypes = read('src/types.ts');
for (const field of ['capitalName: string;', 'capitalMapName: string;', 'capitalLongitude: number;', 'capitalLatitude: number;']) {
  assert.ok(provinceTypes.includes(`  ${field}`), `ProvinceDefinition 缺少首府字段: ${field}`);
}
const packageJson = JSON.parse(read('package.json'));
assert.equal(packageJson.dependencies?.['us-atlas'], '3.0.1', '州界依赖必须锁定 us-atlas 3.0.1');
assert.equal(packageJson.dependencies?.['topojson-client'], '3.1.0', 'TopoJSON 依赖必须锁定 3.1.0');
assert.equal(packageJson.dependencies?.['world-atlas'], '2.0.2', '世界大陆依赖必须锁定 2.0.2');
const atlasStateCollection = feature(usStateAtlas, usStateAtlas.objects.states);
assert.equal(atlasStateCollection.type, 'FeatureCollection');
const atlasRegionNames = atlasStateCollection.features.map((stateFeature) => String(stateFeature?.properties?.name || ''));
const mapRegionNames = atlasRegionNames.filter((name) => PROVINCE_CATALOG.some((province) => province.mapName === name));
assert.equal(mapRegionNames.length, 48, '静态地图必须只包含连续 48 州');

const matching = read('server/src/order-matching.js');
assert.ok(matching.includes('provinceId: orderProvinceId(incoming)'), '共享撮合必须保持州级隔离');
const facilities = read('server/src/facility-groups.js');
for (const text of ['const provinceId = normalizeProvinceId(payload.provinceId);', 'provinceFacilityGroups', 'provinceFacilityMarkets']) {
  assert.ok(facilities.includes(text), `工厂州级边界缺少: ${text}`);
}
const banking = read('server/src/banking.js');
assert.ok(banking.includes('const provinceId = normalizeProvinceId(item?.provinceId);'), '银行抵押必须保持州级边界');
const commercialContracts = read('server/src/commercial-contracts.js');
assert.ok(commercialContracts.includes('const provinceId = normalizeProvinceId(payload.provinceId);'), '工厂合同必须保持州级边界');
const clientScope = read('src/utils/provinceScope.ts');
for (const text of ['game.provinceInventories?.[provinceId]', 'game.provinceFacilityGroups?.[provinceId]', 'game.provinceMarkets?.[provinceId]']) {
  assert.ok(clientScope.includes(text), `客户端州级作用域缺少: ${text}`);
}

const mapPage = read('src/pages/MapPage.tsx');
assert.ok(mapPage.includes('className="province-map-page"'), '地图页必须保留透明路由占位');
assert.equal(mapPage.includes('<UsMainlandMap'), false, 'MapPage 不得重新创建地图实例');

const strategicWorkspace = read('src/components/shell/StrategicWorkspace.tsx');
for (const text of [
  '<UsMainlandMap', 'summaries={state.summaries}', 'onSelectProvince={openProvincePage}',
  'referenceNow={model.game.lastProcessedAt}', 'const highlightedRouteId = routeDraft?.highlightedRouteId;',
]) assert.ok(strategicWorkspace.includes(text), `常驻战略地图交互缺少: ${text}`);
assert.equal(strategicWorkspace.includes('useNow('), false, 'StrategicMapStage 不得订阅运输高频时钟');

const mapComponent = read('src/components/provinces/UsMainlandMap.tsx');
for (const text of [
  "us-atlas/states-10m.json", "import { feature, merge } from 'topojson-client'",
  'createProvinceMapProjection', 'layoutProvinceMapLabels', 'createProvinceMapCamera',
  'province-map-camera-surface', 'province-map-world-svg', 'province-map-region',
  'data-map-world-path-count={provinceMapWorld.length}', 'data-map-path-revision="1"',
  'capitalPointByProvinceId', 'province-map-routes', 'province-map-route-path',
  'createProvinceMapTransportPhysicalPaths', 'transportPhysicalPathByEdge',
  'layoutProvinceMapRoutes(routeOverlays, capitalPointByProvinceId, transportPhysicalPathByEdge)',
  'routeLayout.byLaneOwnerId', 'provinceMapPointAlongPolyline',
  "import { LiveServerTime } from '../time/LiveServerTime'", '<LiveServerTime referenceNow={referenceNow} intervalMs={500}>',
]) assert.ok(mapComponent.includes(text), `静态 SVG 美国本土地图缺少: ${text}`);
for (const forbidden of ['<EconomyChart', 'EChartsType', 'geoRoam', 'dispatchAction', 'setOption(', 'textLength', 'lengthAdjust="spacingAndGlyphs"']) {
  assert.equal(mapComponent.includes(forbidden), false, `静态地图不得恢复旧绘制路径: ${forbidden}`);
}

const worldContext = read('src/components/provinces/provinceMapWorldOutline.ts');
for (const text of ['north-america-land-10m.json', 'createProvinceMapWorldOutlinePath', 'createProvinceMapMainlandFocusBounds']) {
  assert.ok(worldContext.includes(text), `世界大陆上下文缺少: ${text}`);
}
const worldContextAsset = read('src/data/north-america-land-10m.json');
assert.ok(worldContextAsset.length < 1_500_000, '北美运行时 TopoJSON 不得退化为完整 atlas');
execFileSync(process.execPath, ['scripts/generate-province-map-world-context.mjs', '--check'], { stdio: 'inherit' });

const camera = read('src/components/provinces/provinceMapCamera.ts');
for (const text of [
  'export const PROVINCE_MAP_ZOOM_MIN = 1', 'export const PROVINCE_MAP_ZOOM_MAX = 4',
  'MAINLAND_MIN_AREA_RATIO = 2 / 3', 'MAINLAND_CONTEXT_EXPAND_X = 0.35', 'MAINLAND_CONTEXT_EXPAND_Y = 0.25',
  "container.dataset.mapCameraMode = 'svg-viewbox'", "container.dataset.mapCameraHotPath = 'single-svg-viewbox-write'",
  "container.dataset.mapCameraBoundaryMode = options.focusBounds ? 'fixed-world-bounds' : 'source-viewbox'",
  "container.dataset.mapPanBoundary = options.focusBounds ? 'fixed-world-context' : 'source-viewbox'",
  "container.dataset.mapPanClampMode = options.focusBounds ? 'fixed-world-viewbox' : 'none'",
  'function baseViewSize(', 'function clampCameraCenter(', 'const viewBoxFor = (', 'const screenPointToWorld = (',
  'let settleDeadline = 0;', 'settleDeadline = performance.now() + INPUT_SETTLE_MS;',
  "container.addEventListener('wheel', handleWheel, { passive: false })", 'pointers.size >= 2',
  "container.dataset.mapCameraReset = 'blank-double-click'", "container.dataset.mapCameraReset = 'blank-double-tap'",
]) assert.ok(camera.includes(text), `SVG viewBox Camera 缺少: ${text}`);
const writeCameraStart = camera.indexOf('const writeCamera = () => {');
const writeCameraEnd = camera.indexOf('\n  };', writeCameraStart);
assert.ok(writeCameraStart >= 0 && writeCameraEnd > writeCameraStart, '必须能定位 Camera RAF 热路径');
const writeCameraSource = camera.slice(writeCameraStart, writeCameraEnd);
assert.ok(writeCameraSource.includes("svg.setAttribute('viewBox'"), 'Camera RAF 必须只写根 SVG viewBox');
for (const forbidden of ['surface.style.transform', 'container.dataset', 'getBoundingClientRect(', 'setTimeout(', 'setActive(', 'setState(']) {
  assert.equal(writeCameraSource.includes(forbidden), false, `Camera RAF 热路径不得包含: ${forbidden}`);
}
for (const forbidden of ["mapCameraMode = 'html-compositor-transform'", "mapCameraHotPath = 'single-css-transform'", 'surface.style.transform = `translate3d(', 'surface.style.willChange = nextActive']) {
  assert.equal(camera.includes(forbidden), false, `不得恢复 CSS 合成相机: ${forbidden}`);
}

const performanceStyles = read('src/styles/performance.css');
assert.ok(performanceStyles.includes('.province-map-camera-surface') && performanceStyles.includes('will-change: auto;'), 'SVG viewBox Camera 不得永久提升完整世界纹理');
assert.equal(performanceStyles.includes('will-change: transform;'), false, '地图性能样式不得恢复永久 transform 合成');
const renderingStyles = read('src/styles/strategic-map-rendering.css');
for (const text of [
  '.province-map-camera-surface', 'transform: none !important;', 'will-change: auto !important;',
  '.province-map-world-shadow', 'filter: none;',
  ".province-map-route[data-transport-mode='road']", ".province-map-route[data-transport-mode='rail']", ".province-map-route[data-transport-mode='air']",
  '.application-map-layer > .strategic-map-lens-bar', '.transport-map-picking-bar', 'backdrop-filter: none;',
]) assert.ok(renderingStyles.includes(text), `战略地图最终渲染样式缺少: ${text}`);
const mainSource = read('src/main.tsx');
assert.ok(mainSource.includes("import './styles/strategic-map-rendering.css';"), '战略地图最终渲染样式必须被正式入口加载');

const transientTest = read('tests/browser/map-zoom-transient.spec.ts');
for (const text of [
  'map zoom changes only the root SVG viewBox while static geometry and glyph transforms stay immutable',
  'active wheel bursts mutate only the root SVG viewBox once per animation frame',
  'viewBoxMutations', 'cameraStyleMutations', 'diagnosticMutations',
  'expect(result.viewBoxMutations).toBe(1)', 'expect(result.cameraStyleMutations).toBe(0)', 'expect(result.diagnosticMutations).toBe(0)',
]) assert.ok(transientTest.includes(text), `地图 viewBox 热路径回归缺少: ${text}`);
const boundaryTest = read('tests/browser/province-map-world-boundary.spec.ts');
for (const text of ['fixed-world-context', 'fixed-world-viewbox', 'fixed-world-bounds', 'data-map-camera-world-bounds', 'expectViewInsideBounds']) {
  assert.ok(boundaryTest.includes(text), `固定 Camera 世界边界回归缺少: ${text}`);
}
const mapBrowserTest = read('tests/browser/province-map.spec.ts');
for (const text of ["data-map-camera-mode', 'svg-viewbox'", "data-map-camera-hot-path', 'single-svg-viewbox-write'", "toHaveCSS('backdrop-filter', 'none')"]) {
  assert.ok(mapBrowserTest.includes(text), `静态地图浏览器回归缺少: ${text}`);
}
const resetTest = read('tests/browser/map-reset-sync.spec.ts');
assert.ok(resetTest.includes('blank double click resets the single SVG viewBox camera'), '地图重置必须锁定 SVG viewBox Camera');
const zoomOutTest = read('tests/browser/map-zoom-out-boundary.spec.ts');
assert.ok(zoomOutTest.includes('zoomOutActiveFrame.viewBox'), '缩小恢复必须观察真实 SVG viewBox');
const mobilePinchTest = read('tests/browser/map-mobile-pinch.spec.ts');
assert.ok(mobilePinchTest.includes("data-map-camera-mode', 'svg-viewbox'"), '移动双指必须使用 SVG viewBox Camera');

const docsIndex = read('docs/README.md');
assert.ok(docsIndex.includes('`STRATEGIC_MAP_RENDERING_DESIGN.md`'), '设计索引必须登记战略地图渲染 owner');
const mapDesign = read('docs/STRATEGIC_MAP_RENDERING_DESIGN.md');
for (const text of [
  '本文是战略地图', 'SVG viewBox Camera', '该 world bounds 不得随 zoom 改变',
  '`viewWidth = baseViewWidth / zoom`', '真实 SVG `text`', '二次贝塞尔抛物线',
  '不得生成平行车道', '`backdrop-filter` 与 `-webkit-backdrop-filter` 必须为 `none`',
]) assert.ok(mapDesign.includes(text), `战略地图渲染 DESIGN 缺少: ${text}`);
const networkDesign = read('docs/TRANSPORT_NETWORK_GEOMETRY_DESIGN.md');
for (const text of ['允许完全共线', '二次贝塞尔抛物线虚拟航路', '公路沿公路折线、铁路沿铁路折线、航空沿抛物线采样点']) {
  assert.ok(networkDesign.includes(text), `运输几何 DESIGN 缺少: ${text}`);
}

console.log('地区经济验证通过：连续 48 州与既有地区 ID 保持稳定；战略地图使用唯一静态 SVG 世界和固定 world bounds 的单次 viewBox RAF Camera，州名保持矢量文本，完整世界不再 CSS scale／永久合成；公路、铁路和航空沿各自正式几何运动，重复路线允许共线且无并排车道，地图专属镜头栏和选路面板不再使用毛玻璃。');
