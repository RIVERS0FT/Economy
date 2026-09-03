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
  'src/components/visual/ApplicationLayerRoot.tsx',
  'src/components/visual/FinancialBackdrop.tsx',
  'src/components/visual/PhotographicStateShell.tsx',
  'src/components/system/ApplicationLoadingState.tsx',
  'src/components/shell/SignedInShell.tsx',
  'src/components/shell/GameShell.tsx',
  'src/components/shell/StrategicWorkspace.tsx',
  'src/app/LoginPage.tsx',
  'src/app/GameApp.tsx',
  'src/app/gameViewModel.ts',
  'src/app/AdminApp.tsx',
  'src/app/App.tsx',
  'src/app/AppErrorBoundary.tsx',
  'src/styles/financial-backdrop.css',
  'src/styles/frosted-glass-chrome.css',
  'src/styles/viewport.css',
  'src/styles/strategic-game-shell.css',
  'src/main.tsx',
  'runtime-test.html',
  'market-runtime-test.html',
  'game-loading-lifecycle-test.html',
  'docs/REGISTRATION_INVITE_FLOW_DESIGN.md',
  'docs/LIQUID_GLASS_CHROME_DESIGN.md',
  'tests/browser/game-three-layer.spec.ts',
  'tests/browser/application-photography.spec.ts',
  'tests/browser/game-loading-lifecycle-harness.tsx',
  'tests/browser/game-loading-lifecycle.spec.ts',
]) requireFile(path);

for (const text of [
  '{sidebar}',
  'className="mobile-page-overlay"',
  '<FrostedGlassSurface variant="workspaceCard" className="signed-in-shell__primary-card">',
  'className="signed-in-shell__primary-page"',
  'className="workspace-strategic-chrome"',
  'className="workspace-floating-layer"',
  "'mobile-chrome-overlay'",
  '{chrome}',
]) requireText('src/components/shell/SignedInShell.tsx', text);
for (const text of ['backdrop?: ReactNode;', '{backdrop}']) forbidText('src/components/shell/SignedInShell.tsx', text);

const sharedShell = read('src/components/shell/SignedInShell.tsx');
const primaryCardIndex = sharedShell.indexOf('<FrostedGlassSurface variant="workspaceCard"');
const sidebarIndex = sharedShell.indexOf('{sidebar}', primaryCardIndex);
const primaryPageIndex = sharedShell.indexOf('className="signed-in-shell__primary-page"', sidebarIndex);
const pageLayerIndex = sharedShell.indexOf('{pageLayer}', primaryPageIndex);
const workspaceLayersIndex = sharedShell.indexOf('{workspaceLayers}', pageLayerIndex);
const chromeOverlayIndex = sharedShell.indexOf("'mobile-chrome-overlay'", workspaceLayersIndex);
if (!(primaryCardIndex >= 0
  && sidebarIndex > primaryCardIndex
  && primaryPageIndex > sidebarIndex
  && pageLayerIndex > primaryPageIndex
  && workspaceLayersIndex > pageLayerIndex
  && chromeOverlayIndex > workspaceLayersIndex)) {
  failures.push('SignedInShell 玩家分支必须按主卡片内侧栏与页面、工作区层、根 Chrome 顺序渲染');
}
for (const text of ['workspaceBackground', 'className="workspace-background-layer"']) {
  forbidText('src/components/shell/SignedInShell.tsx', text);
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
  'export function ApplicationLayerRoot',
  '<FinancialBackdrop />',
  'className="application-map-layer"',
  'data-application-layer="map"',
  'className="application-ui-layer"',
  'data-application-layer="ui"',
  '<div className="application-content-root">{children}</div>',
  'export function ApplicationMapLayerPortal',
  'createPortal(children, mapLayer)',
]) requireText('src/components/visual/ApplicationLayerRoot.tsx', text);
const applicationLayers = read('src/components/visual/ApplicationLayerRoot.tsx');
const imageHostIndex = applicationLayers.indexOf('<FinancialBackdrop />');
const mapHostIndex = applicationLayers.indexOf('className="application-map-layer"');
const uiHostIndex = applicationLayers.indexOf('className="application-ui-layer"');
if (!(imageHostIndex >= 0 && mapHostIndex > imageHostIndex && uiHostIndex > mapHostIndex)) {
  failures.push('ApplicationLayerRoot 必须按图片／氛围、地图、UI 顺序渲染根宿主');
}

for (const text of [
  'export function PhotographicStateShell',
  "'photographic-state-shell'",
  'data-photographic-state-variant={variant}',
  "role?: 'alert' | 'status';",
]) requireText('src/components/visual/PhotographicStateShell.tsx', text);
forbidText('src/components/visual/PhotographicStateShell.tsx', '<FinancialBackdrop');

for (const text of [
  'export function ApplicationLoadingState',
  '<main className="game-state-shell">',
  '<div className="loading-screen" role="status" aria-live="polite">',
]) requireText('src/components/system/ApplicationLoadingState.tsx', text);
forbidText('src/components/system/ApplicationLoadingState.tsx', 'PhotographicStateShell');
forbidText('src/components/system/ApplicationLoadingState.tsx', 'FinancialBackdrop');

for (const text of [
  "rootClassName={`game-shell strategic-game-shell strategic-tab-${model.tab}`}",
  '<DesktopSidebar',
  '<StatusBar',
  '<ApplicationMapLayerPortal>',
  '<StrategicMapStage model={model} lens={mapLens} />',
  '<StrategicMapLensBar lens={mapLens} onLensChange={setMapLens} />',
  '<StrategicWorkspaceChrome',
  'action={(',
  'NotificationCenterButton',
]) requireText('src/components/shell/GameShell.tsx', text);
forbidText('src/components/shell/GameShell.tsx', 'FinancialBackdrop');
forbidText('src/components/shell/GameShell.tsx', 'backdrop=');
for (const text of ['StartingProvinceOverview', 'startingProvincePicking', 'startingProvinceCandidateId', 'onPickStartingProvince', 'chooseStartingProvince']) forbidText('src/components/shell/GameShell.tsx', text);

for (const text of [
  "import { ApplicationLoadingState } from '../components/system/ApplicationLoadingState';",
  'function GameErrorStateShell',
  '<div className="loading-screen" role="alert">',
  '<ApplicationLoadingState>正在连接服务器…</ApplicationLoadingState>',
  '无法加载游戏状态',
]) requireText('src/app/GameApp.tsx', text);
forbidText('src/app/GameApp.tsx', '正在连接权威游戏服务器');
forbidText('src/app/GameApp.tsx', 'FinancialBackdrop');
forbidText('src/app/App.tsx', 'function LoadingState');
forbidText('src/app/App.tsx', '<LoadingState');
forbidText('src/app/GameApp.tsx', 'function GameStateShell');

for (const text of [
  'getGameAuthoritySnapshot',
  'const onSignedOutRef = useRef(onSignedOut);',
  'onSignedOutRef.current = onSignedOut;',
  'const canReuseAuthority = reloadVersion === 0',
  'authoritySnapshot.state?.userId === user.id',
  'gameRef.current = authoritySnapshot.state;',
  'revisionRef.current = authoritySnapshot.revision;',
  'onSignedOutRef.current();',
]) requireText('src/app/gameViewModel.ts', text);

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
  "import { ApplicationLoadingState } from '../components/system/ApplicationLoadingState';",
  'document.documentElement.dataset.appSurface = surface;',
  'document.documentElement.dataset.appBackdrop = backdrop;',
  'document.documentElement.dataset.appTone = tone;',
  'const handleSignedOut = useCallback(() => {',
  'onSignedOut={handleSignedOut}',
  '<ApplicationLoadingState>',
  '正在连接服务器…',
  '正在加载本地免登录游戏',
]) requireText('src/app/App.tsx', text);
const appSource = read('src/app/App.tsx');
if ((appSource.match(/<ApplicationLoadingState>/g) ?? []).length !== 3) {
  failures.push('App.tsx 必须且只能为账号检查、正式代码包和本地免登录代码包加载渲染三个 ApplicationLoadingState');
}
if ((appSource.match(/正在连接服务器…/g) ?? []).length !== 2) {
  failures.push('正式玩家账号检查与代码包阶段必须统一显示“正在连接服务器…”');
}
for (const text of ['正在连接统一账号服务', '正在加载金融帝国']) forbidText('src/app/App.tsx', text);

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
  'src/components/system/ApplicationLoadingState.tsx',
]) forbidText(path, 'FinancialBackdrop');

const mainSource = read('src/main.tsx');
for (const text of [
  "import { ApplicationLayerRoot } from './components/visual/ApplicationLayerRoot';",
  "document.documentElement.dataset.appSurface = 'loading';",
  'document.documentElement.dataset.appBackdrop =',
  "document.documentElement.dataset.appTone = 'normal';",
  '<ApplicationLayerRoot>',
  '</ApplicationLayerRoot>',
]) requireText('src/main.tsx', text);
const layerRootIndex = mainSource.indexOf('<ApplicationLayerRoot>');
const strictModeIndex = mainSource.indexOf('<React.StrictMode>');
const boundaryIndex = mainSource.indexOf('<AppErrorBoundary>');
if (!(layerRootIndex >= 0 && strictModeIndex > layerRootIndex && boundaryIndex > layerRootIndex)) {
  failures.push('四层根宿主必须在 StrictMode 与 AppErrorBoundary 之外持久挂载');
}
if ((mainSource.match(/<ApplicationLayerRoot>/g) ?? []).length !== 1) {
  failures.push('生产根入口必须且只能渲染一个 ApplicationLayerRoot');
}

for (const text of [
  'html[data-app-surface="error"] body::before',
  '#root {',
  'isolation: isolate;',
  '--application-layer-image: 0;',
  '--application-layer-atmosphere: 10;',
  '--application-layer-map: 20;',
  '--application-layer-ui: 30;',
  '.application-content-root {',
  'z-index: auto;',
  '.application-image-layer,',
  '.application-atmosphere-layer,',
  '.application-map-layer {',
  'position: fixed;',
  '.application-image-layer {',
  'z-index: var(--application-layer-image);',
  '.application-atmosphere-layer {',
  'z-index: var(--application-layer-atmosphere);',
  '.application-map-layer {',
  'z-index: var(--application-layer-map);',
  '.application-ui-layer {',
  'z-index: var(--application-layer-ui);',
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
  '.game-state-shell > .loading-screen {',
  '@media (max-width: 720px)',
]) requireText('src/styles/financial-backdrop.css', text);

for (const text of [
  '--application-layer-image: 0;',
  '--application-layer-atmosphere: 10;',
  '--application-layer-map: 20;',
  '--application-layer-ui: 30;',
  '.application-content-root {\n  position: relative;\n  z-index: auto;',
]) requireText('src/styles/financial-backdrop.css', text);
for (const text of [
  'html[data-app-surface="auth"] .application-image-layer',
  'html[data-app-surface="auth"] .application-atmosphere-layer',
  '.application-content-root {\n  position: relative;\n  z-index: 2;',
]) forbidText('src/styles/financial-backdrop.css', text);
forbidText('src/styles/financial-backdrop.css', '.photographic-state-card--loading');

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
const glassIndex = mainSource.indexOf("import './styles/frosted-glass-surfaces.css';");
if (!(gameLayoutIndex >= 0 && backdropStyleIndex > gameLayoutIndex && glassIndex > backdropStyleIndex)) {
  failures.push('共享背景样式必须在游戏外壳几何之后、毛玻璃材质之前加载');
}

const compatibilitySource = read('src/styles/frosted-glass-chrome.css');
const compatibilityLayoutIndex = compatibilitySource.indexOf("@import './game-shell-layout.css';");
const compatibilityBackdropIndex = compatibilitySource.indexOf("@import './financial-backdrop.css';");
const compatibilityGlassIndex = compatibilitySource.indexOf("@import './frosted-glass-surfaces.css';");
if (!(compatibilityLayoutIndex >= 0 && compatibilityBackdropIndex > compatibilityLayoutIndex && compatibilityGlassIndex > compatibilityBackdropIndex)) {
  failures.push('浏览器 harness 聚合入口必须按 game-shell-layout.css → financial-backdrop.css → frosted-glass-surfaces.css 转发');
}

for (const text of [
  'id="root"',
  '/tests/browser/runtime-harness.tsx',
]) requireText('runtime-test.html', text);
for (const text of [
  'id="root"',
  '/tests/browser/market-runtime-harness.tsx',
]) requireText('market-runtime-test.html', text);
for (const text of [
  'id="root"',
  '/tests/browser/game-loading-lifecycle-harness.tsx',
]) requireText('game-loading-lifecycle-test.html', text);
for (const path of ['runtime-test.html', 'market-runtime-test.html']) {
  for (const text of ['backdrop-root', 'persistent-backdrop-harness.tsx', 'class="application-content-root"']) {
    forbidText(path, text);
  }
}
for (const path of ['tests/browser/runtime-harness.tsx', 'tests/browser/market-runtime-harness.tsx']) {
  for (const text of [
    "import { ApplicationLayerRoot } from '../../src/components/visual/ApplicationLayerRoot';",
    '<ApplicationLayerRoot>',
    '</ApplicationLayerRoot>',
  ]) requireText(path, text);
}

for (const text of [
  '登录、注册、玩家游戏、管理员后台与根级状态共享四层根结构',
  '整个应用生命周期只允许一个摄影 `<picture>` 节点',
  '`main.tsx` 在 `React.StrictMode` 与 `AppErrorBoundary` 外部固定挂载 `ApplicationLayerRoot`',
  '`data-app-backdrop`',
  '`data-app-tone`',
  '统一账号服务连接、正式代码包加载、本地免登录预览代码包加载与权威游戏服务器连接统一由 `ApplicationLoadingState`',
  '不得恢复深色加载卡片或创建平行加载样式',
  '不得在 `LoginPage`、`ApplicationLoadingState`、`GameErrorStateShell`、`GameShell`、`AdminApp` 或 `PhotographicStateShell` 中重新挂载',
  '`tests/browser/application-photography.spec.ts`',
]) requireText('docs/REGISTRATION_INVITE_FLOW_DESIGN.md', text);

for (const text of [
  '全应用四层根堆叠',
  '`ApplicationLayerRoot` 固定挂载在 `main.tsx`',
  '页面和状态切换只修改 `data-app-backdrop` 与 `data-app-tone`',
  '不得重新提供工作区地图背景插槽或 `SignedInShell.backdrop`',
  '`ApplicationLoadingState.tsx`',
  '四个入口只允许替换中文文字',
  '`tests/browser/application-photography.spec.ts`',
  '不得出现纯色过渡页',
  '对应 `z-index: 0 / 10 / 20 / 30`',
  '不得建立第五个全局层',
]) requireText('docs/LIQUID_GLASS_CHROME_DESIGN.md', text);

for (const text of [
  "test.describe('signed-in game four-layer scene stack'",
  "page.locator('.application-image-layer')",
  "page.locator('.application-atmosphere-layer')",
  "page.locator('.application-map-layer')",
  "page.locator('.application-ui-layer')",
  'one persistent image, atmosphere, map, and UI root order',
  'openLayerIsolations',
  'rootLayerOrder',
  'mapContainsLensBar: Boolean(map.querySelector(\'.strategic-map-lens-bar\'))',
  'expect(visual.mapContainsLensBar).toBe(true)',
  'primaryCardIndex: workspaceChildren.indexOf(primaryCard)',
  'pageInsidePrimaryCard: pageOverlay.closest(\'.signed-in-shell__primary-card\') === primaryCard',
  'strategicChromeIndex: workspaceChildren.indexOf(workspaceStrategicChrome)',
  'floatingLayerIndex: workspaceChildren.indexOf(workspaceFloatingLayer)',
  'falls back to the atmosphere layer when photography fails',
]) requireText('tests/browser/game-three-layer.spec.ts', text);

for (const text of [
  "test.describe('all-interface photography'",
  'keeps the same photography node from account checking into authentication',
  'uses the shared loading layout while loading the financial empire code',
  'uses the shared loading layout while connecting to the authoritative game server',
  'expectSharedLoadingState',
  "data.persistenceProbe = 'account-check'",
  "toHaveAttribute('data-persistence-probe', 'account-check')",
  '正在连接服务器…',
  'uses the game critical atmosphere for banned accounts',
  'uses the admin critical atmosphere for denied access',
  'keeps the administrator interface readable when photography fails',
  "page.locator('.application-image-layer')",
  "page.locator('.photographic-state-shell')",
]) requireText('tests/browser/application-photography.spec.ts', text);

for (const text of [
  '<StrictMode>',
  'useGameViewModel(user, onSignedOut)',
  'id="rerender-parent"',
  'id="remount-game"',
  'data-testid="game-view-model-status"',
]) requireText('tests/browser/game-loading-lifecycle-harness.tsx', text);
for (const text of [
  'ready game view model does not return to loading on parent rerender or same-user remount',
  '__gameLoadingTransitions',
  'expect(stateRequests).toBe(requestsAfterReady)',
  'expect(loadingTransitions).toBe(0)',
]) requireText('tests/browser/game-loading-lifecycle.spec.ts', text);

const unifiedAtmosphereCss = read('src/styles/financial-backdrop.css');
for (const text of [
  'filter: saturate(0.72) contrast(1.08) brightness(0.72);',
  'filter: saturate(0.68) contrast(1.08) brightness(0.62);',
  '--application-atmosphere-primary-glow: rgba(86, 224, 137, 0.10);',
  '--application-atmosphere-secondary-glow: rgba(44, 176, 102, 0.06);',
  '--application-atmosphere-shade-start: rgba(1, 7, 4, 0.96);',
  '--application-atmosphere-shade-mid: rgba(2, 10, 6, 0.90);',
  '--application-atmosphere-shade-focus: rgba(3, 12, 8, 0.84);',
  '--application-atmosphere-shade-end: rgba(2, 9, 6, 0.90);',
  '--application-atmosphere-grid-opacity: 0.16;',
  '--application-atmosphere-noise-opacity: 0.045;',
  '--application-atmosphere-primary-glow: rgba(86, 224, 137, 0.09);',
  '--application-atmosphere-shade-start: rgba(1, 7, 4, 0.78);',
  '--application-atmosphere-shade-mid: rgba(2, 10, 6, 0.76);',
  '--application-atmosphere-shade-end: rgba(2, 8, 5, 0.90);',
  '--application-atmosphere-grid-opacity: 0.08;',
  '--application-atmosphere-noise-opacity: 0.03;',
]) requireText('src/styles/financial-backdrop.css', text);
for (const text of [
  'brightness(0.5)',
  'brightness(0.42)',
  'brightness(0.43)',
  'brightness(0.36)',
  'opacity: 0.24;',
  'opacity: 0.075;',
  'opacity: 0.12;',
  'opacity: 0.05;',
]) forbidText('src/styles/financial-backdrop.css', text);
if ((unifiedAtmosphereCss.match(/filter: saturate\(0\.72\) contrast\(1\.08\) brightness\(0\.72\);/g) ?? []).length !== 1) {
  failures.push('桌面认证、玩家与管理员必须且只能共享一套登录页摄影滤镜');
}
if ((unifiedAtmosphereCss.match(/filter: saturate\(0\.68\) contrast\(1\.08\) brightness\(0\.62\);/g) ?? []).length !== 1) {
  failures.push('移动认证、玩家与管理员必须且只能共享一套登录页摄影滤镜');
}
for (const text of [
  '认证、注册、九个玩家页面、管理员后台以及根级加载／异常状态',
  '页面或角色不得再覆盖这些参数',
  '正常态摄影图片只作为低对比度空间纹理',
]) requireText('docs/REGISTRATION_INVITE_FLOW_DESIGN.md', text);
for (const text of [
  '登录、玩家与管理员必须使用完全相同的摄影滤镜',
  '`data-app-backdrop` 只保留语义和状态路由职责',
  '正常态摄影图片只承担低对比度空间纹理职责',
]) requireText('docs/LIQUID_GLASS_CHROME_DESIGN.md', text);
requireFile('tests/browser/application-atmosphere-consistency.spec.ts');
for (const text of [
  'desktop shares one atmosphere baseline and locks its intensity',
  'mobile shares one atmosphere baseline and locks its intensity',
]) requireText('tests/browser/application-atmosphere-consistency.spec.ts', text);

if (failures.length) {
  console.error(`持久全应用摄影背景验证失败:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}

console.log('持久全应用摄影背景验证通过：唯一图片节点、统一启动加载、已就绪 authority 复用、根级氛围切换、认证、玩家、管理员、状态页、失败回退、移动 Overlay 和浏览器 harness 均已锁定。');