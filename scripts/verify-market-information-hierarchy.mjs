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
const regionalMarket = read('src/pages/MarketPage.tsx');
const globalCss = read('src/styles/global-operation-pages.css');
const commodityRow = read('src/components/market/MarketCommodityRow.tsx');
const commodityCss = read('src/styles/market-commodity-row.css');
const marketCss = read('src/styles/market-page-polish.css');
const provinceScope = read('src/utils/provinceScope.ts');
const pageDesign = read('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md');
const uiDesign = read('docs/UI_DESIGN_SYSTEM.md');
const orderBookDesign = read('docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md');
const chartDesign = read('docs/MARKET_CHART_LAYOUT_DESIGN.md');
const hierarchyBrowserSpec = read('tests/browser/market-information-hierarchy.spec.ts');

for (const token of [
  '<WidgetHeading title="商品"',
  'global-market-filter-disclosure',
  'global-market-goods-list',
  'global-market-goods-row',
  '真实成交价范围',
  'selectedGlobalProductId',
  'global-market-product-detail-panel',
  'global-market-product-region-list',
  '<MarketCommodityRow',
  '地区行情',
  'allProvinceOrders',
  'order.provinceId',
  '返回商品全局详情',
  '<EmbeddedMarketPage model={model} embedded />',
]) requireText(globalMarket, token, 'global market hierarchy');

for (const token of [
  'global-market-provinces-panel',
  'global-market-province-row',
  'MarketCoverageBar',
  '最低价地区',
  '最高价地区',
  'global-market-summary-strip',
  'global-current-scope-summary',
  'TextInput',
  'catalogQuery',
]) forbidText(globalMarket, token, 'global market hierarchy');

const catalogSourceStart = globalMarket.indexOf('const activeCatalogFilterCount');
const catalogHeadingIndex = globalMarket.indexOf('<WidgetHeading title="商品"', catalogSourceStart);
const catalogFilterIndex = globalMarket.indexOf('<details className="global-market-filter-disclosure"', catalogSourceStart);
const catalogListIndex = globalMarket.indexOf('<ul className="global-market-goods-list"', catalogSourceStart);
if (catalogSourceStart < 0 || catalogHeadingIndex < 0 || catalogFilterIndex <= catalogHeadingIndex || catalogListIndex <= catalogFilterIndex) {
  throw new Error('global market hierarchy: commodity heading, folded filters, and commodity list must appear in direct page flow');
}
const productPanelIndex = globalMarket.indexOf('<PagePanel className="global-market-product-detail-panel">');
const productRegionListIndex = globalMarket.indexOf('<ul className="global-market-product-region-list"');
if (productPanelIndex < 0 || productRegionListIndex <= productPanelIndex) {
  throw new Error('global market hierarchy: product global detail must own the regional quote list');
}

for (const token of ['卖单量', '买单量', '市场价', '24h']) requireText(commodityRow, token, 'shared commodity row');
for (const token of ['挂单差额', '基准偏离', '挂单状态']) forbidText(commodityRow, token, 'shared commodity row');
requireText(commodityCss, 'repeat(4, minmax(4.1rem, .68fr))', 'shared commodity row css');
requireText(commodityCss, '@container (max-width: 620px)', 'shared commodity row css');
requireText(commodityCss, '@container (max-width: 360px)', 'shared commodity row css');

const regionalCatalogStart = regionalMarket.indexOf("if (!facilityAssetId && marketViewMode === 'catalog')");
const regionalDetailStart = regionalMarket.indexOf('\n  const detailContent =', regionalCatalogStart);
const regionalCatalog = regionalMarket.slice(regionalCatalogStart, regionalDetailStart);
for (const token of ['market-catalog-filter-disclosure', '<MarketCommodityRow']) requireText(regionalCatalog, token, 'regional market catalog');
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
  '.global-market-goods-row',
  '.global-market-product-detail-panel',
  'container-name: global-market-page',
  '@container global-market-page (max-width: 620px)',
]) requireText(globalCss, token, 'global market css');
for (const token of ['.global-market-province-row', '.global-market-summary-strip']) forbidText(globalCss, token, 'global market css');
requireText(marketCss, '.market-fundamentals-balance', 'regional detail css');

for (const token of [
  'const allProvinceOrders = game.orders || [];',
  'allProvinceOrders,',
  'const orders = allProvinceOrders.filter((order) => order.provinceId === provinceId);',
]) requireText(provinceScope, token, 'global order projection');

for (const token of [
  '商品目录 → 商品全局详情 → 地区商品详情',
  '筛选默认折叠且不提供商品名称搜索框',
  '商品、卖单量、买单量、市场价和 24h 变化',
  '全局页不得把各州买卖单合并成一个全国订单簿',
]) requireText(pageDesign, token, 'market page authority');
for (const token of [
  '`MarketCommodityRow`',
  '移动端仍保持单行',
  '默认折叠',
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
  "getByRole('button', { name: '打开小麦全局详情' })",
  "getByRole('button', { name: '打开加利福尼亚州小麦详情' })",
  "for (const label of ['卖单量', '买单量', '市场价', '24h'])",
  "for (const label of ['挂单差额', '基准偏离', '挂单状态'])",
  "page.locator('.market-fundamentals-balance .market-balance-bar')",
]) requireText(hierarchyBrowserSpec, token, 'market hierarchy browser regression');
for (const token of [
  '.global-market-province-row',
  '.market-catalog-row',
]) forbidText(hierarchyBrowserSpec, token, 'market hierarchy browser regression');

console.log('Market information hierarchy verification passed.');
