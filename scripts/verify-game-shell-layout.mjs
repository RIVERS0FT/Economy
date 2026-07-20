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
  '--mobile-workspace-inline-end: max(',
  '--mobile-scrollbar-edge-escape: calc(',
  'var(--mobile-workspace-inline-end) - env(safe-area-inset-right)',
  '--mobile-asset-bar-height: 48px;',
  '--mobile-nav-height: 68px;',
]);
check('src/styles/mobile-status-layout.css', [
  '.asset-bar {',
  'padding: 0;',
  'scroll-padding-inline: 0;',
  'min-height: var(--mobile-asset-bar-height);',
  'max-height: var(--mobile-asset-bar-height);',
]);
check('src/styles/scrollbars.css', [
  '.page-scroll-area {',
  'overflow: visible;',
  '.page-scroll-area > .ui-scrollbar--vertical {',
  'right: 0;',
  'transform: translateX(var(--mobile-scrollbar-edge-escape));',
  '.page-scroll-area > .ui-scrollbar--vertical .ui-scrollbar__thumb {',
  'right: var(--scrollbar-edge-offset);',
  'left: auto;',
]);
forbid('src/styles/scrollbars.css', ['.asset-bar-scroll-area,']);
forbid('src/styles/viewport.css', ['position: fixed;\n    right: 0;\n    bottom: max(var(--mobile-chrome-block-inset)']);
check('docs/GAME_SHELL_LAYOUT_DESIGN.md', [
  '移动工作区统一水平间距',
  '移动两层 Overlay',
  '--mobile-workspace-inline-end',
  '--mobile-scrollbar-edge-escape',
  'translateX()',
  '--radius-card-mobile',
  '`40px`',
]);
check('docs/OVERLAY_SCROLLBAR_AND_MARKET_ACCOUNT_DESIGN.md', [
  '移动页面右侧贴边规则',
  'translateX(var(--mobile-scrollbar-edge-escape))',
  '滑块右边缘距屏幕右边 `2px`',
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

console.log('游戏外壳移动双层 Overlay、玻璃共线、40px 底栏圆角与贴边滚动条验证通过。');
