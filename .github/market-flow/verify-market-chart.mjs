import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  buildMarketAxisTicks,
  buildMarketHistoryBuckets,
  MARKET_AXIS_SEGMENTS,
  MARKET_BUCKET_COUNT,
  MARKET_BUCKET_MS,
  MARKET_WINDOW_MS,
  summarizeMarketFlow,
} from '../src/utils/marketHistory.ts';

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), 'utf8');

const now = Date.UTC(2026, 6, 17, 8, 3, 0);
const windowEnd = Math.floor(now / MARKET_BUCKET_MS) * MARKET_BUCKET_MS + MARKET_BUCKET_MS;
const windowStart = windowEnd - MARKET_WINDOW_MS;
const buckets = buildMarketHistoryBuckets([
  { price: 8, quantity: 9, createdAt: windowStart - 1_000 },
  { price: 10, quantity: 2, takerSide: 'buy', createdAt: windowStart + 60_000 },
  { price: 12, quantity: 3, takerSide: 'sell', createdAt: windowStart + 3 * 60_000 },
  { price: 13, quantity: 4, createdAt: windowStart + 5 * 60_000 },
  { price: 15, quantity: 4, takerSide: 'buy', createdAt: windowStart + MARKET_BUCKET_MS + 60_000 },
], 6, now);

assert.equal(MARKET_BUCKET_COUNT, 240, '24h / 6m 必须等于 240 个分段');
assert.equal(MARKET_AXIS_SEGMENTS, 12, '横轴必须保持 12 个分段');
assert.equal(buckets.length, 240, '行情聚合必须输出固定 240 个分段');
assert.deepEqual(
  {
    price: buckets[0].price,
    volume: buckets[0].volume,
    buyVolume: buckets[0].buyVolume,
    sellVolume: buckets[0].sellVolume,
    neutralVolume: buckets[0].neutralVolume,
    netVolume: buckets[0].netVolume,
    direction: buckets[0].direction,
  },
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
const overviewPage = read('src/pages/OverviewPage.tsx');
const marketPage = read('src/pages/MarketPage.tsx');
const types = read('src/types.ts');
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
  '净主动买入',
  '净主动卖出',
  '均衡／方向未知',
  'buildMarketAxisTicks',
  'useChartFooterAxisFontSize',
  'fontSize={axisFontSize}',
  '        时间\n      </text>',
]) assert.ok(chart.includes(text), `PriceSparkline 缺少: ${text}`);
for (const text of ['CompactPriceSparkline', 'values: number[]']) {
  assert.ok(!chart.includes(text), `PriceSparkline 不应保留独立概览价格路径: ${text}`);
}

for (const text of [
  'buildMarketHistoryBuckets',
  'summarizeMarketFlow',
  '<PriceSparkline buckets={overviewMarket.buckets} variant="compact" />',
  '24h 净主动买入',
]) assert.ok(overviewPage.includes(text), `OverviewPage 缺少: ${text}`);
for (const text of ['slice(-24)', '<PriceSparkline values=']) {
  assert.ok(!overviewPage.includes(text), `OverviewPage 不应保留: ${text}`);
}

for (const text of [
  'buildMarketHistoryBuckets(marketHistory, marketFallbackPrice, now)',
  '<PriceSparkline buckets={marketBuckets} variant="full" />',
  '净主动买入',
  '24h · 6m × 240',
]) assert.ok(marketPage.includes(text), `MarketPage 缺少: ${text}`);

assert.ok(types.includes('takerSide?: OrderSide;'), 'PricePoint 必须保存可选吃单方向');
assert.ok(commodityMarket.includes('recordPrice(world, incoming.productId, price, quantity, incoming.side, createdAt);'), '商品成交必须记录吃单方方向');
assert.ok(facilityMarket.includes('recordFacilityPrice(world, typeId, price, quantity, incoming.side, createdAt);'), '工厂成交必须记录吃单方方向');

for (const text of [
  '概览页与市场页的商品行情统一统计当前资产最近 24h',
  '柱高始终表示总成交量',
  '净主动买入使用成功色',
  '旧历史方向未知使用中性色',
  '不得恢复“最近 24 笔成交”',
]) assert.ok(design.includes(text), `页面设计文档缺少: ${text}`);
for (const text of [
  '保存吃单方（taker／incoming order）的买卖方向',
  '净主动量为主动买入量减主动卖出量',
  '禁止伪造迁移方向',
]) assert.ok(orderBookDesign.includes(text), `订单簿设计文档缺少: ${text}`);

console.log('Market chart verification passed: overview and market share 24h buckets with net active flow colors.');
