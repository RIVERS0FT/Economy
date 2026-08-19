import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const requireAll = (path, values) => {
  const source = read(path);
  for (const value of values) assert.equal(source.includes(value), true, `${path} 缺少: ${value}`);
};
const forbidAll = (path, values) => {
  const source = read(path);
  for (const value of values) assert.equal(source.includes(value), false, `${path} 不应包含: ${value}`);
};

requireAll('src/components/shell/GameShell.tsx', [
  "import { MobileWorkspacePageSheet, type MobileWorkspaceSheetRequestClose } from '../ui/MobileWorkspacePageSheet';",
  'const mobilePageCloseRef = useRef<MobileWorkspaceSheetRequestClose | null>(null);',
  "const showMap = useCallback(() => {\n    model.setTab('map');",
  "window.matchMedia('(max-width: 720px)').matches",
  "if (tab === 'map' && model.tab !== 'map')",
  'onSelect={selectMobileTab}',
  "{model.tab === 'map' ? children : (",
  '<MobileWorkspacePageSheet',
  'pageKey={model.tab}',
  'requestCloseRef={mobilePageCloseRef}',
]);

requireAll('src/components/ui/MobileWorkspacePageSheet.tsx', [
  "from './useMobileWorkspaceSheetDrag'",
  "window.matchMedia('(max-width: 720px)').matches",
  "getScrollTop: (sheet) => sheet?.querySelector<HTMLElement>('.page-card-scroll')?.scrollTop ?? 0",
  "headerSelector: '.mobile-workspace-page-sheet-drag-handle, .page-fixed-header'",
  "contentSelector: '.page-card-scroll'",
  "offsetProperty: '--mobile-workspace-page-sheet-drag-offset'",
  'requestCloseRef.current = requestClose;',
  'if (!isMobileViewport) return <>{children}</>;',
  'data-mobile-workspace-page-sheet="true"',
  'className="mobile-workspace-page-sheet-drag-handle"',
]);
forbidAll('src/components/ui/MobileWorkspacePageSheet.tsx', [
  'useWorkspaceDialogLayer',
  'createPortal',
  'aria-modal="true"',
]);

requireAll('src/components/ui/useMobileWorkspaceSheetDrag.ts', [
  'interface MobileWorkspaceSheetDragSession',
  'MOBILE_WORKSPACE_SHEET_AXIS_THRESHOLD = 8',
  'MOBILE_WORKSPACE_SHEET_AXIS_DOMINANCE = 1.2',
  'MOBILE_WORKSPACE_SHEET_MIN_FLING_DISTANCE = 40',
  'MOBILE_WORKSPACE_SHEET_CLOSE_VELOCITY = 0.75',
  'MOBILE_WORKSPACE_SHEET_SETTLE_DURATION = 200',
  "window.matchMedia('(max-width: 720px)').matches",
  "source === 'content' && getScrollTopRef.current(sheetRef.current) > 0",
  "sheet.classList.add('is-dragging')",
  "sheet.classList.add('is-settling', 'is-closing')",
  'const closeDistance = Math.max(96, Math.min(sheetHeight * 0.25, 160));',
]);

requireAll('src/components/ui/MobileWorkspaceDetailSheet.tsx', [
  "from './useMobileWorkspaceSheetDrag'",
  'useWorkspaceDialogLayer',
  'WorkspaceFloatingLayerContext.Provider value={dialogLayer}',
  'aria-modal="true"',
  'onClose: closeFromSharedSheet',
]);

requireAll('src/styles/mobile-detail-sheet.css', [
  'Final authority for signed-in mobile workspace sheets.',
  '.mobile-workspace-page-sheet {',
  '--mobile-workspace-page-sheet-drag-offset: 0px;',
  'animation: mobile-workspace-page-sheet-open 200ms cubic-bezier(0.22, 1, 0.36, 1);',
  '.mobile-workspace-page-sheet-content > .page-content {',
  '.mobile-workspace-page-sheet .page-card-scroll {',
  'overscroll-behavior-y: contain;',
  '@keyframes mobile-workspace-page-sheet-open',
  '.workspace-dialog-layer > .mobile-detail-sheet-backdrop',
]);
forbidAll('src/styles/mobile-detail-sheet.css', [
  '.workspace-dialog-layer > .mobile-workspace-page-sheet',
]);

const main = read('src/main.tsx');
assert.ok(
  main.indexOf("import './styles/mobile-detail-sheet.css';")
    > main.indexOf("import './styles/strategic-game-shell.css';"),
  'mobile-detail-sheet.css 必须在 strategic-game-shell.css 后加载以收束移动 Page Sheet 几何',
);

requireAll('tests/browser/mobile-workspace-overlay.spec.ts', [
  "page.locator('.mobile-workspace-page-sheet')",
  "'.mobile-workspace-page-sheet-content > .page-content'",
  'expect(geometry.pageSheet.top).toBeGreaterThan(geometry.statusSurface.bottom);',
  'expect(geometry.pageSheet.bottom).toBeLessThanOrEqual(geometry.navigation.top + 1);',
  "first-level page sheet closes to the persistent map while mobile chrome stays interactive",
  "await expect(pageSheet).toHaveCount(0);",
  "await page.getByRole('button', { name: /^概览/ }).click();",
]);

requireAll('docs/UI_DESIGN_SYSTEM.md', [
  '`MobileWorkspacePageSheet`',
  '`useMobileWorkspaceSheetDrag`',
  '一级 Page Sheet',
  '二级 Detail Sheet',
  '不得进入 `.workspace-dialog-layer`',
]);
requireAll('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', [
  '除纯地图外的玩家页面',
  '移动一级 Page Sheet',
  '页面之间切换只替换 Sheet 内部内容',
]);
requireAll('docs/LIQUID_GLASS_CHROME_DESIGN.md', [
  '移动一级 Page Sheet',
  '状态栏与移动底栏之间',
  '二级 Detail Sheet',
]);

console.log('移动一级 Page Sheet、共享拖拽内核、常驻 Chrome、地图关闭语义与二级 Detail Sheet 层级验证通过。');