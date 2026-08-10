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
  'server/src/online-auto-sell-policy.js',
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
  'src/auto-sell/economy-state.d.ts',
  'src/api/game.ts',
  'src/app/gameViewModel.ts',
  'src/app/GameApp.tsx',
  'src/components/ui/MobileWorkspaceDetailSheet.tsx',
  'src/components/warehouse/WarehouseInventoryPanel.tsx',
  'src/pages/MarketPage.tsx',
  'src/pages/OverviewPage.tsx',
  'src/pages/ProductionPage.tsx',
  'src/styles/facility-group-card-grid.css',
  'src/styles/warehouse-expansion.css',
  'tests/browser/warehouse-auto-sell.spec.ts',
  'docs/README.md',
  'docs/UI_DESIGN_SYSTEM.md',
  'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
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
  'createOnlineAutoSellPolicyClientState(player)',
]) requireText('server/src/warehouse.js', text);

for (const text of [
  'WarehouseInventoryPanel',
  '无限容量',
  'warehouseStoredQuantity',
  'inventory.available > 0 || inventory.frozen > 0',
  '最低自由库存',
  '设置保存至存档 · 仅在线执行',
  'production-warehouse-workspace',
  'warehouse-auto-sell-card',
  'MobileWorkspaceDetailSheet',
  "window.matchMedia('(max-width: 720px)')",
  'returnFocusRef={autoSellTriggerRef}',
  'data-product-id={product.id}',
]) requireText('src/components/warehouse/WarehouseInventoryPanel.tsx', text);
forbidText('src/components/warehouse/WarehouseInventoryPanel.tsx', '关闭面板');

for (const text of [
  '仓库容量永久无限',
  '不存在仓库等级、总容量、剩余容量、扩容、升级费用或最高等级',
  '不得以超大整数',
  '商品买单、商品拍卖和采购合同不再预占仓库空间',
  '工厂生产不再检查仓库空间',
  '客户端状态版本：33',
  '世界状态版本：27',
  'onlineAutoSellPolicies',
  '自动出售策略属于玩家经济存档',
  '最低自由库存保留量只限制在线自动出售',
  '不限制生产消耗、合同履约、市场手动卖出或拍卖',
  '桌面自动出售控制卡固定位于共享仓库左侧',
  '与“建设新工厂”使用同一 `minmax(280px, 320px)` 控制列',
  '`720px` 及以下',
  '`MobileWorkspaceDetailSheet`',
]) requireText('docs/WAREHOUSE_EXPANSION_DESIGN.md', text);
requireText('docs/UI_DESIGN_SYSTEM.md', '移动工厂详情、移动研发详情与仓库自动出售设置');
for (const text of [
  '左侧：自动出售',
  '右侧：共享仓库',
  '移动端自动出售使用与工厂详情相同的底部抽屉',
]) requireText('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', text);

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
  'grid-template-columns: minmax(280px, 320px) minmax(0, 1fr);',
  '.warehouse-auto-sell-card',
  'display: none;',
  '@media (max-width: 720px)',
  'grid-template-columns: repeat(5, minmax(0, 1fr));',
  '@container (max-width: 559px)',
  'grid-template-columns: repeat(4, minmax(0, 1fr));',
  '@container (min-width: 760px)',
  'grid-template-columns: repeat(6, minmax(0, 1fr));',
  '@container (min-width: 960px)',
  'grid-template-columns: repeat(7, minmax(0, 1fr));',
  'width: 40px;', 'width: 46px;', 'width: 52px;', 'width: 58px;',
]) if (!css.includes(text)) failures.push('仓库商品卡/自动出售布局样式缺少: ' + text);

const productionGridCss = read('src/styles/facility-group-card-grid.css');
if (!productionGridCss.includes('grid-template-columns: minmax(280px, 320px) minmax(300px, 360px) minmax(480px, 1fr);')) {
  failures.push('建设新工厂控制列宽度基线已变化，必须同步复核自动出售控制列');
}

for (const text of [
  'auto-sell panel left of the warehouse at the build-card width',
  'uses the shared bottom sheet at 720px',
  'keeps the desktop side panel at 721px',
  '设置保存至存档 · 仅在线执行',
]) requireText('tests/browser/warehouse-auto-sell.spec.ts', text);

if (failures.length) {
  console.error('无限仓库防回退验证失败:\n- ' + failures.join('\n- '));
  process.exit(1);
}
console.log('无限仓库防回退验证通过：容量机制保持退役，桌面/移动仓库布局与存档自动出售设置保持。');
