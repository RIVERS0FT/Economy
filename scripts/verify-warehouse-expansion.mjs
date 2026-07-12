import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), 'utf8');
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
  'src/pages/ProductionPage.tsx',
  'src/pages/AssetsPage.tsx',
  'src/utils/localActivityStore.ts',
  'src/styles/warehouse-expansion.css',
  'src/styles/industry-system.css',
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

for (const text of ['createWarehouseSummary', 'upgradeWarehouse', "action === 'upgradeWarehouse'", 'version: 11']) requireText('server/src/storage.js', text);
for (const text of ['version: 11;', 'warehouseLevel: number;', 'warehouseNextCapacityIncrease: number;', 'warehouseReservedQuantity: number;', 'warehouseAvailableCapacity: number;']) requireText('src/types.ts', text);
for (const forbidden of ['warehouseMaxLevel: number;']) forbidText('src/types.ts', forbidden);

for (const text of [
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
  'production-plan-heading',
  'production-plan-fields',
  'placeholder="目标产量"',
  '下一周期生效',
  '在统一订单簿中买卖该工厂',
]) requireText('src/pages/ProductionPage.tsx', text);

for (const forbidden of [
  '正常生产中',
  '下一周期按 ',
  'facility-group-counts',
  '当前计划：持续生产',
  '当前计划：持续运行',
  '>持续</StatusTag>',
  '>定量</StatusTag>',
  '>保存计划</Button>',
  '保存下一周期计划',
  '更新下一周期计划',
  '下一周期：',
]) forbidText('src/pages/ProductionPage.tsx', forbidden);

for (const text of ['本周期剩余', '等待条件恢复', 'facility-progress-compact']) requireText('src/components/facilities/FacilityProgress.tsx', text);
for (const text of [
  'warehouse state defaults to level 1 and client version 11',
  'warehouse capacity increase grows with every level',
  'warehouse can continue upgrading after former level 12 limit',
  'warehouse upgrade is idempotent',
]) requireText('server/test/warehouse.test.js', text);
for (const text of [
  'target production completion disables the run switch',
  'target completion preserves pending plan but still stops',
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
  'const total = inventory.available + inventory.frozen',
  'className="warehouse-product-card-title"',
  '<strong>库存 {total}</strong>',
  '<small>可用 {inventory.available} · 冻结 {inventory.frozen}</small>',
  "selectMarketAsset('commodity', product.id)",
  '等级 {game.warehouseLevel}',
  '增加 {game.warehouseNextCapacityIncrease} 容量',
]) requireText('src/components/warehouse/WarehouseUpgradeCard.tsx', text);

for (const forbidden of [
  'warehouseMaxLevel',
  'atMaxLevel',
  '已达最高等级',
  '最高容量',
]) forbidText('src/components/warehouse/WarehouseUpgradeCard.tsx', forbidden);

for (const text of [
  'grid-template-columns: minmax(220px, 1fr) minmax(0, 3fr);',
  '.warehouse-product-grid',
  'repeat(4, minmax(130px, 1fr))',
  '@media (max-width: 960px)',
  '@media (max-width: 420px)',
]) requireText('src/styles/warehouse-expansion.css', text);

for (const text of [
  'Production management layout v3',
  'grid-template-columns: minmax(280px, 320px) minmax(0, 1fr);',
  'position: sticky',
  'height: 384px',
  '.facility-count-summary',
  '.production-plan-heading',
  '.production-plan-fields',
  '@media (max-width: 960px)',
]) requireText('src/styles/industry-system.css', text);
for (const forbidden of ['position: fixed']) forbidText('src/styles/industry-system.css', forbidden);

for (const text of [
  '无限等级、容量与费用',
  '当前等级 L 升到 L + 1 的容量增量',
  '仓库没有玩家可见的最高等级',
]) requireText('docs/WAREHOUSE_EXPANSION_DESIGN.md', text);

for (const text of [
  '定量生产完成后关闭开关',
  '固定高度 384px',
  'position: sticky',
  '下一周期加入',
  '生产计划使用自动保存',
]) requireText('docs/INDUSTRY_AND_PRODUCTION_DESIGN.md', text);

for (const text of [
  '左侧：建设新工厂',
  '桌面卡片固定高度 384px',
  '无限扩容信息',
]) requireText('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', text);

for (const text of [
  '工厂卡桌面固定高度',
  '建设新工厂卡桌面独占',
  '仓库只显示可用或冻结数量大于零的商品',
  '计划字段自动保存',
]) requireText('docs/UI_DESIGN_SYSTEM.md', text);

if (failures.length) {
  console.error(`仓库扩容与生产卡片架构验证失败:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log('仓库无限扩容、递增容量、左侧常驻建设卡、固定高度工厂卡和自动保存计划验证通过。');
