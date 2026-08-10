import { existsSync, readFileSync, readdirSync } from 'node:fs';
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
const sourceFiles = (directory) => readdirSync(resolve(root, directory), { withFileTypes: true })
  .flatMap((entry) => {
    const relativePath = `${directory}/${entry.name}`;
    if (entry.isDirectory()) return sourceFiles(relativePath);
    return entry.isFile() && /\.(?:ts|tsx)$/.test(entry.name) ? [relativePath] : [];
  });

const componentPath = 'src/components/ui/FormControls.tsx';
const richSelectPath = 'src/components/ui/RichSelectInput.tsx';
const safeTooltipPath = 'src/components/ui/SafeTooltip.tsx';
const topLayerPath = 'src/components/ui/topLayer.ts';
const draftPath = 'src/utils/integerDraft.ts';
const stylePath = 'src/styles/form-controls.css';
const navigationPath = 'src/components/shell/NavigationItems.tsx';
const sidebarStylePath = 'src/styles/desktop-sidebar.css';
const mainPath = 'src/main.tsx';
const designDocPath = 'docs/UI_DESIGN_SYSTEM.md';
const integerWheelTestPath = 'tests/browser/gem-shop-layout.spec.ts';
const sidebarBadgeTestPath = 'tests/browser/sidebar-badge.spec.ts';
const topLayerTestPath = 'tests/browser/top-layer-overlays.spec.ts';
const unifiedSelectTestPath = 'tests/browser/unified-selects.spec.ts';
const adminGiftCodesPath = 'src/components/AdminGiftCodesSection.tsx';

[
  componentPath,
  richSelectPath,
  safeTooltipPath,
  topLayerPath,
  draftPath,
  stylePath,
  navigationPath,
  sidebarStylePath,
  mainPath,
  designDocPath,
  integerWheelTestPath,
  sidebarBadgeTestPath,
  topLayerTestPath,
  unifiedSelectTestPath,
  'src/app/LoginPage.tsx',
  'src/app/AdminApp.tsx',
  adminGiftCodesPath,
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
  "import { RichSelectInput, type RichSelectOption } from './RichSelectInput';",
  'const options = richSelectOptions(visibleChildren, leadingIcon);',
  '<RichSelectInput',
  "classNames('ui-rich-select__native', className)",
  'aria-hidden="true"',
  "select.dispatchEvent(new Event('change', { bubbles: true }));",
  "classNames('ui-control'",
  "classNames('ui-control', 'ui-control--integer'",
  'useEffect',
  'useRef<HTMLInputElement>',
  'parseIntegerDraft',
  "input.addEventListener('wheel', handleWheel, { passive: false })",
  'event.preventDefault();',
  'event.stopPropagation();',
]) requireText(componentPath, text);

for (const path of sourceFiles('src')) {
  if (path === componentPath) continue;
  if (/<select\b/.test(read(path))) {
    failures.push(`${path} 不得直接渲染可见原生 <select>；必须使用共享 SelectInput／RichSelectInput`);
  }
}

for (const text of [
  'export function RichSelectInput',
  'role="combobox"',
  'role="listbox"',
  'role="option"',
  'createPortal(',
  'useWorkspaceFloatingLayer()',
  'supportsTopLayerPopover()',
  'showTopLayerPopover(listbox)',
  'hideTopLayerPopover(listbox)',
  "popover={topLayerSupported ? 'manual' : undefined}",
  "data-top-layer={topLayerSupported ? 'true' : undefined}",
  "position: viewportLayer ? 'fixed' : undefined",
  "zIndex: topLayerSupported ? 'auto' : viewportLayer ? 120 : undefined",
  'createPortal(listboxNode, document.body)',
  'TYPEAHEAD_RESET_MS',
  'matchingOptionIndex(',
  "scrollIntoView({ block: 'nearest' })",
  'data-facility-sheet-no-drag="true"',
  "export type RichSelectVariant = 'default' | 'production-config';",
  'triggerDetail?: ReactNode;',
]) requireText(richSelectPath, text);

for (const text of [
  'supportsTopLayerPopover()',
  'showTopLayerPopover(tooltip)',
  'hideTopLayerPopover(tooltip)',
  "popover={topLayerSupported ? 'manual' : undefined}",
  "data-top-layer={topLayerSupported ? 'true' : undefined}",
  "position: topLayerSupported ? 'fixed' : undefined",
  "zIndex: topLayerSupported ? 'auto' : undefined",
  'createPortal(',
]) requireText(safeTooltipPath, text);

for (const text of [
  'export function supportsTopLayerPopover',
  'export function isTopLayerPopoverOpen',
  'export function showTopLayerPopover',
  'export function hideTopLayerPopover',
  "element.matches(':popover-open')",
]) requireText(topLayerPath, text);

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
  '.ui-rich-select__trigger',
  '.ui-rich-select__listbox',
  '.ui-rich-select__option',
  '.ui-rich-select__native',
  '.ui-rich-select__trigger:not(:has(.ui-rich-select__visual))',
  '.ui-rich-select__option:not(:has(.ui-rich-select__visual))',
  ".ui-rich-select[data-variant='production-config'] .ui-rich-select__trigger",
  ".ui-rich-select__listbox[data-variant='production-config']",
]) requireText(stylePath, text);

for (const text of [
  'badges: NavigationBadgeMap',
  'className="navigation-badge"',
  'aria-label={accessibleLabel}',
  'formatNavigationBadgeCount(navigationBadge.count)',
]) requireText(navigationPath, text);

for (const text of [
  'grid-template-columns: var(--desktop-sidebar-rail) minmax(0, 1fr) auto;',
  '.desktop-sidebar .navigation-badge {',
  'position: static;',
  '.desktop-sidebar[data-collapsed="true"] .sidebar-nav-button .navigation-badge {',
  '.desktop-sidebar .sidebar-nav-button .navigation-badge {',
  'top: 2px;',
  'right: 2px;',
  'left: auto;',
  'transform: none;',
  '@media (max-width: 960px) and (min-width: 721px)',
]) requireText(sidebarStylePath, text);
for (const forbidden of [
  '.desktop-sidebar .sidebar-nav-button small {',
  'sidebar-nav-count',
  'left: 32px;',
]) forbidText(sidebarStylePath, forbidden);

const main = read(mainPath);
const designSystemIndex = main.indexOf("import './styles/design-system.css'");
const formControlsIndex = main.indexOf("import './styles/form-controls.css'");
if (designSystemIndex < 0 || formControlsIndex < 0 || formControlsIndex < designSystemIndex) {
  failures.push('form-controls.css 必须在 design-system.css 之后加载');
}

for (const path of [
  adminGiftCodesPath,
  'src/pages/MarketPage.tsx',
  'src/pages/AuctionPage.tsx',
  'src/pages/ContractPage.tsx',
  'src/pages/GemShopPage.tsx',
]) {
  requireText(path, 'parseIntegerDraft');
  forbidText(path, 'Number(event.target.value)');
}

for (const path of [
  adminGiftCodesPath,
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
  '所有玩家端和管理员端可见下拉选择器必须使用共享富下拉视觉与交互',
  '浏览器原生 `select` 只允许作为 `SelectInput` 内不可见的表单值与旧 `onChange` 兼容层',
  '`production-config`',
  '生产方案槽',
  '菜单允许宽于触发器',
  '不得复制第二套 Popover、键盘导航或刷新状态',
  '字符串草稿',
  '不得在 `onChange` 中直接执行 `Number(event.target.value)`',
  '移动端输入字号不得低于 `16px`',
  '整数输入始终拥有发生在自身命中区域内的滚轮事件',
  '非被动原生 `wheel` 监听器',
  '展开态固定在第三网格列右侧',
  '折叠态、`721px–960px` 自动紧凑侧栏和移动底栏固定在按钮内部右上角',
  '只显示 `1`～`99` 或 `99+`',
  '根级 Dialog 内的 `RichSelectInput` 列表继续复用该 Dialog 根作为安全定位边界并位于详情遮罩之上',
  '只检查 `z-index` 或 Option 字符串不能证明安全区有效',
]) requireText(designDocPath, text);

for (const text of [
  'integer amount input always owns the wheel without moving the page',
  'await wheelOver(page, input, 160)',
  "await expect(input).toHaveValue('1')",
]) requireText(integerWheelTestPath, text);
for (const text of [
  'navigation badge stays inside expanded, collapsed and compact sidebar buttons',
  'expectBadgeInside(expanded)',
  'expectBadgeInside(collapsed)',
  'expectBadgeInside(compact)',
]) requireText(sidebarBadgeTestPath, text);
for (const text of [
  'mobile production rich selects use the browser top layer above the facility sheet',
  "element.matches(':popover-open')",
  'document.elementFromPoint(',
  'expectTopLayerHitTarget',
  "toHaveAttribute('data-top-layer', 'true')",
]) requireText(topLayerTestPath, text);
for (const text of [
  'plain SelectInput uses the production rich select interaction',
  "getByRole('combobox', { name: '状态刷新频率' })",
  "getByRole('listbox', { name: '状态刷新频率' })",
  "locator('select.ui-rich-select__native')",
]) requireText(unifiedSelectTestPath, text);

if (failures.length) {
  console.error(`统一表单、顶层浮层与统一导航角标验证失败:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}

console.log('统一表单、统一可见下拉、受控生产配置变体、顶层浮层、数字草稿、整数输入滚轮归属、统一导航角标与移动端尺寸验证通过。');