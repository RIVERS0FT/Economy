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
]);
check('src/components/shell/SignedInShell.tsx', [
  "import { ScrollArea } from '../ui/ScrollArea'",
  'WorkspaceFloatingLayerContext.Provider',
  'WorkspaceDialogLayerContext.Provider',
  'className="signed-in-shell__body"',
  "'signed-in-shell__chrome'",
  'className="mobile-page-overlay"',
  'className="workspace-floating-layer"',
  'data-workspace-floating-layer="true"',
  'className="workspace-dialog-layer"',
  'data-workspace-dialog-layer="true"',
  'className="page-scroll-area"',
  "'page-scroll'",
]);
const sharedShell = read('src/components/shell/SignedInShell.tsx');
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
  'desktop shell uses one 12px gutter for full-width status bar, lower sidebar, cards and page edges',
  'sidebar collapse leaves the full-width status bar fixed and only expands the lower workspace',
  'expect(expanded.assetBar.left).toBeCloseTo(collapsed.assetBar.left, 0)',
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
  "expect(layout.pageZ).toBe('0')",
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
  "expect(geometry.pageLayerZIndex).toBe('0')",
  "expect(geometry.floatingLayerZIndex).toBe('1')",
  "expect(geometry.floatingLayerOrder).toBe('2')",
]);
check('tests/browser/mobile-detail-sheet.spec.ts', [
  "page.locator('.workspace-dialog-layer')",
  "dialogLayer.locator(':scope > .mobile-detail-sheet-backdrop')",
  'expect(navigationCovered).toBe(true)',
]);
check('tests/browser/liquid-glass-layout.spec.ts', [
  'assetBarAreaWidth).toBeCloseTo(layout.viewportWidth - 24',
  'workspaceTop - layout.assetBarBottom',
  "expect(geometry.pageOverlayZIndex).toBe('0')",
]);

check('docs/LIQUID_GLASS_CHROME_DESIGN.md', [
  '跨越全部桌面列', '侧栏不得再从视口顶部开始',
  '工作区浮层安全区', '不得追加到 `document.body`',
  '`appendToBody: false`', '`confine: true`',
  '根级业务 Dialog 层',
  '移动工厂详情',
  '移动工作区使用局部层级堆叠边界',
  '工作区浮层根固定 `order: 2; z-index: 1`',
  '页面内部任意正 `z-index`',
]);
check('docs/UI_DESIGN_SYSTEM.md', [
  '登录后浮层安全区', '`SafeTooltip`',
  '不得与桌面顶部状态栏／管理员工作栏、桌面侧栏',
  '根级 Dialog',
]);
check('docs/README.md', [
  '全宽顶部工作栏', '浮层安全根', 'shell-floating-safe-zone.spec.ts',
]);

if (failures.length) {
  console.error(`游戏与管理员共享外壳验证失败:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}

console.log('游戏与管理员共享外壳验证通过：全宽顶部工作栏、下方侧栏与工作区、贴边滚动条、普通浮层安全根、移动局部层级边界和根级业务 Dialog 层均已锁定。');
