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
  main: 'src/main.tsx',
  package: 'package.json',
};

Object.values(files).forEach(requireFile);
requireFile('src/styles/liquid-glass-chrome.css');

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
    "export type LiquidGlassSurfaceVariant = 'statusBar' | 'mobileNavigation'",
    'displacementScale: 38',
    'blurAmount: 0.14',
    'aberrationIntensity: 1.15',
    "mode: 'prominent'",
    'displacementScale: 20',
    "mode: 'standard'",
    'cornerRadius: 24',
    'cornerRadius: 40',
    'elasticity={0}',
    'globalMousePos={STATIC_MOUSE_POSITION}',
    'mouseOffset={STATIC_MOUSE_OFFSET}',
  ]) requireText(files.surface, text);
  for (const text of ['mode="shader"', 'cornerRadius: 20']) forbidText(files.surface, text);
  if ((read(files.surface).match(/cornerRadius:\s*24/g) ?? []).length !== 1
    || (read(files.surface).match(/cornerRadius:\s*40/g) ?? []).length !== 1) {
    failures.push('状态栏必须使用 24px，移动底栏必须使用 40px cornerRadius');
  }

  for (const text of [
    '.liquid-glass-surface--statusBar {',
    'border: 1px solid rgba(212, 245, 224, 0.12);',
    'background: transparent;',
    '.liquid-glass-surface--statusBar > span:first-of-type',
    'mix-blend-mode: screen !important;',
    'contain: paint;',
    '.mobile-bottom-navigation .liquid-glass-surface__effect > .glass',
    'border-radius: var(--radius-card) !important;',
    'border-radius: var(--radius-card-mobile) !important;',
    'width: max(100%, 675px);',
    'padding: .25rem .8rem;',
  ]) requireText(files.styles, text);
  for (const text of ['border-radius: 20px !important;', '.workspace::before']) forbidText(files.styles, text);
  if (/^\s*(?:-webkit-)?backdrop-filter\s*:/m.test(read(files.styles))) {
    failures.push('项目 CSS 不得重新实现液态玻璃 backdrop-filter');
  }

  for (const text of [
    'className="mobile-page-overlay"',
    'className="mobile-chrome-overlay"',
    '<StatusBar items={statusItems} />',
    '<MobileBottomNavigation',
  ]) requireText(files.shell, text);
  for (const text of [
    'className="asset-bar-scroll-area"',
    'viewportClassName="asset-bar"',
    '<LiquidGlassSurface variant="statusBar">',
    'className="asset-bar-content"',
  ]) requireText(files.status, text);
  for (const text of [
    'className="sidebar mobile-bottom-navigation"',
    '<LiquidGlassSurface variant="mobileNavigation">',
    'className="mobile-navigation-scroll-area"',
  ]) requireText(files.mobile, text);

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

  for (const text of [
    '--layout-gutter: var(--mobile-primary-surface-gap);',
    'padding-inline-start: max(var(--mobile-workspace-gutter), env(safe-area-inset-left));',
    'padding-inline-end: max(var(--mobile-workspace-gutter), env(safe-area-inset-right));',
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
    '--mobile-workspace-inline-end: max(',
    '--mobile-scrollbar-edge-escape: calc(',
    'var(--mobile-workspace-inline-end) - env(safe-area-inset-right)',
  ]) requireText(files.mobileNavigation, text);
  for (const text of [
    '.asset-bar {',
    'padding: 0;',
    'scroll-padding-inline: 0;',
    'min-height: var(--mobile-asset-bar-height);',
    'max-height: var(--mobile-asset-bar-height);',
  ]) requireText(files.mobileStatus, text);

  for (const text of [
    '.page-scroll-area {',
    'overflow: visible;',
    '.page-scroll-area > .ui-scrollbar--vertical {',
    'right: 0;',
    'transform: translateX(var(--mobile-scrollbar-edge-escape));',
    '.page-scroll-area > .ui-scrollbar--vertical .ui-scrollbar__thumb {',
    'right: var(--scrollbar-edge-offset);',
    'left: auto;',
  ]) requireText(files.scrollbars, text);
  forbidText(files.scrollbars, '.asset-bar-scroll-area,');

  for (const text of [
    '`liquid-glass-react@1.1.1` 是唯一液态玻璃渲染实现',
    '`cornerRadius: 40`',
    '状态栏玻璃、底栏玻璃和一级卡片左右边缘必须共线',
    '移动底栏玻璃圆角与移动一级卡片 `--radius-card-mobile` 一致',
    '不得给 `.asset-bar-scroll-area` 设置 `height: 100%`',
  ]) requireText(files.design, text);
  for (const text of [
    'mobile chrome shares the workspace gutter and fixed glass heights',
    'navigationRadius',
    "toBe('24px')",
    "toBe('40px')",
  ]) requireText(files.browser, text);
  for (const text of [
    'mobile page scrollbar reaches the safe right edge without changing content width',
    'viewportRight - geometry.thumbRight',
  ]) requireText(files.mobileBrowser, text);
}

if (failures.length > 0) {
  console.error('liquid-glass-react 外壳架构验证失败：');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('liquid-glass-react 外壳、移动玻璃共线、40px 底栏圆角与贴边滚动条验证通过。');
