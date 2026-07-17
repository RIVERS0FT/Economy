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

const routerPath = 'src/pages/PageRouter.tsx';
const overviewPath = 'src/pages/OverviewPage.tsx';
const chartPath = 'src/components/charts/PriceSparkline.tsx';
const gameAppPath = 'src/app/GameApp.tsx';
const shellPath = 'src/components/shell/GameShell.tsx';
const sidebarPath = 'src/components/shell/DesktopSidebar.tsx';
const statusBarPath = 'src/components/shell/StatusBar.tsx';
const stylePath = 'src/styles/overview.css';
const sidebarStylePath = 'src/styles/desktop-sidebar.css';
const browserHarnessPath = 'tests/browser/runtime-harness.tsx';
const browserSpecPath = 'tests/browser/runtime.spec.ts';
const mainPath = 'src/main.tsx';
const pageDesignPath = 'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md';
const uiDesignPath = 'docs/UI_DESIGN_SYSTEM.md';
const layoutIntegrityDesignPath = 'docs/OVERVIEW_LAYOUT_INTEGRITY_DESIGN.md';
const packagePath = 'package.json';

[
  routerPath,
  overviewPath,
  chartPath,
  gameAppPath,
  shellPath,
  sidebarPath,
  statusBarPath,
  stylePath,
  sidebarStylePath,
  browserHarnessPath,
  browserSpecPath,
  mainPath,
  pageDesignPath,
  uiDesignPath,
  layoutIntegrityDesignPath,
  packagePath,
].forEach(requireFile);

for (const text of [
  "import { useEffect, useState } from 'react'",
  "const [overviewProductId, setOverviewProductId] = useState(() => model.game.products[0]?.id ?? '')",
  'model.game.products.some((product) => product.id === overviewProductId)',
  'overviewProductId={overviewProductId}',
  'onOverviewProductChange={setOverviewProductId}',
]) requireText(routerPath, text);

for (const text of ['localStorage', 'sessionStorage', 'marketAssetId']) forbidText(routerPath, text);

for (const text of [
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
  'title="生产摘要"',
  'title="资产构成"',
  '<strong>本周资金变化</strong>',
  'title="当前挂单"',
  'label="买单"',
  'label="卖单"',
  'theoreticalDailyOutput',
  'home-grid',
  'overview-primary-grid',
  "selectMarketAsset('commodity', overviewMarket.product.id)",
]) requireText(overviewPath, text);

for (const text of [
  'title="基础工作"',
  'wealth-total',
  'label="当前总资产"',
  'formatRank',
  'overview-summary-row span-3',
  '<MetricCard',
  '当前浏览器最近成交',
  'overview-product-strip',
]) forbidText(overviewPath, text);

for (const text of [
  "variant === 'compact' ? 'clamp(168px, 20vw, 210px)'",
  "textAnchor={variant === 'compact' ? 'middle' : 'end'}",
  "transform={variant === 'compact' ? undefined : `rotate(-45 ${x} ${xLabelY})`}",
]) requireText(chartPath, text);

for (const text of [
  '--overview-primary-card-height: 330px;',
  '--overview-summary-card-height: 320px;',
  'grid-template-columns: minmax(0, 1fr);',
  'container: overview / inline-size;',
  'grid-template-columns: minmax(320px, 5fr) minmax(0, 7fr);',
  '.overview-primary-grid .widget-heading h2',
  'white-space: nowrap;',
  '@media (max-width: 1199px)',
  '@media (max-width: 760px)',
  '@container overview (max-width: 1050px)',
  '@container overview (max-width: 580px)',
  'grid-template-columns: repeat(2, minmax(0, 1fr));',
  '.overview-open-orders-card {',
  'grid-column: 1 / -1;',
  'overflow-y: visible;',
  '.overview-market-empty {',
]) requireText(stylePath, text);

for (const text of ['384px', 'overscroll-behavior: contain']) forbidText(stylePath, text);

for (const text of [
  'const [sidebarCollapsed, setSidebarCollapsed] = useState(false)',
  "sidebarCollapsed ? 'game-shell sidebar-collapsed' : 'game-shell'",
  'onToggleCollapsed={() => setSidebarCollapsed((current) => !current)}',
]) requireText(shellPath, text);

for (const text of [
  "aria-label={collapsed ? '展开侧栏' : '折叠侧栏'}",
  'aria-expanded={!collapsed}',
  "data-collapsed={collapsed ? 'true' : 'false'}",
]) requireText(sidebarPath, text);

for (const text of [
  '.game-shell.sidebar-collapsed {',
  'grid-template-columns: 78px minmax(0, 1fr);',
  '.sidebar-collapse-button:focus-visible',
  '@media (max-width: 960px)',
]) requireText(sidebarStylePath, text);

for (const text of [
  'onClick?: () => void;',
  "if (item.onClick) classNames.push('asset-bar-item--interactive')",
  "aria-label={`${item.label}，打开详情`}",
]) requireText(statusBarPath, text);

for (const text of [
  "id: 'credits'",
  "id: 'assets'",
  "id: 'gems'",
  "id: 'rank'",
  "id: 'warehouse'",
  "const weeklyTrend = weeklyChange > 0 ? '↑' : weeklyChange < 0 ? '↓' : '→'",
  "onClick: () => model.setTab('assets')",
]) requireText(gameAppPath, text);

const gameApp = read(gameAppPath);
const statusOrder = ["id: 'credits'", "id: 'assets'", "id: 'gems'", "id: 'rank'", "id: 'warehouse'"];
for (let index = 1; index < statusOrder.length; index += 1) {
  if (gameApp.indexOf(statusOrder[index - 1]) >= gameApp.indexOf(statusOrder[index])) {
    failures.push('src/app/GameApp.tsx 状态栏顺序必须为可用资金／总资产／宝石／排行榜／仓库剩余');
    break;
  }
}

for (const text of [
  "view === 'overview' ? <OverviewHarness /> : <SettingsHarness />",
  "scenario === 'activity'",
  "scenario === 'alerts'",
  '<GameShell model={model} statusItems={statusItems}>',
]) requireText(browserHarnessPath, text);

for (const text of [
  'overview prioritizes business decisions and uses a compact market empty state',
  'overview spans the available desktop width without compressing cards into strips',
  'overview renders the real market chart only when activity exists',
  'overview keeps the decision rows visible and adapts to a narrower desktop',
  'desktop sidebar collapse recomputes overview columns from the real content width',
  "page.setViewportSize({ width: 1684, height: 931 })",
  "page.setViewportSize({ width: 1440, height: 900 })",
  "page.setViewportSize({ width: 900, height: 1000 })",
  "page.setViewportSize({ width: 1280, height: 900 })",
  "page.locator('.home-grid')",
  'getBoundingClientRect()',
  'scrollWidth > element.clientWidth + 1',
  "page.getByTestId('overview-market-empty')",
  "page.getByRole('button', { name: '折叠侧栏' })",
  'expect.poll',
]) requireText(browserSpecPath, text);

for (const text of [
  '概览是经营决策首页',
  '宽度比例为 `5:7`',
  '卡片高度约 `330px`',
  '既无近期成交也无有效挂单时必须显示',
  '宽度不小于 `1200px`',
  '统一约 `320px` 高',
  '`1920×1080`',
  '`1440×900`',
  '不得重复状态栏已经显示的总资产和排名',
  '桌面侧栏在宽屏提供显式折叠按钮',
]) requireText(pageDesignPath, text);

for (const text of [
  '## 10. 概览布局',
  '经营决策优先',
  '桌面按 `5:7` 分栏',
  '约 `330px` 高',
  '不得渲染大面积空坐标系',
  '宽度不小于 `1200px`',
  '约 `320px` 高',
  '资产构成不得重复状态栏中的总资产或排名',
  '宽屏桌面侧栏必须提供键盘可操作的显式折叠按钮',
]) requireText(uiDesignPath, text);

for (const text of [
  '外层轨道唯一性',
  'grid-template-columns: minmax(0, 1fr);',
  '实际内容宽度响应式',
  '大于 `1050px`',
  '不大于 `580px`',
  '`1684×931`',
  'getBoundingClientRect()',
  'scrollWidth',
  '不得保留嵌套纵向滚动',
]) requireText(layoutIntegrityDesignPath, text);

for (const path of [pageDesignPath, uiDesignPath, layoutIntegrityDesignPath]) forbidText(path, '统一为 `384px` 高');

requireText(mainPath, "import './styles/overview.css'");
requireText(packagePath, 'node scripts/verify-overview-content.mjs');

if (failures.length > 0) {
  console.error('概览经营决策布局验证失败:\n- ' + failures.join('\n- '));
  process.exit(1);
}

console.log('概览验证通过：外层单轨、真实内容宽度响应式、经营提醒、市场空状态、状态栏入口、可折叠侧栏与浏览器几何回归满足设计基线。');
