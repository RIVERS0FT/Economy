import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const failures = [];

function requireFile(path) {
  if (!existsSync(resolve(root, path))) failures.push(`缺少文件: ${path}`);
}

function requireText(path, text) {
  if (!read(path).includes(text)) failures.push(`${path} 缺少: ${text}`);
}

function forbidText(path, text) {
  if (read(path).includes(text)) failures.push(`${path} 不应包含: ${text}`);
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
  'src/components/shell/GameShell.tsx',
  'src/components/shell/DesktopSidebar.tsx',
  'src/components/shell/MobileBottomNavigation.tsx',
  'src/components/shell/StatusBar.tsx',
  'src/components/ui/layout.tsx',
  'src/config/navigation.ts',
  'src/config/labels.ts',
  'src/pages/PageRouter.tsx',
  'src/styles/mobile-pages.css',
  'src/styles/mobile-status-layout.css',
  ...pages.map((page) => `src/pages/${page}`),
].forEach(requireFile);

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
forbidText('src/config/navigation.ts', '主页面');
forbidText('src/config/navigation.ts', '排行榜');
forbidText('src/config/navigation.ts', '订单与记录');

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
requireText('src/components/ui/layout.tsx', '<h1>{title}</h1>');
requireText('src/components/ui/layout.tsx', '<h2>{title}</h2>');
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
requireText('src/main.tsx', "import './styles/mobile-pages.css'");
requireText('src/main.tsx', "import './styles/mobile-status-layout.css'");

const router = read('src/pages/PageRouter.tsx');
for (const page of pages) {
  const component = page.replace('.tsx', '');
  if (!router.includes(component)) failures.push(`PageRouter 未接入 ${component}`);
}

if (failures.length > 0) {
  console.error('界面架构验证失败:\n- ' + failures.join('\n- '));
  process.exit(1);
}

console.log('界面架构验证通过：页面和卡片均无绿色眉题，中文界面、全面屏状态栏、组件拆分、移动端布局和滚动职责均符合设计文档。');
