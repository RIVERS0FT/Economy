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

const paths = {
  main: 'src/main.tsx',
  viewport: 'src/styles/viewport.css',
  scrollbars: 'src/styles/scrollbars.css',
  layout: 'src/styles/game-shell-layout.css',
  mobileNavigation: 'src/styles/mobile-status-navigation.css',
  mobileStatus: 'src/styles/mobile-status-layout.css',
  shell: 'src/components/shell/GameShell.tsx',
  scrollArea: 'src/components/ui/ScrollArea.tsx',
  scrollHook: 'src/hooks/useOverlayScrollbar.ts',
  design: 'docs/GAME_SHELL_LAYOUT_DESIGN.md',
  scrollbarDesign: 'docs/OVERLAY_SCROLLBAR_AND_MARKET_ACCOUNT_DESIGN.md',
  browser: 'tests/browser/game-shell-layout.spec.ts',
  mobileBrowser: 'tests/browser/mobile-workspace-overlay.spec.ts',
};

Object.values(paths).forEach(requireFile);

if (failures.length === 0) {
  for (const text of [
    "import './styles/viewport.css';",
    "import './styles/scrollbars.css';",
    "import './styles/game-shell-layout.css';",
  ]) requireText(paths.main, text);

  const main = read(paths.main);
  const viewportIndex = main.indexOf("import './styles/viewport.css';");
  const scrollbarIndex = main.indexOf("import './styles/scrollbars.css';");
  const layoutIndex = main.indexOf("import './styles/game-shell-layout.css';");
  if (!(viewportIndex < scrollbarIndex && scrollbarIndex < layoutIndex)) {
    failures.push('样式顺序必须为 viewport.css -> scrollbars.css -> game-shell-layout.css');
  }

  const layout = read(paths.layout);
  const requiredLayoutPatterns = [
    /--desktop-shell-outer-inset:\s*var\(--space-3\);/,
    /--desktop-sidebar-workspace-gap:\s*var\(--desktop-shell-outer-inset\);/,
    /\.game-shell\.sidebar-layout\s*\{[\s\S]*?grid-template-columns:/,
    /\.game-shell\.sidebar-layout\s*\{[\s\S]*?gap:\s*0;/,
    /\.game-shell\.sidebar-layout\s*\{[\s\S]*?padding:\s*0;/,
    /\.desktop-sidebar\s*\{[\s\S]*?var\(--desktop-shell-outer-inset\)/,
    /\.workspace\s*\{[\s\S]*?margin:\s*0;/,
    /\.workspace\s*\{[\s\S]*?padding:\s*0;/,
    /\.asset-bar-scroll-area\s*\{[\s\S]*?top:\s*var\(--desktop-shell-outer-inset\);/,
    /\.asset-bar-scroll-area\s*\{[\s\S]*?right:\s*var\(--desktop-shell-outer-inset\);/,
    /\.asset-bar-scroll-area\s*\{[\s\S]*?left:\s*0;/,
    /\.asset-bar-scroll-area\s*\{[\s\S]*?width:\s*auto;/,
    /\.page-scroll\s*\{[\s\S]*?padding-top:\s*calc\([\s\S]*?var\(--desktop-shell-outer-inset\)/,
    /\.page-scroll\s*\{[\s\S]*?scroll-padding-top:\s*calc\([\s\S]*?var\(--desktop-shell-outer-inset\)/,
    /\.page-scroll\s*\{[\s\S]*?padding-right:\s*0;/,
    /\.page-scroll\s*\{[\s\S]*?padding-left:\s*0;/,
    /\.page-content\s*\{[\s\S]*?width:\s*100%;/,
    /\.page-content\s*\{[\s\S]*?max-width:\s*none;/,
    /\.page-content\s*\{[\s\S]*?margin:\s*0;/,
    /\.page-content\s*\{[\s\S]*?padding:\s*0 0 var\(--space-4\);/,
  ];
  for (const pattern of requiredLayoutPatterns) {
    if (!pattern.test(layout)) failures.push(`game-shell-layout.css 缺少规则: ${pattern}`);
  }

  for (const text of [
    '--desktop-sidebar-outer-inset',
    'border-radius: 0 0 18px 18px',
    'margin-inline: auto',
    '--content-max-width',
    'ResizeObserver',
  ]) forbidText(paths.layout, text);

  for (const text of [
    "import { ScrollArea } from '../ui/ScrollArea'",
    'className="mobile-page-overlay"',
    'className="mobile-chrome-overlay"',
    '<StatusBar items={statusItems} />',
    '<MobileBottomNavigation',
    'className="page-scroll-area"',
    'viewportClassName="page-scroll"',
    'axis="y"',
    'verticalAutoHide',
    'idleDelay={1_200}',
    "sidebarCollapsed ? 'game-shell sidebar-layout sidebar-collapsed' : 'game-shell sidebar-layout'",
  ]) requireText(paths.shell, text);
  for (const text of [
    'PAGE_SCROLLBAR_IDLE_DELAY_MS',
    'pointermove',
    'pointerdown',
    'focusin',
    'data.scrollbarActive',
  ]) forbidText(paths.shell, text);

  const shell = read(paths.shell);
  const pageOverlayIndex = shell.indexOf('className="mobile-page-overlay"');
  const chromeOverlayIndex = shell.indexOf('className="mobile-chrome-overlay"');
  const statusIndex = shell.indexOf('<StatusBar items={statusItems} />');
  const mobileNavigationIndex = shell.indexOf('<MobileBottomNavigation');
  if (!(pageOverlayIndex >= 0 && chromeOverlayIndex > pageOverlayIndex
    && statusIndex > chromeOverlayIndex && mobileNavigationIndex > statusIndex)) {
    failures.push('GameShell 移动页面层和 Chrome 层的结构或顺序错误');
  }

  const viewport = read(paths.viewport);
  const requiredMobilePatterns = [
    /\.mobile-page-overlay,\s*\n\.mobile-chrome-overlay\s*\{\s*display:\s*contents;/,
    /\.workspace\s*\{[\s\S]*?--layout-gutter:\s*var\(--mobile-primary-surface-gap\);[\s\S]*?display:\s*grid;/,
    /\.workspace\s*\{[\s\S]*?padding-inline-start:\s*max\(var\(--mobile-workspace-gutter\), env\(safe-area-inset-left\)\);/,
    /\.workspace\s*\{[\s\S]*?padding-inline-end:\s*max\(var\(--mobile-workspace-gutter\), env\(safe-area-inset-right\)\);/,
    /\.mobile-page-overlay\s*\{[\s\S]*?z-index:\s*1;[\s\S]*?overflow:\s*visible;/,
    /\.mobile-chrome-overlay\s*\{[\s\S]*?z-index:\s*10;[\s\S]*?pointer-events:\s*none;/,
    /\.page-scroll\s*\{[\s\S]*?padding-right:\s*0;[\s\S]*?padding-left:\s*0;/,
    /\.asset-bar-scroll-area\s*\{[\s\S]*?right:\s*0;[\s\S]*?left:\s*0;[\s\S]*?min-height:\s*var\(--mobile-asset-bar-height\);[\s\S]*?max-height:\s*var\(--mobile-asset-bar-height\);[\s\S]*?pointer-events:\s*auto;/,
    /\.mobile-bottom-navigation\s*\{[\s\S]*?position:\s*absolute;[\s\S]*?right:\s*0;[\s\S]*?left:\s*0;[\s\S]*?min-height:\s*var\(--mobile-nav-height\);[\s\S]*?max-height:\s*var\(--mobile-nav-height\);[\s\S]*?pointer-events:\s*auto;/,
  ];
  for (const pattern of requiredMobilePatterns) {
    if (!pattern.test(viewport)) failures.push(`viewport.css 缺少移动工作区规则: ${pattern}`);
  }
  if (/\.mobile-bottom-navigation\s*\{[\s\S]*?position:\s*fixed;/.test(viewport)) {
    failures.push('移动底栏不得相对视口使用 position: fixed');
  }

  for (const text of [
    '--mobile-workspace-gutter: var(--space-3);',
    '--mobile-primary-surface-gap: var(--mobile-workspace-gutter);',
    '--mobile-chrome-block-inset: var(--space-4);',
    '--mobile-nav-gap: var(--mobile-workspace-gutter);',
    '--mobile-content-gap: var(--mobile-workspace-gutter);',
    '--mobile-scrollbar-edge-escape: max(',
    'calc(var(--mobile-workspace-gutter) - env(safe-area-inset-right))',
  ]) requireText(paths.mobileNavigation, text);
  for (const text of ['--mobile-chrome-inset', '--mobile-content-inset']) {
    forbidText(paths.mobileNavigation, text);
    forbidText(paths.mobileStatus, text);
    forbidText(paths.viewport, text);
  }

  for (const text of [
    '--mobile-status-top-inset: max(var(--mobile-chrome-block-inset), env(safe-area-inset-top));',
    '.asset-bar {',
    'right: 0;',
    'left: 0;',
    'min-height: var(--mobile-asset-bar-height);',
    'max-height: var(--mobile-asset-bar-height);',
    'padding: 0;',
    'scroll-padding-inline: 0;',
  ]) requireText(paths.mobileStatus, text);
  for (const text of ['--mobile-status-left-inset', '--mobile-status-right-inset', '.page-scroll {']) {
    forbidText(paths.mobileStatus, text);
  }

  for (const text of [
    '--scrollbar-visual-size: 6px;',
    '--scrollbar-hit-size: 14px;',
    '--scrollbar-idle-delay: 1200ms;',
    '.ui-scroll-area__viewport::-webkit-scrollbar',
    'width: 0;',
    'height: 0;',
    '[data-horizontal-visibility="always"]',
    '[data-scrollbar-active-y="true"]',
    '.ui-scrollbar--vertical',
    'z-index: 4;',
    '.ui-scrollbar--horizontal',
    'z-index: 3;',
    '.asset-bar-scroll-track {',
    '.page-scroll-area {',
    'overflow: visible;',
    '.page-scroll-area > .ui-scrollbar--vertical {',
    'right: calc(0px - var(--mobile-scrollbar-edge-escape));',
    '.page-scroll-area > .ui-scrollbar--vertical .ui-scrollbar__thumb {',
    'right: var(--scrollbar-edge-offset);',
    'left: auto;',
  ]) requireText(paths.scrollbars, text);
  forbidText(paths.scrollbars, '.asset-bar-scroll-area,');
  if (/\.asset-bar-scroll-area\s*\{[\s\S]*?height:\s*100%;/.test(read(paths.scrollbars))) {
    failures.push('scrollbars.css 不得把状态栏外层设置为 height: 100%');
  }

  for (const text of [
    'export function ScrollArea',
    'data-horizontal-visibility={horizontalVisibility}',
    'className="ui-scrollbar ui-scrollbar--horizontal"',
    'className="ui-scrollbar ui-scrollbar--vertical"',
    'role="scrollbar"',
  ]) requireText(paths.scrollArea, text);

  for (const text of [
    "const previousPositionRef = useRef({ left: 0, top: 0 })",
    'if (next.top !== previous.top) revealVertical()',
    'event.shiftKey',
    'Math.abs(event.deltaX) > Math.abs(event.deltaY) * AXIS_DOMINANCE_RATIO',
    'viewport.scrollTop += event.deltaY',
    'new ResizeObserver(scheduleSync)',
    'window.requestAnimationFrame',
    "window.addEventListener('pointermove', handlePointerMove)",
  ]) requireText(paths.scrollHook, text);
  for (const text of [
    "viewport.addEventListener('pointermove'",
    "viewport.addEventListener('pointerdown'",
    "viewport.addEventListener('focusin'",
  ]) forbidText(paths.scrollHook, text);

  forbidText(paths.viewport, 'scrollbar-gutter: stable;');
  forbidText(paths.viewport, '.page-scroll[data-scrollbar-active="true"]');

  for (const text of [
    '移动工作区统一水平间距',
    '移动两层 Overlay',
    '`--mobile-workspace-gutter` 固定引用 `var(--space-3)`',
    '状态栏和底栏的可见液态玻璃表面必须与一级卡片左右边缘共线',
    '状态栏实际玻璃、页面一级卡片、底部导航宿主和底栏实际玻璃左右边缘共线',
    '`--mobile-scrollbar-edge-escape`',
    '纵向滑块右边缘位于屏幕或安全区内缘 `2px`',
    '`scrollbars.css` 不得给 `.asset-bar-scroll-area` 设置 `height: 100%`',
    '只有 `scrollTop` 确实变化才显示纵向滚动条',
    '停止实际纵向滚动 `1200ms` 后恢复透明',
  ]) requireText(paths.design, text);

  for (const text of [
    '有横向溢出时水平滚动条必须常驻可见',
    '普通滚轮和以 `deltaY` 为主的触控板输入优先垂直滚动',
    '覆盖式轨道不得使用 `scrollbar-gutter: stable`',
    '鼠标移动、指针按下、点击内容、焦点进入',
    '移动页面右侧贴边规则',
    '`--mobile-scrollbar-edge-escape`',
    '滑块右边缘距屏幕右边 `2px`',
  ]) requireText(paths.scrollbarDesign, text);

  for (const text of [
    'game shell shares one inset between the sidebar and status bar while the workspace stays flush',
    'sidebar collapse keeps the inset status bar and page on the same workspace track',
    'page vertical scrollbar reacts only to actual scrolling and hides after idle',
    "page.locator('.asset-bar-scroll-area')",
    "page.locator('.page-scroll-area')",
    'data-scrollbar-active-y',
    'pointermove',
    'scrollTop',
  ]) requireText(paths.browser, text);

  for (const text of [
    'mobile workspace owns the shared gutter and overlay geometry',
    'mobile chrome shares the workspace gutter and fixed glass heights',
    'mobile page scrollbar reaches the safe right edge without changing content width',
    "page.locator('.mobile-page-overlay')",
    "page.locator('.mobile-chrome-overlay')",
    "page.locator('.asset-bar-scroll-area')",
    "page.locator('.mobile-bottom-navigation')",
    "'.page-scroll-area > .ui-scrollbar--vertical .ui-scrollbar__thumb'",
    'viewportRight - geometry.thumbRight',
  ]) requireText(paths.mobileBrowser, text);
}

if (failures.length > 0) {
  console.error('游戏外壳布局架构验证失败:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('游戏外壳桌面共享外距、移动统一 gutter、双层 Overlay、玻璃共线与右侧贴边滚动条验证通过。');
