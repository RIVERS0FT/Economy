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
const formControlsCss = read('src/styles/form-controls.css');
const gameShell = read('src/components/shell/GameShell.tsx');
const productionConfig = read('src/components/facilities/FacilityProductionConfigControls.tsx');
const productionDetail = read('src/pages/production/ProductionFacilityDetail.tsx');
const diagnostics = read('src/components/facilities/FacilityOperatingDiagnostics.tsx');
const contractNegotiation = read('src/contracts/ContractNegotiationSection.tsx');
const warehouseInventory = read('src/components/warehouse/WarehouseInventoryPanel.tsx');
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
  '真实成交价范围',
  'selectedGlobalProductId',
  'global-market-product-detail-panel',
  'global-market-product-region-list',
  '<MarketCommodityHeader />',
  '<MarketCommodityRow',
  '<ChevronIcon direction="right" />',
  '地区行情',
  'allProvinceOrders',
  'order.provinceId',
  '返回商品全局详情',
  '<EmbeddedMarketPage model={model} embedded />',
]) requireText(globalMarket, token, 'global market hierarchy');

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

const catalogSourceStart = globalMarket.indexOf('const activeCatalogFilterCount');
const catalogFilterIndex = globalMarket.indexOf('<details className="global-market-filter-disclosure"', catalogSourceStart);
const catalogHeaderIndex = globalMarket.indexOf('<div className="global-market-goods-header"', catalogSourceStart);
const catalogListIndex = globalMarket.indexOf('<ul className="global-market-goods-list"', catalogSourceStart);
if (
  catalogSourceStart < 0
  || catalogFilterIndex < 0
  || catalogHeaderIndex <= catalogFilterIndex
  || catalogListIndex <= catalogHeaderIndex
) {
  throw new Error('global market hierarchy: folded filters, column header, and commodity list must appear in direct page flow');
}
const productPanelIndex = globalMarket.indexOf('<PagePanel className="global-market-product-detail-panel">');
const productRegionHeaderIndex = globalMarket.indexOf('<MarketCommodityHeader />', productPanelIndex);
const productRegionListIndex = globalMarket.indexOf('<ul className="global-market-product-region-list"');
if (
  productPanelIndex < 0
  || productRegionHeaderIndex <= productPanelIndex
  || productRegionListIndex <= productRegionHeaderIndex
) {
  throw new Error('global market hierarchy: product global detail must render one shared header before the regional quote list');
}

for (const token of [
  'export function MarketCommodityHeader',
  'market-commodity-row-header',
  '<span>商品</span>',
  '<span>卖单量</span>',
  '<span>买单量</span>',
  '<span>市场价</span>',
  '<span>24h</span>',
  '<ChevronIcon direction="right" />',
]) requireText(commodityRow, token, 'shared commodity row');
for (const token of ['挂单差额', '基准偏离', '挂单状态', '>›<']) forbidText(commodityRow, token, 'shared commodity row');
const commodityDataRowSource = commodityRow.slice(commodityRow.indexOf('export function MarketCommodityRow'));
forbidText(commodityDataRowSource, 'market-commodity-row-header', 'shared commodity data row');
for (const token of [
  '.market-commodity-row-header',
  'display: grid;',
  'repeat(4, minmax(4.1rem, .68fr))',
  '@container (max-width: 620px)',
  '@container (max-width: 360px)',
  "content: '';",
  'border-right: 2px solid currentColor;',
  'border-bottom: 2px solid currentColor;',
]) requireText(commodityCss, token, 'shared commodity row css');
forbidText(commodityCss, '.market-catalog-list > li:first-child > .market-commodity-row-header', 'shared commodity header css');
forbidText(commodityCss, "content: '⌄';", 'shared commodity row css');

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
for (const token of ['market-catalog-filter-disclosure', '<MarketCommodityHeader />', '<MarketCommodityRow']) requireText(regionalCatalog, token, 'regional market catalog');
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
  '.global-market-product-detail-panel',
  'container-name: global-market-page',
  '@container global-market-page (max-width: 620px)',
  "content: '';",
  'border-right: 2px solid currentColor;',
  'border-bottom: 2px solid currentColor;',
]) requireText(globalCss, token, 'global market css');
for (const token of ['.global-market-province-row', '.global-market-summary-strip', "content: '⌄';"]) forbidText(globalCss, token, 'global market css');
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
  '商品、卖单量、买单量、市场价和 24h 变化',
  '全局页不得把各州买卖单合并成一个全国订单簿',
]) requireText(pageDesign, token, 'market page authority');
for (const token of [
  '`MarketCommodityRow`',
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
  "getByRole('button', { name: '打开小麦全局详情' })",
  "getByRole('button', { name: '打开加利福尼亚州小麦详情' })",
  "page.locator('.global-market-product-detail-panel > .market-commodity-row-header')",
  "page.locator('.global-market-product-region-list .market-commodity-row-header')",
  "page.locator('.market-fundamentals-balance .market-balance-bar')",
]) requireText(hierarchyBrowserSpec, token, 'market hierarchy browser regression');
for (const token of [
  '.global-market-province-row',
  '.market-catalog-row',
]) forbidText(hierarchyBrowserSpec, token, 'market hierarchy browser regression');

for (const token of [
  '一级市场采用“商品目录 → 商品全局详情 → 地区商品详情”',
  '两条路径最终都复用同一个地区商品详情、订单簿、下单和自动交易实现',
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
  [warehouseInventory, 'warehouse transport'],
]) {
  for (const glyph of ['›', '⌄', '↑', '↓', '→']) forbidText(source, glyph, label + ' directional chevrons');
}
for (const [source, token, label] of [
  [gameShell, '<ChevronIcon direction={weeklyTrendDirection} />', 'status bar'],
  [productionConfig, '<ChevronIcon direction="right" className="production-config-flow-arrow" />', 'production config'],
  [productionDetail, '<ChevronIcon direction="right" />', 'production detail'],
  [diagnostics, '<ChevronIcon direction={trendDirection} />', 'operating diagnostics'],
  [contractNegotiation, '<ChevronIcon direction="right" />', 'contract negotiation'],
  [warehouseInventory, '<ChevronIcon direction="right" />', 'warehouse transport'],
]) requireText(source, token, label + ' directional chevrons');
forbidText(gameGuide, '设置 → 游戏设置 → 教程', 'tutorial breadcrumb');
requireText(gameGuide, '设置 / 游戏设置 / 教程', 'tutorial breadcrumb');

console.log('Market information hierarchy verification passed.');
