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
  layout: 'src/styles/global-facility-narrow.css',
  design: 'docs/UI_DESIGN_SYSTEM.md',
  navigationDesign: 'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
  browser: 'tests/browser/facility-catalog-layout.spec.ts',
  crossPageBrowser: 'tests/browser/all-pages-preview.spec.ts',
  selector: 'scripts/select-ci-tests.mjs',
  runner: 'scripts/verify-ui-architecture-runner.mjs',
};

Object.values(paths).forEach(requireFile);

if (failures.length === 0) {
  requireText(paths.main, "import './styles/global-facility-narrow.css';");

  for (const text of [
    'shared flat-list treatment of building catalog rows',
    '.global-operation-page .global-facility-catalog-list,',
    '.global-operation-page .global-facility-region-list {',
    'gap: 0;',
    '.entity-list-row.global-facility-catalog-row {',
    '.entity-list-row.global-facility-region-row {',
    'border-bottom: 1px solid var(--color-divider);',
    'border-radius: 0;',
    'padding-inline: 0;',
    '--global-facility-catalog-main-row-size: 42px;',
    '--global-facility-region-main-row-size: 42px;',
    '--global-facility-catalog-main-row-size: 40px;',
    '--global-facility-region-main-row-size: 40px;',
    'padding-inline: .625rem;',
    'background: transparent;',
    'box-shadow: none;',
    'border: 1px solid color-mix(in srgb, var(--color-border-strong) 82%, var(--color-border));',
    'background-color: color-mix(in srgb, var(--color-surface-control) 88%, var(--color-surface-soft));',
    '.global-facility-catalog-row__artwork {',
    'position: static;',
    'grid-row: 1 / 3;',
    'aspect-ratio: 1;',
    '.global-facility-catalog-row__open,',
    '.global-facility-catalog-row__quick-selector .ui-rich-select[data-variant=\'production-config\'] .ui-rich-select__trigger,',
    '@container (max-width: 620px)',
    '@container (max-width: 360px)',
    '@container (max-width: 200px)',
  ]) requireText(paths.layout, text);

  for (const text of [
    'border-radius: var(--radius-card);',
    'background-color: var(--color-surface-subtle);',
    '0 2px 8px color-mix',
    'inset 0 0 0 1px var(--color-border-strong)',
  ]) forbidText(paths.layout, text);

  for (const text of [
    '建筑目录等连续比较对象使用共享列表或表格行及细线分隔',
    '一级与地区建筑条目保持透明、无圆角、无外层阴影，以相邻细线分隔',
    '一级与地区建筑外层保持扁平实体行',
    '共享表头和相邻条目细线继续可见',
    '建筑两级条目及其名称槽不保留左右内边距',
    '条目自身和名称槽的左右内边距必须为零',
    '第一行下钻主按钮桌面为 `42px`、窄宽度为 `40px`',
    '第一行信息按钮使用 `--radius-control`、实体底色和细边界、`.625rem` 左右内边距明确表示可下钻',
    '第一行信息按钮桌面为 `42px`、窄宽度为 `40px`',
    '全局建筑目录与其地区下钻列表的第一行信息按钮是第三个明确例外',
    '第一行信息按钮使用 `--radius-control`、实体底色和细边界明确表示可下钻',
    '第一行信息按钮高度低于插画高度，并以 `--radius-control`、实体底色、细边界和轻量内高光明确下钻交互',
    '建筑保留两行内容密度、插画跨行和生产方案按钮自身边界',
    '全局市场商品目录、全局工厂目录、全局工厂地区列表和银行资产构成表继续使用共享表头底线',
    '不得恢复对象卡、圆角、外层阴影',
  ]) requireText(paths.design, text);

  requireText(paths.navigationDesign, '目录表头固定显示“建筑｜利润｜拥有”');

  for (const text of [
    '建筑两行目录是已登记例外，允许整条对象卡边界明确归属',
    '建筑对象卡使用实体轻量背景、共享对象卡圆角和边界',
    '地区工厂列表同步对象卡、主按钮和透明生产按钮组层级',
  ]) forbidText(paths.design, text);

  for (const text of [
    "test('global facility rows are flat lists with square artwork and embedded production buttons'",
    "expect(desktop.rowBorderBottom).toBe('1px');",
    "expect(desktop.rowBorderRadius).toBe('0px');",
    'expect(desktop.rowPaddingLeft).toBe(0);',
    'expect(desktop.openHeight).toBe(42);',
    'expect(desktop.openPaddingLeft).toBe(10);',
    "expect(desktop.rowBackground).toBe('rgba(0, 0, 0, 0)');",
    "expect(desktop.openBackground).not.toBe('rgba(0, 0, 0, 0)');",
    "expect(desktop.headerBorderBottom).toBe('1px');",
    'expect(desktop.listGap).toBe(0);',
    'expect(Math.abs(desktop.artworkWidth - desktop.artworkHeight)).toBeLessThanOrEqual(1);',
    "expect(desktop.productionTriggerBorderWidth).toBe('1px');",
  ]) requireText(paths.browser, text);

  forbidText(paths.crossPageBrowser, 'facility object-card radius should remain distinct from commodity rows');

  for (const text of [
    "'tests/browser/all-pages-preview.spec.ts'",
    "'tests/browser/global-operation-pages.spec.ts'",
    "'tests/browser/player-page-geometry.spec.ts'",
  ]) requireText(paths.selector, text);

  requireText(paths.runner, "await import('./verify-facility-catalog-layout.mjs');");
}

if (failures.length) {
  console.error(`工厂目录扁平列表验证失败:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}

console.log('工厂目录扁平列表验证通过：一级与地区建筑保持两行生产配置与插画几何，但不再使用对象卡。');
