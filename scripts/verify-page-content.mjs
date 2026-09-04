import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const failures = [];
const requireFile = (path) => {
  if (!existsSync(resolve(root, path))) failures.push(`缺少文件: ${path}`);
};
const forbidFile = (path) => {
  if (existsSync(resolve(root, path))) failures.push(`不应存在文件: ${path}`);
};
const requireText = (path, text) => {
  if (!read(path).includes(text)) failures.push(`${path} 缺少: ${text}`);
};
const forbidText = (path, text) => {
  if (read(path).includes(text)) failures.push(`${path} 不应包含: ${text}`);
};

forbidFile('scripts/verify-page-content-base.mjs');
for (const path of [
  'src/pages/GlobalMarketPage.tsx',
  'src/pages/GlobalBuildingsPage.tsx',
  'src/pages/MarketPage.tsx',
  'src/components/market/MarketCommodityRow.tsx',
  'src/styles/market-commodity-row.css',
  'src/styles/entity-list-header.css',
  'src/pages/BuildingsPage.tsx',
  'src/pages/ProvincePage.tsx',
  'src/pages/TransportPage.tsx',
  'src/components/ui/layout.tsx',
  'src/components/ui/RichSelectInput.tsx',
  'src/components/facilities/FacilityProductionConfigControls.tsx',
  'src/styles/transport-page.css',
  'docs/UI_DESIGN_SYSTEM.md',
  'tests/browser/runtime-harness.tsx',
  'tests/browser/province-locked-access.spec.ts',
  'src/pages/PageRouter.tsx',
  'src/components/shell/StrategicWorkspace.tsx',
  'src/styles/global-operation-pages.css',
  'src/styles/facility-artwork.css',
  'src/styles/design-system.css',
  'src/styles/regional-entity-page-title.css',
  'src/styles/production-surface.css',
  'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md',
  'docs/FACILITY_CATALOG_PRESENTATION_DESIGN.md',
  'docs/PRODUCTION_PILL_ALIGNMENT_DESIGN.md',
]) requireFile(path);
forbidFile('src/styles/map-zoom-controls.css');

for (const text of [
  '| 市场 | `market` | `GlobalMarketPage` |',
  '| 建筑 | `buildings` | `GlobalBuildingsPage` |',
  '一级导航中的“市场”和“建筑”固定进入全局视图',
  '建筑固定采用“工厂目录 → 工厂地区列表 → 地区工厂详情”的工厂优先钻取',
  '一级建筑页不再提供独立“地区建筑”卡片或直接地区入口',
  '默认态保持正式工厂目录顺序',
  '表头允许按工厂名称、平均利润和拥有数量',
  '一级建筑只提供工厂类型全局总览与工厂优先地区钻取',
  '图标式快捷生产设置',
  '`ProvincePage` 内的市场与建筑分区仍始终是地图所打开当前州的本地视图',
  '概览始终显示官方常住人口',
  '市场提供商品目录、今日官方价格、真实成交行情和即时写操作',
  '建筑与仓库直接显示本地经营内容',
  '一级市场商品的地区行情列表与一级建筑工厂的地区列表覆盖连续 48 州',
  '邀请卡与礼品码兑换唯一归属商店',
  '战略地图镜头、缩放、重置和平移边界唯一遵循 `LIQUID_GLASS_CHROME_DESIGN.md`',
  '地图不得提供独立的放大、缩小或重置功能面板',
]) requireText('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', text);
for (const text of [
  '运输页的“增加路线”固定放在页面正文承载面的底部 sticky 操作区',
]) requireText('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', text);
for (const text of [
  '玩家端 `PageLayout` 的标题区固定只包含返回、主标题和关闭三个槽位',
  '`PageLayout.actions` 只允许非玩家页面继续使用',
  '所有带表头的页面实体目录固定使用 `.entity-list-surface` 包裹 `EntityListHeader + .entity-list-rows`',
  '表头与首行、相邻数据行统一使用同一 `.32rem` 间距',
  '正负行情与利润统一通过 `.entity-list-value.is-positive / .is-negative` 表达',
]) requireText('docs/UI_DESIGN_SYSTEM.md', text);
for (const text of [
  'className="transport-page-footer"',
  '<PageLayout title="运输">',
]) requireText('src/pages/TransportPage.tsx', text);
for (const text of [
  'actions={(',
]) forbidText('src/pages/TransportPage.tsx', text);
requireText('src/styles/transport-page.css', '.transport-page-footer {');
forbidText('src/pages/TransportPage.tsx', 'className="transport-page-actions"');
forbidText('src/styles/transport-page.css', '.transport-page-actions {');
forbidText('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', '运输页的“增加路线”固定放在正文顶部操作区');
for (const text of [
  'page-heading-actions--player',
  'data-player-page-actions',
]) {
  forbidText('src/components/ui/layout.tsx', text);
  forbidText('src/styles/globals.css', text);
}

for (const text of [
  '建筑仍按工厂与地区入口钻取',
  '默认页汇总全部已解锁州的工厂总数、运行中、异常、有工厂州数',
  '玩家点击某州卡后进入该州地区生产工作区',
  '44px 放大／缩小／重置控制',
  '地图舞台右下角必须提供 44px 触控目标的放大、缩小和重置控制',
]) forbidText('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', text);

for (const text of [
  '正式目录必须按 `complexity` 从 `C1` 到 `C7` 升序排列',
  '只过滤、不二次排序',
]) requireText('docs/FACILITY_CATALOG_PRESENTATION_DESIGN.md', text);

for (const text of [
  '所有玩家 `PageLayout` 标题统一使用 `design-system.css` 的 `--player-page-title-track-height: 40px`',
  '普通单行标题统一使用 `--font-size-player-page-title`',
  '建筑页不得再通过 `body:has(...)`',
]) requireText('docs/PRODUCTION_PILL_ALIGNMENT_DESIGN.md', text);

for (const text of [
  '--font-size-player-page-title: 1.25rem;',
  '--player-page-title-track-height: 40px;',
  '.page-heading--player-navigation .page-heading-title {',
  'height: var(--player-page-title-track-height);',
  '.page-heading--player-navigation .page-heading-title > h1 {',
  'font-size: var(--font-size-player-page-title);',
  'text-overflow: ellipsis;',
  'white-space: nowrap;',
]) requireText('src/styles/design-system.css', text);
requireText(
  'src/styles/regional-entity-page-title.css',
  'height: var(--player-page-title-track-height);',
);
for (const text of [
  '--size-control-md',
  '--size-control-sm',
  'body:has(.regional-buildings-management) .page-heading--player-navigation .page-heading-title',
  'body:has(.facility-cluster-detail-page) .page-heading--player-navigation .page-heading-title',
]) forbidText('src/styles/production-surface.css', text);

for (const text of [
  "market: loadGlobalMarketPage",
  "buildings: loadGlobalBuildingsPage",
  "case 'market':",
  'renderPage = () => <GlobalMarketPage model={model} />;',
  "case 'buildings':",
  '<GlobalBuildingsPage model={model} />',
]) requireText('src/pages/PageRouter.tsx', text);
for (const text of [
  "renderPage = () => <MarketPage model={model} />;",
  '<BuildingsPage model={model} />',
]) forbidText('src/pages/PageRouter.tsx', text);

for (const text of [
  '<EmbeddedMarketPage model={model} embedded readOnly={false} />',
  '<EmbeddedBuildingsPage',
  'onDetailFacilityChange={handleFacilityDetailChange}',
  "import stateEconomicBaselines from '../../shared/us-state-economic-baselines.json';",
  'label="常住人口"',
  '<WarehouseInventoryPanel',
  'className="province-warehouse-section"',
]) requireText('src/pages/ProvincePage.tsx', text);
for (const text of [
  '该州尚未解锁，解锁后可以使用市场、工厂与仓库经营功能。',
  '<WidgetHeading title="州级地区未解锁"',
  'section="buildings"',
  'section="warehouse"',
  '建筑功能未解锁',
  '仓库功能未解锁',
  'ProvinceUnlockPanel',
  'province-unlock-button',
]) forbidText('src/pages/ProvincePage.tsx', text);
for (const text of [
  '即时交易',
  '今日成交价',
  '下次调价',
  'id="market-trade-quantity"',
  'market-submit-order',
]) requireText('src/pages/MarketPage.tsx', text);
for (const text of ['该地区尚未解锁，市场仅供查看。', 'market-trade-readonly', '实时五档', 'orderBook.bids', 'orderBook.asks', 'market-order-price']) forbidText('src/pages/MarketPage.tsx', text);
for (const path of ['src/pages/GlobalMarketPage.tsx', 'src/pages/GlobalBuildingsPage.tsx']) {
  requireText(path, 'return model.game.provinces;');
  requireText(path, 'const provinces = operationalProvinces(model);');
  forbidText(path, 'unlocked.has(province.id)');
}

for (const [path, expected] of [
  ['src/pages/GlobalMarketPage.tsx', [
    'export function GlobalMarketPage',
    '<PageLayout title="市场">',
    'data-global-scope="market"',
    'global-market-goods-header',
    'global-market-filter-disclosure',
    'selectedGlobalProductId',
    'global-market-product-detail',
    '<MarketCommodityRow',
    'model.setSelectedProvinceId(provinceId);',
    '<EmbeddedMarketPage model={model} embedded />',
  ]],
  ['src/pages/GlobalBuildingsPage.tsx', [
    'export function GlobalBuildingsPage',
    '<PageLayout title="建筑">',
    'data-global-scope="buildings"',
    'selectedGlobalFacilityTypeId',
    'openGlobalFacility',
    'openRegionalFacility',
    'model.setSelectedProvinceId(provinceId);',
    'setFacilityDetailTypeId(selectedGlobalFacilityTypeId);',
    '<EmbeddedBuildingsPage',
    'onDetailFacilityChange={(nextFacilityTypeId) => {',
    'className="entity-list-surface global-facility-catalog"',
    'className="global-facility-catalog-header"',
    'className="entity-list-rows global-facility-catalog-list"',
    'className="entity-list-row global-facility-catalog-row"',
    'onClick={() => openGlobalFacility(row.facilityTypeId)}',
    'data-quick-production="product"',
    'data-quick-production="method"',
    '<FacilityProductionProductSelect',
    '<FacilityProductionMethodSelect',
    'model.setFacilityRecipes(targets)',
    '<FacilityProductionProductSelect',
    '<FacilityProductionMethodSelect',
    'notifyOnReselect={row.quickProduction.productMixed}',
    "onProductChange={(value) => void applyQuickProduction(row, 'product', value)}",
    'className="global-facility-catalog-row__artwork"',
    '<ChevronIcon direction="right" />',
    'data-global-facility-type-id={selectedGlobalFacilityTypeId}',
    'className="global-facility-region-header"',
    'className="entity-list-rows global-facility-region-list"',
    'className="entity-list-row global-facility-region-row"',
    'className="global-facility-region-row__open"',
    'className="global-facility-region-row__quick-controls"',
    "onProductChange={(value) => void applyRegionalQuickProduction(row, 'product', value)}",
    "onMethodChange={(value) => void applyRegionalQuickProduction(row, 'method', value)}",
    'className={`entity-list-value global-facility-region-row__profit is-${row.profitTone}`}',
    'profitTone: presentation.tone',
    'profitValue: presentation.visibleValue',
    'profitAccessibleValue: presentation.accessibleValue',
    'profitDetail: presentation.detail',
    "label: '返回地区工厂'",
    'resolveFacilityProfitPresentation({',
    'resolveFacilityDetailRecipeState({ group, type })',
    'resolveFacilityDetailRecipeState({ group, type: selectedGlobalFacility })',
    'currentFormulaScope(group, game.lastProcessedAt)',
    'markets: game.provinceMarkets?.[province.id] ?? {},',
    'presentation.profitPerMinute * scope.physicalCount',
    'incompleteProfitProvinces.length === 0 && weightedProfitCount > 0',
  ]],
]) {
  for (const text of expected) requireText(path, text);
}

for (const text of [
  '>快捷生产设置<',
  'nextCatalogOption',
]) forbidText('src/pages/GlobalBuildingsPage.tsx', text);
for (const text of [
  '/* Global building catalog quick production: registered two-line row exception. */',
  '.global-facility-catalog-row__quick-controls {',
  '--global-facility-production-control-size: 48px;',
  '--global-facility-catalog-artwork-size: 80px;',
  'padding-block: .375rem;',
  'padding-inline: var(--entity-list-inline-padding);',
  'border: 1px solid var(--color-border-subtle);',
  '--global-facility-catalog-main-row-size: 32px;',
  'grid-row: 1;',
  'min-height: 0;',
  '.global-facility-catalog-row__quick-selector',
  '/* Global facility region rows mirror the two-line production layout without facility artwork. */',
  '.global-facility-region-row__quick-controls {',
  ".global-facility-region-row__quick-selector .ui-rich-select[data-variant='production-config'] .ui-rich-select__trigger {",
  '--global-facility-region-main-row-size: 32px;',
  ".ui-rich-select[data-variant='production-config'] .ui-rich-select__trigger",
]) requireText('src/styles/global-operation-pages.css', text);
for (const text of [
  'export function FacilityProductionProductSelect',
  'export function FacilityProductionMethodSelect',
  'detail: <ProductPlanDetail',
  'detail: !plan',
  'variant="production-config"',
]) requireText('src/components/facilities/FacilityProductionConfigControls.tsx', text);
forbidText('src/pages/GlobalBuildingsPage.tsx', 'variant="default"');
for (const text of [
  'notifyOnReselect = false,',
  'notifyOnReselect?: boolean;',
  'option.value !== value || notifyOnReselect',
]) requireText('src/components/ui/RichSelectInput.tsx', text);

for (const text of [
  '<WidgetHeading title="商品"',
  'global-market-provinces-panel',
  'global-market-province-row',
  'MarketCoverageBar',
]) forbidText('src/pages/GlobalMarketPage.tsx', text);
for (const text of [
  'market-commodity-row-header',
  '今日价格',
  '24h成交量',
  '24h价格变化',
]) requireText('src/components/market/MarketCommodityRow.tsx', text);
for (const text of ['卖单量', '买单量', '挂单差额', '基准偏离', '挂单状态']) forbidText('src/components/market/MarketCommodityRow.tsx', text);
for (const text of ['挂单差额', '基准偏离', '挂单状态']) forbidText('src/components/market/MarketCommodityRow.tsx', text);
for (const text of [
  '.entity-list-surface {',
  '.entity-list-rows {',
  '--entity-list-chevron-column: .8rem;',
  '--entity-list-artwork-slot: 42px;',
  '--entity-list-artwork-size: 34px;',
  'gap: .32rem;',
  '.entity-list-header__indicator .game-icon {',
  'width: .5rem;',
  '.entity-list-value.is-positive {',
  '.entity-list-value.is-negative {',
  'border-bottom: 1px solid var(--color-divider);',
]) requireText('src/styles/entity-list-header.css', text);
for (const text of [
  'className="entity-list-surface global-market-goods-surface"',
  'className="entity-list-rows global-market-goods-list"',
  'className="entity-list-surface global-market-product-region-surface"',
  'className="entity-list-rows global-market-product-region-list"',
  'entity-list-value',
]) requireText('src/pages/GlobalMarketPage.tsx', text);
for (const text of [
  'className="entity-list-surface global-facility-catalog"',
  'className="entity-list-rows global-facility-catalog-list"',
  'className="entity-list-surface global-facility-region-surface"',
  'className="entity-list-rows global-facility-region-list"',
  'entity-list-value',
]) requireText('src/pages/GlobalBuildingsPage.tsx', text);
forbidText('src/styles/global-operation-pages.css', '--entity-list-gap:');
forbidText('src/styles/global-operation-pages.css', '--entity-list-inline-padding:');
forbidText('src/styles/global-operation-pages.css', '@container global-market-page (max-width: 760px)');
forbidText('src/styles/global-operation-pages.css', '.global-facility-catalog-row__profit.is-positive');
forbidText('src/styles/market-commodity-row.css', '.market-commodity-row__trend.is-positive strong');
forbidText('src/styles/market-commodity-row.css', '.entity-list-header__indicator .game-icon');
forbidText('src/styles/market-commodity-row.css', '.entity-list-header__indicator {');
requireText('src/pages/GlobalMarketPage.tsx', 'className="global-market-goods-header"');
requireText('src/pages/GlobalBuildingsPage.tsx', 'className="global-facility-catalog-header"');
requireText('src/pages/GlobalBuildingsPage.tsx', 'className="global-facility-region-header"');
forbidText('src/pages/GlobalBuildingsPage.tsx', '<small>{row.province.shortName}</small>');
forbidText('src/styles/global-operation-pages.css', '.global-facility-region-row__identity small');
forbidText('src/pages/GlobalMarketPage.tsx', '筛选与排序');
forbidText('src/pages/MarketPage.tsx', '筛选与排序');
requireText('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', '商品目录 → 商品全局详情 → 地区商品详情');
requireText('docs/PRODUCT_AND_GAMEPLAY_DESIGN.md', '连续 48 州从玩家首次建档起全部可直接经营');
requireText('docs/PRODUCT_AND_GAMEPLAY_DESIGN.md', '不存在起始州选择、地区解锁或解锁费用');
requireText('docs/WAREHOUSE_EXPANSION_DESIGN.md', '连续 48 州均直接显示本地库存内容');
requireText('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', '不存在地区锁定、只读锁定市场、解锁信息、解锁按钮或按解锁状态裁剪全局列表');
requireText('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', '筛选默认折叠且不提供商品名称搜索框');
requireText('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', '市场标题区固定显示“市场”，商品目录正文不重复显示“商品”分区标题');
requireText('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', '商品列表字段名使用独立表头');

for (const text of [
  '<MetricCard',
  'global-operation-metrics',
  'global-current-scope-summary',
  '<WidgetHeading title="当前经营州"',
  '<WidgetHeading title="全局工厂目录"',
  '<WidgetHeading title="地区建筑"',
  '<PagePanel className="global-province-list-panel">',
  'className="global-province-list"',
  'className="global-province-row"',
  'provinceRows',
  'openProvinceBuildings',
  'provinceAssetSummaries',
  '类已拥有',
  '<PagePanel>\n          <WidgetHeading title="全局工厂目录"',
  'global-operation-summary-row',
  'global-facility-catalog-grid',
  'global-facility-catalog-card',
  'global-province-grid',
  'global-province-card',
  '<small>运行中</small><strong>{formatNumber(row.runningCount)}</strong>',
  '分布州数',
  'provinceIds',
]) forbidText('src/pages/GlobalBuildingsPage.tsx', text);

for (const text of [
  '.global-facility-catalog-header {',
  '.global-facility-region-header {',
  '.global-facility-catalog-row,',
  '.global-facility-region-row {',
  '.global-facility-catalog-row__artwork {',
  '--entity-list-columns: minmax(0, 1.6fr) minmax(7rem, .8fr) minmax(4rem, .45fr) var(--entity-list-chevron-column);',
  '--entity-list-columns: minmax(0, 1.45fr) minmax(6rem, .7fr) minmax(3.5rem, .42fr) minmax(4.5rem, .55fr) var(--entity-list-chevron-column);',
  'grid-template-columns: var(--entity-list-artwork-slot) minmax(0, 1fr);',
  'width: var(--entity-list-artwork-size);',
  'aspect-ratio: 1;',
  '@container (max-width: 620px)',
  '@container (max-width: 360px)',
]) requireText('src/styles/global-operation-pages.css', text);
for (const text of [
  'height: 42px;',
  'min-height: var(--entity-list-row-height, 58px);',
  'border: 1px solid var(--color-border-subtle);',
  'border-radius: var(--radius-control);',
]) requireText('src/styles/entity-list-header.css', text);
for (const text of [
  'height: 55px;',
  'height: 50px;',
  'global-operation-metrics',
  'global-current-scope-summary',
  'global-operation-summary-row',
  'global-operation-summary-artwork',
  '.global-facility-catalog-grid',
  '.global-facility-catalog-card {',
  '.global-province-list',
  '.global-province-row',
  '.global-province-grid',
  '.global-province-card {',
]) forbidText('src/styles/global-operation-pages.css', text);

requireText('src/styles/facility-artwork.css', '.global-facility-catalog-row,');
forbidText('src/styles/facility-artwork.css', '.global-facility-catalog-card,');

for (const text of [
  'StrategicMapZoomControls',
  'map-zoom-controls.css',
  'aria-label="地图缩放"',
  'aria-label="放大地图"',
  'aria-label="缩小地图"',
  'aria-label="重置地图缩放和平移"',
]) forbidText('src/components/shell/StrategicWorkspace.tsx', text);

if (failures.length) {
  console.error(`页面内容与职责验证失败:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}

console.log('页面内容与职责验证通过：一级市场/建筑锁定全局视图；市场、地区商品、建筑和地区建筑目录共用统一页面实体列表表面、间距、Chevron、目录插画槽和正负数值色；一级建筑按工厂类型 → 地区 → 现有地区工厂详情下钻；所有玩家 PageLayout 共用 40px 标题轨道与紧凑单行标题；州级上下文继续复用本地市场/建筑，邀请卡与礼品码兑换唯一归属商店，地图保留逻辑 1–4 动态美国居中手势缩放并禁止恢复独立缩放功能面板。');
