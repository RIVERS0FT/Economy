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
  shell: 'src/components/shell/GameShell.tsx',
  scrollArea: 'src/components/ui/ScrollArea.tsx',
  scrollHook: 'src/hooks/useOverlayScrollbar.ts',
  design: 'docs/GAME_SHELL_LAYOUT_DESIGN.md',
  scrollbarDesign: 'docs/OVERLAY_SCROLLBAR_AND_MARKET_ACCOUNT_DESIGN.md',
  browser: 'tests/browser/game-shell-layout.spec.ts',
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
  ]) requireText(paths.scrollbars, text);
  forbidText(paths.viewport, 'scrollbar-gutter: stable;');
  forbidText(paths.viewport, '.page-scroll[data-scrollbar-active="true"]');

  for (const text of [
    '覆盖整个视口的水平双列结构',
    '`src/styles/game-shell-layout.css` 是登录后游戏外壳最终几何权威',
    '`--desktop-shell-outer-inset` 是侧栏和状态栏唯一桌面外距令牌',
    '`.asset-bar-scroll-area` 位于 `.workspace` 内部',
    '只有 `scrollTop` 确实变化才显示纵向滚动条',
    '鼠标移动、点击、焦点、滚轮或按键事件本身不算滚动活动',
    '停止实际纵向滚动 `1200ms` 后恢复透明',
    '恢复 `scrollbar-gutter: stable`',
  ]) requireText(paths.design, text);

  for (const text of [
    '有横向溢出时水平滚动条必须常驻可见',
    '普通滚轮和以 `deltaY` 为主的触控板输入优先垂直滚动',
    '覆盖式轨道不得使用 `scrollbar-gutter: stable`',
    '鼠标移动、指针按下、点击内容、焦点进入',
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
}

if (failures.length > 0) {
  console.error('游戏外壳布局架构验证失败:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('游戏外壳共享外距、全宽工作区与覆盖式纵向滚动规则验证通过。');
