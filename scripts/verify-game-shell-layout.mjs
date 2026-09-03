import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const failures = [];
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const check = (path, values) => {
  if (!existsSync(resolve(root, path))) {
    failures.push(`缺少文件: ${path}`);
    return;
  }
  const content = read(path);
  for (const value of values) if (!content.includes(value)) failures.push(`${path} 缺少: ${value}`);
};
const forbid = (path, values) => {
  const content = read(path);
  for (const value of values) if (content.includes(value)) failures.push(`${path} 不应包含: ${value}`);
};

check('src/main.tsx', [
  "import './styles/viewport.css';",
  "import './styles/scrollbars.css';",
  "import './styles/game-shell-layout.css';",
  "import './styles/safe-floating.css';",
  "import './styles/strategic-game-shell.css';",
]);
const mainSource = read('src/main.tsx');
const provinceMapStyleIndex = mainSource.indexOf("import './styles/province-map.css';");
const strategicStyleIndex = mainSource.indexOf("import './styles/strategic-game-shell.css';");
if (!(provinceMapStyleIndex >= 0 && strategicStyleIndex > provinceMapStyleIndex)) {
  failures.push('玩家战略外壳样式必须在 province-map.css 之后作为最终几何覆盖加载');
}
check('src/components/shell/SignedInShell.tsx', [
  "import { FrostedGlassSurface } from '../ui/FrostedGlassSurface'",
  "import { ScrollArea } from '../ui/ScrollArea'",
  'WorkspaceFloatingLayerContext.Provider',
  'WorkspaceTooltipLayerContext.Provider',
  'WorkspaceDialogLayerContext.Provider',
  'className="signed-in-shell__body"',
  "'signed-in-shell__chrome'",
  'className="mobile-page-overlay"',
  'className="workspace-strategic-chrome"',
  'className="workspace-floating-layer"',
  'data-workspace-floating-layer="true"',
  'className="workspace-tooltip-layer"',
  'data-workspace-tooltip-layer="true"',
  'className="workspace-dialog-layer"',
  'data-workspace-dialog-layer="true"',
  'className="page-scroll-area"',
  "'page-scroll'",
  'integratedPrimaryCard = false',
  'pageTransitionKey',
  '<FrostedGlassSurface variant="workspaceCard" className="signed-in-shell__primary-card">',
  'className="signed-in-shell__primary-page"',
  'className="signed-in-shell__page-reveal-inner"',
]);
const sharedShell = read('src/components/shell/SignedInShell.tsx');
if (!(sharedShell.indexOf('className="mobile-page-overlay"') >= 0
  && sharedShell.indexOf('className="mobile-page-overlay"') < sharedShell.indexOf('className="workspace-strategic-chrome"')
  && sharedShell.indexOf('className="workspace-strategic-chrome"') < sharedShell.indexOf('className="workspace-floating-layer"'))) {
  failures.push('SignedInShell 工作区必须按页面、战略 Chrome、普通浮层顺序渲染');
}
if (!(sharedShell.indexOf('className="workspace-floating-layer"') >= 0
  && sharedShell.indexOf('className="workspace-floating-layer"') < sharedShell.indexOf('className="workspace-tooltip-layer"'))) {
  failures.push('共享 Tooltip 宿主必须作为工作区安全浮层的子层存在，不得创建第五个根级 Portal');
}
forbid('src/components/shell/SignedInShell.tsx', [
  'workspaceBackground',
  'className="workspace-background-layer"',
  'showTopLayerPopover(tooltipLayer)',
  'hideTopLayerPopover(tooltipLayer)',
  "popover={topLayerSupported ? 'manual' : undefined}",
  "data-top-layer={topLayerSupported ? 'true' : undefined}",
]);
if (sharedShell.indexOf('className="signed-in-shell__body"') >= sharedShell.indexOf("'signed-in-shell__chrome'")) {
  failures.push('SignedInShell 必须先渲染页面主体、再渲染 Chrome，保持移动玻璃采样顺序');
}
if (sharedShell.indexOf("'signed-in-shell__chrome'") >= sharedShell.indexOf('className="workspace-dialog-layer"')) {
  failures.push('SignedInShell 根级 Dialog 层必须在 Chrome 之后渲染，由 CSS 层级保持移动状态栏位于业务 Dialog 之上');
}
check('src/components/ui/WorkspaceFloatingLayer.tsx', [
  'WorkspaceFloatingLayerContext',
  'useWorkspaceFloatingLayer',
  'WorkspaceTooltipLayerContext',
  'useWorkspaceTooltipLayer',
  'WorkspaceDialogLayerContext',
  'useWorkspaceDialogLayer',
]);
check('src/components/ui/SafeTooltip.tsx', [
  'createPortal', 'useWorkspaceFloatingLayer', 'useWorkspaceTooltipLayer', 'SAFE_FLOATING_GAP = 8',
  'supportsTopLayerPopover()', 'showTopLayerPopover(tooltip)', 'hideTopLayerPopover(tooltip)',
  "popover={topLayerActive ? 'manual' : undefined}", 'role="tooltip"',
  'floatingLayer.getBoundingClientRect()', 'const portalTarget = tooltipLayer',
]);
check('src/components/provinces/UsMainlandMap.tsx', [
  'useWorkspaceTooltipLayer()', 'supportsTopLayerPopover()',
  'showTopLayerPopover(tooltip)', 'hideTopLayerPopover(tooltip)',
  "popover={tooltipTopLayerActive ? 'manual' : undefined}",
  'data-top-layer={tooltipTopLayerActive',
]);
forbid('src/components/provinces/UsMainlandMap.tsx', ['unlockedProvinceIds', 'locked: boolean', 'data-locked=', 'province-map-tooltip__locked', '--color-map-region-locked']);
check('src/components/shell/AdminDesktopBar.tsx', [
  "import { SafeTooltip } from '../ui/SafeTooltip'",
  'className="admin-command-bar-identity"',
]);
forbid('src/components/shell/AdminDesktopBar.tsx', ['title={email}']);
check('src/components/ui/MobileWorkspaceSheetHost.tsx', [
  'useWorkspaceDialogLayer',
  'WorkspaceFloatingLayerContext.Provider value={dialogLayer}',
  'className="mobile-detail-sheet-backdrop"',
  'className="mobile-detail-sheet mobile-workspace-sheet-host"',
  'data-mobile-workspace-sheet-host="true"',
]);
check('src/components/ui/MobileWorkspaceDetailSheet.tsx', [
  'useMobileWorkspaceSheetHost()',
  'registerDetail(registration);',
  'createPortal(children, host.detailContentLayer)',
]);
forbid('src/components/ui/MobileWorkspaceDetailSheet.tsx', [
  'document.body,',
  'useWorkspaceFloatingLayer',
  'useWorkspaceDialogLayer',
  'className="mobile-detail-sheet"',
]);

check('src/styles/game-shell-layout.css', [
  '--desktop-layout-gutter: var(--space-3);',
  '--desktop-shell-body-top:',
  'grid-template-rows: var(--desktop-shell-body-top) minmax(0, 1fr);',
  '.signed-in-shell__chrome {',
  'display: block;',
  '.signed-in-shell__body {',
  'left: var(--desktop-layout-gutter);',
  'right: var(--desktop-layout-gutter);',
  'padding-top: 0;',
  'scroll-padding-top: 0;',
  '.page-scroll-area > .ui-scrollbar--vertical {',
  'top: 0;',
  '.workspace-floating-layer {',
  'overflow: clip;',
]);
check('src/components/shell/GameShell.tsx', [
  'const STRATEGIC_PAGE_PRESENTATION = {',
  "province: 'building'",
  "transport: 'building'",
  "leaderboard: 'fullscreen'",
  "const [sidebarCollapsed, setSidebarCollapsed] = useState(true)",
  "const [mapLens, setMapLens] = useState<ProvinceMapLens>('assets')",
  '<ApplicationMapLayerPortal>',
  '<StrategicMapStage model={model} lens={mapLens} />',
  '<StrategicMapLensBar lens={mapLens} onLensChange={setMapLens} />',
  'sidebar={(',
  '<DesktopSidebar',
  '<StrategicWorkspaceChrome',
  'tutorial={tutorial}',
  'pendingItems={notificationCenter.pendingItems}',
  'data-strategic-presentation={pagePresentation}',
  'integratedPrimaryCard',
  'pageTransitionKey={playerPageLocationKey(pageLocation)}',
  'data-strategic-page-location={playerPageLocationKey(pageLocation)}',
  'playerId: model.user.id',
  'title: BRAND_NAME',
  'playerName,',
  "onClick: () => selectPlayerTab('settings')",
]);
forbid('src/components/shell/GameShell.tsx', [
  "transport: 'fullscreen'",
  'HIDDEN_EVENT_RAIL_TABS',
  "const showRightRail = pagePresentation !== 'fullscreen';",
  'tutorial={showRightRail ? tutorial : undefined}',
  'showEventRail=',
  'StartingProvinceOverview',
  'startingProvincePicking',
  'startingProvinceCandidateId',
  'onPickStartingProvince',
  'chooseStartingProvince',
  'data-starting-province-picking',
]);
check('src/components/shell/DesktopSidebar.tsx', [
  'showIdentity={false}',
  "excludedTabs={['settings']}",
  'className="sidebar-settings sidebar-footer-action"',
  "onClick={() => onSelect('settings')}",
]);
forbid('src/components/shell/DesktopSidebar.tsx', ['LogoutIcon', 'onSignOut', 'playerName']);
check('src/components/shell/StatusBar.tsx', [
  'export interface StatusBarIdentity',
  'className="asset-bar-identity"',
  'className="asset-bar-identity-copy"',
  '<PlayerAvatar',
  'identity.onClick',
]);
check('src/components/shell/StrategicWorkspace.tsx', [
  'export function StrategicMapStage',
  '<UsMainlandMap',
  'const openProvincePage = (provinceId: string) => {',
  'setSelectedProvinceId(provinceId);',
  "model.setTab('province')",
  "selectedProvinceId={model.tab === 'province' ? state.selectedProvinceId : null}",
  'export function StrategicMapLensBar',
  'export function StrategicWorkspaceChrome',
  'aria-label="地图镜头"',
  '<StrategicOutliner',
  'pendingItems={pendingItems}',
]);
forbid('src/components/shell/StrategicWorkspace.tsx', [
  'strategic-province-inspector',
  '当前经营地区',
  '进入本地市场',
  '管理本地生产',
  'strategic-economic-event-rail',
  'EconomicEventLogPanel',
  'startingProvincePicking',
  'startingProvinceCandidateId',
  'onPickStartingProvince',
  'unlockedProvinceIds',
  'data-starting-province',
]);
check('src/components/outliner/StrategicOutliner.tsx', [
  'aria-label="战略追踪器"',
  'className="strategic-outliner__scroll"',
  'id="tutorial"',
  'id="activity"',
  'id="pinned"',
  'id="events"',
]);
check('src/components/ui/layout.tsx', [
  'className="page-fixed-header"',
  'className="page-card-scroll-area"',
  'viewportClassName="page-card-scroll"',
  'className="page-card-static"',
]);
forbid('src/pages/MapPage.tsx', ['<UsMainlandMap']);
check('src/pages/TransportPage.tsx', [
  'className="transport-page-content"',
]);
check('src/styles/transport-page.css', [
  'container: transport-page / inline-size;',
  '@container transport-page (max-width: 640px)',
]);
forbid('src/styles/transport-page.css', ['@media (max-width: 720px)']);
check('src/styles/strategic-game-shell.css', [
  '--strategic-shell-gutter: 8px;',
  '--desktop-layout-gutter: var(--strategic-shell-gutter);',
  '--desktop-asset-bar-height: 64px;',
  '--strategic-command-rail-width: 78px;',
  '--strategic-compact-page-width: 56rem;',
  '--strategic-page-open-motion: 220ms cubic-bezier(.2, .8, .2, 1);',
  '--strategic-primary-card-inline-size:',
  '.game-shell.strategic-tab-transport,',
  'calc(100vw / 3),',
  '--strategic-outliner-width: clamp(280px, 21vw, 320px);',
  '--strategic-outliner-reserved-width:',
  '.application-map-layer,',
  '.game-shell .workspace-strategic-chrome {',
  'z-index: auto;',
  '.game-shell .workspace-floating-layer {',
  'z-index: 4;',
  '.strategic-page-host--building > .page-content,',
  '.strategic-page-host--fullscreen > .page-content {',
  '.game-shell .signed-in-shell__primary-card {',
  'border-radius: var(--strategic-panel-radius);',
  '.game-shell .signed-in-shell__primary-card .desktop-sidebar::after {',
  'transition: width var(--strategic-page-open-motion);',
  '@keyframes strategic-page-unfold',
  'clip-path: inset(0 100% 0 0);',
  'clip-path: inset(0);',
  '.strategic-page-host .page-card-static {',
  '.strategic-outliner {',
  '.strategic-outliner__scroll {',
  'overflow-y: auto;',
  '@media (max-width: 1439px) and (min-width: 721px)',
  '.strategic-page-host--map {',
  '.application-map-layer > .strategic-map-lens-bar {',
  'z-index: 1;',
]);
forbid('src/styles/strategic-game-shell.css', [
  '--strategic-outliner-collapsed-width',
  '.strategic-outliner[data-collapsed=',
  '.strategic-outliner__collapse',
  '.strategic-outliner__collapsed-map',
  '.game-shell.strategic-tab-research .signed-in-shell__primary-card {',
  '.game-shell.strategic-tab-research .signed-in-shell__primary-card::before {',
  '.strategic-province-inspector',
  '.strategic-map-stage--background',
  '.workspace-background-layer',
  '.page-card-scroll-area > .ui-scrollbar--vertical',
  'grid-template-columns: minmax(0, 0fr);',
  '.strategic-economic-event-rail {',
  '--strategic-event-rail-width',
]);
const lensButtonStyle = read('src/styles/strategic-game-shell.css');
const lensButtonBlock = lensButtonStyle.slice(
  lensButtonStyle.indexOf('.strategic-map-lens-button {'),
  lensButtonStyle.indexOf('.strategic-map-lens-button svg'),
);
if (!(lensButtonBlock.includes('display: inline-flex;')
  && lensButtonBlock.includes('align-items: center;')
  && lensButtonBlock.includes('justify-content: center;')
  && !lensButtonBlock.includes('place-content: center;')
  && !lensButtonBlock.includes('grid-template-columns'))) {
  failures.push('地图镜头栏按钮必须使用单行 flex 居中布局统一图标与文字垂直中线');
}
forbid('src/styles/game-shell-layout.css', [
  `left: 0;
    width: auto;
    height: var(--desktop-asset-bar-height);`,
  '--desktop-page-top-offset: calc(',
]);
check('src/styles/desktop-sidebar.css', [
  '--desktop-sidebar-padding: 14px;',
  'padding: var(--desktop-sidebar-padding);',
  '.signed-in-shell__body {',
  'transition: grid-template-columns var(--desktop-sidebar-motion);',
]);
check('src/styles/frosted-glass-surfaces.css', [
  '.asset-bar-item,',
  'padding-block: 0;',
]);
check('src/styles/viewport.css', [
  '.signed-in-shell__body,',
  '.signed-in-shell__chrome,',
  '.workspace-floating-layer,',
  '.workspace-dialog-layer,',
  '.workspace-dialog-layer {',
  'position: fixed;',
  'z-index: 3000;',
  'inset: 0;',
  'grid-template-rows: minmax(0, 1fr);',
  'margin-inline-start: max(var(--mobile-workspace-gutter), env(safe-area-inset-left));',
  'margin-inline-end: max(var(--mobile-workspace-gutter), env(safe-area-inset-right));',
  'right: 0;', 'left: 0;',
  'top: calc(', 'bottom: calc(', 'overflow: clip;',
  `  .signed-in-shell__body {
    position: relative;
    z-index: 0;
    order: 1;`,
  `  .mobile-page-overlay {
    position: relative;
    z-index: 0;
    order: 1;`,
  `  .workspace-floating-layer {
    position: absolute;
    z-index: 1;
    order: 2;`,
]);
check('src/styles/mobile-detail-sheet.css', [
  '.workspace-dialog-layer > .mobile-detail-sheet-backdrop',
  '.workspace-dialog-layer > .ui-rich-select__listbox',
  'position: absolute;',
  'align-items: end;',
]);
forbid('src/styles/mobile-detail-sheet.css', [
  '.workspace-floating-layer > .mobile-detail-sheet-backdrop',
]);
check('src/styles/mobile-status-layout.css', [
  ".game-shell .strategic-outliner[data-tutorial-visible='true']",
  ".strategic-outliner-section:not(.strategic-outliner-section--tutorial)",
]);
check('src/styles/safe-floating.css', [
  '.workspace-tooltip-layer {',
  '.workspace-tooltip-layer > * {',
  '.safe-tooltip {',
  'position: absolute;',
  'pointer-events: none !important;',
]);
forbid('src/styles/safe-floating.css', [
  ".workspace-tooltip-layer[data-top-layer='true']",
  '.workspace-tooltip-layer::backdrop',
]);
check('src/components/charts/chartOptions.ts', ['appendToBody: false', 'confine: true']);
check('tests/browser/game-shell-layout.spec.ts', [
  "test.describe('persistent-map grand-strategy game shell'",
  'desktop shell keeps an 8px chrome gutter and one integrated workspace card over the persistent map',
  'compact desktop keeps the persistent map, expanded overlay outliner, and page panel on the 8px strategic grid',
  'short desktop keeps the persistent map and command chrome inside the viewport',
  'status bar owns game identity while the sidebar footer owns the settings entry',
  "toHaveCount(10)",
  "toContainText('金融帝国')",
  "toContainText('MEVIUS')",
  'command rail expands over the page without moving the card, page, outliner, map, or status bar',
  'expect(expanded.assetBar.left).toBeCloseTo(collapsed.assetBar.left, 0)',
  'expect(expanded.workspace.left).toBeCloseTo(collapsed.workspace.left, 0)',
  'expect(expanded.primaryCard).toEqual(collapsed.primaryCard)',
  'expect(expanded.pageContent.width).toBeCloseTo(collapsed.pageContent.width, 0)',
  'expect(expanded.outliner).toEqual(collapsed.outliner)',
  'expect(expanded.mapLayer).toEqual(collapsed.mapLayer)',
  'expect(layout.primaryCard.top).toBeCloseTo(layout.body.top, 0)',
  'expect(layout.primaryCard.top - layout.assetBar.bottom).toBeCloseTo(gutter, 0)',
  'expect(layout.viewportHeight - layout.primaryCard.bottom).toBeCloseTo(gutter, 0)',
  'expect(layout.primaryCard.right - layout.primaryCard.left).toBeLessThanOrEqual(layout.viewportWidth / 3 + 1)',
  'expect(layout.primaryCardContainsSidebarAndPage).toBe(true)',
  "expect(layout.sidebarDivider.boxShadow).not.toBe('none')",
  'expect(layout.floatingLayer.top).toBeCloseTo(layout.workspace.top, 0)',
  'expect(layout.pageScrollbar.railTop).toBeGreaterThan(layout.pageContent.top)',
  'expect(layout.pageScrollbar.railRight).toBeCloseTo(layout.pageContent.right, 0)',
  "expect(sidebarInsets.padding).toEqual(['14px', '14px', '14px', '14px'])",
  "expect(statusAlignment.alignItems).toBe('center')",
  'expect(statusAlignment.itemOverflows).not.toContain(true)',
  'expect(layout.lensBar.top).toBeLessThan(layout.pageContent.bottom)',
  'expect(layout.lensBarParentIsMapLayer).toBe(true)',
  'expect(layout.outlinerCollapsed).toBe(false)',
  'expect(layout.outliner.right - layout.outliner.left).toBeGreaterThanOrEqual(280)',
  "not.toHaveAttribute('data-collapsed', 'true')",
]);
forbid('tests/browser/game-shell-layout.spec.ts', [
  'expect(layout.outlinerCollapsed).toBe(true)',
]);
check('src/styles/strategic-outliner.css', [
  'visibility: hidden;',
  'pointer-events: none;',
  '--strategic-outliner-reserved-width: 0px;',
  '100% - var(--strategic-panel-gap) * 2',
  '@media (min-width: 1440px)',
  '--strategic-outliner-reserved-width: var(--strategic-outliner-width);',
]);
check('tests/browser/admin-runtime.spec.ts', [
  'sidebarTopGap', 'workspaceTopGap', 'admin-command-bar-identity',
  '管理员安全悬浮层缺失', 'tooltipInsideWorkspace',
  'expect(geometry.chromeLayerInsideWorkspace).toBe(false)',
]);
check('tests/browser/game-three-layer.spec.ts', [
  'bodyIndex: shellChildren.indexOf(body)',
  'chromeIndex: shellChildren.indexOf(chromeOverlay)',
  "expect(layout.bodyZ).toBe('0')",
  "expect(layout.mapZ).toBe('20')",
  "expect(layout.uiZ).toBe('30')",
  'expect(visual.mapContainsLensBar).toBe(true)',
  "expect(layout.pageZ).toBe('1')",
  "expect(layout.strategicChromeZ).toBe('auto')",
  "expect(layout.floatingLayerZ).toBe('4')",
]);
check('tests/browser/shell-floating-safe-zone.spec.ts', [
  'market-runtime-test.html?scenario=active',
  "read('axisLeft')", "read('priceTop')", 'scrollIntoViewIfNeeded',
  'game ECharts tooltip uses the shared tooltip host and never covers shell chrome',
  '.workspace-tooltip-layer',
  "not.toHaveAttribute('popover', 'manual')",
  'mobile workspace floating layer excludes the top status bar and bottom navigation',
  'intersectionArea',
]);
check('tests/browser/top-layer-overlays.spec.ts', [
  "not.toHaveAttribute('popover', 'manual')",
  "conceptTooltip.evaluate((element) => element.matches(':popover-open'))",
  'expectTopLayerHitTarget',
]);
check('tests/browser/notification-center.spec.ts', [
  'mobile notification panel overlays an open workspace sheet without leaving an island mounted',
  "data-notification-layer', 'dialog'",
  'document.elementFromPoint',
  'panelCloseIsTopmost',
  'panelAboveSheet',
  'statusIsTopmost',
  'panelParentIsDialogLayer',
  'expect(geometry.panelLayerZIndex).toBeGreaterThan(geometry.sheetBackdropZIndex)',
  "page.locator('.notification-island')",
  'await expect(workspaceSheet).toBeVisible()',
]);
check('tests/browser/mobile-detail-sheet.spec.ts', [
  "page.locator('.workspace-dialog-layer')",
  "dialogLayer.locator(':scope > .mobile-detail-sheet-backdrop')",
  "expect(navigation).toHaveAttribute('data-workspace-sheet-hidden', 'true')",
  "expect(hiddenNavigation.visibility).toBe('hidden')",
  "expect(hiddenNavigation.pointerEvents).toBe('none')",
]);
check('tests/browser/frosted-glass-layout.spec.ts', [
  'shared frosted-glass shell',
  "backdropFilter).toContain('blur(18px)')",
  "toHaveCSS('border-radius', '40px')",
]);
check('tests/browser/all-pages-preview.spec.ts', [
  'overview, market, buildings, transport, and settings share a one-third card width while research, auction, contracts, bank, leaderboard, and shop stay full-area',
  'page navigation unfolds only the active page while the persistent map keeps its instance and geometry',
  'reduced motion disables card width and page unfold animation',
  'expect(Math.max(...compactWidths) - Math.min(...compactWidths)).toBeLessThanOrEqual(1)',
  'expect(compactCardWidths[0]).toBeLessThanOrEqual(1684 / 3)',
  "expect(fullAreaWidths.get('排行')).toBeCloseTo(fullAreaWidths.get('商店')!, 0)",
]);
check('tests/browser/tutorial-right-rail.spec.ts', [
  'desktop strategic outliner persists across business and fullscreen pages',
  "toHaveAttribute('data-browser-outliner-sentinel', 'persistent')",
  'desktop strategic outliner hide and pins persist through reload',
]);

check('docs/LIQUID_GLASS_CHROME_DESIGN.md', [
  '图片层 0 → 氛围层 10 → 地图层 20 → UI 层 30',
  '桌面侧栏默认 `78px`',
  '`home`、`province`、`market`、`buildings`、`transport`、`settings` 仍使用 `building`',
  '战略追踪器与页面路由生命周期解耦',
  '六个 `fullscreen` 页面在桌面端隐藏同一追踪器',
  '“教程／进行中／关注／公开经济事件”四个可折叠分区',
  '不得提供追踪器整体横向展开／收起按钮',
  '同一个 `StrategicOutliner` DOM 仅呈现“教程”分区',
  '研发页桌面与其他玩家页面统一使用 `workspaceCard` 外层容器',
  '`--strategic-compact-page-width: 56rem`',
  '`calc(100vw / 3)`',
  '`FrostedGlassSurface workspaceCard`',
  'keyed `clip-path: inset(0 100% 0 0) → inset(0)`',
  '动画不得修改 `grid-template-columns`',
  '工作区安全浮层',
  '根级业务 Dialog',
  '状态栏始终位于 Sheet 与通知面板之上',
]);
check('docs/UI_DESIGN_SYSTEM.md', [
  '登录后浮层安全区', '`SafeTooltip`', '`.workspace-tooltip-layer`',
  '唯一共享 Tooltip 宿主',
  'Tooltip Layer 只负责 DOM 归属与工作区安全几何',
  '不得给 `.workspace-tooltip-layer` 本身添加 `popover`',
  '实际 `SafeTooltip` 与地图 Tooltip 节点分别使用浏览器 Popover Top Layer',
  '`building` 左侧毛玻璃面板',
  '`fullscreen` 占满可用区域',
  '`.application-map-layer`、`.application-ui-layer` 与 `.workspace-strategic-chrome` 必须保持 `isolation:auto`',
  '不得与桌面顶部状态栏／管理员工作栏、桌面侧栏',
  '根级 Dialog',
  'Sheet 自身承担唯一移动毛玻璃模糊',
  '地图镜头栏切换按钮内部统一为单行居中内容',
]);
check('docs/README.md', [
  '`LIQUID_GLASS_CHROME_DESIGN.md`', '毛玻璃材质',
]);

if (failures.length) {
  console.error(`游戏与管理员共享外壳验证失败:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}

console.log('游戏与管理员共享外壳验证通过：固定状态栏、唯一共享页面滚动、跨页面常驻战略追踪器、连续 48 州直接经营、研发统一 workspaceCard 与内部透明科技画布、根级 Dialog、共享 Tooltip 宿主与逐节点 Top Layer、48px 通知轨道、8px 战略栅格、主卡片侧栏覆盖、建筑式页面、根级地图镜头、镜头按钮图标文字同轴居中与安全浮层满足当前基线。');