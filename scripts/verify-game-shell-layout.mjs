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
  "import { ScrollArea } from '../ui/ScrollArea'",
  'WorkspaceFloatingLayerContext.Provider',
  'WorkspaceDialogLayerContext.Provider',
  'className="signed-in-shell__body"',
  'className="workspace-background-layer"',
  "'signed-in-shell__chrome'",
  'className="mobile-page-overlay"',
  'className="workspace-strategic-chrome"',
  'className="workspace-floating-layer"',
  'data-workspace-floating-layer="true"',
  'className="workspace-dialog-layer"',
  'data-workspace-dialog-layer="true"',
  'className="page-scroll-area"',
  "'page-scroll'",
]);
const sharedShell = read('src/components/shell/SignedInShell.tsx');
if (!(sharedShell.indexOf('className="workspace-background-layer"') >= 0
  && sharedShell.indexOf('className="workspace-background-layer"') < sharedShell.indexOf('className="mobile-page-overlay"')
  && sharedShell.indexOf('className="mobile-page-overlay"') < sharedShell.indexOf('className="workspace-strategic-chrome"')
  && sharedShell.indexOf('className="workspace-strategic-chrome"') < sharedShell.indexOf('className="workspace-floating-layer"'))) {
  failures.push('SignedInShell 工作区必须按常驻背景、页面、战略 Chrome、普通浮层顺序渲染');
}
if (sharedShell.indexOf('className="signed-in-shell__body"') >= sharedShell.indexOf("'signed-in-shell__chrome'")) {
  failures.push('SignedInShell 必须先渲染页面主体、再渲染 Chrome，保持移动玻璃采样顺序');
}
if (sharedShell.indexOf("'signed-in-shell__chrome'") >= sharedShell.indexOf('className="workspace-dialog-layer"')) {
  failures.push('SignedInShell 根级 Dialog 层必须在 Chrome 之后渲染，保证模态详情位于最上层');
}
check('src/components/ui/WorkspaceFloatingLayer.tsx', [
  'WorkspaceFloatingLayerContext',
  'useWorkspaceFloatingLayer',
  'WorkspaceDialogLayerContext',
  'useWorkspaceDialogLayer',
]);
check('src/components/ui/SafeTooltip.tsx', [
  'createPortal', 'useWorkspaceFloatingLayer', 'SAFE_FLOATING_GAP = 8',
  'role="tooltip"', 'floatingLayer.getBoundingClientRect()',
]);
check('src/components/shell/AdminDesktopBar.tsx', [
  "import { SafeTooltip } from '../ui/SafeTooltip'",
  'className="admin-command-bar-identity"',
]);
forbid('src/components/shell/AdminDesktopBar.tsx', ['title={email}']);
check('src/components/ui/MobileWorkspaceDetailSheet.tsx', [
  'useWorkspaceDialogLayer',
  'WorkspaceFloatingLayerContext.Provider value={dialogLayer}',
  '!dialogLayer',
  'dialogLayer,',
]);
forbid('src/components/ui/MobileWorkspaceDetailSheet.tsx', [
  'document.body,',
  'useWorkspaceFloatingLayer',
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
  "const [sidebarCollapsed, setSidebarCollapsed] = useState(true)",
  "const [mapLens, setMapLens] = useState<ProvinceMapLens>('assets')",
  'workspaceBackground={<StrategicMapStage model={model} lens={mapLens} />}',
  '<StrategicWorkspaceChrome',
  'data-strategic-presentation={pagePresentation}',
]);
check('src/components/shell/StrategicWorkspace.tsx', [
  'export function StrategicMapStage',
  '<UsMainlandMap',
  'export function StrategicWorkspaceChrome',
  'aria-label="地图镜头"',
  'className="panel strategic-province-inspector"',
]);
forbid('src/pages/MapPage.tsx', ['<UsMainlandMap']);
check('src/styles/strategic-game-shell.css', [
  '--desktop-layout-gutter: 8px;',
  '--desktop-asset-bar-height: 64px;',
  '--strategic-command-rail-width: 78px;',
  '.game-shell .workspace-background-layer {',
  '.game-shell .workspace-strategic-chrome {',
  '.game-shell .workspace-floating-layer {',
  'z-index: 4;',
  '.strategic-page-host--workspace > .page-content {',
  '.strategic-page-host--fullscreen > .page-content {',
  '.strategic-page-host--side > .page-content {',
  '.strategic-page-host--map {',
  '.strategic-map-lens-bar {',
  '.strategic-province-inspector {',
]);
forbid('src/styles/game-shell-layout.css', [
  `left: 0;
    width: auto;
    height: var(--desktop-asset-bar-height);`,
  '--desktop-page-top-offset: calc(',
]);
check('src/styles/desktop-sidebar.css', [
  '.signed-in-shell__body {',
  'transition: grid-template-columns var(--desktop-sidebar-motion);',
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
check('src/styles/safe-floating.css', ['.safe-tooltip {', 'position: absolute;', 'pointer-events: none !important;']);
check('src/components/charts/chartOptions.ts', ['appendToBody: false', 'confine: true']);

check('tests/browser/game-shell-layout.spec.ts', [
  "test.describe('persistent-map grand-strategy game shell'",
  'desktop shell keeps an 8px chrome gutter, fixed command rail, map stage, and overlay panel host',
  'compact desktop keeps the persistent map and overlay panel on the 8px strategic grid',
  'short desktop keeps the persistent map and command chrome inside the viewport',
  'command rail expands over the map without moving the workspace or status bar',
  'expect(expanded.assetBar.left).toBeCloseTo(collapsed.assetBar.left, 0)',
  'expect(expanded.workspace.left).toBeCloseTo(collapsed.workspace.left, 0)',
  'expect(expanded.backgroundLayer).toEqual(collapsed.backgroundLayer)',
  'expect(layout.sidebar.top).toBeCloseTo(layout.body.top, 0)',
  'expect(layout.floatingLayer.top).toBeCloseTo(layout.workspace.top, 0)',
  'expect(layout.pageScrollbar.railTop).toBeCloseTo(layout.body.top, 0)',
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
  "expect(layout.backgroundZ).toBe('0')",
  "expect(layout.pageZ).toBe('1')",
  "expect(layout.strategicChromeZ).toBe('2')",
  "expect(layout.floatingLayerZ).toBe('4')",
]);
check('tests/browser/shell-floating-safe-zone.spec.ts', [
  'market-runtime-test.html?scenario=active',
  "read('axisLeft')", "read('priceTop')", 'scrollIntoViewIfNeeded',
  'game ECharts tooltip remains inside the lower workspace and never covers shell chrome',
  'mobile workspace floating layer excludes the top status bar and bottom navigation',
  'intersectionArea',
]);
check('tests/browser/notification-center.spec.ts', [
  'mobile island stays centered while the panel remains above extreme workspace z-index',
  'notification-layer-regression-sentinel',
  'document.elementFromPoint',
  'panelCloseIsTopmost',
  'islandCenter',
  "expect(geometry.shellBodyZIndex).toBe('0')",
  "expect(geometry.pageLayerZIndex).toBe('1')",
  "expect(geometry.floatingLayerZIndex).toBe('4')",
  "expect(geometry.floatingLayerOrder).toBe('2')",
]);
check('tests/browser/mobile-detail-sheet.spec.ts', [
  "page.locator('.workspace-dialog-layer')",
  "dialogLayer.locator(':scope > .mobile-detail-sheet-backdrop')",
  'expect(navigationCovered).toBe(true)',
]);
check('tests/browser/liquid-glass-layout.spec.ts', [
  'assetBarAreaWidth).toBeCloseTo(layout.viewportWidth - 16',
  'workspaceTop - layout.assetBarBottom',
  "expect(geometry.pageOverlayZIndex).toBe('1')",
]);

check('docs/LIQUID_GLASS_CHROME_DESIGN.md', [
  '跨越全部桌面列', '侧栏不得再从视口顶部开始',
  '玩家端 `.strategic-game-shell` 固定使用 `8px` 桌面外距、`64px` 顶部状态栏和 `78px` 指挥栏',
  '展开到 `224px` 时只覆盖地图和页面面板左侧',
  '背景层 → 页面层 → 战略 Chrome → 普通工作区浮层',
  '工作区浮层安全区', '不得追加到 `document.body`',
  '`appendToBody: false`', '`confine: true`',
  '根级业务 Dialog 层',
  '移动工厂详情',
  '移动工作区使用局部层级堆叠边界',
  '玩家工作区使用背景 `0`、页面 `1`、战略 Chrome `2`、普通浮层 `4`',
  '页面内部任意正 `z-index`',
]);
check('docs/UI_DESIGN_SYSTEM.md', [
  '登录后浮层安全区', '`SafeTooltip`',
  '`map`／`workspace`／`fullscreen`／`side` 四类战略页面面板',
  '`.workspace-background-layer` 与 `.workspace-strategic-chrome` 必须保持 `isolation:auto`',
  '不得与桌面顶部状态栏／管理员工作栏、桌面侧栏',
  '根级 Dialog',
]);
check('docs/README.md', [
  '全宽顶部工作栏', '浮层安全根', 'shell-floating-safe-zone.spec.ts',
  '玩家固定使用 `8px` 外距、`64px` 状态栏、默认折叠 `78px` 指挥栏',
]);

if (failures.length) {
  console.error(`游戏与管理员共享外壳验证失败:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}

console.log('游戏与管理员共享外壳验证通过：管理员传统桌面几何、玩家常驻战略地图与四类面板、覆盖式指挥栏、贴边滚动条、浮层安全根、移动局部层级边界和根级业务 Dialog 层均已锁定。');
