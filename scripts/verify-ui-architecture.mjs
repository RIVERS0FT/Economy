import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const failures = [];
const requireFile = (path) => { if (!existsSync(resolve(root, path))) failures.push(`缺少文件: ${path}`); };
const requireText = (path, text) => { if (!read(path).includes(text)) failures.push(`${path} 缺少: ${text}`); };
const forbidText = (path, text) => { if (read(path).includes(text)) failures.push(`${path} 不应包含: ${text}`); };

const iconPath = 'src/components/icons/GameIcons.tsx';
const navigationItemsPath = 'src/components/shell/NavigationItems.tsx';
const navigationConfigPath = 'src/config/navigation.ts';
const iconStylePath = 'src/styles/icon-system.css';

[
  'src/components/ui/layout.tsx',
  'src/pages/ProductionPage.tsx',
  'src/pages/SettingsPage.tsx',
  'src/styles/design-system.css',
  'src/styles/globals.css',
  'src/styles/unified-market-admin.css',
  iconPath,
  navigationItemsPath,
  navigationConfigPath,
  iconStylePath,
  'src/main.tsx',
  'docs/UI_DESIGN_SYSTEM.md',
].forEach(requireFile);

if (existsSync(resolve(root, 'src/components/icons/StatusIcons.tsx'))) {
  failures.push('旧 StatusIcons.tsx 不应与统一 GameIcons.tsx 并存');
}

const sharedLayout = read('src/components/ui/layout.tsx');
const productionPage = read('src/pages/ProductionPage.tsx');
const settingsPage = read('src/pages/SettingsPage.tsx');
const designSystem = read('src/styles/design-system.css');
const businessStyles = read('src/styles/unified-market-admin.css');
const icons = read(iconPath);
const navigationItems = read(navigationItemsPath);
const navigationConfig = read(navigationConfigPath);
const iconStyles = read(iconStylePath);

for (const text of [
  'export function PageLayout',
  'export function Panel',
  'export function Button',
  'export function StatusTag',
  'export function SwitchControl',
  "classNames('ui-switch', className)",
  '<SwitchControl aria-label={label}',
]) requireText('src/components/ui/layout.tsx', text);

requireText('src/pages/ProductionPage.tsx', '<SwitchControl');
requireText('src/pages/SettingsPage.tsx', '<ToggleField');

for (const forbidden of [
  'facility-power-button',
  'factory-switch',
  'music-switch',
  'production-toggle',
  'toggle-input',
]) {
  if ((productionPage + settingsPage + businessStyles).includes(forbidden)) {
    failures.push(`业务页面或业务样式不应包含专属开关实现: ${forbidden}`);
  }
}

const switchAuthorityCount = (designSystem.match(/\.ui-switch\s*\{/g) || []).length;
if (switchAuthorityCount !== 1) failures.push(`.ui-switch 基础视觉定义数量应为 1，当前为 ${switchAuthorityCount}`);
for (const text of ['.ui-switch::before', '.ui-switch:checked', '.ui-switch:checked::before', ':focus-visible']) {
  if (!designSystem.includes(text)) failures.push(`design-system.css 缺少: ${text}`);
}

for (const selector of ['.ui-switch', 'input[type="checkbox"]']) {
  forbidText('src/styles/globals.css', selector);
  forbidText('src/styles/unified-market-admin.css', selector);
}

for (const text of ['SwitchControl', '.ui-switch', '唯一 React 基础组件', '不得新增']) {
  requireText('docs/UI_DESIGN_SYSTEM.md', text);
}

for (const text of [
  '.ui-switch:focus {',
  '.ui-switch:focus-visible {',
  '.ui-switch:focus-visible::before {',
  'outline-offset: 2px;',
]) requireText('src/styles/design-system.css', text);
for (const text of ['开关焦点环与点击区域', '44 × 44px', '轨道伪元素外侧', '额外的大圆环']) {
  requireText('docs/UI_DESIGN_SYSTEM.md', text);
}

for (const text of [
  "className={className ? `game-icon ${className}` : 'game-icon'}",
  'viewBox="0 0 24 24"',
  'stroke="currentColor"',
  'strokeWidth={1.9}',
  'aria-hidden="true"',
  'focusable="false"',
  'export function CreditsIcon',
  'export function AssetsIcon',
  'export function RankIcon',
  'export function WarehouseIcon',
  'export function HomeIcon',
  'export function MarketIcon',
  'export function ProductionIcon',
  'export function FundsIcon',
  'export function LeaderboardIcon',
  'export function SettingsIcon',
  'export function NavigationIcon',
]) {
  if (!icons.includes(text)) failures.push(`${iconPath} 缺少: ${text}`);
}

for (const text of [
  "import { NavigationIcon } from '../icons/GameIcons'",
  '<NavigationIcon name={id} />',
  'navigationItems.map(({ id, label })',
]) {
  if (!navigationItems.includes(text)) failures.push(`${navigationItemsPath} 缺少: ${text}`);
}

for (const legacyIcon of ['⌂', '↕', '⚙', '◫', '♛', 'icon:']) {
  if (navigationConfig.includes(legacyIcon)) failures.push(`${navigationConfigPath} 不得包含字符图标: ${legacyIcon}`);
}

for (const text of [
  '.game-icon {',
  '.sidebar-nav-button > span > .game-icon',
  '.asset-bar-item-icon > .game-icon',
  '.mobile-bottom-navigation .sidebar-nav-button > span > .game-icon',
]) {
  if (!iconStyles.includes(text)) failures.push(`${iconStylePath} 缺少: ${text}`);
}

requireText('src/main.tsx', "import './styles/icon-system.css'");

for (const text of [
  '统一 SVG 图标',
  '`src/components/icons/GameIcons.tsx`',
  '不得继续使用 Unicode 字符、Emoji 或字体符号作为图标',
  '导航配置只保存 `id` 与中文 `label`',
  '桌面侧栏和移动底栏复用同一套导航 SVG',
  '在导航或状态栏中恢复 Unicode 字符、Emoji 或字体符号图标',
  '绕过 `GameIcons.tsx` 新增平行界面图标库',
]) requireText('docs/UI_DESIGN_SYSTEM.md', text);

if (failures.length) {
  console.error(`UI 架构、统一开关、焦点环与 SVG 图标验证失败:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}

console.log('共享 UI 组件、唯一开关视觉、轨道焦点环与统一 SVG 图标验证通过。');
