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
  guide: 'src/components/GameGuideStrip.tsx',
  chart: 'src/components/charts/PriceSparkline.tsx',
  gameApp: 'src/app/GameApp.tsx',
  shell: 'src/components/shell/GameShell.tsx',
  sharedShell: 'src/components/shell/SignedInShell.tsx',
  sidebar: 'src/components/shell/DesktopSidebar.tsx',
  sidebarFrame: 'src/components/shell/SidebarFrame.tsx',
  statusBar: 'src/components/shell/StatusBar.tsx',
  overviewStyle: 'src/styles/overview.css',
  polishStyle: 'src/styles/overview-polish.css',
  guideStyle: 'src/styles/game-guide.css',
  sidebarStyle: 'src/styles/desktop-sidebar.css',
  shellLayoutStyle: 'src/styles/game-shell-layout.css',
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
  "import { lazy, Suspense } from 'react'",
  "const OverviewPage = lazy(() => import('./OverviewPage')",
  'page = <OverviewPage model={model} />',
]);
forbidAll(paths.router, ['localStorage', 'sessionStorage', 'marketAssetId']);

requireAll(paths.overview, [
  'function greetingForHour(hour: number)',
  'new Date(now).getHours()',
  'title="今日经营"',
  '<GameGuideStrip tutorial={model.tutorial} />',
  '<strong>经营提醒</strong>',
  'const visibleAlerts = businessAlerts.slice(0, model.tutorial.isVisible ? 2 : 3)',
  "id: 'warehouse-full'",
  "id: `facility-error-${group.facilityTypeId}`",
  "id: 'open-orders'",
  'const primaryAction = ownOpenOrders.length > 0',
  'title="本周签到"',
  'role="list" aria-label="本周签到日历"',
  'weeklyBonusEligible',
  '签到领取 1 宝石',
  '本周全勤奖励已领取',
  'overview-open-orders-list--scrollable',
  'title="生产摘要"',
  'title="资产与银行"',
  "title=\"资产与银行\" action={<Button variant=\"text\" onClick={() => setTab('bank')}>查看详情</Button>}",
  '<strong>资产状态</strong>',
  '<span>服务器权威结果</span>',
  'label="可支配资产"',
  'label="冻结资产"',
  'label="贷款负债"',
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
  'market-summary',
  'overviewMarket',
  'PriceSparkline',
  '资产状态更新',
  '当前浏览器记录',
]);
requireAll(paths.guide, [
  'role="progressbar"',
  '步骤 {tutorial.currentStepIndex}/{tutorial.totalSteps}',
  'tutorial.openCurrentTarget',
  'tutorial.hide',
]);

requireAll(paths.chart, [
  "import { EconomyChart } from './EconomyChart'",
  'export function buildMarketChartGeometry',
  'export function buildIntegerPriceScale',
  'export function buildIntegerVolumeScale',
  "type: 'line'",
  "type: 'bar'",
  'volumeHeight / Math.max(1, dataAreaHeight)',
  'Math.max(48, rootFontSize',
  'className="market-chart-legend-item buy"',
  'className="market-chart-legend-item sell"',
  'data-volume-share={geometry.volumeShare.toFixed(4)}',
]);
forbidAll(paths.chart, [
  '<svg', '<polyline', '<rect',
  "variant === 'compact' ? 'clamp(168px, 20vw, 210px)'",
  'const height = 540;',
]);

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
  '.overview-open-orders-list--scrollable {',
  'overflow-y: auto;',
  '.overview-check-in-day small {',
]);
forbidAll(paths.polishStyle, ['clamp(168px, 20vw, 210px)', '.overview-asset-events {\n  overflow-y: auto;']);
requireAll(paths.guideStyle, ['.game-guide-strip {', '.game-guide-progress {', '@media (max-width: 720px)']);

requireAll(paths.shell, [
  'const [sidebarCollapsed, setSidebarCollapsed] = useState(false)',
  '<SignedInShell',
  'rootClassName="game-shell"',
  'sidebarCollapsed={sidebarCollapsed}',
  'onToggleCollapsed={() => setSidebarCollapsed((current) => !current)}',
]);
requireAll(paths.sharedShell, [
  "sidebarCollapsed && 'sidebar-collapsed'",
  "'signed-in-shell'",
  "'sidebar-layout'",
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
  '.desktop-sidebar[data-collapsed="true"] .sidebar-logo-expand-button:hover',
  '.desktop-sidebar[data-collapsed="true"] .sidebar-logo-expand-button:focus-visible',
  '.desktop-sidebar button:hover:not(:disabled)',
  '@media (max-width: 960px)',
]);
requireAll(paths.shellLayoutStyle, ['.signed-in-shell__body {', 'grid-template-columns:', 'var(--sidebar-column-width)']);
forbidAll(paths.sidebarStyle, ['right: -11px;']);
requireAll(paths.statusBar, ['onClick?: () => void;', "if (item.onClick) classNames.push('asset-bar-item--interactive')", "aria-label={`${item.label}，打开详情`}"]);

requireAll(paths.gameApp, [
  "id: 'credits'", "id: 'assets'", "id: 'gems'", "id: 'rank'", "id: 'warehouse'",
  "const weeklyTrend = weeklyChange > 0 ? '↑' : weeklyChange < 0 ? '↓' : '→'",
  'const weeklyMagnitude = Math.abs(weeklyChange);',
  '本周净资产下降',
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
  "import '../../src/styles/overview-polish.css';",
]);

requireAll(paths.browserSpec, [
  'overview prioritizes business decisions and shows the weekly check-in calendar',
  'overview spans the available desktop width without compressing cards into strips',
  'overview check-in calendar distinguishes claimed, today, missed, and future days',
  'overview shows completed and partial-week attendance states',
  'overview check-in calendar preserves seven columns on mobile',
  'overview shows authoritative asset status and opens the bank page',
  'overview only scrolls the order list after the visible capacity is exceeded',
  'overview keeps the decision rows visible and adapts to a narrower desktop',
  'desktop sidebar collapse recomputes overview columns from the real content width',
  'midpointAnchors',
  'expandButtonAfterHover',
  "page.setViewportSize({ width: 1684, height: 931 })",
  "page.getByRole('list', { name: '本周签到日历' })",
  'scrollWidth > element.clientWidth + 1',
]);

requireAll(paths.pageDesign, ['概览是经营决策首页', '宽度比例为 `5:7`', '签到日历', '`1920×1080`', '`1440×900`', '基础教程显示时']);
requireAll(paths.uiDesign, ['## 10. 概览布局', '经营决策优先', '桌面按 `5:7` 分栏', '签到日历']);
requireAll(paths.integrityDesign, [
  '外层轨道唯一性',
  '实际内容宽度响应式',
  '签到日历',
  '资产与银行',
  '服务器权威的可支配资产、冻结资产和贷款负债',
  '不得同时显示下降箭头和负号',
  '`1684×931`',
  'getBoundingClientRect()',
]);
for (const path of [paths.pageDesign, paths.uiDesign, paths.integrityDesign]) forbidText(path, '统一为 `384px` 高');

requireText(paths.main, "import './styles/overview.css'");
requireText(paths.main, "import './styles/overview-polish.css'");
requireText(paths.package, 'node scripts/verify-overview-content.mjs');

if (failures.length > 0) {
  console.error('概览经营决策布局验证失败:\n- ' + failures.join('\n- '));
  process.exit(1);
}

console.log('概览验证通过：共享外壳折叠、教程提醒容量、签到日历、服务器日期语义、权威资产状态、状态栏趋势与浏览器碰撞回归满足设计基线。');
