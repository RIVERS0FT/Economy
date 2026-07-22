import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const failures = [];
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const check = (path, values) => {
  if (!existsSync(resolve(root, path))) {
    failures.push(`缺少文件: ${path}`);
    return;
  }
  const content = read(path);
  for (const value of values) {
    if (!content.includes(value)) failures.push(`${path} 缺少: ${value}`);
  }
};
const forbid = (path, values) => {
  const content = read(path);
  for (const value of values) {
    if (content.includes(value)) failures.push(`${path} 不应包含: ${value}`);
  }
};

check('src/main.tsx', [
  "import './styles/viewport.css';",
  "import './styles/scrollbars.css';",
  "import './styles/game-shell-layout.css';",
]);
check('src/components/shell/SignedInShell.tsx', [
  "import { ScrollArea } from '../ui/ScrollArea'",
  "'signed-in-shell'",
  'className="mobile-page-overlay"',
  "'mobile-chrome-overlay'",
  'className="page-scroll-area"',
  "'page-scroll'",
  'scrollbarVisibility="adaptive"',
  "data-admin-mobile-chrome={adminChromeLayer ? 'true' : undefined}",
]);
check('src/components/shell/GameShell.tsx', [
  "import { SignedInShell } from './SignedInShell'",
  '<SignedInShell',
  'rootClassName="game-shell"',
  '<StatusBar items={statusItems} />',
  'className="mobile-notice-region"',
  '<MobileBottomNavigation',
]);
check('src/app/AdminApp.tsx', [
  "import { SignedInShell } from '../components/shell/SignedInShell'",
  '<SignedInShell',
  'rootClassName="admin-shell"',
  'workspaceClassName="admin-workspace"',
  'pageViewportClassName="admin-page-scroll"',
  'pageFrameClassName="admin-page-frame"',
  'chromeOverlayClassName="admin-mobile-chrome-layer"',
  '<AdminDesktopBar',
  '<AdminMobileNavigation',
]);

const sharedShell = read('src/components/shell/SignedInShell.tsx');
if (sharedShell.indexOf('className="mobile-page-overlay"') >= sharedShell.indexOf("'mobile-chrome-overlay'")) {
  failures.push('SignedInShell 的页面 Overlay 必须先于 Chrome Overlay');
}
const gameShell = read('src/components/shell/GameShell.tsx');
const statusIndex = gameShell.indexOf('<StatusBar items={statusItems} />');
const noticeIndex = gameShell.indexOf('className="mobile-notice-region"');
const navigationIndex = gameShell.indexOf('<MobileBottomNavigation');
if (!(statusIndex >= 0 && noticeIndex > statusIndex && navigationIndex > noticeIndex)) {
  failures.push('移动通知必须位于状态栏之后、移动导航之前');
}
forbid('src/components/shell/GameShell.tsx', [
  'className="mobile-page-overlay"',
  'className="mobile-chrome-overlay"',
  "import { ScrollArea } from '../ui/ScrollArea'",
]);
forbid('src/app/AdminApp.tsx', [
  '<section className="admin-workspace">',
  '<div className="admin-page-scroll">',
]);

check('src/styles/viewport.css', [
  'html[data-app-surface="admin"]',
  '.signed-in-shell {',
  '--layout-gutter: var(--mobile-primary-surface-gap);',
  'padding-inline-start: max(var(--mobile-workspace-gutter), env(safe-area-inset-left));',
  'padding-inline-end: max(var(--mobile-workspace-gutter), env(safe-area-inset-right));',
  '.mobile-page-overlay {',
  'order: 1;',
  '.mobile-chrome-overlay {',
  'order: 2;',
  'pointer-events: none;',
  'min-height: var(--mobile-asset-bar-height);',
  'max-height: var(--mobile-asset-bar-height);',
  'min-height: var(--mobile-nav-height);',
  'max-height: var(--mobile-nav-height);',
]);
check('src/styles/game-shell-layout.css', [
  '--desktop-layout-gutter: var(--space-3);',
  '.signed-in-shell.sidebar-layout {',
  '--desktop-shell-outer-inset: var(--desktop-layout-gutter);',
  '--desktop-sidebar-workspace-gap: var(--desktop-layout-gutter);',
  '--desktop-status-gap: var(--desktop-layout-gutter);',
  '--layout-gutter: var(--desktop-layout-gutter);',
  '--desktop-page-top-offset:',
  '.signed-in-shell .asset-bar {',
  'top: var(--desktop-layout-gutter);',
  'right: var(--desktop-layout-gutter);',
  '.signed-in-shell .page-scroll-area > .ui-scrollbar--vertical {',
  '.signed-in-shell .page-scroll-area > .ui-scrollbar--vertical .ui-scrollbar__thumb {',
  'padding: 0 var(--desktop-layout-gutter) var(--desktop-layout-gutter) 0;',
  '--desktop-layout-gutter: var(--space-2);',
]);
const desktopLayout = read('src/styles/game-shell-layout.css');
if ((desktopLayout.match(/--desktop-layout-gutter: var\(--space-3\);/g) ?? []).length !== 1) {
  failures.push('普通桌面只能定义一个 12px --desktop-layout-gutter 默认值');
}
if ((desktopLayout.match(/--desktop-layout-gutter: var\(--space-2\);/g) ?? []).length !== 2) {
  failures.push('窄桌面与矮桌面必须统一使用 8px --desktop-layout-gutter');
}
forbid('src/styles/game-shell-layout.css', [
  'html[data-app-surface="game"]',
  '--desktop-shell-outer-inset: var(--space-3);',
  '--desktop-status-gap: var(--space-3);',
  '--desktop-shell-outer-inset: .45rem;',
]);

check('src/styles/admin-navigation.css', [
  '.admin-command-bar-content {',
  '.admin-page-frame .page-heading {',
  'display: none;',
  'top: var(--desktop-page-top-offset);',
  '.admin-page-scroll {',
  '.admin-mobile-chrome-layer .admin-mobile-bottom-navigation',
]);
forbid('src/styles/admin-navigation.css', [
  'max-width: 1600px;',
  'top: 112px;',
  '.admin-workspace {',
  'position: fixed;',
]);
forbid('src/styles/unified-market-admin.css', [
  '.admin-shell {\n  position: fixed;',
  'max-width: 1440px;',
  '.admin-mobile-navigation {',
]);

check('src/styles/scrollbars.css', [
  '.page-scroll-area {',
  'overflow: visible;',
  '.page-scroll-area > .ui-scrollbar--vertical {',
  'position: fixed;',
  'right: env(safe-area-inset-right, 0px);',
  '.page-scroll-area > .ui-scrollbar--vertical .ui-scrollbar__thumb {',
  'right: var(--scrollbar-edge-offset);',
  'left: auto;',
]);
check('src/styles/performance.css', [
  '.page-scroll {',
  'overscroll-behavior-x: contain;',
  'overscroll-behavior-y: auto;',
]);
forbid('src/components/shell/StatusBar.tsx', [
  "import { ScrollArea }",
  '<ScrollArea',
  'asset-bar-scroll-area',
]);

check('docs/LIQUID_GLASS_CHROME_DESIGN.md', [
  '登录后桌面应用外壳几何',
  '`SignedInShell`',
  '游戏端和管理员端',
  '普通桌面使用 `12px`',
  '紧凑桌面使用 `8px`',
  '桌面页面主滚动条的轨道和可见滑块都使用 `right: 0`',
  '固定到视口安全边缘',
  'right: env(safe-area-inset-right, 0px)',
  '顶部状态栏不得包含 `ScrollArea`',
]);
check('docs/README.md', [
  '移动操作结果通知归属 `LIQUID_GLASS_CHROME_DESIGN.md` 与 `GameShell` Chrome Overlay',
  '游戏端与管理员端桌面外壳必须共享 `SignedInShell`',
  '桌面页面主滚动条固定贴合视口右边缘',
]);
check('docs/UI_DESIGN_SYSTEM.md', [
  '统一覆盖式滚动条',
  '桌面侧栏导航网格必须从顶部开始排列',
  '不得使用 `overscroll-behavior: contain` 阻断纵向滚动链',
  '移动页面纵向轨道固定到视口安全边缘',
]);
check('tests/browser/game-shell-layout.spec.ts', [
  'desktop shell uses one 12px gutter for sidebar, status bar, cards and page edges',
  'compact desktop width uses the same 8px gutter everywhere',
  'short desktop height uses the same 8px gutter everywhere',
  'expect(layout.pageScrollbar.railRight).toBeCloseTo(layout.viewportWidth, 0)',
]);
check('tests/browser/admin-runtime.spec.ts', [
  'admin desktop shares the game shell gutter, command bar and edge scrollbar',
  '.admin-command-bar',
  '.liquid-glass-surface--desktopStatusBar',
]);

if (failures.length) {
  console.error(`游戏与管理员共享外壳验证失败:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}

console.log('游戏与管理员共享外壳验证通过：统一桌面沟槽、共享滚动视口、管理员玻璃工作栏、移动 Overlay 与贴边滚动条均已锁定。');
