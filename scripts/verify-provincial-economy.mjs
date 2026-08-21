import assert from 'node:assert/strict';
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
  'src/components/provinces/provinceMapLabels.ts',
  'src/styles/province-map.css',
  'src/styles/province-page.css',
  'src/styles/strategic-game-shell.css',
  'src/utils/provinceScope.ts',
  'docs/PRODUCT_AND_GAMEPLAY_DESIGN.md',
  'docs/INDUSTRY_AND_PRODUCTION_DESIGN.md',
  'docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md',
  'docs/WAREHOUSE_EXPANSION_DESIGN.md',
  'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
  'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md',
];
for (const path of requiredFiles) assert.equal(existsSync(path), true, `缺少州级经济文件: ${path}`);
assert.equal(
  existsSync('src/components/provinces/ProvinceSelect.tsx'),
  false,
  '地图州面是唯一地区切换入口，不得恢复 ProvinceSelect',
);

assert.equal(PROVINCE_CATALOG.length, 48, '州级地区目录必须包含美国连续 48 州');
assert.equal(new Set(PROVINCE_CATALOG.map((province) => province.id)).size, 48, '州级地区 ID 必须唯一');
assert.equal(new Set(PROVINCE_CATALOG.map((province) => province.name)).size, 48, '州级地区中文全名必须唯一');
assert.equal(new Set(PROVINCE_CATALOG.map((province) => province.shortName)).size, 48, '州级地区简称必须唯一');
assert.equal(new Set(PROVINCE_CATALOG.map((province) => province.mapName)).size, 48, '州级地图名称必须唯一');
assert.equal(PROVINCE_CATALOG.every((province) => /州$/.test(province.name)), true, '地图州名必须使用中文州全名');
const legacyRegionIds = [
  '110000', '120000', '130000', '140000', '150000', '210000', '220000', '230000',
  '310000', '320000', '330000', '340000', '350000', '360000', '370000', '410000',
  '420000', '430000', '440000', '450000', '460000', '500000', '510000', '520000',
  '530000', '540000', '610000', '620000', '630000', '640000', '650000', '710000',
  '810000', '820000',
];
assert.equal(legacyRegionIds.every((id) => PROVINCE_CATALOG.some((province) => province.id === id)), true, '中国地图时期的 34 个地区 ID 必须全部原位保留');
assert.equal(DEFAULT_PROVINCE_ID, '110000', '默认地区 ID 必须保持稳定以保留既有资产');
assert.equal(PROVINCE_CATALOG.find((province) => province.id === DEFAULT_PROVINCE_ID)?.mapName, 'California', '旧默认地区必须原位映射为加利福尼亚州');
assert.equal(CURRENT_CLIENT_STATE_VERSION, 36, '州级状态协议必须使用客户端版本 36');
assert.equal(AUTHORITATIVE_WORLD_VERSION, 32, '州级持久化必须使用世界版本 32');

const packageJson = JSON.parse(read('package.json'));
const atlasPackage = JSON.parse(read('node_modules/us-atlas/package.json'));
const topoJsonPackage = JSON.parse(read('node_modules/topojson-client/package.json'));
assert.equal(packageJson.dependencies?.['us-atlas'], '3.0.1', '州界数据依赖必须精确锁定 us-atlas 3.0.1');
assert.equal(packageJson.dependencies?.['topojson-client'], '3.1.0', 'TopoJSON 转换依赖必须精确锁定 topojson-client 3.1.0');
assert.equal(packageJson.dependencies?.['china-geojson'], undefined, '不得继续安装中国地图数据依赖');
assert.match(String(atlasPackage.license || ''), /ISC/i, '州界数据包必须保留 ISC 许可元数据');
assert.match(String(topoJsonPackage.license || ''), /ISC/i, 'TopoJSON 转换包必须保留 ISC 许可元数据');
const atlasStateCollection = feature(usStateAtlas, usStateAtlas.objects.states);
assert.equal(atlasStateCollection.type, 'FeatureCollection', '州界数据必须可转换为 GeoJSON FeatureCollection');
const atlasRegionNames = atlasStateCollection.features.map((stateFeature) => String(stateFeature?.properties?.name || ''));
for (const excludedName of ['Alaska', 'Hawaii', 'District of Columbia', 'Puerto Rico']) {
  assert.equal(atlasRegionNames.includes(excludedName), true, `上游州界数据变化时必须重新审查过滤: ${excludedName}`);
  assert.equal(PROVINCE_CATALOG.some((province) => province.mapName === excludedName), false, `美国本土经营目录不得包含: ${excludedName}`);
}
const mapRegionNames = atlasRegionNames.filter((name) => PROVINCE_CATALOG.some((province) => province.mapName === name));
assert.equal(mapRegionNames.length, 48, 'ECharts 地图必须只包含美国连续 48 州');
assert.deepEqual(
  new Set(mapRegionNames),
  new Set(PROVINCE_CATALOG.map((province) => province.mapName)),
  'ECharts GeoJSON 州名必须与共享经营地区目录一一对应',
);

const matching = read('server/src/order-matching.js');
for (const text of [
  'provinceId: orderProvinceId(incoming)',
  'iterateOrderBookSide(world, {',
]) assert.ok(matching.includes(text), `共享撮合缺少州级隔离: ${text}`);

const facilities = read('server/src/facility-groups.js');
for (const text of [
  'const provinceId = normalizeProvinceId(payload.provinceId);',
  'inventoryFor(player, item.productId, provinceId).available -= item.quantity',
  'inventoryFor(player, recipe.output.productId, group.provinceId).available += requirements.output',
  'addPurchasedGroup(world, buyer, typeId, quantity, createdAt, incoming.provinceId)',
  'provinceFacilityGroups',
  'provinceFacilityMarkets',
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
  'game.provinceInventories?.[provinceId]',
  'game.provinceFacilityGroups?.[provinceId]',
  'game.provinceMarkets?.[provinceId]',
  'game.provinceFacilityMarkets?.[provinceId]',
  'filter((order) => order.provinceId === provinceId)',
]) assert.ok(clientScope.includes(text), `客户端省份切换缺少: ${text}`);

const mapPage = read('src/pages/MapPage.tsx');
for (const text of [
  'className="province-map-page"',
  'aria-label="美国本土州级经营地图页面"',
]) assert.ok(mapPage.includes(text), `地图页面透明路由占位缺少: ${text}`);
assert.equal(mapPage.includes('<UsMainlandMap'), false, 'MapPage 不得重新创建页面级地图实例');
for (const forbidden of ['战略经营地图', '当前经营地区', 'province-map-command-panel', 'province-map-meta', 'province-map-legend']) {
  assert.equal(mapPage.includes(forbidden), false, `地图页不得恢复已删除的卡片: ${forbidden}`);
}

for (const [path, expectedFragments] of [
  ['src/pages/MarketPage.tsx', [
    "const provinceName = model.selectedProvince?.name || '加利福尼亚州';",
    'title={`${provinceName}市场`}',
    'title={`${provinceName} · ${assetName}`}',
  ]],
  ['src/pages/BuildingsPage.tsx', ["title={`${model.selectedProvince?.name || '加利福尼亚州'}建筑`}"]],
]) {
  const page = read(path);
  for (const expectedFragment of expectedFragments) {
    assert.ok(page.includes(expectedFragment), `${path} 必须只通过标题显示地图当前地区: ${expectedFragment}`);
  }
  for (const forbidden of ['ProvinceSelect', 'province-context-select', 'setSelectedProvinceId']) {
    assert.equal(page.includes(forbidden), false, `${path} 不得恢复州级地区选择器: ${forbidden}`);
  }
}

const strategicWorkspace = read('src/components/shell/StrategicWorkspace.tsx');
for (const text of [
  '<UsMainlandMap',
  'summaries={state.summaries}',
  'const openProvincePage = (provinceId: string) => {',
  'setSelectedProvinceId(provinceId);',
  "model.setTab('province');",
  "selectedProvinceId={model.tab === 'province' ? state.selectedProvinceId : null}",
  'onSelectProvince={openProvincePage}',
  'StrategicMapStage',
  'StrategicMapLensBar',
  'StrategicWorkspaceChrome',
  "{ id: 'political', label: '州界'",
  "{ id: 'assets', label: '资产'",
  "{ id: 'industry', label: '工业'",
  "{ id: 'market', label: '市场'",
  "{ id: 'alerts', label: '异常'",
]) assert.ok(strategicWorkspace.includes(text), `常驻战略地图交互缺少: ${text}`);
for (const forbidden of ['当前经营地区', 'strategic-province-inspector', '进入本地市场', '管理本地生产']) {
  assert.equal(strategicWorkspace.includes(forbidden), false, `战略 Chrome 不得恢复已删除的经营地区卡片: ${forbidden}`);
}

const gameShell = read('src/components/shell/GameShell.tsx');
for (const text of [
  'const STRATEGIC_PAGE_PRESENTATION = {',
  "province: 'building'",
  '<ApplicationMapLayerPortal>',
  '<StrategicMapStage model={model} lens={mapLens} />',
  '<StrategicMapLensBar lens={mapLens} onLensChange={setMapLens} />',
  '<StrategicWorkspaceChrome',
  'data-strategic-presentation={pagePresentation}',
]) assert.ok(gameShell.includes(text), `玩家战略外壳缺少: ${text}`);
assert.equal(gameShell.includes("previousTab !== 'map' && previousTab !== 'province'"), true, '州级上下文页不得污染普通业务页面返回历史');

const strategicStyles = read('src/styles/strategic-game-shell.css');
const designSystemStyles = read('src/styles/design-system.css');
for (const text of [
  '.application-map-layer',
  '.game-shell .workspace-strategic-chrome',
  '.application-map-layer > .strategic-map-lens-bar',
  '--strategic-command-rail-width: 78px',
  'touch-action: none;',
]) assert.ok(strategicStyles.includes(text), `常驻战略地图样式缺少: ${text}`);
for (const text of [
  '--color-map-region-default:',
  '--color-map-region-locked:',
  '--color-map-region-border:',
  '--color-map-label:',
]) assert.ok(designSystemStyles.includes(text), `地图设计令牌缺少: ${text}`);
assert.equal(strategicStyles.includes('.strategic-province-inspector'), false, '战略地图样式不得恢复经营地区检查器');
assert.equal(strategicStyles.includes('.strategic-map-stage--background'), false, '打开业务页面不得通过背景态压暗地图');

const provincePage = read('src/pages/ProvincePage.tsx');
for (const text of [
  'export function ProvincePage',
  'title={provinceName}',
  'role="tablist"',
  'role="tab"',
  'role="tabpanel"',
  "{ id: 'overview', label: '概览' }",
  "{ id: 'market', label: '市场' }",
  "{ id: 'buildings', label: '建筑' }",
  "{ id: 'warehouse', label: '仓库' }",
  '<EmbeddedMarketPage model={model} embedded />',
  '<EmbeddedBuildingsPage model={model} embedded />',
  '<WarehouseInventoryPanel model={model} className="province-warehouse-section" />',
]) assert.ok(provincePage.includes(text), `州级上下文页缺少: ${text}`);
const provinceStyles = read('src/styles/province-page.css');
assert.ok(provinceStyles.includes('grid-template-columns: repeat(4, minmax(0, 1fr));'), '州级上下文切换必须保持四个等宽按钮');
assert.ok(provinceStyles.includes('min-height: 44px;'), '州级上下文切换必须保持 44px 触控高度');

const mapComponent = read('src/components/provinces/UsMainlandMap.tsx');
for (const text of [
  "us-atlas/states-10m.json",
  "import { feature } from 'topojson-client'",
  'const regionByMapName = new Map',
  'if (!region) return []',
  'name: region.name',
  'name: province.name',
  'createProvinceMapLabelRenderer',
  'provinceMapLabelSources',
  'registerEChartsMap(US_MAINLAND_MAP_NAME, usMainlandGeoJson)',
  "type: 'map'",
  "selectedMode: 'single'",
  "roamTrigger: 'global'",
  'scaleLimit: { min: 0.5, max: 4 }',
  'const US_MAINLAND_ASPECT_SCALE = 0.75',
  'const MOBILE_BLANK_DOUBLE_TAP_MS = 360',
  'const MOBILE_BLANK_DOUBLE_TAP_DISTANCE = 28',
  'const MAP_CONTAIN_INSET = 0.96',
  'function containLayoutSize(width: number, height: number)',
  'aspectScale: US_MAINLAND_ASPECT_SCALE',
  'zoom: 1',
  "layoutCenter: ['50%', '50%']",
  'label: {\n        show: false,',
  'updateMode="merge"',
  'onChartReady={handleChartReady}',
  'onOptionApplied={handleOptionApplied}',
  'onResize={handleChartResize}',
  "container.dataset.mapFitMode = 'contain'",
  'container.dataset.mapContainViewport',
  'onClick={handleMapClick}',
  'onCanvasClick={handleMapCanvasClick}',
  'selectedProvinceId: string | null',
  "data-selected-province-id={selectedProvinceId ?? ''}",
  'const handleMapDoubleClick = useCallback',
  "if (event.target || event.event?.pointerType === 'touch') return;",
  "chart.getDom().dataset.mapCameraReset = 'blank-double-click'",
  "chart.getDom().dataset.mapCameraReset = 'blank-double-tap'",
  'onDoubleClick={handleMapDoubleClick}',
  'data-province-count={provinces.length}',
  'data-map-feature-count={usMainlandGeoJson.features.length}',
  'data-map-lens={lens}',
  'data-map-label-mode="curved-chinese-full-name"',
]) assert.ok(mapComponent.includes(text), `ECharts 美国本土地图缺少: ${text}`);
for (const forbidden of [
  'HOVER_LABEL_STATE_CODES',
  'name: region.shortName',
  'name: province.shortName',
  'labelLayout:',
  'maxAspectRatio: 0.8',
  "var(--color-surface-muted)",
  'data: data.map((datum)',
]) {
  assert.equal(mapComponent.includes(forbidden), false, `地图不得恢复英文缩写或旧标签实现: ${forbidden}`);
}
for (const forbidden of [
  'applyCoverCamera',
  'coverLayoutSize',
  'mapCoverViewport',
  "left: '5%'",
  "right: '5%'",
  "top: '7%'",
  "bottom: '9%'",
  "layoutCenter: ['50%', '39%']",
  "layoutSize: '84%'",
]) {
  assert.equal(mapComponent.includes(forbidden), false, `Contain 地图不得恢复裁切或选择后归中实现: ${forbidden}`);
}

const mapLabels = read('src/components/provinces/provinceMapLabels.ts');
for (const text of [
  'export function pointInPolygon',
  'function principalAngle',
  'function measureNaturalText',
  'function corridorProfile',
  'function findBestLabelCorridor',
  'function rotatedGlyphBoxInsidePolygon',
  'function glyphPlacements',
  'export function createProvinceMapLabelRenderer',
  "document.createElementNS(SVG_NAMESPACE, name)",
  "createSvgElement('g')",
  "createSvgElement('text')",
  "group.dataset.labelFit = 'inside'",
  "group.dataset.labelGlyphMode = 'rigid'",
  'group.dataset.labelNaturalAspect',
  'group.dataset.labelAvailableLength',
  'group.dataset.labelAvailableHeight',
  'group.dataset.labelUsedWidth',
  'group.dataset.labelUsedHeight',
  'group.dataset.labelAxisAngle',
  "chart.on('georoam', handleGeoRoam)",
  "container.dataset.mapLabelMode = 'curved-chinese-full-name'",
  "container.dataset.mapLabelGeometryMode = 'natural-ratio-rigid-glyphs'",
  'container.dataset.mapLabelCount',
  'container.dataset.mapCurvedLabelCount',
]) assert.ok(mapLabels.includes(text), `州内中文自然比例标签缺少: ${text}`);
for (const forbidden of [
  'shortName',
  'mapName',
  'foreignObject',
  'pointerdown',
  'textPath',
  'textLength',
  'lengthAdjust',
  'spacingAndGlyphs',
  'scaleX',
  'scaleY',
]) {
  assert.equal(mapLabels.includes(forbidden), false, `地图标签层不得恢复英文简称、字形拉伸或独立交互: ${forbidden}`);
}

const echartsCore = read('src/components/charts/echartsCore.ts');
for (const text of ['MapChart', 'GeoComponent', 'registerEChartsMap']) {
  assert.ok(echartsCore.includes(text), `ECharts 地图核心缺少: ${text}`);
}

const mapStyles = read('src/styles/province-map.css');
for (const text of [
  '.province-map-label-overlay',
  '.province-map-label',
  '.province-map-label-glyph',
  'pointer-events: none;',
  'fill: var(--color-map-label);',
  "[data-selected='true']",
]) assert.ok(mapStyles.includes(text), `州内中文曲线标签样式缺少: ${text}`);
for (const forbidden of [
  '.province-map-marker',
  '.province-map-silhouette',
  '.province-map-command-panel',
  '.province-map-meta',
  '.province-map-legend',
]) {
  assert.equal(mapStyles.includes(forbidden), false, `地图样式不得恢复旧地图标记或卡片: ${forbidden}`);
}
for (const [path, selector, expectedOverflow] of [
  ['src/styles/financial-backdrop.css', '.application-map-layer', 'hidden'],
  ['src/styles/strategic-game-shell.css', '.strategic-map-stage', 'visible'],
]) {
  const source = read(path);
  const start = source.lastIndexOf(`${selector} {`);
  const block = start >= 0 ? source.slice(start, source.indexOf('}', start) + 1) : '';
  assert.ok(block.includes(`overflow: ${expectedOverflow};`), `${selector} 必须使用 ${expectedOverflow} 作为 Contain 地图边界`);
  for (const text of ['border: 0;', 'border-radius: 0;', 'outline: 0;', 'box-shadow: none;']) {
    assert.ok(block.includes(text), `${selector} 不得产生地图外缘白边，缺少: ${text}`);
  }
}
assert.ok(strategicStyles.includes('.strategic-map-stage .province-map-echart {\n  padding: 0;'), 'Contain 地图图表宿主不得保留内部安全边距');

const mapBrowserTest = read('tests/browser/province-map.spec.ts');
for (const text of [
  "data-echarts-ready', 'true'",
  "data-province-count', '48'",
  "data-map-feature-count', '48'",
  "data-map-label-mode', 'curved-chinese-full-name'",
  "data-map-label-count', '48'",
  'data-map-curved-label-count',
  "'加利福尼亚州', '得克萨斯州', '华盛顿州', '佛罗里达州', '纽约州'",
  'provinceLabelFontSize',
  'clickProvinceLabel',
  'data-map-label-geometry-mode',
  'data-label-glyph-mode',
  'data-label-natural-aspect',
  'data-label-available-length',
  'data-label-used-width',
  "getAttribute('data-label-fit')",
  "value === 'inside'",
  'persistent US strategy map exposes 48 states, lenses, and local context',
  'mobile strategy map fills the root map layer without obsolete map cards or inspector',
  "page.locator('.province-map-page > *')",
  "page.locator('.strategic-province-inspector')",
  "page.getByLabel('地图图例')",
  "toHaveAttribute('data-map-lens', 'market')",
  'data-echarts-instance-id',
  'data-map-contain-viewport',
  'cameraBeforeSelection',
  'cameraAfterSelection',
  'cameraAfterBlankDoubleClick',
  "'data-map-camera-reset'",
  "'blank-double-click'",
  "'blank-double-tap'",
  "toHaveCSS('touch-action', 'none')",
  'mobile strategy map keeps labels and blank-space gestures usable',
  'outlineAspect',
  "getByLabel('州级地区', { exact: true })",
  "getByRole('heading', { name: '科罗拉多州'",
  "getByRole('tab', { name: '概览'",
  "getByRole('tab', { name: '市场'",
  "getByRole('tab', { name: '建筑'",
  "getByRole('tab', { name: '仓库'",
  "toHaveAttribute('data-strategic-presentation', 'building')",
  "toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')",
]) assert.ok(mapBrowserTest.includes(text), `ECharts 地图浏览器回归缺少: ${text}`);
for (const forbidden of [
  "hasText: /^CO$/",
  "toContain('CA')",
  "toContain('TX')",
  "locator('textPath')",
  'spacingAndGlyphs',
]) {
  assert.equal(mapBrowserTest.includes(forbidden), false, `浏览器地图回归不得继续依赖英文州缩写: ${forbidden}`);
}

const uiDesign = read('docs/UI_DESIGN_SYSTEM.md');
assert.equal((uiDesign.match(/### 8\.1 美国本土州级经营地图/g) ?? []).length, 1, 'UI 设计文档只能保留一份美国本土州级经营地图 8.1 规则');
for (const text of [
  "roamTrigger: 'global'",
  '触摸双触地图空白',
  '--color-map-region-locked',
  '中文州全名',
  '州内几何主轴和可读方向',
  '自然宽度、自然高度与自然长宽比',
  '每个汉字必须作为独立刚性 SVG `text` 字形',
  '禁止 `textLength`',
  '完整落在州面内部',
  '随地图缩放和平移同步重新投影',
]) assert.ok(uiDesign.includes(text), `移动地图设计规则缺少: ${text}`);
for (const forbidden of ['等比 Cover 相机', '常驻州缩写', '全部州缩写关闭', '最高 8 倍受限缩放']) {
  assert.equal(uiDesign.includes(forbidden), false, `UI 设计文档不得保留旧地图标签或缩放冲突规则: ${forbidden}`);
}

const navigation = read('src/config/navigation.ts');
assert.equal(navigation.includes("{ id: 'map', label: '地图' }"), false, '桌面侧栏与移动底栏不得显示地图按钮');
assert.ok(navigation.includes("export type TabId = NavigationTabId | 'map' | 'province';"), '纯地图与隐藏州级上下文视图必须保留 TabId');

const pageDesign = read('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md');
for (const text of [
  '州级上下文页（无导航按钮）',
  '概览｜市场｜建筑｜仓库',
  '离开行为只清除地图视觉选中态，不清除经营州',
  '通知面板全工作区点击捕获层必须透明',
  '中文州全名作为唯一州面名称',
  'SVG 非交互逐字标签层',
  '自然宽度、自然高度和自然长宽比',
  '禁止 `textLength`',
  '单个汉字自身不得弯曲、压扁或拉长',
  '名称随地图缩放和平移同步变化',
]) assert.ok(pageDesign.includes(text), `州级页面设计权威缺少: ${text}`);
assert.equal(pageDesign.includes('并把州缩写作为地图标签'), false, '页面设计文档不得恢复英文州缩写地图标签');

const tests = read('server/test/provinces.test.js');
for (const text of [
  'cannot match across states',
  'world 30 geography replacement keeps legacy scoped assets on their existing region IDs',
  'construction and production consume and output only the selected province inventory',
  'facility order transfer preserves the province',
  'without serialized aliases',
]) assert.ok(tests.includes(text), `州级经济专项测试缺少: ${text}`);

assert.ok(read('server/test/banking.test.js').includes('bank collateral locks only the selected province facility group'), '缺少银行跨省抵押防回退测试');
assert.ok(read('server/test/commercial-contracts.test.js').includes('facility lease usage and locks stay in the contract province'), '缺少工厂租赁跨省锁定防回退测试');

console.log('地区经济验证通过：美国连续 48 州、版本 36/32、既有地区 ID 原位保留、起始州与州解锁、三种跨州运输、本地库存与市场、工厂建造生产转让、抵押租赁地区锁定、隐藏州级上下文页、视觉选中清理、透明页面与通知覆盖、ECharts 地图点击、州内中文全名曲线标签、随镜头缩放平移、空白全局平移和空白双击／双触镜头重置均已锁定。');
