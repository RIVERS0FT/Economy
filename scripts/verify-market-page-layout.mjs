import { spawnSync } from 'node:child_process';
import fs from 'node:fs';

const root = process.cwd();
const read = (path) => fs.readFileSync(path, 'utf8');

const regionalResult = spawnSync(process.execPath, ['scripts/verify-market-page-layout-regional.mjs'], {
  cwd: root,
  encoding: 'utf8',
});
if (regionalResult.stdout) process.stdout.write(regionalResult.stdout);
if (regionalResult.stderr) process.stderr.write(regionalResult.stderr);
if (regionalResult.status !== 0) process.exit(regionalResult.status ?? 1);

const globalMarket = read('src/pages/GlobalMarketPage.tsx');
const provincePage = read('src/pages/ProvincePage.tsx');
const marketPage = read('src/pages/MarketPage.tsx');
const commodityRow = read('src/components/market/MarketCommodityRow.tsx');
const design = read('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md');
const marketDesign = read('docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md');

const failures = [];
const requireText = (source, text, message) => { if (!source.includes(text)) failures.push(message); };
const forbidText = (source, text, message) => { if (source.includes(text)) failures.push(message); };

for (const [source, text, message] of [
  [design, '| 市场 | `market` | `GlobalMarketPage` | 连续 48 州的商品目录', '页面设计必须把一级市场定义为连续 48 州商品目录。'],
  [design, '商品目录 → 商品全局详情 → 地区商品详情', '页面设计必须保留商品优先三级钻取。'],
  [design, '市场提供商品目录、今日官方价格、真实成交行情和当日价即时交易写操作', '页面设计必须锁定全州直接经营与即时交易。'],
  [design, '市场标题区固定显示“市场”', '页面设计必须锁定一级市场标题。'],
  [globalMarket, 'function operationalProvinces(model:', '全局市场必须通过统一地区集合函数读取地区。'],
  [globalMarket, 'return model.game.provinces;', '全局市场必须覆盖连续 48 州，而不是解锁州子集。'],
  [globalMarket, 'const provinces = operationalProvinces(model);', '全局市场必须复用连续 48 州集合。'],
  [globalMarket, 'game.provinceMarkets?.[province.id]?.[product.id]', '全局市场必须按地区读取商品市场摘要。'],
  [globalMarket, 'market?.officialPrice', '全局市场价格摘要必须读取当日官方价。'],
  [globalMarket, 'market?.tradeVolume24h', '全局市场必须展示真实 24h 成交量。'],
  [globalMarket, 'market?.priceChange24h', '全局市场必须展示真实 24h 价格变化。'],
  [globalMarket, '<MarketCommodityHeader', '商品全局详情地区列表必须复用共享商品表头。'],
  [globalMarket, '<MarketCommodityRow', '商品全局详情地区列表必须复用共享商品行。'],
  [globalMarket, '<EmbeddedMarketPage model={model} embedded />', '地区商品钻取必须复用现有 MarketPage。'],
  [provincePage, '<EmbeddedMarketPage model={model} embedded readOnly={false} />', '州级市场必须直接复用可交易 MarketPage。'],
  [marketPage, 'function MarketImmediateTradeEntry({', '地区 MarketPage 必须使用即时交易入口。'],
  [marketPage, '<small>今日成交价</small>', '地区 MarketPage 必须显示今日成交价。'],
  [marketPage, 'id="market-trade-quantity"', '地区 MarketPage 必须保留数量输入。'],
  [marketPage, '最近成交', '地区 MarketPage 必须保留真实最近成交。'],
  [commodityRow, "{ label: '今日价格', sortKey: 'price' }", '共享商品表头必须使用今日价格。'],
  [commodityRow, "{ label: '24h成交量', sortKey: 'volume24h' }", '共享商品表头必须使用 24h 成交量。'],
  [commodityRow, "{ label: '24h价格变化', sortKey: 'trend' }", '共享商品表头必须使用 24h 价格变化。'],
  [marketDesign, '玩家商品交易不得创建 `open`／`partial` 商品订单', '商品市场设计必须禁止玩家开放商品订单。'],
  [marketDesign, '一个自然日内同一州×商品的 `officialPrice` 固定不变', '商品市场设计必须锁定日内官方价。'],
]) requireText(source, text, message);

for (const [source, text, message] of [
  [globalMarket, 'unlocked.has(province.id)', '全局市场不得按旧地区解锁状态裁剪地区。'],
  [globalMarket, 'allProvinceOrders', '全局市场不得重新聚合玩家商品开放订单。'],
  [globalMarket, 'ownOpenOrderCount', '全局市场不得恢复本人开放订单指标。'],
  [globalMarket, 'sellVolume', '全局市场不得恢复卖盘量字段。'],
  [globalMarket, 'buyVolume', '全局市场不得恢复买盘量字段。'],
  [commodityRow, 'sellVolume', '共享商品行不得保留卖盘量兼容接口。'],
  [commodityRow, 'buyVolume', '共享商品行不得保留买盘量兼容接口。'],
  [marketPage, 'orderBook.bids', '地区商品页不得恢复公开买盘。'],
  [marketPage, 'orderBook.asks', '地区商品页不得恢复公开卖盘。'],
  [marketPage, 'market-order-price', '地区商品页不得恢复自定义价格输入。'],
  [marketPage, '已有订单', '地区商品页不得恢复玩家挂单列表。'],
]) forbidText(source, text, message);

if (failures.length) {
  console.error('市场三级钻取与即时交易验证失败：');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('市场三级钻取验证通过：连续 48 州共享今日官方价与真实成交摘要，地区详情只提供数量型即时交易，不恢复玩家盘口、挂单或自定义价格。');
