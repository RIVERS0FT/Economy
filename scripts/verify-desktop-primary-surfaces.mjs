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
  shellStyles: 'src/styles/game-shell-layout.css',
  liquidDesign: 'docs/LIQUID_GLASS_CHROME_DESIGN.md',
  browser: 'tests/browser/liquid-glass-layout.spec.ts',
};

Object.values(paths).forEach(requireFile);

if (failures.length === 0) {
  requireText(paths.designSystem, '--radius-card: 1.5rem;');
  requireText(paths.designSystem, 'border-radius: var(--radius-card);');
  for (const text of [
    'const IOS_CLEAR_THICK_GLASS = {',
    'cornerRadius: 40,',
    'statusBar: IOS_CLEAR_THICK_GLASS',
    'mobileNavigation: IOS_CLEAR_THICK_GLASS',
  ]) requireText(paths.surfaceComponent, text);

  for (const text of [
    '.asset-bar .liquid-glass-surface,',
    '.mobile-bottom-navigation .liquid-glass-surface__effect > .glass {',
    'border-radius: 40px !important;',
    '.liquid-glass-surface--statusBar,',
    '.liquid-glass-surface--mobileNavigation {',
    'border: 1px solid var(--liquid-glass-structure-border);',
    'background: var(--liquid-glass-contrast);',
    '.liquid-glass-surface--statusBar > span,',
    '.liquid-glass-surface--mobileNavigation > span {',
    'opacity: 0 !important;',
    '.liquid-glass-surface--statusBar > span:first-of-type,',
    '.liquid-glass-surface--mobileNavigation > span:first-of-type {',
    'opacity: 0.22 !important;',
  ]) requireText(paths.surfaceStyles, text);

  for (const text of [
    'border-radius: 18px !important;',
    'border-radius: var(--radius-card) !important;',
    'border: 1px solid rgba(212, 245, 224, 0.12);',
    'opacity: 0.18 !important;',
  ]) forbidText(paths.surfaceStyles, text);
  forbidText(paths.shellStyles, 'border-radius: 0 0 18px 18px');

  for (const text of [
    '桌面状态栏高度保持 `76px`',
    '材质轮廓改为与移动底栏一致的 `40px` 胶囊',
    '桌面一级卡片继续使用 `--radius-card: 24px`',
    '一条低强度 `1px` 结构描边',
    '只允许第一层 `opacity: 0.22` 的 screen 高光可见',
    '第二层 overlay 装饰必须隐藏',
    '`--desktop-shell-outer-inset` 是侧栏与状态栏唯一桌面外距令牌',
    '状态栏顶部／右侧间距都来自统一桌面外距',
  ]) requireText(paths.liquidDesign, text);

  for (const text of [
    'desktop status bar uses the shared clear thick glass capsule and shell inset',
    "expect(layout.surfaceRadius).toEqual(['40px', '40px', '40px', '40px'])",
    "expect(layout.panelRadius).toBe('24px')",
    "expect(layout.surfaceBorderWidth).toBe('1px')",
    'expect(layout.visibleDecorationSpanCount).toBe(1)',
  ]) requireText(paths.browser, text);
}

if (failures.length > 0) {
  console.error('桌面一级表面圆角、状态栏清透厚玻璃胶囊与单层高光验证失败:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('桌面一级卡片 24px 圆角与状态栏 40px 清透厚玻璃胶囊、单层结构边框和单层高光验证通过。');
