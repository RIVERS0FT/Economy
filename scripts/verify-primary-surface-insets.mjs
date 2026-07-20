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
  layout: 'src/components/ui/layout.tsx',
  primaryStyles: 'src/styles/primary-surfaces.css',
  productionStyles: 'src/styles/production-surface.css',
  assetStyles: 'src/styles/assets.css',
  shopStyles: 'src/styles/gem-shop.css',
  leaderboardStyles: 'src/styles/leaderboards.css',
  design: 'docs/PRIMARY_SURFACE_INSET_DESIGN.md',
};

Object.values(paths).forEach(requireFile);

if (failures.length === 0) {
  const main = read(paths.main);
  const designSystemIndex = main.indexOf("import './styles/design-system.css';");
  const primarySurfaceIndex = main.indexOf("import './styles/primary-surfaces.css';");
  const formControlsIndex = main.indexOf("import './styles/form-controls.css';");

  if (!(designSystemIndex >= 0 && primarySurfaceIndex > designSystemIndex && formControlsIndex > primarySurfaceIndex)) {
    failures.push('src/main.tsx 必须按 design-system.css → primary-surfaces.css → form-controls.css 顺序加载');
  }

  for (const text of [
    '--primary-surface-inset: var(--space-4);',
    '.panel.widget,',
    '.panel.production-surface,',
    '.panel.leaderboard-board-card,',
    '.panel.ui-primary-surface {',
    'padding: var(--primary-surface-inset);',
    '@media (max-width: 720px)',
    '--primary-surface-inset: var(--space-3);',
  ]) requireText(paths.primaryStyles, text);

  for (const text of [
    "const usesLegacyPrimarySurfaceSemantic = className.split(/\\s+/).includes('widget');",
    "usesLegacyPrimarySurfaceSemantic && 'ui-primary-surface'",
    'export function PagePanel',
    "classNames('widget', className)",
  ]) requireText(paths.layout, text);

  for (const [path, forbidden] of [
    [paths.productionStyles, '--production-surface-inset'],
    [paths.productionStyles, 'padding: var(--production-surface-inset);'],
    [paths.assetStyles, '.asset-overview-card,\n  .asset-event-panel {\n    padding: var(--space-3);'],
    [paths.shopStyles, '.gem-shop-grid > .widget { padding: var(--space-3); }'],
    [paths.leaderboardStyles, 'grid-template-rows: auto auto minmax(0, 1fr) auto;\n  padding: var(--space-4);'],
  ]) forbidText(path, forbidden);

  for (const text of [
    '`src/styles/primary-surfaces.css` 是玩家端一级卡片外层内边距的唯一 CSS 权威',
    '宽度大于 `720px` 时使用 `var(--space-4)`，即 `16px`',
    '宽度不大于 `720px` 时使用 `var(--space-3)`，即 `12px`',
    '新增一级卡片必须使用 `PagePanel`',
    '`.panel.production-surface` 与 `.panel.leaderboard-board-card`',
    '业务页面 CSS 不得',
    '该验证必须加入 `verify:architecture`',
  ]) requireText(paths.design, text);
}

if (failures.length > 0) {
  console.error('一级卡片统一内边距验证失败:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('一级卡片统一内边距验证通过：桌面 16px、移动 12px、共享组件语义、旧类兼容、加载顺序和页面覆盖清理均已锁定。');
