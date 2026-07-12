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
  'src/pages/ProductionPage.tsx',
  'src/pages/AssetsPage.tsx',
  'src/utils/localActivityStore.ts',
  'src/styles/warehouse-expansion.css',
  'docs/WAREHOUSE_EXPANSION_DESIGN.md',
].forEach(requireFile);

for (const text of [
  'WAREHOUSE_BASE_CAPACITY = 500', 'WAREHOUSE_CAPACITY_STEP = 250', 'WAREHOUSE_MAX_LEVEL = 12',
  'WAREHOUSE_BASE_UPGRADE_COST = 150', 'export function createWarehouseUsage',
  'warehouseReservedQuantity: reserved', 'warehouseAvailableCapacity: Math.max(0, player.inventoryCapacity - used)',
  "order?.assetKind === 'facility'", 'player.credits -= cost', 'player.warehouseLevel += 1',
]) requireText('server/src/warehouse.js', text);

for (const text of ['createWarehouseSummary', 'upgradeWarehouse', "action === 'upgradeWarehouse'", 'version: 9']) requireText('server/src/storage.js', text);
for (const text of ['version: 9;', 'warehouseLevel: number;', 'warehouseReservedQuantity: number;', 'warehouseAvailableCapacity: number;']) requireText('src/types.ts', text);
for (const text of ['WarehouseUpgradeCard', '建设新工厂', 'game.facilityGroups.map', '周期产量']) requireText('src/pages/ProductionPage.tsx', text);
for (const text of ['warehouse state defaults to level 1 and client version 9', 'remaining open commodity buy orders only', 'warehouse upgrade is idempotent']) requireText('server/test/warehouse.test.js', text);
for (const text of ['player.stats.producedGoods', 'inventoryFor(player, type.output.productId).available += outputQuantity', 'pendingJoinCount']) requireText('server/src/facility-groups.js', text);
for (const text of ['产成品去向', 'WarehouseUpgradeCard model={model} className="factory-warehouse-card" />']) forbidText('src/pages/MarketPage.tsx', text);
for (const text of ['WarehouseUpgradeCard', 'upgradeWarehouse()']) forbidText('src/pages/AssetsPage.tsx', text);
for (const text of ['WarehouseUpgradeCard', 'warehouseUpgradeCost', '仓库使用']) forbidText('src/pages/SettingsPage.tsx', text);

if (failures.length) {
  console.error('仓库扩容架构验证失败:\n- ' + failures.join('\n- '));
  process.exit(1);
}
console.log('仓库扩容架构验证通过：版本 9 共享容量、商品买单预占和工厂生产入仓满足设计。');
