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
  globalOperationStyles: 'src/styles/global-operation-pages.css',
  entityHeaderStyles: 'src/styles/entity-list-header.css',
  productionStyles: 'src/styles/production-surface.css',
  assetStyles: 'src/styles/asset-overview.css',
  shopStyles: 'src/styles/gem-shop.css',
  leaderboardStyles: 'src/styles/leaderboards.css',
  geometryTest: 'tests/browser/player-page-geometry.spec.ts',
  marketRuntimeTest: 'tests/browser/market-runtime.spec.ts',
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
    '.global-operation-page {',
    'width: 100%;',
    'max-width: 100%;',
    'container-type: inline-size;',
    '.global-facility-catalog-header,',
    '.global-facility-region-header {',
    '.global-facility-catalog-list,',
    '.global-facility-region-list {',
    '.global-facility-catalog-row,',
    '.global-facility-region-row {',
    'grid-template-columns: minmax(0, 1.6fr) minmax(7rem, .8fr) minmax(4rem, .45fr) 1rem;',
    'grid-template-columns: minmax(0, 1.45fr) minmax(6rem, .7fr) minmax(3.5rem, .42fr) minmax(4.5rem, .55fr) 1rem;',
    '.global-facility-catalog-row__artwork {',
    'aspect-ratio: 1;',
    '.global-facility-region-row__profit,',
    '@container (max-width: 620px)',
    'grid-template-columns: minmax(0, 1.45fr) minmax(4.65rem, .8fr) minmax(2.4rem, .42fr) .6rem;',
    'grid-template-columns: minmax(0, 1.2fr) minmax(4.5rem, .68fr) minmax(2.2rem, .35fr) minmax(3rem, .48fr) .6rem;',
    '@container (max-width: 360px)',
    'grid-template-columns: minmax(0, 1.35fr) minmax(4.25rem, .76fr) minmax(2.1rem, .4fr) .55rem;',
    'grid-template-columns: minmax(0, .9fr) minmax(0, 1.15fr) minmax(0, .45fr) minmax(0, .75fr) .4rem;',
    'padding-inline: .1rem;',
    'font-size: .6875rem;',
    '@media (max-width: 720px)',
  ]) requireText(paths.globalOperationStyles, text);
  for (const text of [
    '.entity-list-header {',
    'border-bottom: 1px solid var(--color-divider);',
    '.entity-list-header > span {',
    'text-overflow: ellipsis;',
  ]) requireText(paths.entityHeaderStyles, text);
  for (const text of [
    '.global-facility-catalog-row {\n    grid-template-columns: repeat(2, minmax(0, 1fr));',
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
    '`--player-page-content-inset` 固定使用当前 `.game-shell` 的 `var(--layout-gutter)`',
    '桌面端页面实际宽度必须等于 `workspaceCard` 中扣除固定 `78px` 指挥轨道后的页面槽宽度',
    '移动端页面实际宽度必须等于唯一根级 Mobile Workspace Sheet 的内容盒宽度',
    '不得再使用 `padding-top: 0`',
    '新增一级卡片必须使用 `PagePanel`',
    '`.panel.production-surface` 与 `.panel.leaderboard-board-card`',
    '业务页面 CSS 不得',
    '一级建筑页只保留全局工厂目录，不再存在独立地区建筑卡片',
    '地区工厂列表同样保持“地区｜利润／分钟｜拥有｜状态”的单行结构',
    '全局建筑列表的响应不能只依赖浏览器 viewport',
    '真实页面承载宽度不大于 `620px` 时',
    '极窄 `360px` 及以下',
    '一级建筑页已退役独立“地区建筑”卡片及其 `.global-province-list` / `.global-province-row` 布局规则',
    '`tests/browser/player-page-geometry.spec.ts`',
    '分别对一级全局工厂目录和点击工厂后的地区工厂列表执行边界与跨断点真实几何回归',
    '两级工厂条目必须在所有覆盖断点保持单行高度',
    '浏览器真实几何回归若在同一页面实例内跨越 `720px` 桌面／移动断点',
    '`tests/browser/market-runtime.spec.ts` 的跨桌面／移动响应式几何用例',
    '该验证必须加入 `verify:architecture`',
  ]) requireText(paths.design, text);

  requireText(
    paths.marketRuntimeTest,
    "await expect(orderEntry).toBeVisible();\n  await expect(orderBook).toBeVisible();\n  const mobileOrder = await requireBox(orderEntry);\n  const mobileBook = await requireBox(orderBook);",
  );

  for (const text of [
    "test.describe('player page safe geometry'",
    'desktop and mobile pages stay inside their real carrier width',
    'edge breakpoints keep the buildings lists fully visible',
    'scrollWidth',
    'clientWidth',
    'firstContentTopGap',
    'mobileSheet',
    'primaryCard',
    "await expect(page.locator('.global-facility-catalog-list')).toBeVisible();",
    "await expect(page.locator('.global-province-list')).toHaveCount(0);",
    "querySelector<HTMLElement>('.global-facility-catalog-list')",
    "querySelectorAll<HTMLElement>(':scope > li > .global-facility-catalog-row')",
    "throw new Error('buildings catalog fixture is incomplete');",
    "await facilityRows.first().evaluate((button: HTMLButtonElement) => button.click());",
    "await expect(page.locator('.global-facility-region-list')).toBeVisible();",
    "querySelector<HTMLElement>('.global-facility-region-list')",
    "querySelectorAll<HTMLElement>(':scope > li > .global-facility-region-row')",
    "throw new Error('buildings region list fixture is incomplete');",
    'expect(row.height).toBeLessThanOrEqual(62);',
    'expect(row.height).toBeLessThanOrEqual(58);',
  ]) requireText(paths.geometryTest, text);
  forbidText(paths.geometryTest, "querySelectorAll<HTMLElement>(':scope > .global-facility-catalog-row')");
  forbidText(paths.geometryTest, "querySelector<HTMLElement>('.global-province-list')");
  forbidText(paths.geometryTest, "querySelectorAll<HTMLElement>(':scope > li > .global-province-row')");
  forbidText(paths.geometryTest, '.global-operation-metrics');
  forbidText(paths.geometryTest, '.global-facility-catalog-grid');
  forbidText(paths.geometryTest, '.global-facility-catalog-card');
  forbidText(paths.geometryTest, 'buildings metrics fixture is incomplete');

  for (const text of [
    '| `src/styles/primary-surfaces.css` | 玩家端一级卡片外层内边距令牌、最终选择器、移动断点与旧一级卡片类兼容入口 |',
    '- `PagePanel`',
    '`PagePanel` 是新增玩家端一级卡片的唯一 React 入口',
    '`--primary-surface-inset` 唯一控制',
    '不得定义一级卡片外层内边距',
    '在业务页面 CSS 中重新声明一级卡片外层 padding',
  ]) requireText(paths.uiDesign, text);
}

if (failures.length > 0) {
  console.error('一级卡片统一内边距验证失败:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('一级卡片统一内边距验证通过：桌面 16px、移动 12px、共享组件语义、承载面局部间距、跨端页面安全宽度、正文顶部留白、全局建筑目录与地区工厂五列单行按真实承载宽度响应、旧类兼容、样式与设计文档权威均已锁定。');
