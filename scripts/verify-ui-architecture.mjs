import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const failures = [];
const requireFile = (path) => { if (!existsSync(resolve(root, path))) failures.push(`缺少文件: ${path}`); };
const requireText = (path, text) => { if (!read(path).includes(text)) failures.push(`${path} 缺少: ${text}`); };
const forbidText = (path, text) => { if (read(path).includes(text)) failures.push(`${path} 不应包含: ${text}`); };

[
  'src/components/ui/layout.tsx',
  'src/pages/ProductionPage.tsx',
  'src/pages/SettingsPage.tsx',
  'src/styles/design-system.css',
  'src/styles/globals.css',
  'src/styles/unified-market-admin.css',
  'docs/UI_DESIGN_SYSTEM.md',
].forEach(requireFile);

const sharedLayout = read('src/components/ui/layout.tsx');
const productionPage = read('src/pages/ProductionPage.tsx');
const settingsPage = read('src/pages/SettingsPage.tsx');
const designSystem = read('src/styles/design-system.css');
const businessStyles = read('src/styles/unified-market-admin.css');

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

if (failures.length) {
  console.error(`UI 架构、统一开关与焦点环验证失败:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}

console.log('共享 UI 组件、唯一开关视觉与轨道焦点环验证通过。');
