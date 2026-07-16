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
} from '../src/utils/marketHistory.ts';

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), 'utf8');

const now = Date.UTC(2026, 6, 16, 14, 3, 0);
const windowEnd = Math.floor(now / MARKET_BUCKET_MS) * MARKET_BUCKET_MS + MARKET_BUCKET_MS;
const windowStart = windowEnd - MARKET_WINDOW_MS;
const buckets = buildMarketHistoryBuckets([
  { price: 8, quantity: 9, createdAt: windowStart - 1_000 },
  { price: 10, quantity: 2, createdAt: windowStart + 60_000 },
  { price: 12, quantity: 3, createdAt: windowStart + 5 * 60_000 },
  { price: 15, quantity: 4, createdAt: windowStart + MARKET_BUCKET_MS + 60_000 },
], 6, now);

assert.equal(MARKET_BUCKET_COUNT, 240, '24h / 6m 必须等于 240 个分段');
assert.equal(MARKET_AXIS_SEGMENTS, 24, '横轴必须保持 24 个小时分段');
assert.equal(buckets.length, 240, '行情聚合必须输出固定 240 个分段');
assert.deepEqual(
  { price: buckets[0].price, volume: buckets[0].volume },
  { price: 12, volume: 5 },
  '同一 6 分钟分段必须使用最后成交价并汇总成交量',
);
assert.deepEqual(
  { price: buckets[1].price, volume: buckets[1].volume },
  { price: 15, volume: 4 },
  '下一分段必须独立记录价格和成交量',
);
assert.deepEqual(
  { price: buckets[2].price, volume: buckets[2].volume },
  { price: 15, volume: 0 },
  '无成交分段必须延续最近有效价格且成交量为零',
);
assert.equal(buckets[0].startAt, windowStart, '首个分段必须从 24h 窗口起点开始');
assert.equal(buckets.at(-1).startAt + MARKET_BUCKET_MS, windowEnd, '最后分段必须覆盖当前 6 分钟区间');

const ticks = buildMarketAxisTicks(buckets, 'en-GB');
assert.equal(ticks.length, 25, '24 个横轴分段必须包含 25 条边界刻度');
assert.equal(ticks.at(-1).timestamp - ticks[0].timestamp, MARKET_WINDOW_MS, '横轴必须完整覆盖 24h');
assert.match(ticks[0].label, /^\d{2}:\d{2}$/, '时间刻度必须使用 HH:mm');

const chart = read('src/components/charts/PriceSparkline.tsx');
const marketPage = read('src/pages/MarketPage.tsx');
const design = read('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md');

for (const text of [
  '近 24 小时价格与成交量趋势图',
  '成交量柱状图位于下方',
  '时间（系统时区）',
  'buildMarketAxisTicks',
  'fill="var(--color-warning)"',
]) assert.ok(chart.includes(text), `PriceSparkline 缺少: ${text}`);

for (const text of [
  'buildMarketHistoryBuckets',
  '<PriceSparkline buckets={marketBuckets} />',
  '24h · 6m × 240',
  '近 24h 成交趋势',
]) assert.ok(marketPage.includes(text), `MarketPage 缺少: ${text}`);

for (const text of [
  '按 6 分钟聚合为 240 个数据分段',
  '横轴固定划分为 24 个 1h 分段',
  '浏览器系统时区的 `HH:mm`',
  '没有成交量柱状图或没有坐标轴',
]) assert.ok(design.includes(text), `设计文档缺少: ${text}`);

console.log('Market chart verification passed.');
