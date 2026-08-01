import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  buildMarketHistoryBuckets,
  countMarketHistoryPointsInWindow,
  MARKET_BUCKET_COUNT,
  MARKET_BUCKET_MS,
  MARKET_WINDOW_MS,
  summarizeMarketFlow,
} from '../src/utils/marketHistory.ts';
import {
  chooseMarketPriceTickCount,
  chooseMarketTimeInterval,
  chooseMarketVolumeTickCount,
  resolveMarketBucketIndex,
} from '../src/components/charts/marketChartScale.ts';

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), 'utf8').replace(/\r\n?/g, '\n');
const now = Date.UTC(2026, 6, 17, 8, 3, 0);
const windowEnd = Math.floor(now / MARKET_BUCKET_MS) * MARKET_BUCKET_MS + MARKET_BUCKET_MS;
const windowStart = windowEnd - MARKET_WINDOW_MS;
const points = [
  { price: 8, quantity: 9, createdAt: windowStart - 1_000 },
  { price: 10, quantity: 2, takerSide: 'buy', createdAt: windowStart + 60_000 },
  { price: 12, quantity: 3, takerSide: 'sell', createdAt: windowStart + 3 * 60_000 },
  { price: 13, quantity: 4, createdAt: windowStart + 5 * 60_000 },
  { price: 15, quantity: 4, takerSide: 'buy', createdAt: windowStart + MARKET_BUCKET_MS + 60_000 },
];
const buckets = buildMarketHistoryBuckets(points, 6, now);

assert.equal(MARKET_BUCKET_COUNT, 240, '24h / 6m 必须等于 240 个分段');
assert.equal(buckets.length, 240, '行情聚合必须输出固定 240 个分段');
assert.equal(countMarketHistoryPointsInWindow(points, now), 4, '成交笔数必须只统计与图表相同的最近 24h 窗口');
assert.deepEqual(
  { price: buckets[0].price, volume: buckets[0].volume, buyVolume: buckets[0].buyVolume, sellVolume: buckets[0].sellVolume, neutralVolume: buckets[0].neutralVolume, netVolume: buckets[0].netVolume, direction: buckets[0].direction },
  { price: 13, volume: 9, buyVolume: 2, sellVolume: 3, neutralVolume: 4, netVolume: -1, direction: 'sell' },
  '同一分段必须使用最后成交价并按吃单方向汇总',
);
assert.deepEqual(
  { price: buckets[2].price, volume: buckets[2].volume, netVolume: buckets[2].netVolume, direction: buckets[2].direction },
  { price: 15, volume: 0, netVolume: 0, direction: 'neutral' },
  '无成交分段必须延续最近有效价格且成交量为零',
);
const summary = summarizeMarketFlow(buckets);
assert.deepEqual(
  { volume: summary.volume, buyVolume: summary.buyVolume, sellVolume: summary.sellVolume, neutralVolume: summary.neutralVolume, netVolume: summary.netVolume },
  { volume: 13, buyVolume: 6, sellVolume: 3, neutralVolume: 4, netVolume: 3 },
  '24h 汇总必须保留完整方向数据',
);
assert.equal(buckets[0].startAt, windowStart, '首个分段必须从 24h 窗口起点开始');
assert.equal(buckets.at(-1).startAt + MARKET_BUCKET_MS, windowEnd, '最后分段必须覆盖当前区间');

assert.equal(chooseMarketTimeInterval(900, 16, 'full', MARKET_WINDOW_MS), 2 * 60 * 60 * 1000, '宽屏应显示两小时间隔');
assert.equal(chooseMarketTimeInterval(260, 16, 'full', MARKET_WINDOW_MS), 6 * 60 * 60 * 1000, '窄屏应降低为六小时间隔');
assert.equal(chooseMarketTimeInterval(260, 20, 'full', MARKET_WINDOW_MS), 8 * 60 * 60 * 1000, '放大字号应进一步降低时间刻度密度');
assert.ok(chooseMarketPriceTickCount(240, 16) > chooseMarketPriceTickCount(112, 16), '价格刻度数必须随真实高度增加');
assert.ok(chooseMarketVolumeTickCount(140, 16) > chooseMarketVolumeTickCount(48, 16), '成交量刻度数必须随真实高度增加');
assert.equal(resolveMarketBucketIndex(windowStart - 1, windowStart, 240, MARKET_BUCKET_MS), 0, '悬浮索引必须限制在首个分段');
assert.equal(resolveMarketBucketIndex(windowStart + MARKET_BUCKET_MS * 40 + 1, windowStart, 240, MARKET_BUCKET_MS), 40, '悬浮索引必须由统一轴值映射');
assert.equal(resolveMarketBucketIndex(windowEnd + 1, windowStart, 240, MARKET_BUCKET_MS), 239, '悬浮索引必须限制在最后分段');

const chart = read('src/components/charts/PriceSparkline.tsx');
const scale = read('src/components/charts/marketChartScale.ts');
const wrapper = read('src/components/charts/EconomyChart.tsx');
const registry = read('src/components/charts/echartsCore.ts');
const marketPage = read('src/pages/MarketPage.tsx');
const marketCss = read('src/styles/market-page-polish.css');
const chartCss = read('src/styles/charts.css');
const safeZoneSpec = read('tests/browser/market-chart-safe-zone.spec.ts');
const runtimeSpec = read('tests/browser/market-runtime.spec.ts');
const types = read('src/types.ts');
const matchingCore = read('server/src/order-matching.js');
const commodityMarket = read('server/src/balanced-market.js');
const facilityMarket = read('server/src/facility-groups.js');
const design = read('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md');
const chartDesign = read('docs/MARKET_CHART_LAYOUT_DESIGN.md');
const designIndex = read('docs/README.md');
const orderBookDesign = read('docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md');

for (const text of [
  "import { EconomyChart } from './EconomyChart'",
  "name: '价格', type: 'line'",
  "name: '成交量', type: 'bar'",
  'grid: [', 'xAxisIndex: 0', 'xAxisIndex: 1',
  'axisPointer: { link: [{ xAxisIndex: [0, 1] }] }',
  'triggerEmphasis: false', 'emphasis: { disabled: true }',
  'resolveMarketBucketIndex(axisValue, windowStart, safeBuckets.length, MARKET_BUCKET_MS)',
  'const priceVolumeGap = 0', 'const volumeTop = priceBottom + priceVolumeGap',
  'export function buildMarketChartGeometry',
  'Math.max(48, rootFontSize', '(0.22 / 0.78) * priceHeight',
  'buildIntegerPriceScale', 'buildIntegerVolumeScale',
  'formatIntegerPriceTick', 'formatCompactVolumeTick',
  'data-volume-share={geometry.volumeShare.toFixed(4)}',
  'data-time-axis-interval={axisInterval}',
  'data-price-tick-count={priceTickCount}', 'data-volume-tick-count={volumeTickCount}',
  'data-axis-pointer-linked="true"', 'data-hover-emphasis-disabled="true"',
  'className="market-chart-price-volume-divider"',
  'className="market-chart-footer"',
  '净主动买入', '净主动卖出',
  '主动买入', '主动卖出', '方向未知', '净主动量',
]) assert.ok(chart.includes(text), `ECharts 行情图缺少: ${text}`);
for (const text of [
  'chooseMarketTimeInterval', 'chooseMarketPriceTickCount', 'chooseMarketVolumeTickCount',
  'resolveMarketBucketIndex', 'MARKET_TIME_INTERVAL_HOURS',
]) assert.ok(scale.includes(text), `行情动态刻度纯函数缺少: ${text}`);
for (const text of ['<svg', '<polyline', '<polygon', '<rect', 'context.measureText', 'useChartAxisMetrics']) {
  assert.ok(!chart.includes(text), `ECharts 行情图不得保留手写 SVG: ${text}`);
}

for (const text of [
  'initECharts', "renderer: 'svg'", 'new ResizeObserver', 'requestAnimationFrame',
  'chartRef.current?.setOption', 'chart.dispose()', 'data-echarts-ready',
]) assert.ok(wrapper.includes(text), `共享 EconomyChart 缺少生命周期规则: ${text}`);
for (const text of ['LineChart', 'BarChart', 'PieChart', 'AxisPointerComponent', 'GridComponent', 'TooltipComponent', 'AriaComponent', 'SVGRenderer']) {
  assert.ok(registry.includes(text), `ECharts 模块注册缺少: ${text}`);
}

for (const text of ['buildMarketHistoryBuckets(marketHistory, marketFallbackPrice, now)', '<PriceSparkline buckets={marketBuckets} variant="full" />']) {
  assert.ok(marketPage.includes(text), `MarketPage 缺少: ${text}`);
}
for (const text of ['countMarketHistoryPointsInWindow', 'summarizeMarketFlow', 'className="chart-footer"', '最近成交估值', '主动买卖均衡／方向未知']) {
  assert.ok(!marketPage.includes(text), `MarketPage 不应恢复行情底部说明: ${text}`);
}
assert.ok(!marketCss.includes('aspect-ratio: 16 / 9'), '业务 CSS 不得固定覆盖动态行情比例');
assert.ok(chartCss.includes('.market-chart-footer'), '共享图表样式必须提供市场底部安全区');
assert.ok(chartCss.includes('.market-chart-price-volume-divider'), '共享图表样式必须提供零间距分界线');
assert.ok(chartCss.includes('font-variant-numeric: tabular-nums'), '行情坐标必须使用稳定数字宽度');

for (const text of [
  'market chart preserves readable volume height, zero-gap grids and dynamic ticks',
  "{ width: 1684, height: 931, label: '桌面端' }", "{ width: 390, height: 844, label: '移动端' }",
  "{ width: 320, height: 700, label: '极窄移动端' }", "document.documentElement.style.fontSize = '20px'",
  'priceVolumeGap', 'dividerBoundaryDelta', 'timeAxisInterval', 'priceTickCount', 'volumeTickCount',
  '价格与成交量 Grid 必须零间距连续排列',
  '成交量图区实际高度不得低于 48px', '成交量图区不得低于数据绘图区的 22%',
]) assert.ok(safeZoneSpec.includes(text), `行情图浏览器几何回归缺少: ${text}`);
for (const text of [
  'market chart uses one linked hover state and keeps the price line protected',
  "data-axis-pointer-linked", "data-hover-emphasis-disabled", 'priceHoverText',
  'priceTicks', 'volumeTicks', 'ECharts SVG is not ready', 'market-chart-footer',
]) assert.ok(runtimeSpec.includes(text), `市场运行时回归缺少: ${text}`);

assert.ok(types.includes('takerSide?: OrderSide;'), 'PricePoint 必须保存可选吃单方向');
assert.ok(matchingCore.includes('takerSide: incoming.side'), '撮合内核必须记录吃单方向');
assert.ok(commodityMarket.includes('recordPrice(world, incoming.productId, price, quantity, takerSide, createdAt, signalWeight, marketRole);'), '商品成交必须记录方向与信号');
assert.ok(commodityMarket.includes('LIQUIDITY_SIGNAL_WEIGHT'), '储备成交必须降低传导信号权重');
assert.ok(facilityMarket.includes('recordFacilityPrice(world, typeId, price, quantity, takerSide, createdAt);'), '工厂成交必须记录吃单方向');

for (const text of [
  '市场页的商品行情统一统计当前资产最近 24h', '柱高始终表示总成交量',
  '净主动买入使用成功色', '旧历史方向未知使用中性色',
  '价格轴刻度只能是整数', '图例只显示净主动买入和净主动卖出',
  '不得显示行情图下方统计栏', '旋转时间刻度、方向图例和“时间”轴标题分别保留独立安全区',
  'ECharts',
]) assert.ok(design.includes(text), `页面设计文档缺少: ${text}`);
for (const text of [
  '市场行情图几何、交互与可读性唯一专项基线', 'ECharts SVG', '零间距连续双 Grid',
  '统一悬浮交互', '`axisPointer.link`', '`axisValue`',
  '动态时间间隔', '真实像素高度和根字号动态计算',
  '成交量绘图区必须保持最低可读屏幕高度', '不得低于 `48px`',
  '价格区与成交量区合计数据绘图区的 `22%`',
  '不得由业务 CSS 再用固定比例覆盖组件计算结果',
  '稳定 `data-*`', '390 × 844` 且根字号放大到 `125%',
]) assert.ok(chartDesign.includes(text), `市场行情图专项设计缺少: ${text}`);
for (const text of ['动态横纵轴刻度', '零间距双 Grid', '统一 AxisPointer／Tooltip', '悬浮折线保护']) {
  assert.ok(designIndex.includes(text), `设计索引缺少市场图规则: ${text}`);
}
for (const text of ['保存吃单方（taker／incoming order）的买卖方向', '净主动量为主动买入量减主动卖出量', '禁止伪造迁移方向']) {
  assert.ok(orderBookDesign.includes(text), `订单簿设计文档缺少: ${text}`);
}

console.log('Market ECharts verification passed: linked hover, protected line, zero-gap grids, dynamic integer ticks and readable volume geometry satisfy the design baseline.');
