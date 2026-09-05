import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const server = read('server/src/commercial-buildings.js');
const domain = read('server/src/domain.js');
const runtime = read('server/src/runtime-action-executor.js');
const routes = read('server/src/game-routes.js');
const registry = read('server/src/player-action-registry.js');
const deadlinePlanner = read('server/src/world-deadline-planner.js');
const statePartitions = read('server/src/state-partitions.js');
const assetRuntime = read('server/src/facility-groups.js');
const assetPanel = read('src/components/assets/AssetOverviewPanel.tsx');
const assetChart = read('src/components/charts/AssetAllocationChart.tsx');
const overview = read('src/pages/OverviewPage.tsx');
const province = read('src/pages/ProvincePage.tsx');
const provinceCss = read('src/styles/province-page.css');
const commerce = read('src/pages/CommercePage.tsx') + read('src/components/buildings/BuildingDetailPage.tsx');
const navigation = read('src/navigation/playerPageStack.ts');
const design = read('docs/COMMERCIAL_BUILDINGS_DESIGN.md');
const pageDesign = read('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md');
const productionAlignmentDesign = read('docs/PRODUCTION_PILL_ALIGNMENT_DESIGN.md');
const docsIndex = read('docs/README.md');

for (const token of [
  'COMMERCIAL_BUILDING_TYPE_CATALOG',
  'commercialBuildingGroups',
  'pendingRevenue',
  'pendingProfit',
  'processCommercialWorld',
  'applyCommercialBuildingAction',
  'inventoryForProvince',
  'officialPriceFor',
]) assert.ok(server.includes(token), `商业服务器实现缺少: ${token}`);

for (const token of [
  'migrateCommercialWorld',
  'processCommercialWorld(world, now)',
  'commercialBuildingTypes: clone(COMMERCIAL_BUILDING_TYPE_CATALOG)',
  'commercialBuildingGroups: clone(player?.commercialBuildingGroups || [])',
]) assert.ok(domain.includes(token), `商业状态投影缺少: ${token}`);

assert.ok(runtime.includes("action === 'commercialBuilding'"));
assert.ok(runtime.includes('applyCommercialBuildingAction'));
assert.ok(routes.includes("path === '/api/game/commercial-buildings'"));
assert.ok(registry.includes("commercialBuilding: defineAction({ mutationScope: 'local-player'"));
assert.ok(deadlinePlanner.includes('nextCommercialBuildingDeadline'));
assert.ok(deadlinePlanner.includes('commercialDeadline'));
assert.ok(statePartitions.includes("'commercialBuildingTypes'"), '商业目录必须归入 catalog 分区');
assert.ok(
  statePartitions.includes("['products', 'facilityTypes', 'commercialBuildingTypes', 'researchLevels', 'provinces']"),
  '客户端状态版本 40 必须把商业目录设为 catalog 结构硬门槛',
);
for (const token of ['commercialValue', '+ commercialValue', 'COMMERCIAL_BUILDING_TYPE_CATALOG']) {
  assert.ok(assetRuntime.includes(token), `净资产口径缺少商业建筑价值: ${token}`);
}
for (const token of [
  'commercialValue = game.assetSummary.commercialValue ?? 0',
  '商业建筑按目录系统价值估值',
  '商业建筑<small>共',
  'derived.facilityValue + commercialValue',
]) assert.ok(assetPanel.includes(token), `银行资产明细缺少商业建筑口径: ${token}`);
assert.ok(assetChart.includes("{ name: '建筑'"), '资产配置图必须把工业与商业归入建筑占比');
assert.ok(overview.includes('label="商业建筑估值"'), '概览资产摘要必须显示商业建筑估值');

const marketIndex = province.indexOf("{ id: 'market', label: '市场' }");
const commercialIndex = province.indexOf("{ id: 'commerce', label: '商业' }");
const buildingsIndex = province.indexOf("{ id: 'buildings', label: '工业' }");
assert.ok(marketIndex >= 0 && commercialIndex > marketIndex && buildingsIndex > commercialIndex, '地区导航必须保持市场 / 商业 / 工业顺序');
assert.equal(province.includes("{ id: 'buildings', label: '建筑' }"), false, '地区不得恢复混合建筑标签');
assert.ok(provinceCss.includes('grid-template-columns: repeat(5, minmax(0, 1fr));'), '地区五分区必须等宽');
assert.ok(navigation.includes("'overview' | 'market' | 'commerce' | 'buildings' | 'warehouse'"));
assert.ok(navigation.includes("type: 'regional-commercial'"));

for (const token of [
  'production-build-card',
  'facility-cluster-selector-region',
  'facility-cluster-detail-card',
  '建设新商业建筑',
  '稳定利润',
]) assert.ok(commerce.includes(token), `商业页面缺少: ${token}`);

for (const token of [
  '商业建筑不是工厂的另一种配方',
  '不得跨州寻找库存',
  '固定商业利润是服务器目录声明的**绝对金额**',
  '不是市场成交',
]) assert.ok(design.includes(token), `商业权威设计缺少: ${token}`);
for (const token of [
  '概览｜市场｜商业｜工业｜仓库',
  '统一建筑目录',
  '商业建筑卡片与详情',
]) assert.ok(pageDesign.includes(token), `地区页面权威设计缺少商业分区规则: ${token}`);
assert.ok(
  productionAlignmentDesign.includes('地区子导航的名称与顺序以 `PAGE_CONTENT_AND_NAVIGATION_DESIGN.md` 为唯一权威'),
  '生产布局专项不得复制地区导航顺序规则',
);
assert.ok(docsIndex.includes('`COMMERCIAL_BUILDINGS_DESIGN.md`'), '设计索引必须登记商业建筑权威文档');

console.log('commercial buildings verification passed');

for (const path of ['src/pages/GlobalBuildingsPage.tsx', 'src/pages/RegionalBuildingsPage.tsx']) {
  assert.equal(read(path).includes('<BuildingTypeFilter'), path.includes('GlobalBuildingsPage'));
  if (path.includes('RegionalBuildingsPage')) assert.equal(read(path).includes('useBuildingTypeFilter'), false);
  assert.ok(read(path).includes('commercialBuildingGroups'));
}
const buildingFilter = read('src/components/buildings/BuildingTypeFilter.tsx');
for (const token of ['global-market-filter-disclosure', 'global-market-filter-button', '全部', '商业建筑', '工业建筑', 'aria-pressed']) assert.ok(buildingFilter.includes(token));
