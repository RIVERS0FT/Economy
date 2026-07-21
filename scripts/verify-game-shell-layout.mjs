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
check('src/components/shell/GameShell.tsx', [
  'className="mobile-page-overlay"',
  'className="mobile-chrome-overlay"',
  '<StatusBar items={statusItems} />',
  '<MobileBottomNavigation',
  'className="page-scroll-area"',
  'viewportClassName="page-scroll"',
  'verticalAutoHide',
]);
check('src/styles/viewport.css', [
  '--layout-gutter: var(--mobile-primary-surface-gap);',
  'padding-inline-start: max(var(--mobile-workspace-gutter), env(safe-area-inset-left));',
  'padding-inline-end: max(var(--mobile-workspace-gutter), env(safe-area-inset-right));',
  '.mobile-page-overlay {',
  'overflow: visible;',
  '.mobile-chrome-overlay {',
  'pointer-events: none;',
  'min-height: var(--mobile-asset-bar-height);',
  'max-height: var(--mobile-asset-bar-height);',
  'position: absolute;',
  'min-height: var(--mobile-nav-height);',
  'max-height: var(--mobile-nav-height);',
]);
check('src/styles/mobile-status-navigation.css', [
  '--mobile-workspace-gutter: var(--space-3);',
  '--mobile-primary-surface-gap: var(--mobile-workspace-gutter);',
  '--mobile-asset-bar-height: 48px;',
  '--mobile-nav-height: 68px;',
]);
check('src/styles/mobile-status-layout.css', [
  '.asset-bar {',
  'padding: 0;',
  'display: block;',
  'overflow: visible;',
  'min-height: var(--mobile-asset-bar-height);',
  'max-height: var(--mobile-asset-bar-height);',
]);
check('src/styles/desktop-sidebar.css', [
  '.desktop-sidebar .sidebar-nav {',
  'align-content: start;',
  'grid-auto-rows: max-content;',
]);
check('src/styles/scrollbars.css', [
  '.page-scroll-area {',
  'overflow: visible;',
  '.page-scroll-area > .ui-scrollbar--vertical {',
  'position: fixed;',
  'top: var(--scrollbar-edge-offset);',
  'right: env(safe-area-inset-right, 0px);',
  'bottom: var(--scrollbar-edge-offset);',
  'transform: none;',
  '.page-scroll-area > .ui-scrollbar--vertical .ui-scrollbar__thumb {',
  'right: var(--scrollbar-edge-offset);',
  'left: auto;',
]);
check('src/styles/performance.css', [
  '.page-scroll {',
  'overscroll-behavior: auto;',
  'overscroll-behavior-x: contain;',
  'overscroll-behavior-y: auto;',
]);
forbid('src/styles/mobile-status-navigation.css', [
  '--mobile-workspace-inline-end',
  '--mobile-scrollbar-edge-escape',
  '.page-scroll {\n  overscroll-behavior: contain;',
]);
forbid('src/styles/scrollbars.css', [
  'asset-bar-scroll-area',
  'asset-bar-scroll-track',
  'translateX(var(--mobile-scrollbar-edge-escape))',
]);
forbid('src/components/shell/StatusBar.tsx', [
  "import { ScrollArea }",
  '<ScrollArea',
  'asset-bar-scroll-area',
  'asset-bar-scroll-track',
]);
forbid('src/styles/viewport.css', ['asset-bar-scroll-area', 'asset-bar-scroll-track']);
forbid('src/styles/game-shell-layout.css', ['asset-bar-scroll-area', 'asset-bar-scroll-track']);
forbid('src/styles/performance.css', ['.page-scroll,\n.asset-bar,\n.sidebar-nav {\n  -webkit-overflow-scrolling: touch;\n  overscroll-behavior: contain;']);
forbid('src/styles/viewport.css', ['position: fixed;\n    right: 0;\n    bottom: max(var(--mobile-chrome-block-inset)']);
check('docs/LIQUID_GLASS_CHROME_DESIGN.md', [
  '桌面应用外壳几何',
  '--desktop-shell-outer-inset',
  '固定到视口安全边缘',
  'right: env(safe-area-inset-right, 0px)',
  'iOS 工具栏式清透厚玻璃',
  '两者使用同一 `40px` 胶囊圆角',
  '顶部状态栏不得包含 `ScrollArea`',
]);
check('docs/UI_DESIGN_SYSTEM.md', [
  '统一覆盖式滚动条',
  '桌面侧栏导航网格必须从顶部开始排列',
  '不得使用 `overscroll-behavior: contain` 阻断纵向滚动链',
  '移动页面纵向轨道固定到视口安全边缘',
]);
check('tests/browser/game-shell-layout.spec.ts', [
  'desktop navigation rows keep intrinsic height and stack from the top',
  "expect(geometry.alignContent).toBe('start')",
  "expect(geometry.gridAutoRows).toBe('max-content')",
]);
check('tests/browser/mobile-workspace-overlay.spec.ts', [
  'mobile page scrollbar reaches the safe right edge without changing content width',
  'viewportRight - geometry.thumbRight',
  "toBe('40px')",
]);

if (failures.length) {
  console.error('游戏外壳布局架构验证失败:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('游戏外壳桌面导航、固定状态栏、移动双层 Overlay、玻璃共线、统一 40px 清透厚玻璃胶囊、视口安全边缘滚动条与纵向滚动链验证通过。');
