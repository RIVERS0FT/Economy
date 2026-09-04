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
  'server/src/contract-asset-locks.js',
  'server/test/provinces.test.js',
  'src/pages/MapPage.tsx',
  'src/pages/ProvincePage.tsx',
  'src/components/shell/StrategicWorkspace.tsx',
  'src/components/provinces/UsMainlandMap.tsx',
  'src/components/provinces/provinceMapProjection.ts',
  'src/components/provinces/provinceMapCamera.ts',
  'src/components/provinces/provinceMapStaticLabels.ts',
  'src/data/north-america-land-10m.json',
  'scripts/generate-province-map-world-context.mjs',
  'src/styles/performance.css',
  'src/styles/province-map.css',
  'src/styles/province-page.css',
  'src/styles/strategic-game-shell.css',
  'src/utils/provinceScope.ts',
  'tests/browser/province-map.spec.ts',
  'tests/browser/map-reset-sync.spec.ts',
  'tests/browser/map-zoom-transient.spec.ts',
  'tests/browser/map-zoom-render-sync.spec.ts',
  'tests/browser/map-zoom-out-boundary.spec.ts',
  'tests/browser/province-map-world-boundary.spec.ts',
  'docs/README.md',
  'docs/PRODUCT_AND_GAMEPLAY_DESIGN.md',
  'docs/INDUSTRY_AND_PRODUCTION_DESIGN.md',
  'docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md',
  'docs/WAREHOUSE_EXPANSION_DESIGN.md',
  'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
  'docs/UI_DESIGN_SYSTEM.md',
  'docs/LIQUID_GLASS_CHROME_DESIGN.md',
  'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md',
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
assert.equal(new Set(PROVINCE_CATALOG.map((province) => province.shortName)).size, 48, '州级地区简称必须唯一');
assert.equal(new Set(PROVINCE_CATALOG.map((province) => province.mapName)).size, 48, '州级地图名称必须唯一');
assert.equal(PROVINCE_CATALOG.every((province) => !/州$/.test(province.name)), true, '玩家可见州名必须省略末尾“州”');
assert.equal(PROVINCE_CATALOG.every((province) => typeof province.capitalName === 'string' && province.capitalName.length > 0), true, '每个州必须记录中文首府名称');
assert.equal(PROVINCE_CATALOG.every((province) => typeof province.capitalMapName === 'string' && province.capitalMapName.length > 0), true, '每个州必须记录英文首府名称');
assert.equal(new Set(PROVINCE_CATALOG.map((province) => province.capitalName)).size, 48, '州级中文首府名称必须唯一');
assert.equal(new Set(PROVINCE_CATALOG.map((province) => province.capitalMapName)).size, 48, '州级英文首府名称必须唯一');
assert.equal(
  PROVINCE_CATALOG.every((province) => Number.isFinite(province.capitalLongitude)
    && province.capitalLongitude >= -125
    && province.capitalLongitude <= -66
    && Number.isFinite(province.capitalLatitude)
    && province.capitalLatitude >= 24
    && province.capitalLatitude <= 50),
  true,
  '每个州必须记录美国本土范围内的首府经纬度',
);
const legacyRegionIds = [
  '110000', '120000', '130000', '140000', '150000', '210000', '220000', '230000',
  '310000', '320000', '330000', '340000', '350000', '360000', '370000', '410000',
  '420000', '430000', '440000', '450000', '460000', '500000', '510000', '520000',
  '530000', '540000', '610000', '620000', '630000', '640000', '650000', '710000',
  '810000', '820000',
];
assert.equal(legacyRegionIds.every((id) => PROVINCE_CATALOG.some((province) => province.id === id)), true, '中国地图时期的 34 个地区 ID 必须全部原位保留');
assert.equal(DEFAULT_PROVINCE_ID, '110000', '默认地区 ID 必须保持稳定以保留既有资产');
assert.equal(PROVINCE_CATALOG.find((province) => province.id === DEFAULT_PROVINCE_ID)?.name, '加利福尼亚', '默认地区中文短名必须省略“州”');
assert.equal(PROVINCE_CATALOG.find((province) => province.id === DEFAULT_PROVINCE_ID)?.mapName, 'California', '旧默认地区必须原位映射为加利福尼亚州');
assert.equal(PROVINCE_CATALOG.find((province) => province.id === DEFAULT_PROVINCE_ID)?.capitalName, '萨克拉门托', '加利福尼亚州必须记录首府萨克拉门托');
assert.equal(PROVINCE_CATALOG.find((province) => province.mapName === 'Georgia')?.capitalMapName, 'Atlanta', '佐治亚州必须记录首府 Atlanta');
assert.equal(CURRENT_CLIENT_STATE_VERSION, 39, '州级状态协议必须使用客户端版本 39');
assert.equal(AUTHORITATIVE_WORLD_VERSION, 32, '州级持久化必须使用世界版本 32');

const provinceTypes = read('src/types.ts');
for (const field of ['capitalName: string;', 'capitalMapName: string;', 'capitalLongitude: number;', 'capitalLatitude: number;']) {
  assert.ok(provinceTypes.includes(`  ${field}`), `ProvinceDefinition 缺少首府字段: ${field}`);
}
const productDesign = read('docs/PRODUCT_AND_GAMEPLAY_DESIGN.md');
assert.ok(productDesign.includes('中文首府名称、英文首府名称与首府经纬度'), '产品权威文档必须登记州首府位置字段');
// 首府字段属于共享正式目录的运行事实，上面的 PROVINCE_CATALOG 与 ProvinceDefinition 断言直接验证，
// 不要求服务器架构 DESIGN 复制字段清单。
const docsIndex = read('docs/README.md');
assert.ok(docsIndex.includes('`UI_DESIGN_SYSTEM.md`') && docsIndex.includes('州级中文短名'), '设计索引必须将州级中文短名路由到 UI DESIGN owner');
const uiDesign = read('docs/UI_DESIGN_SYSTEM.md');
for (const text of ['地区商品／工厂详情共享两行标题', '州级地区全称', '中文州全名']) {
  assert.ok(uiDesign.includes(text), `UI DESIGN 缺少州级名称视觉语义: ${text}`);
}

const packageJson = JSON.parse(read('package.json'));
const atlasPackage = JSON.parse(read('node_modules/us-atlas/package.json'));
const topoJsonPackage = JSON.parse(read('node_modules/topojson-client/package.json'));
const worldAtlasPackage = JSON.parse(read('node_modules/world-atlas/package.json'));
assert.equal(packageJson.dependencies?.['us-atlas'], '3.0.1', '州界数据依赖必须精确锁定 us-atlas 3.0.1');
assert.equal(packageJson.dependencies?.['topojson-client'], '3.1.0', 'TopoJSON 转换依赖必须精确锁定 topojson-client 3.1.0');
assert.equal(packageJson.dependencies?.['world-atlas'], '2.0.2', '世界大陆 10m 数据依赖必须精确锁定 world-atlas 2.0.2');
assert.equal(packageJson.dependencies?.['china-geojson'], undefined, '不得继续安装中国地图数据依赖');
assert.match(String(atlasPackage.license || ''), /ISC/i, '州界数据包必须保留 ISC 许可元数据');
assert.match(String(topoJsonPackage.license || ''), /ISC/i, 'TopoJSON 转换包必须保留 ISC 许可元数据');
assert.match(String(worldAtlasPackage.license || ''), /ISC/i, '世界大陆数据包必须保留 ISC 许可元数据');
assert.equal(existsSync('src/data/world-land-110m.json'), false, '不得恢复已退役的 110m 世界大陆数据副本');
const atlasStateCollection = feature(usStateAtlas, usStateAtlas.objects.states);
assert.equal(atlasStateCollection.type, 'FeatureCollection', '州界数据必须可转换为 GeoJSON FeatureCollection');
const atlasRegionNames = atlasStateCollection.features.map((stateFeature) => String(stateFeature?.properties?.name || ''));
for (const excludedName of ['Alaska', 'Hawaii', 'District of Columbia', 'Puerto Rico']) {
  assert.equal(atlasRegionNames.includes(excludedName), true, `上游州界数据变化时必须重新审查过滤: ${excludedName}`);
  assert.equal(PROVINCE_CATALOG.some((province) => province.mapName === excludedName), false, `美国本土经营目录不得包含: ${excludedName}`);
}
const mapRegionNames = atlasRegionNames.filter((name) => PROVINCE_CATALOG.some((province) => province.mapName === name));
assert.equal(mapRegionNames.length, 48, '静态 SVG 地图必须只包含美国连续 48 州');
assert.deepEqual(new Set(mapRegionNames), new Set(PROVINCE_CATALOG.map((province) => province.mapName)), '静态 SVG 州名必须与共享经营地区目录一一对应');

const matching = read('server/src/order-matching.js');
for (const text of ['provinceId: orderProvinceId(incoming)', 'iterateOrderBookSide(world, {']) {
  assert.ok(matching.includes(text), `共享撮合缺少州级隔离: ${text}`);
}
const facilities = read('server/src/facility-groups.js');
for (const text of [
  'const provinceId = normalizeProvinceId(payload.provinceId);',
  'inventoryFor(player, item.productId, provinceId).available -= item.quantity',
  'inventoryFor(player, recipe.output.productId, group.provinceId).available += requirements.output',
  'addPurchasedGroup(world, buyer, typeId, quantity, createdAt, incoming.provinceId)',
  'provinceFacilityGroups', 'provinceFacilityMarkets',
]) assert.ok(facilities.includes(text), `工厂州级边界缺少: ${text}`);
const banking = read('server/src/banking.js');
for (const text of [
  'const provinceId = normalizeProvinceId(item?.provinceId);',
  'transferableFacilityQuantity(world, player, item.facilityTypeId, item.provinceId)',
  'const group = groupFor(player, item.facilityTypeId, item.provinceId);',
]) assert.ok(banking.includes(text), `银行抵押州级边界缺少: ${text}`);
const commercialContracts = read('server/src/commercial-contracts.js');
for (const text of [
  'const provinceId = normalizeProvinceId(payload.provinceId);',
  'groupFor(lessee, contract.facilityTypeId, contract.provinceId, true, now)',
  'groupFor(lender, contract.facilityTypeId, contract.provinceId, true, now)',
]) assert.ok(commercialContracts.includes(text), `借贷或租赁州级边界缺少: ${text}`);
const clientScope = read('src/utils/provinceScope.ts');
for (const text of [
  'game.provinceInventories?.[provinceId]', 'game.provinceFacilityGroups?.[provinceId]',
  'game.provinceMarkets?.[provinceId]', 'game.provinceFacilityMarkets?.[provinceId]',
  'filter((order) => order.provinceId === provinceId)',
]) assert.ok(clientScope.includes(text), `客户端州级切换缺少: ${text}`);

const mapPage = read('src/pages/MapPage.tsx');
for (const text of ['className="province-map-page"', 'aria-label="美国本土州级经营地图页面"']) {
  assert.ok(mapPage.includes(text), `地图页面透明路由占位缺少: ${text}`);
}
assert.equal(mapPage.includes('<UsMainlandMap'), false, 'MapPage 不得重新创建页面级地图实例');
for (const forbidden of ['战略经营地图', '当前经营地区', 'province-map-command-panel', 'province-map-meta', 'province-map-legend']) {
  assert.equal(mapPage.includes(forbidden), false, `地图页不得恢复已删除的卡片: ${forbidden}`);
}
for (const [path, expectedFragments] of [
  ['src/pages/MarketPage.tsx', ["const provinceName = model.selectedProvince?.name || '加利福尼亚州';", 'title={`${provinceName}市场`}', '<RegionalEntityPageTitle entityName={assetName} regionName={provinceName} />']],
  ['src/pages/BuildingsPage.tsx', ["title={`${model.selectedProvince?.name || '加利福尼亚州'}建筑`}"]],
]) {
  const page = read(path);
  for (const fragment of expectedFragments) assert.ok(page.includes(fragment), `${path} 必须只通过标题显示地图当前地区: ${fragment}`);
  for (const forbidden of ['ProvinceSelect', 'province-context-select', 'setSelectedProvinceId']) assert.equal(page.includes(forbidden), false, `${path} 不得恢复州级地区选择器: ${forbidden}`);
}

const strategicWorkspace = read('src/components/shell/StrategicWorkspace.tsx');
for (const text of [
  '<UsMainlandMap', 'summaries={state.summaries}', 'const openProvincePage = (provinceId: string) => {',
  'setSelectedProvinceId(provinceId);', "model.setTab('province');",
  "selectedProvinceId={model.tab === 'province' ? state.selectedProvinceId : null}",
  'onSelectProvince={openProvincePage}', 'referenceNow={model.game.lastProcessedAt}',
  'StrategicMapStage', 'StrategicMapLensBar', 'StrategicWorkspaceChrome',
  "{ id: 'political', label: '州界'", "{ id: 'assets', label: '资产'", "{ id: 'industry', label: '工业'",
  "{ id: 'market', label: '市场'", "{ id: 'alerts', label: '异常'",
]) assert.ok(strategicWorkspace.includes(text), `常驻战略地图交互缺少: ${text}`);
assert.equal(strategicWorkspace.includes('useNow('), false, 'StrategicMapStage 不得订阅高频运输时钟');
for (const forbidden of ['当前经营地区', 'strategic-province-inspector', '进入本地市场', '管理本地生产']) {
  assert.equal(strategicWorkspace.includes(forbidden), false, `战略 Chrome 不得恢复已删除的经营地区卡片: ${forbidden}`);
}
const gameShell = read('src/components/shell/GameShell.tsx');
for (const text of [
  'const STRATEGIC_PAGE_PRESENTATION = {', "province: 'building'", '<ApplicationMapLayerPortal>',
  '<StrategicMapStage model={model} lens={mapLens} />',
  '<StrategicMapLensBar lens={mapLens} onLensChange={setMapLens} />',
  '<StrategicWorkspaceChrome', 'data-strategic-presentation={pagePresentation}',
]) assert.ok(gameShell.includes(text), `玩家战略外壳缺少: ${text}`);
for (const text of [
  'appendPlayerPageHistory',
  'pushPlayerPage',
  'replacePlayerPage',
  'currentLocation: pageLocation',
]) assert.ok(gameShell.includes(text), `州级上下文页统一返回栈缺少: ${text}`);
const pageStack = read('src/navigation/playerPageStack.ts');
for (const text of [
  'MAX_PLAYER_PAGE_STACK_DEPTH = 20',
  "type: 'province'",
  "type: 'regional-product'",
  "type: 'regional-facility'",
  'maximumHistoryDepth = MAX_PLAYER_PAGE_STACK_DEPTH - 1',
]) assert.ok(pageStack.includes(text), `受限页面栈缺少: ${text}`);

const provincePage = read('src/pages/ProvincePage.tsx');
for (const text of [
  'export function ProvincePage', 'title={isMarketDetail && marketDetailProduct ? (', 'role="tablist"', 'role="tab"', 'role="tabpanel"',
  "{ id: 'overview', label: '概览' }", "{ id: 'market', label: '市场' }",
  "{ id: 'buildings', label: '建筑' }", "{ id: 'warehouse', label: '仓库' }",
  '<EmbeddedMarketPage model={model} embedded />', '<EmbeddedBuildingsPage',
  '<WarehouseInventoryPanel', 'className="province-warehouse-section"', 'onOpenProduct={openWarehouseProduct}',
  "if (current.type === 'map') {", 'pageNavigation.pushPage(provinceLocation);',
  'pageNavigation.replacePage(provinceLocation);',
]) assert.ok(provincePage.includes(text), `州级上下文页缺少: ${text}`);
assert.equal(
  provincePage.includes("model.tab !== 'province' || !isUnlocked"),
  false,
  '锁定州也必须先建立 map → province 返回层，不能因未解锁跳过位置规范化',
);
const provinceStyles = read('src/styles/province-page.css');
assert.ok(provinceStyles.includes('grid-template-columns: repeat(4, minmax(0, 1fr));'), '州级上下文切换必须保持四个等宽按钮');
assert.ok(provinceStyles.includes('min-height: 44px;'), '州级上下文切换必须保持 44px 触控高度');

const mapComponent = read('src/components/provinces/UsMainlandMap.tsx');
for (const text of [
  "us-atlas/states-10m.json", "import { feature, merge } from 'topojson-client'", 'const regionByMapName = new Map',
  'createProvinceMapProjection', 'provinceGeometryPath', 'layoutProvinceMapLabels', 'createProvinceMapCamera',
  'provinceMapWorld', 'province-map-camera-surface', 'province-map-world-svg', 'province-map-region',
  'provinceMapMainlandOutlinePath', 'province-map-world-shadow', 'province-map-world-fill', 'province-map-mainland-seam', 'province-map-mainland-outline',
  'province-map-label-camera', 'data-map-world-path-count={provinceMapWorld.length}', 'data-map-path-revision="1"',
  'data-selected-province-id={selectedProvinceId ?? \'\'}', 'data-map-lens={lens}', 'data-map-label-mode="curved-chinese-full-name"',
  'data-map-ready="true"', 'data-testid="us-mainland-map"',
  'capitalPointByProvinceId', 'province-map-routes', 'province-map-route-path', 'province-map-route-return-path',
  'routePicking', 'data-route-picking={routePickingActive ? \'true\' : \'false\'}', 'data-route-pickable',
  "import { LiveServerTime } from '../time/LiveServerTime'", 'referenceNow = Date.now()',
  'data-map-clock-scope="shipment-leaf"', '<LiveServerTime referenceNow={referenceNow} intervalMs={500}>',
]) assert.ok(mapComponent.includes(text), `静态 SVG 美国本土地图缺少: ${text}`);
for (const forbidden of [
  '<EconomyChart', 'EChartsType', 'registerEChartsMap', "type: 'map'", "type: 'geoRoam'", 'dispatchAction',
  "roam: 'move'", 'layoutCenter', 'layoutSize', 'createProvinceMapZoomInterpolator', 'createProvinceMapLabelRenderer',
  'name: region.shortName', 'name: province.shortName', 'textPath', 'textLength', 'spacingAndGlyphs',
]) assert.equal(mapComponent.includes(forbidden), false, `静态地图不得恢复 ECharts 或旧标签路径: ${forbidden}`);

const projection = read('src/components/provinces/provinceMapProjection.ts');
for (const text of [
  'export const PROVINCE_MAP_ASPECT_SCALE = 0.75', 'export const PROVINCE_MAP_WORLD_WIDTH = 1200',
  'export const PROVINCE_MAP_CONTAIN_INSET = 0.96', 'export function createProvinceMapProjection',
  'export function provinceGeometryPath', 'viewBox:', 'project:',
]) assert.ok(projection.includes(text), `静态地图投影缺少: ${text}`);

const worldContext = read('src/components/provinces/provinceMapWorldOutline.ts');
for (const text of ['north-america-land-10m.json', "import { feature } from 'topojson-client'", 'northAmericaContextGeometry', 'createProvinceMapWorldOutlinePath', 'createProvinceMapMainlandFocusBounds']) {
  assert.ok(worldContext.includes(text), `10m 世界大陆运行时上下文缺少: ${text}`);
}
for (const forbidden of ['world-atlas/', 'NORTH_AMERICA_CONTEXT_COUNTRY_IDS', 'mergeArcs']) {
  assert.equal(worldContext.includes(forbidden), false, `玩家运行时不得恢复完整 atlas 或现场裁剪: ${forbidden}`);
}
const worldContextGenerator = read('scripts/generate-province-map-world-context.mjs');
for (const text of ['world-atlas/countries-10m.json', 'NORTH_AMERICA_CONTEXT_COUNTRY_IDS', "'840'", 'mergeArcs(worldCountryAtlas, contextGeometries)', 'referencedArcIndexes', 'remapArcRefs', "process.argv.includes('--check')"]) {
  assert.ok(worldContextGenerator.includes(text), `10m 世界大陆生成器缺少: ${text}`);
}
const worldContextAsset = read('src/data/north-america-land-10m.json');
assert.ok(worldContextAsset.length < 1_500_000, '北美 10m 裁剪 TopoJSON 不得退化为完整 atlas 或预展开浮点 GeoJSON 体积');
execFileSync(process.execPath, ['scripts/generate-province-map-world-context.mjs', '--check'], { stdio: 'inherit' });
const camera = read('src/components/provinces/provinceMapCamera.ts');
for (const text of [
  'export const PROVINCE_MAP_ZOOM_MIN = 1', 'export const PROVINCE_MAP_ZOOM_MAX = 4',
  'MAINLAND_MIN_AREA_RATIO = 2 / 3', 'MAINLAND_CONTEXT_EXPAND_X = 0.35', 'MAINLAND_CONTEXT_EXPAND_Y = 0.25',
  "container.dataset.mapPanBoundary = options.focusBounds ? 'mainland-context' : 'none'", 'minimumPhysicalZoom', 'mapZoomBaseScale',
  "container.dataset.mapRenderer = 'static-svg'", "container.dataset.mapCameraMode = 'html-compositor-transform'",
  "container.dataset.mapCameraHotPath = 'single-css-transform'", "container.dataset.mapCameraGeometryMode = 'immutable-svg-world'",
  'surface.style.transform = `translate3d(', 'requestAnimationFrame(writeCamera)', 'if (frame === null)',
  'let settleDeadline = 0;', 'const finishSettle = () => {', 'settleDeadline = performance.now() + INPUT_SETTLE_MS;',
  "container.addEventListener('wheel', handleWheel, { passive: false })", 'event.preventDefault();',
  'applyZoomAround', 'pointers.size >= 2', "container.dataset.mapCameraReset = 'blank-double-click'",
  "container.dataset.mapCameraReset = 'blank-double-tap'",
]) assert.ok(camera.includes(text), `静态地图合成相机缺少: ${text}`);
const writeCameraStart = camera.indexOf('const writeCamera = () => {');
const writeCameraEnd = camera.indexOf('\n  };', writeCameraStart);
assert.ok(writeCameraStart >= 0 && writeCameraEnd > writeCameraStart, '必须能定位地图相机 RAF 热路径');
const writeCameraSource = camera.slice(writeCameraStart, writeCameraEnd);
assert.ok(writeCameraSource.includes('surface.style.transform ='), '地图相机 RAF 必须写入唯一 transform');
for (const forbidden of ['container.dataset', 'publishState(', 'getBoundingClientRect(', 'setTimeout(', 'setActive(']) {
  assert.equal(writeCameraSource.includes(forbidden), false, `地图相机 RAF 热路径不得包含: ${forbidden}`);
}
for (const forbidden of ['geoRoam', 'dispatchAction', 'setOption(', 'convertToPixel', 'layoutSize', 'layoutCenter', "surface.style.willChange = nextActive ? 'transform' : ''"]) {
  assert.equal(camera.includes(forbidden), false, `地图交互热路径不得恢复几何重绘或手势级合成层切换: ${forbidden}`);
}

const labels = read('src/components/provinces/provinceMapStaticLabels.ts');
for (const text of [
  'export function pointInProvincePolygon', 'function principalAngle', 'function measureNaturalText',
  'function corridorProfile', 'function findBestLabelCorridor', 'function rotatedGlyphBoxInsidePolygon',
  'function glyphPlacements', 'export function layoutProvinceMapLabels', 'ProvinceMapProjection',
]) assert.ok(labels.includes(text), `静态州名布局缺少: ${text}`);
for (const forbidden of ['EChartsType', 'convertToPixel', 'geoRoam', 'requestAnimationFrame', 'textPath', 'textLength', 'scaleX', 'scaleY']) {
  assert.equal(labels.includes(forbidden), false, `州名布局不得进入交互热路径: ${forbidden}`);
}

const echartsCore = read('src/components/charts/echartsCore.ts');
for (const forbidden of ['MapChart', 'GeoComponent', 'registerMap', 'registerEChartsMap']) {
  assert.equal(echartsCore.includes(forbidden), false, `战略地图退役后不得继续加载 ECharts 地图模块: ${forbidden}`);
}

const mapStyles = read('src/styles/province-map.css');
for (const text of [
  '.province-map-camera-surface', 'transform-origin: 0 0;', '.province-map-world-svg', '.province-map-region',
  '.province-map-label', '.province-map-label-glyph', 'fill: var(--color-map-label);', "[data-selected='true']",
  '.province-map-world-shadow', '.province-map-world-fill', '.province-map-world-outline', '.province-map-mainland-seam', '.province-map-mainland-outline',
  'touch-action: none;', '.province-map-static-tooltip',
  '.province-map-routes', '.province-map-route-path', '.province-map-route-return-path', '.province-map-route-stop',
  "[data-route-picking='true']", "[data-route-kind='draft']", "[data-route-kind='highlight']",
]) assert.ok(mapStyles.includes(text), `静态地图样式缺少: ${text}`);
const performanceStyles = read('src/styles/performance.css');
assert.ok(performanceStyles.includes('.province-map-camera-surface') && performanceStyles.includes('will-change: transform;'), '唯一战略地图相机层必须常驻 will-change: transform');
for (const forbidden of ['.province-map-marker', '.province-map-silhouette', '.province-map-command-panel', '.province-map-meta', '.province-map-legend']) {
  assert.equal(mapStyles.includes(forbidden), false, `地图样式不得恢复旧地图标记或卡片: ${forbidden}`);
}
const strategicStyles = read('src/styles/strategic-game-shell.css');
const designSystemStyles = read('src/styles/design-system.css');
for (const text of ['.application-map-layer', '.game-shell .workspace-strategic-chrome', '.application-map-layer > .strategic-map-lens-bar', '--strategic-command-rail-width: 78px']) {
  assert.ok(strategicStyles.includes(text), `常驻战略地图样式缺少: ${text}`);
}
for (const text of ['--color-map-region-default:', '--color-map-region-locked:', '--color-map-region-border:', '--color-map-label:']) {
  assert.ok(designSystemStyles.includes(text), `地图设计令牌缺少: ${text}`);
}
for (const [path, selector, expectedOverflow] of [
  ['src/styles/financial-backdrop.css', '.application-map-layer', 'hidden'],
  ['src/styles/strategic-game-shell.css', '.strategic-map-stage', 'visible'],
]) {
  const source = read(path);
  const start = source.lastIndexOf(`${selector} {`);
  const block = start >= 0 ? source.slice(start, source.indexOf('}', start) + 1) : '';
  assert.ok(block.includes(`overflow: ${expectedOverflow};`), `${selector} 必须使用 ${expectedOverflow} 作为地图最终视口边界`);
  for (const text of ['border: 0;', 'border-radius: 0;', 'outline: 0;', 'box-shadow: none;']) assert.ok(block.includes(text), `${selector} 不得产生地图外缘白边，缺少: ${text}`);
}

const worldBoundaryTest = read('tests/browser/province-map-world-boundary.spec.ts');
for (const text of [
  'continents-filled-10m', 'data-map-world-resolution', 'states-10m-union',
  'data-map-focus-area-target', 'baseline.areaRatio', 'centerOffsetX', 'mainland-context',
]) assert.ok(worldBoundaryTest.includes(text), `战略地图世界上下文浏览器回归缺少: ${text}`);
const mapBrowserTest = read('tests/browser/province-map.spec.ts');
for (const text of [
  'persistent strategy map uses one static SVG world for 48 states and Chinese labels',
  "data-map-renderer', 'static-svg'", "data-map-camera-mode', 'html-compositor-transform'",
  "data-map-camera-hot-path', 'single-css-transform'", "data-map-world-path-count', '48'",
  "data-map-label-camera-mode', 'shared-static-world'", "'加利福尼亚', '得克萨斯', '华盛顿', '佛罗里达', '纽约'",
  'state selection opens local context without resetting the static camera',
  'mobile static map keeps labels, touch gestures and hidden tooltip behavior',
  "toHaveCSS('touch-action', 'none')", "data-map-tooltip-mode', 'hidden-mobile'",
]) assert.ok(mapBrowserTest.includes(text), `静态地图浏览器回归缺少: ${text}`);

const transientTest = read('tests/browser/map-zoom-transient.spec.ts');
for (const text of [
  'map zoom only changes the shared compositor camera while SVG geometry stays immutable',
  'pathData', 'glyphTransforms', 'active wheel bursts mutate only the camera transform once per animation frame',
  'MutationObserver', 'transformMutations', 'diagnosticMutations',
  'expect(result.transformMutations).toBe(1)', 'expect(result.diagnosticMutations).toBe(0)',
  "toHaveCSS('will-change', 'transform')",
]) assert.ok(transientTest.includes(text), `地图合成热路径回归缺少: ${text}`);
const syncTest = read('tests/browser/map-zoom-render-sync.spec.ts');
for (const text of [
  'province paths and labels share one static SVG world and never require camera resynchronization',
  'pathCamera: true', 'labelCamera: true', 'labelSvg: true', 'zoomedGeometry', 'baselineGeometry',
]) assert.ok(syncTest.includes(text), `地图州名同步回归缺少: ${text}`);
const boundaryTest = read('tests/browser/map-zoom-out-boundary.spec.ts');
for (const text of [
  'states outside the viewport re-enter during zoom-out because all 48 paths remain mounted',
  'offscreenBeforeZoomOut', 'zoomOutActiveFrame.active', "toBe('true')", 'restoredDuringActiveZoom', 'pathsAfter', 'pathsBefore',
  'zoomOutActiveFrame.transform',
]) assert.ok(boundaryTest.includes(text), `地图屏外州恢复回归缺少: ${text}`);
const resetTest = read('tests/browser/map-reset-sync.spec.ts');
for (const text of [
  'blank double click resets the single compositor camera for paths and labels in the first frame',
  "'blank-double-click'", 'baselinePathRevision', 'baselineLabelCenter', 'firstFrameLabelCenter',
]) assert.ok(resetTest.includes(text), `地图重置回归缺少: ${text}`);

assert.equal((uiDesign.match(/### 8\.1 美国本土州级经营地图/g) ?? []).length, 1, 'UI 设计文档只能保留一份美国本土州级经营地图 8.1 规则');
for (const text of [
  '静态 SVG 世界面', '同一个 `.province-map-camera-surface`', '48 个州面 path 必须始终完整挂载',
  '响应式条件下不得通过第二相机、第二地图或重排标签来实现镜头变化', '州面 path 的 `d`', '中文州全名', '同一个 SVG 世界坐标系',
  '不得通过 `textLength`', '不大于 `720px` 时地图 Tooltip',
]) assert.ok(uiDesign.includes(text), `静态地图 UI 设计规则缺少: ${text}`);
for (const forbidden of ['每个动画帧必须把 `nextZoom / currentZoom` 作为增量通过正式 `geoRoam`', '每个动画帧最多调用一次增量 `geoRoam`']) {
  assert.equal(uiDesign.includes(forbidden), false, `UI 设计文档不得保留逐帧 ECharts 缩放旧规则: ${forbidden}`);
}
const pageDesign = read('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md');
for (const text of [
  '州级上下文页（无导航按钮）', '概览｜市场｜建筑｜仓库', '中文州全名作为唯一州面名称',
  '静态 SVG 世界面', '战略地图镜头、缩放、重置和平移边界唯一遵循', '名称随地图缩放和平移同步变化',
  '不大于 `720px` 时镜头栏和地图 Tooltip 必须隐藏',
]) assert.ok(pageDesign.includes(text), `州级页面设计权威缺少: ${text}`);
const chromeDesign = read('docs/LIQUID_GLASS_CHROME_DESIGN.md');
for (const text of [
  '静态 SVG 世界面', '单一合成相机', '每帧最多一次', '屏幕外的州面',
  '`world-atlas@2.0.2`', '`states-10m`', '逻辑 `1×`', '`2/3`', '水平方向约扩展 `35%`', '垂直方向约扩展 `25%`',
  '待提交的 `requestAnimationFrame` 相机写入', '至少提交一帧 active 合成结果', '`INPUT_SETTLE_MS` 收口',
  '必须常驻 `will-change: transform`', '诊断 `data-*` 只允许在初始化、输入开始、输入结束或重置等边界同步',
  '输入 settle 只能更新一个 deadline 并复用单一定时器', '在途运输位置的 `500ms` 共享时间只允许由运输 marker 最小动态子树消费',
  '`StrategicMapStage` 不得订阅该高频时间',
]) {
  assert.ok(chromeDesign.includes(text), `地图外壳权威缺少: ${text}`);
}

const navigation = read('src/config/navigation.ts');
assert.equal(navigation.includes("{ id: 'map', label: '地图' }"), false, '桌面侧栏与移动底栏不得显示地图按钮');
assert.ok(navigation.includes("export type TabId = NavigationTabId | 'map' | 'province';"), '纯地图与隐藏州级上下文视图必须保留 TabId');
const tests = read('server/test/provinces.test.js');
for (const text of [
  'same commodity immediate trades use independent state daily prices and inventories', 'world 30 geography replacement keeps legacy scoped assets on their existing region IDs',
  'construction and production consume and output only the selected province inventory', 'factory market orders are rejected and legacy open orders are retired',
  'without serialized aliases',
]) assert.ok(tests.includes(text), `州级经济专项测试缺少: ${text}`);
assert.ok(read('server/test/banking.test.js').includes('bank collateral locks only the selected province facility group'), '缺少银行跨省抵押防回退测试');
assert.ok(read('server/test/commercial-contracts.test.js').includes('facility lease usage and locks stay in the contract province'), '缺少工厂租赁跨省锁定防回退测试');

console.log('地区经济验证通过：美国连续 48 州、中文展示名统一省略“州”、版本 39/32、既有地区 ID 原位保留、48 个州首府中英文名称与经纬度完整记录、州级经济隔离、隐藏州级上下文页、静态完整 SVG 世界面、州面与中文州名共享同一合成相机、缩放和平移 RAF 热路径只写单次 transform 且不逐帧批量写诊断属性、唯一相机层常驻合成、运输 500ms 时钟只提交 marker/Tooltip 叶子、几何在手势期间不可变、屏外州缩小 active 阶段即可重新进入、空白双击／双触重置和移动 Tooltip 边界均已锁定。');
