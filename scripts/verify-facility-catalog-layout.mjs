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
  finalLayout: 'src/styles/global-facility-narrow.css',
  sharedLayout: 'src/styles/global-operation-pages.css',
  design: 'docs/FACILITY_CATALOG_PRESENTATION_DESIGN.md',
  browser: 'tests/browser/facility-catalog-layout.spec.ts',
  runner: 'scripts/verify-ui-architecture-runner.mjs',
};

Object.values(paths).forEach(requireFile);

if (failures.length === 0) {
  requireText(paths.main, "import './styles/global-facility-narrow.css';");

  for (const text of [
    'Final geometry authority for the global facility catalog two-line row.',
    'GlobalBuildingsPage lazily loads global-operation-pages.css',
    '.global-operation-page .global-facility-catalog {',
    '--global-facility-layout-artwork-track:',
    '--global-facility-layout-content-columns:',
    '--global-facility-layout-columns:',
    '.global-facility-catalog-header > :nth-child(1) {',
    'grid-column: 1 / 3;',
    '.entity-list-row.global-facility-catalog-row {',
    '--global-facility-catalog-main-row-size: 30px;',
    'grid-template-columns: var(--global-facility-layout-columns);',
    '.global-facility-catalog-row__artwork {',
    'position: static;',
    'grid-column: 1;',
    'grid-row: 1 / 3;',
    'transform: none;',
    '.global-facility-catalog-row__open {',
    'grid-column: 2 / -1;',
    'border-left: 1px solid var(--color-divider);',
    '.global-facility-catalog-row__quick-controls {',
    'border-top: 1px solid var(--color-divider);',
    'background: color-mix(in srgb, var(--color-surface-inset) 24%, transparent);',
    '.global-facility-catalog-row__chevron {',
    'width: var(--entity-list-chevron-column);',
    '@container (max-width: 200px)',
    '--global-facility-layout-artwork-track: 46px;',
    '--global-facility-layout-profit-track: minmax(0, .76fr);',
    '--global-facility-layout-count-track: minmax(0, .4fr);',
    '@media (max-width: 720px)',
    '--global-facility-catalog-main-row-size: 44px;',
  ]) requireText(paths.finalLayout, text);

  for (const text of [
    'padding-left: calc(var(--global-facility-catalog-artwork-size)',
    'transform: translateY(-50%)',
  ]) forbidText(paths.finalLayout, text);

  for (const text of [
    '插画必须作为真实 Grid 列参与条目尺寸计算',
    '禁止再通过 `position: absolute`、`transform` 与正文 `padding-left` 模拟插画占位',
    '插画区与右侧内容区之间使用弱竖向分隔',
    '第一行数据区与第二行生产区之间只在右侧内容区绘制弱横向分隔',
    '桌面第一行收紧为 `30px`',
    '`src/styles/global-facility-narrow.css` 是该两行条目的最终几何覆盖',
    '`tests/browser/facility-catalog-layout.spec.ts`',
  ]) requireText(paths.design, text);

  for (const text of [
    "test('global facility artwork occupies a real grid track and the two rows have visible hierarchy'",
    "expect(desktop.artworkPosition).toBe('static');",
    'expect(desktop.artworkRight).toBeLessThan(desktop.openLeft);',
    "expect(desktop.quickBorderTop).toBe('1px');",
    'expect(Math.abs(desktop.profitLeft - headerProfitLeft)).toBeLessThanOrEqual(1);',
    'expect(narrow.rowScrollWidth).toBeLessThanOrEqual(narrow.rowClientWidth + 1);',
  ]) requireText(paths.browser, text);

  requireText(paths.runner, "await import('./verify-facility-catalog-layout.mjs');");
}

if (failures.length) {
  console.error(`工厂目录 Grid 分区验证失败:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}

console.log('工厂目录 Grid 分区验证通过：插画真实占位跨两行，第一行数据与第二行生产设置具有明确分区，且懒加载样式不会恢复悬浮布局。');
