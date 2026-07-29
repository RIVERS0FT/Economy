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
  'src/components/visual/PhotographicStateShell.tsx',
  'src/components/shell/SignedInShell.tsx',
  'src/components/shell/GameShell.tsx',
  'src/app/GameApp.tsx',
  'src/app/AdminApp.tsx',
  'src/app/App.tsx',
  'src/app/AppErrorBoundary.tsx',
  'src/styles/financial-backdrop.css',
  'src/styles/liquid-glass-chrome.css',
  'src/styles/viewport.css',
  'src/main.tsx',
  'docs/REGISTRATION_INVITE_FLOW_DESIGN.md',
  'docs/LIQUID_GLASS_CHROME_DESIGN.md',
  'tests/browser/game-three-layer.spec.ts',
  'tests/browser/application-photography.spec.ts',
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
  "export type FinancialBackdropVariant = 'auth' | 'game' | 'admin';",
  "export type FinancialBackdropTone = 'normal' | 'critical';",
  "const prefix = variant === 'auth' ? 'login' : variant;",
  'financial-backdrop-atmosphere--critical',
  'FINANCIAL_BACKGROUND_IMAGE_URL',
  'FINANCIAL_BACKGROUND_IMAGE_960_URL',
]) requireText('src/components/visual/FinancialBackdrop.tsx', text);

for (const text of [
  'export function PhotographicStateShell',
  '<FinancialBackdrop variant={variant} tone={tone} priority={priority} />',
  "'photographic-state-shell'",
  'data-photographic-state-variant={variant}',
  "role?: 'alert' | 'status';",
]) requireText('src/components/visual/PhotographicStateShell.tsx', text);

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
  "import { FinancialBackdrop } from '../components/visual/FinancialBackdrop';",
  "import { PhotographicStateShell } from '../components/visual/PhotographicStateShell';",
  'backdrop={<FinancialBackdrop variant="admin" />}',
  '<PhotographicStateShell variant="admin" tone="critical" className="admin-denied" role="alert">',
]) requireText('src/app/AdminApp.tsx', text);

for (const text of [
  "import { PhotographicStateShell } from '../components/visual/PhotographicStateShell';",
  'function BannedAccount',
  '<PhotographicStateShell variant="game" tone="critical" className="banned-account-shell" role="alert">',
  'function LoadingState',
  '<LoadingState variant={stateVariantForPath(adminPath)}>',
  "<LoadingState variant={adminPath ? 'admin' : 'game'}>",
  '正在连接统一账号服务',
  '正在加载金融帝国',
]) requireText('src/app/App.tsx', text);

for (const text of [
  "import { PhotographicStateShell } from '../components/visual/PhotographicStateShell';",
  'function currentFallbackVariant()',
  'tone="critical"',
  '页面运行出现异常',
]) requireText('src/app/AppErrorBoundary.tsx', text);

for (const text of [
  'html[data-app-surface="admin"] body::before',
  'html[data-app-surface="loading"] body::before',
  'html[data-app-surface="banned"] body::before',
  '.financial-backdrop-image img[hidden] {',
  '.game-shell,',
  '.admin-shell,',
  '.photographic-state-shell {',
  '.signed-in-shell.admin-shell {',
  'background: transparent;',
  '.admin-image-layer,',
  '.admin-atmosphere-layer {',
  'position: fixed;',
  'z-index: -2;',
  'z-index: -1;',
  'object-fit: cover;',
  '.financial-backdrop-atmosphere--critical {',
  '.photographic-state-shell__content {',
  '.photographic-state-card {',
  '@media (max-width: 720px)',
]) requireText('src/styles/financial-backdrop.css', text);

for (const text of [
  '.workspace {\n  z-index:',
  '.mobile-page-overlay {\n  z-index:',
  '.mobile-chrome-overlay {\n  z-index:',
  'contain: paint',
  'overflow: clip',
]) forbidText('src/styles/financial-backdrop.css', text);

for (const path of [
  'src/app/LoginPage.tsx',
  'src/app/AdminApp.tsx',
  'src/app/App.tsx',
  'src/app/AppErrorBoundary.tsx',
  'src/components/shell/GameShell.tsx',
  'src/components/visual/PhotographicStateShell.tsx',
  'src/styles/financial-backdrop.css',
]) forbidText(path, 'upload.wikimedia.org');

const mainSource = read('src/main.tsx');
const gameLayoutIndex = mainSource.indexOf("import './styles/game-shell-layout.css';");
const backdropStyleIndex = mainSource.indexOf("import './styles/financial-backdrop.css';");
const glassIndex = mainSource.indexOf("import './styles/liquid-glass-surfaces.css';");
if (!(gameLayoutIndex >= 0 && backdropStyleIndex > gameLayoutIndex && glassIndex > backdropStyleIndex)) {
  failures.push('共享背景样式必须在游戏外壳几何之后、液态玻璃材质之前加载');
}

const compatibilitySource = read('src/styles/liquid-glass-chrome.css');
const compatibilityLayoutIndex = compatibilitySource.indexOf("@import './game-shell-layout.css';");
const compatibilityBackdropIndex = compatibilitySource.indexOf("@import './financial-backdrop.css';");
const compatibilityGlassIndex = compatibilitySource.indexOf("@import './liquid-glass-surfaces.css';");
if (!(compatibilityLayoutIndex >= 0 && compatibilityBackdropIndex > compatibilityLayoutIndex && compatibilityGlassIndex > compatibilityBackdropIndex)) {
  failures.push('浏览器 harness 兼容入口必须按 game-shell-layout.css → financial-backdrop.css → liquid-glass-surfaces.css 转发');
}

for (const text of [
  '登录、注册、玩家游戏、管理员后台与根级状态共享三层视觉',
  '根级状态统一由 `src/components/visual/PhotographicStateShell.tsx` 承载',
  '玩家和管理员背景均通过 `SignedInShell` 的可选 `backdrop` 插槽',
  '统一账号检查、代码包加载、玩家连接／错误／重试、账号封禁、管理员无权限和客户端致命错误必须使用对应',
  '`tests/browser/application-photography.spec.ts`',
]) requireText('docs/REGISTRATION_INVITE_FLOW_DESIGN.md', text);
forbidText('docs/REGISTRATION_INVITE_FLOW_DESIGN.md', '管理员页面不得传入玩家摄影背景');

for (const text of [
  '全应用三层摄影背景',
  '`PhotographicStateShell.tsx`',
  '`application-photography.spec.ts`',
  '管理员只使用低干扰 `admin` 变体',
  '不得出现纯色过渡页',
]) requireText('docs/LIQUID_GLASS_CHROME_DESIGN.md', text);
forbidText('docs/LIQUID_GLASS_CHROME_DESIGN.md', '管理员根外壳不渲染玩家背景');
forbidText('docs/LIQUID_GLASS_CHROME_DESIGN.md', '管理员界面不得渲染这两层');

for (const text of [
  "test.describe('signed-in game three-layer background'",
  "page.locator('.game-image-layer')",
  "page.locator('.game-atmosphere-layer')",
  'falls back to the atmosphere layer when photography fails',
]) requireText('tests/browser/game-three-layer.spec.ts', text);

for (const text of [
  "test.describe('all-interface photography'",
  'shows photography while checking the account session',
  'uses the game critical atmosphere for banned accounts',
  'uses the admin atmosphere for denied access',
  'keeps the administrator interface readable when photography fails',
  "page.locator('.admin-image-layer')",
  "page.locator('.photographic-state-shell')",
]) requireText('tests/browser/application-photography.spec.ts', text);

if (failures.length) {
  console.error(`全应用摄影背景验证失败:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}

console.log('全应用摄影背景验证通过：认证、玩家、管理员、根级状态、共享资源、失败回退、移动 Overlay 和背景采样边界均已锁定。');
