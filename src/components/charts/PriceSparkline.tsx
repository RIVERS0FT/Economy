import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { MarketHistoryBucket } from '../../utils/marketHistory';
import { formatMarketAxisTime, MARKET_BUCKET_MS, MARKET_WINDOW_MS } from '../../utils/marketHistory';
import { EconomyChart } from './EconomyChart';
import type { EChartsCoreOption, EChartsType } from './echartsCore';
import { chartColor, commonTooltip, escapeChartHtml } from './chartOptions';
import {
  chooseMarketPriceTickCount,
  chooseMarketTimeInterval,
  chooseMarketVolumeTickCount,
  resolveMarketBucketIndex,
  type MarketChartVariant,
} from './marketChartScale';

type IntegerAxisScale = {
  min: number;
  max: number;
  step: number;
  ticks: number[];
};

type MarketChartGeometry = {
  width: number;
  height: number;
  canvasHeight: number;
  top: number;
  left: number;
  right: number;
  priceBottom: number;
  volumeTop: number;
  volumeBottom: number;
  volumeShare: number;
  plotCenterX: number;
  timeLabelHeight: number;
};

const fullIntegerFormatter = new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 0 });
const compactVolumeFormatters = new Map<number, Intl.NumberFormat>();
const compactUnits = [
  { threshold: 1_000_000_000_000, suffix: 'T' },
  { threshold: 1_000_000_000, suffix: 'B' },
  { threshold: 1_000_000, suffix: 'M' },
  { threshold: 1_000, suffix: 'K' },

];

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

export function niceIntegerStep(roughStep: number) {
  if (!(roughStep > 1)) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(roughStep));
  const normalized = roughStep / magnitude;
  if (normalized <= 1) return magnitude;
  if (normalized <= 2) return 2 * magnitude;
  if (normalized <= 5) return 5 * magnitude;
  return 10 * magnitude;
}

function nextNiceIntegerStep(step: number) {
  const magnitude = 10 ** Math.floor(Math.log10(Math.max(1, step)));
  const normalized = step / magnitude;
  if (normalized < 2) return 2 * magnitude;
  if (normalized < 5) return 5 * magnitude;
  return 10 * magnitude;
}

export function buildIntegerPriceScale(rawMin: number, rawMax: number, tickCount: number): IntegerAxisScale {
  const safeTickCount = Math.max(2, Math.floor(tickCount));
  const intervals = safeTickCount - 1;
  const minValue = Math.max(0, Math.floor(Math.min(rawMin, rawMax)));
  const maxValue = Math.max(minValue, Math.ceil(Math.max(rawMin, rawMax)));

  if (minValue === maxValue) {
    const step = niceIntegerStep(Math.max(1, minValue) / Math.max(2, intervals));
    const lowerIntervals = Math.floor(intervals / 2);
    const min = Math.max(0, minValue - step * lowerIntervals);
    const max = min + step * intervals;
    return { min, max, step, ticks: Array.from({ length: safeTickCount }, (_, index) => max - index * step) };
  }

  let step = niceIntegerStep((maxValue - minValue) / Math.max(1, safeTickCount - 2));
  let min = Math.floor(minValue / step) * step;
  let max = min + step * intervals;
  while (max < maxValue) {
    step = nextNiceIntegerStep(step);
    min = Math.floor(minValue / step) * step;
    max = min + step * intervals;
  }
  return { min, max, step, ticks: Array.from({ length: safeTickCount }, (_, index) => max - index * step) };
}

export function buildIntegerVolumeScale(rawMax: number, tickCount: number): IntegerAxisScale {
  const safeTickCount = Math.max(2, Math.floor(tickCount));
  const intervals = safeTickCount - 1;
  const maxValue = Math.max(1, Math.ceil(rawMax));
  let step = niceIntegerStep(maxValue / intervals);
  while (step * intervals < maxValue) step = nextNiceIntegerStep(step);
  const max = step * intervals;
  return { min: 0, max, step, ticks: Array.from({ length: safeTickCount }, (_, index) => max - index * step) };
}

export function formatIntegerPriceTick(value: number) {
  const integer = Math.max(0, Math.round(value));
  const unit = compactUnits.find(({ threshold }) => integer >= threshold && integer % threshold === 0);
  return unit ? `${integer / unit.threshold}${unit.suffix}` : fullIntegerFormatter.format(integer);
}

export function formatCompactVolumeTick(value: number) {
  const integer = Math.max(0, Math.round(value));
  const unit = compactUnits.find(({ threshold }) => integer >= threshold);
  if (!unit) return fullIntegerFormatter.format(integer);
  const scaled = integer / unit.threshold;
  const maximumFractionDigits = Math.abs(scaled) >= 100 ? 0 : 1;
  let formatter = compactVolumeFormatters.get(maximumFractionDigits);
  if (!formatter) {
    formatter = new Intl.NumberFormat('zh-CN', { maximumFractionDigits });
    compactVolumeFormatters.set(maximumFractionDigits, formatter);
  }
  return `${formatter.format(scaled)}${unit.suffix}`;
}

function volumeColor(direction: MarketHistoryBucket['direction']) {
  if (direction === 'buy') return chartColor.success;
  if (direction === 'sell') return chartColor.danger;
  return chartColor.muted;
}

export function buildMarketChartGeometry(width: number, rootFontSize: number, variant: MarketChartVariant): MarketChartGeometry {
  const safeWidth = Math.max(1, width || 960);
  const scale = safeWidth / 960;
  const compact = variant === 'compact';
  const top = Math.max(compact ? 10 : 12, (compact ? 12 : 22) * scale);
  const left = Math.max(compact ? 58 : 68, rootFontSize * (compact ? 3.7 : 4.3));
  const right = Math.max(12, (compact ? 18 : 24) * scale);
  const priceHeight = Math.max(compact ? 72 : 112, (compact ? 78 : 208) * scale);
  const priceVolumeGap = 0;
  const minimumVolumeHeight = Math.max(48, rootFontSize * (compact ? 3 : 3.4));
  const ratioProtectedVolumeHeight = (0.22 / 0.78) * priceHeight;
  const preferredVolumeHeight = (compact ? 33 : 106) * scale;
  const volumeHeight = Math.max(preferredVolumeHeight, minimumVolumeHeight, ratioProtectedVolumeHeight);
  const timeLabelHeight = compact ? Math.max(28, rootFontSize * 1.8) : Math.max(52, rootFontSize * 3.2);
  const legendGap = 8;
  const legendHeight = Math.max(20, rootFontSize * 1.25);
  const legendTitleGap = 10;
  const titleHeight = Math.max(16, rootFontSize);
  const bottomSafeInset = 6;
  const priceBottom = top + priceHeight;
  const volumeTop = priceBottom + priceVolumeGap;
  const volumeBottom = volumeTop + volumeHeight;
  const footerHeight = legendGap + legendHeight + legendTitleGap + titleHeight + bottomSafeInset;
  const requiredCanvasHeight = volumeBottom + timeLabelHeight;
  const baseHeight = (compact ? 228 : 540) * scale;
  const height = Math.max(baseHeight, requiredCanvasHeight + footerHeight);
  const canvasHeight = height - footerHeight;
  const dataAreaHeight = priceHeight + volumeHeight;
  return {
    width: safeWidth,
    height,
    canvasHeight,
    top,
    left,
    right,
    priceBottom,
    volumeTop,
    volumeBottom,
    volumeShare: volumeHeight / Math.max(1, dataAreaHeight),
    plotCenterX: left + Math.max(1, safeWidth - left - right) / 2,
    timeLabelHeight,
  };
}

function useMarketChartWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [metrics, setMetrics] = useState({ width: 960, rootFontSize: 16 });
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return undefined;
    let frame: number | null = null;
    const update = () => {
      if (frame !== null) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        frame = null;
        const width = element.getBoundingClientRect().width;
        const rootFontSize = Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
        setMetrics((current) => (
          Math.abs(current.width - width) < 0.5 && Math.abs(current.rootFontSize - rootFontSize) < 0.1
            ? current
            : { width, rootFontSize }
        ));
      });
    };
    update();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update);
    observer?.observe(element);
    window.addEventListener('resize', update);
    void document.fonts?.ready.then(update);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', update);
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, []);
  return { ref, ...metrics };
}

function MarketHistoryChart({ buckets, variant }: { buckets: MarketHistoryBucket[]; variant: MarketChartVariant }) {
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

  const option = useMemo<EChartsCoreOption>(() => ({
    animation: false,
    aria: { enabled: true, description: '近二十四小时价格折线和成交量柱状图。绿色为净主动买入，红色为净主动卖出，灰色为方向未知。' },
    grid: [
      { id: 'market-price-grid', left: geometry.left, right: geometry.right, top: geometry.top, height: priceHeight },
      { id: 'market-volume-grid', left: geometry.left, right: geometry.right, top: geometry.volumeTop, height: volumeHeight },
    ],
    axisPointer: { link: [{ xAxisIndex: [0, 1] }] },
    tooltip: {
      ...commonTooltip,
      trigger: 'axis',
      triggerOn: 'mousemove|click',
      axisPointer: {
        type: 'line',
        snap: true,
        triggerEmphasis: false,
        lineStyle: MARKET_AXIS_POINTER_LINE_STYLE,
      },
      formatter: (params: any) => {
        const list = Array.isArray(params) ? params : [params];
        const axisValue = Number(list.find((item: any) => Number.isFinite(Number(item?.axisValue)))?.axisValue);
        const index = resolveMarketBucketIndex(axisValue, windowStart, safeBuckets.length, MARKET_BUCKET_MS);
        const bucket = safeBuckets[index];
        if (!bucket) return '';
        const sign = bucket.netVolume > 0 ? '+' : '';
        return `<strong>${escapeChartHtml(new Date(bucket.startAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }))}</strong>`
          + `<div><small>价格</small> ${escapeChartHtml(formatIntegerPriceTick(bucket.price))}</div>`
          + `<div><small>总成交量</small> ${escapeChartHtml(formatCompactVolumeTick(bucket.volume))}</div>`
          + `<div><small>主动买入</small> ${escapeChartHtml(formatCompactVolumeTick(bucket.buyVolume))}</div>`
          + `<div><small>主动卖出</small> ${escapeChartHtml(formatCompactVolumeTick(bucket.sellVolume))}</div>`
          + `<div><small>方向未知</small> ${escapeChartHtml(formatCompactVolumeTick(bucket.neutralVolume))}</div>`
          + `<div><small>净主动量</small> ${escapeChartHtml(`${sign}${fullIntegerFormatter.format(bucket.netVolume)}`)}</div>`;
      },
    },
    xAxis: [
      {
        id: 'market-price-time-axis', type: 'value', gridIndex: 0, min: windowStart, max: windowEnd, interval: axisInterval,
        axisLine: { show: false }, axisTick: { show: false }, axisLabel: { show: false },
        axisPointer: { show: true, snap: true, label: { show: false }, lineStyle: MARKET_AXIS_POINTER_LINE_STYLE },
        splitLine: { show: true, lineStyle: { color: chartColor.border } },
      },
      {
        id: 'market-volume-time-axis', type: 'value', gridIndex: 1, min: windowStart, max: windowEnd, interval: axisInterval,
        axisLine: { lineStyle: { color: chartColor.secondary } }, axisTick: { show: false },
        axisPointer: { show: true, snap: true, label: { show: false }, lineStyle: MARKET_AXIS_POINTER_LINE_STYLE },
        axisLabel: {
          color: chartColor.muted,
          fontSize: Math.max(11, rootFontSize * 0.75),
          rotate: variant === 'compact' ? 0 : 45,
          hideOverlap: true,
          margin: 10,
          formatter: (value: number) => formatMarketAxisTime(value),
        },
        splitLine: { show: true, lineStyle: { color: chartColor.border } },
      },
    ],
    yAxis: [
      {
        id: 'market-price-value-axis', type: 'value', gridIndex: 0, min: priceScale.min, max: priceScale.max, interval: priceScale.step,
        name: '价格', nameLocation: 'middle', nameRotate: 90, nameGap: geometry.left - 18,
        nameTextStyle: { color: chartColor.muted, fontSize: Math.max(11, rootFontSize * 0.75) },
        axisLine: { lineStyle: { color: chartColor.secondary } }, axisTick: { show: false },
        axisLabel: {
          color: chartColor.muted,
          fontSize: Math.max(11, rootFontSize * 0.75),
          showMinLabel: true,
          showMaxLabel: true,
          formatter: (value: number) => formatIntegerPriceTick(value),
        },
        splitLine: { lineStyle: { color: chartColor.border } },
      },
      {
        id: 'market-volume-value-axis', type: 'value', gridIndex: 1, min: 0, max: volumeScale.max, interval: volumeScale.step,
        name: '成交量', nameLocation: 'middle', nameRotate: 90, nameGap: geometry.left - 18,
        nameTextStyle: { color: chartColor.muted, fontSize: Math.max(11, rootFontSize * 0.75) },
        axisLine: { lineStyle: { color: chartColor.secondary } }, axisTick: { show: false },
        axisLabel: {
          color: chartColor.muted,
          fontSize: Math.max(11, rootFontSize * 0.75),
          showMinLabel: true,
          showMaxLabel: false,
          formatter: (value: number) => value === volumeScale.max ? '' : formatCompactVolumeTick(value),
        },
        splitLine: { lineStyle: { color: chartColor.border } },
      },
    ],
    series: [
      {
        id: 'market-price-series', name: '价格', type: 'line', xAxisIndex: 0, yAxisIndex: 0, showSymbol: false, symbol: 'none', smooth: false, z: 3,
        data: safeBuckets.map((bucket) => [bucket.startAt + MARKET_BUCKET_MS / 2, bucket.price]),
        lineStyle: { color: chartColor.success, width: 2.5, opacity: 1 },
        areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(123,228,158,.24)' }, { offset: 1, color: 'rgba(123,228,158,0)' }] } },
        emphasis: { disabled: true },
        blur: { lineStyle: { opacity: 1 }, areaStyle: { opacity: 1 } },
      },
      {
        id: 'market-volume-series', name: '成交量', type: 'bar', xAxisIndex: 1, yAxisIndex: 1, barWidth,
        data: safeBuckets.map((bucket) => ({ value: [bucket.startAt + MARKET_BUCKET_MS / 2, bucket.volume], direction: bucket.direction })),
        itemStyle: { color: (params: any) => volumeColor(params?.data?.direction), opacity: 0.78, borderRadius: [2, 2, 0, 0] },
        emphasis: { disabled: true },
      },
    ],
  }), [axisInterval, barWidth, geometry, priceHeight, priceScale, rootFontSize, safeBuckets, variant, volumeHeight, volumeScale, windowEnd, windowStart]);

  return (
    <div
      ref={ref}
      className={`price-chart market-history-chart ${variant}`}
      role="img"
      aria-label="近 24 小时价格、成交量与主动买卖方向趋势图"
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      data-chart-variant={variant}
      data-axis-left={geometry.left.toFixed(2)}
      data-axis-right={geometry.right.toFixed(2)}
      data-price-top={geometry.top.toFixed(2)}
      data-price-bottom={geometry.priceBottom.toFixed(2)}
      data-volume-top={geometry.volumeTop.toFixed(2)}
      data-volume-bottom={geometry.volumeBottom.toFixed(2)}
      data-volume-share={geometry.volumeShare.toFixed(4)}
      data-chart-height={geometry.height.toFixed(2)}
      data-plot-center-x={geometry.plotCenterX.toFixed(2)}
      data-time-label-height={geometry.timeLabelHeight.toFixed(2)}
      data-time-axis-interval={axisInterval}
      data-price-tick-count={priceTickCount}
      data-volume-tick-count={volumeTickCount}
      data-axis-pointer-linked="true"
      data-hover-emphasis-disabled="true"
      data-tooltip-persistence="true"
      data-shared-boundary-label-owner="price"
      data-price-min-label={priceBoundaryLabel}
      data-volume-max-label={volumeBoundaryLabel}
      data-volume-max-label-visible="false"
      data-price-ticks={priceScale.ticks.join(',')}
      data-volume-ticks={volumeScale.ticks.join(',')}
      style={{ height: geometry.height }}
    >
      <EconomyChart
        option={option}
        className="market-history-echart"
        style={{ height: geometry.canvasHeight }}
        ariaLabel="近 24 小时价格、成交量与主动买卖方向趋势图"
        accessibleSummary={safeBuckets.map((bucket) => `${formatMarketAxisTime(bucket.startAt)}价格${formatIntegerPriceTick(bucket.price)}成交量${formatCompactVolumeTick(bucket.volume)}`).join('；')}
        updateMode="merge"
        onChartReady={handleChartReady}
        onOptionApplied={restoreActiveTooltip}
      />
      <div
        className="market-chart-price-volume-divider"
        style={{ top: geometry.priceBottom, left: geometry.left, right: geometry.right }}
        aria-hidden="true"
      />
      <div className="market-chart-footer" style={{ paddingLeft: geometry.left, paddingRight: geometry.right }}>
        <div className="market-chart-legend" aria-label="主动买卖方向图例">
          <span className="market-chart-legend-item buy"><i />净主动买入</span>
          <span className="market-chart-legend-item sell"><i />净主动卖出</span>
        </div>
        <div className="market-chart-x-axis-title">时间</div>
      </div>
    </div>
  );
}

export function PriceSparkline({ buckets, variant = 'full' }: { buckets: MarketHistoryBucket[]; variant?: MarketChartVariant }) {
  return <MarketHistoryChart buckets={buckets} variant={variant} />;
}
