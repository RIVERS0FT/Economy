import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import chinaGeoJson from 'china-geojson/src/geojson/china.json' with { type: 'json' };
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
  'src/components/provinces/ChinaProvinceMap.tsx',
  'src/components/provinces/ProvinceSelect.tsx',
  'src/styles/province-map.css',
  'src/utils/provinceScope.ts',
  'docs/PRODUCT_AND_GAMEPLAY_DESIGN.md',
  'docs/INDUSTRY_AND_PRODUCTION_DESIGN.md',
  'docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md',
  'docs/WAREHOUSE_EXPANSION_DESIGN.md',
  'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
  'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md',
];
for (const path of requiredFiles) assert.equal(existsSync(path), true, `缺少省级经济文件: ${path}`);

assert.equal(PROVINCE_CATALOG.length, 34, '省级地区目录必须包含 34 项');
assert.equal(new Set(PROVINCE_CATALOG.map((province) => province.id)).size, 34, '省级地区 ID 必须唯一');
assert.equal(DEFAULT_PROVINCE_ID, '110000', '旧数据迁移默认省份必须稳定为北京');
assert.equal(CURRENT_CLIENT_STATE_VERSION, 34, '省级状态协议必须使用客户端版本 34');
assert.equal(AUTHORITATIVE_WORLD_VERSION, 30, '省级持久化必须使用世界版本 30');

const packageJson = JSON.parse(read('package.json'));
const mapPackage = JSON.parse(read('node_modules/china-geojson/package.json'));
assert.equal(packageJson.dependencies?.['china-geojson'], '1.0.0', '省界数据依赖必须精确锁定 china-geojson 1.0.0');
assert.match(String(mapPackage.license || mapPackage.licenses || ''), /MIT/i, '省界数据包必须保留 MIT 许可元数据');
assert.equal(chinaGeoJson.type, 'FeatureCollection', '省界数据必须是 GeoJSON FeatureCollection');
assert.equal(
  chinaGeoJson.features.some((feature) => feature?.properties?.name === '南海诸岛'),
  true,
  '上游数据结构变化时必须重新审查非经营附图过滤',
);
const mapRegionNames = chinaGeoJson.features
  .map((feature) => String(feature?.properties?.name || ''))
  .filter((name) => name && name !== '南海诸岛');
assert.equal(mapRegionNames.length, 34, 'ECharts 地图必须包含 34 个可经营省级地区');
assert.deepEqual(
  new Set(mapRegionNames),
  new Set(PROVINCE_CATALOG.map((province) => province.shortName)),
  'ECharts GeoJSON 地区名称必须与共享省级目录一一对应',
);

const matching = read('server/src/order-matching.js');
for (const text of [
  'provinceId: orderProvinceId(incoming)',
  'iterateOrderBookSide(world, {',
]) assert.ok(matching.includes(text), `共享撮合缺少省级隔离: ${text}`);

const facilities = read('server/src/facility-groups.js');
for (const text of [
  'const provinceId = normalizeProvinceId(payload.provinceId);',
  'inventoryFor(player, item.productId, provinceId).available -= item.quantity',
  'inventoryFor(player, recipe.output.productId, group.provinceId).available += requirements.output',
  'addPurchasedGroup(world, buyer, typeId, quantity, createdAt, incoming.provinceId)',
  'provinceFacilityGroups',
  'provinceFacilityMarkets',
]) assert.ok(facilities.includes(text), `工厂省级边界缺少: ${text}`);

const banking = read('server/src/banking.js');
for (const text of [
  'const provinceId = normalizeProvinceId(item?.provinceId);',
  'transferableFacilityQuantity(world, player, item.facilityTypeId, item.provinceId)',
  'const group = groupFor(player, item.facilityTypeId, item.provinceId);',
]) assert.ok(banking.includes(text), `银行抵押省级边界缺少: ${text}`);

const commercialContracts = read('server/src/commercial-contracts.js');
for (const text of [
  'const provinceId = normalizeProvinceId(payload.provinceId);',
  'groupFor(lessee, contract.facilityTypeId, contract.provinceId, true, now)',
  'groupFor(lender, contract.facilityTypeId, contract.provinceId, true, now)',
]) assert.ok(commercialContracts.includes(text), `借贷或租赁省级边界缺少: ${text}`);

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
  '<ChinaProvinceMap',
  'summaries={game.provinceAssetSummaries}',
  'onSelectProvince={setSelectedProvinceId}',
  'china-geojson',
  'province-map-command-panel',
  'province-map-meta',
  '进入本地市场',
  '管理本地生产',
]) assert.ok(mapPage.includes(text), `地图交互缺少: ${text}`);

const mapComponent = read('src/components/provinces/ChinaProvinceMap.tsx');
for (const text of [
  "china-geojson/src/geojson/china.json",
  "const OMITTED_MAP_FEATURE_NAMES = new Set(['南海诸岛'])",
  'registerEChartsMap(CHINA_PROVINCE_MAP_NAME, chinaProvinceGeoJson)',
  "type: 'map'",
  "selectedMode: 'single'",
  'maxAspectRatio: 0.8',
  "layoutCenter: ['50%', '38%']",
  'onClick={handleMapClick}',
  'data-province-count={provinces.length}',
  'data-map-feature-count={chinaProvinceGeoJson.features.length}',
]) assert.ok(mapComponent.includes(text), `ECharts 省级地图缺少: ${text}`);

const echartsCore = read('src/components/charts/echartsCore.ts');
for (const text of ['MapChart', 'GeoComponent', 'registerEChartsMap']) {
  assert.ok(echartsCore.includes(text), `ECharts 地图核心缺少: ${text}`);
}

const mapStyles = read('src/styles/province-map.css');
for (const forbidden of ['.province-map-marker', '.province-map-silhouette']) {
  assert.equal(mapStyles.includes(forbidden), false, `不得恢复手绘固定坐标地图: ${forbidden}`);
}

const mapBrowserTest = read('tests/browser/province-map.spec.ts');
for (const text of [
  "data-echarts-ready', 'true'",
  "data-province-count', '34'",
  "data-map-feature-count', '34'",
  "getByText('南海诸岛', { exact: true })",
  "page.locator('.province-map-page').evaluate",
  "hasText: /^广东$/",
  "getByRole('option', { name: '澳门特别行政区' })",
  'mobile grand-map layout keeps the country between safe overlay panels',
  'commandBottom',
  'metaTop',
]) assert.ok(mapBrowserTest.includes(text), `ECharts 地图浏览器回归缺少: ${text}`);

const navigation = read('src/config/navigation.ts');
assert.ok(navigation.includes("{ id: 'map', label: '地图' }"), '正式导航必须包含地图页');

const tests = read('server/test/provinces.test.js');
for (const text of [
  'cannot match across provinces',
  'construction and production consume and output only the selected province inventory',
  'facility order transfer preserves the province',
  'without serialized aliases',
]) assert.ok(tests.includes(text), `省级经济专项测试缺少: ${text}`);

assert.ok(read('server/test/banking.test.js').includes('bank collateral locks only the selected province facility group'), '缺少银行跨省抵押防回退测试');
assert.ok(read('server/test/commercial-contracts.test.js').includes('facility lease usage and locks stay in the contract province'), '缺少工厂租赁跨省锁定防回退测试');

console.log('省级经济验证通过：34 个地区、版本 34/30、本地库存与市场、工厂建造生产转让、抵押租赁地区锁定、MIT GeoJSON 与 ECharts 地图点击切换均已锁定。');
