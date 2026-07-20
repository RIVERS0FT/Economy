import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
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
const requireOrder = (path, entries) => {
  const content = read(path);
  let previous = -1;
  for (const entry of entries) {
    const current = content.indexOf(entry);
    if (current < 0 || current <= previous) {
      failures.push(`${path} 加载顺序错误: ${entries.join(' -> ')}`);
      return;
    }
    previous = current;
  }
};
function walk(path) {
  const absolute = resolve(root, path);
  return readdirSync(absolute).flatMap((entry) => {
    const relative = `${path}/${entry}`;
    return statSync(resolve(root, relative)).isDirectory() ? walk(relative) : [relative];
  });
}

const surfacePath = 'src/components/ui/LiquidGlassSurface.tsx';
const surfaceStylePath = 'src/styles/liquid-glass-surfaces.css';
const shellPath = 'src/components/shell/GameShell.tsx';
const statusPath = 'src/components/shell/StatusBar.tsx';
const mobilePath = 'src/components/shell/MobileBottomNavigation.tsx';
const scrollAreaPath = 'src/components/ui/ScrollArea.tsx';
const viewportPath = 'src/styles/viewport.css';
const scrollbarPath = 'src/styles/scrollbars.css';
const layoutPath = 'src/styles/game-shell-layout.css';
const mobileNavigationStylePath = 'src/styles/mobile-status-navigation.css';
const mobileStatusStylePath = 'src/styles/mobile-status-layout.css';
const designPath = 'docs/LIQUID_GLASS_CHROME_DESIGN.md';
const browserTestPath = 'tests/browser/liquid-glass-layout.spec.ts';
const mobileBrowserTestPath = 'tests/browser/mobile-workspace-overlay.spec.ts';

[
  surfacePath,
  surfaceStylePath,
  'src/styles/liquid-glass-chrome.css',
  shellPath,
  statusPath,
  mobilePath,
  scrollAreaPath,
  viewportPath,
  scrollbarPath,
  layoutPath,
  mobileNavigationStylePath,
  mobileStatusStylePath,
  designPath,
  browserTestPath,
  mobileBrowserTestPath,
  'src/main.tsx',
  'package.json',
].forEach(requireFile);

if (failures.length === 0) {
  const compatibilityStylePath = 'src/styles/liquid-glass-chrome.css';
  const compatibilityStyles = read(compatibilityStylePath);
  if (!compatibilityStyles.includes("@import './liquid-glass-surfaces.css';")) {
    failures.push('历史 liquid-glass-chrome.css 只能转发到新外壳几何样式');
  }
  for (const forbidden of ['backdrop-filter:', '-webkit-backdrop-filter:', '--liquid-glass-surface:', '.workspace::before']) {
    if (compatibilityStyles.includes(forbidden)) failures.push(`${compatibilityStylePath} 不得恢复旧玻璃实现: ${forbidden}`);
  }

  const packageJson = JSON.parse(read('package.json'));
  if (packageJson.dependencies?.['liquid-glass-react'] !== '1.1.1') {
    failures.push('liquid-glass-react 必须作为精确版本 1.1.1 的正式依赖');
  }

  const componentImports = walk('src')
    .filter((path) => /\.(ts|tsx)$/.test(path))
    .filter((path) => read(path).includes("from 'liquid-glass-react'"));
  if (componentImports.length !== 1 || componentImports[0] !== surfacePath) {
    failures.push(`只有 ${surfacePath} 可以直接导入 liquid-glass-react，当前: ${componentImports.join(', ')}`);
  }

  for (const text of [
    "import LiquidGlass from 'liquid-glass-react'",
    "export type LiquidGlassSurfaceVariant = 'statusBar' | 'mobileNavigation'",
    'displacementScale: 38',
    'blurAmount: 0.14',
    'saturation: 145',
    'aberrationIntensity: 1.15',
    "mode: 'prominent'",
    'displacementScale: 20',
    "mode: 'standard'",
    'cornerRadius: 24',
    'elasticity={0}',
    'mode={preset.mode}',
    'globalMousePos={STATIC_MOUSE_POSITION}',
    'mouseOffset={STATIC_MOUSE_OFFSET}',
    'data-liquid-glass-mode={preset.mode}',
  ]) requireText(surfacePath, text);
  for (const text of ['mode="shader"', 'elasticity={0.', 'cornerRadius: 20']) forbidText(surfacePath, text);
  if ((read(surfacePath).match(/cornerRadius:\s*24/g) ?? []).length !== 2) {
    failures.push('状态栏和移动底栏预设必须同时使用 24px cornerRadius');
  }

  for (const text of [
    'className="mobile-page-overlay"',
    'className="mobile-chrome-overlay"',
    '<StatusBar items={statusItems} />',
    '<MobileBottomNavigation',
  ]) requireText(shellPath, text);

  for (const text of [
    "import { LiquidGlassSurface } from '../ui/LiquidGlassSurface'",
    "import { ScrollArea } from '../ui/ScrollArea'",
    'className="asset-bar-scroll-area"',
    'viewportClassName="asset-bar"',
    'horizontalVisibility="always"',
    '<LiquidGlassSurface variant="statusBar">',
    'className="asset-bar-content"',
  ]) requireText(statusPath, text);
  forbidText(statusPath, 'asset-bar panel');

  for (const text of [
    "import { LiquidGlassSurface } from '../ui/LiquidGlassSurface'",
    "import { ScrollArea } from '../ui/ScrollArea'",
    'className="sidebar mobile-bottom-navigation"',
    '<LiquidGlassSurface variant="mobileNavigation">',
    'className="mobile-navigation-scroll-area"',
    'horizontalVisibility="always"',
  ]) requireText(mobilePath, text);
  forbidText(mobilePath, 'mobile-bottom-navigation panel');

  requireOrder('src/main.tsx', [
    "import './styles/viewport.css'",
    "import './styles/scrollbars.css'",
    "import './styles/game-shell-layout.css'",
  ]);
  requireOrder('src/main.tsx', [
    "import './styles/card-system.css'",
    "import './styles/liquid-glass-surfaces.css'",
    "import './styles/mobile-status-navigation.css'",
    "import './styles/icon-system.css'",
    "import './styles/industry-system.css'",
    "import './styles/design-system.css'",
  ]);
  forbidText('src/main.tsx', "import './styles/liquid-glass-chrome.css'");

  const surfaceStyles = read(surfaceStylePath);
  for (const text of [
    '--desktop-asset-bar-height: 76px;',
    '--desktop-status-gap: var(--space-3);',
    '.liquid-glass-surface--statusBar {',
    'border: 1px solid rgba(212, 245, 224, 0.12);',
    'background: transparent;',
    '.liquid-glass-surface--statusBar > span {',
    'opacity: 0 !important;',
    '.liquid-glass-surface--statusBar > span:first-of-type',
    'opacity: 0.18 !important;',
    'mix-blend-mode: screen !important;',
    'contain: paint;',
    '@supports (overflow: clip)',
    '.asset-bar .liquid-glass-surface__effect > .glass',
    '.mobile-bottom-navigation .liquid-glass-surface__effect > .glass',
    'border-radius: var(--radius-card) !important;',
    'width: max(100%, 675px);',
    'grid-template-columns: repeat(5, minmax(135px, 1fr))',
    'padding: .25rem .8rem;',
    '@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px)))',
    'background: var(--liquid-glass-contrast-strong);',
  ]) {
    if (!surfaceStyles.includes(text)) failures.push(`${surfaceStylePath} 缺少: ${text}`);
  }
  if (/^\s*(?:-webkit-)?backdrop-filter\s*:/m.test(surfaceStyles)) {
    failures.push('项目 CSS 不得重新实现液态玻璃 backdrop-filter 属性');
  }
  for (const legacyToken of [
    '--liquid-glass-border:',
    '--liquid-glass-highlight:',
    '--liquid-glass-lowlight:',
    '--liquid-glass-shadow:',
    '--liquid-glass-blur:',
    '--liquid-glass-saturation:',
    '.workspace::before',
    'border-radius: 20px !important;',
  ]) {
    if (surfaceStyles.includes(legacyToken)) failures.push(`${surfaceStylePath} 不得恢复旧 CSS 玻璃规则: ${legacyToken}`);
  }

  for (const text of [
    '.mobile-page-overlay,',
    '.mobile-chrome-overlay {',
    'display: contents;',
    '--layout-gutter: var(--mobile-primary-surface-gap);',
    'padding-inline-start: max(var(--mobile-workspace-gutter), env(safe-area-inset-left));',
    'padding-inline-end: max(var(--mobile-workspace-gutter), env(safe-area-inset-right));',
    '.mobile-page-overlay {',
    'overflow: visible;',
    'pointer-events: none;',
    '.asset-bar-scroll-area {',
    'height: var(--desktop-asset-bar-height);',
    'min-height: var(--mobile-asset-bar-height);',
    'max-height: var(--mobile-asset-bar-height);',
    '.asset-bar-scroll-track,',
    '.asset-bar {',
    'overflow-x: auto;',
    '.page-scroll-area,',
    'safe-area-inset-bottom',
  ]) requireText(viewportPath, text);

  if (/\.mobile-bottom-navigation\s*\{[\s\S]*?position:\s*fixed;/.test(read(viewportPath))) {
    failures.push('移动底栏不得恢复 position: fixed');
  }

  for (const text of [
    '.asset-bar-scroll-area {',
    'top: var(--desktop-shell-outer-inset);',
    'right: var(--desktop-shell-outer-inset);',
    'left: 0;',
    'width: auto;',
  ]) requireText(layoutPath, text);

  for (const text of [
    '--mobile-workspace-gutter: var(--space-3);',
    '--mobile-primary-surface-gap: var(--mobile-workspace-gutter);',
    '--mobile-chrome-block-inset: var(--space-4);',
    '--mobile-scrollbar-edge-escape: max(',
    'padding: 0;',
    'scroll-padding-inline: 0;',
  ]) requireText(mobileNavigationStylePath, text);
  for (const text of ['--mobile-chrome-inset', '--mobile-content-inset']) {
    forbidText(mobileNavigationStylePath, text);
    forbidText(mobileStatusStylePath, text);
    forbidText(viewportPath, text);
  }

  for (const text of [
    '.asset-bar-scroll-area {',
    'top: var(--mobile-status-top-inset);',
    'right: 0;',
    'left: 0;',
    'min-height: var(--mobile-asset-bar-height);',
    'max-height: var(--mobile-asset-bar-height);',
    '.asset-bar-scroll-track,',
  ]) requireText(mobileStatusStylePath, text);

  for (const text of [
    '.page-scroll-area {',
    'overflow: visible;',
    '.page-scroll-area > .ui-scrollbar--vertical {',
    'right: calc(-1 * var(--mobile-scrollbar-edge-escape));',
    '.page-scroll-area > .ui-scrollbar--vertical .ui-scrollbar__thumb {',
    'right: var(--scrollbar-edge-offset);',
    'left: auto;',
  ]) requireText(scrollbarPath, text);
  forbidText(scrollbarPath, '.asset-bar-scroll-area,');
  if (/\.asset-bar-scroll-area\s*\{[\s\S]*?height:\s*100%;/.test(read(scrollbarPath))) {
    failures.push('共享滚动条样式不得把状态栏宿主设置为全高');
  }

  for (const text of [
    '`liquid-glass-react@1.1.1` 是唯一液态玻璃渲染实现',
    '`mode="prominent"`',
    '`displacementScale: 38`',
    '`aberrationIntensity: 1.15`',
    '`elasticity={0}`',
    '`cornerRadius: 24`',
    'Safari、iOS WebKit 和 Firefox',
    '只允许第一层低透明度 screen 高光可见',
    '第二层 overlay 装饰必须隐藏',
    '背景必须透明',
    '真实浏览器中的全宽、裁切、折射层、单高光、移动 Overlay 与页面避让验证',
    '移动 `.workspace` 是唯一水平几何边界',
    '状态栏玻璃、底栏玻璃和一级卡片左右边缘必须共线',
    '移动底栏玻璃圆角与一级卡片 `--radius-card` 一致',
    '不得给 `.asset-bar-scroll-area` 设置 `height: 100%`',
  ]) requireText(designPath, text);

  for (const text of [
    "page.goto('runtime-test.html?view=overview&scenario=activity')",
    "page.locator('.asset-bar-scroll-area')",
    "page.locator('.mobile-chrome-overlay')",
    "page.locator('.asset-bar .liquid-glass-surface')",
    "page.locator('.mobile-bottom-navigation .liquid-glass-surface')",
    'mobile chrome shares the workspace gutter and fixed glass heights',
    'data-liquid-glass-mode',
    'glass__warp',
    'visibleDecorationSpanCount',
    'surfaceBackgroundColor',
    'navigationRadius',
    "toBe('24px')",
  ]) requireText(browserTestPath, text);

  for (const text of [
    'mobile page scrollbar reaches the safe right edge without changing content width',
    'statusSurface',
    'navigationSurface',
    'navigationRadius',
    'viewportRight - geometry.thumbRight',
  ]) requireText(mobileBrowserTestPath, text);
}

if (failures.length > 0) {
  console.error('liquid-glass-react 外壳架构验证失败：');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('liquid-glass-react 增强折射、单高光、移动玻璃共线、统一圆角与固定宿主验证通过。');
