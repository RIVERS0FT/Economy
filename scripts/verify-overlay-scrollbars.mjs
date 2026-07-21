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
  shell: 'src/components/shell/GameShell.tsx',
  status: 'src/components/shell/StatusBar.tsx',
  mobile: 'src/components/shell/MobileBottomNavigation.tsx',
  design: 'docs/UI_DESIGN_SYSTEM.md',
  localDesign: 'docs/LOCAL_ACTIVITY_LOG_DESIGN.md',
  browser: 'tests/browser/scroll-input-modality.spec.ts',
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
    '--scrollbar-hit-size: 20px;',
    '--scrollbar-touch-target-size: 44px;',
    '--scrollbar-min-thumb-size: 44px;',
    'html[data-input-modality="touch"] .ui-scrollbar--horizontal',
    'display: none !important;',
    'html[data-input-modality="touch"] *:not(.ui-scroll-area__viewport)',
    'right: env(safe-area-inset-right, 0px);',
  ]) requireText(paths.styles, text);

  for (const text of [
    'VirtualRecordTable',
    'scrollbarVisibility="adaptive"',
    'items={localTrades}',
    'className="local-trades-scroll-area"',
  ]) requireText(paths.market, text);

  for (const text of ['scroll-snap-type: none;', 'scroll-behavior: auto;']) requireText(paths.marketStyles, text);
  forbidText(paths.marketStyles, 'scroll-snap-type: x proximity');
  forbidText(paths.marketStyles, 'scroll-behavior: smooth;');
  forbidText(paths.sharedMarketStyles, 'scroll-snap-align: start;');
  forbidText(paths.market, 'horizontalVisibility=');
  forbidText(paths.market, 'virtual-record-viewport');

  for (const text of ['useVirtualWindow', 'axis="both"', 'virtual-record-canvas']) requireText(paths.virtualTable, text);
  for (const text of ['ResizeObserver', 'requestAnimationFrame', 'findVisibleRange']) requireText(paths.virtualHook, text);
  for (const text of ["import { ScrollArea } from './ScrollArea'", 'scrollbarVisibility="adaptive"']) requireText(paths.layout, text);
  for (const text of ['className="page-scroll-area"', 'scrollbarVisibility="adaptive"']) requireText(paths.shell, text);

  for (const text of [
    '顶部状态栏不得包含 `ScrollArea`',
    '触控模式下横向项目轨道始终 `display: none`',
    '市场商品与工厂资产目录必须支持无级滑动',
    '单一双轴原生视口',
  ]) requireText(paths.design, text);
  for (const text of ['单一双轴原生滚动视口', '任意数据单元格都必须可以作为原生横向滑动起点']) requireText(paths.localDesign, text);
  for (const text of [
    'desktop market asset directory supports continuous unsnapped scrolling',
    'touch input hides horizontal rails while local trade cells keep native two-axis scrolling',
    'mixed input switches scrollbar policy at runtime',
  ]) requireText(paths.browser, text);

  for (const text of ["import { ScrollArea }", '<ScrollArea', 'asset-bar-scroll-area', 'asset-bar-scroll-track']) forbidText(paths.status, text);
  for (const text of ["import { ScrollArea }", '<ScrollArea', 'mobile-navigation-scroll-area']) forbidText(paths.mobile, text);
  forbidText(paths.performance, '.page-scroll,\n.asset-bar,\n.sidebar-nav {\n  -webkit-overflow-scrolling: touch;\n  overscroll-behavior: contain;');
  forbidText(paths.mobileNavigation, '--mobile-scrollbar-edge-escape');
}

if (failures.length > 0) {
  console.error('输入方式滚动条、无级资产目录与单一双轴虚拟成交表验证失败：');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('统一尺寸、鼠标与触控策略、隐藏触控横向轨道、无级资产目录和单一双轴虚拟成交表验证通过。');
