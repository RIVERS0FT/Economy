import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const failures = [];
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const requireFile = (path) => { if (!existsSync(resolve(root, path))) failures.push(`缺少文件: ${path}`); };
const requireText = (path, text) => { if (!read(path).includes(text)) failures.push(`${path} 缺少: ${text}`); };
const forbidText = (path, text) => { if (read(path).includes(text)) failures.push(`${path} 不应包含: ${text}`); };

const paths = {
  modality: 'src/utils/inputModality.ts',
  scrollArea: 'src/components/ui/ScrollArea.tsx',
  hook: 'src/hooks/useOverlayScrollbar.ts',
  styles: 'src/styles/scrollbars.css',
  performance: 'src/styles/performance.css',
  mobileNavigation: 'src/styles/mobile-status-navigation.css',
  market: 'src/pages/MarketPage.tsx',
  marketStyles: 'src/styles/market-page-polish.css',
  sharedMarketStyles: 'src/styles/unified-market-admin.css',
  virtualHook: 'src/hooks/useVirtualWindow.ts',
  virtualList: 'src/components/ui/VirtualList.tsx',
  virtualTable: 'src/components/ui/VirtualRecordTable.tsx',
  layout: 'src/components/ui/layout.tsx',
  shell: 'src/components/shell/SignedInShell.tsx',
  gameShell: 'src/components/shell/GameShell.tsx',
  adminApp: 'src/app/AdminApp.tsx',
  status: 'src/components/shell/StatusBar.tsx',
  mobile: 'src/components/shell/MobileBottomNavigation.tsx',
  facilitySheet: 'src/components/ui/MobileWorkspaceDetailSheet.tsx',
  facilitySheetStyles: 'src/styles/mobile-detail-sheet.css',
  design: 'docs/UI_DESIGN_SYSTEM.md',
  localDesign: 'docs/LOCAL_ACTIVITY_LOG_DESIGN.md',
  browser: 'tests/browser/scroll-input-modality.spec.ts',
  facilityBrowser: 'tests/browser/mobile-detail-sheet.spec.ts',
};
Object.values(paths).forEach(requireFile);

if (failures.length === 0) {
  for (const text of [
    'dataset.inputModality',
    "pointerType === 'touch'",
    "publish('mouse')",
    "publish('keyboard')",
    'useSyncExternalStore',
  ]) requireText(paths.modality, text);

  for (const text of [
    'scrollbarVisibility?: ScrollbarVisibility',
    "scrollbarVisibility = 'adaptive'",
    'mouseIdleDelay = 1_200',
    'touchVerticalIdleDelay = 1_600',
    'data-scrollbar-visibility={scrollbarVisibility}',
    'role="scrollbar"',
  ]) requireText(paths.scrollArea, text);

  for (const text of [
    'const MIN_THUMB_SIZE = 44',
    'horizontalHideTimerRef',
    'verticalHideTimerRef',
    "getInputModality() === 'touch'",
    'setPointerCapture',
    'window.requestAnimationFrame(commitPendingDrag)',
    'descendantCanScrollInDirection',
    'event.stopPropagation()',
    'scrollbarTrackPressing',
  ]) requireText(paths.hook, text);

  for (const text of [
    '--scrollbar-visual-size: 6px;',
    '--scrollbar-hit-size: 14px;',
    '--scrollbar-touch-target-size: 44px;',
    '--scrollbar-min-thumb-size: 44px;',
    'html[data-input-modality="touch"] .ui-scrollbar--horizontal',
    'display: none !important;',
    'html[data-input-modality="touch"] *:not(.ui-scroll-area__viewport)',
    '.mobile-detail-sheet-scroll-area > .ui-scrollbar--vertical',
    'right: env(safe-area-inset-right, 0px);',
    '.page-card-scroll-area > .ui-scrollbar--vertical',
    '.page-card-scroll-area > .ui-scrollbar--vertical .ui-scrollbar__thumb',
  ]) requireText(paths.styles, text);

  for (const text of [
    "import { ScrollArea } from './ScrollArea'",
    'className="mobile-detail-sheet-scroll-area"',
    'viewportClassName="mobile-detail-sheet-scroll"',
    'scrollbarVisibility="adaptive"',
  ]) requireText(paths.facilitySheet, text);
  requireText(paths.facilitySheetStyles, 'padding: var(--space-2) var(--space-3);');
  forbidText(paths.facilitySheetStyles, 'calc(var(--space-3) + var(--scrollbar-hit-size))');
  forbidText(paths.facilitySheetStyles, '.mobile-detail-sheet-scroll-area > .ui-scrollbar--vertical');

  for (const text of [
    'VirtualRecordTable',
    'items={selectedLocalTrades}',
    'className="local-trades-scroll-area"',
  ]) requireText(paths.market, text);

  forbidText(paths.marketStyles, 'scroll-snap-type: x proximity');
  forbidText(paths.marketStyles, 'scroll-behavior: smooth;');
  forbidText(paths.sharedMarketStyles, 'scroll-snap-align: start;');
  forbidText(paths.market, 'horizontalVisibility=');
  forbidText(paths.market, 'virtual-record-viewport');

  for (const text of ['useVirtualWindow', 'axis="both"', 'virtual-record-canvas']) requireText(paths.virtualTable, text);
  for (const text of ['ResizeObserver', 'requestAnimationFrame', 'findVisibleRange']) requireText(paths.virtualHook, text);
  for (const text of ["import { ScrollArea } from './ScrollArea'", 'scrollbarVisibility="adaptive"']) requireText(paths.layout, text);
  for (const text of [
    "import { ScrollArea } from '../ui/ScrollArea'",
    'className="page-scroll-area"',
    "'page-scroll'",
    'scrollbarVisibility="adaptive"',
  ]) requireText(paths.shell, text);
  for (const text of [
    'className="page-card-scroll-area"',
    'viewportClassName="page-card-scroll"',
    'className="page-card-static"',
  ]) requireText(paths.layout, text);
  requireText(paths.design, '研发页是唯一固定正文例外');
  requireText(paths.gameShell, '<SignedInShell');
  for (const text of ['<SignedInShell', 'pageViewportClassName="admin-page-scroll"']) requireText(paths.adminApp, text);

  for (const text of [
    '触控模式下横向项目轨道始终 `display: none`',
    '业务 `ScrollArea` 不得通过 `padding`、`margin` 或宽度计算预留 `--scrollbar-hit-size`',
    '轨道和可见滑块都必须贴紧右边',
    '移动根级 Dialog 内与视口同宽的纵向轨道',
    '市场商品列表不得建立横向主滚动区',
    '单一双轴原生视口',
  ]) requireText(paths.design, text);
  for (const text of ['单一双轴原生滚动视口', '任意数据单元格都必须可以作为原生横向滑动起点']) requireText(paths.localDesign, text);
  for (const text of [
    'desktop market catalog stays within the page card without a horizontal rail',
    'touch input hides horizontal rails while local trade cells keep native two-axis scrolling',
    'mixed input switches scrollbar policy at runtime',
  ]) requireText(paths.browser, text);
  for (const text of [
    'detail scroll area reuses the shared overlay scrollbar geometry',
    'railRightInset',
    'thumbRightInset',
    'paddingRight',
    'paddingLeft',
  ]) requireText(paths.facilityBrowser, text);

  for (const text of ["import { ScrollArea }", '<ScrollArea', 'asset-bar-scroll-area', 'asset-bar-scroll-track']) forbidText(paths.status, text);
  for (const text of ["import { ScrollArea }", '<ScrollArea', 'mobile-navigation-scroll-area']) forbidText(paths.mobile, text);
  forbidText(paths.performance, '.page-scroll,\n.asset-bar,\n.sidebar-nav {\n  -webkit-overflow-scrolling: touch;\n  overscroll-behavior: contain;');
  forbidText(paths.mobileNavigation, '--mobile-scrollbar-edge-escape');
}

if (failures.length > 0) {
  console.error('输入方式滚动条、共享登录后外壳、共享移动详情安全边缘、市场列表无横向主滚动与单一双轴虚拟成交表验证失败：');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('统一尺寸、共享登录后页面滚动、共享移动详情安全边缘、鼠标与触控策略、市场列表无横向主滚动和单一双轴虚拟成交表验证通过。');
