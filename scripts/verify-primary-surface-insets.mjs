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
  scrollingStyles: 'src/styles/scrolling-page-sections.css',
  contentSurfaces: 'src/styles/content-surfaces.css',
  globalOperationStyles: 'src/styles/global-operation-pages.css',
  entityHeaderStyles: 'src/styles/entity-list-header.css',
  productionStyles: 'src/styles/production-surface.css',
  assetStyles: 'src/styles/asset-overview.css',
  shopStyles: 'src/styles/gem-shop.css',
  leaderboardStyles: 'src/styles/leaderboards.css',
  provincePage: 'src/pages/ProvincePage.tsx',
  provinceStyles: 'src/styles/province-page.css',
  geometryTest: 'tests/browser/player-page-geometry.spec.ts',
  marketRuntimeTest: 'tests/browser/market-runtime.spec.ts',
  contractAttentionTest: 'tests/browser/contract-attention-background.spec.ts',
  design: 'docs/PRIMARY_SURFACE_INSET_DESIGN.md',
  uiDesign: 'docs/UI_DESIGN_SYSTEM.md',
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
    '.game-shell {\n  --player-page-content-inset: var(--layout-gutter);',
    '.panel.widget,',
    '.panel.production-surface,',
    '.panel.leaderboard-board-card,',
    '.panel.ui-primary-surface {',
    'padding: var(--primary-surface-inset);',
    '.game-shell .page-content--player {\n  width: 100%;\n  min-width: 0;',
    '.game-shell .page-content--player .page-card-scroll-area,',
    '.game-shell .page-content--player .page-card-scroll,',
    '.game-shell .page-content--player .page-card-static {',
    'max-width: 100%;',
    '.game-shell .page-content--player .page-card-scroll {\n  padding: var(--player-page-content-inset);\n  overflow-x: hidden;',
    '.game-shell .page-content--player .page-card-scroll > *,\n.game-shell .page-content--player .page-card-static > * {',
    '.game-shell .page-content--player .page-card-scroll > * > *,\n.game-shell .page-content--player .page-card-static > * > * {',
    '@media (max-width: 720px)',
    '--primary-surface-inset: var(--space-3);',
  ]) requireText(paths.primaryStyles, text);
  forbidText(paths.primaryStyles, '.ui-page-stack');
  forbidText(paths.primaryStyles, ':root {\n  --primary-surface-inset: var(--space-4);\n  --player-page-content-inset:');

  for (const text of [
    "@import './content-surfaces.css';",
    '.page-card-scroll .panel:not(.ui-entity-card):not(.contract-card):not(.asset-auction-card),',
    '.page-card-scroll .ui-primary-surface:not(.ui-entity-card):not(.contract-card):not(.asset-auction-card) {',
    'border-top: 1px solid var(--color-divider);',
    'border-radius: 0;',
    'background: transparent;',
    'backdrop-filter: none;',
  ]) requireText(paths.scrollingStyles, text);
  forbidText(paths.scrollingStyles, '.page-card-scroll .panel,\n.page-card-scroll .ui-primary-surface {');

  for (const text of [
    '.ui-entity-card:not(.panel),',
    '.panel.ui-entity-card,',
    '.panel.contract-card,',
    '.panel.asset-auction-card {',
    'border: 1px solid var(--color-border);',
    'border-radius: var(--radius-card);',
    'padding: var(--primary-surface-inset);',
    'background: var(--color-surface-subtle);',
    'box-shadow: none;',
    'backdrop-filter: none;',
    '.panel.contract-card--attention {',
    '.panel.contract-card--danger {',
    '.ui-metric-strip,',
    '.contract-summary-grid {',
    '.contract-summary-grid > .ui-metric-card {',
    'border-radius: 0;',
    'background: transparent;',
  ]) requireText(paths.contentSurfaces, text);
  forbidText(paths.contentSurfaces, 'blur(');

  for (const text of [
    '.global-operation-page {',
    'width: 100%;',
    'max-width: 100%;',
    'container-type: inline-size;',
    '.global-facility-catalog-header {',
    '.global-facility-region-header {',
    '.global-facility-catalog-row,',
    '.global-facility-region-row {',
    '--entity-list-columns: minmax(0, 1.6fr) minmax(7rem, .8fr) minmax(4rem, .45fr) var(--entity-list-chevron-column);',
    '--entity-list-columns: minmax(0, 1.45fr) minmax(6rem, .7fr) minmax(3.5rem, .42fr) minmax(4.5rem, .55fr) var(--entity-list-chevron-column);',
    '.global-facility-catalog-row__artwork {',
    'padding-block: .375rem;',
    'padding-inline: var(--entity-list-inline-padding);',
    'border: 1px solid var(--color-border-subtle);',
    '--global-facility-catalog-main-row-size: 32px;',
    '--global-facility-production-control-size: 48px;',
    '.global-facility-catalog-row__open {',
    'grid-row: 1;',
    'min-height: 0;',
    'width: var(--entity-list-artwork-size);',
    'aspect-ratio: 1;',
    '.global-facility-region-row__profit,',
    '.global-facility-region-row__open {',
    '.global-facility-region-row__quick-controls {',
    '@container (max-width: 620px)',
    '@container (max-width: 360px)',
    '@media (max-width: 720px)',
  ]) requireText(paths.globalOperationStyles, text);
  for (const text of [
    '.entity-list-surface {',
    '--entity-list-gap: .55rem;',
    '--entity-list-inline-padding: .6rem;',
    '--entity-list-chevron-column: .8rem;',
    '--entity-list-artwork-slot: 42px;',
    '--entity-list-artwork-size: 34px;',
    '.entity-list-rows {',
    'gap: .32rem;',
    '.entity-list-header {',
    'border-bottom: 1px solid var(--color-divider);',
    '.entity-list-row {',
    '@container (max-width: 620px)',
    '@container (max-width: 360px)',
  ]) requireText(paths.entityHeaderStyles, text);
  for (const text of [
    '.global-province-list',
    '.global-province-row',
    '.global-operation-metrics',
    '.global-current-scope-summary',
    '.global-operation-summary-row',
    '.global-facility-catalog-grid',
    '.global-facility-catalog-card {',
    '.global-province-grid',
    '.global-province-card {',
  ]) forbidText(paths.globalOperationStyles, text);

  for (const text of [
    "const usesLegacyPrimarySurfaceSemantic = className.split(/\\s+/).includes('widget');",
    "usesLegacyPrimarySurfaceSemantic && 'ui-primary-surface'",
    'export function PagePanel',
    "classNames('widget', className)",
  ]) requireText(paths.layout, text);

  requireText(paths.provincePage, 'className="province-overview-content"');
  requireText(paths.provinceStyles, '.province-overview-content {');
  for (const text of ['province-lock-content', 'province-unlock-button']) {
    forbidText(paths.provincePage, text);
    forbidText(paths.provinceStyles, text);
  }
  for (const text of ['province-overview-panel', 'province-lock-panel']) {
    forbidText(paths.provincePage, text);
    forbidText(paths.provinceStyles, text);
  }

  for (const [path, forbidden] of [
    [paths.productionStyles, '--production-surface-inset'],
    [paths.productionStyles, 'padding: var(--production-surface-inset);'],
    [paths.assetStyles, '.asset-overview-card,\n  .asset-event-panel {\n    padding: var(--space-3);'],
    [paths.shopStyles, '.gem-shop-grid > .widget { padding: var(--space-3); }'],
    [paths.leaderboardStyles, 'grid-template-rows: auto auto minmax(0, 1fr) auto;\n  padding: var(--space-4);'],
  ]) forbidText(path, forbidden);

  for (const text of [
    '是否滚动不再决定卡片资格',
    '`UI_DESIGN_SYSTEM.md` 决定页面分区、列表、对象卡和高层独立表面的视觉语义',
    '`--primary-surface-inset` 是唯一外层 inset 令牌',
    '正文 `.ui-entity-card` 与合同兼容入口 `.contract-card` 复用 `--primary-surface-inset`',
    '`PagePanel` 固定输出 `panel widget ui-primary-surface` 兼容语义',
    '公开合同和进行中合同必须保持对象卡边界',
    '页面摘要指标属于同一比较条',
    '正文对象卡禁止 `backdrop-filter` 和高层浮动阴影',
    '退役页面与结构边界',
    '不得把独立复杂业务对象重新无条件扁平化',
    '`tests/browser/contract-attention-background.spec.ts`',
    '该验证必须加入 `verify:architecture`',
  ]) requireText(paths.design, text);

  for (const text of [
    '页面结构与独立业务对象必须按语义而不是滚动状态分类',
    '页面内容区固定使用四类表面语义',
    '是否随页面正文滚动不再作为是否使用圆角卡片的判断条件',
    '圆角不等于毛玻璃',
    '现有合同 `.contract-summary-grid` 是该语义的兼容映射',
    '合同页作为当前对象卡样板',
  ]) requireText(paths.uiDesign, text);

  requireText(
    paths.marketRuntimeTest,
    "await expect(orderEntry).toBeVisible();\n  await expect(orderBook).toBeVisible();\n  const mobileOrder = await requireBox(orderEntry);\n  const mobileBook = await requireBox(orderBook);",
  );

  for (const text of [
    "test.describe('player page safe geometry'",
    'const pageGeometryViewports = [',
    'for (const viewport of pageGeometryViewports)',
    'for (const target of playerPages)',
    '页面保持在真实承载宽度内',
    'edge breakpoint ${viewport.width}x${viewport.height} keeps the buildings lists fully visible',
    'test(`edge breakpoint ${viewport.width}x${viewport.height} keeps the buildings lists fully visible`',
    '{ width: 320, height: 720 },',
    '{ width: 720, height: 900 },',
    '{ width: 721, height: 900 },',
    '{ width: 960, height: 900 },',
    '{ width: 1440, height: 900 },',
    'scrollWidth',
    'clientWidth',
    'firstContentTopGap',
    'mobileSheet',
    'primaryCard',
    "await expect(page.locator('.global-facility-catalog-list')).toBeVisible();",
    "await expect(page.locator('.global-province-list')).toHaveCount(0);",
    "querySelector<HTMLElement>('.global-facility-catalog-list')",
    "querySelectorAll<HTMLElement>(':scope > li > .global-facility-catalog-row')",
    "await expect(page.locator('.global-facility-region-list')).toBeVisible();",
    "querySelector<HTMLElement>('.global-facility-region-list')",
    "querySelectorAll<HTMLElement>(':scope > li > .global-facility-region-row')",
    'expect(row.height).toBeGreaterThanOrEqual(104);',
    'expect(row.height).toBeLessThanOrEqual(132);',
    "page.locator('.global-facility-region-row__quick-controls')",
  ]) requireText(paths.geometryTest, text);
  forbidText(paths.geometryTest, 'test.setTimeout(');
  forbidText(paths.geometryTest, 'desktop and mobile pages stay inside their real carrier width');
  forbidText(paths.geometryTest, '.global-operation-metrics');
  forbidText(paths.geometryTest, '.global-facility-catalog-grid');
  forbidText(paths.geometryTest, '.global-facility-catalog-card');
  forbidText(paths.geometryTest, "test('edge breakpoints keep the buildings lists fully visible'");

  for (const text of [
    'independent contract cards keep object boundaries and warning tint',
    'normalStyle.borderRadius',
    'normalStyle.backdropFilter',
    'summaryStyle.borderRadius',
    "expect(summaryStyle.borderRadius).toBe('0px')",
  ]) requireText(paths.contractAttentionTest, text);
}

if (failures.length > 0) {
  console.error('页面表面与卡片内边距验证失败:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('页面表面与卡片内边距验证通过：页面结构继续扁平化，合同与进行中拍卖等复杂独立业务对象保留轻量圆角边界，合同摘要保持统一指标条，正文对象卡无毛玻璃，同时共享 inset、承载安全几何和既有列表回归均已锁定。');
