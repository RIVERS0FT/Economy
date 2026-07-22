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
  'src/styles/product-artwork.css',
  'src/styles/facility-production-formula.css',
  'src/styles/facility-group-card-grid.css',
  'docs/README.md',
  'docs/WAREHOUSE_EXPANSION_DESIGN.md',
  'docs/INDUSTRY_AND_PRODUCTION_DESIGN.md',
  'docs/FACILITY_CATALOG_PRESENTATION_DESIGN.md',
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
  'const orderedFacilityGroups = useMemo',
  'const groupsByTypeId = new Map<string, FacilityGroup>',
  'game.facilityTypes.flatMap',
  'orderedFacilityGroups.map',
  'facility-status-header',
  'FacilityProductionFormula',
  '生产配方',
  '固定配方：',
  '前往市场交易该工厂',
]) requireText('src/pages/ProductionPage.tsx', text);
for (const forbidden of [
  '{game.facilityGroups.map(',
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
const cssContent = read(css);
for (const text of [
  'grid-template-columns: minmax(220px, 1fr) minmax(0, 3fr);',
  'container-type: inline-size;',
  '.warehouse-product-grid',
  'grid-template-columns: repeat(4, minmax(0, 1fr));',
  'min-height: 116px;',
  'grid-template-rows: auto minmax(56px, 1fr) auto auto;',
  'align-self: start;',
  'padding: var(--space-2);',
  '.warehouse-product-card-name',
  'position: static;',
  '.warehouse-product-card-icon .product-icon',
  'width: 56px;',
  'height: 56px;',
  '@container (max-width: 559px)',
  'gap: 6px;',
  'min-height: 104px;',
  'grid-template-rows: auto minmax(46px, 1fr) auto auto;',
  'padding: 6px 4px;',
  'width: 46px;',
  'height: 46px;',
  '@container (min-width: 760px)',
  'grid-template-columns: repeat(5, minmax(0, 1fr));',
  'min-height: 124px;',
  'grid-template-rows: auto minmax(64px, 1fr) auto auto;',
  'width: 64px;',
  'height: 64px;',
  '@container (min-width: 960px)',
  'grid-template-columns: repeat(6, minmax(0, 1fr));',
  'min-height: 132px;',
  'grid-template-rows: auto minmax(72px, 1fr) auto auto;',
  'width: 72px;',
  'height: 72px;',
  '@media (max-width: 960px)',
]) requireText(css, text);
if (!/\.warehouse-product-grid\s*\{[^}]*grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)/s.test(cssContent)) {
  failures.push('仓库商品网格默认必须为四列');
}
if (!/\.warehouse-product-card-name\s*\{[^}]*position:\s*static;/s.test(cssContent)) {
  failures.push('仓库商品名称必须参与正常网格布局');
}
for (const text of [
  'padding: 30px var(--space-2) var(--space-2);',
  'padding: 24px 4px 6px;',
  'position: absolute;',
  '@container (min-width: 300px)',
  '@container (min-width: 560px)',
  '@container (max-width: 359px)',
  'repeat(4, minmax(130px, 1fr))',
  '@media (max-width: 1220px)',
  'grid-template-columns: repeat(3, minmax(130px, 1fr));',
  '@container (min-width: 360px)',
]) forbidText(css, text);

const artworkCss = 'src/styles/product-artwork.css';
const artworkContent = read(artworkCss);
for (const text of [
  '.warehouse-product-card-icon,',
  'background-image: var(--product-artwork-image, none);',
  '@media (prefers-reduced-data: reduce)',
]) requireText(artworkCss, text);
if (/^\.warehouse-product-card\s*\{/m.test(artworkContent)) {
  failures.push('product-artwork.css 不得重新定义仓库商品卡几何');
}
if (/^\.warehouse-product-card-icon\s*\{/m.test(artworkContent)) {
  failures.push('product-artwork.css 不得重新定义仓库商品插画尺寸');
}

for (const text of [
  'facility-formula-input-group',
  'facility-formula-center',
  'facility-formula-output-group',
  'facility-formula-progress',
  'function currentFormulaScope',
  'group.participatingCount',
  'group.nextCycleCount',
  'item.quantity * multiplier',
  'type.operatingCost * scope.count',
  'facility-formula-scope',
]) requireText('src/components/facilities/FacilityProductionFormula.tsx', text);
for (const text of [
  '单座配方每',
  'multiplier={group.count}',
  'type.operatingCost * group.count',
  'item.quantity * group.count',
]) forbidText('src/components/facilities/FacilityProductionFormula.tsx', text);

for (const text of [
  '无限等级、容量与费用',
  '扩容费用必须由当前实际总容量线性计算',
  '仓库等级只能决定容量增量，不能直接决定扩容费用',
  '仓库没有玩家可见的最高等级',
  '容器查询',
  '4／5／6 列',
  '`< 560px` | 4 列 | `104px` | `46px`',
  '`560px–759px` | 4 列 | `116px` | `56px`',
  '`760px–959px` | 5 列 | `124px` | `64px`',
  '`≥ 960px` | 6 列 | `132px` | `72px`',
  '任何移动或窄容器都不得少于四列',
  '正常四行网格',
  '插画是卡片第一视觉主体',
  '名称参与正常网格布局',
  '`src/styles/product-artwork.css` 只负责商品 PNG 路径映射',
  '不得再次声明 `.warehouse-product-card` 高度',
  '只以本文第 7.1 节为准',
]) requireText('docs/WAREHOUSE_EXPANSION_DESIGN.md', text);
for (const forbidden of [
  '升级费用：150 × L²',
  'warehouseUpgradeCostForLevel',
  '2／3／4／5／6 列',
  '| `< 300px` | 2 列 |',
  '| `300px–559px` | 3 列 |',
  '常规尺寸为 `44px`',
  '`30px` 图标',
]) forbidText('docs/WAREHOUSE_EXPANSION_DESIGN.md', forbidden);

requireText('docs/README.md', '仓库商品卡结构与网格密度唯一归属 `WAREHOUSE_EXPANSION_DESIGN.md`');
requireText('docs/README.md', '移动和窄容器固定每行四张卡');
requireText('README.md', '扩容费用为 `150 + ceil((当前实际总容量 - 500) × 0.6)`');
for (const text of ['建设卡不得显示生产周期、单座周期产量或单座周期成本', '生产公式只展示集群参数']) {
  requireText('docs/INDUSTRY_AND_PRODUCTION_DESIGN.md', text);
}
for (const text of [
  '`game.facilityTypes` 是客户端工厂展示顺序的唯一权威',
  '工厂类型下拉框与已拥有工厂卡片必须保持完全相同的目录顺序',
  '不得按 `facilityGroups` 返回顺序、中文名称、ID 或 `localeCompare` 重新排序',
]) requireText('docs/FACILITY_CATALOG_PRESENTATION_DESIGN.md', text);
for (const text of [
  '商品名称固定在左上角',
  '居中大尺寸统一商品 SVG',
  '建设卡不显示生产周期、单座产量和单座成本',
  '公式只展示集群输入、输出、周期和成本',
]) requireText('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', text);
for (const text of [
  '仓库商品网格使用容器查询',
  '左上名称／居中大图标／可用主值／冻结辅助值',
  '生产公式是集群运行能力展示',
]) requireText('docs/UI_DESIGN_SYSTEM.md', text);

if (failures.length) {
  console.error(`仓库扩容与生产卡片架构验证失败:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log('仓库无限扩容、容量线性定价、商品插画主视觉布局、移动端四列、目录顺序工厂卡、建设卡精简和集群公式验证通过。');
