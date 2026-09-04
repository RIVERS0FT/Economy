import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const failures = [];
const requireText = (source, text, label) => { if (!source.includes(text)) failures.push(`${label}: missing ${text}`); };
const forbidText = (source, text, label) => { if (source.includes(text)) failures.push(`${label}: forbidden ${text}`); };

const globalMarket = read('src/pages/GlobalMarketPage.tsx');
const regionalMarket = read('src/pages/MarketPage.tsx');
const commodityRow = read('src/components/market/MarketCommodityRow.tsx');
const commodityCss = read('src/styles/market-commodity-row.css');
const entityHeader = read('src/components/ui/EntityListHeader.tsx');
const pageDesign = read('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md');
const marketDesign = read('docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md');

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
  'market-detail-hero__metrics',
  '<small>今日价格</small>',
  '<small>24h 变化</small>',
  '<small>可用库存</small>',
  '<Panel className="widget market-chart-card">',
  '<section className="market-trade-card market-immediate-trade-card">',
  '<small>今日成交量</small>',
  '<small>24h 成交量</small>',
  '<small>下次调价</small>',
  'function MarketImmediateTradeEntry({',
  'id="market-trade-quantity"',
  '立即买入',
  '立即卖出',
  '<Panel className="widget span-3 market-account-panel">',
  '最近成交',
]) requireText(regionalMarket, token, 'regional instant market hierarchy');
for (const token of [
  'orderBook.bids',
  'orderBook.asks',
  'market-order-price',
  '已有订单',
  'ownOpenOrderCount',
  'market-account-view-switch',
  '<MarketAutoTradePanel',
]) forbidText(regionalMarket, token, 'regional retired orderbook hierarchy');

for (const token of [
  '商品目录 → 商品全局详情 → 地区商品详情',
  '连续 48 州均为完整经营上下文',
  '市场提供商品目录、今日官方价格、真实成交行情和当日价即时交易写操作',
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
