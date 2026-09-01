import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), 'utf8').replace(/\r\n?/g, '\n');
const failures = [];
const requireFile = (path) => { if (!existsSync(resolve(root, path))) failures.push(`缺少文件: ${path}`); };
const requireText = (path, text) => { if (!existsSync(resolve(root, path)) || !read(path).includes(text)) failures.push(`${path} 缺少: ${text}`); };
const forbidText = (path, text) => { if (existsSync(resolve(root, path)) && read(path).includes(text)) failures.push(`${path} 不应包含: ${text}`); };

for (const path of [
  'server/src/warehouse.js',
  'server/src/factory-auto-operation.js',
  'server/src/online-auto-buy.js',
  'server/src/online-auto-sell.js',
  'server/src/domain.js',
  'server/src/domain-core.js',
  'server/src/contracts.js',
  'server/src/asset-auctions.js',
  'server/src/facility-groups.js',
  'server/src/runtime-action-executor.js',
  'server/test/warehouse.test.js',
  'server/test/factory-auto-operation.test.js',
  'src/api/game.ts',
  'src/auto-trade/useOnlineAutoTrade.ts',
  'src/components/facilities/FacilityAutoOperationControls.tsx',
  'src/components/facilities/FacilityProductionFormula.tsx',
  'src/components/market/MarketAutoTradePanel.tsx',
  'src/components/warehouse/WarehouseInventoryPanel.tsx',
  'src/pages/MarketPage.tsx',
  'src/pages/ProvincePage.tsx',
  'src/pages/TransportPage.tsx',
  'src/styles/factory-auto-operation.css',
  'src/styles/warehouse-expansion.css',
  'docs/WAREHOUSE_EXPANSION_DESIGN.md',
  'docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md',
]) requireFile(path);

for (const removed of [
  'server/src/warehouse-reservations.js',
  'server/test/unified-warehouse-reservations.test.js',
  'src/components/warehouse/WarehouseUpgradeCard.tsx',
]) {
  if (existsSync(resolve(root, removed))) failures.push(`旧仓库容量文件不得恢复: ${removed}`);
}

for (const text of [
  'delete player.inventoryCapacity;',
  'delete player.warehouseLevel;',
  'warehouseStoredQuantity: storedQuantity(player)',
  'createFactoryAutoTradeExecutionClientState(player)',
  'createFactoryAutoOperationClientState(player)',
]) requireText('server/src/warehouse.js', text);

for (const text of [
  'WarehouseInventoryPanel',
  'WarehouseInventoryGrid',
  'data-ui-interactive="surface"',
  'onOpenProduct?.(product.id)',
  '仓库中暂无商品',
]) requireText('src/components/warehouse/WarehouseInventoryPanel.tsx', text);
for (const text of [
  '共享仓库',
  '<StatusTag tone="neutral">无限容量</StatusTag>',
  'title="仓库内容"',
  '实物库存 {<CompactNumber value={game.warehouseStoredQuantity} />}',
  'WarehouseTransportPanel',
  'transportShip',
  'MarketAutoTradePanel',
]) forbidText('src/components/warehouse/WarehouseInventoryPanel.tsx', text);

for (const text of [
  '<WarehouseInventoryPanel',
  'onOpenProduct={openWarehouseProduct}',
]) requireText('src/pages/ProvincePage.tsx', text);
forbidText('src/pages/BuildingsPage.tsx', 'WarehouseInventoryPanel');

for (const text of [
  'FacilityAutoOperationControls',
  '<FacilityAutoOperationControls group={group} />',
]) requireText('src/components/facilities/FacilityProductionFormula.tsx', text);
for (const text of [
  '自动经营',
  '原料保障',
  '经营模式',
  '产成品处理',
  '1 个生产周期',
  '2 个生产周期',
  '3 个生产周期',
  '5 个生产周期',
  '利润优先',
  '均衡',
  '保供优先',
  '满足内部需求后出售',
  '全部保留',
]) requireText('src/components/facilities/FacilityAutoOperationControls.tsx', text);

for (const text of [
  '自动经营执行',
  '由工厂策略汇总',
  '生产预定',
  '合同预定',
  '预计自动采购',
  '预计自动出售',
  '采购价格上限',
  '出售价格下限',
]) requireText('src/components/market/MarketAutoTradePanel.tsx', text);
for (const text of [
  'MoneyInput',
  'IntegerInput',
  '保存自动交易设置',
  '目标自由库存',
  '最低自由库存',
  'MobileWorkspaceDetailSheet',
]) forbidText('src/components/market/MarketAutoTradePanel.tsx', text);
forbidText('src/pages/MarketPage.tsx', '<MarketAutoTradePanel', '');

for (const text of [
  '仓库容量永久无限',
  '不存在仓库等级、总容量、剩余容量、扩容、升级费用或最高等级',
  '商品买单、商品拍卖和采购合同不预占仓库空间',
  '工厂生产不得检查仓库空间',
  '玩家在工厂详情表达自动经营意图',
  'factoryAutoOperationPolicies',
  'inputCoverageCycles: 1 | 2 | 3 | 5',
  '地区商品详情不渲染“自动经营执行”卡',
  '工厂详情是自动经营策略与执行解释的唯一玩家界面',
  '每个“玩家 + 地区 + 商品”最多维护一张关联自动买单和一张关联自动卖单',
  '`factoryAutoOperationPolicies` 是现有玩家状态中的可选字段',
  '世界状态版本保持 32',
]) requireText('docs/WAREHOUSE_EXPANSION_DESIGN.md', text);

for (const text of [
  '页面直接显示“无限容量”状态',
  '自动交易卡必须提供全商品选择器',
  '自动交易唯一显示在地区商品详情',
  '地区商品详情保留“自动经营执行”只读卡',
  '商品详情中的自动经营执行区只读',
]) forbidText('docs/WAREHOUSE_EXPANSION_DESIGN.md', text);

const runtimePaths = ['server/src', 'src'];
const bannedRuntimeTokens = [
  'warehouseUpgradeCost',
  'warehouseNextCapacity',
  'warehouseAvailableCapacity',
  'warehouseReservedQuantity',
  'warehouseOrderReservedQuantity',
  'warehouseContractReservedQuantity',
  'warehouseAuctionReservedQuantity',
  'warehouseUsedCapacity',
  'upgradeWarehouse',
  'WAREHOUSE_BASE_CAPACITY',
  'WAREHOUSE_CAPACITY_STEP',
  'WAREHOUSE_BASE_UPGRADE_COST',
  'warehouseCapacityForLevel',
  'warehouseCapacityIncreaseForLevel',
  'warehouseUpgradeCostForCapacity',
  "statusReason === 'warehouse_full'",
  "reason: 'warehouse_full'",
];
function walk(directory) {
  const base = resolve(root, directory);
  return readdirSync(base, { withFileTypes: true }).flatMap((entry) => {
    const relative = `${directory}/${entry.name}`;
    if (entry.isDirectory()) return walk(relative);
    return /\.(?:js|ts|tsx)$/.test(entry.name) ? [relative] : [];
  });
}
for (const path of runtimePaths.flatMap(walk)) {
  const content = read(path);
  for (const token of bannedRuntimeTokens) {
    if (content.includes(token)) failures.push(`${path} 不得恢复仓库容量机制: ${token}`);
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
]) forbidText(path, text);

for (const text of [
  '共享仓库永久无限',
  '商品买单、商品拍卖和采购合同不预占仓库容量',
  '恢复商品买单、商品拍卖或采购合同的仓库容量预占',
]) requireText('docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md', text);

const css = read('src/styles/warehouse-expansion.css');
for (const text of [
  'grid-template-columns: repeat(5, minmax(0, 1fr));',
  '@container (max-width: 559px)',
  'grid-template-columns: repeat(4, minmax(0, 1fr));',
  '@container (min-width: 760px)',
  'grid-template-columns: repeat(6, minmax(0, 1fr));',
  '@container (min-width: 960px)',
  'grid-template-columns: repeat(7, minmax(0, 1fr));',
]) {
  if (!css.includes(text)) failures.push(`仓库商品卡网格样式缺少: ${text}`);
}

if (failures.length) {
  console.error('无限共享仓库/工厂自动经营防回退检查失败：');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('无限共享仓库/工厂自动经营防回退检查通过');
