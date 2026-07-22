import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const failures = [];
const requireFile = (path) => { if (!existsSync(resolve(root, path))) failures.push(`缺少文件: ${path}`); };
const requireText = (path, text) => { if (!read(path).includes(text)) failures.push(`${path} 缺少: ${text}`); };
const forbidText = (path, text) => { if (read(path).includes(text)) failures.push(`${path} 不应包含: ${text}`); };

const iconPath = 'src/components/icons/GameIcons.tsx';
const productIconPath = 'src/components/icons/ProductIcons.tsx';
const navigationItemsPath = 'src/components/shell/NavigationItems.tsx';
const navigationConfigPath = 'src/config/navigation.ts';
const iconStylePath = 'src/styles/icon-system.css';
const mobileNavigationStylePath = 'src/styles/mobile-status-navigation.css';
const marketPagePath = 'src/pages/MarketPage.tsx';

[
  'src/components/ui/layout.tsx',
  'src/pages/ProductionPage.tsx',
  'src/pages/SettingsPage.tsx',
  marketPagePath,
  'src/styles/design-system.css',
  'src/styles/globals.css',
  'src/styles/unified-market-admin.css',
  mobileNavigationStylePath,
  iconPath,
  productIconPath,
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
const productIcons = read(productIconPath);
const navigationItems = read(navigationItemsPath);
const navigationConfig = read(navigationConfigPath);
const iconStyles = read(iconStylePath);
const mobileNavigationStyles = read(mobileNavigationStylePath);
const marketPage = read(marketPagePath);

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
  'export function FactoryIcon',
  'export function FundsIcon',
  'export function LeaderboardIcon',
  'export function SettingsIcon',
  'export function NavigationIcon',
]) {
  if (!icons.includes(text)) failures.push(`${iconPath} 缺少: ${text}`);
}

const factoryBlock = icons.match(/export function FactoryIcon[\s\S]*?\r?\n}\r?\n\r?\nexport function FundsIcon/)?.[0] ?? '';
if (!factoryBlock.includes('M3 20V10') || !factoryBlock.includes('M17 6V3h3v17')) {
  failures.push('FactoryIcon 必须保持厂房与烟囱轮廓');
}
const machineryBlock = productIcons.match(/case 'machinery':[\s\S]*?case 'electronics':/)?.[0] ?? '';
if (!machineryBlock.includes('<circle cx="12" cy="12" r="3.2" />')) {
  failures.push('机械商品必须保持齿轮机械轮廓');
}
if (factoryBlock.includes('<circle cx="12" cy="12" r="3.2" />') || machineryBlock.includes('M17 6V3h3v17')) {
  failures.push('工厂图标不得与机械商品图标共用轮廓');
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
requireText(navigationConfigPath, "{ id: 'assets', label: '资产' }");
forbidText(navigationConfigPath, "{ id: 'assets', label: '资金' }");

for (const text of [
  '.game-icon {',
  '.sidebar-nav-button > span > .game-icon',
  '.asset-bar-item-icon > .game-icon',
  '.mobile-bottom-navigation .sidebar-nav-button > span > .game-icon',
]) {
  if (!iconStyles.includes(text)) failures.push(`${iconStylePath} 缺少: ${text}`);
}

for (const text of [
  '.sidebar-nav-button {',
  'color: var(--color-text-muted);',
  'opacity: 1;',
  '.sidebar-nav-button > span,',
  '.sidebar-nav-button strong {',
  'color: inherit;',
  '.sidebar-nav-button.active {',
  'color: var(--color-text-primary);',
  '.sidebar-nav-button.active > span {',
  'color: var(--color-success);',
]) requireText(mobileNavigationStylePath, text);

const mobileNavButtonBlock = mobileNavigationStyles.match(/\.mobile-bottom-navigation \.sidebar-nav-button\s*\{[^{}]*\}/)?.[0] ?? '';
if (!mobileNavButtonBlock.includes('color: var(--color-text-muted)') || !mobileNavButtonBlock.includes('opacity: 1')) {
  failures.push('移动导航未选中图标与文字必须为完全不透明灰色');
}
const mobileNavLabelBlock = mobileNavigationStyles.match(/\.mobile-bottom-navigation \.sidebar-nav-button strong\s*\{[^{}]*\}/)?.[0] ?? '';
if (!mobileNavLabelBlock.includes('color: inherit') || !mobileNavLabelBlock.includes('opacity: 1')) {
  failures.push('移动导航文字必须继承完全不透明状态色');
}
const mobileNavIconBlock = mobileNavigationStyles.match(/\.mobile-bottom-navigation \.sidebar-nav-button > span\s*\{[^{}]*\}/)?.[0] ?? '';
if (!mobileNavIconBlock.includes('color: inherit') || !mobileNavIconBlock.includes('opacity: 1')) {
  failures.push('移动导航图标必须继承完全不透明状态色');
}

for (const legacyOpacity of [
  'rgba(194, 211, 201, .62)',
  'rgba(194, 211, 201, .68)',
  'opacity: .62',
  'opacity: .68',
]) {
  if (mobileNavigationStyles.includes(legacyOpacity)) failures.push(`导航不得恢复半透明图标或文字: ${legacyOpacity}`);
}

for (const text of [
  "from '../components/icons/GameIcons'",
  'FactoryIcon',
  '<span className="asset-kind-icon" aria-hidden="true"><FactoryIcon /></span>',
]) requireText(marketPagePath, text);
for (const forbidden of ['>⚙</span>', '<ProductIcon productId="machinery" />']) {
  if (marketPage.includes(forbidden)) failures.push(`市场工厂标签不得使用机械或字符图标: ${forbidden}`);
}

requireText('src/main.tsx', "import './styles/icon-system.css'");

for (const text of [
  '统一 SVG 图标',
  '商品物资插画图标绘制规范',
  '`src/assets/product-icons/`',
  '写实与游戏插画融合的 3D 手绘风格',
  '轻微俯视的三分之四视角、居中悬浮构图',
  '主体约占画布 75%',
  '柔和暖色主光从左上方照射',
  '非常柔和的半透明接触阴影',
  '`1024 × 1024`、PNG RGBA 和真实 Alpha 透明通道',
  '`src/components/icons/GameIcons.tsx`',
  '不得继续使用 Unicode 字符、Emoji 或字体符号作为图标',
  '导航配置只保存 `id` 与中文 `label`',
  '桌面侧栏和移动底栏复用同一套导航 SVG',
  '工厂资产标签必须使用 `GameIcons.tsx` 的 `FactoryIcon`',
  '`FactoryIcon` 使用厂房与烟囱轮廓',
  '导航颜色与不透明度',
  '未选中状态使用完全不透明的 `var(--color-text-muted)` 灰色',
  '图标继承按钮颜色，不得为未选中图标另设半透明 RGBA',
  '在导航或状态栏中恢复 Unicode 字符、Emoji 或字体符号图标',
  '绕过 `GameIcons.tsx` 新增平行界面图标库',
]) requireText('docs/UI_DESIGN_SYSTEM.md', text);

if (failures.length) {
  console.error(`UI 架构、统一开关、焦点环、导航不透明度与 SVG 图标验证失败:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}

console.log('共享 UI、唯一开关、导航完全不透明状态色、独立工厂 SVG 与统一商品图标验证通过。');
