import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), 'utf8').replace(/\r\n?/g, '\n');
const failures = [];
function requireFile(path) { if (!existsSync(resolve(root, path))) failures.push(`缺少文件: ${path}`); }
function requireText(path, text) { if (!read(path).includes(text)) failures.push(`${path} 缺少: ${text}`); }
function forbidText(path, text) { if (read(path).includes(text)) failures.push(`${path} 不应包含: ${text}`); }

[
  'server/src/warehouse.js',
  'server/src/facility-groups.js',
  'server/test/warehouse.test.js',
  'server/test/facility-groups.test.js',
  'src/components/warehouse/WarehouseUpgradeCard.tsx',
  'src/components/facilities/FacilityProgress.tsx',
  'src/components/facilities/FacilityProductionFormula.tsx',
  'src/pages/ProductionPage.tsx',
  'src/pages/AssetsPage.tsx',
  'src/utils/localActivityStore.ts',
  'src/styles/warehouse-expansion.css',
  'src/styles/industry-system.css',
  'src/styles/facility-production-formula.css',
  'src/styles/facility-group-card-grid.css',
  'docs/WAREHOUSE_EXPANSION_DESIGN.md',
  'docs/INDUSTRY_AND_PRODUCTION_DESIGN.md',
  'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
  'docs/UI_DESIGN_SYSTEM.md',
].forEach(requireFile);

for (const text of [
  'WAREHOUSE_BASE_CAPACITY = 500',
  'WAREHOUSE_CAPACITY_STEP = 250',
  'WAREHOUSE_CAPACITY_STEP_GROWTH = 50',
  'WAREHOUSE_BASE_UPGRADE_COST = 150',
  'warehouseCapacityIncreaseForLevel',
  'warehouseNextCapacityIncrease',
  'export function createWarehouseUsage',
  'warehouseReservedQuantity: reserved',
  'warehouseAvailableCapacity: Math.max(0, player.inventoryCapacity - used)',
  "order?.assetKind === 'facility'",
  'player.credits -= cost',
  'player.warehouseLevel = nextLevel',
]) requireText('server/src/warehouse.js', text);

for (const forbidden of [
  'WAREHOUSE_MAX_LEVEL',
  '仓库已达到最高等级',
]) forbidText('server/src/warehouse.js', forbidden);

for (const text of ['createWarehouseSummary', 'upgradeWarehouse', "action === 'upgradeWarehouse'", 'version: 12']) requireText('server/src/storage.js', text);
for (const text of ['version: 12;', 'warehouseLevel: number;', 'warehouseNextCapacityIncrease: number;', 'warehouseReservedQuantity: number;', 'warehouseAvailableCapacity: number;']) requireText('src/types.ts', text);
for (const forbidden of ['warehouseMaxLevel: number;']) forbidText('src/types.ts', forbidden);

for (const text of [
  'title="生产"',
  'WarehouseUpgradeCard',
  '建设新工厂',
  'game.facilityGroups.map',
  'facility-status-header',
  'facilityStatusLabel',
  '异常：仓库已满',
  '异常：资金不足',
  '异常：原料不足',
  '运行中',
  '下一周期加入',
  '冻结中',
  'FacilityProductionFormula',
  'products={game.products}',
  'inventories={game.inventories}',
  'facility-recipe-section',
  '生产配方',
  '下一周期切换为：',
  '前往市场交易该工厂',
  'formatNumber(group.count)',
]) requireText('src/pages/ProductionPage.tsx', text);

for (const forbidden of [
  'title="工厂"',
  '正常生产中',
  '下一周期按 ',
  'facility-group-counts',
  'facility-group-specs',
  '当前计划：持续生产',
  '当前计划：持续运行',
  '>持续</StatusTag>',
  '>定量</StatusTag>',
  '>保存计划</Button>',
  '保存下一周期计划',
  '更新下一周期计划',
  '下一周期：',
]) forbidText('src/pages/ProductionPage.tsx', forbidden);

for (const text of ['本周期剩余', '等待条件恢复', 'facility-progress-running', 'is-idle']) requireText('src/components/facilities/FacilityProgress.tsx', text);
for (const text of [
  'facility-formula-input-group',
  'facility-formula-center',
  'facility-formula-output-group',
  'facility-formula-progress',
  'WarehouseIcon',
  'CycleIcon',
  'CreditsIcon',
]) requireText('src/components/facilities/FacilityProductionFormula.tsx', text);
forbidText('src/components/facilities/FacilityProductionFormula.tsx', 'facility-formula-summary');
forbidText('src/components/facilities/FacilityProductionFormula.tsx', 'facility-formula-summary');
for (const text of [
  'warehouse state defaults to level 1 and client version 12',
  'warehouse capacity increase grows with every level',
  'warehouse can continue upgrading after former level 12 limit',
  'warehouse upgrade is idempotent',
]) requireText('server/test/warehouse.test.js', text);
for (const text of [
  'legacy completed target plans migrate to a manual stop',
  'legacy running target plans become continuous production',
]) requireText('server/test/facility-groups.test.js', text);

for (const text of [
  "import { ProductIconLabel } from '../icons/ProductIcons'",
  'warehouse-layout',
  'warehouse-management',
  'warehouse-content',
  'warehouse-product-grid',
  'warehouse-product-card',
  'const stockedProducts = useMemo',
  'inventory.available > 0 || inventory.frozen > 0',
  'className="warehouse-product-card-title"',
  '<strong>可用 {formatNumber(inventory.available)}</strong>',
  '<small>冻结 {formatNumber(inventory.frozen)}</small>',
  "selectMarketAsset('commodity', product.id)",
  '等级 {formatNumber(game.warehouseLevel)}',
  '增加 {formatNumber(game.warehouseNextCapacityIncrease)} 容量',
]) requireText('src/components/warehouse/WarehouseUpgradeCard.tsx', text);

for (const forbidden of [
  'warehouseMaxLevel',
  'atMaxLevel',
  '已达最高等级',
  '最高容量',
  '种商品有库存',
  'const total = inventory.available + inventory.frozen',
  '<strong>库存 {total}</strong>',
  '<small>可用 {inventory.available} · 冻结 {inventory.frozen}</small>',
]) forbidText('src/components/warehouse/WarehouseUpgradeCard.tsx', forbidden);

for (const text of [
  'grid-template-columns: minmax(220px, 1fr) minmax(0, 3fr);',
  '.warehouse-product-grid',
  'repeat(4, minmax(130px, 1fr))',
  '@media (max-width: 960px)',
  '@media (max-width: 420px)',
  '.warehouse-summary-list,\n  .warehouse-upgrade-summary {',
  'grid-template-columns: repeat(2, minmax(0, 1fr));',
  '.warehouse-product-card > strong',
  'font-size: var(--font-size-xl);',
  '.warehouse-product-card > small',
  'font-size: var(--font-size-xs);',
]) requireText('src/styles/warehouse-expansion.css', text);
for (const text of [
  '.warehouse-summary-list,\n  .warehouse-upgrade-summary,\n  .warehouse-product-grid',
]) forbidText('src/styles/warehouse-expansion.css', text);

for (const text of [
  'Production management layout v3',
  'grid-template-columns: minmax(280px, 320px) minmax(0, 1fr);',
  'position: sticky',
  '@media (min-width: 1381px) {\n  .facility-group-list {\n    grid-template-columns: repeat(4, minmax(0, 1fr));',
  '.facility-count-summary',
  '.production-plan-heading',
  '.production-plan-fields',
  '@media (max-width: 960px)',
]) requireText('src/styles/industry-system.css', text);
for (const forbidden of ['position: fixed']) forbidText('src/styles/industry-system.css', forbidden);
for (const text of ['.facility-card-title-row', '.facility-card-status-row', 'grid-auto-rows: auto;', 'align-self: stretch;']) requireText('src/styles/facility-group-card-grid.css', text);
for (const forbidden of ['--facility-card-height', 'grid-auto-rows: 1fr;']) forbidText('src/styles/facility-group-card-grid.css', forbidden);

for (const text of [
  '.facility-production-formula',
  '.facility-formula-top',
  '.facility-formula-center',
  '.facility-formula-progress',
  'grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);',
  '@media (max-width: 560px)',
]) requireText('src/styles/facility-production-formula.css', text);
forbidText('src/styles/facility-production-formula.css', '.facility-formula-summary');
forbidText('src/styles/facility-production-formula.css', '.facility-formula-summary');

for (const text of [
  '无限等级、容量与费用',
  '当前等级 L 升到 L + 1 的容量增量',
  '仓库没有玩家可见的最高等级',
  '不显示“X 种商品有库存”等商品数量说明',
  '醒目的“可用 N”',
  '弱化的“冻结 N”',
  '`320px` 及以上不得把仓库商品网格改为单列',
]) requireText('docs/WAREHOUSE_EXPANSION_DESIGN.md', text);

for (const text of [
  '持续生产与通用配方切换',
  '同一网格行中的卡片等高',
  '大于 1380px 时右侧固定四列',
  'position: sticky',
  '下一周期加入',
  '运行中切换配方只写入 `pendingRecipeId`',
  '集群生产公式',
  '进度条',
]) requireText('docs/INDUSTRY_AND_PRODUCTION_DESIGN.md', text);

for (const text of [
  '页面主标题固定为“生产”',
  '左侧：建设新工厂',
  '同一网格行中的卡片等高',
  '大于 1380px 时工厂列表固定四列',
  '无限扩容信息',
  '不显示独立库存总量行',
  '平板、手机和极窄屏保持双列',
  '集群生产公式',
  '多输入、多输出和逐输入库存兼容展示',
]) requireText('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', text);

for (const text of [
  '同一网格行中的卡片等高',
  '工厂卡大于 1380px 时固定四列',
  '建设新工厂卡桌面独占',
  '仓库只显示可用或冻结数量大于零的商品',
  '图标与名称／可用主值／冻结辅助值',
  '移动端首次创建客户端偏好状态时，“紧凑数字”默认开启',
  '生产配方',
  '输入在左、周期成本在中、输出在右',
]) requireText('docs/UI_DESIGN_SYSTEM.md', text);

if (failures.length) {
  console.error(`仓库扩容与生产卡片架构验证失败:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log('仓库无限扩容、三层商品卡、移动双列、工厂持续生产、农场改种和生产标题验证通过。');
