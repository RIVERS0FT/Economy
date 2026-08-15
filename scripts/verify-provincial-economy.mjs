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
  'src/components/shell/StrategicWorkspace.tsx',
  'src/components/provinces/UsMainlandMap.tsx',
  'src/components/provinces/ProvinceSelect.tsx',
  'src/styles/province-map.css',
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

assert.equal(PROVINCE_CATALOG.length, 48, '州级地区目录必须包含美国连续 48 州');
assert.equal(new Set(PROVINCE_CATALOG.map((province) => province.id)).size, 48, '州级地区 ID 必须唯一');
assert.equal(new Set(PROVINCE_CATALOG.map((province) => province.shortName)).size, 48, '州级地区简称必须唯一');
assert.equal(new Set(PROVINCE_CATALOG.map((province) => province.mapName)).size, 48, '州级地图名称必须唯一');
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
assert.equal(CURRENT_CLIENT_STATE_VERSION, 34, '州级状态协议必须使用客户端版本 34');
assert.equal(AUTHORITATIVE_WORLD_VERSION, 30, '州级持久化必须使用世界版本 30');

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

const strategicWorkspace = read('src/components/shell/StrategicWorkspace.tsx');
for (const text of [
  '<UsMainlandMap',
  'summaries={state.summaries}',
  'onSelectProvince={setSelectedProvinceId}',
  'StrategicMapStage',
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
  '<ApplicationMapLayerPortal>',
  '<StrategicMapStage model={model} lens={mapLens} />',
  '<StrategicWorkspaceChrome',
  'data-strategic-presentation={pagePresentation}',
]) assert.ok(gameShell.includes(text), `玩家战略外壳缺少: ${text}`);

const strategicStyles = read('src/styles/strategic-game-shell.css');
for (const text of [
  '.application-map-layer',
  '.game-shell .workspace-strategic-chrome',
  '.strategic-map-lens-bar',
  '--strategic-command-rail-width: 78px',
]) assert.ok(strategicStyles.includes(text), `常驻战略地图样式缺少: ${text}`);
assert.equal(strategicStyles.includes('.strategic-province-inspector'), false, '战略地图样式不得恢复经营地区检查器');

const mapComponent = read('src/components/provinces/UsMainlandMap.tsx');
for (const text of [
  "us-atlas/states-10m.json",
  "import { feature } from 'topojson-client'",
  'const regionByMapName = new Map',
  'if (!region) return []',
  'registerEChartsMap(US_MAINLAND_MAP_NAME, usMainlandGeoJson)',
  "type: 'map'",
  "selectedMode: 'single'",
  'const US_MAINLAND_ASPECT_SCALE = 0.75',
  'const MAP_COVER_OVERSCAN = 1.01',
  'function coverLayoutSize(width: number, height: number)',
  'aspectScale: US_MAINLAND_ASPECT_SCALE',
  "zoom: 1",
  "layoutCenter: ['50%', '50%']",
  "layoutSize: '100%'",
  'maxAspectRatio: 0.8',
  'onOptionApplied={applyCoverCamera}',
  'onResize={applyCoverCamera}',
  'container.dataset.mapCoverViewport',
  'onClick={handleMapClick}',
  'data-province-count={provinces.length}',
  'data-map-feature-count={usMainlandGeoJson.features.length}',
  'data-map-lens={lens}',
]) assert.ok(mapComponent.includes(text), `ECharts 美国本土地图缺少: ${text}`);
for (const forbidden of ["left: '5%'", "right: '5%'", "top: '7%'", "bottom: '9%'", "layoutCenter: ['50%', '39%']", "layoutSize: '84%'"]) {
  assert.equal(mapComponent.includes(forbidden), false, `Cover 地图不得恢复完整轮廓安全边距: ${forbidden}`);
}

const echartsCore = read('src/components/charts/echartsCore.ts');
for (const text of ['MapChart', 'GeoComponent', 'registerEChartsMap']) {
  assert.ok(echartsCore.includes(text), `ECharts 地图核心缺少: ${text}`);
}

const mapStyles = read('src/styles/province-map.css');
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
  assert.ok(block.includes(`overflow: ${expectedOverflow};`), `${selector} 必须使用 ${expectedOverflow} 作为 Cover 地图裁切边界`);
  for (const text of ['border: 0;', 'border-radius: 0;', 'outline: 0;', 'box-shadow: none;']) {
    assert.ok(block.includes(text), `${selector} 不得产生地图外缘白边，缺少: ${text}`);
  }
}
assert.ok(strategicStyles.includes('.strategic-map-stage .province-map-echart {\n  padding: 0;'), 'Cover 地图图表宿主不得保留内部安全边距');

const mapBrowserTest = read('tests/browser/province-map.spec.ts');
for (const text of [
  "data-echarts-ready', 'true'",
  "data-province-count', '48'",
  "data-map-feature-count', '48'",
  "for (const excludedCode of ['AK', 'HI', 'DC'])",
  "page.locator('.application-map-layer')",
  "hasText: /^TX$/",
  'persistent US strategy map exposes 48 states, lenses, and local context',
  'mobile strategy map fills the root map layer without obsolete map cards or inspector',
  "page.locator('.province-map-page > *')",
  "page.locator('.strategic-province-inspector')",
  "page.getByLabel('地图图例')",
  "toHaveAttribute('data-map-lens', 'market')",
  'data-echarts-instance-id',
  'data-map-cover-viewport',
  'outlineAspect',
]) assert.ok(mapBrowserTest.includes(text), `ECharts 地图浏览器回归缺少: ${text}`);

const navigation = read('src/config/navigation.ts');
assert.equal(navigation.includes("{ id: 'map', label: '地图' }"), false, '桌面侧栏与移动底栏不得显示地图按钮');
assert.ok(navigation.includes("export type TabId = NavigationTabId | 'map';"), '纯地图视图必须保留正式 TabId');

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

console.log('地区经济验证通过：美国连续 48 州、版本 34/30、既有地区 ID 原位保留、本地库存与市场、工厂建造生产转让、抵押租赁地区锁定、ISC TopoJSON 与 ECharts 地图点击切换均已锁定。');
