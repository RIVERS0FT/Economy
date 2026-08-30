import fs from 'node:fs';

function read(path) {
  return fs.readFileSync(path, 'utf8');
}
function requireText(source, text, label) {
  if (!source.includes(text)) throw new Error(label + ': missing ' + text);
}
function forbidText(source, text, label) {
  if (source.includes(text)) throw new Error(label + ': forbidden ' + text);
}

const globalMarket = read('src/pages/GlobalMarketPage.tsx');
const globalBuildings = read('src/pages/GlobalBuildingsPage.tsx');
const regionalMarket = read('src/pages/MarketPage.tsx');
const gameIcons = read('src/components/icons/GameIcons.tsx');
const globalCss = read('src/styles/global-operation-pages.css');
const commodityRow = read('src/components/market/MarketCommodityRow.tsx');
const commodityCss = read('src/styles/market-commodity-row.css');
const entityHeaderCss = read('src/styles/entity-list-header.css');
const entityHeader = read('src/components/ui/EntityListHeader.tsx');
const assetOverviewPanel = read('src/components/assets/AssetOverviewPanel.tsx');
const formControlsCss = read('src/styles/form-controls.css');
const gameShell = read('src/components/shell/GameShell.tsx');
const productionConfig = read('src/components/facilities/FacilityProductionConfigControls.tsx');
const productionDetail = read('src/pages/production/ProductionFacilityDetail.tsx');
const diagnostics = read('src/components/facilities/FacilityOperatingDiagnostics.tsx');
const contractNegotiation = read('src/contracts/ContractNegotiationSection.tsx');
const warehouseInventory = read('src/components/warehouse/WarehouseInventoryPanel.tsx');
const transportPage = read('src/pages/TransportPage.tsx');
const gameGuide = read('src/components/GameGuideStrip.tsx');
const marketCss = read('src/styles/market-page-polish.css');
const provinceScope = read('src/utils/provinceScope.ts');
const pageDesign = read('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md');
const uiDesign = read('docs/UI_DESIGN_SYSTEM.md');
const orderBookDesign = read('docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md');
const chartDesign = read('docs/MARKET_CHART_LAYOUT_DESIGN.md');
const hierarchyBrowserSpec = read('tests/browser/market-information-hierarchy.spec.ts');
const warehouseVerifier = read('scripts/verify-warehouse-expansion.mjs');
const recipeProfitVerifier = read('scripts/verify-recipe-profit-analysis.mjs');

for (const token of [
  'global-market-filter-disclosure',
  'global-market-goods-header',
  'global-market-goods-list',
  'global-market-goods-row',
  '24h成交量',
  '24h价格变化',
  '卖单量',
  '买单量',
  '市场价',
  "type GlobalMarketSortKey = 'name' | 'sell-volume' | 'buy-volume' | 'volume24h' | 'market-price' | 'price-change24h';",
  'sortState={catalogSort}',
  'onSortChange={setCatalogSort}',
  "{ label: '商品', sortKey: 'name', defaultDirection: 'asc' }",
  "{ label: '卖单量', sortKey: 'sell-volume', defaultDirection: 'desc' }",
  "{ label: '买单量', sortKey: 'buy-volume', defaultDirection: 'desc' }",
  "{ label: '24h成交量', sortKey: 'volume24h', defaultDirection: 'desc' }",
  "{ label: '市场价', sortKey: 'market-price', defaultDirection: 'desc' }",
  "{ label: '24h价格变化', sortKey: 'price-change24h', defaultDirection: 'desc' }",
  "if (typeof market?.officialPrice === 'number') officialPrices.push(market.officialPrice);",
  "if (typeof market?.priceChange24h === 'number') priceChanges24h.push(market.priceChange24h);",
  "tradeVolume24h += Math.max(0, Number(market?.tradeVolume24h || 0));",
  'priceChange24h: average(priceChanges24h)',
  'sellVolume += Math.max(0, Number(market?.sellVolume || 0));',
  'buyVolume += Math.max(0, Number(market?.buyVolume || 0));',
  'marketPrice: average(officialPrices)',
  'selectedGlobalProductId',
  'global-market-product-detail',
  'global-market-product-region-list',
  '<MarketCommodityHeader',
  'entityLabel="地区"',
  'regionPrimary',
  'className="global-market-goods-header"',
  'entitySortKey="name"',
  "regionalSort === 'name'",
  "localeCompare(right.province.name, 'zh-CN')",
  '<MarketCommodityRow',
  '<ChevronIcon direction="right" />',
  '地区行情',
  'allProvinceOrders',
  'order.provinceId',
  '返回商品全局详情',
  '<EmbeddedMarketPage model={model} embedded />',
]) requireText(globalMarket, token, 'global market hierarchy');
for (const token of [
  "{ label: '成交地区' }",
  "{ label: '真实成交价范围' }",
  "{ label: '需求未满足' }",
]) forbidText(globalMarket, token, 'global market catalog retired summary columns');
for (const token of [
  "regionPrimary ? null : (",
  "market-commodity-row__identity--region",
  'data-current-region={currentRegion || undefined}',
  'tradeVolume24h: number;',
  '<CompactNumber value={tradeVolume24h} />',
]) requireText(commodityRow, token, 'regional commodity identity');
forbidText(globalMarket, '筛选与排序', 'global market sort must live in the header');
requireText(globalMarket, '<span>筛选</span>', 'global market filter disclosure must be named 筛选');

for (const token of [
  '<WidgetHeading title="商品"',
  'global-market-provinces-panel',
  'global-market-province-row',
  'MarketCoverageBar',
  '最低价地区',
  '最高价地区',
  'global-market-summary-strip',
  'global-current-scope-summary',
  'TextInput',
  'catalogQuery',
  '>›<',
]) forbidText(globalMarket, token, 'global market hierarchy');
for (const token of ['<PagePanel', '<WidgetHeading', '<StatusTag', '个地区']) {
  forbidText(globalMarket, token, 'global market product detail direct page flow');
}

const catalogSourceStart = globalMarket.indexOf('const activeCatalogFilterCount');
const catalogFilterIndex = globalMarket.indexOf('<details className="global-market-filter-disclosure"', catalogSourceStart);
const catalogHeaderIndex = globalMarket.indexOf('<EntityListHeader', catalogSourceStart);
const catalogListIndex = globalMarket.indexOf('<ul className="entity-list-rows global-market-goods-list"', catalogSourceStart);
if (
  catalogSourceStart < 0
  || catalogFilterIndex < 0
  || catalogHeaderIndex <= catalogFilterIndex
  || catalogListIndex <= catalogHeaderIndex
) {
  throw new Error('global market hierarchy: folded filters, sortable summary header, and commodity list must appear in direct page flow');
}
const productDetailIndex = globalMarket.indexOf('global-market-product-detail"');
const productFilterIndex = globalMarket.indexOf('<details className="global-market-filter-disclosure"', productDetailIndex);
const productRegionHeaderIndex = globalMarket.indexOf('<MarketCommodityHeader', productFilterIndex);
const productRegionListIndex = globalMarket.indexOf('<ul className="entity-list-rows global-market-product-region-list"', productRegionHeaderIndex);
if (
  productDetailIndex < 0
  || productFilterIndex < 0
  || productRegionHeaderIndex <= productFilterIndex
  || productRegionListIndex <= productRegionHeaderIndex
) {
  throw new Error('global market hierarchy: product global detail must render folded filters, one shared header, then the regional list directly in page flow');
}

for (const token of [
  'export function MarketCommodityHeader',
  'market-commodity-row-header',
  '<EntityListHeader',
  "entityLabel = '商品'",
  "label: '卖单量'",
  "label: '买单量'",
  "label: '市场价'",
  "label: '24h成交量'",
  "label: '24h价格变化'",
  '<ChevronIcon direction="right" />',
]) requireText(commodityRow, token, 'shared commodity row');
for (const token of [
  'export function EntityListHeader',
  'role="columnheader"',
  'aria-sort={ariaSort}',
  'className="entity-list-header__sort"',
  'nextEntityListSort',
]) requireText(entityHeader, token, 'shared entity list header');
for (const token of ['挂单差额', '基准偏离', '挂单状态', '>›<']) forbidText(commodityRow, token, 'shared commodity row');
const commodityDataRowSource = commodityRow.slice(commodityRow.indexOf('export function MarketCommodityRow'));
forbidText(commodityDataRowSource, 'market-commodity-row-header', 'shared commodity data row');
for (const token of [
  '.market-commodity-row-header',
  'display: grid;',
  '--entity-list-columns: minmax(8rem, 1.45fr) repeat(5, minmax(3.8rem, .64fr)) var(--entity-list-chevron-column, .8rem);',
  '@container (max-width: 620px)',
  '@container (max-width: 360px)',
  "content: '';",
  'border-right: 2px solid currentColor;',
  'border-bottom: 2px solid currentColor;',
]) requireText(commodityCss, token, 'shared commodity row css');
forbidText(commodityCss, '.market-catalog-list > li:first-child > .market-commodity-row-header', 'shared commodity header css');
forbidText(commodityCss, "content: '⌄';", 'shared commodity row css');

for (const token of [
  '.entity-list-header',
  'height: 42px;',
  '.entity-list-row',
  '--entity-list-row-height, 58px',
  'border-bottom: 1px solid var(--color-divider);',
  'font-size: var(--font-size-xs);',
  'font-weight: 700;',
]) requireText(entityHeaderCss, token, 'shared entity list header baseline');
for (const token of [
  'className="global-facility-catalog-header"',
  'className="global-facility-region-header"',
]) requireText(globalBuildings, token, 'global buildings headers must use the shared entity list baseline');
for (const token of [
  "type FacilityCatalogSortKey = 'name' | 'profit' | 'count';",
  "type FacilityRegionSortKey = 'name' | 'profit' | 'count' | 'status';",
  "key: 'catalog'",
  'sortedFacilityRows',
  'sortedFacilityProvinceRows',
  'compareOptionalNumber',
  "{ label: '工厂', sortKey: 'name', defaultDirection: 'asc' }",
  "{ label: '平均利润／分钟', sortKey: 'profit', defaultDirection: 'desc' }",
  "{ label: '状态', sortKey: 'status', defaultDirection: 'asc' }",
  'rank[left.statusCode] - rank[right.statusCode]',
]) requireText(globalBuildings, token, 'global buildings sortable headers');
requireText(assetOverviewPanel, 'className="entity-list-header asset-composition-header"', 'bank asset composition header must use the shared entity list baseline');

for (const token of [
  "export type ChevronDirection = 'left' | 'right' | 'up' | 'down';",
  'export function ChevronIcon',
  'return <ChevronIcon direction="left" {...props} />;',
]) requireText(gameIcons, token, 'shared directional chevron');
for (const token of ['<ChevronIcon direction="right" />']) requireText(globalBuildings, token, 'global buildings chevron');
forbidText(globalBuildings, '>›<', 'global buildings chevron');
for (const token of [
  '.ui-rich-select__chevron',
  'border-right: 2px solid currentColor;',
  'border-bottom: 2px solid currentColor;',
]) requireText(formControlsCss, token, 'shared select chevron');

const regionalCatalogStart = regionalMarket.indexOf("if (!facilityAssetId && marketViewMode === 'catalog')");
const regionalDetailStart = regionalMarket.indexOf('\n  const detailContent =', regionalCatalogStart);
const regionalCatalog = regionalMarket.slice(regionalCatalogStart, regionalDetailStart);
for (const token of ['market-catalog-filter-disclosure', '<MarketCommodityHeader', '<MarketCommodityRow']) requireText(regionalCatalog, token, 'regional market catalog');
forbidText(regionalCatalog, '筛选与排序', 'regional market sort must live in the header');
requireText(regionalCatalog, '<span>筛选</span>', 'regional market filter disclosure must be named 筛选');
for (const token of ['TextInput', 'catalogQuery', '挂单差额', '基准偏离', '挂单状态']) forbidText(regionalCatalog, token, 'regional market catalog');
for (const token of [
  'MarketBalanceBar',
  'market-detail-hero__market-price',
  'market-fundamentals-balance',
  '挂单差额',
  '基准偏离',
]) requireText(regionalMarket.slice(regionalDetailStart), token, 'regional market detail');

const chartIndex = regionalMarket.indexOf('<Panel className="widget market-chart-card">');
const tradeIndex = regionalMarket.indexOf('<Panel className="widget market-trade-card">');
if (chartIndex < 0 || tradeIndex < 0 || chartIndex >= tradeIndex) {
  throw new Error('regional market hierarchy: price chart must precede manual trading');
}

for (const token of [
  '.global-market-filter-disclosure',
  '.global-market-goods-header',
  '.global-market-goods-row',
  '.global-market-product-detail > .market-commodity-row-header',
  'container-name: global-market-page',
  '@container global-market-page (max-width: 620px)',
  "content: '';",
  'border-right: 2px solid currentColor;',
  'border-bottom: 2px solid currentColor;',
]) requireText(globalCss, token, 'global market css');
for (const token of ['.global-market-province-row', '.global-market-summary-strip', '.global-market-product-detail-panel', "content: '⌄';"]) forbidText(globalCss, token, 'global market css');
requireText(marketCss, '.market-fundamentals-balance', 'regional detail css');

for (const token of [
  'const allProvinceOrders = game.orders || [];',
  'allProvinceOrders,',
  'const orders = allProvinceOrders.filter((order) => order.provinceId === provinceId);',
]) requireText(provinceScope, token, 'global order projection');

for (const token of [
  '商品目录 → 商品全局详情 → 地区商品详情',
  '筛选默认折叠且不提供商品名称搜索框',
  '市场标题区固定显示“市场”，商品目录正文不重复显示“商品”分区标题',
  '商品列表字段名使用独立表头',
  '卖单量、买单量、24h 成交量、市场价和 24h 价格变化',
  '一级商品目录表头允许按商品名称、卖单量、买单量、24h 成交量、市场价和 24h 价格变化进行',
  '一级商品目录的“市场价”只作为已解锁地区官方系统价的算术平均摘要，不是可交易的“全局市场价”',
  '地区、卖单量、买单量、24h 成交量、市场价和 24h 价格变化',
  '地区行的可见身份只保留地区全名',
  '表头允许按工厂名称、平均利润和拥有数量',
  '排序不占用筛选面板',
  '全局页不得把各州买卖单合并成一个全国订单簿',
  '不显示“地区行情”标题、地区计数或外层一级卡片',
]) requireText(pageDesign, token, 'market page authority');
for (const token of [
  '`MarketCommodityRow`',
  '`EntityListHeader`',
  '移动端仍保持单行',
  '默认折叠',
  '方向型交互箭头统一使用无横杆 Chevron',
  '不得在业务组件中重新使用 `›`、`⌄`',
]) requireText(uiDesign, token, 'market ui authority');
for (const token of [
  '商品目录 → 商品全局详情 → 地区商品详情',
  '`provinceId + assetKind + assetId`',
]) requireText(orderBookDesign, token, 'order book authority');
for (const token of [
  '全局市场商品目录不再承载跨州覆盖条',
  '商品全局详情的地区行情行',
  '商品详情必须先给出市场基本面',
]) requireText(chartDesign, token, 'market visualization authority');

for (const token of [
  "test('market uses product-first global and regional information hierarchy'",
  "getByRole('heading', { level: 1, name: '市场' })",
  "page.locator('.global-market-page > .widget-heading')",
  "page.locator('.global-market-goods-header')",
  "['商品', '卖单量', '买单量', '24h成交量', '市场价', '24h价格变化']",
  "['成交地区', '真实成交价范围', '需求未满足']",
  "getByRole('button', { name: '商品', exact: true })",
  "for (const label of ['卖单量', '买单量', '24h成交量', '市场价', '24h价格变化'])",
  "getByRole('button', { name: '打开小麦全局详情' })",
  "getByRole('button', { name: '打开加利福尼亚小麦详情' })",
  "page.locator('.global-market-product-region-surface > .market-commodity-row-header')",
  "page.locator('.global-market-product-region-list .market-commodity-row-header')",
  "['地区', '卖单量', '买单量', '24h成交量', '市场价', '24h价格变化']",
  "page.locator('.market-fundamentals-balance .market-balance-bar')",
  "regionalRow.locator('.market-commodity-row__artwork')).toHaveCount(0)",
  "toHaveAttribute('aria-sort', 'ascending')",
]) requireText(hierarchyBrowserSpec, token, 'market hierarchy browser regression');
for (const token of [
  '.global-market-province-row',
  '.market-catalog-row',
]) forbidText(hierarchyBrowserSpec, token, 'market hierarchy browser regression');

for (const token of [
  '自动经营配置唯一归属工厂详情',
  '地区商品详情只读展示',
]) requireText(warehouseVerifier, token, 'warehouse/market responsibility verifier');
for (const token of [
  "const marketCommodityRowSource = read('src/components/market/MarketCommodityRow.tsx');",
  "const marketPrice = typeof market?.officialPrice === 'number' ? market.officialPrice : undefined;",
  'marketPrice={entry.marketPrice}',
  "marketDesignSource.includes('地区商品目录和商品全局详情的地区行使用该地区官方系统价 `officialPrice` 与真实 24h 成交变化')",
]) requireText(recipeProfitVerifier, token, 'recipe-profit market-price verifier');


for (const [source, label] of [
  [gameShell, 'status bar'],
  [productionConfig, 'production config'],
  [productionDetail, 'production detail'],
  [diagnostics, 'operating diagnostics'],
  [contractNegotiation, 'contract negotiation'],
  [transportPage, 'transport page'],
]) {
  for (const glyph of ['›', '⌄', '↑', '↓', '→']) forbidText(source, glyph, label + ' directional chevrons');
}
for (const [source, token, label] of [
  [gameShell, '<ChevronIcon direction={weeklyTrendDirection} />', 'status bar'],
  [productionConfig, '<ChevronIcon direction="right" className="production-config-flow-arrow" />', 'production config'],
  [diagnostics, '<ChevronIcon direction={trendDirection} />', 'operating diagnostics'],
  [contractNegotiation, '<ChevronIcon direction="right" />', 'contract negotiation'],
  [transportPage, '<ChevronIcon direction="right" />', 'transport page'],
]) requireText(source, token, label + ' directional chevrons');
forbidText(productionDetail, '交易该建筑资产', 'factory detail direct market entry');
forbidText(gameGuide, '设置 → 游戏设置 → 教程', 'tutorial breadcrumb');
requireText(gameGuide, '设置 / 游戏设置 / 教程', 'tutorial breadcrumb');

console.log('Market information hierarchy verification passed.');