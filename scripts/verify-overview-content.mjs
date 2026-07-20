import { existsSync, readFileSync } from 'node:fs';
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
const requireAll = (path, texts) => texts.forEach((text) => requireText(path, text));
const forbidAll = (path, texts) => texts.forEach((text) => forbidText(path, text));

const paths = {
  router: 'src/pages/PageRouter.tsx',
  overview: 'src/pages/OverviewPage.tsx',
  chart: 'src/components/charts/PriceSparkline.tsx',
  gameApp: 'src/app/GameApp.tsx',
  shell: 'src/components/shell/GameShell.tsx',
  sidebar: 'src/components/shell/DesktopSidebar.tsx',
  sidebarFrame: 'src/components/shell/SidebarFrame.tsx',
  statusBar: 'src/components/shell/StatusBar.tsx',
  overviewStyle: 'src/styles/overview.css',
  polishStyle: 'src/styles/overview-polish.css',
  sidebarStyle: 'src/styles/desktop-sidebar.css',
  harness: 'tests/browser/runtime-harness.tsx',
  browserSpec: 'tests/browser/runtime.spec.ts',
  main: 'src/main.tsx',
  pageDesign: 'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
  uiDesign: 'docs/UI_DESIGN_SYSTEM.md',
  integrityDesign: 'docs/OVERVIEW_LAYOUT_INTEGRITY_DESIGN.md',
  package: 'package.json',
};
Object.values(paths).forEach(requireFile);

requireAll(paths.router, [
  "import { lazy, Suspense, useEffect, useState } from 'react'",
  "const OverviewPage = lazy(() => import('./OverviewPage')",
  "const [overviewProductId, setOverviewProductId] = useState(() => model.game.products[0]?.id ?? '')",
  'model.game.products.some((product) => product.id === overviewProductId)',
  'overviewProductId={overviewProductId}',
  'onOverviewProductChange={setOverviewProductId}',
]);
forbidAll(paths.router, ['localStorage', 'sessionStorage', 'marketAssetId']);

requireAll(paths.overview, [
  'function greetingForHour(hour: number)',
  'new Date(now).getHours()',
  'title="今日经营"',
  '<strong>经营提醒</strong>',
  'const visibleAlerts = businessAlerts.slice(0, 3)',
  "id: 'warehouse-full'",
  "id: `facility-error-${group.facilityTypeId}`",
  "id: 'open-orders'",
  'const primaryAction = ownOpenOrders.length > 0',
  'hasMarketActivity: history.length > 0 || bestBid > 0 || bestAsk > 0',
  'data-testid="overview-market-empty"',
  '暂无有效挂单或近期成交',
  '<PriceSparkline buckets={overviewMarket.buckets} variant="compact" />',
  "tone={overviewMarket.bestBid ? 'success' : 'neutral'}",
  "tone={overviewMarket.bestAsk ? 'danger' : 'neutral'}",
  '当前只有买单，暂无可供买入的卖单',
  '当前只有卖单，暂无可立即成交的买单',
  '当前买卖价差',
  'data-testid="overview-market-order-state"',
  'event.cashDelta !== 0',
  'const recentCashEvents',
  '当前设备现金记录',
  '本周暂无现金收入或支出记录。',
  'overview-open-orders-list--scrollable',
  'title="生产摘要"',
  'title="资产构成"',
  'title="当前挂单"',
  'theoreticalDailyOutput',
  'home-grid',
  'overview-primary-grid',
]);
forbidAll(paths.overview, [
  'title="基础工作"',
  'wealth-total',
  'label="当前总资产"',
  'formatRank',
  '<MetricCard',
  '当前浏览器最近成交',
  'overview-product-strip',
  '资产状态更新',
  '当前浏览器记录',
]);

requireAll(paths.chart, [
  'const compactGeometry',
  'height: 228,',
  'function compactAxisLabelIndexes',
  "const priceTickCount = variant === 'compact' ? 3 : 5;",
  "const volumeTicks = variant === 'compact' ? [maxVolume, 0]",
  'className="chart-x-tick-label"',
  'className="chart-price-tick-label"',
  'className="chart-volume-tick-label"',
  'className="chart-legend-item"',
  "style={variant === 'full' ? { height: 'clamp(320px, 42vw, 410px)' } : undefined}",
  "textAnchor={variant === 'compact' ? 'middle' : 'end'}",
  "transform={variant === 'compact' ? undefined : `rotate(-45 ${x} ${xLabelY})`}",
]);
forbidAll(paths.chart, ["variant === 'compact' ? 'clamp(168px, 20vw, 210px)'", 'const height = 540;']);

requireAll(paths.overviewStyle, [
  '--overview-primary-card-height: 330px;',
  '--overview-summary-card-height: 320px;',
  'grid-template-columns: minmax(0, 1fr);',
  'container: overview / inline-size;',
  'grid-template-columns: minmax(320px, 5fr) minmax(0, 7fr);',
  '@container overview (max-width: 1050px)',
  '@container overview (max-width: 580px)',
  'overflow-y: visible;',
]);
forbidAll(paths.overviewStyle, ['384px', 'overscroll-behavior: contain']);

requireAll(paths.polishStyle, [
  '--overview-primary-card-height: 370px;',
  '--overview-summary-card-height: 330px;',
  '.market-summary .price-chart.compact {',
  'height: auto;',
  'aspect-ratio: 80 / 19;',
  '.overview-market-order-state {',
  '.overview-alert-list,',
  '.overview-asset-events,',
  '.overview-open-orders-list--scrollable {',
  'overflow-y: auto;',
  'font-size: max(var(--font-size-xs), 0.75rem);',
]);
forbidAll(paths.polishStyle, ['clamp(168px, 20vw, 210px)', '.overview-asset-events {\n  overflow-y: auto;']);

requireAll(paths.shell, [
  'const [sidebarCollapsed, setSidebarCollapsed] = useState(false)',
  "sidebarCollapsed ? 'game-shell sidebar-layout sidebar-collapsed' : 'game-shell sidebar-layout'",
  'onToggleCollapsed={() => setSidebarCollapsed((current) => !current)}',
]);
requireAll(paths.sidebarFrame, [
  'className="sidebar-logo-expand-button"',
  'aria-label="展开侧栏"',
  'aria-expanded="false"',
  'aria-label="折叠侧栏"',
  'aria-expanded="true"',
]);
requireAll(paths.sidebarStyle, [
  '.sidebar-layout.sidebar-collapsed {',
  '--desktop-sidebar-collapsed-width: 78px;',
  'grid-template-columns: var(--sidebar-column-width) minmax(0, 1fr);',
  '.desktop-sidebar[data-collapsed="true"] .sidebar-logo-expand-button:hover',
  '.desktop-sidebar[data-collapsed="true"] .sidebar-logo-expand-button:focus-visible',
  '.desktop-sidebar button:hover:not(:disabled)',
  '@media (max-width: 960px)',
]);
forbidAll(paths.sidebarStyle, ['right: -11px;']);
requireAll(paths.statusBar, ['onClick?: () => void;', "if (item.onClick) classNames.push('asset-bar-item--interactive')", "aria-label={`${item.label}，打开详情`}"]);

requireAll(paths.gameApp, [
  "id: 'credits'", "id: 'assets'", "id: 'gems'", "id: 'rank'", "id: 'warehouse'",
  "const weeklyTrend = weeklyChange > 0 ? '↑' : weeklyChange < 0 ? '↓' : '→'",
  'const weeklyMagnitude = Math.abs(weeklyChange);',
  '本周资产下降',
  'aria-label={weeklyChangeLabel}',
]);
const gameApp = read(paths.gameApp);
const statusOrder = ["id: 'credits'", "id: 'assets'", "id: 'gems'", "id: 'rank'", "id: 'warehouse'"];
for (let index = 1; index < statusOrder.length; index += 1) {
  if (gameApp.indexOf(statusOrder[index - 1]) >= gameApp.indexOf(statusOrder[index])) {
    failures.push('src/app/GameApp.tsx 状态栏顺序必须为可用资金／总资产／宝石／排行榜／仓库剩余');
    break;
  }
}

requireAll(paths.harness, [
  "view === 'overview'",
  '<OverviewHarness />',
  '<SettingsHarness />',
  "['activity', 'two-sided', 'many-orders'].includes(scenario)",
  "scenario === 'alerts'",
  "scenario !== 'cash-empty'",
  "scenario === 'cash-three'",
  '服务器资产状态已同步',
  'cashDelta: 0',
  "import '../../src/styles/overview-polish.css';",
]);

requireAll(paths.browserSpec, [
  'overview prioritizes business decisions and uses a compact market empty state',
  'overview spans the available desktop width without compressing cards into strips',
  'compact overview chart fills the market card without label collisions',
  'overview market empty values stay neutral and explain one-sided order books',
  'overview cash changes exclude synchronization events and short lists do not scroll',
  'overview only scrolls the order list after the visible capacity is exceeded',
  'overview keeps the decision rows visible and adapts to a narrower desktop',
  'desktop sidebar collapse recomputes overview columns from the real content width',
  'midpointAnchors',
  'expandButtonAfterHover',
  'async function expectNoPairOverlap',
  'async function expectElementsInside',
  "page.setViewportSize({ width: 1684, height: 931 })",
  "page.locator('.overview-asset-events')",
  "page.getByTestId('overview-market-order-state')",
  'scrollWidth > element.clientWidth + 1',
]);

requireAll(paths.pageDesign, ['概览是经营决策首页', '宽度比例为 `5:7`', '既无近期成交也无有效挂单时必须显示', '`1920×1080`', '`1440×900`']);
requireAll(paths.uiDesign, ['## 10. 概览布局', '经营决策优先', '桌面按 `5:7` 分栏', '不得渲染大面积空坐标系']);
requireAll(paths.integrityDesign, [
  '外层轨道唯一性',
  '实际内容宽度响应式',
  '`960×228`',
  '最多显示 6 个',
  '缺少买价或卖价时',
  '`cashDelta !== 0`',
  '当前设备现金记录',
  '不得同时显示下降箭头和负号',
  '`1684×931`',
  'getBoundingClientRect()',
  '超过三条时',
]);
for (const path of [paths.pageDesign, paths.uiDesign, paths.integrityDesign]) forbidText(path, '统一为 `384px` 高');

requireText(paths.main, "import './styles/overview.css'");
requireText(paths.main, "import './styles/overview-polish.css'");
requireText(paths.package, 'node scripts/verify-overview-content.mjs');

if (failures.length > 0) {
  console.error('概览经营决策布局验证失败:\n- ' + failures.join('\n- '));
  process.exit(1);
}

console.log('概览验证通过：外层单轨、紧凑图表几何、市场空值、现金事件、短列表滚动、状态栏趋势与浏览器碰撞回归满足设计基线。');
