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
  'src/pages/PageRouter.tsx',
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

requireText('src/config/navigation.ts', "label: '概览'");
requireText('src/config/navigation.ts', "label: '排行'");
requireText('src/config/navigation.ts', "label: '订单'");
requireText('src/components/shell/StatusBar.tsx', 'items.map');
requireText('src/components/shell/GameShell.tsx', '<DesktopSidebar');
requireText('src/components/shell/GameShell.tsx', '<MobileBottomNavigation');
requireText('src/styles/mobile-status-navigation.css', '--mobile-chrome-inset: 1rem');
requireText('src/styles/mobile-status-navigation.css', '--mobile-content-inset: .4rem');
requireText('src/styles/mobile-status-navigation.css', '--mobile-asset-bar-height: 68px');
requireText('src/styles/mobile-status-navigation.css', '--mobile-nav-height: 76px');
requireText('src/styles/mobile-status-navigation.css', 'overscroll-behavior-x: auto');
requireText('src/styles/mobile-status-navigation.css', 'overscroll-behavior: contain');
requireText('src/styles/mobile-status-navigation.css', '.sidebar-nav::before');
requireText('src/styles/mobile-status-navigation.css', '.sidebar-nav::after');

const router = read('src/pages/PageRouter.tsx');
for (const page of pages) {
  const component = page.replace('.tsx', '');
  if (!router.includes(component)) failures.push(`PageRouter 未接入 ${component}`);
}

if (failures.length > 0) {
  console.error('界面架构验证失败:\n- ' + failures.join('\n- '));
  process.exit(1);
}

console.log('界面架构验证通过：组件拆分、导航配置、移动端令牌和滚动职责均符合设计文档。');
