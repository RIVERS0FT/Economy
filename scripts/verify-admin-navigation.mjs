import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const failures = [];

function requireText(path, fragments) {
  const content = read(path);
  for (const fragment of fragments) {
    if (!content.includes(fragment)) failures.push(`${path} 缺少管理员统一导航规则: ${fragment}`);
  }
}

function forbidText(path, fragments) {
  const content = read(path);
  for (const fragment of fragments) {
    if (content.includes(fragment)) failures.push(`${path} 不得恢复管理员独立移动导航: ${fragment}`);
  }
}

requireText('src/components/shell/MobileBottomNavigationFrame.tsx', [
  "variant=\"mobileNavigation\"",
  'mobile-bottom-navigation__viewport',
  'data-navigation-surface={surfaceId}',
]);
requireText('src/components/shell/MobileBottomNavigation.tsx', [
  "import { MobileBottomNavigationFrame } from './MobileBottomNavigationFrame'",
  '<MobileBottomNavigationFrame',
  'surfaceId="game-mobile-navigation"',
]);
requireText('src/components/shell/AdminSidebar.tsx', [
  "import { MobileBottomNavigationFrame } from './MobileBottomNavigationFrame'",
  'className="admin-mobile-bottom-navigation"',
  'surfaceId="admin-mobile-navigation"',
  'navLabel="管理员移动导航"',
]);
forbidText('src/components/shell/AdminSidebar.tsx', [
  'className="admin-mobile-navigation panel"',
  '<nav className="admin-mobile-navigation',
  "from '../ui/LiquidGlassSurface'",
]);
requireText('src/styles/admin-navigation.css', [
  '.admin-workspace',
  'padding-inline-start: max(var(--mobile-workspace-gutter), env(safe-area-inset-left));',
  'var(--mobile-nav-height)',
  'var(--mobile-nav-gap)',
  '.admin-mobile-bottom-navigation',
]);
requireText('src/main.tsx', [
  "import './styles/unified-market-admin.css';",
  "import './styles/admin-navigation.css';",
]);
requireText('tests/browser/admin-runtime.spec.ts', [
  '.admin-mobile-bottom-navigation',
  '.liquid-glass-surface',
  'scrollPaddingBottom',
  'expect(geometry.navHeight).toBe(68);',
]);
requireText('docs/GIFT_CODE_AND_ADMIN_DESIGN.md', [
  '桌面端复用统一 `SidebarFrame`',
  '移动端复用统一 `MobileBottomNavigationFrame`',
  '不得恢复顶部横向 `panel` 导航条',
]);

if (failures.length) {
  console.error(`管理员导航验证失败:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}

console.log('管理员导航验证通过：桌面统一侧栏与移动统一液态玻璃底栏均已锁定。');
