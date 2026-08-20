import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const requireAll = (path, values) => {
  const source = read(path);
  for (const value of values) assert.equal(source.includes(value), true, `${path} 缺少: ${value}`);
};
const forbidAll = (path, values) => {
  const source = read(path);
  for (const value of values) assert.equal(source.includes(value), false, `${path} 不应包含: ${value}`);
};

assert.equal(existsSync('src/components/ui/MobileWorkspaceSheetHost.tsx'), true, '缺少唯一移动 Sheet Host');

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
  "from './MobileWorkspaceSheetHost'",
  '<MobileWorkspaceSheetHost',
  'onClosePage={onClose}',
  'requestCloseRef={requestCloseRef}',
  'Compatibility adapter for GameShell',
]);
forbidAll('src/components/ui/MobileWorkspacePageSheet.tsx', [
  'useMobileWorkspaceSheetDrag',
  'useWorkspaceDialogLayer',
  'createPortal',
  'className="mobile-workspace-page-sheet"',
]);

requireAll('src/components/ui/MobileWorkspaceSheetHost.tsx', [
  "import { createPortal } from 'react-dom';",
  "import { ScrollArea } from './ScrollArea';",
  'useWorkspaceDialogLayer',
  'WorkspaceFloatingLayerContext.Provider value={dialogLayer}',
  "from './useMobileWorkspaceSheetDrag'",
  'interface MobileWorkspaceDetailController',
  'export interface MobileWorkspaceDetailRegistration',
  'const [detailStack, setDetailStack]',
  'const activeDetail = detailStack[detailStack.length - 1] ?? null;',
  'registerDetail',
  'unregisterDetail',
  'requestDetailClose',
  "getScrollTop: (surface) => surface?.querySelector<HTMLElement>(",
  "headerSelector: '.mobile-detail-sheet-drag-handle, .page-fixed-header'",
  "contentSelector: '.mobile-detail-sheet-scroll, .page-card-scroll'",
  "offsetProperty: '--mobile-detail-sheet-drag-offset'",
  "window.visualViewport?.height ?? window.innerHeight",
  "document.querySelector<HTMLElement>('.page-scroll')",
  "pageScroll.style.overflowY = 'hidden'",
  "pageScrollArea.dataset.modalScrollbarSuppressed = 'true'",
  "event.key === 'Escape'",
  "event.key !== 'Tab'",
  'className="mobile-detail-sheet-backdrop"',
  'className="mobile-detail-sheet mobile-workspace-sheet-host"',
  'data-mobile-workspace-sheet-host="true"',
  'data-page-key={pageKey}',
  'role="dialog"',
  'aria-modal="true"',
  'onPointerDown={handlePointerDown}',
  'onTouchStart={handleTouchStart}',
  'onTouchMove={handleTouchMove}',
  'onTouchEnd={handleTouchEnd}',
  'className="mobile-workspace-sheet-page-layer"',
  'inert={Boolean(activeDetail)}',
  'className="mobile-workspace-sheet-page-content"',
  'className="mobile-workspace-sheet-detail-view"',
  'data-mobile-workspace-sheet-detail-view="true"',
  'className="mobile-detail-sheet-drag-handle"',
  'className="mobile-detail-sheet-scroll-area"',
  'viewportClassName="mobile-detail-sheet-scroll"',
  'className="mobile-detail-sheet-footer"',
]);
forbidAll('src/components/ui/MobileWorkspaceSheetHost.tsx', [
  'mobile-workspace-page-sheet',
  'onPointerDown={activeDetail ? undefined : handlePointerDown}',
  'onTouchStart={activeDetail ? undefined : handleTouchStart}',
]);

requireAll('src/components/ui/MobileWorkspaceDetailSheet.tsx', [
  "import { createPortal } from 'react-dom';",
  "from './MobileWorkspaceSheetHost'",
  'useMobileWorkspaceSheetHost()',
  'registerDetail(registration);',
  'unregisterDetail(id)',
  'requestDetailClose?.(id, completion)',
  'host.activeDetailId !== id',
  'createPortal(children, host.detailContentLayer)',
  'createPortal(resolvedFooter, host.detailFooterLayer)',
]);
forbidAll('src/components/ui/MobileWorkspaceDetailSheet.tsx', [
  'useWorkspaceDialogLayer',
  'className="mobile-detail-sheet-backdrop"',
  'className="mobile-detail-sheet"',
  'role="dialog"',
  'aria-modal="true"',
  'useMobileWorkspaceSheetDrag',
]);

requireAll('src/components/ui/useMobileWorkspaceSheetDrag.ts', [
  'interface MobileWorkspaceSheetDragSession',
  'MOBILE_WORKSPACE_SHEET_AXIS_THRESHOLD = 8',
  'MOBILE_WORKSPACE_SHEET_AXIS_DOMINANCE = 1.2',
  'MOBILE_WORKSPACE_SHEET_MIN_FLING_DISTANCE = 40',
  'MOBILE_WORKSPACE_SHEET_CLOSE_VELOCITY = 0.75',
  'MOBILE_WORKSPACE_SHEET_SETTLE_DURATION = 200',
  "source === 'content' && getScrollTopRef.current(sheetRef.current) > 0",
  "sheet.classList.add('is-dragging')",
  "sheet.classList.add('is-settling', 'is-closing')",
]);

requireAll('src/styles/mobile-detail-sheet.css', [
  'Final authority for the single signed-in mobile workspace sheet.',
  '.mobile-detail-sheet {',
  '.mobile-workspace-sheet-page-layer {',
  '.mobile-workspace-sheet-page-content > .page-content {',
  '.mobile-workspace-sheet-detail-view {',
  'height: var(--mobile-detail-sheet-max-height, min(88svh, 760px));',
  '.workspace-dialog-layer > .mobile-detail-sheet-backdrop',
  '@keyframes mobile-workspace-sheet-detail-open',
  'overscroll-behavior-y: auto;',
]);
forbidAll('src/styles/mobile-detail-sheet.css', [
  '.mobile-workspace-page-sheet',
  '--mobile-workspace-page-sheet-drag-offset',
  '@keyframes mobile-workspace-page-sheet-open',
  'overscroll-behavior-y: contain;',
]);

const main = read('src/main.tsx');
assert.ok(
  main.indexOf("import './styles/mobile-detail-sheet.css';")
    > main.indexOf("import './styles/strategic-game-shell.css';"),
  'mobile-detail-sheet.css 必须在 strategic-game-shell.css 后加载以收束唯一移动 Sheet 几何',
);

requireAll('tests/browser/mobile-workspace-overlay.spec.ts', [
  "page.locator('.workspace-dialog-layer > .mobile-detail-sheet-backdrop > .mobile-detail-sheet')",
  "'.mobile-workspace-sheet-page-content > .page-content'",
  'expect(geometry.sheet.bottom).toBeCloseTo(geometry.viewportHeight, 0);',
  'expect(geometry.sheet.bottom).toBeGreaterThan(geometry.navigation.top);',
  'expect(geometry.navigationCovered).toBe(true);',
  'unified mobile sheet closes to the persistent map and restores navigation access',
]);

requireAll('tests/browser/mobile-page-sheet-all-pages.spec.ts', [
  'all mobile business pages reuse the single factory-detail sheet host',
  "element.dataset.sheetInstanceProbe = 'stable';",
  "await expect(sheet).toHaveAttribute('data-page-key', tab);",
  "await expect(sheet).toHaveAttribute('data-sheet-instance-probe', 'stable');",
  "await expect(page.locator('.workspace-dialog-layer > .mobile-detail-sheet-backdrop > .mobile-detail-sheet')).toHaveCount(1);",
]);

requireAll('tests/browser/mobile-detail-sheet.spec.ts', [
  'factory detail reuses the existing mobile sheet host instead of mounting a second sheet',
  "element.dataset.sheetInstanceProbe = 'factory-stable';",
  "await expect(host).toHaveAttribute('data-detail-active', 'true');",
  "await expect(host).toHaveAttribute('data-detail-active', 'false');",
  "await expect(page.locator('.workspace-dialog-layer > .mobile-detail-sheet-backdrop > .mobile-detail-sheet')).toHaveCount(1);",
]);

requireAll('docs/UI_DESIGN_SYSTEM.md', [
  '唯一根级 Mobile Workspace Sheet',
  '`MobileWorkspaceSheetHost`',
  '不得创建第二个 Sheet DOM',
  '允许覆盖移动底部导航',
  '物理根 Sheet 独占 Pointer／Touch 手势监听',
]);
requireAll('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', [
  '唯一根级 Mobile Workspace Sheet',
  '所有移动业务页面与业务详情共用同一个',
  '允许覆盖移动底部导航',
]);
requireAll('docs/LIQUID_GLASS_CHROME_DESIGN.md', [
  '唯一根级 Mobile Workspace Sheet',
  '工厂详情卡片容器',
  '允许覆盖移动底部导航',
]);

console.log('移动端唯一工厂详情 Sheet Host、页面/详情内容复用、导航覆盖、共享拖拽内核与单实例防回退验证通过。');
