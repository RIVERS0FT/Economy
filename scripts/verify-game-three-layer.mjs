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
  'src/app/LoginPage.tsx',
  'src/app/GameApp.tsx',
  'src/app/AdminApp.tsx',
  'src/app/App.tsx',
  'src/app/AppErrorBoundary.tsx',
  'src/styles/financial-backdrop.css',
  'src/styles/liquid-glass-chrome.css',
  'src/styles/viewport.css',
  'src/main.tsx',
  'runtime-test.html',
  'market-runtime-test.html',
  'tests/browser/persistent-backdrop-harness.tsx',
  'docs/REGISTRATION_INVITE_FLOW_DESIGN.md',
  'docs/LIQUID_GLASS_CHROME_DESIGN.md',
  'tests/browser/game-three-layer.spec.ts',
  'tests/browser/application-photography.spec.ts',
]) requireFile(path);

for (const text of [
  '{sidebar}',
  'className="mobile-page-overlay"',
  "'mobile-chrome-overlay'",
  '{chrome}',
]) requireText('src/components/shell/SignedInShell.tsx', text);
for (const text of ['backdrop?: ReactNode;', '{backdrop}']) forbidText('src/components/shell/SignedInShell.tsx', text);

const sharedShell = read('src/components/shell/SignedInShell.tsx');
const sidebarIndex = sharedShell.indexOf('{sidebar}');
const pageOverlayIndex = sharedShell.indexOf('className="mobile-page-overlay"');
const chromeOverlayIndex = sharedShell.indexOf("'mobile-chrome-overlay'");
if (!(sidebarIndex >= 0 && pageOverlayIndex > sidebarIndex && chromeOverlayIndex > pageOverlayIndex)) {
  failures.push('SignedInShell 必须按侧栏、页面 Overlay、Chrome Overlay 顺序渲染');
}

for (const text of [
  "export type FinancialBackdropVariant = 'auth' | 'game' | 'admin';",
  "export type FinancialBackdropTone = 'normal' | 'critical';",
  'export function FinancialBackdrop()',
  'application-image-layer financial-backdrop-image',
  'data-persistent-financial-photography="true"',
  'application-atmosphere-layer financial-backdrop-atmosphere',
  'FINANCIAL_BACKGROUND_IMAGE_URL',
  'FINANCIAL_BACKGROUND_IMAGE_960_URL',
  'loading="eager"',
  'fetchPriority="high"',
]) requireText('src/components/visual/FinancialBackdrop.tsx', text);

for (const text of [
  'export function PhotographicStateShell',
  "'photographic-state-shell'",
  'data-photographic-state-variant={variant}',
  "role?: 'alert' | 'status';",
]) requireText('src/components/visual/PhotographicStateShell.tsx', text);
forbidText('src/components/visual/PhotographicStateShell.tsx', '<FinancialBackdrop');

for (const text of [
  'rootClassName="game-shell"',
  '<DesktopSidebar',
  '<StatusBar items={statusItems} />',
]) requireText('src/components/shell/GameShell.tsx', text);
forbidText('src/components/shell/GameShell.tsx', 'FinancialBackdrop');
forbidText('src/components/shell/GameShell.tsx', 'backdrop=');

for (const text of [
  'function GameStateShell',
  '<main className="game-state-shell">',
  '正在连接权威游戏服务器',
  '无法加载游戏状态',
]) requireText('src/app/GameApp.tsx', text);
forbidText('src/app/GameApp.tsx', 'FinancialBackdrop');

for (const text of [
  "import { PhotographicStateShell } from '../components/visual/PhotographicStateShell';",
  '<PhotographicStateShell variant="admin" tone="critical" className="admin-denied" role="alert">',
  'rootClassName="admin-shell"',
]) requireText('src/app/AdminApp.tsx', text);
forbidText('src/app/AdminApp.tsx', 'FinancialBackdrop');
forbidText('src/app/AdminApp.tsx', 'backdrop=');

for (const text of [
  "import type {\n  FinancialBackdropTone,\n  FinancialBackdropVariant,",
  'function BannedAccount',
  '<PhotographicStateShell variant="game" tone="critical" className="banned-account-shell" role="alert">',
  'function LoadingState',
  'document.documentElement.dataset.appSurface = surface;',
  'document.documentElement.dataset.appBackdrop = backdrop;',
  'document.documentElement.dataset.appTone = tone;',
  '<LoadingState variant={stateVariantForPath(adminPath)}>',
  "<LoadingState variant={adminPath ? 'admin' : 'game'}>",
  '正在连接统一账号服务',
  '正在加载金融帝国',
]) requireText('src/app/App.tsx', text);

for (const text of [
  'function currentFallbackVariant()',
  "document.documentElement.dataset.appSurface = 'error';",
  "document.documentElement.dataset.appTone = 'critical';",
  'tone="critical"',
  '页面运行出现异常',
]) requireText('src/app/AppErrorBoundary.tsx', text);

for (const path of [
  'src/app/LoginPage.tsx',
  'src/app/AdminApp.tsx',
  'src/app/GameApp.tsx',
  'src/components/shell/GameShell.tsx',
  'src/components/visual/PhotographicStateShell.tsx',
]) forbidText(path, 'FinancialBackdrop');

const mainSource = read('src/main.tsx');
for (const text of [
  "import { FinancialBackdrop } from './components/visual/FinancialBackdrop';",
  "document.documentElement.dataset.appSurface = 'loading';",
  'document.documentElement.dataset.appBackdrop =',
  "document.documentElement.dataset.appTone = 'normal';",
  '<FinancialBackdrop />',
  '<div className="application-content-root">',
]) requireText('src/main.tsx', text);
const backdropNodeIndex = mainSource.indexOf('<FinancialBackdrop />');
const strictModeIndex = mainSource.indexOf('<React.StrictMode>');
const boundaryIndex = mainSource.indexOf('<AppErrorBoundary>');
if (!(backdropNodeIndex >= 0 && strictModeIndex > backdropNodeIndex && boundaryIndex > backdropNodeIndex)) {
  failures.push('摄影节点必须在 StrictMode 与 AppErrorBoundary 之外持久挂载');
}
if ((mainSource.match(/<FinancialBackdrop \/>/g) ?? []).length !== 1) {
  failures.push('生产根入口必须且只能渲染一个 FinancialBackdrop');
}

for (const text of [
  'html[data-app-surface="error"] body::before',
  '#root {',
  'isolation: isolate;',
  '.application-content-root {',
  'z-index: 2;',
  '.application-image-layer,',
  '.application-atmosphere-layer {',
  'position: fixed;',
  '.application-image-layer {',
  'z-index: 0;',
  '.application-atmosphere-layer {',
  'z-index: 1;',
  'html[data-app-backdrop="auth"] .application-image-layer img',
  'html[data-app-backdrop="game"] .application-image-layer img',
  'html[data-app-backdrop="admin"] .application-image-layer img',
  'html[data-app-backdrop="auth"] .application-atmosphere-layer',
  'html[data-app-backdrop="game"] .application-atmosphere-layer',
  'html[data-app-backdrop="admin"] .application-atmosphere-layer',
  'html[data-app-tone="critical"] .application-atmosphere-layer',
  '.financial-backdrop-image img[hidden] {',
  '.photographic-state-shell__content {',
  '.photographic-state-card {',
  '@media (max-width: 720px)',
]) requireText('src/styles/financial-backdrop.css', text);

const authImageNegativeLayer = 'html[data-app-surface="auth"] .application-image-layer {\n  z-index: -2;\n}';
const authAtmosphereNegativeLayer = 'html[data-app-surface="auth"] .application-atmosphere-layer {\n  z-index: -1;\n}';
for (const text of [authImageNegativeLayer, authAtmosphereNegativeLayer]) {
  requireText('src/styles/financial-backdrop.css', text);
}
const unexpectedNegativeLayerSource = read('src/styles/financial-backdrop.css')
  .replace(authImageNegativeLayer, '')
  .replace(authAtmosphereNegativeLayer, '');
if (/z-index:\s*-\d+\s*;/.test(unexpectedNegativeLayerSource)) {
  failures.push('src/styles/financial-backdrop.css 只有认证图片层和认证氛围层允许使用 -2 / -1 负层级');
}

for (const text of [
  '.game-image-layer',
  '.game-atmosphere-layer',
  '.admin-image-layer',
  '.admin-atmosphere-layer',
  '.financial-backdrop-atmosphere--critical',
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
  'id="backdrop-root"',
  'class="application-content-root"',
  '/tests/browser/persistent-backdrop-harness.tsx',
]) requireText('runtime-test.html', text);
for (const text of [
  'id="backdrop-root"',
  'class="application-content-root"',
  '/tests/browser/persistent-backdrop-harness.tsx',
]) requireText('market-runtime-test.html', text);
for (const text of [
  "import { FinancialBackdrop } from '../../src/components/visual/FinancialBackdrop';",
  "document.getElementById('backdrop-root')",
  '<FinancialBackdrop />',
]) requireText('tests/browser/persistent-backdrop-harness.tsx', text);

for (const text of [
  '登录、注册、玩家游戏、管理员后台与根级状态共享三层视觉',
  '整个应用生命周期只允许一个摄影 `<picture>` 节点',
  '摄影节点固定在 `main.tsx`',
  '`data-app-backdrop`',
  '`data-app-tone`',
  '不得在 `LoginPage`、`GameStateShell`、`GameShell`、`AdminApp` 或 `PhotographicStateShell` 中重新挂载',
  '`tests/browser/application-photography.spec.ts`',
]) requireText('docs/REGISTRATION_INVITE_FLOW_DESIGN.md', text);

for (const text of [
  '全应用三层摄影背景',
  '摄影 `<picture>` 固定挂载在 `main.tsx`',
  '页面和状态切换只修改 `data-app-backdrop` 与 `data-app-tone`',
  '不得重新提供 `SignedInShell.backdrop`',
  '`application-photography.spec.ts`',
  '不得出现纯色过渡页',
  '生产认证态继续使用 `-2 / -1` 负层级',
]) requireText('docs/LIQUID_GLASS_CHROME_DESIGN.md', text);

for (const text of [
  "test.describe('signed-in game three-layer background'",
  "page.locator('.application-image-layer')",
  "page.locator('.application-atmosphere-layer')",
  'one persistent photography node',
  'falls back to the atmosphere layer when photography fails',
]) requireText('tests/browser/game-three-layer.spec.ts', text);

for (const text of [
  "test.describe('all-interface photography'",
  'keeps the same photography node from account checking into authentication',
  "data.persistenceProbe = 'account-check'",
  "toHaveAttribute('data-persistence-probe', 'account-check')",
  'uses the game critical atmosphere for banned accounts',
  'uses the admin critical atmosphere for denied access',
  'keeps the administrator interface readable when photography fails',
  "page.locator('.application-image-layer')",
  "page.locator('.photographic-state-shell')",
]) requireText('tests/browser/application-photography.spec.ts', text);

if (failures.length) {
  console.error(`持久全应用摄影背景验证失败:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}

console.log('持久全应用摄影背景验证通过：唯一图片节点、根级氛围切换、认证、玩家、管理员、状态页、失败回退、移动 Overlay 和浏览器 harness 均已锁定。');
