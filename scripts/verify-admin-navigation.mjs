import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const failures = [];

function requireText(path, fragments) {
  const content = read(path);
  for (const fragment of fragments) {
    if (!content.includes(fragment)) failures.push(`${path} 缺少管理员统一导航或运营控制台规则: ${fragment}`);
  }
}

function forbidText(path, fragments) {
  const content = read(path);
  for (const fragment of fragments) {
    if (content.includes(fragment)) failures.push(`${path} 不得恢复管理员独立移动导航或旧式后台布局: ${fragment}`);
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
requireText('src/components/shell/AdminSidebar.tsx', [
  "import { createPortal } from 'react-dom'",
  "import { MobileBottomNavigationFrame } from './MobileBottomNavigationFrame'",
  'className="admin-mobile-bottom-navigation"',
  'surfaceId="admin-mobile-navigation"',
  'navLabel="管理员移动导航"',
  'className="mobile-chrome-overlay admin-mobile-chrome-layer"',
  'data-admin-mobile-chrome="true"',
  'document.body',
]);
forbidText('src/components/shell/AdminSidebar.tsx', [
  'className="admin-mobile-navigation panel"',
  '<nav className="admin-mobile-navigation',
  "from '../ui/LiquidGlassSurface'",
  'style={{ zIndex:',
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
  '@media (min-width: 721px)',
  '.admin-page-frame .page-heading {',
  'position: sticky;',
  '@media (min-width: 1180px)',
  '.admin-section-stack:has(.admin-collectible-upload)',
  '.admin-section-stack:has(.admin-gift-create)',
  'grid-template-columns: minmax(320px, .72fr) minmax(0, 1.68fr);',
  '.admin-ban-incidents-column',
  '.admin-ban-incidents .virtual-list__item > button',
  '.admin-workspace',
  'padding-inline-start: max(var(--mobile-workspace-gutter), env(safe-area-inset-left));',
  'var(--mobile-nav-height)',
  'var(--mobile-nav-gap)',
  '.admin-mobile-chrome-layer {',
  'position: fixed;',
  'inset-inline-start: max(var(--mobile-workspace-gutter), env(safe-area-inset-left));',
  'inset-inline-end: max(var(--mobile-workspace-gutter), env(safe-area-inset-right));',
  'pointer-events: none;',
  '.admin-mobile-chrome-layer .admin-mobile-bottom-navigation',
]);
requireText('src/main.tsx', [
  "import './styles/unified-market-admin.css';",
  "import './styles/admin-navigation.css';",
]);
requireText('tests/browser/admin-runtime.spec.ts', [
  '.admin-mobile-bottom-navigation',
  '.admin-mobile-chrome-layer',
  '.liquid-glass-surface',
  'scrollPaddingBottom',
  'chromeLayerAfterRoot',
  'topmostInsideNavigation',
  "expect(geometry.layerZIndex).toBe('auto');",
  'expect(geometry.navHeight).toBe(68);',
]);
requireText('docs/GIFT_CODE_AND_ADMIN_DESIGN.md', [
  '桌面端复用统一 `SidebarFrame`',
  '移动端复用统一 `MobileBottomNavigationFrame`',
  '页面根节点和一级卡片先绘制、管理员 Chrome 后绘制',
  '不得恢复顶部横向 `panel` 导航条',
  '运营控制台布局方案',
  '编辑与创建工作台位于左侧',
  '结果列表与详情位于右侧',
  '`ADMIN_CONSOLE_SCHEME: command-center`',
  '封禁事件继续使用窗口化结构',
]);

if (failures.length) {
  console.error(`管理员导航与运营控制台验证失败:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}

console.log('管理员导航与运营控制台验证通过：桌面统一侧栏、双栏工作台、封禁事件窗口化与移动统一液态玻璃 Chrome 层均已锁定。');
