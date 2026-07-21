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
  'className="mobile-notice-region"',
  'className="notice-toast" role="status" aria-live="polite" aria-atomic="true"',
  '<MobileBottomNavigation',
  'className="page-scroll-area"',
  'viewportClassName="page-scroll"',
  'scrollbarVisibility="adaptive"',
]);
const shellContent = read('src/components/shell/GameShell.tsx');
const pageOverlayStart = shellContent.indexOf('className="mobile-page-overlay"');
const pageOverlayEnd = shellContent.indexOf('</div>', pageOverlayStart);
const chromeOverlayStart = shellContent.indexOf('className="mobile-chrome-overlay"');
const statusBarIndex = shellContent.indexOf('<StatusBar items={statusItems} />', chromeOverlayStart);
const noticeRegionIndex = shellContent.indexOf('className="mobile-notice-region"', chromeOverlayStart);
const mobileNavigationIndex = shellContent.indexOf('<MobileBottomNavigation', chromeOverlayStart);
if (!(pageOverlayStart >= 0 && pageOverlayEnd > pageOverlayStart && chromeOverlayStart > pageOverlayEnd)) {
  failures.push('GameShell 的页面 Overlay 与 Chrome Overlay 顺序无效');
}
if (!(statusBarIndex > chromeOverlayStart && noticeRegionIndex > statusBarIndex && mobileNavigationIndex > noticeRegionIndex)) {
  failures.push('移动通知必须位于 Chrome Overlay 内的状态栏之后、底部导航之前');
}
if (noticeRegionIndex > pageOverlayStart && noticeRegionIndex < pageOverlayEnd) {
  failures.push('移动通知不得放回页面 Overlay');
}
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
  '--mobile-status-top-inset: max(var(--mobile-chrome-block-inset), env(safe-area-inset-top));',
  '--mobile-notice-gap: var(--space-2);',
  '--mobile-notice-inline-inset: var(--space-2);',
  '.asset-bar {',
  'padding: 0;',
  'display: block;',
  'overflow: visible;',
  'min-height: var(--mobile-asset-bar-height);',
  'max-height: var(--mobile-asset-bar-height);',
  '.mobile-notice-region {',
  'var(--mobile-status-top-inset)',
  '+ var(--mobile-asset-bar-height)',
  '+ var(--mobile-notice-gap)',
  'right: var(--mobile-notice-inline-inset);',
  'left: var(--mobile-notice-inline-inset);',
  'pointer-events: none;',
  '.mobile-notice-region .notice-toast {',
  'position: static;',
  'z-index: auto;',
  'width: min(100%, 30rem);',
  'transform: none;',
  'white-space: normal;',
]);
check('src/styles/desktop-sidebar.css', [
  '.desktop-sidebar .sidebar-nav {',
  'align-content: start;',
  'grid-auto-rows: max-content;',
]);
check('src/styles/game-shell-layout.css', [
  '--desktop-layout-gutter: var(--space-3);',
  '--desktop-shell-outer-inset: var(--desktop-layout-gutter);',
  '--desktop-sidebar-workspace-gap: var(--desktop-layout-gutter);',
  '--desktop-status-gap: var(--desktop-layout-gutter);',
  '--layout-gutter: var(--desktop-layout-gutter);',
  'top: var(--desktop-layout-gutter);',
  'right: var(--desktop-layout-gutter);',
  '+ var(--desktop-asset-bar-height)',
  'padding: 0 var(--desktop-layout-gutter) var(--desktop-layout-gutter) 0;',
  '.page-scroll-area > .ui-scrollbar--vertical {',
  '.page-scroll-area > .ui-scrollbar--vertical .ui-scrollbar__thumb {',
  'right: 0;',
  'left: auto;',
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
  '--desktop-shell-outer-inset: var(--space-3);',
  '--desktop-sidebar-workspace-gap: var(--desktop-shell-outer-inset);',
  '--desktop-status-gap: var(--space-3);',
  '--desktop-shell-outer-inset: .45rem;',
  'padding: 0 0 var(--space-4);',
]);
forbid('src/styles/liquid-glass-surfaces.css', [
  '--desktop-status-gap:',
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
  '--desktop-layout-gutter',
  '--desktop-shell-outer-inset',
  '普通桌面使用 `12px`',
  '紧凑桌面使用 `8px`',
  '工作区和页面滚动视口继续铺满视口右边缘',
  '页面主滚动条的轨道和可见滑块都使用 `right: 0`',
  '固定到视口安全边缘',
  'right: env(safe-area-inset-right, 0px)',
  'iOS 工具栏式清透厚玻璃',
  '两者使用同一 `40px` 胶囊圆角',
  '顶部状态栏不得包含 `ScrollArea`',
]);
check('docs/README.md', [
  '移动操作结果通知归属 `LIQUID_GLASS_CHROME_DESIGN.md` 与 `GameShell` Chrome Overlay',
  'DOM 必须位于 `StatusBar` 后、`MobileBottomNavigation` 前',
  '安全区顶部 + `48px` 状态栏 + `8px` 间距',
  '不新增液态玻璃实例、不推动页面内容、不拦截状态栏或底栏交互',
  '桌面侧栏外距、侧栏与工作区间距、状态栏外距、状态栏与内容间距、一级卡片间距和页面右／下留白统一读取 `--desktop-layout-gutter`',
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
  'expect(layout.primaryCardGap).toBeCloseTo(gutter, 0)',
  'expect(layout.pageScrollbar.railRight).toBeCloseTo(layout.viewportWidth, 0)',
  'expect(layout.pageScrollbar.thumbRight).toBeCloseTo(layout.viewportWidth, 0)',
  'desktop navigation rows keep intrinsic height and stack from the top',
  "expect(geometry.alignContent).toBe('start')",
  "expect(geometry.gridAutoRows).toBe('max-content')",
]);
check('tests/browser/mobile-workspace-overlay.spec.ts', [
  'mobile notice stays below the status bar without shifting the page',
  'geometry.notice.top - geometry.status.bottom',
  'glassCountAfter',
  'mobile page scrollbar reaches the safe right edge without changing content width',
  'viewportRight - geometry.thumbRight',
  "toBe('40px')",
]);

if (failures.length) {
  console.error('游戏外壳布局架构验证失败:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('游戏外壳统一桌面沟槽、桌面导航、悬浮状态栏、贴边页面滚动条、移动双层 Overlay、状态栏下方通知、玻璃共线、统一 40px 清透厚玻璃胶囊与纵向滚动链验证通过。');
