import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const failures = [];
const requireText = (source, text, label) => { if (!source.includes(text)) failures.push(`${label}: missing ${text}`); };
const forbidText = (source, text, label) => { if (source.includes(text)) failures.push(`${label}: forbidden ${text}`); };

const globalMarket = read('src/pages/GlobalMarketPage.tsx');
const regionalMarket = read('src/pages/MarketPage.tsx');
const commodityRow = read('src/components/market/MarketCommodityRow.tsx');
const commodityCss = read('src/styles/market-commodity-row.css');
const marketDetailCss = read('src/styles/market-detail-direct-flow.css');
const marketAccountCss = read('src/styles/market-account-table.css');
const designSystem = read('src/styles/design-system.css');
const entityHeader = read('src/components/ui/EntityListHeader.tsx');
const pageDesign = read('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md');
const uiDesign = read('docs/UI_DESIGN_SYSTEM.md');
const marketDesign = read('docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md');
const marketRuntimeSpec = read('tests/browser/market-runtime.spec.ts');

for (const token of [
  "type GlobalMarketSortKey = 'name' | 'volume24h' | 'market-price' | 'price-change24h';",
  'function operationalProvinces(model:',
  'return model.game.provinces;',
  'global-market-filter-disclosure',
  'global-market-goods-header',
  'global-market-goods-list',
  'selectedGlobalProductId',
  'global-market-product-detail',
  'global-market-product-region-list',
  'market?.officialPrice',
  'market?.tradeVolume24h',
  'market?.priceChange24h',
  '<MarketCommodityHeader',
  'entityLabel="地区"',
  'regionPrimary',
  '<MarketCommodityRow',
  '<EmbeddedMarketPage model={model} embedded />',
]) requireText(globalMarket, token, 'global market hierarchy');

for (const token of [
  'sellVolume',
  'buyVolume',
  "'sell-volume'",
  "'buy-volume'",
  'allProvinceOrders',
  'ownOpenOrderCount',
  '有我的订单',
  'unlocked.has(province.id)',
]) forbidText(globalMarket, token, 'global market retired orderbook data');

for (const token of [
  'export function MarketCommodityHeader',
  "entityLabel = '商品'",
  "{ label: '今日价格', sortKey: 'price' }",
  "{ label: '24h成交量', sortKey: 'volume24h' }",
  "{ label: '24h价格变化', sortKey: 'trend' }",
  'tradeVolume24h: number;',
  '<CompactNumber value={tradeVolume24h} />',
  '<EntityListHeader',
]) requireText(commodityRow, token, 'shared commodity row');
for (const token of ['卖单量', '买单量', 'sellVolume', 'buyVolume', "'sell-volume'", "'buy-volume'"]) {
  forbidText(commodityRow, token, 'shared commodity row retired depth');
}
requireText(commodityCss, '--entity-list-columns: minmax(8rem, 1.55fr) repeat(3, minmax(4.5rem, .72fr)) var(--entity-list-chevron-column, .8rem);', 'shared commodity row css');
for (const token of ['role="columnheader"', 'aria-sort={ariaSort}', 'nextEntityListSort']) requireText(entityHeader, token, 'shared entity header');

for (const token of [
   '!selectedProduct ? <Panel className="widget market-detail-hero">',
   'className="market-detail-product-summary"',
  'className="market-detail-product-icon-card ui-entity-card"',
  '<ProductArtwork productId={selectedProduct.id} className="market-detail-product-artwork" />',
  'className="market-trade-summary market-detail-trade-summary ui-entity-card"',
  '<small>今日价格</small>',
  '<small>今日成交量</small>',
  '<small>可用库存</small>',
  '<CommodityFreezeDisclosure',
  'className={`widget market-chart-card ui-entity-card${marketDetailUnavailable ?',
  'const marketDetailUnavailable = Boolean(marketDetailError && !selectedMarketDetail && !selectedMarket);',
  'className="market-chart-card__content" aria-disabled={marketDetailUnavailable || undefined}',
  'market-chart-card__unavailable',
  '<section className="market-trade-card market-immediate-trade-card">',
  'function MarketImmediateTradeEntry({',
  'id="market-trade-quantity"',
  '立即买入',
  '立即卖出',
  '<Panel className="widget span-3 market-account-panel">',
  '成交记录',
  '清除记录',
]) requireText(regionalMarket, token, 'regional instant market hierarchy');
for (const token of [
  'grid-template-columns: auto minmax(0, 1fr);',
  'aspect-ratio: 1;',
  'padding-block: var(--space-2);',
  '.market-detail-surface .market-detail-product-artwork {\n  width: 100%;\n  height: 72%;\n}',
]) requireText(marketDetailCss, token, 'regional product summary geometry');
for (const token of [
  '.local-trades-heading {',
  'flex-flow: row nowrap;',
  '.local-trades-heading .ui-button {',
  'white-space: nowrap;',
]) requireText(marketAccountCss, token, 'local trade heading single row');
forbidText(marketAccountCss, 'flex-direction: column;', 'local trade heading single row');
for (const token of [
  '.page-content {\n  --radius-card: var(--radius-sm);\n  --radius-control: var(--radius-sm);',
  '.page-content button,\n.page-content .ui-button {\n  border-radius: var(--radius-sm);',
]) requireText(designSystem, token, 'page content small radius');
for (const token of [
  '页面正文中获准显示圆角的卡片与普通业务按钮统一使用 `--radius-sm`',
  '地区商品详情的成交记录标题与“清除记录”按钮在所有支持宽度下保持同一行',
  '不得为了正文小圆角缩小根级 `--radius-card`／`--radius-card-mobile`',
]) requireText(uiDesign, token, 'ui design small radius and local trade heading');
for (const token of [
  'page content buttons and entity cards use the shared small radius',
  'recent local trades heading keeps clear action on the same row on narrow screens',
  'market detail keeps snapshot history when the detail refresh fails',
]) requireText(marketRuntimeSpec, token, 'market browser regression');
for (const token of [
  'orderBook.bids',
  'orderBook.asks',
  'market-order-price',
  '已有订单',
  'ownOpenOrderCount',
  'market-account-view-switch',
  '<MarketAutoTradePanel',
]) forbidText(regionalMarket, token, 'regional retired orderbook hierarchy');
for (const token of ['近 24h 成交趋势', 'market-chart-card ui-entity-card">\n          <WidgetHeading', '<small>今日成交价</small>', '<small>下次调价</small>']) {
  forbidText(regionalMarket, token, 'regional chart title and trend tag');
}

for (const token of [
  '商品目录 → 商品全局详情 → 地区商品详情',
  '连续 48 州均为完整经营上下文',
  '市场提供商品目录、今日官方价格、真实成交行情和当日价即时交易写操作',
  '趋势卡改为不可用状态',
]) requireText(pageDesign, token, 'page design');
for (const token of [
  '玩家商品交易不得创建 `open`／`partial` 商品订单',
  '一个自然日内同一州×商品的 `officialPrice` 固定不变',
  '玩家商品页面永久移除：价格输入框',
]) requireText(marketDesign, token, 'market design');

if (failures.length) {
  console.error('市场信息层级验证失败：');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}
console.log('市场信息层级验证通过：全局目录与地区列表只展示今日官方价和真实成交指标，地区详情只保留数量型即时交易、行情与最近成交。');
