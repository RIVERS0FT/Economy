import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), 'utf8').replace(/\r\n?/g, '\n');
const failures = [];
const requireFile = (path) => { if (!existsSync(resolve(root, path))) failures.push(`缺少文件: ${path}`); };
const requireText = (path, text) => { if (!read(path).includes(text)) failures.push(`${path} 缺少: ${text}`); };
const forbidText = (path, text) => { if (read(path).includes(text)) failures.push(`${path} 不应包含: ${text}`); };

[
  'README.md',
  'server/src/warehouse.js',
  'server/src/facility-groups.js',
  'server/test/warehouse.test.js',
  'src/components/warehouse/WarehouseUpgradeCard.tsx',
  'src/components/facilities/FacilityProductionFormula.tsx',
  'src/pages/ProductionPage.tsx',
  'src/styles/warehouse-expansion.css',
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
  'WAREHOUSE_COST_SLOPE_NUMERATOR = 3',
  'WAREHOUSE_COST_SLOPE_DENOMINATOR = 5',
  'warehouseCapacityIncreaseForLevel',
  'warehouseUpgradeCostForCapacity',
  'warehouseUpgradeCostForCapacity(player.inventoryCapacity)',
  'warehouseNextCapacityIncrease',
  'export function createWarehouseUsage',
  'warehouseReservedQuantity: reserved',
  'warehouseAvailableCapacity: Math.max(0, player.inventoryCapacity - used)',
  'player.credits -= cost',
  'player.warehouseLevel = nextLevel',
]) requireText('server/src/warehouse.js', text);
for (const forbidden of [
  'WAREHOUSE_MAX_LEVEL',
  '仓库已达到最高等级',
  'warehouseUpgradeCostForLevel',
  'WAREHOUSE_BASE_UPGRADE_COST * normalized * normalized',
]) forbidText('server/src/warehouse.js', forbidden);

for (const text of [
  'warehouseUpgradeCostForCapacity',
  '[150, 300, 480, 690, 930, 1_200]',
  'warehouse summary price matches the amount deducted for the same actual capacity',
]) requireText('server/test/warehouse.test.js', text);
for (const forbidden of ['warehouseUpgradeCostForLevel']) forbidText('server/test/warehouse.test.js', forbidden);

for (const text of [
  'title="生产"',
  'WarehouseUpgradeCard',
  '建设新工厂',
  'game.facilityGroups.map',
  'facility-status-header',
  'FacilityProductionFormula',
  '生产配方',
  '固定配方：',
  '前往市场交易该工厂',
]) requireText('src/pages/ProductionPage.tsx', text);
for (const forbidden of [
  'label="生产周期"',
  'label="单座周期产量"',
  'label="单座周期成本"',
  '当前计划：持续生产',
  '保存下一周期计划',
]) forbidText('src/pages/ProductionPage.tsx', forbidden);

for (const text of [
  "import { ProductIcon } from '../icons/ProductIcons'",
  'warehouse-layout',
  'warehouse-management',
  'warehouse-content',
  'warehouse-product-grid',
  'warehouse-product-card',
  'const stockedProducts = useMemo',
  'inventory.available > 0 || inventory.frozen > 0',
  'warehouse-product-card-name',
  'warehouse-product-card-icon',
  'warehouse-product-card-available',
  'warehouse-product-card-frozen',
  '<ProductIcon productId={product.id} />',
  '可用 {formatNumber(inventory.available)}',
  '冻结 {formatNumber(inventory.frozen)}',
  "selectMarketAsset('commodity', product.id)",
  '等级 {formatNumber(game.warehouseLevel)}',
]) requireText('src/components/warehouse/WarehouseUpgradeCard.tsx', text);
for (const forbidden of ['warehouseMaxLevel', '已达最高等级', '种商品有库存', '<strong>库存 {total}</strong>', 'ProductIconLabel']) {
  forbidText('src/components/warehouse/WarehouseUpgradeCard.tsx', forbidden);
}

const css = 'src/styles/warehouse-expansion.css';
for (const text of [
  'grid-template-columns: minmax(220px, 1fr) minmax(0, 3fr);',
  'container-type: inline-size;',
  '.warehouse-product-grid',
  'grid-template-columns: repeat(2, minmax(0, 1fr));',
  '@container (max-width: 359px)',
  'padding: 27px 6px 6px;',
  'width: 36px;',
  'height: 36px;',
  '@container (min-width: 300px)',
  'grid-template-columns: repeat(3, minmax(0, 1fr));',
  '@container (min-width: 560px)',
  'grid-template-columns: repeat(4, minmax(0, 1fr));',
  '@container (min-width: 760px)',
  'grid-template-columns: repeat(5, minmax(0, 1fr));',
  '@container (min-width: 960px)',
  'grid-template-columns: repeat(6, minmax(0, 1fr));',
  'min-height: 112px;',
  'padding: 30px var(--space-2) var(--space-2);',
  '.warehouse-product-card-name',
  'position: absolute;',
  '.warehouse-product-card-icon .product-icon',
  'width: 44px;',
  'height: 44px;',
  '@media (max-width: 960px)',
]) requireText(css, text);
for (const text of [
  'repeat(4, minmax(130px, 1fr))',
  '@media (max-width: 1220px)',
  'grid-template-columns: repeat(3, minmax(130px, 1fr));',
  '@container (min-width: 360px)',
]) forbidText(css, text);

for (const text of [
  'facility-formula-input-group',
  'facility-formula-center',
  'facility-formula-output-group',
  'facility-formula-progress',
  '单座配方每',
  'formatCurrency(type.operatingCost)',
]) requireText('src/components/facilities/FacilityProductionFormula.tsx', text);
for (const text of ['activeCount', 'multiplier={activeCount}', 'type.operatingCost * activeCount']) {
  forbidText('src/components/facilities/FacilityProductionFormula.tsx', text);
}

for (const text of [
  '无限等级、容量与费用',
  '扩容费用必须由当前实际总容量线性计算',
  '仓库等级只能决定容量增量，不能直接决定扩容费用',
  '仓库没有玩家可见的最高等级',
  '容器查询',
  '2／3／4／5／6 列',
  '300px–559px',
  '300px–359px',
  '112px',
  '8px',
  '商品名称固定在卡片左上角',
  '居中大图标主体结构',
]) requireText('docs/WAREHOUSE_EXPANSION_DESIGN.md', text);
for (const forbidden of ['升级费用：150 × L²', 'warehouseUpgradeCostForLevel']) {
  forbidText('docs/WAREHOUSE_EXPANSION_DESIGN.md', forbidden);
}
requireText('README.md', '扩容费用为 `150 + ceil((当前实际总容量 - 500) × 0.6)`');
for (const text of ['建设卡不得显示生产周期、单座周期产量或单座周期成本', '生产公式固定显示单座正式配方']) {
  requireText('docs/INDUSTRY_AND_PRODUCTION_DESIGN.md', text);
}
for (const text of [
  '仓库商品网格按内容区宽度',
  '小于 300px 为 2 列，300px 起 3 列',
  '内容区小于 360px 时允许使用 6px 水平内边距',
  '商品名称固定在左上角',
  '居中大尺寸统一商品 SVG',
  '建设卡不显示生产周期、单座产量和单座成本',
]) requireText('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', text);
for (const text of ['仓库商品网格使用容器查询', '左上名称／居中大图标／可用主值／冻结辅助值', '断点为 300、560、760、960px', '商品卡最小高度 `112px`', '生产配方是配置展示，不是运行统计']) {
  requireText('docs/UI_DESIGN_SYSTEM.md', text);
}

if (failures.length) {
  console.error(`仓库扩容与生产卡片架构验证失败:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log('仓库无限扩容、容量线性定价、商品卡图标主导布局、移动端三列与 2 至 6 列容器密度、建设卡精简和固定单座配方验证通过。');
