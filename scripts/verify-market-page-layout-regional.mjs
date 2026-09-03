import fs from 'node:fs';

const read = (path) => fs.readFileSync(path, 'utf8');
const marketPage = read('src/pages/MarketPage.tsx');
const marketStyles = read('src/styles/market-page-polish.css');
const detailStyles = read('src/styles/market-detail-direct-flow.css');
const commodityRow = read('src/components/market/MarketCommodityRow.tsx');
const commodityRowStyles = read('src/styles/market-commodity-row.css');
const entityListHeader = read('src/components/ui/EntityListHeader.tsx');
const chartSource = read('src/components/charts/PriceSparkline.tsx');
const serverDelivery = read('server/src/market-state-delivery.js');
const serverDeliveryTest = read('server/test/market-state-delivery.test.js');
const marketDesign = read('docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md');

const failures = [];
function requireText(source, text, message) {
  if (!source.includes(text)) failures.push(message);
}
function forbidText(source, text, message) {
  if (source.includes(text)) failures.push(message);
}

requireText(marketStyles, '.market-page-surface .unified-market-grid {', '地区市场必须继续使用统一单列主网格。');
forbidText(marketStyles, 'grid-template-columns: minmax(560px, 0.82fr) minmax(680px, 1.18fr)', '市场不得恢复行情与交易一级双列。');
requireText(chartSource, 'export function buildMarketChartGeometry', '完整行情图必须继续使用动态几何。');
forbidText(marketStyles, 'aspect-ratio: 16 / 9', '市场 CSS 不得固定行情图 16:9。');

for (const token of [
  "type MarketCatalogStatus = 'all' | 'traded' | 'unmet-demand';",
  "type MarketCatalogSort = 'catalog' | 'name' | 'price' | 'trend' | 'volume24h';",
  'className="market-catalog-filter-disclosure"',
  '<MarketCommodityHeader',
  'entitySortKey="name"',
  '<MarketCommodityRow',
  "onClick={() => selectMarketAsset(entry.kind, entry.id, !embedded)}",
]) requireText(marketPage, token, `地区商品目录缺少即时市场结构: ${token}`);
for (const token of [
  "'buy' | 'sell' |",
  "'buy-volume'",
  "'sell-volume'",
  '有买盘',
  '有卖盘',
  '有我的订单',
  'ownOrderCount',
]) forbidText(marketPage, token, `地区商品目录不得恢复玩家挂单筛选或指标: ${token}`);

for (const token of ['今日价格', '24h成交量', '24h价格变化']) requireText(commodityRow, token, `共享商品表头必须显示 ${token}。`);
for (const token of ['卖单量', '买单量', 'sellVolume', 'buyVolume', "'buy-volume'", "'sell-volume'"]) forbidText(commodityRow, token, `共享商品列表不得恢复盘口接口或指标: ${token}`);
requireText(commodityRow, "entityLabel = '商品'", '共享商品表头默认首列必须为商品。');
requireText(commodityRow, '<EntityListHeader', '共享商品表头必须复用统一实体列表表头。');
requireText(entityListHeader, 'role="columnheader"', '共享实体列表表头必须使用列标题语义。');
requireText(entityListHeader, 'aria-sort={ariaSort}', '共享实体列表表头必须播报排序方向。');
requireText(commodityRowStyles, '--entity-list-columns: minmax(8rem, 1.55fr) repeat(3, minmax(4.5rem, .72fr)) var(--entity-list-chevron-column, .8rem);', '商品行必须只保留身份、三项指标和箭头。');
requireText(commodityRowStyles, '@container (max-width: 620px)', '共享商品数据行必须提供移动紧凑断点。');
requireText(commodityRowStyles, '@container (max-width: 360px)', '共享商品数据行必须覆盖极窄屏。');

for (const token of [
  'function MarketImmediateTradeEntry({',
  '<h3 id="market-immediate-trade-title" className="market-trade-section-title">即时交易</h3>',
  '<small>今日成交价</small>',
  '<small>下次调价</small>',
  'id="market-trade-quantity"',
  'aria-label="数量增加 1"',
  '>25%</Button>',
  '>50%</Button>',
  '>最大</Button>',
  '<small>交易总额</small>',
  "placeAssetOrder('commodity', assetId, orderSide, parsedQuantity, officialPrice)",
  "{orderSide === 'buy' ? `立即买入${assetName}` : `立即卖出${assetName}`}",
]) requireText(marketPage, token, `地区商品详情缺少即时成交结构: ${token}`);
for (const token of [
  'MoneyInput',
  'market-order-price',
  '价格减少 0.01',
  '价格增加 0.01',
  'orderBook.bids',
  'orderBook.asks',
  '实时五档',
  '点击填价',
  '已有订单',
  '撤单',
  'own-open-orders-table',
  'fillOrderPrice',
]) forbidText(marketPage, token, `玩家商品市场不得恢复挂单玩法: ${token}`);

for (const token of [
  '<small>今日价格</small>',
  '<small>24h 变化</small>',
  '<small>可用库存</small>',
  '<small>今日成交量</small>',
  '<small>24h 成交量</small>',
]) requireText(marketPage, token, `地区商品详情缺少市场事实: ${token}`);
requireText(detailStyles, '.market-detail-surface .market-trade-card {', '详情样式必须继续拥有直接交易区。');
requireText(detailStyles, 'background: transparent;', '直接交易区不得恢复一级卡片背景。');

requireText(marketPage, 'const marketDetailRefreshToken = [', '详情刷新必须使用稳定令牌。');
requireText(marketPage, 'selectedMarket?.officialPrice', '详情刷新必须跟随官方价格变化。');
requireText(marketPage, 'selectedMarket?.nextPriceAt', '详情刷新必须跟随下一调价时间。');
requireText(marketPage, 'marketDetailError && !selectedMarketDetail', '已有有效详情时瞬时刷新失败不得覆盖行情图。');
requireText(serverDelivery, 'const priceHistory = realTradePoints(market, now).map(publicPricePoint);', '详情接口必须只发送近 24h 真实成交点。');
requireText(serverDeliveryTest, 'bounded public real-trade history', '服务器测试必须锁定详情历史边界。');

for (const token of [
  '玩家商品交易不得创建 `open`／`partial` 商品订单',
  '北京时间每日 `00:00`',
  '客户端提交的 `price` 不是手动交易成交价',
  '不得恢复成玩家盘口玩法',
]) requireText(marketDesign, token, `商品市场设计必须锁定即时交易边界: ${token}`);

if (failures.length) {
  console.error('地区即时商品市场验证失败：');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('地区商品市场验证通过：目录只展示 24h 成交量、今日官方价与 24h 变化，详情只允许数量型即时交易，不存在价格输入、盘口、开放订单或撤单。');
