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
  outliner: 'src/components/outliner/StrategicOutliner.tsx',
  outlinerStorage: 'src/components/outliner/useStrategicOutliner.ts',
  guide: 'src/components/GameGuideStrip.tsx',
  guideStyles: 'src/styles/game-guide.css',
  strategicStyles: 'src/styles/strategic-game-shell.css',
  outlinerStyles: 'src/styles/strategic-outliner.css',
  sidebarStyles: 'src/styles/desktop-sidebar.css',
  mobileStyles: 'src/styles/mobile-status-navigation.css',
  mobileStatusStyles: 'src/styles/mobile-status-layout.css',
  browser: 'tests/browser/frosted-glass-layout.spec.ts',
  sampling: 'tests/browser/open-glass-sampling.spec.ts',
  pageBrowser: 'tests/browser/all-pages-preview.spec.ts',
  tutorialBrowser: 'tests/browser/tutorial-right-rail.spec.ts',
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
  'tutorial={tutorial}',
  'pendingItems={notificationCenter.pendingItems}',
  'integratedPrimaryCard',
  'pageTransitionKey={playerPageLocationKey(pageLocation)}',
  'data-strategic-page-location={playerPageLocationKey(pageLocation)}',
]);
forbidText(files.shell, [
  'HIDDEN_EVENT_RAIL_TABS',
  "pagePresentation !== 'fullscreen'",
  'tutorial={showRightRail ? tutorial : undefined}',
  'showEventRail=',
]);
requireText(files.strategic, [
  'export function StrategicMapLensBar',
  "import { StrategicOutliner } from '../outliner/StrategicOutliner'",
  '<StrategicOutliner',
  'pendingItems={pendingItems}',
]);
forbidText(files.strategic, [
  'strategic-economic-event-rail',
  'EconomicEventLogPanel',
  'showEventRail',
  "model.tab === 'home' && tutorial",
]);
requireText(files.outliner, [
  'aria-label="战略追踪器"',
  'className="strategic-outliner__scroll"',
  'id="tutorial"',
  'id="activity"',
  'id="pinned"',
  'id="events"',
  'variant="outliner"',
  'model.game.research.active',
  'pendingItems.map',
  'economicCalendar?.events',
]);
forbidText(files.outliner, ['className="strategic-outliner__collapse"', 'BackIcon']);
requireText(files.outlinerStorage, [
  'economy:strategic-outliner:v',
  'collapsedSections',
  "'province'",
  "'commodity'",
  "'facility'",
  "'auction'",
  "'contract'",
]);
forbidText(files.outlinerStorage, ['collapsed: boolean', 'defaultCollapsed', 'setCollapsed', 'lastTradePrice', 'inventory', 'completesAt']);
requireText(files.guide, [
  "variant?: 'panel' | 'outliner'",
  "'game-guide-strip game-guide-strip--outliner'",
  '<strong id="game-guide-title">教程</strong>',
  'aria-label="教程总体进度"',
]);
forbidText(files.guideStyles, [
  'border: 1px solid color-mix(in srgb, var(--accent, #4f7cff)',
  'background: color-mix(in srgb, var(--accent, #4f7cff) 8%',
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
  'border-radius: var(--strategic-panel-radius);',
  'bottom: var(--strategic-panel-gap);',
  'transition: width var(--strategic-page-open-motion);',
  '.game-shell .signed-in-shell__primary-card .desktop-sidebar::after {',
  '@keyframes strategic-page-unfold',
  '.strategic-page-host--building > .page-content,',
  '.strategic-page-host--fullscreen > .page-content {',
  '.game-shell .page-scroll-area > .ui-scrollbar--vertical {',
  '.application-map-layer > .strategic-map-lens-bar {',
  '.strategic-outliner {',
  '--strategic-outliner-width: clamp(280px, 21vw, 320px);',
  '.strategic-outliner__scroll {',
  'overflow-y: auto;',
  '@media (max-width: 1439px) and (min-width: 721px)',
]);
forbidText(files.strategicStyles, [
  '.strategic-economic-event-rail {',
  '--strategic-event-rail-width',
  '.game-shell.strategic-tab-research .signed-in-shell__primary-card {',
  '.game-shell.strategic-tab-research .signed-in-shell__primary-card::before {',
]);
requireText(files.outlinerStyles, [
  ':has(.strategic-page-host--fullscreen)',
  'visibility: hidden;',
  'pointer-events: none;',
  '--strategic-outliner-reserved-width: 0px;',
  '100% - var(--strategic-panel-gap) * 2',
  '.game-shell:not(:has(.strategic-page-host--fullscreen)) .strategic-outliner',
  '@media (min-width: 1440px)',
  '--strategic-outliner-reserved-width: var(--strategic-outliner-width);',
]);
forbidText(files.strategicStyles, ['--strategic-outliner-collapsed-width', '.strategic-outliner[data-collapsed=', '.strategic-outliner__collapse', '.strategic-outliner__collapsed-map']);
forbidText(files.outlinerStyles, ['--strategic-outliner-collapsed-width', '.strategic-outliner[data-collapsed=', '.strategic-outliner__collapse', '.strategic-outliner__collapsed-map']);
requireText(files.mobileStatusStyles, [
  ".game-shell .strategic-outliner[data-tutorial-visible='true']",
  ".strategic-outliner-section:not(.strategic-outliner-section--tutorial)",
  'top: var(--mobile-below-status-top);',
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
  "toHaveAttribute('data-strategic-presentation', 'building')",
  "toHaveAttribute('data-strategic-presentation', 'fullscreen')",
  'reduced motion disables card width and page unfold animation',
]);
requireText(files.tutorialBrowser, [
  'desktop strategic outliner persists across business and fullscreen pages',
  "toHaveAttribute('data-tutorial-visible', 'true')",
  "toHaveAttribute('data-strategic-presentation', 'fullscreen')",
  "toHaveAttribute('data-browser-outliner-sentinel', 'persistent')",
  "toContain('blur(18px)')",
  'await expect(outliner).toBeHidden()',
  'toBeCloseTo(8, 0)',
  'desktop strategic outliner hide and pins persist through reload',
  'mobile tutorial stays shell-owned inside the shared outliner while pages and notifications cover it',
  "page.locator('.overview-mobile-tutorial')).toHaveCount(0)",
  '[data-mobile-workspace-sheet-host="true"]',
  '.notification-panel-layer[data-notification-layer="dialog"]',
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
  '## 5. 玩家页面与战略追踪器',
  '战略追踪器与页面路由生命周期解耦',
  '“教程／进行中／关注／公开经济事件”四个可折叠分区',
  '整个追踪器只有 `.strategic-outliner__scroll` 一个纵向滚动根',
  'Outliner 变体不得带独立 `.panel` 外壳',
  '七个 `fullscreen` 页面在桌面端隐藏同一追踪器',
  '不得提供追踪器整体横向展开／收起按钮',
  '`721px–1439px` 普通页面不预留伪收起轨道',
  '同一个 `StrategicOutliner` DOM 仅呈现“教程”分区',
  '研发页桌面与其他玩家页面统一使用 `workspaceCard` 外层容器',
  '`--strategic-compact-page-width: 56rem`',
  '`home`、`province`、`market`、`buildings`、`settings` 仍使用 `building`',
  '`calc(100vw / 3)`',
  '工作区外层滚动条隐藏',
  '镜头栏位于地图舞台之上，但整个地图层 `20` 必须低于承载页面的 UI 层 `30`',
  '地图／普通页面 < 移动教程 < 根 Sheet < 移动通知面板／通知灵动岛 < 状态栏',
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

console.log('纯 CSS 毛玻璃外壳验证通过：共享外壳、跨页面常驻战略追踪器、fullscreen 自动 44px 紧凑轨道、统一 workspaceCard、移动同一 Outliner 教程锚点与 SafeTooltip/ECharts Tooltip 均复用纯 CSS 毛玻璃材质，且旧 Liquid Glass 实现保持退役。');
