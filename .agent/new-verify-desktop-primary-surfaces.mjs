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
  designSystem: 'src/styles/design-system.css',
  surfaceComponent: 'src/components/ui/LiquidGlassSurface.tsx',
  surfaceStyles: 'src/styles/liquid-glass-surfaces.css',
  statusComponent: 'src/components/shell/StatusBar.tsx',
  adminBar: 'src/components/shell/AdminDesktopBar.tsx',
  shellStyles: 'src/styles/game-shell-layout.css',
  liquidDesign: 'docs/LIQUID_GLASS_CHROME_DESIGN.md',
  browser: 'tests/browser/liquid-glass-layout.spec.ts',
  adminBrowser: 'tests/browser/admin-runtime.spec.ts',
};

Object.values(paths).forEach(requireFile);

if (failures.length === 0) {
  requireText(paths.designSystem, '--radius-card: 1.5rem;');
  requireText(paths.designSystem, 'border-radius: var(--radius-card);');
  for (const text of [
    'const DESKTOP_STATUS_GLASS = {',
    'displacementScale: 70',
    'blurAmount: 0',
    'saturation: 140',
    'aberrationIntensity: 2',
    'elasticity: 0',
    'cornerRadius: 24,',
    'desktopStatusBar: DESKTOP_STATUS_GLASS',
    'const MOBILE_CHROME_GLASS = {',
    'mobileStatusBar: MOBILE_CHROME_GLASS',
    'mobileNavigation: MOBILE_CHROME_GLASS',
    'const GLOBAL_OVER_LIGHT = false;',
    "data-liquid-glass-over-light={overLight ? 'true' : 'false'}",
  ]) requireText(paths.surfaceComponent, text);
  forbidText(paths.surfaceComponent, 'const GLOBAL_OVER_LIGHT = true;');
  forbidText(paths.surfaceComponent, 'const IOS_CLEAR_THICK_GLASS = {');

  for (const text of [
    "type StatusBarSurfaceVariant = Extract<LiquidGlassSurfaceVariant, 'desktopStatusBar' | 'mobileStatusBar'>",
    "return window.matchMedia(MOBILE_STATUS_MEDIA_QUERY).matches ? 'mobileStatusBar' : 'desktopStatusBar'",
    '<LiquidGlassSurface variant={surfaceVariant}>',
  ]) requireText(paths.statusComponent, text);
  for (const text of [
    'className="asset-bar admin-command-bar"',
    'variant="desktopStatusBar"',
  ]) requireText(paths.adminBar, text);

  for (const text of [
    '.liquid-glass-surface--desktopStatusBar .glass__warp,',
    '-webkit-backdrop-filter: blur(4px) saturate(140%);',
    '.liquid-glass-surface--desktopStatusBar,',
    '.liquid-glass-surface--mobileNavigation,',
    '.liquid-glass-surface--desktopAuthCard,',
    'background: transparent;',
    'box-shadow: none;',
    '.liquid-glass-surface--desktopStatusBar::after,',
    '.liquid-glass-surface--mobileNavigation::after,',
    'content: none;',
    '.liquid-glass-surface--desktopStatusBar > span,',
    '.liquid-glass-surface--mobileNavigation > span,',
    'display: block !important;',
    'visibility: visible !important;',
    'padding: 0 !important;',
    '-webkit-mask: none !important;',
    'mask: none !important;',
    'background: var(--liquid-glass-auth-fallback);',
    'border-radius: 24px !important;',
    'border-radius: 40px !important;',
  ]) requireText(paths.surfaceStyles, text);

  for (const text of [
    '--liquid-glass-contrast:',
    '--liquid-glass-structure-border:',
    'padding: 1.5px !important;',
    'mask-composite: exclude;',
    '.liquid-glass-surface--mobileNavigation > span:first-of-type',
    '.liquid-glass-surface--statusBar',
    'border-radius: 18px !important;',
  ]) forbidText(paths.surfaceStyles, text);
  if (/\.liquid-glass-surface__effect\s*>\s*\.glass[^{}]*\{[^}]*box-shadow:\s*none\s*!important;/m.test(read(paths.surfaceStyles))) {
    failures.push('统一悬浮玻璃不得覆盖 liquid-glass-react 的官方 .glass 阴影');
  }
  forbidText(paths.shellStyles, 'border-radius: 0 0 18px 18px');

  for (const text of [
    '桌面工作栏高度保持 `76px`',
    '实际玻璃圆角为 `24px`',
    '`DESKTOP_STATUS_GLASS`',
    '`blur(4px) saturate(140%)`',
    '`overLight=false`',
    '官方双层高光',
    '第三方 `.glass` 默认外部阴影',
    '所有五种表面都不得绘制项目结构描边',
    '`--desktop-shell-outer-inset` 是侧栏与工作栏唯一桌面外距令牌',
    '顶部／右侧间距都来自统一桌面外距',
  ]) requireText(paths.liquidDesign, text);

  for (const text of [
    'desktop status bar uses the shared authentication-card material and shell inset',
    "toHaveAttribute('data-liquid-glass-variant', 'desktopStatusBar')",
    "toHaveAttribute('data-liquid-glass-over-light', 'false')",
    "expect(layout.surfaceRadius).toEqual(['24px', '24px', '24px', '24px'])",
    "expect(layout.panelRadius).toBe('24px')",
    "expect(layout.surfaceBorderWidth).toBe('0px')",
    "expect(layout.outlineContent).toBe('none')",
    'expect(layout.visibleDecorationSpanCount).toBe(2)',
    "expect(layout.glassBoxShadow).toContain('0px 12px 40px')",
    "expect(layout.surfaceBackgroundColor).toBe('rgba(0, 0, 0, 0)')",
    "expect(layout.warpBackdropFilter).toContain('blur(4px)')",
  ]) requireText(paths.browser, text);
  for (const text of [
    'admin desktop shares the game shell gutter, command bar and edge scrollbar',
    '.liquid-glass-surface--desktopStatusBar',
  ]) requireText(paths.adminBrowser, text);
}

if (failures.length > 0) {
  console.error('桌面一级表面与统一悬浮玻璃材质验证失败:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('桌面一级卡片、玩家状态栏与管理员工作栏的 24px 圆角、透明宿主、官方双层高光、默认阴影和无项目结构描边验证通过。');
