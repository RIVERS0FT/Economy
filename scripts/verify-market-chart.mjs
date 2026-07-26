import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  buildMarketAxisTicks,
  buildMarketHistoryBuckets,
  countMarketHistoryPointsInWindow,
  MARKET_AXIS_SEGMENTS,
  MARKET_BUCKET_COUNT,
  MARKET_BUCKET_MS,
  MARKET_WINDOW_MS,
  summarizeMarketFlow,
} from '../src/utils/marketHistory.ts';

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
assert.equal(MARKET_AXIS_SEGMENTS, 12, '横轴必须保持 12 个分段');
assert.equal(buckets.length, 240, '行情聚合必须输出固定 240 个分段');
assert.equal(countMarketHistoryPointsInWindow(points, now), 4, '成交笔数必须只统计与图表相同的最近 24h 窗口');
assert.deepEqual(
  { price: buckets[0].price, volume: buckets[0].volume, buyVolume: buckets[0].buyVolume, sellVolume: buckets[0].sellVolume, neutralVolume: buckets[0].neutralVolume, netVolume: buckets[0].netVolume, direction: buckets[0].direction },
  { price: 13, volume: 9, buyVolume: 2, sellVolume: 3, neutralVolume: 4, netVolume: -1, direction: 'sell' },
  '同一 6 分钟分段必须使用最后成交价、汇总总量并按吃单方计算净主动方向',
);
assert.deepEqual(
  { price: buckets[1].price, volume: buckets[1].volume, netVolume: buckets[1].netVolume, direction: buckets[1].direction },
  { price: 15, volume: 4, netVolume: 4, direction: 'buy' },
  '下一分段必须独立记录价格、成交量和净主动方向',
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
  '24h 汇总必须保留总量、主动买卖量、中性量和净主动量',
);
assert.equal(buckets[0].startAt, windowStart, '首个分段必须从 24h 窗口起点开始');
assert.equal(buckets.at(-1).startAt + MARKET_BUCKET_MS, windowEnd, '最后分段必须覆盖当前 6 分钟区间');
const ticks = buildMarketAxisTicks(buckets, 'en-GB');
assert.equal(ticks.length, 13, '12 个横轴分段必须包含 13 条边界刻度');
assert.equal(ticks.at(-1).timestamp - ticks[0].timestamp, MARKET_WINDOW_MS, '横轴必须完整覆盖 24h');
assert.equal(ticks[1].timestamp - ticks[0].timestamp, 2 * 60 * 60 * 1000, '每个横轴分段必须覆盖 2h');
assert.match(ticks[0].label, /^\d{2}:\d{2}$/, '时间刻度必须使用 HH:mm');

const chart = read('src/components/charts/PriceSparkline.tsx');
const marketPage = read('src/pages/MarketPage.tsx');
const marketCss = read('src/styles/market-page-polish.css');
const safeZoneSpec = read('tests/browser/market-chart-safe-zone.spec.ts');
const types = read('src/types.ts');
const matchingCore = read('server/src/order-matching.js');
const commodityMarket = read('server/src/balanced-market.js');
const facilityMarket = read('server/src/facility-groups.js');
const design = read('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md');
const orderBookDesign = read('docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md');

for (const text of [
  '近 24 小时价格、成交量与主动买卖方向趋势图',
  "if (bucket.direction === 'buy') return 'var(--color-success)'",
  "if (bucket.direction === 'sell') return 'var(--color-danger)'",
  "return 'var(--color-text-muted)'",
  'data-direction={bucket.direction}',
  '净主动买入', '净主动卖出', '灰色表示未归类成交量', 'buildMarketAxisTicks',
  'niceIntegerStep', 'buildIntegerPriceScale', 'buildIntegerVolumeScale',
  'formatIntegerPriceTick', 'formatCompactVolumeTick', 'useChartAxisMetrics',
  'context.measureText(label).width', 'preferredVolumeHeight', 'minimumVolumeHeight',
  'minimumVolumeShare', 'ratioProtectedVolumeHeight', 'requiredHeight',
  'const chartHeight = Math.max(baseHeight, requiredHeight)',
  'aspectRatio: `${width} / ${chartHeight}`', 'timeLabelBottomOffset', 'bottomSafeInset',
  'timeLegendGap', 'legendTitleGap', 'legendStartX', 'className="chart-legend"',
  'className="chart-axis-title chart-x-axis-title"', 'data-axis-left={left.toFixed(2)}',
  'data-volume-top={volumeTop.toFixed(2)}', 'data-volume-bottom={volumeBottom.toFixed(2)}',
  'data-volume-share={volumeShare.toFixed(4)}', 'data-chart-height={chartHeight.toFixed(2)}',
  'data-plot-center-x={plotCenterX.toFixed(2)}', 'fontSize={axisFontSize}',
  '        时间\n      </text>',
]) assert.ok(chart.includes(text), `PriceSparkline 缺少: ${text}`);
for (const text of [
  'CompactPriceSparkline', 'values: number[]', '均衡／方向未知', 'useChartFooterAxisFontSize',
  "maximumFractionDigits: value < 10 ? 2 : 1", 'xLabelY: 408', 'legendY: 452',
  'xAxisTitleY: 526', "minimumVolumeHeight = axisFontSize * (variant === 'compact' ? 1.15 : 1.35)",
]) assert.ok(!chart.includes(text), `PriceSparkline 不应保留: ${text}`);

for (const text of ['buildMarketHistoryBuckets(marketHistory, marketFallbackPrice, now)', '<PriceSparkline buckets={marketBuckets} variant="full" />']) {
  assert.ok(marketPage.includes(text), `MarketPage 缺少: ${text}`);
}
for (const text of ['countMarketHistoryPointsInWindow', 'summarizeMarketFlow', 'className="chart-footer"', '最近成交估值', '我的当前订单', '主动买卖均衡／方向未知']) {
  assert.ok(!marketPage.includes(text), `MarketPage 不应保留行情底部说明: ${text}`);
}
assert.ok(!marketCss.includes('.chart-footer'), '市场样式不得恢复已删除的行情底部统计栏');
assert.ok(marketCss.includes('font-variant-numeric: tabular-nums;'), '行情坐标数字必须使用稳定数字宽度');

for (const text of [
  'market chart preserves readable volume height and separate bottom safe zones',
  "{ width: 1684, height: 931, label: '桌面端' }", "{ width: 390, height: 844, label: '移动端' }",
  "{ width: 320, height: 700, label: '极窄移动端' }", "document.documentElement.style.fontSize = '20px'",
  'timeVolumeGap', 'timeLegendGap', 'legendTitleGap', 'bottomGap', 'legendCenterDelta',
  'volumeHeight', 'volumeShare', '成交量图区实际高度不得低于 48px',
  '成交量图区不得低于数据绘图区的 22%', '成交量纵轴刻度不得互相覆盖', '成交量柱不得越出成交量图区',
]) assert.ok(safeZoneSpec.includes(text), `行情图浏览器几何回归缺少: ${text}`);

assert.ok(types.includes('takerSide?: OrderSide;'), 'PricePoint 必须保存可选吃单方向');
assert.ok(matchingCore.includes('takerSide: incoming.side'), '共享撮合内核必须把吃单方方向传给行情适配器');
assert.ok(commodityMarket.includes('recordPrice(world, incoming.productId, price, quantity, takerSide, createdAt, signalWeight, marketRole);'), '商品成交必须记录吃单方方向、需求信号权重和成交角色');
assert.ok(commodityMarket.includes('LIQUIDITY_SIGNAL_WEIGHT'), '储备成交必须降低价格传导信号权重');
assert.ok(facilityMarket.includes('recordFacilityPrice(world, typeId, price, quantity, takerSide, createdAt);'), '工厂成交必须记录吃单方方向');

for (const text of [
  '市场页的商品行情统一统计当前资产最近 24h', '概览页不再承载市场行情图', '柱高始终表示总成交量',
  '净主动买入使用成功色', '旧历史方向未知使用中性色', '不得恢复“最近 24 笔成交”',
  '价格轴刻度只能是整数', '图例只显示净主动买入和净主动卖出', '不得显示行情图下方统计栏',
  '最宽纵轴刻度标签', '不受设置页“紧凑数字”开关影响',
  '旋转时间刻度、方向图例和“时间”轴标题分别保留独立安全区',
  '成交量绘图区必须保持最低可读屏幕高度', '不得低于数据绘图区的 `22%`', '必须增加自身高度',
]) assert.ok(design.includes(text), `页面设计文档缺少: ${text}`);
for (const text of ['保存吃单方（taker／incoming order）的买卖方向', '净主动量为主动买入量减主动卖出量', '禁止伪造迁移方向']) {
  assert.ok(orderBookDesign.includes(text), `订单簿设计文档缺少: ${text}`);
}

console.log('Market chart verification passed: integer axes, readable volume height, dynamic chart aspect, separate bottom safe zones and centered two-item legend satisfy the design baseline.');
