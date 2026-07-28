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
  'src/main.tsx',
  'src/app/LoginPage.tsx',
  'src/components/visual/FinancialBackdrop.tsx',
  'src/config/visualAssets.ts',
  'src/styles/auth.css',
  'src/styles/financial-backdrop.css',
  'src/styles/globals.css',
  'src/styles/card-system.css',
  'src/styles/invitations.css',
  'docs/REGISTRATION_INVITE_FLOW_DESIGN.md',
  'docs/README.md',
  'tests/browser/auth-three-layer.spec.ts',
]) requireFile(path);

for (const text of [
  "import { FinancialBackdrop } from '../components/visual/FinancialBackdrop'",
  '<FinancialBackdrop variant="auth" priority />',
  'login-content-layer',
]) requireText('src/app/LoginPage.tsx', text);

for (const text of [
  'FINANCIAL_BACKGROUND_IMAGE_URL',
  'FINANCIAL_BACKGROUND_IMAGE_960_URL',
  'upload.wikimedia.org/wikipedia/commons/',
  'Carol M. Highsmith',
]) requireText('src/config/visualAssets.ts', text);

for (const text of [
  "type FinancialBackdropVariant = 'auth' | 'game'",
  "variant === 'auth' ? 'login' : 'game'",
  'financial-backdrop-image',
  'financial-backdrop-atmosphere',
  '<picture>',
  "fetchPriority={priority ? 'high' : 'auto'}",
  'aria-hidden="true"',
  'event.currentTarget.hidden = true;',
]) requireText('src/components/visual/FinancialBackdrop.tsx', text);

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
  '.game-image-layer',
  '.game-atmosphere-layer',
]) forbidText('src/styles/globals.css', text);

for (const text of [
  '.login-shell',
  '.login-card.panel',
]) forbidText('src/styles/card-system.css', text);

for (const text of [
  'AUTH_BACKGROUND_IMAGE_URL',
  'AUTH_BACKGROUND_IMAGE_960_URL',
  'upload.wikimedia.org',
]) forbidText('src/app/LoginPage.tsx', text);

const backdropImport = "import './styles/financial-backdrop.css';";
const mainSource = read('src/main.tsx');
requireText('src/main.tsx', backdropImport);
const gameLayoutIndex = mainSource.indexOf("import './styles/game-shell-layout.css';");
const backdropIndex = mainSource.indexOf(backdropImport);
const glassIndex = mainSource.indexOf("import './styles/liquid-glass-surfaces.css';");
if (!(gameLayoutIndex >= 0 && backdropIndex > gameLayoutIndex && glassIndex > backdropIndex)) {
  failures.push('src/main.tsx 必须按 game-shell-layout.css → financial-backdrop.css → liquid-glass-surfaces.css 加载');
}

const finalStyleOrder = [
  "import './styles/design-system.css';",
  "import './styles/interaction-states.css';",
  "import './styles/primary-surfaces.css';",
  "import './styles/auth.css';",
  "import './styles/registration-auth.css';",
  "import './styles/form-controls.css';",
];
for (let index = 0; index < finalStyleOrder.length; index += 1) {
  const current = mainSource.indexOf(finalStyleOrder[index]);
  if (current < 0) {
    failures.push(`src/main.tsx 缺少最终样式入口: ${finalStyleOrder[index]}`);
    continue;
  }
  if (index > 0) {
    const previous = mainSource.indexOf(finalStyleOrder[index - 1]);
    if (previous >= current) failures.push(`src/main.tsx 样式顺序错误: ${finalStyleOrder[index - 1]} 必须早于 ${finalStyleOrder[index]}`);
  }
}

for (const text of [
  '登录、注册与玩家游戏共享三层视觉',
  '`src/components/visual/FinancialBackdrop.tsx`',
  '`login-image-layer`',
  '`login-atmosphere-layer`',
  '`login-content-layer`',
  'Carol M. Highsmith',
  '不得把整个移动登录页恢复为单张外层面板',
  '背景图片和氛围层唯一归属 `src/styles/financial-backdrop.css`',
  '`design-system.css → interaction-states.css → primary-surfaces.css → auth.css → registration-auth.css → form-controls.css`',
  '不得改变登录、注册或游戏业务流程来适配视觉布局',
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
