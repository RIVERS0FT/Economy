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

for (const path of [
  'src/app/LoginPage.tsx',
  'src/styles/auth.css',
  'src/styles/globals.css',
  'src/styles/card-system.css',
  'src/styles/invitations.css',
  'docs/REGISTRATION_INVITE_FLOW_DESIGN.md',
  'docs/README.md',
  'tests/browser/auth-three-layer.spec.ts',
]) requireFile(path);

for (const text of [
  'AUTH_BACKGROUND_IMAGE_URL',
  'AUTH_BACKGROUND_IMAGE_960_URL',
  'upload.wikimedia.org/wikipedia/commons/',
  'login-image-layer',
  'login-atmosphere-layer',
  'login-content-layer',
  '<picture>',
  'fetchPriority="high"',
  'aria-hidden="true"',
]) requireText('src/app/LoginPage.tsx', text);

for (const text of [
  '.login-shell {',
  'display: block;',
  'margin: 0;',
  'border: 0;',
  'border-radius: 0;',
  'padding: 0;',
  'overflow: visible;',
  'box-shadow: none;',
  'backdrop-filter: none;',
  '.login-image-layer,',
  '.login-atmosphere-layer {',
  '.login-content-layer {',
  'position: fixed;',
  'z-index: 0;',
  'z-index: 1;',
  'z-index: 2;',
  'object-fit: cover;',
  'html[data-app-surface="auth"] body::before',
  'display: none;',
  'min-height: calc(100dvh - var(--space-8));',
  'backdrop-filter: blur(22px)',
]) requireText('src/styles/auth.css', text);

requireText('src/styles/invitations.css', '.banned-account-shell {');
requireText('src/styles/invitations.css', 'place-items: center;');

for (const text of [
  '.login-image-layer',
  '.login-atmosphere-layer',
  '.login-content-layer',
]) forbidText('src/styles/globals.css', text);

for (const text of [
  '.login-shell',
  '.login-card.panel',
]) forbidText('src/styles/card-system.css', text);

for (const text of [
  '未登录入口固定拆分为图片背景、当前深色氛围背景、标语与认证卡片三个层级',
  '`login-image-layer`',
  '`login-atmosphere-layer`',
  '`login-content-layer`',
  'Carol M. Highsmith',
  '不得把整个移动登录页恢复为单张外层面板',
  '登录外壳、三层背景、品牌区与认证卡片几何唯一由 `src/styles/auth.css` 管理',
  '`src/styles/card-system.css` 不得包含 `.login-shell` 或 `.login-card.panel` 映射',
  '不得改变登录／注册业务流程来适配视觉布局',
]) requireText('docs/REGISTRATION_INVITE_FLOW_DESIGN.md', text);

for (const text of [
  '登录／注册入口三层视觉',
  '未登录入口的图片背景、深色氛围背景、标语与认证卡片三层结构唯一归属 `REGISTRATION_INVITE_FLOW_DESIGN.md`',
]) requireText('docs/README.md', text);

for (const text of [
  "test.describe('auth three-layer layout'",
  'viewport: { width: 1440, height: 900 }',
  'viewport: { width: 390, height: 844 }',
  "page.locator('.login-image-layer')",
  "page.locator('.login-atmosphere-layer')",
  "page.locator('.login-content-layer')",
]) requireText('tests/browser/auth-three-layer.spec.ts', text);

if (failures.length > 0) {
  console.error('登录三层结构验证失败：');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log('登录三层结构验证通过。');
}
