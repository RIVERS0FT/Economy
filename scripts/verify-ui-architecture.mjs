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
  'src/styles/desktop-sidebar.css',
  'src/styles/mobile-pages.css',
  'src/styles/mobile-status-layout.css',
  'docs/UI_DESIGN_SYSTEM.md',
  'server/src/index.js',
  'server/src/domain.js',
  'server/src/storage.js',
  'server/src/auth.js',
  'server/test/domain.test.js',
  'scripts/install-economy-api.py',
  ...pages.map((page) => `src/pages/${page}`),
].forEach(requireFile);

forbidFile('src/store/gameStore.ts');

const rootApp = read('src/App.tsx').trim();
if (rootApp !== "export { default } from './app/App';") {
  failures.push('src/App.tsx 必须只导出新的应用入口');
}

forbidText('src/main.tsx', 'MutationObserver');
forbidText('src/main.tsx', 'querySelector');
forbidText('src/main.tsx', 'textContent');
forbidText('src/styles/mobile-status-navigation.css', 'nth-child');
forbidText('src/styles/viewport.css', '--mobile-chrome-surface-transparent');
forbidText('src/styles/viewport.css', 'backdrop-filter: none');
forbidText('src/styles/globals.css', 'bottom: .35rem');
forbidText('src/styles/card-system.css', '--card-radius:');
forbidText('src/styles/card-system.css', '--radius-card:');
forbidText('src/config/navigation.ts', '主页面');
forbidText('src/config/navigation.ts', '排行榜');
forbidText('src/config/navigation.ts', '订单与记录');
forbidText('src/pages/MarketPage.tsx', '<small>{order.ownerName}</small>');
forbidText('src/components/shell/DesktopSidebar.tsx', '市场交易版');
forbidText('src/components/shell/DesktopSidebar.tsx', 'player-mini-card');
forbidText('src/components/shell/DesktopSidebar.tsx', 'player-avatar');
forbidText('src/components/shell/DesktopSidebar.tsx', 'rank?: number');
forbidText('src/app/gameViewModel.ts', 'localStorage');
forbidText('src/app/gameViewModel.ts', 'useGameStore');
forbidText('src/utils/runtimePerformance.ts', 'useGameStore');

const visibleEnglish = [
  'Player command center',
  'Basic work',
  'Market pulse',
  'Recent activity',
  'Unified market',
  'Limit order',
  'Order book',
  'Price history',
  'Facility listings',
  'Production assets',
  'Build facility',
  'Portfolio',
  'Allocation',
  'Valuation',
  'Economy flow',
  'Asset activity',
  'Wealth competition',
  'Orders and records',
  'Open orders',
  'Frozen assets',
  'Trade history',
  'Audit ledger',
  'Preferences',
  'Player profile',
  'Game settings',
  'Account status',
  'Preview data',
  'name@example.com',
  'K / M',
];

for (const path of ['src/app/LoginPage.tsx', ...pages.map((page) => `src/pages/${page}`)]) {
  for (const text of visibleEnglish) forbidText(path, text);
}

for (const path of ['src/components/ui/layout.tsx', ...pages.map((page) => `src/pages/${page}`)]) {
  forbidText(path, 'className="eyebrow"');
}

requireText('index.html', 'viewport-fit=cover');
requireText('src/config/navigation.ts', "label: '概览'");
requireText('src/config/navigation.ts', "label: '排行'");
requireText('src/config/navigation.ts', "label: '订单'");
requireText('src/config/labels.ts', "system: '系统调整'");
requireText('src/pages/AssetsPage.tsx', 'ledgerCategoryNames[entry.category]');
requireText('src/pages/RecordsPage.tsx', 'ledgerCategoryNames[entry.category]');
requireText('src/pages/MarketPage.tsx', 'function aggregateOrderBook');
requireText('src/pages/MarketPage.tsx', 'level.remaining += order.remaining');
requireText('src/pages/MarketPage.tsx', 'level.orderCount += 1');
requireText('src/pages/MarketPage.tsx', "aggregateOrderBook(derived.bids, 'buy')");
requireText('src/pages/MarketPage.tsx', "aggregateOrderBook(derived.asks, 'sell')");
requireText('src/components/ui/layout.tsx', '<h1>{title}</h1>');
requireText('src/components/ui/layout.tsx', '<h2>{title}</h2>');
requireText('src/components/ui/layout.tsx', 'className="ui-eyebrow"');
requireText('src/components/ui/layout.tsx', 'export function StatusTag');
requireText('src/components/ui/layout.tsx', 'status-${tone}');
requireText('src/components/shell/DesktopSidebar.tsx', '<span title={displayName}>{displayName}</span>');
requireText('src/components/shell/GameShell.tsx', 'playerName={model.game.playerName}');
requireText('src/styles/desktop-sidebar.css', 'text-overflow: ellipsis');
requireText('src/styles/desktop-sidebar.css', 'margin-top: .85rem');
requireText('src/components/shell/StatusBar.tsx', 'items.map');
requireText('src/components/shell/StatusBar.tsx', 'compactValue');
requireText('src/components/shell/GameShell.tsx', '<DesktopSidebar');
requireText('src/components/shell/GameShell.tsx', '<MobileBottomNavigation');
requireText('src/styles/mobile-status-navigation.css', '--mobile-chrome-inset: 1rem');
requireText('src/styles/mobile-status-navigation.css', '--mobile-content-inset: .4rem');
requireText('src/styles/mobile-status-navigation.css', '--mobile-asset-bar-height: 56px');
requireText('src/styles/mobile-status-navigation.css', '--mobile-nav-height: 76px');
requireText('src/styles/mobile-status-navigation.css', 'overscroll-behavior-x: auto');
requireText('src/styles/mobile-status-navigation.css', 'overscroll-behavior: contain');
requireText('src/styles/mobile-status-navigation.css', '.sidebar-nav::before');
requireText('src/styles/mobile-status-navigation.css', '.sidebar-nav::after');
requireText('src/styles/mobile-status-layout.css', 'safe-area-inset-top');
requireText('src/styles/mobile-status-layout.css', 'safe-area-inset-left');
requireText('src/styles/mobile-status-layout.css', 'safe-area-inset-right');
requireText('src/styles/mobile-status-layout.css', 'grid-auto-columns: minmax(max-content, 1fr)');
requireText('src/styles/mobile-status-layout.css', 'justify-content: center');
requireText('src/styles/mobile-pages.css', '.production-grid');
requireText('src/styles/mobile-pages.css', 'grid-template-columns: minmax(0, 1fr)');
requireText('src/styles/mobile-pages.css', '.asset-bar-item-value-compact');
requireText('src/main.tsx', "import './styles/desktop-sidebar.css'");
requireText('src/main.tsx', "import './styles/mobile-pages.css'");
requireText('src/main.tsx', "import './styles/mobile-status-layout.css'");
requireText('src/main.tsx', "import './styles/design-system.css'");
requireOrderedText(
  'src/main.tsx',
  "import './styles/mobile-status-layout.css'",
  "import './styles/design-system.css'",
);
requireText('src/styles/card-system.css', 'var(--radius-card)');
requireText('src/styles/card-system.css', 'var(--radius-card-mobile)');

const designSystemTokens = [
  '--font-sans:',
  '--font-size-xs:',
  '--font-size-page:',
  '--color-bg-canvas:',
  '--color-surface-panel:',
  '--color-text-primary:',
  '--color-text-muted:',
  '--color-border:',
  '--color-success:',
  '--color-warning:',
  '--color-danger:',
  '--color-info:',
  '--space-1:',
  '--space-4:',
  '--space-12:',
  '--radius-control:',
  '--radius-card:',
  '--radius-card-mobile:',
  '--radius-pill:',
  '--shadow-panel:',
  '--shadow-elevated:',
  '--shadow-focus:',
  '--control-height:',
  '--motion-fast:',
];
for (const token of designSystemTokens) requireText('src/styles/design-system.css', token);

const designSystemPrimitives = [
  '.ui-button',
  '.ghost-button',
  '.danger-button',
  '.text-button',
  '.table-button',
  'textarea',
  '.panel',
  '.ui-eyebrow',
  '.ui-status-tag',
  '.status-success',
  '.status-warning',
  '.status-danger',
  '.status-info',
  '.table-wrap',
  'button:focus-visible',
  'min-height: 44px',
  '@media (prefers-reduced-motion: reduce)',
  '@media (max-width: 1220px)',
  '@media (max-width: 960px) and (min-width: 721px)',
  '@media (max-width: 720px)',
];
for (const primitive of designSystemPrimitives) requireText('src/styles/design-system.css', primitive);

const designDocumentRules = [
  '# Economy UI 设计系统',
  'src/styles/design-system.css',
  '## 4. 颜色系统',
  '## 5. 字体系统',
  '## 6. 间距系统',
  '## 7. 圆角系统',
  '## 8. 阴影系统',
  '## 9. 按钮',
  '## 10. 输入框与表单',
  '## 11. 卡片与面板',
  '## 12. 状态标签',
  '## 13. 表格',
  '## 15. 响应式规则',
  'max-width: 1220px',
  'max-width: 960px',
  'max-width: 720px',
  '移动端可点击控件最小高度为 `44px`',
  '未更新设计文档和架构检查的基础样式回退不应合并',
];
for (const rule of designDocumentRules) requireText('docs/UI_DESIGN_SYSTEM.md', rule);

requireText('src/api/game.ts', "const GAME_API_BASE = '/economy-api/game'");
requireText('src/api/game.ts', "headers.set('Idempotency-Key', createRequestKey())");
requireText('src/app/gameViewModel.ts', 'getGameState');
requireText('src/app/gameViewModel.ts', 'setGame(response.state)');
requireText('src/types.ts', 'version: 4;');
requireText('server/src/storage.js', "this.database.exec('BEGIN IMMEDIATE')");
requireText('server/src/domain.js', 'case"placeOrder"');
requireText('server/src/domain.js', 'case"buyFacility"');
requireText('deploy/nginx/game.riversoft.top.economy-location.conf', 'proxy_pass http://127.0.0.1:3002/api/game/;');
requireText('package.json', '"server:test": "node --test server/test/*.test.js"');

const router = read('src/pages/PageRouter.tsx');
for (const page of pages) {
  const component = page.replace('.tsx', '');
  if (!router.includes(component)) failures.push(`PageRouter 未接入 ${component}`);
}

if (failures.length > 0) {
  console.error('界面架构验证失败:\n- ' + failures.join('\n- '));
  process.exit(1);
}

console.log('架构验证通过：服务器权威边界与统一 UI 设计系统均满足项目基线。');