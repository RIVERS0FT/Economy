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
  glassStyles: 'src/styles/liquid-glass-surfaces.css',
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
    '.mobile-navigation-frame',
    '.mobile-navigation-scroll-area',
  ]) forbidText(paths.styles, text);

  for (const [path, texts] of [
    [paths.layout, ["import { ScrollArea } from './ScrollArea'", 'axis="x"', 'horizontalVisibility="always"']],
    [paths.virtualList, ["import { ScrollArea } from './ScrollArea'", 'axis="y"', 'className="virtual-list-scroll-area"']],
    [paths.shell, ['className="page-scroll-area"', 'viewportClassName="page-scroll"']],
    [paths.sidebar, ['className="sidebar-nav-scroll-area"', 'viewportClassName="sidebar-nav"']],
  ]) {
    for (const text of texts) requireText(path, text);
  }

  for (const text of [
    "import { ScrollArea }",
    '<ScrollArea',
    'asset-bar-scroll-area',
    'asset-bar-scroll-track',
  ]) forbidText(paths.status, text);

  for (const text of [
    'className="asset-bar"',
    '<LiquidGlassSurface variant={surfaceVariant}>',
    'className="asset-bar-content"',
  ]) requireText(paths.status, text);

  for (const text of [
    'className="sidebar mobile-bottom-navigation"',
    '<LiquidGlassSurface variant="mobileNavigation">',
    'className="mobile-bottom-navigation__viewport"',
    '<NavigationItems',
  ]) requireText(paths.mobile, text);
  for (const text of [
    "import { ScrollArea }",
    '<ScrollArea',
    'mobile-navigation-frame',
    'mobile-navigation-scroll-area',
    'horizontalVisibility="always"',
  ]) forbidText(paths.mobile, text);

  for (const text of [
    '.mobile-bottom-navigation {',
    'padding: 0;',
    '.mobile-bottom-navigation__viewport::-webkit-scrollbar',
    '.mobile-bottom-navigation__viewport {',
    'padding-inline: var(--mobile-nav-scroll-gutter);',
    'overflow-x: auto;',
    'overflow-y: hidden;',
    'scrollbar-width: none;',
    '-ms-overflow-style: none;',
    '-webkit-overflow-scrolling: touch;',
    'outline: none;',
    'box-shadow: inset 0 0 0 2px rgba(123, 228, 158, .72);',
    'The semantic nav is the only horizontal scrolling viewport',
  ]) requireText(paths.mobileNavigation, text);
  for (const text of [
    '.mobile-navigation-scroll-area',
    '.mobile-navigation-frame',
    '.mobile-bottom-navigation .sidebar-nav::before',
    '.mobile-bottom-navigation .sidebar-nav::after',
    'outline-offset: 2px;',
  ]) forbidText(paths.mobileNavigation, text);
  for (const text of [
    '.mobile-bottom-navigation .liquid-glass-surface__content {',
    'padding: 8px 0;',
    'only vertical padding owner',
  ]) requireText(paths.glassStyles, text);

  for (const text of [
    'mobile navigation uses one native scroll viewport without clipping its buttons',
    "locator('.mobile-navigation-scroll-area')",
    "locator('.ui-scroll-area')",
    "expect(state.nativeScrollbarWidth).toBe('none')",
    'expect(state.after).toBeGreaterThan(state.before)',
    "expect(state.contentPaddingTop).toBe('8px')",
    'expect(state.activeButtonTop).toBeGreaterThanOrEqual(state.viewportTop - 1)',
    'expect(state.activeButtonBottom).toBeLessThanOrEqual(state.viewportBottom + 1)',
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
    '语义化 `<nav>` 是移动底栏唯一横向滚动视口',
    '不得恢复移动底栏可见水平轨道',
    '不得重新引入 `ScrollArea`',
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
  console.error('统一覆盖式滚动条、固定状态栏、移动导航原生滚动视口与订单成交表验证失败：');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('统一覆盖式滚动条、无活动区状态栏、移动底栏单一原生滚动视口、纵向优先、滚动链、视口安全边缘与订单成交表验证通过。');
