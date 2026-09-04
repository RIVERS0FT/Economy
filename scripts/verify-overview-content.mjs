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
  eventLog: 'src/components/EconomicEventLogPanel.tsx',
  strategicWorkspace: 'src/components/shell/StrategicWorkspace.tsx',
  outliner: 'src/components/outliner/StrategicOutliner.tsx',
  guide: 'src/components/GameGuideStrip.tsx',
  chart: 'src/components/charts/PriceSparkline.tsx',
  gameApp: 'src/app/GameApp.tsx',
  shell: 'src/components/shell/GameShell.tsx',
  sharedShell: 'src/components/shell/SignedInShell.tsx',
  sidebar: 'src/components/shell/DesktopSidebar.tsx',
  sidebarFrame: 'src/components/shell/SidebarFrame.tsx',
  statusBar: 'src/components/shell/StatusBar.tsx',
  overviewStyle: 'src/styles/overview.css',
  eventLogStyle: 'src/styles/economic-event-log.css',
  polishStyle: 'src/styles/overview-polish.css',
  guideStyle: 'src/styles/game-guide.css',
  sidebarStyle: 'src/styles/desktop-sidebar.css',
  shellLayoutStyle: 'src/styles/game-shell-layout.css',
  strategicStyle: 'src/styles/strategic-game-shell.css',
  outlinerStyle: 'src/styles/strategic-outliner.css',
  mobileStatusStyle: 'src/styles/mobile-status-layout.css',
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
  "import { lazy, Suspense, type ReactNode } from 'react'",
  "const OverviewPage = lazy(() => import('./OverviewPage')",
  'renderPage = () => <OverviewPage model={model} />',
  'home: [',
  "'player.identity'",
  "'player.assets'",
  "'player.production'",
  "'player.progression'",
  "'market.orders'",
  "'market.quotes'",
  "'market.calendar'",
]);
forbidAll(paths.router, ['localStorage', 'sessionStorage', 'marketAssetId']);

requireAll(paths.overview, [
  'title="概览"',
  'className="overview-dashboard-shell"',
  'title="本周签到"',
  'action={(',
  'className="overview-check-in-status"',
  'role="list" aria-label="本周签到日历"',
  'weeklyBonusEligible',
  '签到领取 1 宝石',
  '本周全勤奖励已领取',
  'title="生产摘要"',
  'title="资产与银行"',
  "title=\"资产与银行\" action={<Button variant=\"text\" onClick={() => setTab('bank')}>查看详情</Button>}",
  '<strong>资产状态</strong>',
  '<span>服务器权威结果</span>',
  'label="可支配资产"',
  'label="冻结资产"',
  'label="贷款负债"',
  'theoreticalDailyOutput',
  'home-grid',
]);
forbidAll(paths.overview, [
  'GameGuideStrip',
  'StrategicOutliner',
  'overview-mobile-tutorial',
  '进入市场',
  'EconomicEventLogPanel',
  '公开经济事件',
  'greetingForHour',
  'new Date(now).getHours()',
  'title="今日经营"',
  'title="基础工作"',
  'OverviewWorkButton',
  'overview-today-panel',
  'overview-alert-list',
  'businessAlerts',
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
  '连续签到 7 天可额外获得 5 宝石',
  '签到日期由服务器按北京时间判定，不支持补签。',
  '/ 7 天',
  'title="当前挂单"',
  'overview-open-orders-list',
  '管理订单',
]);
requireAll(paths.strategicWorkspace, [
  'export function StrategicWorkspaceChrome',
  'const outlinerModel = strategicOutlinerModel(model);',
  '<StrategicOutliner',
  'model={outlinerModel}',
  'tutorial={tutorial}',
  'pendingItems={pendingItems}',
]);
forbidAll(paths.strategicWorkspace, [
  'strategic-economic-event-rail',
  '<EconomicEventLogPanel',
  "model.tab === 'home' && tutorial",
]);
requireAll(paths.outliner, [
  'className="strategic-outliner"',
  "data-tutorial-visible={showTutorial ? 'true' : 'false'}",
  'data-event-log-visible="true"',
  'id="tutorial"',
  'id="activity"',
  'id="pinned"',
  'id="events"',
  '<GameGuideStrip tutorial={tutorial} variant="outliner" />',
  'economicCalendar?.events',
  'pendingItems.map',
]);
requireAll(paths.eventLog, [
  'className="economic-event-log-title"',
  'aria-label="近期与未来七天公开经济事件日志"',
  '<details',
  '<summary>',
  '距离开始还有',
  'className="economic-event-log-details"',
  'eventMarketFeedback(markets, event.productIds, event.startsAt, event.endsAt, event.id)',
  '<LiveServerTime referenceNow={referenceNow}>',
]);
forbidAll(paths.eventLog, [
  '<WidgetHeading',
  '<StatusTag',
  'className="economic-event-log-note"',
]);
requireAll(paths.guide, [
  "variant?: 'panel' | 'outliner'",
  'game-guide-strip--outliner',
  "'game-guide-strip panel'",
  'role="progressbar"',
  'aria-label="教程总体进度"',
  '步骤 {tutorial.currentStepIndex}/{tutorial.totalSteps}',
  'tutorial.openCurrentTarget',
  '>跳过</Button>',
  'tutorial.skip?.()',
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
  '--overview-summary-card-height: 320px;',
  '.overview-dashboard-shell {',
  'container: overview / inline-size;',
  '@container overview (max-width: 1050px)',
  '@container overview (max-width: 580px)',
  'overflow-y: visible;',
  '.overview-check-in-status {',
]);
forbidAll(paths.overviewStyle, [
  '384px',
  'overscroll-behavior: contain',
  '.overview-today-panel',
  '.overview-alert-list',
  '.overview-work-button',
  '.overview-primary-grid',
]);
requireAll(paths.eventLogStyle, [
  '.economic-event-log-panel {',
  'grid-template-rows: auto minmax(0, 1fr);',
  '.economic-event-log-list {',
  'overflow-y: auto;',
  '.economic-event-log-entry summary {',
  '.economic-event-log-details {',
]);

requireAll(paths.polishStyle, [
  '--overview-summary-card-height: 330px;',
  '.overview-check-in-day small {',
]);
forbidAll(paths.polishStyle, ['clamp(168px, 20vw, 210px)', '.overview-asset-events {\n  overflow-y: auto;']);
requireAll(paths.guideStyle, ['.game-guide-strip {', '.game-guide-strip--outliner', '.game-guide-progress {', '@media (max-width: 720px)']);
forbidAll(paths.guideStyle, [
  'border: 1px solid color-mix(in srgb, var(--accent, #4f7cff)',
  'background: color-mix(in srgb, var(--accent, #4f7cff) 8%',
]);

requireAll(paths.shell, [
  'const [sidebarCollapsed, setSidebarCollapsed] = useState(true)',
  "useGameAuthorityDependencies(['player.identity', 'player.assets', 'leaderboard'])",
  '<SignedInShell',
  "rootClassName={`game-shell strategic-game-shell strategic-tab-${model.tab}`}",
  'sidebarCollapsed={sidebarCollapsed}',
  'onToggleCollapsed={() => setSidebarCollapsed((current) => !current)}',
  '<StrategicWorkspaceChrome',
  'pendingItems={notificationCenter.pendingItems}',
]);
forbidAll(paths.shell, ['StartingProvinceOverview', 'startingProvincePicking', 'startingProvinceCandidateId', 'onPickStartingProvince']);
requireAll(paths.sharedShell, [
  "sidebarCollapsed && 'sidebar-collapsed'",
  "'signed-in-shell'",
  "'sidebar-layout'",
  'integratedPrimaryCard = false',
  '<FrostedGlassSurface variant="workspaceCard" className="signed-in-shell__primary-card">',
]);
requireAll(paths.sidebarFrame, [
  'onMouseEnter={expand}',
  'onMouseLeave={collapse}',
  'onFocusCapture={expand}',
  'onBlurCapture={handleBlur}',
]);
forbidAll(paths.sidebarFrame, [
  'sidebar-logo-expand-button',
  'sidebar-collapse-button',
  'aria-label="展开侧栏"',
  'aria-label="折叠侧栏"',
]);
requireAll(paths.sidebarStyle, [
  '.sidebar-layout.sidebar-collapsed {',
  '--desktop-sidebar-collapsed-width: 78px;',
  '.desktop-sidebar[data-collapsed="true"] .sidebar-nav-button strong',
  '.desktop-sidebar[data-collapsed="true"] .sidebar-footer-action strong',
  '.desktop-sidebar button:hover:not(:disabled)',
]);
forbidAll(paths.sidebarStyle, ['sidebar-logo-expand-button', 'sidebar-collapse-button']);
requireAll(paths.shellLayoutStyle, ['.signed-in-shell__body {', 'grid-template-columns:', 'var(--sidebar-column-width)']);
requireAll(paths.strategicStyle, [
  '--strategic-compact-page-width: 56rem;',
  'calc(100vw / 3),',
  '.game-shell .signed-in-shell__primary-card {',
  '.strategic-page-host--building > .page-content,',
  '.game-shell .signed-in-shell__primary-card .desktop-sidebar::after {',
  '.strategic-outliner {',
  '--strategic-outliner-width: clamp(280px, 21vw, 320px);',
  '100% - var(--strategic-outliner-reserved-width) - var(--strategic-panel-gap) * 3',
]);
requireAll(paths.outlinerStyle, [
  '.strategic-outliner {',
  'z-index: 2;',
  '.strategic-outliner__scroll {',
  'overscroll-behavior-y: auto;',
  'visibility: hidden;',
  '--strategic-outliner-reserved-width: 0px;',
]);
forbidAll(paths.strategicStyle, [
  '--strategic-outliner-collapsed-width',
  '.strategic-outliner[data-collapsed=',
  '.strategic-outliner__collapse',
  '.strategic-outliner__collapsed-map',
  '.game-shell.strategic-tab-research .signed-in-shell__primary-card {',
  '--strategic-inspector-width',
  '.strategic-province-inspector',
  '.strategic-economic-event-rail',
]);
requireAll(paths.mobileStatusStyle, [
  '--mobile-below-status-top: calc(',
  ".game-shell .strategic-outliner[data-tutorial-visible='true']",
  'top: var(--mobile-below-status-top);',
  '.strategic-outliner-section:not(.strategic-outliner-section--tutorial)',
]);
forbidAll(paths.sidebarStyle, ['right: -11px;']);
requireAll(paths.statusBar, ['onClick?: () => void;', "if (item.onClick) classNames.push('asset-bar-item--interactive')", "aria-label={`${item.label}，打开详情`}"]);

requireAll(paths.shell, [
  "id: 'credits'", "id: 'assets'", "id: 'gems'", "id: 'rank'", "id: 'warehouse'",
  "const weeklyTrendDirection = weeklyChange > 0 ? 'up' : weeklyChange < 0 ? 'down' : 'right';",
  '<ChevronIcon direction={weeklyTrendDirection} />',
  'const weeklyMagnitude = Math.abs(weeklyChange);',
  '本周净资产下降',
  'aria-label={weeklyChangeLabel}',
]);
const shell = read(paths.shell);
const statusOrder = ["id: 'credits'", "id: 'assets'", "id: 'gems'", "id: 'rank'", "id: 'warehouse'"];
for (let index = 1; index < statusOrder.length; index += 1) {
  if (shell.indexOf(statusOrder[index - 1]) >= shell.indexOf(statusOrder[index])) {
    failures.push('src/components/shell/GameShell.tsx 状态栏顺序必须为可用资金／总资产／宝石／排行榜／仓库库存');
    break;
  }
}
forbidAll(paths.gameApp, [
  'const statusItems = useMemo<StatusBarItem[]>',
  "id: 'credits'",
  "id: 'assets'",
  "id: 'gems'",
  "id: 'rank'",
]);

requireAll(paths.harness, [
  "view === 'overview'",
  '<OverviewHarness />',
  '<SettingsHarness />',
  "['activity', 'two-sided', 'many-orders'].includes(scenario)",
  "scenario === 'alerts'",
  "scenario === 'tutorial' ? activeTutorial : completedTutorial",
  "import '../../src/styles/overview-polish.css';",
]);

requireAll(paths.browserSpec, [
  'overview prioritizes business decisions and shows the weekly check-in calendar',
  'public economic events stay compact until explicitly expanded',
  'page title stays fixed while only the page card body scrolls',
  'strategic outliner stays outside overview content and owns tutorial and public events',
  'overview uses a building-style panel beside the strategic outliner',
  'overview check-in calendar distinguishes claimed, today, missed, and future days',
  'overview shows completed and partial-week attendance states',
  'overview check-in calendar preserves seven columns on mobile',
  'overview shows authoritative asset status and opens the bank page',
  'overview only scrolls the order list after the visible capacity is exceeded',
  'overview keeps the decision rows visible and adapts to a narrower desktop',
  'compact desktop keeps QQ group and settings footer actions visible',
  'desktop command rail expansion overlays the integrated card without reflowing overview or outliner',
  "page.locator('.strategic-outliner')",
  "page.locator('.page-content .strategic-outliner')",
  "page.setViewportSize({ width: 1684, height: 931 })",
  "page.getByRole('list', { name: '本周签到日历' })",
  "checkInHeading.getByRole('button', { name: '签到领取 1 宝石' })",
  "page.getByText(/\\d+ \\/ 7 天/)).toHaveCount(0)",
  'scrollWidth > element.clientWidth + 1',
  "getByRole('heading', { name: '今日经营', exact: true })).toHaveCount(0)",
  "getByRole('dialog', { name: '通知' })",
]);

requireAll(paths.pageDesign, [
  '概览是经营决策首页',
  '`StrategicWorkspaceChrome` 的统一战略追踪器',
  '战略追踪器与页面路由生命周期解耦',
  '签到日历',
  '`1920×1080`',
  '`1440×900`',
  '桌面教程固定显示在战略追踪器顶部',
]);
requireAll(paths.uiDesign, ['## 10. 概览布局', '经营决策优先', '签到日历']);
requireAll(paths.integrityDesign, [
  '概览位于玩家外壳唯一毛玻璃 `workspaceCard` 的左侧页面区域',
  '结构性 `Panel`',
  '不得因为外层 `workspaceCard` 使用毛玻璃而恢复毛玻璃背景、blur、阴影或圆角子卡',
  '桌面工作区右侧：StrategicWorkspaceChrome → StrategicOutliner',
  '移动工作区顶部：同一 StrategicOutliner DOM',
  '教程属于 `StrategicOutliner`',
  '概览不得重新创建 `.overview-mobile-tutorial`',
  '移动教程所在工作区层低于根级 Mobile Workspace Sheet',
  '`.strategic-outliner` 不得成为 `.page-content`',
  '签到日历',
  '资产与银行',
  '可支配资产、冻结资产和贷款负债',
  '`1684×931`',
  '`390×844`',
  'Outliner 保持完整宽度且不存在整体 `data-collapsed` 或 `44px` 收起轨道',
  '侧栏悬浮展开覆盖概览但不改变页面和战略追踪器几何',
]);
for (const path of [paths.pageDesign, paths.uiDesign, paths.integrityDesign]) forbidText(path, '统一为 `384px` 高');

requireText(paths.main, "import './styles/overview.css'");
requireText(paths.main, "import './styles/overview-polish.css'");
requireText(paths.main, "import './styles/strategic-outliner.css'");
requireText(paths.package, 'node scripts/verify-overview-content.mjs');

if (failures.length > 0) {
  console.error('概览经营决策布局验证失败:\n- ' + failures.join('\n- '));
  process.exit(1);
}

console.log('概览验证通过：共享外壳折叠、桌面战略追踪器、移动同一 Outliner 教程、签到日历、服务器日期语义、权威资产状态、子切片依赖、状态栏趋势与浏览器碰撞回归满足设计基线。');
