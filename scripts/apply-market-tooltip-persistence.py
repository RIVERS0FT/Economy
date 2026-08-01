from pathlib import Path


def read(path: str) -> str:
    return Path(path).read_text(encoding='utf-8').replace('\r\n', '\n')


def write(path: str, content: str) -> None:
    normalized = '\n'.join(line.rstrip() for line in content.replace('\r\n', '\n').split('\n')).rstrip() + '\n'
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    Path(path).write_text(normalized, encoding='utf-8')


# Shared ECharts lifecycle: keep replace as the default, but allow stable charts to merge and restore interaction state.
write('src/components/charts/EconomyChart.tsx', '''import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import { initECharts, type EChartsCoreOption, type EChartsType } from './echartsCore';

let nextChartInstanceId = 1;

export type EconomyChartUpdateMode = 'replace' | 'merge';

export function EconomyChart({
  option,
  ariaLabel,
  accessibleSummary = ariaLabel,
  className,
  style,
  testId,
  updateMode = 'replace',
  onChartReady,
  onOptionApplied,
}: {
  option: EChartsCoreOption;
  ariaLabel: string;
  accessibleSummary?: string;
  className?: string;
  style?: CSSProperties;
  testId?: string;
  updateMode?: EconomyChartUpdateMode;
  onChartReady?: (chart: EChartsType) => void;
  onOptionApplied?: (chart: EChartsType) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<EChartsType | null>(null);
  const optionRef = useRef(option);
  const resizeFrameRef = useRef<number | null>(null);
  const updateModeRef = useRef(updateMode);
  const onChartReadyRef = useRef(onChartReady);
  const onOptionAppliedRef = useRef(onOptionApplied);
  const [ready, setReady] = useState(false);

  updateModeRef.current = updateMode;
  onChartReadyRef.current = onChartReady;
  onOptionAppliedRef.current = onOptionApplied;

  useLayoutEffect(() => {
    optionRef.current = option;
    const chart = chartRef.current;
    if (!chart) return;
    chart.setOption(option, {
      notMerge: updateMode !== 'merge',
      lazyUpdate: true,
    });
    onOptionAppliedRef.current?.(chart);
  }, [option, updateMode]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    const chart = initECharts(container, undefined, {
      renderer: 'svg',
      useDirtyRect: false,
    });
    const instanceId = nextChartInstanceId;
    nextChartInstanceId += 1;
    container.dataset.echartsInstanceId = String(instanceId);
    chartRef.current = chart;
    chart.setOption(optionRef.current, {
      notMerge: updateModeRef.current !== 'merge',
      lazyUpdate: false,
    });
    setReady(true);
    onChartReadyRef.current?.(chart);
    onOptionAppliedRef.current?.(chart);

    const scheduleResize = () => {
      if (resizeFrameRef.current !== null) cancelAnimationFrame(resizeFrameRef.current);
      resizeFrameRef.current = requestAnimationFrame(() => {
        resizeFrameRef.current = null;
        chart.resize();
      });
    };

    const observer = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(scheduleResize);
    observer?.observe(container);
    window.addEventListener('resize', scheduleResize);
    void document.fonts?.ready.then(scheduleResize);

    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', scheduleResize);
      if (resizeFrameRef.current !== null) cancelAnimationFrame(resizeFrameRef.current);
      chart.dispose();
      chartRef.current = null;
    };
  }, []);

  return (
    <div
      className={className ? `economy-chart ${className}` : 'economy-chart'}
      style={style}
      role="img"
      aria-label={ariaLabel}
      data-echarts-ready={ready ? 'true' : 'false'}
      data-testid={testId}
    >
      <div ref={containerRef} className="economy-chart__canvas" aria-hidden="true" />
      <span className="economy-chart__accessible-summary">{accessibleSummary}</span>
    </div>
  );
}
''')

chart_path = 'src/components/charts/PriceSparkline.tsx'
chart = read(chart_path)
chart = chart.replace(
    "import { useLayoutEffect, useMemo, useRef, useState } from 'react';",
    "import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';",
)
chart = chart.replace(
    "import type { EChartsCoreOption } from './echartsCore';",
    "import type { EChartsCoreOption, EChartsType } from './echartsCore';",
)
anchor = "];\n\nexport function niceIntegerStep"
if anchor not in chart:
    raise SystemExit('PriceSparkline compact unit anchor missing')
chart = chart.replace(anchor, '''\n];

const MARKET_AXIS_POINTER_LINE_STYLE = {
  color: chartColor.secondary,
  width: 1,
  type: 'dashed' as const,
  opacity: 0.82,
};

function marketBucketSignature(buckets: MarketHistoryBucket[]) {
  return buckets.map((bucket) => [
    bucket.startAt,
    bucket.price,
    bucket.volume,
    bucket.buyVolume,
    bucket.sellVolume,
    bucket.neutralVolume,
    bucket.netVolume,
    bucket.direction,
  ].join(':')).join('|');
}

export function niceIntegerStep''')

function_start = chart.index("function MarketHistoryChart({ buckets, variant }: { buckets: MarketHistoryBucket[]; variant: MarketChartVariant }) {")
option_start = chart.index("  const option = useMemo<EChartsCoreOption>(() => ({", function_start)
new_preamble = '''function MarketHistoryChart({ buckets, variant }: { buckets: MarketHistoryBucket[]; variant: MarketChartVariant }) {
  const bucketSignature = marketBucketSignature(buckets);
  const safeBuckets = useMemo<MarketHistoryBucket[]>(() => (
    buckets.length > 0 ? buckets : [{
      startAt: Math.floor(Date.now() / MARKET_BUCKET_MS) * MARKET_BUCKET_MS,
      price: 1,
      volume: 0,
      buyVolume: 0,
      sellVolume: 0,
      neutralVolume: 0,
      netVolume: 0,
      direction: 'neutral',
    }]
  ), [bucketSignature]);
  const { ref, width, rootFontSize } = useMarketChartWidth();
  const geometry = useMemo(
    () => buildMarketChartGeometry(width, rootFontSize, variant),
    [rootFontSize, variant, width],
  );
  const priceHeight = geometry.priceBottom - geometry.top;
  const volumeHeight = geometry.volumeBottom - geometry.volumeTop;
  const plotWidth = Math.max(1, geometry.width - geometry.left - geometry.right);
  const priceTickCount = chooseMarketPriceTickCount(priceHeight, rootFontSize);
  const volumeTickCount = chooseMarketVolumeTickCount(volumeHeight, rootFontSize);
  const priceScale = useMemo(() => buildIntegerPriceScale(
    Math.min(...safeBuckets.map((bucket) => bucket.price)),
    Math.max(...safeBuckets.map((bucket) => bucket.price)),
    priceTickCount,
  ), [priceTickCount, safeBuckets]);
  const volumeScale = useMemo(() => buildIntegerVolumeScale(
    Math.max(1, ...safeBuckets.map((bucket) => bucket.volume)),
    volumeTickCount,
  ), [safeBuckets, volumeTickCount]);
  const priceBoundaryLabel = formatIntegerPriceTick(priceScale.min);
  const volumeBoundaryLabel = formatCompactVolumeTick(volumeScale.max);
  const windowStart = safeBuckets[0].startAt;
  const windowEnd = windowStart + MARKET_WINDOW_MS;
  const axisInterval = chooseMarketTimeInterval(plotWidth, rootFontSize, variant, MARKET_WINDOW_MS);
  const barWidth = Math.max(1, (plotWidth / safeBuckets.length) * 0.74);
  const chartInstanceRef = useRef<EChartsType | null>(null);
  const pointerInsideRef = useRef(false);
  const hoveredBucketIndexRef = useRef<number | null>(null);
  const bucketCountRef = useRef(safeBuckets.length);
  const restoreFrameRef = useRef<number | null>(null);
  bucketCountRef.current = safeBuckets.length;

  const handleChartReady = useCallback((chartInstance: EChartsType) => {
    chartInstanceRef.current = chartInstance;
  }, []);

  const restoreActiveTooltip = useCallback((chartInstance: EChartsType) => {
    if (restoreFrameRef.current !== null) cancelAnimationFrame(restoreFrameRef.current);
    if (!pointerInsideRef.current || hoveredBucketIndexRef.current === null) return;
    restoreFrameRef.current = requestAnimationFrame(() => {
      restoreFrameRef.current = null;
      if (!pointerInsideRef.current || hoveredBucketIndexRef.current === null) return;
      const dataIndex = Math.min(
        Math.max(0, hoveredBucketIndexRef.current),
        Math.max(0, bucketCountRef.current - 1),
      );
      chartInstance.dispatchAction({
        type: 'showTip',
        seriesIndex: 0,
        dataIndex,
      });
    });
  }, []);

  const handlePointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const pointerX = event.clientX - bounds.left;
    const pointerY = event.clientY - bounds.top;
    const plotRight = geometry.width - geometry.right;
    const insideDataArea = pointerX >= geometry.left
      && pointerX <= plotRight
      && pointerY >= geometry.top
      && pointerY <= geometry.volumeBottom;
    if (!insideDataArea) {
      pointerInsideRef.current = false;
      hoveredBucketIndexRef.current = null;
      chartInstanceRef.current?.dispatchAction({ type: 'hideTip' });
      return;
    }
    pointerInsideRef.current = true;
    const ratio = Math.min(1, Math.max(0, (pointerX - geometry.left) / plotWidth));
    hoveredBucketIndexRef.current = Math.min(
      safeBuckets.length - 1,
      Math.floor(ratio * safeBuckets.length),
    );
  }, [geometry.left, geometry.right, geometry.top, geometry.volumeBottom, geometry.width, plotWidth, safeBuckets.length]);

  const handlePointerLeave = useCallback(() => {
    pointerInsideRef.current = false;
    hoveredBucketIndexRef.current = null;
    if (restoreFrameRef.current !== null) cancelAnimationFrame(restoreFrameRef.current);
    restoreFrameRef.current = null;
    chartInstanceRef.current?.dispatchAction({ type: 'hideTip' });
  }, []);

  useEffect(() => () => {
    if (restoreFrameRef.current !== null) cancelAnimationFrame(restoreFrameRef.current);
    chartInstanceRef.current = null;
  }, []);

'''
chart = chart[:function_start] + new_preamble + chart[option_start:]

replacements = {
    "      { left: geometry.left, right: geometry.right, top: geometry.top, height: priceHeight },": "      { id: 'market-price-grid', left: geometry.left, right: geometry.right, top: geometry.top, height: priceHeight },",
    "      { left: geometry.left, right: geometry.right, top: geometry.volumeTop, height: volumeHeight },": "      { id: 'market-volume-grid', left: geometry.left, right: geometry.right, top: geometry.volumeTop, height: volumeHeight },",
    "        lineStyle: axisPointerLineStyle,": "        lineStyle: MARKET_AXIS_POINTER_LINE_STYLE,",
    "        type: 'value', gridIndex: 0, min: windowStart, max: windowEnd, interval: axisInterval,": "        id: 'market-price-time-axis', type: 'value', gridIndex: 0, min: windowStart, max: windowEnd, interval: axisInterval,",
    "        axisPointer: { show: true, snap: true, label: { show: false }, lineStyle: axisPointerLineStyle },": "        axisPointer: { show: true, snap: true, label: { show: false }, lineStyle: MARKET_AXIS_POINTER_LINE_STYLE },",
    "        type: 'value', gridIndex: 1, min: windowStart, max: windowEnd, interval: axisInterval,": "        id: 'market-volume-time-axis', type: 'value', gridIndex: 1, min: windowStart, max: windowEnd, interval: axisInterval,",
    "        type: 'value', gridIndex: 0, min: priceScale.min, max: priceScale.max, interval: priceScale.step,": "        id: 'market-price-value-axis', type: 'value', gridIndex: 0, min: priceScale.min, max: priceScale.max, interval: priceScale.step,",
    "        type: 'value', gridIndex: 1, min: 0, max: volumeScale.max, interval: volumeScale.step,": "        id: 'market-volume-value-axis', type: 'value', gridIndex: 1, min: 0, max: volumeScale.max, interval: volumeScale.step,",
    "        name: '价格', type: 'line', xAxisIndex: 0, yAxisIndex: 0, showSymbol: false, symbol: 'none', smooth: false, z: 3,": "        id: 'market-price-series', name: '价格', type: 'line', xAxisIndex: 0, yAxisIndex: 0, showSymbol: false, symbol: 'none', smooth: false, z: 3,",
    "        name: '成交量', type: 'bar', xAxisIndex: 1, yAxisIndex: 1, barWidth,": "        id: 'market-volume-series', name: '成交量', type: 'bar', xAxisIndex: 1, yAxisIndex: 1, barWidth,",
    "  }), [axisInterval, axisPointerLineStyle, barWidth, geometry, priceHeight, priceScale, rootFontSize, safeBuckets, variant, volumeHeight, volumeScale, windowEnd, windowStart]);": "  }), [axisInterval, barWidth, geometry, priceHeight, priceScale, rootFontSize, safeBuckets, variant, volumeHeight, volumeScale, windowEnd, windowStart]);",
    "      aria-label=\"近 24 小时价格、成交量与主动买卖方向趋势图\"": "      aria-label=\"近 24 小时价格、成交量与主动买卖方向趋势图\"\n      onPointerMove={handlePointerMove}\n      onPointerLeave={handlePointerLeave}",
    "      data-hover-emphasis-disabled=\"true\"": "      data-hover-emphasis-disabled=\"true\"\n      data-tooltip-persistence=\"true\"",
    "        accessibleSummary={safeBuckets.map((bucket) => `${formatMarketAxisTime(bucket.startAt)}价格${formatIntegerPriceTick(bucket.price)}成交量${formatCompactVolumeTick(bucket.volume)}`).join('；')}\n      />": "        accessibleSummary={safeBuckets.map((bucket) => `${formatMarketAxisTime(bucket.startAt)}价格${formatIntegerPriceTick(bucket.price)}成交量${formatCompactVolumeTick(bucket.volume)}`).join('；')}\n        updateMode=\"merge\"\n        onChartReady={handleChartReady}\n        onOptionApplied={restoreActiveTooltip}\n      />",
}
for old, new in replacements.items():
    if old not in chart:
        raise SystemExit(f'PriceSparkline replacement anchor missing: {old[:80]}')
    chart = chart.replace(old, new)

# The same axis-pointer line appears twice; replace any remaining local reference and ensure the old local object is gone.
chart = chart.replace('lineStyle: axisPointerLineStyle', 'lineStyle: MARKET_AXIS_POINTER_LINE_STYLE')
if 'const axisPointerLineStyle =' in chart:
    raise SystemExit('Local axis pointer style survived replacement')
write(chart_path, chart)

# A dedicated runtime harness reproduces one-second unrelated renders and a real series update while the mouse remains stationary.
write('market-tooltip-persistence-test.html', '''<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Market Tooltip Persistence Test</title>
    <style>
      html, body, #root { min-height: 100%; margin: 0; }
      body { background: #07140f; color: #eef7f1; font-family: system-ui, sans-serif; }
    </style>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/tests/browser/market-tooltip-persistence-harness.tsx"></script>
  </body>
</html>
''')

write('tests/browser/market-tooltip-persistence-harness.tsx', '''import { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { PriceSparkline } from '../../src/components/charts/PriceSparkline';
import type { MarketHistoryBucket } from '../../src/utils/marketHistory';
import { MARKET_BUCKET_COUNT, MARKET_BUCKET_MS, MARKET_WINDOW_MS } from '../../src/utils/marketHistory';
import '../../src/styles/globals.css';
import '../../src/styles/charts.css';
import '../../src/styles/design-system.css';

const windowEnd = Date.UTC(2026, 6, 18, 16, 0, 0);
const windowStart = windowEnd - MARKET_WINDOW_MS;

function buildBuckets(dataRevision: number): MarketHistoryBucket[] {
  return Array.from({ length: MARKET_BUCKET_COUNT }, (_, index) => {
    const active = index === 120;
    const price = active ? 12 + dataRevision : 12;
    const volume = active ? 120 + dataRevision * 80 : index % 41 === 0 ? 20 : 0;
    return {
      startAt: windowStart + index * MARKET_BUCKET_MS,
      price,
      volume,
      buyVolume: volume,
      sellVolume: 0,
      neutralVolume: 0,
      netVolume: volume,
      direction: volume > 0 ? 'buy' : 'neutral',
    };
  });
}

declare global {
  interface Window {
    __advanceMarketTooltipData?: () => void;
  }
}

function MarketTooltipPersistenceHarness() {
  const [renderCount, setRenderCount] = useState(0);
  const [dataRevision, setDataRevision] = useState(0);
  const buckets = useMemo(() => buildBuckets(dataRevision), [dataRevision]);

  useEffect(() => {
    const timer = window.setInterval(() => setRenderCount((current) => current + 1), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    window.__advanceMarketTooltipData = () => setDataRevision((current) => current + 1);
    return () => {
      delete window.__advanceMarketTooltipData;
    };
  }, []);

  return (
    <main style={{ width: '900px', maxWidth: '100%', margin: '0 auto', padding: '24px' }}>
      <div data-testid="market-tooltip-render-count" data-render-count={renderCount} data-data-revision={dataRevision}>
        <PriceSparkline buckets={buckets} variant="full" />
      </div>
    </main>
  );
}

const root = document.getElementById('root');
if (!root) throw new Error('Market tooltip persistence root is missing');
createRoot(root).render(<MarketTooltipPersistenceHarness />);
''')

write('tests/browser/market-tooltip-persistence.spec.ts', '''import { expect, test } from '@playwright/test';

test('market tooltip survives idle rerenders and real option updates until the pointer leaves', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.setViewportSize({ width: 960, height: 720 });
  await page.goto('market-tooltip-persistence-test.html');

  const chart = page.locator('.market-history-chart.full');
  const economyChart = chart.locator('.economy-chart');
  const canvas = chart.locator('.economy-chart__canvas');
  const tooltip = page.locator('.economy-chart-tooltip');
  await expect(economyChart).toHaveAttribute('data-echarts-ready', 'true');
  await expect(chart).toHaveAttribute('data-tooltip-persistence', 'true');

  const bounds = await chart.boundingBox();
  expect(bounds).not.toBeNull();
  const geometry = await chart.evaluate((element) => {
    const wrapper = element as HTMLElement;
    const read = (name: string) => Number(wrapper.dataset[name]);
    return {
      left: read('axisLeft'),
      right: read('axisRight'),
      priceTop: read('priceTop'),
      priceBottom: read('priceBottom'),
    };
  });
  const x = bounds!.x + geometry.left + (bounds!.width - geometry.left - geometry.right) * 0.502;
  const y = bounds!.y + (geometry.priceTop + geometry.priceBottom) / 2;
  await page.mouse.move(x, y);
  await expect(tooltip).toBeVisible();
  await expect(tooltip).toContainText('价格');
  const initialText = (await tooltip.innerText()).replace(/\s+/g, ' ').trim();
  const initialInstanceId = await canvas.getAttribute('data-echarts-instance-id');
  expect(initialInstanceId).toBeTruthy();

  await page.waitForTimeout(6_500);
  await expect.poll(async () => Number(await page.getByTestId('market-tooltip-render-count').getAttribute('data-render-count'))).toBeGreaterThanOrEqual(6);
  await expect(tooltip).toBeVisible();
  expect((await tooltip.innerText()).replace(/\s+/g, ' ').trim()).toBe(initialText);
  await expect(canvas).toHaveAttribute('data-echarts-instance-id', initialInstanceId!);

  await page.evaluate(() => window.__advanceMarketTooltipData?.());
  await expect.poll(async () => page.getByTestId('market-tooltip-render-count').getAttribute('data-data-revision')).toBe('1');
  await expect(tooltip).toBeVisible();
  await expect.poll(async () => (await tooltip.innerText()).replace(/\s+/g, ' ').trim()).not.toBe(initialText);
  await expect(canvas).toHaveAttribute('data-echarts-instance-id', initialInstanceId!);

  await page.mouse.move(4, 4);
  await expect(tooltip).toBeHidden();
  expect(pageErrors).toEqual([]);
});
''')

# Authoritative design: interaction state is part of the market-chart contract.
design_path = 'docs/MARKET_CHART_LAYOUT_DESIGN.md'
design = read(design_path)
interaction_anchor = '- 价格折线必须保持高于自身面积填充的稳定渲染层级。'
if interaction_anchor not in design:
    raise SystemExit('Market chart design interaction anchor missing')
design = design.replace(interaction_anchor, interaction_anchor + '''
- 当指针仍位于行情数据区时，普通 `5s` 状态轮询、无关 React 重渲染和尺寸未变化的页面更新不得清除当前 Tooltip 或 AxisPointer。
- 真实行情数据或 6 分钟窗口变化需要更新 ECharts Option 时，必须在 Option 应用后恢复鼠标当前横向位置对应的分段 Tooltip；不得要求用户再次移动鼠标。
- Tooltip 只允许在指针离开行情数据区、资产切换、页面卸载或用户主动关闭时隐藏。不得使用 `alwaysShowContent`、超长 `hideDelay` 或禁止正常离开隐藏来掩盖更新重置问题。''')
browser_anchor = '浏览器交互回归还必须分别在价格区和成交量区移动到同一横坐标，确认 Tooltip 内容一致、联动指针启用、Series emphasis 已禁用且页面无运行时错误。'
if browser_anchor not in design:
    raise SystemExit('Market chart design browser anchor missing')
design = design.replace(browser_anchor, browser_anchor + '''

Tooltip 持久性回归必须让父组件至少每秒发生一次无关重渲染，鼠标静止超过正式 `5s` 轮询周期并等待至少 `6.5s`，随后再触发一次真实行情 Option 更新；两阶段 Tooltip 均须保持可见、ECharts 实例 ID 不变，真实更新后内容须刷新。最后必须验证指针离开图表时 Tooltip 正常隐藏。''')
forbid_anchor = '- 让 AxisPointer 或 Series emphasis 改变、模糊或隐藏价格折线；'
if forbid_anchor not in design:
    raise SystemExit('Market chart design forbid anchor missing')
design = design.replace(forbid_anchor, forbid_anchor + '''
- 让普通轮询、无关重渲染或真实行情 Option 更新在鼠标静止时清除 Tooltip，或用 `alwaysShowContent`／超长 `hideDelay` 规避正常交互生命周期；''')
write(design_path, design)

# Static guard: require stable options, merge updates, explicit showTip restoration and a real idle browser test.
verify_path = 'scripts/verify-market-chart.mjs'
verify = read(verify_path)
verify = verify.replace(
    "const boundaryLabelSpec = read('tests/browser/market-boundary-axis-label.spec.ts');\nconst runtimeSpec",
    "const boundaryLabelSpec = read('tests/browser/market-boundary-axis-label.spec.ts');\nconst tooltipPersistenceSpec = read('tests/browser/market-tooltip-persistence.spec.ts');\nconst tooltipPersistenceHarness = read('tests/browser/market-tooltip-persistence-harness.tsx');\nconst runtimeSpec",
)
chart_guard_anchor = "  'data-volume-max-label-visible=\"false\"',"
if chart_guard_anchor not in verify:
    raise SystemExit('Market verifier chart guard anchor missing')
verify = verify.replace(chart_guard_anchor, chart_guard_anchor + '''
  'marketBucketSignature', 'useMemo<MarketHistoryBucket[]>',
  "id: 'market-price-grid'", "id: 'market-volume-grid'",
  "id: 'market-price-series'", "id: 'market-volume-series'",
  'updateMode="merge"', 'onChartReady={handleChartReady}', 'onOptionApplied={restoreActiveTooltip}',
  "type: 'showTip'", "type: 'hideTip'", 'data-tooltip-persistence="true"',''')
wrapper_anchor = "]) assert.ok(wrapper.includes(text), `共享 EconomyChart 缺少生命周期规则: ${text}`);"
if wrapper_anchor not in verify:
    raise SystemExit('Market verifier wrapper anchor missing')
verify = verify.replace(
    "  'chartRef.current?.setOption', 'chart.dispose()', 'data-echarts-ready',\n" + wrapper_anchor,
    "  'chartRef.current?.setOption', 'chart.dispose()', 'data-echarts-ready',\n  \"updateMode = 'replace'\", \"notMerge: updateMode !== 'merge'\",\n  'onChartReadyRef.current?.(chart)', 'onOptionAppliedRef.current?.(chart)',\n" + wrapper_anchor,
)
runtime_guard_anchor = "]) assert.ok(runtimeSpec.includes(text), `市场运行时回归缺少: ${text}`);"
if runtime_guard_anchor not in verify:
    raise SystemExit('Market verifier runtime guard anchor missing')
verify = verify.replace(runtime_guard_anchor, runtime_guard_anchor + '''
for (const text of [
  'market tooltip survives idle rerenders and real option updates until the pointer leaves',
  'page.waitForTimeout(6_500)', 'data-echarts-instance-id', 'data-tooltip-persistence',
  '__advanceMarketTooltipData', 'toBeGreaterThanOrEqual(6)', 'toBeHidden()',
]) assert.ok(tooltipPersistenceSpec.includes(text), `行情 Tooltip 持久性浏览器回归缺少: ${text}`);
for (const text of [
  'setInterval(() => setRenderCount', 'buildBuckets(dataRevision)',
  '__advanceMarketTooltipData', '<PriceSparkline buckets={buckets} variant="full" />',
]) assert.ok(tooltipPersistenceHarness.includes(text), `行情 Tooltip 持久性 Harness 缺少: ${text}`);''')
design_guard_anchor = "  '共享边界只能显示一项纵轴刻度标签', '价格轴保留最小刻度', '成交量轴隐藏最大刻度',"
if design_guard_anchor not in verify:
    raise SystemExit('Market verifier design guard anchor missing')
verify = verify.replace(design_guard_anchor, design_guard_anchor + '''
  '普通 `5s` 状态轮询', '无关 React 重渲染', 'Option 应用后恢复',
  '至少 `6.5s`', '`alwaysShowContent`', '超长 `hideDelay`',''')
console_old = "console.log('Market ECharts verification passed: linked hover, protected line, zero-gap grids, single shared-boundary label, dynamic integer ticks and readable volume geometry satisfy the design baseline.');"
console_new = "console.log('Market ECharts verification passed: linked persistent hover, protected line, zero-gap grids, single shared-boundary label, dynamic integer ticks and readable volume geometry satisfy the design baseline.');"
if console_old not in verify:
    raise SystemExit('Market verifier console anchor missing')
verify = verify.replace(console_old, console_new)
write(verify_path, verify)

print('Applied market tooltip persistence implementation, design and regression coverage.')
