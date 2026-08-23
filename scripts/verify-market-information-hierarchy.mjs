import fs from 'node:fs';

// This verifier locks the final commodity-first market information hierarchy.
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
const marketCss = read('src/styles/market-page-polish.css');
const pageDesign = read('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md');
const chartDesign = read('docs/MARKET_CHART_LAYOUT_DESIGN.md');

for (const token of [
  'global-market-summary-strip',
  'global-market-filter-row',
  'global-market-goods-row',
  '真实成交价范围',
  '最低价地区',
  '最高价地区',
  'MarketCoverageBar',
  'global-market-province-row',
]) requireText(globalMarket, token, 'global market hierarchy');

forbidText(globalMarket, 'MetricCard', 'global market hierarchy');
forbidText(globalMarket, 'global-current-scope-summary', 'global market hierarchy');
forbidText(globalMarket, 'global-province-grid', 'global market hierarchy');

for (const token of [
  'MarketBalanceBar',
  'market-detail-hero__market-price',
  'market-fundamentals-balance',
  '卖单量',
  '买单量',
  '挂单差额',
]) requireText(regionalMarket, token, 'regional market hierarchy');

const chartIndex = regionalMarket.indexOf('<Panel className="widget market-chart-card">');
const tradeIndex = regionalMarket.indexOf('<Panel className="widget market-trade-card">');
if (chartIndex < 0 || tradeIndex < 0 || chartIndex >= tradeIndex) {
  throw new Error('regional market hierarchy: price chart must precede manual trading');
}

for (const token of [
  '.global-market-summary-strip',
  '.global-market-goods-row',
  '.global-market-province-row',
]) requireText(globalCss, token, 'global market css');

for (const token of [
  '.market-balance-bar',
  '.market-coverage-bar',
  '.market-fundamentals-balance',
]) requireText(marketCss, token, 'regional market css');

for (const token of [
  '一级路由 `market` 使用 `GlobalMarketPage`',
  '全局页不得把各州买卖单合并成一个全国订单簿',
  '卖单量与买单量只来自公开订单簿',
]) requireText(pageDesign, token, 'market page authority');

for (const token of [
  '跨州覆盖条只能使用',
  'Balance Bar',
  '商品详情必须先给出市场基本面',
  '不得为了把操作按钮抬高而重新把交易卡放到行情图之前',
]) requireText(chartDesign, token, 'market visualization authority');

console.log('Market information hierarchy verification passed.');
