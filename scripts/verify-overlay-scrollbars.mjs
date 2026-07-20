import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const failures = [];
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const requireFile = (path) => {
  if (!existsSync(resolve(root, path))) failures.push(`缺少文件: ${path}`);
};
const requireText = (path, text) => {
  if (!read(path).includes(text)) failures.push(`${path} 缺少: ${text}`);
};
const forbidText = (path, text) => {
  if (read(path).includes(text)) failures.push(`${path} 不应包含: ${text}`);
};
function walk(path) {
  return readdirSync(resolve(root, path)).flatMap((entry) => {
    const relative = `${path}/${entry}`;
    return statSync(resolve(root, relative)).isDirectory() ? walk(relative) : [relative];
  });
}

const paths = {
  scrollArea: 'src/components/ui/ScrollArea.tsx',
  hook: 'src/hooks/useOverlayScrollbar.ts',
  styles: 'src/styles/scrollbars.css',
  performance: 'src/styles/performance.css',
  mobileNavigation: 'src/styles/mobile-status-navigation.css',
  market: 'src/pages/MarketPage.tsx',
  marketStyles: 'src/styles/market-account-table.css',
  virtualStyles: 'src/styles/virtual-list.css',
  layout: 'src/components/ui/layout.tsx',
  virtualList: 'src/components/ui/VirtualList.tsx',
  shell: 'src/components/shell/GameShell.tsx',
  sidebar: 'src/components/shell/SidebarFrame.tsx',
  status: 'src/components/shell/StatusBar.tsx',
  mobile: 'src/components/shell/MobileBottomNavigation.tsx',
  mobileBrowser: 'tests/browser/mobile-navigation-scrollbar.spec.ts',
  design: 'docs/UI_DESIGN_SYSTEM.md',
  chromeDesign: 'docs/LIQUID_GLASS_CHROME_DESIGN.md',
};

Object.values(paths).forEach(requireFile);

if (failures.length === 0) {
  for (const text of [
    'export interface ScrollAreaProps',
    "axis?: ScrollAxis",
    "horizontalVisibility?: HorizontalScrollbarVisibility",
    'verticalAutoHide?: boolean',
    'idleDelay?: number',
    'verticalPriority?: boolean',
    'data-horizontal-visibility={horizontalVisibility}',
    'role="scrollbar"',
    'aria-orientation="horizontal"',
    'aria-orientation="vertical"',
  ]) requireText(paths.scrollArea, text);

  for (const text of [
    'const MIN_THUMB_SIZE = 28',
    'const AXIS_DOMINANCE_RATIO = 1.25',
    'if (next.top !== previous.top) revealVertical()',
    "horizontalVisibility === 'always'",
    'event.shiftKey',
    'Math.abs(event.deltaX) > Math.abs(event.deltaY) * AXIS_DOMINANCE_RATIO',
    'viewport.scrollTop += event.deltaY',
    'new ResizeObserver(scheduleSync)',
    'window.requestAnimationFrame',
    "window.addEventListener('pointermove', handlePointerMove)",
  ]) requireText(paths.hook, text);
  for (const text of [
    "viewport.addEventListener('pointermove'",
    "viewport.addEventListener('pointerdown'",
    "viewport.addEventListener('focusin'",
  ]) forbidText(paths.hook, text);

  for (const text of [
    '--scrollbar-visual-size: 6px;',
    '--scrollbar-hit-size: 14px;',
    '--scrollbar-edge-offset: 2px;',
    '--scrollbar-min-thumb-size: 28px;',
    '--scrollbar-idle-delay: 1200ms;',
    'scrollbar-width: none;',
    '.ui-scroll-area__viewport::-webkit-scrollbar',
    'width: 0;',
    'height: 0;',
    '.table-wrap {',
    'scrollbar-gutter: auto !important;',
    '[data-horizontal-visibility="always"]',
    '[data-scrollbar-active-y="true"]',
    '.ui-scrollbar--vertical',
    'z-index: 4;',
    '.ui-scrollbar--horizontal',
    'z-index: 3;',
    'right: calc(var(--scrollbar-hit-size) + var(--scrollbar-edge-offset));',
    'position: fixed;',
    'right: env(safe-area-inset-right, 0px);',
    'transform: none;',
  ]) requireText(paths.styles, text);
  for (const text of [
    'translateX(var(--mobile-scrollbar-edge-escape))',
    '--mobile-scrollbar-edge-escape',
  ]) forbidText(paths.styles, text);

  for (const [path, texts] of [
    [paths.layout, ["import { ScrollArea } from './ScrollArea'", 'axis="x"', 'horizontalVisibility="always"']],
    [paths.virtualList, ["import { ScrollArea } from './ScrollArea'", 'axis="y"', 'className="virtual-list-scroll-area"']],
    [paths.shell, ['className="page-scroll-area"', 'viewportClassName="page-scroll"']],
    [paths.sidebar, ['className="sidebar-nav-scroll-area"', 'viewportClassName="sidebar-nav"']],
    [paths.status, ['className="asset-bar-scroll-track"', 'viewportClassName="asset-bar"', 'horizontalVisibility="always"']],
    [paths.mobile, ['className="mobile-navigation-scroll-area"', 'viewportClassName="sidebar-nav"', 'horizontalVisibility="always"']],
  ]) {
    for (const text of texts) requireText(path, text);
  }

  for (const text of [
    '.mobile-navigation-scroll-area > .ui-scrollbar--horizontal {',
    'only its project-owned visual rail is hidden on mobile',
  ]) requireText(paths.mobileNavigation, text);

  for (const text of [
    'mobile navigation hides its scrollbar without disabling horizontal scrolling',
    "toHaveAttribute('data-scrollable-x', 'true')",
    "expect(state.nativeScrollbarWidth).toBe('none')",
    'expect(state.after).toBeGreaterThan(state.before)',
  ]) requireText(paths.mobileBrowser, text);

  for (const text of [
    'className="own-open-orders-table"',
    '<th>资产</th>',
    'className="order-side-cell">方向',
    'className="order-action-cell"',
    'colSpan={7}',
    'className="local-trades-scroll-area"',
    'localTradeAssetName',
    "const historicalPrefix = trade.side === 'buy' ? '买入' : '卖出'",
    'localTradeAssetName(trade)',
    'className="trade-side-cell">方向',
    '手续费 / 实收',
  ]) requireText(paths.market, text);
  for (const text of [
    '<th>类型</th>',
    '<span role="columnheader">类型</span>',
    "orderKind(order) === 'facility' ? '工厂' : '商品'",
  ]) forbidText(paths.market, text);

  for (const text of [
    '.own-open-orders-table .order-action-cell',
    'position: sticky;',
    'right: 0;',
    'width: 76px;',
    '.own-open-orders-table .order-side-cell',
    'width: 60px;',
  ]) requireText(paths.marketStyles, text);
  for (const text of [
    '--virtual-table-columns: minmax(140px, 1.45fr) 60px',
    '--virtual-table-min-width: 760px;',
    '.trade-side-cell',
  ]) requireText(paths.virtualStyles, text);

  for (const text of [
    '统一覆盖式滚动条',
    '有横向溢出时水平滚动条必须常驻可见',
    '没有发生实际滚动位置变化',
    '普通滚轮和以 `deltaY` 为主的触控板输入优先垂直滚动',
    '纵向轨道 `z-index` 更高',
    '移动页面纵向轨道固定到视口安全边缘',
    'right: env(safe-area-inset-right, 0px)',
    '资产｜方向｜价格｜剩余/原始｜状态｜时间｜操作',
    '资产｜方向｜数量｜价格｜总额｜手续费/实收｜时间',
    '撤单按钮必须始终位于横向滚动视口右侧',
    '资产列不得再显示“买入／卖出”前缀',
    '不得使用 `overscroll-behavior: contain` 阻断纵向滚动链',
  ]) requireText(paths.design, text);
  for (const text of [
    '移动底栏隐藏可见水平轨道，但保留触控、触控板、滚轮和键盘横向滚动能力',
    '不得恢复移动底栏可见水平轨道',
  ]) requireText(paths.chromeDesign, text);

  forbidText(paths.performance, '.page-scroll,\n.asset-bar,\n.sidebar-nav {\n  -webkit-overflow-scrolling: touch;\n  overscroll-behavior: contain;');
  forbidText(paths.mobileNavigation, '.page-scroll {\n  overscroll-behavior: contain;');
  forbidText(paths.mobileNavigation, '--mobile-scrollbar-edge-escape');

  const toleratedLegacyGutterFiles = new Set(['src/styles/design-system.css']);
  const styleFiles = walk('src/styles').filter((path) => path.endsWith('.css'));
  for (const path of styleFiles) {
    if (
      path !== paths.styles
      && !toleratedLegacyGutterFiles.has(path)
      && read(path).includes('scrollbar-gutter: stable')
    ) {
      failures.push(`${path} 不得恢复占位式 scrollbar-gutter: stable`);
    }
  }
}

if (failures.length > 0) {
  console.error('统一覆盖式滚动条与订单成交表验证失败：');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('统一覆盖式滚动条、移动底栏隐藏轨道、纵向优先、滚动链、视口安全边缘与订单成交表验证通过。');
