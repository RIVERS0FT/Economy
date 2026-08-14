import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
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
  'game.provinces.map((province)',
  'onClick={() => setSelectedProvinceId(province.id)}',
  '进入本地市场',
  '管理本地生产',
]) assert.ok(mapPage.includes(text), `地图交互缺少: ${text}`);

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

console.log('省级经济验证通过：34 个地区、版本 34/30、本地库存与市场、工厂建造生产转让、抵押租赁地区锁定、客户端地图切换均已锁定。');
