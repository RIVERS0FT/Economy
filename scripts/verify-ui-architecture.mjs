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
  'RecordsPage.tsx',
  'SettingsPage.tsx',
];
const pagePaths = pages.map((page) => `src/pages/${page}`);
const uiSourcePaths = ['src/app/LoginPage.tsx', 'src/components/shell/DesktopSidebar.tsx', ...pagePaths];

[
  'src/app/App.tsx',
  'src/app/GameApp.tsx',
  'src/app/LoginPage.tsx',
  'src/app/gameViewModel.ts',
  'src/api/game.ts',
  'src/config/economy.ts',
  'src/components/shell/GameShell.tsx',
  'src/components/shell/DesktopSidebar.tsx',
  'src/components/shell/MobileBottomNavigation.tsx',
  'src/components/shell/StatusBar.tsx',
  'src/components/ui/layout.tsx',
  'src/config/navigation.ts',
  'src/config/labels.ts',
  'src/pages/PageRouter.tsx',
  'src/styles/design-system.css',
  'src/styles/globals.css',
  'src/styles/auth.css',
  'src/styles/card-system.css',
  'src/styles/desktop-sidebar.css',
  'src/styles/mobile-pages.css',
  'src/styles/mobile-status-navigation.css',
  'src/styles/mobile-status-layout.css',
  'docs/UI_DESIGN_SYSTEM.md',
  'server/src/index.js',
  'server/src/domain.js',
  'server/src/storage.js',
  'server/src/auth.js',
  'server/test/domain.test.js',
  'scripts/install-economy-api.py',
  ...pagePaths,
].forEach(requireFile);

forbidFile('src/store/gameStore.ts');

if (read('src/App.tsx').trim() !== "export { default } from './app/App';") {
  failures.push('src/App.tsx 必须只导出新的应用入口');
}

for (const [path, forbidden] of [
  ['src/main.tsx', ['MutationObserver', 'querySelector', 'textContent']],
  ['src/styles/mobile-status-navigation.css', ['nth-child']],
  ['src/styles/viewport.css', ['--mobile-chrome-surface-transparent', 'backdrop-filter: none']],
  ['src/styles/card-system.css', ['--card-radius:', '--radius-card:']],
  ['src/config/navigation.ts', ['主页面', '排行榜', '订单与记录']],
  ['src/pages/MarketPage.tsx', ['<small>{order.ownerName}</small>']],
  ['src/components/shell/DesktopSidebar.tsx', ['市场交易版', 'player-mini-card', 'player-avatar', 'rank?: number']],
  ['src/app/gameViewModel.ts', ['localStorage', 'useGameStore']],
  ['src/utils/runtimePerformance.ts', ['useGameStore']],
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

const visibleEnglish = [
  'Player command center', 'Basic work', 'Market pulse', 'Recent activity',
  'Unified market', 'Limit order', 'Order book', 'Price history',
  'Facility listings', 'Production assets', 'Build facility', 'Portfolio',
  'Allocation', 'Valuation', 'Economy flow', 'Asset activity',
  'Wealth competition', 'Orders and records', 'Open orders', 'Frozen assets',
  'Trade history', 'Audit ledger', 'Preferences', 'Player profile',
  'Game settings', 'Account status', 'Preview data', 'name@example.com', 'K / M',
];
for (const path of ['src/app/LoginPage.tsx', ...pagePaths]) {
  for (const text of visibleEnglish) forbidText(path, text);
}

for (const path of ['src/components/ui/layout.tsx', ...pagePaths]) {
  forbidText(path, 'className="eyebrow"');
}

for (const [path, required] of [
  ['index.html', ['viewport-fit=cover']],
  ['src/config/navigation.ts', ["label: '概览'", "label: '排行'", "label: '订单'"]],
  ['src/config/labels.ts', ["system: '系统调整'"]],
  ['src/pages/AssetsPage.tsx', ['ledgerCategoryNames[entry.category]']],
  ['src/pages/RecordsPage.tsx', ['ledgerCategoryNames[entry.category]']],
  ['src/pages/MarketPage.tsx', [
    'function aggregateOrderBook',
    'level.remaining += order.remaining',
    'level.orderCount += 1',
    "aggregateOrderBook(derived.bids, 'buy')",
    "aggregateOrderBook(derived.asks, 'sell')",
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
    'className="ui-eyebrow"',
    '<h1>{title}</h1>',
    '<h2>{title}</h2>',
  ]],
  ['src/app/LoginPage.tsx', ['<Button', 'role="alert"']],
  ['src/components/shell/DesktopSidebar.tsx', ['<Button', 'variant="secondary"', '服务器权威经济', '<span title={displayName}>{displayName}</span>']],
  ['src/pages/OverviewPage.tsx', ['<Button', '<StatusTag', '<MetricCard', '<DataList']],
  ['src/pages/MarketPage.tsx', ['<Button', '<StatusTag', '<MetricCard', 'className="ui-segmented"']],
  ['src/pages/ProductionPage.tsx', ['<Button', '<StatusTag', '<DataList', 'className="facility-specs ui-spec-grid"']],
  ['src/pages/AssetsPage.tsx', ['<Button', '<MetricCard', '<DataList']],
  ['src/pages/LeaderboardPage.tsx', ['<MetricCard', '<StatusTag', 'className="numeric-cell"']],
  ['src/pages/RecordsPage.tsx', ['<Button', '<MetricCard', '<StatusTag', 'className="numeric-cell"']],
  ['src/pages/SettingsPage.tsx', ['<Button', '<ToggleField', '<DataList', 'className="ui-link"']],
  ['src/components/shell/GameShell.tsx', ['playerName={model.game.playerName}', '<DesktopSidebar', '<MobileBottomNavigation']],
  ['src/components/shell/StatusBar.tsx', ['items.map', 'compactValue']],
  ['src/styles/desktop-sidebar.css', ['text-overflow: ellipsis', 'margin-top: var(--space-3)']],
  ['src/styles/mobile-status-navigation.css', [
    '--mobile-chrome-inset: 1rem',
    '--mobile-content-inset: .4rem',
    '--mobile-asset-bar-height: 56px',
    '--mobile-nav-height: 76px',
    'overscroll-behavior-x: auto',
    'overscroll-behavior: contain',
    '.sidebar-nav::before',
    '.sidebar-nav::after',
  ]],
  ['src/styles/mobile-status-layout.css', [
    'safe-area-inset-top',
    'safe-area-inset-left',
    'safe-area-inset-right',
    'grid-auto-columns: minmax(max-content, 1fr)',
    'justify-content: center',
  ]],
  ['src/styles/mobile-pages.css', [
    '.production-grid',
    'grid-template-columns: minmax(0, 1fr)',
    'gap: var(--layout-gutter)',
    '.asset-bar-item-value-compact',
  ]],
  ['src/styles/card-system.css', ['var(--radius-card)', 'var(--radius-card-mobile)']],
  ['src/styles/globals.css', [
    'background: var(--gradient-page)',
    'gap: var(--layout-gutter)',
    'width: min(var(--content-max-width), 100%)',
    '.market-stat-strip .ui-metric-card',
  ]],
]) {
  for (const text of required) requireText(path, text);
}

for (const text of [
  "import './styles/desktop-sidebar.css'",
  "import './styles/mobile-pages.css'",
  "import './styles/mobile-status-layout.css'",
  "import './styles/design-system.css'",
]) requireText('src/main.tsx', text);
requireOrderedText('src/main.tsx', "import './styles/mobile-status-layout.css'", "import './styles/design-system.css'");

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
  'textarea', '.panel', '.ui-eyebrow', '.ui-status-tag', '.ui-metric-card',
  '.ui-data-list', '.ui-data-row', '.ui-segmented', '.ui-spec-grid',
  '.ui-toggle-field', '.ui-switch', '.table-wrap', '.numeric-cell',
  'button:focus-visible', 'min-height: 44px',
  '@media (prefers-reduced-motion: reduce)', '@media (max-width: 1220px)',
  '@media (max-width: 960px) and (min-width: 721px)', '@media (max-width: 720px)',
]) requireText('src/styles/design-system.css', primitive);

for (const rule of [
  '# Economy UI 设计系统',
  '迁移状态：核心页面已完成统一组件与设计令牌迁移',
  'src/styles/design-system.css',
  '## 5. 颜色系统', '## 6. 字体系统', '## 7. 间距系统',
  '## 8. 圆角系统', '## 9. 阴影系统', '## 10. 按钮',
  '## 11. 输入框与表单', '## 12. 卡片、指标卡与数据列表',
  '## 13. 状态标签', '## 14. 表格', '## 16. 响应式规则',
  'max-width: 1220px', 'max-width: 960px', 'max-width: 720px',
  '移动端可点击控件最小高度为 `44px`',
  '核心页面不得重新直接使用以下历史字符串类名',
  '未更新设计文档和架构检查的基础样式回退不应合并',
]) requireText('docs/UI_DESIGN_SYSTEM.md', rule);

for (const [path, required] of [
  ['src/api/game.ts', ["const GAME_API_BASE = '/economy-api/game'", "headers.set('Idempotency-Key', createRequestKey())"]],
  ['src/app/gameViewModel.ts', ['getGameState', 'setGame(response.state)']],
  ['src/types.ts', ['version: 4;']],
  ['server/src/storage.js', ["this.database.exec('BEGIN IMMEDIATE')"]],
  ['server/src/domain.js', ['case"placeOrder"', 'case"buyFacility"']],
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
  console.error('界面架构验证失败:\n- ' + failures.join('\n- '));
  process.exit(1);
}

console.log('架构验证通过：服务器权威边界与统一 UI 组件、令牌和布局分层均满足项目基线。');