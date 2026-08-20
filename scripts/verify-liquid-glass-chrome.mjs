import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';

const root = process.cwd();
const failures = [];
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const requireFile = (path) => {
  if (!existsSync(resolve(root, path))) failures.push(`缺少文件: ${path}`);
};
const requireText = (path, texts) => {
  const source = read(path);
  for (const text of texts) if (!source.includes(text)) failures.push(`${path} 缺少: ${text}`);
};
const forbidText = (path, texts) => {
  const source = read(path);
  for (const text of texts) if (source.includes(text)) failures.push(`${path} 不应包含: ${text}`);
};
const sourceFiles = (directory) => readdirSync(resolve(root, directory), { withFileTypes: true })
  .flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory()
      ? sourceFiles(path)
      : ['.ts', '.tsx', '.css'].includes(extname(entry.name)) ? [path] : [];
  });

const files = {
  component: 'src/components/ui/FrostedGlassSurface.tsx',
  styles: 'src/styles/frosted-glass-surfaces.css',
  compatibility: 'src/styles/frosted-glass-chrome.css',
  tooltip: 'src/components/ui/SafeTooltip.tsx',
  safeFloatingStyles: 'src/styles/safe-floating.css',
  chartOptions: 'src/components/charts/chartOptions.ts',
  chartStyles: 'src/styles/charts.css',
  status: 'src/components/shell/StatusBar.tsx',
  auth: 'src/components/auth/AuthCardSurface.tsx',
  mobile: 'src/components/shell/MobileBottomNavigationFrame.tsx',
  admin: 'src/components/shell/AdminDesktopBar.tsx',
  shell: 'src/components/shell/GameShell.tsx',
  strategic: 'src/components/shell/StrategicWorkspace.tsx',
  strategicStyles: 'src/styles/strategic-game-shell.css',
  sidebarStyles: 'src/styles/desktop-sidebar.css',
  mobileStyles: 'src/styles/mobile-status-navigation.css',
  browser: 'tests/browser/frosted-glass-layout.spec.ts',
  sampling: 'tests/browser/open-glass-sampling.spec.ts',
  pageBrowser: 'tests/browser/all-pages-preview.spec.ts',
  auctionBrowser: 'tests/browser/auction-bid-history.spec.ts',
  floatingBrowser: 'tests/browser/shell-floating-safe-zone.spec.ts',
  design: 'docs/LIQUID_GLASS_CHROME_DESIGN.md',
  uiDesign: 'docs/UI_DESIGN_SYSTEM.md',
};
Object.values(files).forEach(requireFile);

const packageJson = JSON.parse(read('package.json'));
if (packageJson.dependencies?.['liquid-glass-react'] || packageJson.devDependencies?.['liquid-glass-react']) {
  failures.push('package.json 不得包含 liquid-glass-react');
}
if (read('package-lock.json').includes('node_modules/liquid-glass-react')) {
  failures.push('package-lock.json 不得包含 liquid-glass-react');
}
for (const removed of [
  'src/components/ui/LiquidGlassSurface.tsx',
  'src/styles/liquid-glass-surfaces.css',
  'liquid-glass-reference-test.html',
  'tests/browser/liquid-glass-reference.spec.ts',
  'tests/browser/liquid-glass-reference-harness.tsx',
]) {
  if (existsSync(resolve(root, removed))) failures.push(`旧 Liquid Glass 文件必须删除: ${removed}`);
}

for (const path of sourceFiles('src')) {
  const source = read(path);
  for (const forbidden of ["from 'liquid-glass-react'", 'LiquidGlassSurface', 'glass__warp', 'data-liquid-glass']) {
    if (source.includes(forbidden)) failures.push(`${path} 不得恢复旧实现: ${forbidden}`);
  }
}

requireText(files.component, [
  'export function FrostedGlassSurface',
  "'statusBar' | 'mobileNavigation' | 'authCard' | 'workspaceCard'",
  "'frosted-glass-surface'",
  'data-frosted-glass-variant={variant}',
  'data-frosted-glass-layout={layout}',
  'className="frosted-glass-surface__content"',
]);
forbidText(files.component, ['useEffect', 'useLayoutEffect', 'ResizeObserver', 'MutationObserver', '<svg']);

requireText(files.styles, [
  '--frosted-glass-background:',
  '--frosted-glass-background-strong:',
  '--frosted-glass-border:',
  '--frosted-glass-filter: blur(18px) saturate(128%);',
  '--frosted-glass-shadow:',
  '--frosted-glass-tooltip-shadow:',
  '.frosted-glass-surface {',
  '-webkit-backdrop-filter: var(--frosted-glass-filter);',
  'backdrop-filter: var(--frosted-glass-filter);',
  '.frosted-glass-surface::before {',
  '.ui-tooltip-surface {',
  'background-color: var(--frosted-glass-background) !important;',
  'background-image: linear-gradient(145deg, rgba(255, 255, 255, 0.08), transparent 38%) !important;',
  'box-shadow: var(--frosted-glass-tooltip-shadow) !important;',
  '-webkit-backdrop-filter: var(--frosted-glass-filter) !important;',
  'backdrop-filter: var(--frosted-glass-filter) !important;',
  '@supports not ((backdrop-filter: blur(1px))',
  '.frosted-glass-surface--statusBar,',
  '.frosted-glass-surface--mobileNavigation {',
  '.frosted-glass-surface--authCard {',
  '.frosted-glass-surface--workspaceCard {',
  '.mobile-bottom-navigation .frosted-glass-surface__content {',
  'padding: 8px 0;',
]);
forbidText(files.styles, ['glass__warp', 'feDisplacementMap', 'data-liquid-glass']);

requireText(files.tooltip, [
  'className="safe-tooltip ui-tooltip-surface"',
  'role="tooltip"',
  'useWorkspaceFloatingLayer',
]);
forbidText(files.tooltip, ['FrostedGlassSurface']);
requireText(files.safeFloatingStyles, [
  '.safe-tooltip {',
  'position: absolute;',
  'overflow: auto;',
  'pointer-events: none !important;',
]);
forbidText(files.safeFloatingStyles, [
  'rgba(7, 20, 15, 0.98)',
  'backdrop-filter:',
  'box-shadow:',
]);
requireText(files.chartOptions, [
  "className: 'economy-chart-tooltip ui-tooltip-surface'",
  'confine: true',
  'appendToBody: false',
]);
forbidText(files.chartOptions, [
  "surface: 'rgba(7, 20, 15, 0.98)'",
  'backgroundColor: chartColor.surface',
  'borderColor: chartColor.borderStrong',
  'extraCssText:',
]);
requireText(files.chartStyles, [
  '.economy-chart-tooltip {',
  'pointer-events: none !important;',
]);

requireText(files.status, [
  "import { FrostedGlassSurface } from '../ui/FrostedGlassSurface'",
  '<FrostedGlassSurface variant="statusBar">',
]);
requireText(files.auth, [
  "import { FrostedGlassSurface } from '../ui/FrostedGlassSurface'",
  '<FrostedGlassSurface variant="authCard" layout="content">',
]);
forbidText(files.auth, ['matchMedia', 'useEffect', 'useState']);
requireText(files.mobile, [
  "import { FrostedGlassSurface } from '../ui/FrostedGlassSurface'",
  '<FrostedGlassSurface variant="mobileNavigation">',
]);
requireText(files.admin, ['<FrostedGlassSurface variant="statusBar">']);

const main = read('src/main.tsx');
if (!main.includes("import './styles/frosted-glass-surfaces.css';")) {
  failures.push('src/main.tsx 必须加载 frosted-glass-surfaces.css');
}
forbidText('src/main.tsx', ['liquid-glass-surfaces.css']);
requireText(files.compatibility, [
  "@import './game-shell-layout.css';",
  "@import './financial-backdrop.css';",
  "@import './frosted-glass-surfaces.css';",
]);

requireText(files.shell, [
  "home: 'building'",
  "province: 'building'",
  "market: 'building'",
  "buildings: 'building'",
  "settings: 'building'",
  "research: 'fullscreen'",
  "auction: 'fullscreen'",
  "contracts: 'fullscreen'",
  "bank: 'fullscreen'",
  "leaderboard: 'fullscreen'",
  "'gem-shop': 'fullscreen'",
  'const HIDDEN_EVENT_RAIL_TABS = new Set<TabId>',
  'showEventRail={!HIDDEN_EVENT_RAIL_TABS.has(model.tab)}',
  'integratedPrimaryCard',
  'pageTransitionKey={model.tab}',
]);
requireText(files.strategic, [
  'export function StrategicMapLensBar',
  'className="strategic-economic-event-rail"',
  '<EconomicEventLogPanel',
  "model.tab === 'home' && tutorial",
]);
requireText(files.shell, [
  '<ApplicationMapLayerPortal>',
  '<StrategicMapLensBar lens={mapLens} onLensChange={setMapLens} />',
]);
requireText(files.strategicStyles, [
  '--strategic-compact-page-width: 56rem;',
  '--strategic-primary-card-inline-size:',
  'calc(100vw / 3),',
  '.game-shell .signed-in-shell__primary-card {',
  'bottom: var(--strategic-panel-gap);',
  'transition: width var(--strategic-page-open-motion);',
  '.game-shell .signed-in-shell__primary-card .desktop-sidebar::after {',
  '@keyframes strategic-page-unfold',
  '.strategic-page-host--building {',
  'var(--strategic-event-rail-width)',
  '.strategic-page-host--building > .page-content,',
  '.strategic-page-host--fullscreen > .page-content {',
  '.game-shell .page-scroll-area > .ui-scrollbar--vertical {',
  '.application-map-layer > .strategic-map-lens-bar {',
  'z-index: 1;',
  '.strategic-economic-event-rail {',
  'background: var(--frosted-glass-background);',
  'backdrop-filter: var(--frosted-glass-filter);',
]);

requireText(files.sidebarStyles, [
  '@media (hover: hover) and (pointer: fine)',
  '.desktop-sidebar .sidebar-nav-button:hover:not(:disabled)',
  'box-shadow: inset 3px 0 0',
  'transform: none;',
]);
forbidText('src/styles/globals.css', [
  '.desktop-sidebar .sidebar-nav-button strong,\n  .desktop-sidebar .sidebar-footer-action strong {\n    display: none;',
  'transform: translate(17px, -13px);',
]);
requireText(files.mobileStyles, [
  'background: transparent;',
  '.mobile-bottom-navigation .sidebar-nav-button:active:not(:disabled) {',
  '.mobile-bottom-navigation .sidebar-nav-button.active {',
]);
forbidText(files.mobileStyles, [
  '.mobile-bottom-navigation .sidebar-nav-button:hover:not(:disabled) {',
  '.mobile-bottom-navigation .sidebar-nav-button.active:hover:not(:disabled) {',
]);

requireText(files.browser, [
  'CSS frosted glass without Liquid Glass DOM',
  "toHaveAttribute('data-frosted-glass-variant', 'statusBar')",
  "toContain('blur(18px)')",
]);
requireText(files.sampling, ['signed-in frosted-glass backdrop sampling', "value.includes('blur(18px)')"]);
requireText(files.pageBrowser, [
  'overview, market, buildings, and settings share a one-third card width while leaderboard and shop stay full-area',
  "toHaveAttribute('data-strategic-presentation', 'building')",
  "toHaveAttribute('data-strategic-presentation', 'fullscreen')",
  'reduced motion disables card width and page unfold animation',
]);
requireText(files.auctionBrowser, [
  "toContain('ui-tooltip-surface')",
  "toContain('blur(18px)')",
  "toBe('rgba(5, 20, 14, 0.76)')",
]);
requireText(files.floatingBrowser, [
  "toContain('ui-tooltip-surface')",
  "toContain('blur(18px)')",
  "toBe('rgba(5, 20, 14, 0.76)')",
]);
requireText(files.design, [
  '项目不得安装、导入或运行 `liquid-glass-react`',
  '`src/components/ui/FrostedGlassSurface.tsx`',
  '`blur(18px) saturate(128%)`',
  '`.ui-tooltip-surface`',
  '单节点轻量毛玻璃',
  '`721px–960px` 使用与宽屏完全相同',
  '桌面侧栏按钮不得渲染数字角标',
  '`research`、`auction`、`contracts`、`bank`、`leaderboard`、`gem-shop`',
  '`--strategic-compact-page-width: 56rem`',
  '隐藏 `province` 上下文页',
  '`calc(100vw / 3)`',
  '公开经济事件不得进入 `OverviewPage`',
  '工作区外层滚动条隐藏',
  '镜头栏位于地图舞台之上，但整个地图层 `20` 必须低于承载页面的 UI 层 `30`',
  '状态栏始终位于 Sheet 与通知面板之上',
  'Sheet 外部区域不得压暗或模糊',
]);
requireText(files.uiDesign, [
  '`SafeTooltip`',
  '`.ui-tooltip-surface`',
  '`commonTooltip`',
  '应用内 Tooltip',
  '`src/styles/frosted-glass-surfaces.css`',
]);

if (failures.length) {
  console.error('纯 CSS 毛玻璃外壳验证失败：\n- ' + failures.join('\n- '));
  process.exit(1);
}

console.log('纯 CSS 毛玻璃外壳验证通过：共享外壳与 SafeTooltip/ECharts Tooltip 统一使用单节点纯 CSS 毛玻璃材质，且旧 Liquid Glass 实现保持退役。');
