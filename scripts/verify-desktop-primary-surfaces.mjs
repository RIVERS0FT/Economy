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
  requireText(paths.surfaceComponent, 'cornerRadius: 24,');

  for (const text of [
    'border-radius: var(--radius-card) !important;',
    '.liquid-glass-surface--statusBar {',
    'border: 1px solid rgba(212, 245, 224, 0.12);',
    'background: transparent;',
    '.liquid-glass-surface--statusBar > span {',
    'opacity: 0 !important;',
    '.liquid-glass-surface--statusBar > span:first-of-type',
    'opacity: 0.18 !important;',
  ]) requireText(paths.surfaceStyles, text);

  forbidText(paths.surfaceStyles, 'border-radius: 18px !important;');
  forbidText(paths.shellStyles, 'border-radius: 0 0 18px 18px');

  for (const text of [
    '桌面状态栏属于桌面一级表面',
    '必须复用通用 `--radius-card`',
    '宿主只保留一条低强度 `1px` 结构描边',
    '只允许第一层低透明度 screen 高光可见',
    '第二层 overlay 装饰必须隐藏',
    '`--desktop-shell-outer-inset` 是侧栏与状态栏唯一桌面外距令牌',
    '状态栏顶部／右侧间距都来自统一桌面外距',
  ]) requireText(paths.liquidDesign, text);

  for (const text of [
    'desktop status bar uses enhanced refraction, shared inset and one visible highlight',
    'layout.panelRadius',
    "expect(layout.panelRadius).toBe('24px')",
    "expect(layout.surfaceBorderWidth).toBe('1px')",
    'expect(layout.visibleDecorationSpanCount).toBe(1)',
  ]) requireText(paths.browser, text);
}

if (failures.length > 0) {
  console.error('桌面一级表面圆角、状态栏结构边框与单层高光验证失败:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('桌面一级卡片与状态栏统一圆角、单层结构边框和单层高光验证通过。');
