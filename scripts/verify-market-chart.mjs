import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  buildMarketHistoryBuckets,
  countMarketHistoryPointsInWindow,
  getMarketWindowBounds,
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
const { windowStart, windowEnd } = getMarketWindowBounds(now);
const points = [
  { price: 8, quantity: 9, createdAt: windowStart - 1_000 },
  { price: 10, quantity: 2, takerSide: 'buy', createdAt: windowStart + 60 * 60 * 1000 },
  { price: 12, quantity: 3, takerSide: 'sell', createdAt: windowStart + 3 * 60 * 60 * 1000 },
  { price: 15, quantity: 4, takerSide: 'buy', createdAt: windowStart + MARKET_BUCKET_MS + 60 * 60 * 1000 },
];
const buckets = buildMarketHistoryBuckets(points, 6, now);

assert.equal(MARKET_BUCKET_COUNT, 30, '成交趋势必须固定保留最近 30 个自然日');
assert.equal(MARKET_BUCKET_MS, 24 * 60 * 60 * 1000, '成交趋势必须按日聚合');
assert.equal(buckets.length, 30, '行情聚合必须输出固定 30 个日桶');
assert.equal(countMarketHistoryPointsInWindow(points, now), 3, '成交笔数只统计最近 30 个自然日窗口');
assert.deepEqual({ price: buckets[0].price, volume: buckets[0].volume, buyVolume: buckets[0].buyVolume, sellVolume: buckets[0].sellVolume, netVolume: buckets[0].netVolume, direction: buckets[0].direction }, { price: 12, volume: 5, buyVolume: 2, sellVolume: 3, netVolume: -1, direction: 'sell' }, '同一自然日必须使用最后成交价并按吃单方向汇总');
assert.deepEqual({ price: buckets[2].price, volume: buckets[2].volume, netVolume: buckets[2].netVolume, direction: buckets[2].direction }, { price: 15, volume: 0, netVolume: 0, direction: 'neutral' }, '无成交自然日必须延续最近有效价格且成交量为零');
const summary = summarizeMarketFlow(buckets);
assert.deepEqual({ volume: summary.volume, buyVolume: summary.buyVolume, sellVolume: summary.sellVolume, netVolume: summary.netVolume }, { volume: 9, buyVolume: 6, sellVolume: 3, netVolume: 3 }, '30 天汇总必须保留完整主动方向数据');
assert.equal(buckets[0].startAt, windowStart, '首个日桶必须从 30 天窗口起点开始');
assert.equal(buckets.at(-1).startAt + MARKET_BUCKET_MS, windowEnd, '最后日桶必须覆盖当前北京时间自然日');

assert.equal(chooseMarketTimeInterval(900, 16, 'full', MARKET_WINDOW_MS), 2 * MARKET_BUCKET_MS, '宽屏应显示两天间隔');
assert.equal(chooseMarketTimeInterval(260, 16, 'full', MARKET_WINDOW_MS), 10 * MARKET_BUCKET_MS, '窄屏应降低日期刻度密度');
assert.equal(chooseMarketTimeInterval(260, 20, 'full', MARKET_WINDOW_MS), 10 * MARKET_BUCKET_MS, '放大字号应保持稀疏日期刻度');
assert.ok(chooseMarketPriceTickCount(240, 16) > chooseMarketPriceTickCount(112, 16), '价格刻度数必须随真实高度增加');
assert.equal(chooseMarketVolumeTickCount(48, 16, 'full'), 3, '完整行情图必须至少生成三个成交量刻度');
assert.equal(chooseMarketVolumeTickCount(48, 16, 'compact'), 2, '紧凑行情图允许保留两个成交量刻度');
assert.ok(chooseMarketVolumeTickCount(140, 16, 'full') > chooseMarketVolumeTickCount(48, 16, 'full'), '成交量刻度数必须随真实高度增加');
assert.equal(resolveMarketBucketIndex(windowStart - 1, windowStart, 30, MARKET_BUCKET_MS), 0, '悬浮索引必须限制在首个日桶');
assert.equal(resolveMarketBucketIndex(windowStart + MARKET_BUCKET_MS * 12 + 1, windowStart, 30, MARKET_BUCKET_MS), 12, '悬浮索引必须由统一轴值映射');
assert.equal(resolveMarketBucketIndex(windowEnd + 1, windowStart, 30, MARKET_BUCKET_MS), 29, '悬浮索引必须限制在最后日桶');

const chart = read('src/components/charts/PriceSparkline.tsx');
const scale = read('src/components/charts/marketChartScale.ts');
const wrapper = read('src/components/charts/EconomyChart.tsx');
const registry = read('src/components/charts/echartsCore.ts');
const marketPage = read('src/pages/MarketPage.tsx');
const marketCss = read('src/styles/market-page-polish.css');
const chartCss = read('src/styles/charts.css');
const safeZoneSpec = read('tests/browser/market-chart-safe-zone.spec.ts');
const boundaryLabelSpec = read('tests/browser/market-boundary-axis-label.spec.ts');
const readabilitySpec = read('tests/browser/market-chart-readability.spec.ts');
const tooltipPersistenceSpec = read('tests/browser/market-tooltip-persistence.spec.ts');
const tooltipPersistenceHarness = read('tests/browser/market-tooltip-persistence-harness.tsx');
const runtimeSpec = read('tests/browser/market-runtime.spec.ts');
const heightStabilitySpec = read('tests/browser/market-chart-height-stability.spec.ts');
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
  'triggerEmphasis: false', 'emphasis: STABLE_TOOLTIP_EMPHASIS',
  'resolveMarketBucketIndex(axisValue, windowStart, safeBuckets.length, MARKET_BUCKET_MS)',
  'const priceVolumeGap = 0', 'const volumeTop = priceBottom + priceVolumeGap',
  'export function buildMarketChartGeometry',
  'minimumHeight = 0', 'extraDataHeight * 0.72', 'extraDataHeight * 0.28',
  'chartCard.clientTop', 'chartCard.clientHeight', 'cardContentBottom - elementRect.top',
  'data-chart-fill-mode={minimumHeight > 0',
  'Math.max(68, rootFontSize * 4.25)', '(0.22 / 0.78) * priceHeight',
  'buildIntegerPriceScale', 'buildIntegerVolumeScale',
  'expandScaleToMinimumTicks', 'left.padding - right.padding',
  'estimateMarketAxisLabelWidth', 'axisLabelWidth + 10',
  'formatIntegerPriceTick', 'formatCompactVolumeTick',
  'showMinLabel: true', 'showMaxLabel: false',
  "value === volumeScale.max ? '' : formatCompactVolumeTick(value)",
  'lineStyle: { color: chartColor.info', 'areaStyle: { color: chartColor.info',
  'barMinHeight: 2', 'color: chartColor.secondary',
  'data-volume-share={geometry.volumeShare.toFixed(4)}',
  'data-time-axis-interval={axisInterval}',
  'data-price-tick-count={priceScale.ticks.length}', 'data-volume-tick-count={volumeScale.ticks.length}',
  'data-volume-nonzero-label-visible={hasVisibleNonZeroVolumeTick',
  'data-price-color-role="info"',
  'data-mobile-axis-titles={geometry.mobileAxisTitles',
  'data-x-axis-title-visible={geometry.showXAxisTitle',
  'data-axis-pointer-linked="true"', 'data-hover-emphasis-disabled="true"',
  'data-chart-fill-mode={minimumHeight > 0',
  'data-shared-boundary-label-owner="price"',
  'data-price-min-label={priceBoundaryLabel}',
  'data-volume-max-label={volumeBoundaryLabel}',
  'data-volume-max-label-visible="false"',
  'marketBucketSignature', 'useMemo<MarketHistoryBucket[]>',
  "id: 'market-price-grid'", "id: 'market-volume-grid'",
  "id: 'market-price-series'", "id: 'market-volume-series'",
  'updateMode="merge"', 'onChartReady={handleChartReady}', 'onOptionApplied={restoreActiveTooltip}',
  'const scheduleActiveTooltip = useCallback', 'scheduleActiveTooltip();',
  "type: 'showTip'", "type: 'hideTip'", 'data-tooltip-persistence="true"',
  'className="market-chart-price-volume-divider"',
  'className="market-chart-section-label"',
  '<div className="market-chart-x-axis-title">日期</div>',
  '主动买入', '主动卖出', '方向未知', '净主动量',
]) assert.ok(chart.includes(text), `ECharts 行情图缺少: ${text}`);
for (const text of [
  'chooseMarketTimeInterval', 'chooseMarketPriceTickCount', 'chooseMarketVolumeTickCount',
  "variant: MarketChartVariant = 'full'", "variant === 'compact' ? 2 : 3",
  'resolveMarketBucketIndex', 'MARKET_TIME_INTERVAL_DAYS',
]) assert.ok(scale.includes(text), `行情动态刻度纯函数缺少: ${text}`);
for (const text of ['market-chart-legend', '净主动买入', '净主动卖出']) {
  assert.ok(!chart.includes(text), `行情图不得恢复主动方向图例: ${text}`);
}
assert.ok(types.includes('dailyHistory?: MarketDailyHistoryPoint[];'), '市场详情类型必须暴露 30 天日行情');
assert.ok(chartDesign.includes('最近 30 个北京时间自然日'), '行情设计必须锁定最近 30 天');
assert.ok(!chartDesign.includes('`6m × 240`'), '行情设计不得保留 6 分钟 240 桶旧规则');

for (const text of ['<svg', '<polyline', '<polygon', '<rect', 'context.measureText', 'useChartAxisMetrics']) {
  assert.ok(!chart.includes(text), `ECharts 行情图不得保留手写 SVG: ${text}`);
}
for (const text of ['chartCardRect.bottom - elementRect.top', 'observer?.observe(element)']) {
  assert.ok(!chart.includes(text), `行情图不得恢复高度反馈表达式: ${text}`);
}
for (const text of [
  'market chart row fill height remains stable without resize feedback',
  'for (let frame = 0; frame < 120; frame += 1)',
  'await page.waitForTimeout(6_500)',
  "toHaveAttribute('data-chart-fill-mode', 'natural')",
]) assert.ok(heightStabilitySpec.includes(text), `行情图高度稳定回归缺少: ${text}`);

for (const text of [
  'initECharts', "renderer: 'svg'", 'new ResizeObserver', 'requestAnimationFrame',
  'chart.setOption', 'chart.dispose()', 'data-echarts-ready',
  "updateMode = 'replace'", "notMerge: updateMode !== 'merge'",
  'onChartReadyRef.current?.(chart)', 'onOptionAppliedRef.current?.(chart)',
]) assert.ok(wrapper.includes(text), `共享 EconomyChart 缺少生命周期规则: ${text}`);
for (const text of ['LineChart', 'BarChart', 'PieChart', 'AxisPointerComponent', 'GridComponent', 'TooltipComponent', 'AriaComponent', 'SVGRenderer']) {
  assert.ok(registry.includes(text), `ECharts 模块注册缺少: ${text}`);
}

for (const text of ['buildMarketHistoryBuckets(marketHistory, marketFallbackPrice, now, marketDailyHistory ?? [])', '<PriceSparkline buckets={marketBuckets} variant="full" />']) {
  assert.ok(marketPage.includes(text), `MarketPage 缺少: ${text}`);
}
for (const text of ['countMarketHistoryPointsInWindow', 'summarizeMarketFlow', 'className="chart-footer"', '最近成交估值', '主动买卖均衡／方向未知']) {
  assert.ok(!marketPage.includes(text), `MarketPage 不应恢复行情底部说明: ${text}`);
}
assert.ok(!marketCss.includes('aspect-ratio: 16 / 9'), '业务 CSS 不得固定覆盖动态行情比例');
for (const text of [
  '.market-chart-footer', '.market-chart-price-volume-divider', '.market-chart-section-label',
  'font-variant-numeric: tabular-nums', 'color: var(--color-text-secondary)',
  'background: var(--color-surface-control)',
]) assert.ok(chartCss.includes(text), `共享图表样式缺少: ${text}`);

for (const text of [
  'const marketChartViewports = [',
  "{ width: 1684, height: 931, label: '桌面端' }", "{ width: 390, height: 844, label: '移动端' }",
  "{ width: 320, height: 700, label: '极窄移动端' }", 'for (const viewport of marketChartViewports)',
  'market chart responsive tick density follows real chart width in one runtime', 'resizeAndInspectChart', 'expect.poll',
  'market chart 125% root font keeps mobile safe geometry and tick density', "document.documentElement.style.fontSize = '20px'",
  'priceVolumeGap', 'dividerBoundaryDelta', 'timeAxisInterval', 'priceTickCount', 'volumeTickCount',
  '价格与成交量 Grid 必须零间距连续排列',
  '成交量图区实际高度不得低于 48px', '成交量图区不得低于数据绘图区的 22%',
]) assert.ok(safeZoneSpec.includes(text), `行情图浏览器几何回归缺少: ${text}`);
assert.ok(!safeZoneSpec.includes('test.setTimeout('), '行情图浏览器几何回归不得扩大 Playwright 单测超时');
for (const text of [
  'const marketBoundaryViewports = [',
  "{ width: 721, height: 445, label: '问题截图尺寸' }", "{ width: 390, height: 844, label: '移动端' }",
  "{ width: 320, height: 700, label: '极窄移动端' }", 'for (const viewport of marketBoundaryViewports)',
  'market zero-gap grids give the shared boundary label to the price axis only at ${viewport.label}',
  'market zero-gap grids keep the shared boundary label on the price axis at 125% root font', 'expect.poll',
  'data-echarts-ready', 'sharedBoundaryLabelOwner', 'volumeMaxLabelVisible',
  'priceMinMatches', 'boundaryLabels', '共享边界只能存在一项纵轴刻度',
  "document.documentElement.style.fontSize = '20px'",
]) assert.ok(boundaryLabelSpec.includes(text), `行情图共享边界刻度回归缺少: ${text}`);
assert.ok(!boundaryLabelSpec.includes('test.setTimeout('), '行情图共享边界刻度回归不得扩大 Playwright 单测超时');
assert.ok(!boundaryLabelSpec.includes("test('market zero-gap grids give the shared boundary label to the price axis only',"), '行情图共享边界刻度回归不得恢复多视口单体长链');
for (const text of [
  'market chart keeps price, volume and mobile axis semantics readable',
  "page.goto('market-runtime-test.html?scenario=active')",
  'priceTicks', 'volumeTicks', 'volumeNonzeroLabelVisible', 'priceColorRole',
  'mobileAxisTitles', 'xAxisTitleVisible', 'axisLeft', 'volumeHeight',
  'not.toContain(0)', 'toBeGreaterThanOrEqual(3)', 'toBeGreaterThanOrEqual(68)',
  "chart.locator('.market-chart-section-label')", "chart.locator('.market-chart-x-axis-title')",
  "root.getPropertyValue('--color-info')", "root.getPropertyValue('--color-success')",
  "chart.locator('.economy-chart__canvas svg text')", "toContain('2')",
]) assert.ok(readabilitySpec.includes(text), `行情图可读性浏览器回归缺少: ${text}`);
for (const text of [
  'market chart uses one linked hover state and keeps the price line protected',
  "data-axis-pointer-linked", "data-hover-emphasis-disabled", 'priceHoverText',
  'priceTicks', 'volumeTicks', 'ECharts SVG is not ready', 'market-chart-footer',
  "new PointerEvent('pointermove'", 'market detail keeps snapshot history when the detail refresh fails',
  'recent local trades heading keeps clear action on the same row on narrow screens',
]) assert.ok(runtimeSpec.includes(text), `市场运行时回归缺少: ${text}`);
for (const text of [
  'market tooltip survives idle rerenders and real option updates until the pointer leaves',
  'page.waitForTimeout(6_500)', 'data-echarts-instance-id', 'data-tooltip-persistence',
  '__advanceMarketTooltipData', 'toBeGreaterThanOrEqual(6)', 'toBeHidden()',
]) assert.ok(tooltipPersistenceSpec.includes(text), `行情 Tooltip 持久性浏览器回归缺少: ${text}`);
for (const text of [
  'setInterval(() => setRenderCount', 'buildBuckets(dataRevision)',
  '__advanceMarketTooltipData', '<PriceSparkline buckets={buckets} variant="full" />',
]) assert.ok(tooltipPersistenceHarness.includes(text), `行情 Tooltip 持久性 Harness 缺少: ${text}`);

assert.ok(types.includes('takerSide?: OrderSide;'), 'PricePoint 必须保存可选吃单方向');
assert.ok(matchingCore.includes('takerSide: incoming.side'), '撮合内核必须记录吃单方向');
assert.ok(commodityMarket.includes('recordPrice(world, incoming.productId, price, quantity, takerSide, createdAt, signalWeight, marketRole, incoming.provinceId);'), '商品成交必须记录方向、信号与地区');
assert.ok(commodityMarket.includes('LIQUIDITY_SIGNAL_WEIGHT'), '储备成交必须降低传导信号权重');
assert.ok(facilityMarket.includes('recordFacilityPrice(world, typeId, price, quantity, takerSide, createdAt, incoming.provinceId);'), '工厂成交必须记录吃单方向与地区');

for (const text of [
  '商品地区详情最上方固定为商品图标与四项交易摘要：今日价格、今日成交量、可用库存和冻结库存',
  '近 30 天按日成交趋势',
  '市场行情图几何继续以 `MARKET_CHART_LAYOUT_DESIGN.md` 为准',
  '24h 成交量',
  '浏览器本地成交记录',
]) assert.ok(design.includes(text), `页面设计文档缺少: ${text}`);
for (const text of [
  '市场行情图几何、交互与可读性唯一专项基线', 'ECharts SVG', '零间距连续双 Grid',
  '统一悬浮交互', '`axisPointer.link`', '`axisValue`',
  '第一次有效 `pointermove`', '主动驱动同一分段的 Tooltip',
  '动态时间间隔', '真实像素高度和根字号动态计算',
  '额外空白最少的区间', '`3～6`', '`0～10`',
  '`--color-info`', '`--color-success`', '`--color-text-secondary`',
  '共享边界只能显示一项纵轴刻度标签', '价格轴保留最小刻度', '成交量轴隐藏最大刻度',
  '成交量轴目标刻度不得低于 3 个', '非零中间刻度',
  'full 变体任意支持断点下成交量绘图区实际屏幕高度不得低于 `68px`',
  '最小可见高度 `2px`',
  '容器宽度不大于 `720px` 或使用 compact 变体时不渲染可见“日期”标题',
  '水平小标题', '最长可见标签估算宽度',
  '`tests/browser/market-chart-readability.spec.ts`',
  '普通 `5s` 状态轮询', '无关 React 重渲染', 'Option 应用后恢复',
  '至少 `6.5s`', '`alwaysShowContent`', '超长 `hideDelay`',
  '价格区与成交量区合计数据绘图区的 `22%`',
  '不得由业务 CSS 再用固定比例覆盖组件计算结果',
  '交易卡和行情卡外框必须同排等高', '内容盒底边',
  '不得监听由组件自身写入高度的图表节点', '按约 `72%` 分配给价格区、`28%` 分配给成交量区',
  '连续采样至少 `120` 个动画帧',
  '稳定 `data-*`', '`721 × 445`', '390 × 844` 且根字号放大到 `125%',
]) assert.ok(chartDesign.includes(text), `市场行情图专项设计缺少: ${text}`);
assert.ok(designIndex.includes('`MARKET_CHART_LAYOUT_DESIGN.md`'), '设计索引必须将市场图表几何与交互路由到专项 DESIGN owner');
assert.ok(designIndex.includes('`PAGE_CONTENT_AND_NAVIGATION_DESIGN.md`'), '设计索引必须将市场页面内容路由到页面 DESIGN owner');
for (const text of [
  '真实玩家即时交易继续写入商品真实成交历史',
  '内部人口／储备订单继续复用共享撮合内核',
  '零成交调价记录不得伪造真实玩家成交量',
]) {
  assert.ok(orderBookDesign.includes(text), `即时市场设计文档缺少: ${text}`);
}

console.log('Market ECharts verification passed: 30 daily buckets, readable volume labels, no direction legend, linked persistent hover and zero-gap grids satisfy the design baseline.');
