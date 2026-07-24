import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const failures = [];
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const requireFile = (path) => {
  if (!existsSync(resolve(root, path))) failures.push(`缺少文件: ${path}`);
};
const requireText = (path, text) => {
  if (!read(path).includes(text)) failures.push(`${path} 缺少: ${text}`);
};
const forbidText = (path, text) => {
  if (read(path).includes(text)) failures.push(`${path} 不应包含: ${text}`);
};

const componentPath = 'src/components/ui/FormControls.tsx';
const draftPath = 'src/utils/integerDraft.ts';
const stylePath = 'src/styles/form-controls.css';
const navigationPath = 'src/components/shell/NavigationItems.tsx';
const sidebarStylePath = 'src/styles/desktop-sidebar.css';
const mainPath = 'src/main.tsx';
const designDocPath = 'docs/UI_DESIGN_SYSTEM.md';
const integerWheelTestPath = 'tests/browser/gem-shop-layout.spec.ts';
const sidebarBadgeTestPath = 'tests/browser/sidebar-badge.spec.ts';

[
  componentPath,
  draftPath,
  stylePath,
  navigationPath,
  sidebarStylePath,
  mainPath,
  designDocPath,
  integerWheelTestPath,
  sidebarBadgeTestPath,
  'src/app/LoginPage.tsx',
  'src/app/AdminApp.tsx',
  'src/pages/MarketPage.tsx',
  'src/pages/AuctionPage.tsx',
  'src/pages/ContractPage.tsx',
  'src/pages/GemShopPage.tsx',
  'src/pages/SettingsPage.tsx',
  'src/pages/ProductionPage.tsx',
  'src/components/InvitationSettings.tsx',
  'src/components/AdminBanPanel.tsx',
].forEach(requireFile);

for (const text of [
  'export function FormField',
  'export function TextInput',
  'export function IntegerInput',
  'export function SelectInput',
  'export function TextArea',
  'export function FileInput',
  'export function InputGroup',
  "classNames('ui-control'",
  "classNames('ui-control', 'ui-control--integer'",
  'useEffect',
  'useRef<HTMLInputElement>',
  'parseIntegerDraft',
  "input.addEventListener('wheel', handleWheel, { passive: false })",
  'event.preventDefault();',
  'event.stopPropagation();',
]) requireText(componentPath, text);

for (const text of [
  'export function parseIntegerDraft',
  'export function normalizeIntegerDraft',
  'Number.isSafeInteger',
]) requireText(draftPath, text);

for (const text of [
  '.ui-form-field',
  '.ui-control[aria-invalid="true"]',
  '.ui-control[readonly]',
  '.ui-control:disabled',
  '::file-selector-button',
  'font-size: 16px;',
  'min-height: 48px;',
  '.ui-input-group',
]) requireText(stylePath, text);

for (const text of [
  'const MAX_SIDEBAR_BADGE_COUNT = 999;',
  'className="sidebar-nav-count"',
  'aria-label={accessibleLabel}',
  'title={`${formatNumber(openOrderCount)} 笔未完成订单`}',
]) requireText(navigationPath, text);

for (const text of [
  'grid-template-columns: var(--desktop-sidebar-rail) minmax(0, 1fr) auto;',
  '.desktop-sidebar .sidebar-nav-count {',
  'position: static;',
  '.desktop-sidebar[data-collapsed="true"] .sidebar-nav-button .sidebar-nav-count {',
  '.desktop-sidebar .sidebar-nav-button .sidebar-nav-count {',
  'top: 2px;',
  'right: 2px;',
  'left: auto;',
  'transform: none;',
  '@media (max-width: 960px) and (min-width: 721px)',
]) requireText(sidebarStylePath, text);
for (const forbidden of [
  '.desktop-sidebar .sidebar-nav-button small {',
  'left: 32px;',
]) forbidText(sidebarStylePath, forbidden);

const main = read(mainPath);
const designSystemIndex = main.indexOf("import './styles/design-system.css'");
const formControlsIndex = main.indexOf("import './styles/form-controls.css'");
if (designSystemIndex < 0 || formControlsIndex < 0 || formControlsIndex < designSystemIndex) {
  failures.push('form-controls.css 必须在 design-system.css 之后加载');
}

for (const path of [
  'src/app/AdminApp.tsx',
  'src/pages/MarketPage.tsx',
  'src/pages/AuctionPage.tsx',
  'src/pages/ContractPage.tsx',
  'src/pages/GemShopPage.tsx',
]) {
  requireText(path, 'parseIntegerDraft');
  forbidText(path, 'Number(event.target.value)');
}

for (const path of [
  'src/app/AdminApp.tsx',
  'src/pages/MarketPage.tsx',
  'src/pages/AuctionPage.tsx',
  'src/pages/ContractPage.tsx',
  'src/pages/GemShopPage.tsx',
  'src/pages/SettingsPage.tsx',
  'src/pages/ProductionPage.tsx',
  'src/components/InvitationSettings.tsx',
  'src/components/AdminBanPanel.tsx',
]) requireText(path, 'FormControls');

for (const text of [
  '<TextInput',
  'name="email"',
  'name="password"',
  'new FormData(event.currentTarget)',
]) requireText('src/app/LoginPage.tsx', text);
for (const forbidden of ['value={email}', 'value={password}']) {
  forbidText('src/app/LoginPage.tsx', forbidden);
}

for (const text of [
  '统一表单控件',
  '`FormControls.tsx`',
  '`form-controls.css`',
  '字符串草稿',
  '不得在 `onChange` 中直接执行 `Number(event.target.value)`',
  '移动端输入字号不得低于 `16px`',
  '整数输入始终拥有发生在自身命中区域内的滚轮事件',
  '非被动原生 `wheel` 监听器',
  '展开态固定在第三网格列的右侧',
  '折叠态与 `721px–960px` 自动紧凑侧栏固定在按钮内部右上角',
]) requireText(designDocPath, text);

for (const text of [
  'integer amount input always owns the wheel without moving the page',
  'await wheelOver(page, input, 160)',
  "await expect(input).toHaveValue('1')",
]) requireText(integerWheelTestPath, text);
for (const text of [
  'market order badge stays inside expanded, collapsed and compact sidebar buttons',
  'expectBadgeInside(expanded)',
  'expectBadgeInside(collapsed)',
  'expectBadgeInside(compact)',
]) requireText(sidebarBadgeTestPath, text);

if (failures.length) {
  console.error(`统一表单与侧栏角标验证失败:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}

console.log('统一表单、数字草稿、整数输入滚轮归属、侧栏市场角标与移动端尺寸验证通过。');
