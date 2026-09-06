import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { MarketHistoryBucket } from '../../utils/marketHistory';
import { formatMarketAxisTime, MARKET_BUCKET_MS, MARKET_WINDOW_MS } from '../../utils/marketHistory';
import { formatCompactNumber, formatCurrency } from '../../utils/formatters';
import { EconomyChart } from './EconomyChart';
import { syncEChartsTooltipCoordinates, type EChartsCoreOption, type EChartsType } from './echartsCore';
import { STABLE_TOOLTIP_EMPHASIS, chartColor, commonTooltip, escapeChartHtml } from './chartOptions';
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
  showXAxisTitle: boolean;
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
  type: [4, 4],
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

function expandScaleToMinimumTicks(min: number, max: number, step: number, rawMin: number, rawMax: number) {
  let expandedMin = min;
  let expandedMax = max;
  let tickTotal = Math.round((expandedMax - expandedMin) / step) + 1;
  while (tickTotal < 3) {
    const lowerPadding = rawMin - (expandedMin - step);
    const upperPadding = (expandedMax + step) - rawMax;
    if (expandedMin >= step && lowerPadding <= upperPadding) expandedMin -= step;
    else expandedMax += step;
    tickTotal += 1;
  }
  return { min: expandedMin, max: expandedMax, tickTotal };
}

export function buildIntegerPriceScale(rawMin: number, rawMax: number, tickCount: number): IntegerAxisScale {
  const safeTickCount = Math.min(7, Math.max(3, Math.floor(tickCount)));
  const lowerValue = Math.max(0, Math.min(rawMin, rawMax));
  const upperValue = Math.max(lowerValue, Math.max(rawMin, rawMax));
  const integerCenter = Math.max(0, Math.round((lowerValue + upperValue) / 2));

  if (Math.abs(upperValue - lowerValue) < Number.EPSILON) {
    const step = niceIntegerStep(Math.max(1, Math.abs(integerCenter) * 0.02));
    const lowerIntervals = Math.floor((safeTickCount - 1) / 2);
    const min = Math.max(0, integerCenter - step * lowerIntervals);
    const max = min + step * (safeTickCount - 1);
    return { min, max, step, ticks: Array.from({ length: safeTickCount }, (_, index) => max - index * step) };
  }

  const candidates: Array<IntegerAxisScale & { padding: number; tickPenalty: number }> = [];
  const rawRange = Math.max(1, upperValue - lowerValue);
  const baseExponent = Math.floor(Math.log10(rawRange));
  for (let exponent = Math.max(0, baseExponent - 3); exponent <= baseExponent + 3; exponent += 1) {
    const magnitude = 10 ** exponent;
    for (const multiplier of [1, 2, 5] as const) {
      const step = multiplier * magnitude;
      let min = Math.max(0, Math.floor(lowerValue / step) * step);
      let max = Math.ceil(upperValue / step) * step;
      const expanded = expandScaleToMinimumTicks(min, max, step, lowerValue, upperValue);
      min = expanded.min;
      max = expanded.max;
      const tickTotal = expanded.tickTotal;
      if (tickTotal > 7) continue;
      const padding = (lowerValue - min) + (max - upperValue);
      candidates.push({
        min,
        max,
        step,
        ticks: Array.from({ length: tickTotal }, (_, index) => max - index * step),
        padding,
        tickPenalty: Math.abs(tickTotal - safeTickCount),
      });
    }
  }

  const selected = candidates.sort((left, right) => (
    left.padding - right.padding
    || left.tickPenalty - right.tickPenalty
    || left.step - right.step
  ))[0];
  if (selected) return { min: selected.min, max: selected.max, step: selected.step, ticks: selected.ticks };

  const step = niceIntegerStep(rawRange / Math.max(1, safeTickCount - 1));
  const min = Math.max(0, Math.floor(lowerValue / step) * step);
  const max = Math.ceil(upperValue / step) * step;
  const tickTotal = Math.round((max - min) / step) + 1;
  return { min, max, step, ticks: Array.from({ length: tickTotal }, (_, index) => max - index * step) };
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

function buildEdgeAlignedAxisLabelRich(fontSize: number) {
  const shared = { color: chartColor.secondary, fontSize, lineHeight: fontSize };
  return {
    top: { ...shared, padding: [fontSize, 0, 0, 0] },
    middle: shared,
    bottom: { ...shared, padding: [0, 0, fontSize, 0] },
  };
}

function formatEdgeAlignedAxisLabel(
  value: number,
  min: number,
  max: number,
  formatter: (value: number) => string,
) {
  const text = formatter(value);
  if (value === max) return `{top|${text}}`;
  if (value === min) return `{bottom|${text}}`;
  return `{middle|${text}}`;
}

function volumeColor(direction: MarketHistoryBucket['direction']) {
  if (direction === 'buy') return chartColor.success;
  if (direction === 'sell') return chartColor.danger;
  return chartColor.muted;
}

export function buildMarketChartGeometry(
  width: number,
  rootFontSize: number,
  variant: MarketChartVariant,
  minimumHeight = 0,
): MarketChartGeometry {
  const safeWidth = Math.max(1, width || 960);
  const scale = safeWidth / 960;
  const compact = variant === 'compact';
  const showXAxisTitle = !compact && safeWidth > 720;
  const timeAxisFontSize = Math.max(11, rootFontSize * 0.75);
  const plotInset = Math.max(compact ? 8 : 10, rootFontSize * (compact ? 0.45 : 0.55));
  const top = Math.max(compact ? 6 : 8, (compact ? 8 : 12) * scale);
  const left = plotInset;
  const right = plotInset;
  let priceHeight = Math.max(compact ? 72 : 112, (compact ? 78 : 208) * scale);
  const priceVolumeGap = 0;
  const minimumVolumeHeight = compact
    ? Math.max(48, rootFontSize * 3)
    : Math.max(68, rootFontSize * 4.25);
  const ratioProtectedVolumeHeight = (0.22 / 0.78) * priceHeight;
  const preferredVolumeHeight = (compact ? 33 : 106) * scale;
  let volumeHeight = Math.max(preferredVolumeHeight, minimumVolumeHeight, ratioProtectedVolumeHeight);
  const timeLabelHeight = Math.max(compact ? 20 : 24, timeAxisFontSize + 10);
  const titleGap = showXAxisTitle ? 8 : 0;
  const titleHeight = showXAxisTitle ? Math.max(16, rootFontSize) : 0;
  const bottomSafeInset = 6;
  const footerHeight = titleGap + titleHeight + bottomSafeInset;
  const baseHeight = (compact ? 228 : 540) * scale;
  const naturalHeight = top + priceHeight + priceVolumeGap + volumeHeight + timeLabelHeight + footerHeight;
  const height = Math.max(baseHeight, naturalHeight, minimumHeight);
  const extraDataHeight = Math.max(0, height - naturalHeight);
  priceHeight += extraDataHeight * 0.72;
  volumeHeight += extraDataHeight * 0.28;
  const priceBottom = top + priceHeight;
  const volumeTop = priceBottom + priceVolumeGap;
  const volumeBottom = volumeTop + volumeHeight;
  const canvasHeight = volumeBottom + timeLabelHeight;
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
    showXAxisTitle,
  };
}

function useMarketChartMetrics() {
  const ref = useRef<HTMLDivElement>(null);
  const [metrics, setMetrics] = useState({ width: 960, rootFontSize: 16, minimumHeight: 0 });
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return undefined;
    const chartCard = element.closest<HTMLElement>('.market-chart-card');
    const tradeCard = chartCard?.parentElement?.querySelector<HTMLElement>('.market-trade-card') ?? null;
    let frame: number | null = null;
    const update = () => {
      if (frame !== null) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        frame = null;
        const elementRect = element.getBoundingClientRect();
        const chartCardRect = chartCard?.getBoundingClientRect();
        const tradeCardRect = tradeCard?.getBoundingClientRect();
        const sideBySide = Boolean(
          chartCardRect
          && tradeCardRect
          && Math.abs(chartCardRect.top - tradeCardRect.top) < 3
          && chartCardRect.left > tradeCardRect.left + tradeCardRect.width - 3
        );
        const chartCardStyle = chartCard ? getComputedStyle(chartCard) : null;
        const cardPaddingBottom = chartCardStyle
          ? Number.parseFloat(chartCardStyle.paddingBottom) || 0
          : 0;
        const cardContentBottom = chartCard && chartCardRect
          ? chartCardRect.top + chartCard.clientTop + chartCard.clientHeight - cardPaddingBottom
          : 0;
        const minimumHeight = sideBySide
          ? Math.max(0, cardContentBottom - elementRect.top)
          : 0;
        const width = elementRect.width;
        const rootFontSize = Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
        setMetrics((current) => (
          Math.abs(current.width - width) < 0.5
          && Math.abs(current.rootFontSize - rootFontSize) < 0.1
          && Math.abs(current.minimumHeight - minimumHeight) < 0.5
            ? current
            : { width, rootFontSize, minimumHeight }
        ));
      });
    };
    update();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update);
    if (chartCard) observer?.observe(chartCard);
    if (tradeCard) observer?.observe(tradeCard);
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
  const { ref, width, rootFontSize, minimumHeight } = useMarketChartMetrics();
  const geometry = useMemo(
    () => buildMarketChartGeometry(width, rootFontSize, variant, minimumHeight),
    [minimumHeight, rootFontSize, variant, width],
  );
  const priceHeight = geometry.priceBottom - geometry.top;
  const volumeHeight = geometry.volumeBottom - geometry.volumeTop;
  const priceTickCount = chooseMarketPriceTickCount(priceHeight, rootFontSize);
  const volumeTickCount = chooseMarketVolumeTickCount(volumeHeight, rootFontSize, variant);
  const priceScale = useMemo(() => buildIntegerPriceScale(
    Math.min(...safeBuckets.map((bucket) => bucket.price)),
    Math.max(...safeBuckets.map((bucket) => bucket.price)),
    priceTickCount,
  ), [priceTickCount, safeBuckets]);
  const volumeScale = useMemo(() => buildIntegerVolumeScale(
    Math.max(1, ...safeBuckets.map((bucket) => bucket.volume)),
    volumeTickCount,
  ), [safeBuckets, volumeTickCount]);
  const plotWidth = Math.max(1, geometry.width - geometry.left - geometry.right);
  const priceTopLabel = formatIntegerPriceTick(priceScale.max);
  const priceBoundaryLabel = formatIntegerPriceTick(priceScale.min);
  const volumeBoundaryLabel = formatCompactVolumeTick(volumeScale.max);
  const volumeBottomLabel = formatCompactVolumeTick(volumeScale.min);
  const visibleVolumeTicks = volumeScale.ticks.filter((value) => value !== volumeScale.max);
  const hasVisibleNonZeroVolumeTick = visibleVolumeTicks.some((value) => value > 0);
  const windowStart = safeBuckets[0].startAt;
  const windowEnd = windowStart + MARKET_WINDOW_MS;
  const axisInterval = chooseMarketTimeInterval(plotWidth, rootFontSize, variant, MARKET_WINDOW_MS);
  const barWidth = Math.max(1, (plotWidth / safeBuckets.length) * 0.74);
  const chartInstanceRef = useRef<EChartsType | null>(null);
  const pointerInsideRef = useRef(false);
  const pointerRatioRef = useRef<number | null>(null);
  const pointerTypeRef = useRef('mouse');
  const bucketCountRef = useRef(safeBuckets.length);
  const restoreFrameRef = useRef<number | null>(null);
  const interactionGeometryRef = useRef({ windowStart, top: geometry.top, priceBottom: geometry.priceBottom });
  bucketCountRef.current = safeBuckets.length;
  interactionGeometryRef.current = { windowStart, top: geometry.top, priceBottom: geometry.priceBottom };

  const hideActiveTooltip = useCallback(() => {
    pointerInsideRef.current = false;
    pointerRatioRef.current = null;
    if (restoreFrameRef.current !== null) cancelAnimationFrame(restoreFrameRef.current);
    restoreFrameRef.current = null;
    const chartInstance = chartInstanceRef.current;
    if (!chartInstance || chartInstance.isDisposed()) return;
    chartInstance.dispatchAction({ type: 'updateAxisPointer', currTrigger: 'leave' });
    chartInstance.dispatchAction({ type: 'hideTip' });
  }, []);

  const scheduleActiveTooltip = useCallback((chartInstance: EChartsType | null = chartInstanceRef.current) => {
    if (restoreFrameRef.current !== null) cancelAnimationFrame(restoreFrameRef.current);
    restoreFrameRef.current = null;
    if (!chartInstance || !pointerInsideRef.current || pointerRatioRef.current === null) return;
    restoreFrameRef.current = requestAnimationFrame(() => {
      restoreFrameRef.current = null;
      if (chartInstance.isDisposed() || !pointerInsideRef.current || pointerRatioRef.current === null) return;
      const dataIndex = Math.min(bucketCountRef.current - 1,
        Math.floor(pointerRatioRef.current * bucketCountRef.current));
      syncEChartsTooltipCoordinates(chartInstance);
      const metrics = interactionGeometryRef.current;
      const value = metrics.windowStart + (dataIndex + 0.5) * MARKET_BUCKET_MS;
      const x = Number(chartInstance.convertToPixel({ xAxisIndex: 0 }, value));
      if (!Number.isFinite(x)) return;
      // Trigger only the price axis from its interior, even when the price point lies
      // on the shared boundary. ECharts links the volume pointer and one HTML tooltip.
      chartInstance.dispatchAction({
        type: 'updateAxisPointer', x, y: (metrics.top + metrics.priceBottom) / 2,
        axesInfo: [{ axisDim: 'x', axisIndex: 0, value }],
      });
    });
  }, []);

  const handleChartReady = useCallback((chartInstance: EChartsType) => {
    chartInstanceRef.current = chartInstance;
    scheduleActiveTooltip(chartInstance);
  }, [scheduleActiveTooltip]);

  const restoreActiveTooltip = useCallback((chartInstance: EChartsType) => {
    scheduleActiveTooltip(chartInstance);
  }, [scheduleActiveTooltip]);

  const handlePointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const pointerX = event.clientX - bounds.left;
    const pointerY = event.clientY - bounds.top;
    const insideDataArea = pointerX >= geometry.left
      && pointerX <= geometry.width - geometry.right
      && pointerY >= geometry.top && pointerY <= geometry.volumeBottom;
    if (!insideDataArea) { hideActiveTooltip(); return; }
    pointerInsideRef.current = true;
    pointerTypeRef.current = event.pointerType;
    pointerRatioRef.current = Math.min(1, Math.max(0, (pointerX - geometry.left) / plotWidth));
    scheduleActiveTooltip();
  }, [geometry.left, geometry.right, geometry.top, geometry.volumeBottom, geometry.width, plotWidth, hideActiveTooltip, scheduleActiveTooltip]);

  const handlePointerLeave = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    // Touch produces pointerleave on lift; keep the selected day until outside tap or scroll.
    if (event.pointerType === 'mouse') hideActiveTooltip();
  }, [hideActiveTooltip]);

  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !ref.current?.contains(event.target)) hideActiveTooltip();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !pointerInsideRef.current) return;
      event.preventDefault();
      event.stopPropagation();
      hideActiveTooltip();
    };
    const scroll = (event: Event) => {
      if (pointerTypeRef.current !== 'mouse' && event.target instanceof Node
        && event.target.contains(ref.current)) hideActiveTooltip();
    };
    document.addEventListener('pointerdown', outside, true);
    document.addEventListener('keydown', escape, true);
    document.addEventListener('scroll', scroll, true);
    return () => {
      document.removeEventListener('pointerdown', outside, true);
      document.removeEventListener('keydown', escape, true);
      document.removeEventListener('scroll', scroll, true);
      if (restoreFrameRef.current !== null) cancelAnimationFrame(restoreFrameRef.current);
      pointerInsideRef.current = false;
      chartInstanceRef.current = null;
    };
  }, [hideActiveTooltip, ref]);

  const option = useMemo<EChartsCoreOption>(() => ({
    animation: false,
    aria: { enabled: true, description: '近三十天价格折线和成交量柱状图。蓝色为价格，成交量柱按当日净主动方向着色。' },
    grid: [
      { id: 'market-price-grid', outerBoundsMode: 'none', left: geometry.left, right: geometry.right, top: geometry.top, height: priceHeight },
      { id: 'market-volume-grid', outerBoundsMode: 'none', left: geometry.left, right: geometry.right, top: geometry.volumeTop, height: volumeHeight },
    ],
    axisPointer: { link: [{ xAxisIndex: [0, 1] }], triggerOn: 'none', animation: false },
    tooltip: {
      ...commonTooltip,
      trigger: 'axis',
      triggerOn: 'none',
      transitionDuration: 0,
      hideDelay: 0,
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
        const netVolumeText = `${bucket.netVolume > 0 ? '+' : ''}${formatCompactNumber(bucket.netVolume)}`;
        return `<strong>${escapeChartHtml(new Date(bucket.startAt).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit', timeZone: 'Asia/Shanghai' }))}</strong>`
          + `<div><small>价格</small> ${escapeChartHtml(formatCurrency(bucket.price))}</div>`
          + `<div><small>总成交量</small> ${escapeChartHtml(formatCompactVolumeTick(bucket.volume))}</div>`
          + `<div><small>主动买入</small> ${escapeChartHtml(formatCompactVolumeTick(bucket.buyVolume))}</div>`
          + `<div><small>主动卖出</small> ${escapeChartHtml(formatCompactVolumeTick(bucket.sellVolume))}</div>`
          + `<div><small>方向未知</small> ${escapeChartHtml(formatCompactVolumeTick(bucket.neutralVolume))}</div>`
          + `<div><small>净主动量</small> ${escapeChartHtml(netVolumeText)}</div>`;
      },
    },
    xAxis: [
      {
        id: 'market-price-time-axis', type: 'value', containShape: false, gridIndex: 0, min: windowStart, max: windowEnd, interval: axisInterval,
        axisLine: { show: false }, axisTick: { show: false }, axisLabel: { show: false },
        axisPointer: { show: true, snap: true, animation: false, label: { show: false }, lineStyle: MARKET_AXIS_POINTER_LINE_STYLE },
        splitLine: { show: true, lineStyle: { color: chartColor.border } },
      },
      {
        id: 'market-volume-time-axis', type: 'value', containShape: false, gridIndex: 1, min: windowStart, max: windowEnd, interval: axisInterval,
        axisLine: { lineStyle: { color: chartColor.secondary } }, axisTick: { show: false },
        axisPointer: { show: true, snap: true, animation: false, label: { show: false }, lineStyle: { ...MARKET_AXIS_POINTER_LINE_STYLE, dashOffset: -volumeHeight % 8 } },
        axisLabel: {
          color: chartColor.secondary,
          fontSize: Math.max(11, rootFontSize * 0.75),
          rotate: 0,
          hideOverlap: true,
          showMinLabel: true,
          showMaxLabel: true,
          alignMinLabel: 'left',
          alignMaxLabel: 'right',
          margin: 6,
          formatter: (value: number) => formatMarketAxisTime(value),
        },
        splitLine: { show: true, lineStyle: { color: chartColor.border } },
      },
    ],
    yAxis: [
      {
        id: 'market-price-value-axis', type: 'value', gridIndex: 0, min: priceScale.min, max: priceScale.max, interval: priceScale.step,
        axisLine: { lineStyle: { color: chartColor.secondary } }, axisTick: { show: false },
        axisLabel: {
          color: chartColor.secondary,
          fontSize: Math.max(11, rootFontSize * 0.75),
          inside: true,
          align: 'left',
          margin: 6,
          showMinLabel: true,
          showMaxLabel: true,
          rich: buildEdgeAlignedAxisLabelRich(Math.max(11, rootFontSize * 0.75)),
          formatter: (value: number) => formatEdgeAlignedAxisLabel(
            value,
            priceScale.min,
            priceScale.max,
            formatIntegerPriceTick,
          ),
        },
        splitLine: { lineStyle: { color: chartColor.border } },
      },
      {
        id: 'market-volume-value-axis', type: 'value', gridIndex: 1, min: 0, max: volumeScale.max, interval: volumeScale.step,
        axisLine: { lineStyle: { color: chartColor.secondary } }, axisTick: { show: false },
        axisLabel: {
          color: chartColor.secondary,
          fontSize: Math.max(11, rootFontSize * 0.75),
          inside: true,
          align: 'left',
          margin: 6,
          showMinLabel: true,
          showMaxLabel: true,
          rich: buildEdgeAlignedAxisLabelRich(Math.max(11, rootFontSize * 0.75)),
          formatter: (value: number) => formatEdgeAlignedAxisLabel(
            value,
            volumeScale.min,
            volumeScale.max,
            formatCompactVolumeTick,
          ),
        },
        splitLine: { lineStyle: { color: chartColor.border } },
      },
    ],
    series: [
      {
        id: 'market-price-series', name: '价格', type: 'line', xAxisIndex: 0, yAxisIndex: 0, showSymbol: false, symbol: 'none', smooth: false, z: 3,
        data: safeBuckets.map((bucket) => [bucket.startAt + MARKET_BUCKET_MS / 2, bucket.price]),
        lineStyle: { color: chartColor.info, width: 2.5, opacity: 1 },
        areaStyle: { color: chartColor.info, opacity: 0.16 },
        emphasis: STABLE_TOOLTIP_EMPHASIS,
        blur: { lineStyle: { opacity: 1 }, areaStyle: { opacity: 0.16 } },
      },
      {
        id: 'market-volume-series', name: '成交量', type: 'bar', xAxisIndex: 1, yAxisIndex: 1, barWidth, barMinHeight: 2,
        data: safeBuckets.map((bucket) => ({ value: [bucket.startAt + MARKET_BUCKET_MS / 2, bucket.volume], direction: bucket.direction })),
        itemStyle: { color: (params: any) => volumeColor(params?.data?.direction), opacity: 0.78, borderRadius: [2, 2, 0, 0] },
        emphasis: STABLE_TOOLTIP_EMPHASIS,
      },
    ],
  }), [axisInterval, barWidth, geometry, priceHeight, priceScale, rootFontSize, safeBuckets, variant, volumeHeight, volumeScale, windowEnd, windowStart]);

  return (
    <div
      ref={ref}
      className={`price-chart market-history-chart ${variant}`}
      role="img"
      aria-label="近 30 天价格、成交量与主动买卖方向趋势图"
      onPointerDown={handlePointerMove}
      onPointerMove={handlePointerMove}
      onPointerCancel={hideActiveTooltip}
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
      data-chart-fill-mode={minimumHeight > 0 ? 'row' : 'natural'}
      data-chart-minimum-height={minimumHeight.toFixed(2)}
      data-plot-center-x={geometry.plotCenterX.toFixed(2)}
      data-time-label-height={geometry.timeLabelHeight.toFixed(2)}
      data-time-axis-interval={axisInterval}
      data-price-tick-count={priceScale.ticks.length}
      data-volume-tick-count={volumeScale.ticks.length}
      data-axis-pointer-linked="true"
      data-hover-emphasis-disabled="true"
      data-tooltip-persistence="true"
      data-shared-boundary-label-layout="split-edge"
      data-y-axis-edge-labels-aligned="true"
      data-price-max-label={priceTopLabel}
      data-price-min-label={priceBoundaryLabel}
      data-volume-max-label={volumeBoundaryLabel}
      data-volume-min-label={volumeBottomLabel}
      data-volume-max-label-visible="true"
      data-volume-nonzero-label-visible={hasVisibleNonZeroVolumeTick ? 'true' : 'false'}
      data-price-color-role="info"
      data-y-axis-labels-inside="true"
      data-x-axis-title-visible={geometry.showXAxisTitle ? 'true' : 'false'}
      data-price-ticks={priceScale.ticks.join(',')}
      data-volume-ticks={volumeScale.ticks.join(',')}
      style={{ height: geometry.height, touchAction: 'pan-y pinch-zoom' }}
    >
      <EconomyChart
        option={option}
        lazyUpdate={false}
        className="market-history-echart"
        style={{ height: geometry.canvasHeight }}
        ariaLabel="近 30 天价格、成交量与主动买卖方向趋势图"
        accessibleSummary={safeBuckets.map((bucket) => `${formatMarketAxisTime(bucket.startAt)}价格${formatCurrency(bucket.price)}成交量${formatCompactVolumeTick(bucket.volume)}`).join('；')}
        updateMode="merge"
        onChartReady={handleChartReady}
        onOptionApplied={restoreActiveTooltip}
        onResize={restoreActiveTooltip}
      />
      <div
        className="market-chart-price-volume-divider"
        style={{ top: geometry.priceBottom, left: geometry.left, right: geometry.right }}
        aria-hidden="true"
      />
      {geometry.showXAxisTitle ? (
        <div className="market-chart-footer" style={{ paddingLeft: geometry.left, paddingRight: geometry.right }}>
          <div className="market-chart-x-axis-title">日期</div>
        </div>
      ) : null}
    </div>
  );
}

export function PriceSparkline({ buckets, variant = 'full' }: { buckets: MarketHistoryBucket[]; variant?: MarketChartVariant }) {
  return <MarketHistoryChart buckets={buckets} variant={variant} />;
}