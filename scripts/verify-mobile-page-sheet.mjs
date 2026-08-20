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
  "const mobileSheetOpen = model.tab !== 'map';",
  'const previousMobileSheetOpenRef = useRef(mobileSheetOpen);',
  'const [mobileNavigationReturning, setMobileNavigationReturning] = useState(false);',
  "window.matchMedia('(prefers-reduced-motion: reduce)').matches",
  'notificationCenter.panelOpen ? null : (',
  'workspaceSheetOpen={mobileSheetOpen}',
  'returning={mobileNavigationReturning}',
  'onReturnAnimationEnd={() => setMobileNavigationReturning(false)}',
  "const showMap = useCallback(() => {\n    model.setTab('map');",
  "if (tab === 'map' && model.tab !== 'map')",
  "{model.tab === 'map' ? children : (",
  '<MobileWorkspacePageSheet',
  'pageKey={model.tab}',
  'requestCloseRef={mobilePageCloseRef}',
]);

requireAll('src/components/shell/MobileBottomNavigation.tsx', [
  'workspaceSheetOpen: boolean;',
  'returning: boolean;',
  'workspaceSheetHidden={workspaceSheetOpen}',
  'navigationReturning={returning}',
  'onReturnAnimationEnd={onReturnAnimationEnd}',
]);

requireAll('src/components/shell/MobileBottomNavigationFrame.tsx', [
  'workspaceSheetHidden = false',
  'navigationReturning = false',
  'aria-hidden={workspaceSheetHidden || undefined}',
  'inert={workspaceSheetHidden || undefined}',
  "data-workspace-sheet-hidden={workspaceSheetHidden ? 'true' : 'false'}",
  "data-navigation-returning={navigationReturning ? 'true' : 'false'}",
  "event.animationName === 'mobile-bottom-navigation-return'",
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
  'const [detailStack, setDetailStack]',
  'const activeDetail = detailStack[detailStack.length - 1] ?? null;',
  'registerDetail',
  'unregisterDetail',
  'requestDetailClose',
  "headerSelector: '.mobile-detail-sheet-drag-handle, .page-fixed-header'",
  "contentSelector: '.mobile-detail-sheet-scroll, .page-card-scroll'",
  "offsetProperty: '--mobile-detail-sheet-drag-offset'",
  'const visualViewport = window.visualViewport;',
  "document.querySelector<HTMLElement>('.asset-bar')",
  "getPropertyValue('--mobile-content-gap')",
  'Math.min(viewportHeight * 0.88, 760, availableHeight)',
  "window.visualViewport?.addEventListener('resize', updateSheetMaxHeight)",
  "document.querySelector<HTMLElement>('.page-scroll')",
  "pageScroll.style.overflowY = 'hidden'",
  "pageScrollArea.dataset.modalScrollbarSuppressed = 'true'",
  "if (event.key !== 'Escape') return;",
  'className="mobile-detail-sheet-backdrop"',
  'className="mobile-detail-sheet mobile-workspace-sheet-host"',
  'data-mobile-workspace-sheet-host="true"',
  'data-page-key={pageKey}',
  'role="dialog"',
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
  'aria-modal="true"',
  "if (event.key !== 'Tab') return;",
  'handleSheetProgress',
  '--mobile-detail-sheet-backdrop-progress',
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

requireAll('src/styles/mobile-detail-sheet.css', [
  'root sheet owns\n * the only mobile blur surface while the outside backdrop stays visually clear.',
  '.mobile-detail-sheet-backdrop {',
  'isolation: auto;',
  '-webkit-backdrop-filter: none;',
  'backdrop-filter: none;',
  '.mobile-detail-sheet {',
  'background: var(--frosted-glass-background);',
  '-webkit-backdrop-filter: var(--frosted-glass-filter);',
  'backdrop-filter: var(--frosted-glass-filter);',
  ".mobile-workspace-sheet-page-layer[aria-hidden='true']",
  'visibility: hidden;',
  '.mobile-workspace-sheet-detail-view {',
  'background: transparent;',
  '.workspace-dialog-layer > .mobile-detail-sheet-backdrop',
  '@keyframes mobile-workspace-sheet-detail-open',
]);
forbidAll('src/styles/mobile-detail-sheet.css', [
  '.mobile-detail-sheet-backdrop::before',
  '--mobile-detail-sheet-backdrop-progress',
  'backdrop-filter: blur(8px)',
  '.mobile-workspace-page-sheet',
  '--mobile-workspace-page-sheet-drag-offset',
]);

requireAll('src/styles/mobile-status-navigation.css', [
  ".mobile-bottom-navigation[data-workspace-sheet-hidden='true']",
  'visibility: hidden;',
  'pointer-events: none;',
  ".mobile-bottom-navigation[data-workspace-sheet-hidden='false'][data-navigation-returning='true']",
  '@keyframes mobile-bottom-navigation-return',
  '280ms cubic-bezier(.2, .8, .2, 1)',
  '@media (max-width: 720px) and (prefers-reduced-motion: reduce)',
]);

requireAll('src/styles/mobile-status-layout.css', [
  '.signed-in-shell__chrome {\n    z-index: 3001;',
  ".workspace-dialog-layer > .notification-panel-layer[data-notification-layer='dialog']",
  'z-index: 10;',
  'var(--mobile-status-top-inset)',
]);

requireAll('src/components/notifications/NotificationCenter.tsx', [
  'useWorkspaceDialogLayer',
  'const mobile = useMobileNotificationSurface();',
  'const targetLayer = mobile ? dialogLayer : floatingLayer;',
  "window.addEventListener('keydown', onKeyDown, true);",
  'event.stopPropagation();',
  "data-notification-layer={mobile ? 'dialog' : 'floating'}",
  'targetLayer,',
]);

const main = read('src/main.tsx');
assert.ok(
  main.indexOf("import './styles/mobile-status-layout.css';")
    > main.indexOf("import './styles/mobile-detail-sheet.css';"),
  'mobile-status-layout.css 必须在 mobile-detail-sheet.css 后加载以保证状态栏和通知层高于 Sheet',
);

requireAll('tests/browser/mobile-workspace-overlay.spec.ts', [
  'mobile sheet blurs only itself while status chrome stays clear and interactive',
  'expect(geometry.backdropFilter).toBe(\'none\');',
  'expect(geometry.sheetBackdropFilter).not.toBe(\'none\');',
  'expect(geometry.statusIsTopmost).toBe(true);',
  "expect(navigation).toHaveAttribute('data-workspace-sheet-hidden', 'true');",
  "expect(navigation).toHaveAttribute('data-navigation-returning', 'true');",
]);

requireAll('tests/browser/notification-center.spec.ts', [
  'mobile notification panel overlays an open workspace sheet without leaving an island mounted',
  "expect(panelLayer).toHaveAttribute('data-notification-layer', 'dialog');",
  "await expect(page.locator('.notification-island')).toHaveCount(0);",
  'expect(geometry.panelAboveSheet).toBe(true);',
  'expect(geometry.statusIsTopmost).toBe(true);',
]);

requireAll('tests/browser/mobile-navigation-scrollbar.spec.ts', [
  'mobile navigation stays mounted but hidden while a sheet is open and animates back after close',
  "await expect(navigationHost).toHaveAttribute('aria-hidden', 'true');",
  "await expect(navigationHost).toHaveAttribute('data-navigation-returning', 'true');",
  "expect(returningAnimation).toContain('mobile-bottom-navigation-return');",
]);

requireAll('docs/UI_DESIGN_SYSTEM.md', [
  '唯一根级 Mobile Workspace Sheet',
  'Sheet 自身承担唯一移动毛玻璃模糊',
  '移动底部导航必须始终保留同一个 DOM 实例',
]);
requireAll('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', [
  '通知面板作为 Chrome 级临时覆盖层始终位于 Sheet 之上',
  '通知面板打开期间不得挂载通知岛',
  '移动底栏在根 Sheet 存在时继续保持同一 DOM，但必须隐藏并退出交互树',
]);
requireAll('docs/LIQUID_GLASS_CHROME_DESIGN.md', [
  'Sheet 外部区域不得压暗或模糊',
  '状态栏始终位于 Sheet 与通知面板之上',
  '通知灵动岛同系弹性进入动画',
  '物理根 Sheet 独占 Pointer／Touch 手势监听',
]);

console.log('移动唯一 Sheet 自身毛玻璃、透明外部、状态/通知上层与导航隐藏恢复动画验证通过。');
