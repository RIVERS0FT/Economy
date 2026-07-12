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
].forEach(requireFile);

for (const text of [
  'WAREHOUSE_BASE_CAPACITY = 500', 'WAREHOUSE_CAPACITY_STEP = 250', 'WAREHOUSE_MAX_LEVEL = 12',
  'WAREHOUSE_BASE_UPGRADE_COST = 150', 'export function createWarehouseUsage',
  'warehouseReservedQuantity: reserved', 'warehouseAvailableCapacity: Math.max(0, player.inventoryCapacity - used)',
  "order?.assetKind === 'facility'", 'player.credits -= cost', 'player.warehouseLevel += 1',
]) requireText('server/src/warehouse.js', text);

for (const text of ['createWarehouseSummary', 'upgradeWarehouse', "action === 'upgradeWarehouse'", 'version: 10']) requireText('server/src/storage.js', text);
for (const text of ['version: 10;', 'warehouseLevel: number;', 'warehouseReservedQuantity: number;', 'warehouseAvailableCapacity: number;']) requireText('src/types.ts', text);
for (const text of [
  'WarehouseUpgradeCard',
  '建设新工厂',
  'game.facilityGroups.map',
  'facility-status-header',
  '玩家已关闭生产',
  '在统一订单簿中买卖该工厂',
]) requireText('src/pages/ProductionPage.tsx', text);
for (const text of ['等待异常条件解除', 'facility-progress-compact']) requireText('src/components/facilities/FacilityProgress.tsx', text);
for (const text of ['warehouse state defaults to level 1 and client version 10', 'remaining open commodity buy orders only', 'warehouse upgrade is idempotent']) requireText('server/test/warehouse.test.js', text);
for (const text of ['player.stats.producedGoods', 'inventoryFor(player, type.output.productId).available += requirements.output', 'pendingJoinCount']) requireText('server/src/facility-groups.js', text);

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
  '仓库中暂无商品',
  '生产或买入商品后，商品会显示在这里。',
]) requireText('src/components/warehouse/WarehouseUpgradeCard.tsx', text);

for (const forbidden of [
  'WarehouseContentFilter',
  'contentFilter',
  'warehouse-content-filters',
  '>有库存</Button>',
  '>全部商品</Button>',
  '查看全部商品',
  'warehouse-product-card empty',
]) forbidText('src/components/warehouse/WarehouseUpgradeCard.tsx', forbidden);

for (const text of [
  'grid-template-columns: minmax(220px, 1fr) minmax(0, 3fr);',
  '.warehouse-product-grid',
  'repeat(4, minmax(130px, 1fr))',
  '.warehouse-product-card-title',
  '.warehouse-product-card > strong',
  '.warehouse-product-card > small',
  '@media (max-width: 960px)',
  '@media (max-width: 420px)',
]) requireText('src/styles/warehouse-expansion.css', text);

for (const forbidden of ['.warehouse-content-filters', '.warehouse-product-card.empty']) forbidText('src/styles/warehouse-expansion.css', forbidden);

for (const text of [
  'Compact production card layout v2',
  '.production-build-card',
  '.facility-status-title',
  '.facility-progress-compact',
  '@media (min-width: 961px)',
]) requireText('src/styles/industry-system.css', text);

for (const forbidden of ['商品估值', '买一价', '最近成交价', '买单预占数量']) forbidText('src/components/warehouse/WarehouseUpgradeCard.tsx', forbidden);
for (const forbidden of ['facility-stop-reason', 'facility-auto-recovery-note', '手动停止']) forbidText('src/pages/ProductionPage.tsx', forbidden);
for (const text of ['产成品去向', 'WarehouseUpgradeCard model={model} className="factory-warehouse-card" />']) forbidText('src/pages/MarketPage.tsx', text);
for (const text of ['WarehouseUpgradeCard', 'upgradeWarehouse()', '商品库存与估值', 'product-asset-grid', 'product-asset-card']) forbidText('src/pages/AssetsPage.tsx', text);
for (const text of ['WarehouseUpgradeCard', 'warehouseUpgradeCost', '仓库使用']) forbidText('src/pages/SettingsPage.tsx', text);

for (const text of [
  '仓库不再区分“有库存”和“全部商品”',
  '统一 `ProductIconLabel` 商品 SVG 与商品名称',
  '醒目的“库存 N”主值',
  '简化文本“可用 N · 冻结 N”',
  '资产页负责资产汇总和本地资产变化，不得重复显示逐商品库存与估值卡',
]) requireText('docs/WAREHOUSE_EXPANSION_DESIGN.md', text);

if (failures.length) {
  console.error(`仓库扩容与生产卡片架构验证失败:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log('仓库一比三分栏、仅有库存商品、统一商品 SVG、紧凑商品卡、紧凑工厂卡和版本 10 权威容量验证通过。');
