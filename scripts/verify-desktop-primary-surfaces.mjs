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
    'displacementScale: 20',
    'blurAmount: 0.0625',
    'saturation: 120',
    'aberrationIntensity: 0.15',
    'cornerRadius: 24,',
    'desktopStatusBar: DESKTOP_STATUS_GLASS',
    'const MOBILE_CHROME_GLASS = {',
    'mobileStatusBar: MOBILE_CHROME_GLASS',
    'mobileNavigation: MOBILE_CHROME_GLASS',
  ]) requireText(paths.surfaceComponent, text);
  forbidText(paths.surfaceComponent, 'const IOS_CLEAR_THICK_GLASS = {');
  forbidText(paths.surfaceComponent, 'statusBar: IOS_CLEAR_THICK_GLASS');

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
    '.asset-bar > .liquid-glass-surface--desktopStatusBar,',
    'border-radius: 24px !important;',
    '.liquid-glass-surface--desktopStatusBar .glass__warp {',
    '-webkit-backdrop-filter: blur(6px) saturate(120%);',
    '.liquid-glass-surface--desktopStatusBar::after,',
    'z-index: 2;',
    'border: 1px solid var(--liquid-glass-structure-border);',
    'background: var(--liquid-glass-contrast);',
    '.liquid-glass-surface--desktopStatusBar > span,',
    'display: none !important;',
    '.asset-bar > .liquid-glass-surface--desktopStatusBar .liquid-glass-surface__effect > .glass,',
    'box-shadow: none !important;',
  ]) requireText(paths.surfaceStyles, text);

  for (const text of [
    '.liquid-glass-surface--statusBar',
    'border-radius: 18px !important;',
    'border: 1px solid rgba(212, 245, 224, 0.12);',
    'opacity: 0.18 !important;',
  ]) forbidText(paths.surfaceStyles, text);
  forbidText(paths.shellStyles, 'border-radius: 0 0 18px 18px');

  for (const text of [
    '桌面工作栏高度保持 `76px`',
    '实际玻璃圆角为 `24px`',
    '`DESKTOP_STATUS_GLASS`',
    '`blur(6px) saturate(120%)`',
    '隐藏 `liquid-glass-react` 直属的两层边框／高光 `span`',
    '清除第三方 `.glass` 外部阴影',
    '`--desktop-shell-outer-inset` 是侧栏与工作栏唯一桌面外距令牌',
    '顶部／右侧间距都来自统一桌面外距',
  ]) requireText(paths.liquidDesign, text);

  for (const text of [
    'desktop status bar uses its dedicated single-shell glass preset and shell inset',
    "toHaveAttribute('data-liquid-glass-variant', 'desktopStatusBar')",
    "expect(layout.surfaceRadius).toEqual(['24px', '24px', '24px', '24px'])",
    "expect(layout.panelRadius).toBe('24px')",
    "expect(layout.surfaceBorderWidth).toBe('0px')",
    "expect(layout.outlineBorderWidth).toBe('1px')",
    "expect(layout.outlineZIndex).toBe('2')",
    'expect(layout.visibleDecorationSpanCount).toBe(0)',
    "expect(layout.glassBoxShadow).toBe('none')",
  ]) requireText(paths.browser, text);
  for (const text of [
    'admin desktop shares the game shell gutter, command bar and edge scrollbar',
    '.liquid-glass-surface--desktopStatusBar',
  ]) requireText(paths.adminBrowser, text);
}

if (failures.length > 0) {
  console.error('桌面一级表面圆角、共享桌面工作栏预设与单壳结构验证失败:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('桌面一级卡片与共享工作栏 24px 圆角、桌面独立玻璃预设、顶层连续结构描边、零第三方装饰层和无外部阴影验证通过。');
