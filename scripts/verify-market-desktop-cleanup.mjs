import fs from 'node:fs';

const marketPage = fs.readFileSync('src/pages/MarketPage.tsx', 'utf8');
const marketStyles = fs.readFileSync('src/styles/market-page-polish.css', 'utf8');
const detailStyles = fs.readFileSync('src/styles/market-detail-direct-flow.css', 'utf8');
const design = fs.readFileSync('docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md', 'utf8');
const browserSpec = fs.readFileSync('tests/browser/market-desktop-cleanup.spec.ts', 'utf8');

const failures = [];
const requireText = (source, text, message) => { if (!source.includes(text)) failures.push(message); };
const forbidText = (source, text, message) => { if (source.includes(text)) failures.push(message); };

for (const token of [
  '<section className="market-trade-card market-immediate-trade-card">',
  'function MarketImmediateTradeEntry({',
  '<small>今日价格</small>',
  '<small>今日成交量</small>',
  '<small>可用库存</small>',
  '<small>冻结库存</small>',
  'id="market-trade-quantity"',
  'market-quantity-stepper',
  '立即买入',
  '立即卖出',
  '<Panel className="widget span-3 market-account-panel">',
  'className="local-trades-section"',
]) requireText(marketPage, token, `即时市场页面缺少: ${token}`);
for (const token of ['<small>今日成交价</small>', '<small>下次调价</small>']) forbidText(marketPage, token, `即时交易控件不得恢复重复行情字段: ${token}`);

for (const token of [
  'market-trade-book',
  'book-order-row',
  'orderBook.bids',
  'orderBook.asks',
  'market-order-price',
  '已有订单',
  'own-open-orders-table',
  'market-account-view-switch',
  'market-compact-view-switch',
  'order-book-columns',
  'order-book-midpoint',
  '<MarketAutoTradePanel',
]) forbidText(marketPage, token, `即时市场页面不得恢复: ${token}`);

for (const token of [
  '.market-detail-surface .market-trade-card {',
  'background: transparent;',
  '@container market-page (max-width: 720px)',
  '@container market-page (max-width: 420px)',
]) requireText(detailStyles, token, `商品详情响应式样式缺少: ${token}`);
for (const token of ['.order-book-columns', '.order-book-midpoint']) {
  forbidText(marketStyles, token, `市场基础样式不得恢复订单簿规则: ${token}`);
}

for (const token of [
  '玩家商品页面永久移除：价格输入框',
  '玩家商品交易不得创建 `open`／`partial` 商品订单',
  '普通玩家页面不得展示内部订单所有者',
  '北京时间每日 `00:00`',
]) requireText(design, token, `商品市场设计缺少即时交易边界: ${token}`);

for (const token of [
  'desktop market shows daily-price immediate trade without an order book',
  'mobile market keeps quantity-only immediate trade and recent trades readable',
  "'.market-trade-book'",
  "'.own-open-orders-table'",
  "'#market-trade-quantity'",
]) requireText(browserSpec, token, `浏览器即时市场回归缺少: ${token}`);

if (failures.length) {
  console.error('市场桌面与移动即时交易结构验证失败：');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}
console.log('市场桌面与移动结构验证通过：当日官方价、数量型即时交易与最近成交保持响应式可读，盘口、挂单、撤单和自定义价格永久退役。');
