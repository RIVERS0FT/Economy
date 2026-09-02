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
  design: 'docs/UI_DESIGN_SYSTEM.md',
  browser: 'tests/browser/facility-catalog-layout.spec.ts',
  selector: 'scripts/select-ci-tests.mjs',
  runner: 'scripts/verify-ui-architecture-runner.mjs',
};

Object.values(paths).forEach(requireFile);

if (failures.length === 0) {
  requireText(paths.main, "import './styles/global-facility-narrow.css';");

  for (const text of [
    'Final geometry authority for the global facility catalog two-line row.',
    'GlobalBuildingsPage lazily loads global-operation-pages.css',
    '.global-operation-page .global-facility-catalog {',
    '--global-facility-layout-artwork-track: var(--global-facility-layout-artwork-size);',
    '--global-facility-layout-content-columns:',
    '--global-facility-layout-columns:',
    '.global-facility-catalog-header > :nth-child(1) {',
    'grid-column: 1 / 3;',
    '.entity-list-row.global-facility-catalog-row {',
    '--global-facility-catalog-main-row-size: 30px;',
    '--global-facility-catalog-row-gap: 4px;',
    'grid-template-columns: var(--global-facility-layout-columns);',
    'row-gap: var(--global-facility-catalog-row-gap);',
    'border-bottom: 0;',
    'border: 0;',
    'background: transparent;',
    '.global-facility-catalog-row__artwork {',
    'position: static;',
    'grid-column: 1;',
    'grid-row: 1 / 3;',
    'margin: 0;',
    'transform: none;',
    '.global-facility-catalog-row__open {',
    '--ui-interactive-hover-background: var(--color-surface-soft);',
    'grid-column: 2 / -1;',
    'border-left: 0;',
    'background: var(--color-surface-panel);',
    '.global-facility-catalog-row__identity > strong,',
    'font-size: .95rem;',
    'font-weight: 800;',
    '.global-facility-catalog-row__profit,',
    'font-size: 1rem;',
    '.global-facility-catalog-row__metric:not(.global-facility-catalog-row__profit),',
    '.global-facility-region-row__status {',
    'color: var(--color-text-secondary);',
    '.global-facility-catalog-row__quick-controls {',
    'background: var(--color-surface-control);',
    '.global-facility-catalog-row__quick-selector .ui-rich-select[data-variant=\'production-config\'] .ui-rich-select__trigger,',
    'border-color: var(--color-border-strong);',
    'box-shadow:',
    '.global-facility-catalog-row__chevron {',
    'width: var(--entity-list-chevron-column);',
    '.entity-list-row.global-facility-region-row {',
    '--global-facility-region-main-row-size: 30px;',
    '--global-facility-region-row-gap: 4px;',
    'row-gap: var(--global-facility-region-row-gap);',
    '.global-facility-region-row__open {',
    '.global-facility-region-row__quick-controls {',
    'grid-column: 1 / -1;',
    'box-sizing: border-box;',
    '@container (max-width: 200px)',
    '--global-facility-layout-artwork-size: 38px;',
    '--global-facility-layout-profit-track: minmax(0, .76fr);',
    '--global-facility-layout-count-track: minmax(0, .4fr);',
    '@media (max-width: 720px)',
    '--global-facility-catalog-main-row-size: 44px;',
    '--global-facility-region-main-row-size: 44px;',
  ]) requireText(paths.finalLayout, text);

  for (const text of [
    'padding-left: calc(var(--global-facility-catalog-artwork-size)',
    'transform: translateY(-50%)',
    'border-left: 1px solid var(--color-divider);',
    'border-top: 1px solid var(--color-divider);',
    '--global-facility-layout-artwork-track: 84px;',
    '--global-facility-layout-artwork-track: 72px;',
    '--global-facility-layout-artwork-track: 60px;',
    '--global-facility-layout-artwork-track: 42px;',
  ]) forbidText(paths.finalLayout, text);

  for (const text of [
    '插画必须作为真实 Grid 列参与条目尺寸计算',
    '禁止再通过 `position: absolute`、`transform` 与正文 `padding-left` 模拟插画占位',
    '外层行保持透明且不增加条目外边界',
    '第一行下钻按钮必须使用可见共享表面底色',
    '第二行生产配置必须使用独立可见底部卡片',
    '第一行与第二行之间不得绘制独立横向分隔线',
    '插画轨道宽度必须与当前响应式插画尺寸一致',
    '建筑名称、利润和拥有数量必须高于状态、Chevron 等辅助信息的视觉权重',
    '生产方案槽继续复用 `production-config`，列表场景允许通过现有令牌强化触发按钮边界、底色与内阴影',
    '桌面第一行收紧为 `30px`',
    '地区工厂列表同步登记为相同的两行高度例外，并与一级工厂目录保持相同的第一行高度与第二行分区层级',
    '`src/styles/global-facility-narrow.css` 是该两行条目的最终几何覆盖',
    '`tests/browser/facility-catalog-layout.spec.ts`',
    '`tests/browser/global-operation-pages.spec.ts`',
    '`tests/browser/player-page-geometry.spec.ts`',
  ]) requireText(paths.design, text);

  forbidText(paths.design, '约 `38×38`、独立插画轨道收紧到约 `42px`');

  for (const text of [
    "test('global facility rows use visible split surfaces while artwork track has no extra inset'",
    "expect(desktop.artworkPosition).toBe('static');",
    'expect(Math.abs(desktop.artworkTrackWidth - desktop.artworkWidth)).toBeLessThanOrEqual(1);',
    'expect(desktop.artworkRight).toBeLessThan(desktop.openLeft);',
    "expect(desktop.rowBorderTop).toBe('0px');",
    "expect(desktop.headerBorderBottom).toBe('0px');",
    "expect(desktop.openBorderLeft).toBe('0px');",
    "expect(desktop.openBackground).not.toBe('rgba(0, 0, 0, 0)');",
    "expect(desktop.quickBorderTop).toBe('0px');",
    "expect(desktop.quickBackground).not.toBe('rgba(0, 0, 0, 0)');",
    'expect(Number(desktop.profitFontWeight)).toBeGreaterThanOrEqual(700);',
    'expect(Number(desktop.countFontWeight)).toBeGreaterThanOrEqual(700);',
    "expect(desktop.productionTriggerBorderWidth).toBe('1px');",
    "expect(desktop.productionTriggerBoxShadow).not.toBe('none');",
    'expect(Math.abs(desktop.profitLeft - headerProfitLeft)).toBeLessThanOrEqual(1);',
    "expect(region.openBackground).not.toBe('rgba(0, 0, 0, 0)');",
    "expect(region.quickBackground).not.toBe('rgba(0, 0, 0, 0)');",
    'expect(narrow.rowScrollWidth).toBeLessThanOrEqual(narrow.rowClientWidth + 1);',
  ]) requireText(paths.browser, text);

  for (const text of [
    "'tests/browser/all-pages-preview.spec.ts'",
    "'tests/browser/global-operation-pages.spec.ts'",
    "'tests/browser/player-page-geometry.spec.ts'",
  ]) requireText(paths.selector, text);

  requireText(paths.runner, "await import('./verify-facility-catalog-layout.mjs');");
}

if (failures.length) {
  console.error(`工厂目录 Grid 分区验证失败:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}

console.log('工厂目录 Grid 分区验证通过：外层行保持透明，一级与地区建筑使用可见主按钮和独立底部生产卡片，插画轨道与插画等宽，极窄载体无横向溢出。');
