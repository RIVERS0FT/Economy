import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const failures = [];

function requireText(path, fragments) {
  const content = read(path);
  for (const fragment of fragments) {
    if (!content.includes(fragment)) failures.push(`${path} 缺少管理员共享外壳或运营控制台规则: ${fragment}`);
  }
}

function forbidText(path, fragments) {
  const content = read(path);
  for (const fragment of fragments) {
    if (content.includes(fragment)) failures.push(`${path} 不得恢复管理员独立外壳或旧式后台布局: ${fragment}`);
  }
}

requireText('src/components/shell/MobileBottomNavigationFrame.tsx', [
  'variant="mobileNavigation"',
  'mobile-bottom-navigation__viewport',
  'data-navigation-surface={surfaceId}',
]);
requireText('src/components/shell/MobileBottomNavigation.tsx', [
  "import { MobileBottomNavigationFrame } from './MobileBottomNavigationFrame'",
  '<MobileBottomNavigationFrame',
  'surfaceId="game-mobile-navigation"',
]);
requireText('src/components/shell/SignedInShell.tsx', [
  "import { ScrollArea } from '../ui/ScrollArea'",
  "'signed-in-shell'",
  'className="mobile-page-overlay"',
  "'mobile-chrome-overlay'",
  'className="page-scroll-area"',
  "'page-scroll'",
  "data-admin-mobile-chrome={adminChromeLayer ? 'true' : undefined}",
]);
requireText('src/components/shell/AdminSidebar.tsx', [
  "import { MobileBottomNavigationFrame } from './MobileBottomNavigationFrame'",
  'className="admin-mobile-bottom-navigation"',
  'surfaceId="admin-mobile-navigation"',
  'navLabel="管理员移动导航"',
]);
requireText('src/components/shell/AdminSidebar.tsx', [
  "export type AdminSectionId = 'overview' | 'community' | 'gift-codes' | 'bans';",
  "{ id: 'overview', label: '概况'",
  "{ id: 'community', label: '社区'",
  "{ id: 'gift-codes', label: '礼品码'",
  "{ id: 'bans', label: '账号封禁'",
]);
forbidText('src/components/shell/AdminSidebar.tsx', [
  'collectibles',
  '藏品',
]);
forbidText('src/components/shell/AdminSidebar.tsx', [
  "import { createPortal } from 'react-dom'",
  'document.body',
  'className="mobile-chrome-overlay admin-mobile-chrome-layer"',
  'className="admin-mobile-navigation panel"',
  '<nav className="admin-mobile-navigation',
  "from '../ui/LiquidGlassSurface'",
  'style={{ zIndex:',
]);
requireText('src/components/shell/AdminDesktopBar.tsx', [
  "import { LiquidGlassSurface } from '../ui/LiquidGlassSurface'",
  'className="asset-bar admin-command-bar"',
  'variant="desktopStatusBar"',
  'className="admin-command-bar-content"',
  '刷新当前分区',
]);
requireText('src/app/AdminApp.tsx', [
  "import { SignedInShell } from '../components/shell/SignedInShell'",
  "import { AdminDesktopBar } from '../components/shell/AdminDesktopBar'",
  '<SignedInShell',
  'rootClassName="admin-shell"',
  'workspaceClassName="admin-workspace"',
  'pageViewportClassName="admin-page-scroll"',
  'pageFrameClassName="admin-page-frame"',
  'chromeOverlayClassName="admin-mobile-chrome-layer"',
  '<AdminDesktopBar',
  '<AdminMobileNavigation',
]);
requireText('src/components/AdminPopulationHealth.tsx', [
  'ADMIN_OVERVIEW_SCHEME: population-health-matrix',
  '人口需求比较矩阵',
  '当前钱包总缺口',
  '食品／家庭',
  'C1—C7 生产工资',
  'max(4px,',
]);
requireText('src/components/AdminPopulationControl.tsx', [
  "import { AdminPopulationHealth } from './AdminPopulationHealth'",
  '<AdminPopulationHealth economy={economy} />',
  '展开拟应用政策',
  '当前政策',
  '总持续时间',
  '参数不设业务上限',
]);
forbidText('src/components/AdminPopulationControl.tsx', [
  '查看全部记录',
  '人口调控记录',
  '管理备注',
]);
requireText('src/styles/admin-overview-density.css', [
  'ADMIN_OVERVIEW_SCHEME: population-health-matrix',
  '.admin-population-matrix',
  '.admin-population-health-grid',
  '.admin-population-control__workspace',
  '@media (max-width: 720px)',
]);
forbidText('src/app/AdminApp.tsx', [
  '<section className="admin-workspace">',
  '<div className="admin-page-scroll">',
]);
requireText('src/components/AdminBanPanel.tsx', [
  "import { VirtualList } from './ui/VirtualList'",
  'function incidentKey(incident: BanIncidentSummary)',
  '<VirtualList',
  'className="admin-ban-incidents admin-ban-incidents-virtual-list"',
  'estimateSize={78}',
]);
forbidText('src/components/AdminBanPanel.tsx', [
  'incidents.map(',
]);
requireText('src/styles/admin-navigation.css', [
  'ADMIN_CONSOLE_SCHEME: command-center',
  '.admin-command-bar-content {',
  '.admin-page-frame .page-heading {',
  'display: none;',
  '@media (min-width: 1180px)',
  '.admin-section-stack:has(.admin-gift-create)',
  'grid-template-columns: minmax(320px, .72fr) minmax(0, 1.68fr);',
  'top: var(--desktop-page-top-offset);',
  '.admin-ban-incidents-column',
  '.admin-ban-incidents .virtual-list__item > button',
  '@media (max-width: 720px)',
  '.admin-command-bar {',
  '.admin-page-scroll {',
  'var(--mobile-nav-height)',
  'var(--mobile-nav-gap)',
  '.admin-mobile-chrome-layer .admin-mobile-bottom-navigation',
]);
forbidText('src/styles/admin-navigation.css', [
  'max-width: 1600px;',
  'position: sticky;\n    top: 0;',
  'top: 112px;',
  '.admin-workspace {',
  '.admin-mobile-chrome-layer {\n    position:',
  'position: fixed;',
]);
requireText('src/styles/game-shell-layout.css', [
  '.signed-in-shell.sidebar-layout',
  '.signed-in-shell .asset-bar',
  '.signed-in-shell .page-scroll-area',
  '.signed-in-shell .page-content',
  '--desktop-layout-gutter: var(--space-3);',
  '--desktop-page-top-offset',
]);
requireText('src/styles/viewport.css', [
  'html[data-app-surface="admin"]',
  '.signed-in-shell {',
  '.mobile-page-overlay {',
  'order: 1;',
  '.mobile-chrome-overlay {',
  'order: 2;',
]);
forbidText('src/styles/unified-market-admin.css', [
  '.admin-shell {\n  position: fixed;',
  '.admin-page-scroll {\n  min-width: 0;\n  min-height: 0;\n  overflow: auto;',
  'max-width: 1440px;',
  '.admin-mobile-navigation {',
]);
requireText('src/main.tsx', [
  "import './styles/game-shell-layout.css';",
  "import './styles/unified-market-admin.css';",
  "import './styles/admin-navigation.css';",
]);
requireText('tests/browser/admin-runtime.spec.ts', [
  '.admin-mobile-bottom-navigation',
  '.admin-mobile-chrome-layer',
  '.admin-command-bar',
  '.liquid-glass-surface--desktopStatusBar',
  'scrollPaddingBottom',
  'chromeLayerInsideWorkspace',
  'chromeLayerOrder',
  'pageLayerOrder',
  'topmostInsideNavigation',
  'visiblePositiveBarWidth',
  'zeroBarWidth',
]);
requireText('docs/GIFT_CODE_AND_ADMIN_DESIGN.md', [
  '桌面端复用统一 `SignedInShell`',
  '桌面玻璃工作栏',
  '移动端复用统一 `MobileBottomNavigationFrame`',
  '不得恢复管理员独立页面滚动视口',
  '运营控制台布局方案',
  '礼品码工作台位于左侧',
  '记录列表与详情位于右侧',
  '`ADMIN_CONSOLE_SCHEME: command-center`',
  '封禁事件继续使用窗口化结构',
  '人口政策区域始终显示服务器当前执行的完整参数',
  '比例条的真实值为正时必须至少保留 4px 可见填充',
]);

if (failures.length) {
  console.error(`管理员导航与运营控制台验证失败:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}

console.log('管理员导航与运营控制台验证通过：桌面共享外壳与玻璃工作栏、人口政策当前参数、正数最小可见比例条、双栏工作台、封禁事件窗口化及移动统一 Chrome 层均已锁定。');
