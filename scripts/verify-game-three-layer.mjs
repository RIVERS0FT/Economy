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
  'src/config/visualAssets.ts',
  'src/components/visual/FinancialBackdrop.tsx',
  'src/components/shell/SignedInShell.tsx',
  'src/components/shell/GameShell.tsx',
  'src/app/GameApp.tsx',
  'src/styles/financial-backdrop.css',
  'src/styles/viewport.css',
  'src/main.tsx',
  'docs/REGISTRATION_INVITE_FLOW_DESIGN.md',
  'tests/browser/game-three-layer.spec.ts',
]) requireFile(path);

for (const text of [
  'backdrop?: ReactNode;',
  '{backdrop}',
  '{sidebar}',
  'className="mobile-page-overlay"',
  "'mobile-chrome-overlay'",
]) requireText('src/components/shell/SignedInShell.tsx', text);

const sharedShell = read('src/components/shell/SignedInShell.tsx');
const backdropIndex = sharedShell.indexOf('{backdrop}');
const sidebarIndex = sharedShell.indexOf('{sidebar}');
const pageOverlayIndex = sharedShell.indexOf('className="mobile-page-overlay"');
const chromeOverlayIndex = sharedShell.indexOf("'mobile-chrome-overlay'");
if (!(backdropIndex >= 0 && sidebarIndex > backdropIndex && pageOverlayIndex > sidebarIndex && chromeOverlayIndex > pageOverlayIndex)) {
  failures.push('SignedInShell 必须按背景、侧栏、页面 Overlay、Chrome Overlay 顺序渲染');
}

for (const text of [
  "import { FinancialBackdrop } from '../visual/FinancialBackdrop'",
  'backdrop={<FinancialBackdrop variant="game" />}',
  'rootClassName="game-shell"',
]) requireText('src/components/shell/GameShell.tsx', text);

for (const text of [
  'function GameStateShell',
  '<main className="game-state-shell">',
  '<FinancialBackdrop variant="game" />',
  '正在连接权威游戏服务器',
  '无法加载游戏状态',
]) requireText('src/app/GameApp.tsx', text);

for (const text of [
  'html[data-app-surface="game"] body::before',
  'display: none;',
  '.game-shell,',
  '.game-state-shell {',
  'isolation: isolate;',
  '.game-image-layer,',
  '.game-atmosphere-layer {',
  'position: fixed;',
  'z-index: -2;',
  'z-index: -1;',
  'object-fit: cover;',
  '.game-atmosphere-layer::before',
  '.game-atmosphere-layer::after',
  '@media (max-width: 720px)',
]) requireText('src/styles/financial-backdrop.css', text);

for (const text of [
  '.workspace {\n  z-index:',
  '.mobile-page-overlay {\n  z-index:',
  '.mobile-chrome-overlay {\n  z-index:',
  'contain: paint',
  'overflow: clip',
]) forbidText('src/styles/financial-backdrop.css', text);

for (const text of [
  'FINANCIAL_BACKGROUND_IMAGE_URL',
  'FINANCIAL_BACKGROUND_IMAGE_960_URL',
]) requireText('src/config/visualAssets.ts', text);

for (const path of [
  'src/app/LoginPage.tsx',
  'src/components/shell/GameShell.tsx',
  'src/styles/financial-backdrop.css',
]) forbidText(path, 'upload.wikimedia.org');

const mainSource = read('src/main.tsx');
const gameLayoutIndex = mainSource.indexOf("import './styles/game-shell-layout.css';");
const backdropStyleIndex = mainSource.indexOf("import './styles/financial-backdrop.css';");
const glassIndex = mainSource.indexOf("import './styles/liquid-glass-surfaces.css';");
if (!(gameLayoutIndex >= 0 && backdropStyleIndex > gameLayoutIndex && glassIndex > backdropStyleIndex)) {
  failures.push('共享背景样式必须在游戏外壳几何之后、液态玻璃材质之前加载');
}

for (const text of [
  '登录、注册与玩家游戏共享三层视觉',
  '玩家游戏背景通过 `SignedInShell` 的可选 `backdrop` 插槽在侧栏之前渲染',
  '管理员页面不得传入玩家摄影背景',
  '二者及 `.workspace` 不得因为背景改造增加正 `z-index` 或新的隔离层',
  '玩家加载、连接错误和重试状态也必须使用相同游戏背景',
  '`scripts/verify-game-three-layer.mjs`',
  '`tests/browser/game-three-layer.spec.ts`',
]) requireText('docs/REGISTRATION_INVITE_FLOW_DESIGN.md', text);

for (const text of [
  "test.describe('signed-in game three-layer background'",
  "page.locator('.game-image-layer')",
  "page.locator('.game-atmosphere-layer')",
  "page.locator('.game-shell')",
  'width: 1440, height: 900',
  'width: 390, height: 844',
  'falls back to the atmosphere layer when photography fails',
]) requireText('tests/browser/game-three-layer.spec.ts', text);

if (failures.length) {
  console.error(`玩家游戏三层背景验证失败:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}

console.log('玩家游戏三层背景验证通过：共享摄影、氛围层、现有游戏外壳、加载回退和移动 Overlay 边界均已锁定。');
