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
const walk = (path) => readdirSync(resolve(root, path)).flatMap((entry) => {
  const relative = `${path}/${entry}`;
  return statSync(resolve(root, relative)).isDirectory() ? walk(relative) : [relative];
});

const files = {
  surface: 'src/components/ui/LiquidGlassSurface.tsx',
  styles: 'src/styles/liquid-glass-surfaces.css',
  compatibility: 'src/styles/liquid-glass-chrome.css',
  shell: 'src/components/shell/GameShell.tsx',
  status: 'src/components/shell/StatusBar.tsx',
  mobile: 'src/components/shell/MobileBottomNavigation.tsx',
  viewport: 'src/styles/viewport.css',
  scrollbars: 'src/styles/scrollbars.css',
  layout: 'src/styles/game-shell-layout.css',
  mobileNavigation: 'src/styles/mobile-status-navigation.css',
  mobileStatus: 'src/styles/mobile-status-layout.css',
  design: 'docs/LIQUID_GLASS_CHROME_DESIGN.md',
  browser: 'tests/browser/liquid-glass-layout.spec.ts',
  mobileBrowser: 'tests/browser/mobile-workspace-overlay.spec.ts',
  navigationBrowser: 'tests/browser/mobile-navigation-scrollbar.spec.ts',
  main: 'src/main.tsx',
  package: 'package.json',
};

Object.values(files).forEach(requireFile);

if (failures.length === 0) {
  const packageJson = JSON.parse(read(files.package));
  if (packageJson.dependencies?.['liquid-glass-react'] !== '1.1.1') {
    failures.push('liquid-glass-react 必须固定为 1.1.1');
  }

  const directImports = walk('src')
    .filter((path) => /\.(ts|tsx)$/.test(path))
    .filter((path) => read(path).includes("from 'liquid-glass-react'"));
  if (directImports.length !== 1 || directImports[0] !== files.surface) {
    failures.push(`只有 ${files.surface} 可以直接导入 liquid-glass-react`);
  }

  for (const text of [
    "export type LiquidGlassSurfaceVariant = 'desktopStatusBar' | 'mobileStatusBar' | 'mobileNavigation'",
    'const DESKTOP_STATUS_GLASS = {',
    'displacementScale: 20',
    'blurAmount: 0.0625',
    'saturation: 120',
    'aberrationIntensity: 0.15',
    'cornerRadius: 24',
    'const MOBILE_CHROME_GLASS = {',
    'displacementScale: 32',
    'blurAmount: 0.1',
    'saturation: 125',
    'aberrationIntensity: 0.3',
    'cornerRadius: 40',
    "mode: 'standard'",
    'desktopStatusBar: DESKTOP_STATUS_GLASS',
    'mobileStatusBar: MOBILE_CHROME_GLASS',
    'mobileNavigation: MOBILE_CHROME_GLASS',
    'elasticity={0}',
    'globalMousePos={STATIC_MOUSE_POSITION}',
    'mouseOffset={STATIC_MOUSE_OFFSET}',
  ]) requireText(files.surface, text);
  for (const text of [
    'const IOS_CLEAR_THICK_GLASS = {',
    'statusBar: IOS_CLEAR_THICK_GLASS',
    "mode: 'prominent'",
    'displacementScale: 38',
    'blurAmount: 0.14',
    'blurAmount: 0.5',
    'aberrationIntensity: 1.15',
    'aberrationIntensity: 0.5',
    'mode="shader"',
    'cornerRadius: 20',
  ]) forbidText(files.surface, text);
  if ((read(files.surface).match(/cornerRadius:\s*24/g) ?? []).length !== 1) {
    failures.push('桌面状态栏必须只定义一个 24px cornerRadius 预设');
  }
  if ((read(files.surface).match(/cornerRadius:\s*40/g) ?? []).length !== 1) {
    failures.push('移动状态栏和移动底栏必须共享唯一 40px cornerRadius 预设');
  }

  for (const text of [
    "import { useEffect, useState, type ReactNode } from 'react'",
    "type StatusBarSurfaceVariant = Extract<LiquidGlassSurfaceVariant, 'desktopStatusBar' | 'mobileStatusBar'>",
    "const MOBILE_STATUS_MEDIA_QUERY = '(max-width: 720px)'",
    "return window.matchMedia(MOBILE_STATUS_MEDIA_QUERY).matches ? 'mobileStatusBar' : 'desktopStatusBar'",
    'mediaQuery.addEventListener(\'change\', updateVariant)',
    '<LiquidGlassSurface variant={surfaceVariant}>',
    'className="asset-bar"',
    'className="asset-bar-content"',
  ]) requireText(files.status, text);
  for (const text of [
    "import { ScrollArea }",
    '<ScrollArea',
    'asset-bar-scroll-area',
    'asset-bar-scroll-track',
  ]) forbidText(files.status, text);
  for (const text of [
    '<LiquidGlassSurface variant="statusBar">',
    '<LiquidGlassSurface variant="desktopStatusBar">',
    '<LiquidGlassSurface variant="mobileStatusBar">',
  ]) forbidText(files.status, text);

  for (const text of [
    '--liquid-glass-contrast: rgba(194, 231, 214, 0.06);',
    '--liquid-glass-structure-border: rgba(232, 255, 244, 0.3);',
    '.liquid-glass-surface {',
    'overflow: hidden;',
    '.liquid-glass-surface--desktopStatusBar .glass__warp {',
    '-webkit-backdrop-filter: blur(6px) saturate(120%);',
    '.liquid-glass-surface--mobileStatusBar .glass__warp,',
    '.liquid-glass-surface--mobileNavigation .glass__warp {',
    '-webkit-backdrop-filter: blur(7.2px) saturate(125%);',
    '.asset-bar > .liquid-glass-surface--desktopStatusBar,',
    'border-radius: 24px !important;',
    '.asset-bar > .liquid-glass-surface--mobileStatusBar,',
    '.mobile-bottom-navigation .liquid-glass-surface__effect > .glass {',
    'border-radius: 40px !important;',
    '.liquid-glass-surface--desktopStatusBar,',
    '.liquid-glass-surface--mobileStatusBar,',
    '.liquid-glass-surface--mobileNavigation {',
    '.liquid-glass-surface--desktopStatusBar::after,',
    '.liquid-glass-surface--mobileStatusBar::after {',
    'content: "";',
    'z-index: 2;',
    'border: 1px solid var(--liquid-glass-structure-border);',
    'pointer-events: none;',
    'background: var(--liquid-glass-contrast);',
    '.liquid-glass-surface--desktopStatusBar > div:not(.liquid-glass-surface__effect),',
    '.liquid-glass-surface--mobileStatusBar > div:not(.liquid-glass-surface__effect),',
    'display: none !important;',
    '.liquid-glass-surface--desktopStatusBar > span,',
    '.liquid-glass-surface--mobileStatusBar > span {',
    'opacity: 0 !important;',
    '.asset-bar > .liquid-glass-surface--desktopStatusBar .liquid-glass-surface__effect > .glass,',
    '.asset-bar > .liquid-glass-surface--mobileStatusBar .liquid-glass-surface__effect > .glass {',
    'box-shadow: none !important;',
    '.liquid-glass-surface--mobileNavigation > span:first-of-type {',
    'opacity: 0.22 !important;',
    'mix-blend-mode: screen !important;',
    '.asset-bar > .liquid-glass-surface {',
    'grid-template-columns: repeat(5, minmax(0, 1fr));',
    'overflow: visible;',
    '.mobile-bottom-navigation .liquid-glass-surface__content {',
    'padding: 8px 0;',
    'only vertical padding owner',
  ]) requireText(files.styles, text);
  for (const text of [
    '.liquid-glass-surface--statusBar',
    '-webkit-backdrop-filter: blur(8.48px) saturate(145%);',
    '-webkit-backdrop-filter: blur(20px) saturate(145%);',
    'border-radius: 999px !important;',
    'border-radius: 20px !important;',
    '.workspace::before',
    'contain: paint;',
    'isolation: isolate;',
    'overflow: clip;',
    '@supports (overflow: clip)',
  ]) forbidText(files.styles, text);
  if (/^\s*backdrop-filter\s*:/m.test(read(files.styles))) {
    failures.push('项目 CSS 不得重写 liquid-glass-react 的非前缀 backdrop-filter');
  }

  for (const text of [
    'className="mobile-page-overlay"',
    'className="mobile-chrome-overlay"',
    '<StatusBar items={statusItems} />',
    '<MobileBottomNavigation',
  ]) requireText(files.shell, text);
  for (const text of [
    'className="sidebar mobile-bottom-navigation"',
    '<LiquidGlassSurface variant="mobileNavigation">',
    'className="mobile-bottom-navigation__viewport"',
    '<NavigationItems',
  ]) requireText(files.mobile, text);
  for (const text of [
    "import { ScrollArea }",
    '<ScrollArea',
    'mobile-navigation-frame',
    'mobile-navigation-scroll-area',
  ]) forbidText(files.mobile, text);

  requireOrder(files.main, [
    "import './styles/viewport.css'",
    "import './styles/scrollbars.css'",
    "import './styles/game-shell-layout.css'",
  ]);
  requireOrder(files.main, [
    "import './styles/card-system.css'",
    "import './styles/liquid-glass-surfaces.css'",
    "import './styles/mobile-status-navigation.css'",
    "import './styles/design-system.css'",
  ]);
  requireOrder(files.compatibility, [
    "@import './performance.css';",
    "@import './scrollbars.css';",
    "@import './game-shell-layout.css';",
    "@import './liquid-glass-surfaces.css';",
  ]);
  requireText(files.compatibility, 'Production imports these files directly through src/main.tsx.');

  for (const text of [
    '--layout-gutter: var(--mobile-primary-surface-gap);',
    'padding-inline-start: max(var(--mobile-workspace-gutter), env(safe-area-inset-left));',
    'padding-inline-end: max(var(--mobile-workspace-gutter), env(safe-area-inset-right));',
    'isolation: auto;',
    '.mobile-page-overlay,',
    '.mobile-chrome-overlay {',
    'z-index: auto;',
    '.mobile-page-overlay {',
    'overflow: visible;',
    '.mobile-chrome-overlay {',
    'pointer-events: none;',
    'min-height: var(--mobile-asset-bar-height);',
    'max-height: var(--mobile-asset-bar-height);',
  ]) requireText(files.viewport, text);
  if (/\.mobile-bottom-navigation\s*\{[\s\S]*?position:\s*fixed;/.test(read(files.viewport))) {
    failures.push('移动底栏不得恢复 position: fixed');
  }

  for (const text of [
    '--mobile-workspace-gutter: var(--space-3);',
    '--mobile-primary-surface-gap: var(--mobile-workspace-gutter);',
    '.mobile-bottom-navigation {',
    'padding: 0;',
    '.mobile-bottom-navigation__viewport::-webkit-scrollbar',
    '.mobile-bottom-navigation__viewport {',
    'padding-inline: var(--mobile-nav-scroll-gutter);',
    'overflow-x: auto;',
    'overflow-y: hidden;',
    'scrollbar-width: none;',
    '-webkit-overflow-scrolling: touch;',
    'outline: none;',
    'box-shadow: inset 0 0 0 2px rgba(123, 228, 158, .72);',
  ]) requireText(files.mobileNavigation, text);
  for (const text of [
    '--mobile-workspace-inline-end',
    '--mobile-scrollbar-edge-escape',
    '.mobile-navigation-frame',
    '.mobile-navigation-scroll-area',
    '.mobile-bottom-navigation .sidebar-nav::before',
    '.mobile-bottom-navigation .sidebar-nav::after',
    'outline-offset: 2px;',
  ]) forbidText(files.mobileNavigation, text);
  for (const text of [
    '.asset-bar {',
    'display: block;',
    'padding: 0;',
    'overflow: visible;',
    'grid-template-columns: repeat(5, minmax(0, 1fr));',
    'min-height: var(--mobile-asset-bar-height);',
    'max-height: var(--mobile-asset-bar-height);',
  ]) requireText(files.mobileStatus, text);

  for (const text of [
    '.page-scroll-area {',
    'overflow: visible;',
    '.page-scroll-area > .ui-scrollbar--vertical {',
    'position: fixed;',
    'right: env(safe-area-inset-right, 0px);',
    'transform: none;',
    '.page-scroll-area > .ui-scrollbar--vertical .ui-scrollbar__thumb {',
    'right: var(--scrollbar-edge-offset);',
    'left: auto;',
  ]) requireText(files.scrollbars, text);
  for (const text of [
    'asset-bar-scroll-area',
    'asset-bar-scroll-track',
    'translateX(var(--mobile-scrollbar-edge-escape))',
    '.mobile-navigation-frame',
    '.mobile-navigation-scroll-area',
  ]) forbidText(files.scrollbars, text);

  for (const text of [
    '`liquid-glass-react@1.1.1` 是唯一液态玻璃渲染实现',
    '`DESKTOP_STATUS_GLASS`',
    '`MOBILE_CHROME_GLASS`',
    '`desktopStatusBar`',
    '`mobileStatusBar`',
    '`mobileNavigation`',
    '`displacementScale: 20`',
    '`blurAmount: 0.0625`',
    '`saturation: 120`',
    '`aberrationIntensity: 0.15`',
    '`cornerRadius: 24`',
    '`displacementScale: 32`',
    '`blurAmount: 0.1`',
    '`saturation: 125`',
    '`aberrationIntensity: 0.3`',
    '`cornerRadius: 40`',
    '`blur(6px) saturate(120%)`',
    '`blur(7.2px) saturate(125%)`',
    '桌面与移动不得再次合并为同一个参数常量',
    '任一时刻只能渲染一个状态栏玻璃实例',
    '状态栏玻璃、底栏玻璃和一级卡片左右边缘必须共线',
    '顶部状态栏不得包含 `ScrollArea`',
    '固定五列布局',
    '最上层连续结构描边',
    '固定到视口安全边缘',
    'right: env(safe-area-inset-right, 0px)',
    '开放的背景采样链',
    '`contain: paint`',
    '`isolation: isolate`',
    '`overflow: clip`',
    '`-webkit-backdrop-filter`',
    '浏览器运行时 harness 必须加载真实的滚动条与外壳几何样式',
    '语义化 `<nav>` 是移动底栏唯一横向滚动视口',
    '不得重新引入 `ScrollArea`',
    '移动底栏垂直留白只允许由 `.liquid-glass-surface__content` 提供',
  ]) requireText(files.design, text);
  for (const text of [
    'desktop status bar uses its dedicated single-shell glass preset and shell inset',
    'status bar changes platform preset in place without rendering duplicate glass hosts',
    'mobile status and navigation share the mobile chrome preset while status remains single-shell',
    "toHaveAttribute('data-liquid-glass-variant', 'desktopStatusBar')",
    "toHaveAttribute('data-liquid-glass-variant', 'mobileStatusBar')",
    "toHaveAttribute('data-liquid-glass-variant', 'mobileNavigation')",
    "expect(layout.surfaceRadius).toEqual(['24px', '24px', '24px', '24px'])",
    'expect(layout.visibleDecorationSpanCount).toBe(0)',
    'expect(geometry.statusVisibleDecorationSpanCount).toBe(0)',
    'expect(geometry.navigationVisibleDecorationSpanCount).toBe(1)',
    'expect(geometry.statusBackdropFilter).toBe(geometry.navigationBackdropFilter)',
    "expect(geometry.statusRadius).toBe('40px')",
    "expect(geometry.navigationRadius).toBe('40px')",
  ]) requireText(files.browser, text);
  for (const text of [
    'mobile page scrollbar reaches the safe right edge without changing content width',
    'viewportRight - geometry.thumbRight',
  ]) requireText(files.mobileBrowser, text);
  for (const text of [
    'mobile navigation uses one native scroll viewport without clipping its buttons',
    "locator('.ui-scroll-area')",
    "expect(state.contentPaddingTop).toBe('8px')",
    'expect(state.activeButtonTop).toBeGreaterThanOrEqual(state.viewportTop - 1)',
    'expect(state.activeButtonBottom).toBeLessThanOrEqual(state.viewportBottom + 1)',
  ]) requireText(files.navigationBrowser, text);
}

if (failures.length > 0) {
  console.error('liquid-glass-react 外壳架构验证失败：');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('liquid-glass-react 外壳、桌面状态栏独立预设、移动 Chrome 共享预设、状态栏固定五列单壳结构、顶层连续描边、移动底栏单一原生滚动视口、开放背景采样链与固定安全边缘滚动条验证通过。');
