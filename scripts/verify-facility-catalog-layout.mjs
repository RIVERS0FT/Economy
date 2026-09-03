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
    '--global-facility-layout-artwork-size: 104px;',
    '--global-facility-layout-artwork-track: var(--global-facility-layout-artwork-size);',
    '.global-facility-catalog-header > :nth-child(1) {',
    'grid-column: 1 / 3;',
    '.global-facility-catalog-list,',
    'gap: .62rem;',
    '.entity-list-row.global-facility-catalog-row {',
    '--global-facility-catalog-main-row-size: 48px;',
    '--global-facility-catalog-row-gap: 8px;',
    'padding-inline: calc(var(--entity-list-inline-padding) - 1px);',
    'border: 1px solid color-mix(in srgb, var(--color-border-strong) 72%, var(--color-border));',
    'border-radius: var(--radius-card);',
    'background-color: var(--color-surface-subtle);',
    'background-image: linear-gradient(',
    '.global-facility-catalog-row__artwork {',
    'position: static;',
    'grid-column: 1;',
    'grid-row: 1 / 3;',
    'aspect-ratio: 1;',
    'margin: 0;',
    'transform: none;',
    '.global-facility-catalog-row__open,',
    '--ui-interactive-hover-border-color: var(--color-border-strong);',
    '--ui-interactive-active-transform: scale(.995);',
    'background-color: var(--color-surface-control);',
    'inset 0 0 0 1px var(--color-border-strong),',
    '.global-facility-catalog-row__open {',
    'grid-column: 2 / -1;',
    'grid-row: 1;',
    '.global-facility-catalog-row__quick-controls,',
    'width: fit-content;',
    'justify-self: start;',
    'background: transparent;',
    'box-shadow: none;',
    '.global-facility-catalog-row__quick-selector .ui-rich-select[data-variant=\'production-config\'] .ui-rich-select__trigger,',
    'background-color: var(--color-surface-soft);',
    '.entity-list-row.global-facility-region-row {',
    '--global-facility-region-main-row-size: 48px;',
    '--global-facility-region-row-gap: 8px;',
    '.global-facility-region-row__open {',
    '.global-facility-region-row__quick-controls {',
    '@container (max-width: 620px)',
    '--global-facility-layout-artwork-size: 100px;',
    '@container (max-width: 360px)',
    '--global-facility-layout-artwork-size: 96px;',
    '@container (max-width: 200px)',
    '--global-facility-layout-artwork-size: 64px;',
    'grid-row: 1;',
    'grid-column: 1 / -1;',
  ]) requireText(paths.finalLayout, text);

  for (const text of [
    'padding-left: calc(var(--global-facility-catalog-artwork-size)',
    'transform: translateY(-50%)',
    '--global-facility-catalog-main-row-size: 30px;',
    '--global-facility-region-main-row-size: 30px;',
    '--global-facility-layout-artwork-track: 84px;',
    '--global-facility-layout-artwork-track: 72px;',
    '--global-facility-layout-artwork-track: 60px;',
    '--global-facility-layout-artwork-track: 42px;',
  ]) forbidText(paths.finalLayout, text);

  for (const text of [
    '建筑两行目录是已登记例外，允许整条对象卡边界明确归属',
    '建筑目录只按下文自身例外执行',
    '建筑对象卡使用实体轻量背景、共享对象卡圆角和边界',
    '生产配置容器保持透明且不得再绘制独立底卡',
    '一级建筑插画保持 `1:1` 正方形且轨道宽度等于插画宽度',
    '卡内两行内容高度与插画高度一致',
    '主信息按钮高度低于插画高度并保持独立实体按钮质感',
    '生产配置容器必须透明无独立底卡',
    '极窄载体允许将生产按钮组移到插画下方以避免横向溢出',
    '地区工厂列表同步对象卡、主按钮和透明生产按钮组层级但不渲染插画',
    '`src/styles/global-facility-narrow.css` 是该两行条目的最终几何覆盖',
    '`tests/browser/facility-catalog-layout.spec.ts`',
    '`tests/browser/global-operation-pages.spec.ts`',
    '`tests/browser/player-page-geometry.spec.ts`',
  ]) requireText(paths.design, text);

  for (const text of [
    '外层行保持透明且不增加条目外边界',
    '第二行生产配置必须使用独立可见底部卡片',
    '桌面第一行收紧为 `30px`',
  ]) forbidText(paths.design, text);

  for (const text of [
    "test('global facility rows use object-card surfaces with square artwork and embedded production buttons'",
    "expect(desktop.rowBorderTop).toBe('1px');",
    "expect(desktop.rowBackground).not.toBe('rgba(0, 0, 0, 0)');",
    "expect(desktop.rowBackgroundImage).not.toBe('none');",
    "expect(desktop.rowBoxShadow).not.toBe('none');",
    'expect(desktop.listGap).toBeGreaterThanOrEqual(8);',
    'expect(Math.abs(desktop.artworkWidth - desktop.artworkHeight)).toBeLessThanOrEqual(1);',
    'expect(Math.abs(desktop.artworkTrackWidth - desktop.artworkWidth)).toBeLessThanOrEqual(1);',
    'expect(desktop.openHeight).toBeLessThan(desktop.artworkHeight);',
    "expect(desktop.openBackground).not.toBe('rgba(0, 0, 0, 0)');",
    "expect(desktop.openBackgroundImage).not.toBe('none');",
    "expect(desktop.openBoxShadow).not.toBe('none');",
    "expect(desktop.quickBackground).toBe('rgba(0, 0, 0, 0)');",
    "expect(desktop.quickBackgroundImage).toBe('none');",
    "expect(desktop.quickBoxShadow).toBe('none');",
    "expect(desktop.productionTriggerBorderWidth).toBe('1px');",
    "expect(desktop.productionTriggerBackground).not.toBe('rgba(0, 0, 0, 0)');",
    "expect(desktop.productionTriggerBackgroundImage).not.toBe('none');",
    "expect(desktop.productionTriggerBoxShadow).not.toBe('none');",
    "expect(region.rowBorderTop).toBe('1px');",
    "expect(region.quickBackground).toBe('rgba(0, 0, 0, 0)');",
    'expect(narrow.artworkWidth).toBeGreaterThanOrEqual(95);',
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
  console.error(`工厂目录对象卡验证失败:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}

console.log('工厂目录对象卡验证通过：一级与地区建筑使用实体对象卡，一级插画保持正方形并决定两行内容高度，主信息按钮具有独立质感，生产配置容器透明且按钮自身承担可见表面。');
