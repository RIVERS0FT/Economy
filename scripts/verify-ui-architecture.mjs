import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const failures = [];

function requireFile(path) {
  if (!existsSync(resolve(root, path))) failures.push(`缺少文件: ${path}`);
}
function forbidFile(path) {
  if (existsSync(resolve(root, path))) failures.push(`不应继续存在文件: ${path}`);
}
function requireText(path, text) {
  if (!read(path).includes(text)) failures.push(`${path} 缺少: ${text}`);
}
function forbidText(path, text) {
  if (read(path).includes(text)) failures.push(`${path} 不应包含: ${text}`);
}
function requireOrderedText(path, earlier, later) {
  const content = read(path);
  const first = content.indexOf(earlier);
  const second = content.indexOf(later);
  if (first < 0 || second < 0 || first >= second) failures.push(`${path} 必须先包含 ${earlier}，再包含 ${later}`);
}

const pagePaths = [
  'src/pages/OverviewPage.tsx',
  'src/pages/MarketPage.tsx',
  'src/pages/ProductionPage.tsx',
  'src/pages/AssetsPage.tsx',
  'src/pages/LeaderboardPage.tsx',
  'src/pages/SettingsPage.tsx',
];

[
  'src/app/App.tsx',
  'src/app/GameApp.tsx',
  'src/app/LoginPage.tsx',
  'src/app/gameViewModel.ts',
  'src/api/game.ts',
  'src/types.ts',
  'src/components/facilities/FacilityProgress.tsx',
  'src/components/warehouse/WarehouseUpgradeCard.tsx',
  'src/components/shell/GameShell.tsx',
  'src/components/shell/DesktopSidebar.tsx',
  'src/components/shell/MobileBottomNavigation.tsx',
  'src/components/shell/NavigationItems.tsx',
  'src/components/shell/StatusBar.tsx',
  'src/components/ui/layout.tsx',
  'src/config/navigation.ts',
  'src/pages/PageRouter.tsx',
  'src/utils/localActivityStore.ts',
  'src/styles/design-system.css',
  'src/styles/globals.css',
  'src/styles/industry-system.css',
  'src/styles/market-funds.css',
  'src/styles/liquid-glass-chrome.css',
  'src/styles/desktop-sidebar.css',
  'src/styles/mobile-status-navigation.css',
  'src/styles/mobile-status-layout.css',
  'docs/UI_DESIGN_SYSTEM.md',
  'docs/FACILITY_GROUP_AND_MARKET_V3_DESIGN.md',
  'docs/INDUSTRY_AND_PRODUCTION_DESIGN.md',
  'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
  'docs/MARKET_AND_ASSET_INFORMATION_ARCHITECTURE.md',
  'docs/LOCAL_ACTIVITY_LOG_DESIGN.md',
  'server/src/facility-groups.js',
  'server/src/storage.js',
  'server/src/asset-events.js',
  'server/test/facility-groups.test.js',
  'server/test/asset-events.test.js',
  ...pagePaths,
].forEach(requireFile);

forbidFile('src/store/gameStore.ts');
forbidFile('src/pages/RecordsPage.tsx');
forbidFile('server/src/direct-production.js');
forbidFile('server/test/direct-production.test.js');

if (read('src/App.tsx').trim() !== "export { default } from './app/App';") failures.push('src/App.tsx 必须只导出新的应用入口');

for (const [path, forbidden] of [
  ['src/main.tsx', ['MutationObserver', 'querySelector', 'textContent']],
  ['src/config/navigation.ts', ["id: 'records'", "label: '订单'", '订单与记录']],
  ['src/pages/PageRouter.tsx', ['RecordsPage', "case 'records'"]],
  ['src/types.ts', ['facilitySlots', 'ProductionFacility', 'facilities: ProductionFacility[];', 'version: 7;', 'internalGoods', 'internalCapacity']],
  ['src/pages/ProductionPage.tsx', ['facility.id', 'facility.name', '小时产量', '小时运营费', '累计产量', '系统参考估值', '展开管理', '实例列表', 'collectFacility', '领取产成品']],
  ['src/pages/MarketPage.tsx', [
    'book-columns', 'aggregateOrderBook', 'listing.facility.', 'facilityId:', '玩家身份',
    'order-book-midpoint', '买入快捷数量按资金与仓库剩余空间共同计算',
  ]],
  ['src/components/warehouse/WarehouseUpgradeCard.tsx', ['未完成买单剩余数量']],
  ['src/styles/market-funds.css', ['.order-book-midpoint', 'align-self: start']],
  ['src/pages/SettingsPage.tsx', ['<DataList', '<DataRow', 'WarehouseUpgradeCard', '工厂总数', '仓库使用', '当前排名', 'derived.']],
  ['src/app/gameViewModel.ts', ['game.facilities', 'ProductionFacility', 'pendingGoods']],
  ['src/api/game.ts', ['collectFacility', '/collect']],
  ['server/src/storage.js', ['direct-production', 'processDirectProductionWorld', 'applyDirectProductionAction']],
]) {
  for (const text of forbidden) forbidText(path, text);
}

for (const path of ['src/components/ui/layout.tsx', ...pagePaths]) {
  forbidText(path, 'eyebrow');
  forbidText(path, 'ui-eyebrow');
}

for (const [path, required] of [
  ['index.html', ['viewport-fit=cover']],
  ['src/config/navigation.ts', ["label: '概览'", "label: '市场'", "label: '生产'", "label: '资金'", "label: '排行'", "label: '设置'"]],
  ['src/components/ui/layout.tsx', [
    'export function Button', 'export function StatusTag', 'export function MetricCard',
    'export function DataList', 'export function DataRow', 'export function ToggleField',
    'export function ScrollableTable', 'export function EmptyState', '<h1>{title}</h1>', '<h2>{title}</h2>',
  ]],
  ['src/components/shell/DesktopSidebar.tsx', ['服务器权威经济', '<Button']],
  ['src/components/shell/GameShell.tsx', ['<DesktopSidebar', '<MobileBottomNavigation']],
  ['src/components/shell/NavigationItems.tsx', ["id === 'market' && openOrderCount > 0"]],
  ['src/pages/OverviewPage.tsx', ['game.facilityGroups', 'pendingJoin', '工厂总数', '下一周期加入', '共享仓库剩余']],
  ['src/pages/MarketPage.tsx', [
    '限价', '数量', 'order-quick-fill', '1/4 仓', '1/2 仓', '全仓',
    'const bestAsks = derived.asks.slice(0, 5).reverse()',
    'const bestBids = derived.bids.slice(0, 5)',
    'single-order-book', 'order-book-divider', 'local-trades-section', 'local-trades-table', 'localTrades.map',
    '工厂数量市场', 'buyFacility(listing.id, purchaseQuantity)', 'cancelOrder(order.id)',
  ]],
  ['src/components/warehouse/WarehouseUpgradeCard.tsx', ['label="买单预占"', 'warehouseReservedQuantity']],
  ['src/pages/ProductionPage.tsx', [
    'game.facilityGroups.map', 'FacilityGroupProgress', '当前参与', '下一周期', '待加入', '已挂牌',
    '周期产量', '周期成本', '原料库存', '统一生产计划', '启动全部', '停止全部',
    '挂牌数量', '单座价格', '下一生产周期加入',
  ]],
  ['src/pages/AssetsPage.tsx', ['game.facilityGroups', '本地资金与资产变动', 'event.facilityChanges', 'event.productionChanges']],
  ['src/pages/SettingsPage.tsx', ['玩家资料', '游戏设置', '登录会话', '退出登录', '重置服务器经济状态']],
  ['src/types.ts', ['version: 8;', 'export interface FacilityGroup', 'facilityGroups: FacilityGroup[];', 'export interface FacilityListing', 'quantity: number;', 'unitPrice: number;', 'localOnly: true;']],
  ['src/api/game.ts', [
    'startFacility: (facilityTypeId: string)',
    'listFacility:',
    'quantity: number',
    'unitPrice: number',
    'buyFacility: (listingId: string, quantity: number)',
  ]],
  ['src/app/gameViewModel.ts', ['game.facilityGroups.reduce', "runAction('startFacility'", "runAction('buyFacility'"]],
  ['src/components/facilities/FacilityProgress.tsx', ['export function FacilityGroupProgress', 'group.cycleStartedAt', 'type.cycleMs']],
  ['src/utils/localActivityStore.ts', ['STORAGE_VERSION = 2', 'MAX_TRADES = 240', 'facilityGroups: state.facilityGroups', 'diffFacilityGroups', '工厂数量市场']],
  ['server/src/storage.js', ['processFacilityGroupWorld', 'applyFacilityGroupAction', 'createFacilityGroupClientState', 'version: 8', "this.database.exec('BEGIN IMMEDIATE')", 'stripPlayerLogs']],
  ['server/src/facility-groups.js', ['migrateFacilityGroupWorld', 'processFacilityGroupWorld', 'pendingJoinCount', 'participatingCount', 'listFacilityGroup', 'buyFacilityGroup', 'stripLegacyFacilityInstances']],
  ['server/test/facility-groups.test.js', ['same-type factories share one cycle', 'joins after the current cycle', 'starts and stops uniformly', 'partial purchase transfer exact counts', 'join a running group on the next cycle']],
  ['server/test/asset-events.test.js', ['client state version 8 excludes all player log arrays and factory instances']],
  ['src/styles/industry-system.css', ['.facility-group-list', '.facility-group-card', '.facility-group-counts', '.facility-group-specs', '.facility-group-listing-control', '@media (max-width: 720px)']],
  ['src/styles/market-funds.css', [
    '.order-quick-fill', '.single-order-book', 'align-self: stretch', '.order-book-stack', '.book-order-row',
    '.order-book-divider', '.local-trades-table', 'max-height: none', '.listing-purchase-control',
  ]],
  ['docs/FACILITY_GROUP_AND_MARKET_V3_DESIGN.md', [
    '不存在单座工厂实例', '新建或收购的同类型工厂', '限价在前、数量在后',
    '订单簿为单列', '买卖盘各最多 5 笔', '无文字中性分隔线',
    '订单簿卡片必须使用网格默认拉伸', '市场页本地成交记录必须遍历全部当前已加载的 `localTrades`',
  ]],
  ['docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', [
    '订单簿内部不得显示最近成交或价差指标卡', '订单簿卡片必须拉伸到所在网格行高度',
    '本地成交记录面板不得设置固定高度',
  ]],
]) {
  for (const text of required) requireText(path, text);
}

requireOrderedText('src/pages/ProductionPage.tsx', '<WarehouseUpgradeCard model={model} className="factory-warehouse-card" />', '建设新工厂');
requireOrderedText('src/pages/MarketPage.tsx', '限价', '数量');
requireOrderedText('src/pages/MarketPage.tsx', '数量', 'order-quick-fill');
requireOrderedText('src/main.tsx', "import './styles/market-funds.css'", "import './styles/design-system.css'");

for (const token of [
  '--font-sans:', '--color-bg-canvas:', '--color-surface-panel:', '--color-text-primary:',
  '--color-text-muted:', '--color-border:', '--color-success:', '--color-warning:',
  '--color-danger:', '--space-1:', '--space-4:', '--radius-control:', '--radius-card:',
  '--shadow-panel:', '--control-height:',
]) requireText('src/styles/design-system.css', token);

for (const primitive of [
  '.ui-button--primary', '.ui-button--secondary', '.ui-button--danger', '.ui-button--compact',
  '.ui-status-tag', '.ui-metric-card', '.ui-data-list', '.ui-data-row', '.ui-toggle-field',
  '.table-wrap', 'button:focus-visible', 'min-height: 44px', '@media (prefers-reduced-motion: reduce)',
  '@media (max-width: 1220px)', '@media (max-width: 720px)',
]) requireText('src/styles/design-system.css', primitive);

if (failures.length) {
  console.error('UI 与工厂集群第三版架构验证失败:\n- ' + failures.join('\n- '));
  process.exit(1);
}
console.log('UI 架构验证通过：统一组件、订单簿等高分隔布局、本地成交自然增长和工厂集群满足设计基线。');
