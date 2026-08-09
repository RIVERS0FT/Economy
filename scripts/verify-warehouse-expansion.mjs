import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), 'utf8').replace(/\r\n?/g, '\n');
const failures = [];
const requireFile = (path) => { if (!existsSync(resolve(root, path))) failures.push('缺少文件: ' + path); };
const requireText = (path, text) => { if (!read(path).includes(text)) failures.push(path + ' 缺少: ' + text); };
const forbidText = (path, text) => { if (existsSync(resolve(root, path)) && read(path).includes(text)) failures.push(path + ' 不应包含: ' + text); };

for (const path of [
  'server/src/warehouse.js',
  'server/src/domain.js',
  'server/src/domain-core.js',
  'server/src/contracts.js',
  'server/src/asset-auctions.js',
  'server/src/facility-groups.js',
  'server/src/game-routes.js',
  'server/src/runtime-action-executor.js',
  'server/src/storage.js',
  'server/test/warehouse.test.js',
  'src/types.ts',
  'src/api/game.ts',
  'src/app/gameViewModel.ts',
  'src/app/GameApp.tsx',
  'src/components/warehouse/WarehouseInventoryPanel.tsx',
  'src/pages/MarketPage.tsx',
  'src/pages/OverviewPage.tsx',
  'src/pages/ProductionPage.tsx',
  'src/styles/warehouse-expansion.css',
  'docs/README.md',
  'docs/WAREHOUSE_EXPANSION_DESIGN.md',
]) requireFile(path);

for (const removed of [
  'server/src/warehouse-reservations.js',
  'server/test/unified-warehouse-reservations.test.js',
  'src/components/warehouse/WarehouseUpgradeCard.tsx',
]) {
  if (existsSync(resolve(root, removed))) failures.push('旧仓库容量文件不得恢复: ' + removed);
}

for (const text of [
  'delete player.inventoryCapacity;',
  'delete player.warehouseLevel;',
  'warehouseStoredQuantity: storedQuantity(player)',
]) requireText('server/src/warehouse.js', text);
for (const text of [
  'WarehouseInventoryPanel',
  '无限容量',
  'warehouseStoredQuantity',
  'inventory.available > 0 || inventory.frozen > 0',
]) requireText('src/components/warehouse/WarehouseInventoryPanel.tsx', text);
for (const text of [
  '仓库容量永久无限',
  '不存在仓库等级、总容量、剩余容量、扩容、升级费用或最高等级',
  '不得以超大整数',
  '商品买单、商品拍卖和采购合同不再预占仓库空间',
  '工厂生产不再检查仓库空间',
  '客户端状态版本从 30 升至 31',
]) requireText('docs/WAREHOUSE_EXPANSION_DESIGN.md', text);

const runtimePaths = [
  'server/src',
  'src',
];
const bannedRuntimeTokens = [
  'warehouseUpgradeCost', 'warehouseNextCapacity', 'warehouseAvailableCapacity',
  'warehouseReservedQuantity', 'warehouseOrderReservedQuantity', 'warehouseContractReservedQuantity',
  'warehouseAuctionReservedQuantity', 'warehouseUsedCapacity', 'upgradeWarehouse',
  'WAREHOUSE_BASE_CAPACITY', 'WAREHOUSE_CAPACITY_STEP', 'WAREHOUSE_BASE_UPGRADE_COST',
  'warehouseCapacityForLevel', 'warehouseCapacityIncreaseForLevel', 'warehouseUpgradeCostForCapacity',
  "statusReason === 'warehouse_full'", "reason: 'warehouse_full'",
];
function walk(directory) {
  const base = resolve(root, directory);
  return readdirSync(base, { withFileTypes: true }).flatMap((entry) => {
    const relative = directory + '/' + entry.name;
    if (entry.isDirectory()) return walk(relative);
    return /\.(?:js|ts|tsx)$/.test(entry.name) ? [relative] : [];
  });
}
for (const path of runtimePaths.flatMap(walk)) {
  const content = read(path);
  for (const token of bannedRuntimeTokens) {
    if (content.includes(token)) failures.push(path + ' 不得恢复仓库容量机制: ' + token);
  }
}

for (const [path, text] of [
  ['server/src/game-routes.js', '/api/game/warehouse/upgrade'],
  ['server/src/contracts.js', '采购方仓库空间不足'],
  ['server/src/contracts.js', '采购方仓库无法容纳'],
  ['server/src/asset-auctions.js', '仓库剩余容量不足'],
  ['server/src/asset-auctions.js', '买家仓库容量不足'],
  ['server/src/domain.js', '仓库容量不足'],
  ['server/src/domain-core.js', '仓库容量不足'],
  ['src/pages/MarketPage.tsx', '仓库已满，无法买入'],
  ['src/pages/OverviewPage.tsx', '共享仓库已满'],
  ['src/notifications/notificationCenter.ts', 'warehouse:capacity'],
  ['src/navigation/navigationBadges.ts', 'warehouse-capacity'],
]) forbidText(path, text);

const css = read('src/styles/warehouse-expansion.css');
for (const text of [
  'grid-template-columns: repeat(5, minmax(0, 1fr));',
  '@container (max-width: 559px)',
  'grid-template-columns: repeat(4, minmax(0, 1fr));',
  '@container (min-width: 760px)',
  'grid-template-columns: repeat(6, minmax(0, 1fr));',
  '@container (min-width: 960px)',
  'grid-template-columns: repeat(7, minmax(0, 1fr));',
  'width: 40px;', 'width: 46px;', 'width: 52px;', 'width: 58px;',
]) if (!css.includes(text)) failures.push('仓库商品卡样式缺少: ' + text);

if (failures.length) {
  console.error('无限仓库防回退验证失败:\n- ' + failures.join('\n- '));
  process.exit(1);
}
console.log('无限仓库防回退验证通过：容量、扩容、预占与 warehouse_full 已退役，真实库存与商品卡布局保持。');
