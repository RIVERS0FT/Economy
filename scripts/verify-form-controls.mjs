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
const mainPath = 'src/main.tsx';
const designDocPath = 'docs/UI_DESIGN_SYSTEM.md';

[
  componentPath,
  draftPath,
  stylePath,
  mainPath,
  designDocPath,
  'src/app/LoginPage.tsx',
  'src/app/AdminApp.tsx',
  'src/pages/MarketPage.tsx',
  'src/pages/AuctionPage.tsx',
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
  'src/pages/GemShopPage.tsx',
]) {
  requireText(path, 'parseIntegerDraft');
  forbidText(path, 'Number(event.target.value)');
}

for (const path of [
  'src/app/AdminApp.tsx',
  'src/pages/MarketPage.tsx',
  'src/pages/AuctionPage.tsx',
  'src/pages/GemShopPage.tsx',
  'src/pages/SettingsPage.tsx',
  'src/pages/ProductionPage.tsx',
  'src/components/InvitationSettings.tsx',
  'src/components/AdminBanPanel.tsx',
]) requireText(path, "FormControls");

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
]) requireText(designDocPath, text);

if (failures.length) {
  console.error(`统一表单控件验证失败:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}

console.log('统一表单组件、数字草稿、整数输入滚轮归属、输入状态和移动端尺寸验证通过。');
