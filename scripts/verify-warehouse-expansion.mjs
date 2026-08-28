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
  'server/src/online-auto-buy-policy.js',
  'server/src/online-auto-buy-orders.js',
  'server/src/online-auto-trade-policy.js',
  'server/src/online-auto-sell-policy.js',
  'server/src/online-auto-sell-orders.js',
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
  'src/auto-trade/useOnlineAutoTrade.ts',
  'src/api/game.ts',
  'src/app/gameViewModel.ts',
  'src/app/GameApp.tsx',
  'src/components/ui/MobileWorkspaceDetailSheet.tsx',
  'src/components/market/MarketAutoTradePanel.tsx',
  'src/components/warehouse/WarehouseInventoryPanel.tsx',
  'src/pages/TransportPage.tsx',
  'src/pages/MarketPage.tsx',
  'src/pages/OverviewPage.tsx',
  'src/pages/BuildingsPage.tsx',
  'src/styles/facility-group-card-grid.css',
  'src/styles/warehouse-expansion.css',
  'tests/browser/warehouse-auto-sell.spec.ts',
  'docs/README.md',
  'docs/UI_DESIGN_SYSTEM.md',
  'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
  'docs/WAREHOUSE_EXPANSION_DESIGN.md',
  'docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md',
  'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md',
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
  'createOnlineAutoBuyPolicyClientState(player)',
  'createOnlineAutoSellPolicyClientState(player)',
]) requireText('server/src/warehouse.js', text);

for (const text of [
  'WarehouseInventoryPanel',
  'WarehouseInventoryGrid',
  'data-ui-interactive="surface"',
  'onOpenProduct?.(product.id)',
  '仓库中暂无商品',
  '通过生产或市场交易获得商品后，会在这里按州级库存显示。',
]) requireText('src/components/warehouse/WarehouseInventoryPanel.tsx', text);
for (const text of [
  '共享仓库',
  'warehouse-heading-actions',
  '<StatusTag tone="neutral">无限容量</StatusTag>',
  'title="仓库内容"',
  '实物库存 {<CompactNumber value={game.warehouseStoredQuantity} />}',
  'warehouse-product-card--readonly',
  'WarehouseTransportPanel',
  'warehouse-transport-panel',
  'warehouse-transport-section',
  'transportShip',
  'transport-shipment-list',
]) {
  forbidText('src/components/warehouse/WarehouseInventoryPanel.tsx', text);
}
for (const text of [
  '.warehouse-transport-panel',
  '.warehouse-transport-section',
  '.transport-dispatch-grid',
  '.transport-estimate',
  '.transport-shipment-row',
]) {
  forbidText('src/styles/warehouse-expansion.css', text);
}
for (const text of ['title="运输"', 'title="运输路线"', 'title="运输记录"', '增加路线']) {
  requireText('src/pages/TransportPage.tsx', text);
}
for (const text of [
  'autoTrade.buyPolicyFor(product.id)',
  'autoTrade.sellPolicyFor(product.id)',
  '自动交易商品',
  '保存自动交易设置',
  'MobileWorkspaceDetailSheet',
  'data-product-id={product.id}',
]) forbidText('src/components/warehouse/WarehouseInventoryPanel.tsx', text);

for (const text of [
  'autoTrade.buyPolicyFor(product.id).enabled',
  'autoTrade.sellPolicyFor(product.id).enabled',
  '自动交易商品',
  '目标自由库存',
  '最高自动采购价格',
  '最低自由库存',
  '最低自动出售价格',
  '设置保存至存档 · 在线维护买单',
  '设置保存至存档 · 在线维护卖单',
  '保存自动交易设置',
  'production-warehouse-workspace',
  'warehouse-auto-trade-card',
  'warehouse-auto-trade-mobile-trigger',
  'MobileWorkspaceDetailSheet',
  "window.matchMedia('(max-width: 720px)')",
  'returnFocusRef={autoTradeTriggerRef}',
  'data-product-id={product.id}',
]) requireText('src/components/market/MarketAutoTradePanel.tsx', text);
forbidText('src/components/market/MarketAutoTradePanel.tsx', '关闭面板');
requireText('src/pages/MarketPage.tsx', 'fixedProductId={selectedProduct.id}');
for (const text of [
  '<WarehouseInventoryPanel',
  'model={model}',
  'onOpenProduct={openWarehouseProduct}',
]) requireText('src/pages/ProvincePage.tsx', text);
forbidText('src/pages/BuildingsPage.tsx', 'WarehouseInventoryPanel');
forbidText('src/pages/BuildingsPage.tsx', 'MarketAutoTradePanel');

for (const text of [
  '仓库容量永久无限',
  '不存在仓库等级、总容量、剩余容量、扩容、升级费用或最高等级',
  '不得以超大整数',
  '商品买单、商品拍卖和采购合同不再预占仓库空间',
  '工厂生产不再检查仓库空间',
  '客户端状态版本：36',
  '世界状态版本：32',
  'onlineAutoBuyPolicies',
  'onlineAutoSellPolicies',
  '在线自动采购',
  '在线自动出售',
  '目标自由库存',
  '最低自由库存',
  '不占玩家普通开放订单配额',
  '在线自动交易唯一显示在地区商品详情',
  '不再显示“共享仓库”“无限容量”“仓库内容”或“实物库存”汇总说明',
  '无限容量仍是服务器业务规则，但不作为仓库页面的可见状态标签',
  '州级仓库不得显示“无限容量”状态胶囊',
  '仓库商品网格之后不得追加跨州运输卡片',
  '独立 `TransportPage`',
  '商品卡整卡是当前州商品详情入口',
  '不得通过组件内部选择器切换到其他商品',
  '客户端状态版本保持当前全局基线 36',
  '世界状态版本保持当前全局基线 32',
  '`720px` 及以下',
  '`MobileWorkspaceDetailSheet`',
  '全商品选择器',
  '零库存',
]) requireText('docs/WAREHOUSE_EXPANSION_DESIGN.md', text);
for (const text of [
  '页面直接显示“无限容量”状态；随后以“仓库内容”为正文标题',
  '并在同一标题行显示“实物库存 {warehouseStoredQuantity}”',
  '州级仓库在所有宽度都保持只读',
  '自动交易卡必须提供全商品选择器',
  '客户端状态版本继续使用当前全局基线 33',
  '世界状态版本保持 27',
]) forbidText('docs/WAREHOUSE_EXPANSION_DESIGN.md', text);

for (const text of [
  '地区商品详情在线自动采购／自动出售',
  '移动自动交易抽屉与仓库商品网格密度',
]) requireText('docs/README.md', text);

for (const text of [
  '地区市场目录只承担商品发现与进入详情',
  '仓库库存唯一显示在隐藏州级上下文页的“仓库”分区',
  '自动采购／自动出售策略唯一显示在地区商品详情的自动交易区',
]) requireText('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', text);
forbidText('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', '建筑页共享仓库');
forbidText('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', '生产页共享仓库');

for (const text of [
  '一级市场采用“商品目录 → 商品全局详情 → 地区商品详情”',
  '两条路径最终都复用同一个地区商品详情、订单簿、下单和自动交易实现',
  '共享仓库只位于州级上下文页仓库分区，自动交易只位于市场',
  '地区商品详情自动交易控制',
  '所有玩家业务页面与业务详情共用同一个唯一根级 Mobile Workspace Sheet',
  '`MobileWorkspaceDetailSheet` API',
  '不得创建第二个 Sheet DOM',
  '固定当前商品，继续复用采购／出售页签',
]) requireText('docs/UI_DESIGN_SYSTEM.md', text);
forbidText('docs/UI_DESIGN_SYSTEM.md', '仓库自动交易设置共享的根级 Dialog');

for (const text of [
  '商品级在线自动采购／自动出售策略',
  '`online-auto-trade-reservations.js`',
  '`online-auto-trade-policy.js`',
  '`online-auto-buy-policy.js`、`online-auto-buy-orders.js`、`online-auto-buy.js`',
  '`online-auto-sell-policy.js`、`online-auto-sell-orders.js`、`online-auto-sell.js`',
  '自动交易托管订单配额豁免',
  '无限共享仓库真实库存汇总',
]) requireText('docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md', text);

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

for (const text of [
  '共享仓库永久无限',
  '商品买单、商品拍卖和采购合同不预占仓库容量',
  '恢复商品买单、商品拍卖或采购合同的仓库容量预占',
]) requireText('docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md', text);

const css = read('src/styles/warehouse-expansion.css');
for (const text of [
  'grid-template-columns: minmax(280px, 320px) minmax(0, 1fr);',
  '.warehouse-auto-trade-card',
  '.warehouse-auto-trade-mobile-trigger',
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
]) if (!css.includes(text)) failures.push('仓库商品卡/自动交易布局样式缺少: ' + text);

const productionGridCss = read('src/styles/facility-group-card-grid.css');
if (!productionGridCss.includes('grid-template-columns: minmax(280px, 320px) minmax(300px, 360px) minmax(480px, 1fr);')) {
  failures.push('建设新工厂控制列宽度基线已变化，必须同步复核自动交易控制列');
}

for (const text of [
  'regional commodity detail keeps a fixed desktop auto-trade control',
  'regional commodity detail uses the shared bottom sheet at 720px',
  'regional commodity detail keeps the fixed desktop control at 721px',
  'regional market catalog removes workspace switches and opens fixed commodity auto-trade',
  'province warehouse opens regional commodity detail without transport controls',
]) requireText('tests/browser/warehouse-auto-sell.spec.ts', text);

if (failures.length) {
  console.error('无限仓库防回退验证失败:\n- ' + failures.join('\n- '));
  process.exit(1);
}
console.log('无限仓库防回退验证通过：容量机制保持退役，仓库冗余摘要保持移除，商品可钻取，跨州运输唯一归属独立运输页，在线自动交易唯一归属市场。');
