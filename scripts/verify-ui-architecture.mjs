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
  const earlierIndex = content.indexOf(earlier);
  const laterIndex = content.indexOf(later);
  if (earlierIndex < 0 || laterIndex < 0 || earlierIndex >= laterIndex) {
    failures.push(`${path} 必须先包含 ${earlier}，再包含 ${later}`);
  }
}

const pages = [
  'OverviewPage.tsx',
  'MarketPage.tsx',
  'ProductionPage.tsx',
  'AssetsPage.tsx',
  'LeaderboardPage.tsx',
  'SettingsPage.tsx',
];
const pagePaths = pages.map((page) => `src/pages/${page}`);
const uiSourcePaths = [
  'src/app/LoginPage.tsx',
  'src/components/shell/DesktopSidebar.tsx',
  'src/components/ui/layout.tsx',
  ...pagePaths,
];

[
  'src/app/App.tsx',
  'src/app/GameApp.tsx',
  'src/app/LoginPage.tsx',
  'src/app/gameViewModel.ts',
  'src/api/game.ts',
  'src/types.ts',
  'src/config/economy.ts',
  'src/components/facilities/FacilityProgress.tsx',
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
  'src/styles/auth.css',
  'src/styles/card-system.css',
  'src/styles/desktop-sidebar.css',
  'src/styles/mobile-pages.css',
  'src/styles/mobile-status-navigation.css',
  'src/styles/mobile-status-layout.css',
  'docs/UI_DESIGN_SYSTEM.md',
  'docs/INDUSTRY_AND_PRODUCTION_DESIGN.md',
  'docs/MARKET_AND_ASSET_INFORMATION_ARCHITECTURE.md',
  'docs/LOCAL_ACTIVITY_LOG_DESIGN.md',
  'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md',
  'server/src/index.js',
  'server/src/domain.js',
  'server/src/storage.js',
  'server/src/asset-events.js',
  'server/src/auth.js',
  'server/test/domain.test.js',
  'server/test/asset-events.test.js',
  ...pagePaths,
].forEach(requireFile);

forbidFile('src/store/gameStore.ts');
forbidFile('src/pages/RecordsPage.tsx');

if (read('src/App.tsx').trim() !== "export { default } from './app/App';") {
  failures.push('src/App.tsx 必须只导出新的应用入口');
}

for (const [path, forbidden] of [
  ['src/main.tsx', ['MutationObserver', 'querySelector', 'textContent']],
  ['src/styles/mobile-status-navigation.css', ['nth-child']],
  ['src/styles/card-system.css', ['--card-radius:', '--radius-card:']],
  ['src/config/navigation.ts', ['主页面', '排行榜', '订单与记录', "id: 'records'", "label: '订单'"]],
  ['src/pages/PageRouter.tsx', ['RecordsPage', "case 'records'"]],
  ['src/components/shell/NavigationItems.tsx', ["id === 'records'"]],
  ['src/pages/OverviewPage.tsx', ["setTab('records')", 'game.trades']],
  ['src/pages/MarketPage.tsx', ['game.trades']],
  ['src/pages/AssetsPage.tsx', ['game.assetEvents', 'game.ledger', "setTab('records')"]],
  ['src/app/gameViewModel.ts', ['useGameStore', 'facilitySlots', 'game.trades', 'game.assetEvents']],
  ['src/utils/runtimePerformance.ts', ['useGameStore']],
  ['src/types.ts', ['facilitySlots', 'version: 5;', 'version: 6;', 'assetEvents: AssetEvent[];', 'trades: TradeRecord[];', 'ledger: LedgerEntry[];']],
  ['src/pages/ProductionPage.tsx', ['facilitySlots', '设施槽位']],
  ['src/pages/SettingsPage.tsx', ['facilitySlots', '设施槽位']],
  ['server/src/domain.js', ['生产设施槽位不足', '空闲设施槽位']],
  ['server/src/storage.js', ['migrateAssetEvents', 'appendAssetEventFromDiff', 'assetEvents: normalizeJson']],
  ['src/styles/auth.css', ['#07100d', '@media (max-width: 380px)']],
  ['src/styles/globals.css', [
    '\nbutton {',
    '\ninput,\nselect',
    '\n.status-chip {',
    '\n.table-button {',
    '\ntable {',
    '\nth, td {',
    '@media (max-width: 1180px)',
    '@media (max-width: 950px)',
    '@media (max-width: 700px)',
    '@media (max-width: 380px)',
  ]],
]) {
  for (const text of forbidden) forbidText(path, text);
}

const legacyUiClasses = [
  'ghost-button',
  'danger-button',
  'text-button',
  'table-button',
  'status-chip',
  'widget-badge',
  'rank-chip',
  'side-buy',
  'side-sell',
  'toggle-input',
];
for (const path of uiSourcePaths) {
  for (const className of legacyUiClasses) forbidText(path, className);
}

for (const path of ['src/components/ui/layout.tsx', ...pagePaths]) {
  forbidText(path, 'eyebrow');
  forbidText(path, 'ui-eyebrow');
}

for (const [path, required] of [
  ['index.html', ['viewport-fit=cover']],
  ['src/config/navigation.ts', [
    "label: '概览'", "label: '市场'", "label: '生产'", "label: '资金'", "label: '排行'", "label: '设置'",
  ]],
  ['src/components/ui/layout.tsx', [
    'export function Button',
    'export function StatusTag',
    'export function MetricCard',
    'export function DataList',
    'export function DataRow',
    'export function ToggleField',
    'export function ScrollableTable',
    'export function EmptyState',
    '<h1>{title}</h1>',
    '<h2>{title}</h2>',
  ]],
  ['src/app/LoginPage.tsx', ['<Button', 'role="alert"']],
  ['src/components/shell/DesktopSidebar.tsx', ['<Button', '服务器权威经济', '<span title={displayName}>{displayName}</span>']],
  ['src/components/shell/GameShell.tsx', ['playerName={model.game.playerName}', '<DesktopSidebar', '<MobileBottomNavigation']],
  ['src/components/shell/NavigationItems.tsx', ["id === 'market' && openOrderCount > 0"]],
  ['src/components/shell/StatusBar.tsx', ['items.map', 'compactValue']],
  ['src/pages/OverviewPage.tsx', [
    '<Button', '<StatusTag', '<MetricCard', '<DataList',
    'blockedFacilities', 'pendingPlans', 'game.products.map',
    "setTab('market')", "setTab('assets')", 'localTrades', '当前浏览器最近成交',
  ]],
  ['src/pages/MarketPage.tsx', [
    'function aggregateOrderBook',
    'level.remaining += order.remaining',
    'level.orderCount += 1',
    "aggregateOrderBook(derived.bids, 'buy')",
    "aggregateOrderBook(derived.asks, 'sell')",
    'selectedProductId',
    'game.products.map',
    'derived.ownSelectedOpenOrders',
    'derived.ownOpenOrders',
    'cancelOrder(order.id)',
    '我的订单与成交',
    '冻结资金',
    '冻结商品',
    '本地成交记录',
    'localTrades.map',
    '仅保存在当前浏览器',
    '<Button', '<StatusTag', '<MetricCard', '<ScrollableTable', 'className="ui-segmented"',
  ]],
  ['src/pages/ProductionPage.tsx', [
    'game.facilityTypes.map',
    'setProductionPlan',
    'stopFacility',
    'productionMode',
    'targetQuantity',
    'inputProductId',
    '<Button', '<StatusTag', '<DataList', 'className="facility-specs ui-spec-grid"',
  ]],
  ['src/pages/AssetsPage.tsx', [
    'title="资金与资产"',
    'game.products.map',
    'game.inventories',
    'localAssetEvents',
    'clearLocalActivity',
    '本地资金与资产变动',
    '这些记录不上传服务器',
    'event.inventoryChanges',
    'event.facilityChanges',
    'event.productionChanges',
    'event.frozenCashDelta',
    'asset-event-filters',
    'product-asset-grid',
    '<Button', '<MetricCard', '<DataList', '<StatusTag',
  ]],
  ['src/pages/LeaderboardPage.tsx', ['<MetricCard', '<StatusTag', 'className="numeric-cell"']],
  ['src/pages/SettingsPage.tsx', [
    '工厂总数', '运行中工厂', '仓库使用',
    '<Button', '<ToggleField', '<DataList', 'className="ui-link"',
  ]],
  ['src/app/gameViewModel.ts', [
    'localAssetEvents',
    'localTrades',
    'syncLocalActivity',
    'loadLocalActivity',
    'clearLocalActivityStore',
    "runAction('placeOrder'",
    "runAction('cancelOrder'",
  ]],
  ['src/utils/localActivityStore.ts', [
    'window.localStorage',
    'syncLocalActivity',
    'loadLocalActivity',
    'clearLocalActivity',
    'snapshotState',
    'MAX_ASSET_EVENTS',
    'MAX_TRADES',
    'Local logs are optional and must never block authoritative game actions',
  ]],
  ['src/types.ts', [
    'version: 7;',
    'export interface AssetEvent',
    'export interface TradeRecord',
    'localOnly: true;',
    'Never included in EconomyState or persisted by the API',
  ]],
  ['server/src/storage.js', [
    "this.database.exec('BEGIN IMMEDIATE')",
    'stripPlayerLogs',
    'version: 7',
    'trades: _serverTrades',
    'ledger: _serverLedger',
    'assetEvents: _serverAssetEvents',
  ]],
  ['server/src/asset-events.js', [
    'export function stripPlayerLogs',
    'delete player.trades',
    'delete player.ledger',
    'delete player.assetEvents',
    'called immediately before every SQLite write',
  ]],
  ['server/test/asset-events.test.js', [
    'client state version 7 excludes all player log arrays',
    'actions update authoritative state without writing player logs to SQLite',
    'legacy server logs are removed during the next state load',
    'idempotency preserves authoritative response without creating server logs',
  ]],
  ['src/styles/desktop-sidebar.css', ['text-overflow: ellipsis', 'margin-top: var(--space-3)']],
  ['src/styles/mobile-status-navigation.css', [
    '--mobile-chrome-inset: 1rem',
    '--mobile-content-inset: .4rem',
    '--mobile-asset-bar-height: 56px',
    '--mobile-nav-height: 76px',
    'overscroll-behavior-x: auto',
    'overscroll-behavior: contain',
  ]],
  ['src/styles/mobile-status-layout.css', [
    'safe-area-inset-top',
    'safe-area-inset-left',
    'safe-area-inset-right',
    'grid-auto-columns: minmax(max-content, 1fr)',
    'justify-content: center',
  ]],
  ['src/styles/industry-system.css', [
    '.product-tabs',
    '.product-tab.active',
    '.production-plan-card',
    '.production-plan-controls',
    '.product-asset-grid',
    '@media (max-width: 1220px)',
    '@media (max-width: 960px) and (min-width: 721px)',
    '@media (max-width: 720px)',
  ]],
  ['src/styles/market-funds.css', [
    '.inline-order-list',
    '.market-account-summary',
    '.market-account-grid',
    '.funds-summary-grid',
    '.asset-event-filters',
    '.asset-event-list',
    '.asset-event-card',
  ]],
  ['src/styles/card-system.css', ['var(--radius-card)', 'var(--radius-card-mobile)']],
  ['src/styles/globals.css', [
    'background: var(--gradient-page)',
    'gap: var(--layout-gutter)',
    'width: min(var(--content-max-width), 100%)',
  ]],
  ['docs/INDUSTRY_AND_PRODUCTION_DESIGN.md', [
    '玩家持有工厂数量不设上限',
    '持续生产和定量生产',
    '不同商品订单不得互相撮合',
  ]],
  ['docs/MARKET_AND_ASSET_INFORMATION_ARCHITECTURE.md', [
    '市场负责交易行为',
    '资金负责资产结果',
    '用户可见日志只保存在浏览器本地',
    '服务器不得把以下玩家日志数组写入',
  ]],
  ['docs/LOCAL_ACTIVITY_LOG_DESIGN.md', [
    '# Economy 本地活动日志设计',
    '服务器不得持久化玩家活动日志',
    'localStorage',
    '不参与资产计算',
    '未更新本设计和防回退检查的日志存储修改不应合并',
  ]],
]) {
  for (const text of required) requireText(path, text);
}

for (const text of [
  "import './styles/desktop-sidebar.css'",
  "import './styles/mobile-pages.css'",
  "import './styles/mobile-status-layout.css'",
  "import './styles/industry-system.css'",
  "import './styles/market-funds.css'",
  "import './styles/liquid-glass-chrome.css'",
  "import './styles/design-system.css'",
]) requireText('src/main.tsx', text);
requireOrderedText('src/main.tsx', "import './styles/liquid-glass-chrome.css'", "import './styles/design-system.css'");

for (const token of [
  '--font-sans:', '--font-size-xs:', '--font-size-page:', '--color-bg-canvas:',
  '--color-surface-panel:', '--color-surface-inset:', '--color-text-primary:',
  '--color-text-muted:', '--color-border:', '--color-divider:', '--color-success:',
  '--color-warning:', '--color-danger:', '--color-info:', '--gradient-page:',
  '--gradient-panel:', '--space-1:', '--space-4:', '--space-12:',
  '--radius-control:', '--radius-card:', '--radius-card-mobile:', '--radius-pill:',
  '--shadow-panel:', '--shadow-elevated:', '--shadow-focus:', '--control-height:',
  '--motion-fast:',
]) requireText('src/styles/design-system.css', token);

for (const primitive of [
  '.ui-button--primary', '.ui-button--secondary', '.ui-button--danger',
  '.ui-button--text', '.ui-button--compact', '.ui-button--block', '.ui-link',
  'textarea', '.panel', '.ui-status-tag', '.ui-metric-card',
  '.ui-data-list', '.ui-data-row', '.ui-segmented', '.ui-spec-grid',
  '.ui-toggle-field', '.ui-switch', '.table-wrap', '.numeric-cell',
  'button:focus-visible', 'min-height: 44px',
  '@media (prefers-reduced-motion: reduce)', '@media (max-width: 1220px)',
  '@media (max-width: 960px) and (min-width: 721px)', '@media (max-width: 720px)',
]) requireText('src/styles/design-system.css', primitive);

for (const [path, required] of [
  ['src/api/game.ts', [
    "const GAME_API_BASE = '/economy-api/game'",
    "headers.set('Idempotency-Key', createRequestKey())",
    'buildFacility: (facilityTypeId: string)',
    'setProductionPlan:',
    'productId: string',
    '/stop',
    '/plan',
  ]],
  ['server/src/domain.js', [
    'export const PRODUCT_CATALOG',
    'export const FACILITY_TYPE_CATALOG',
    "{ id: 'grain'", "{ id: 'ore'", "{ id: 'flour'", "{ id: 'steel'", "{ id: 'food'", "{ id: 'machinery'",
    "id: 'farm'", "id: 'mine'", "id: 'mill'", "id: 'steelworks'", "id: 'food-factory'", "id: 'machine-factory'",
    'export function migrateWorld',
    "case 'setProductionPlan'",
    "case 'placeOrder'",
    "case 'buyFacility'",
    'order.productId === incoming.productId',
    "facility.productionMode === 'target'",
    'delete player.facilitySlots',
  ]],
  ['server/test/domain.test.js', [
    'different products never match',
    'facility ownership has no slot limit',
    'target production plan stops',
    'processing facilities consume input inventory',
    'does not restart automatically',
    'manual stop settles completed cycles',
    'version 1 state migrates',
  ]],
  ['deploy/nginx/game.riversoft.top.economy-location.conf', ['proxy_pass http://127.0.0.1:3002/api/game/;']],
  ['package.json', ['"server:test": "node --test server/test/*.test.js"']],
]) {
  for (const text of required) requireText(path, text);
}

const router = read('src/pages/PageRouter.tsx');
for (const page of pages) {
  const component = page.replace('.tsx', '');
  if (!router.includes(component)) failures.push(`PageRouter 未接入 ${component}`);
}

if (failures.length > 0) {
  console.error('界面、产业、市场资产与本地日志架构验证失败:\n- ' + failures.join('\n- '));
  process.exit(1);
}

console.log('架构验证通过：服务器权威状态、本地活动日志、多商品市场和统一 UI 均满足项目基线。');
