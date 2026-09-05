import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { formatCurrency } from '../../utils/formatters';
import type { MarketHistoryBucket } from '../../utils/marketHistory';
import { formatMarketAxisTime, MARKET_BUCKET_MS, MARKET_WINDOW_MS } from '../../utils/marketHistory';
import { EconomyChart } from './EconomyChart';
import type { EChartsCoreOption, EChartsType } from './echartsCore';
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
  mobileAxisTitles: boolean;
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
  cap: 'butt' as const,
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

function volumeColor(direction: MarketHistoryBucket['direction']) {
  if (direction === 'buy') return chartColor.success;
  if (direction === 'sell') return chartColor.danger;
  return chartColor.muted;
}

function estimateMarketAxisLabelWidth(labels: string[], rootFontSize: number) {
  return labels.reduce((widest, label) => {
    const width = Array.from(label).reduce((total, character) => {
      if (/\d/.test(character)) return total + rootFontSize * 0.58;
      if (/[.,+-]/.test(character)) return total + rootFontSize * 0.34;
      return total + rootFontSize * 0.66;
    }, 0);
    return Math.max(widest, width);
  }, 0);
}

export function buildMarketChartGeometry(
  width: number,
  rootFontSize: number,
  variant: MarketChartVariant,
  axisLabelWidth = 0,
  minimumHeight = 0,
): MarketChartGeometry {
  const safeWidth = Math.max(1, width || 960);
  const scale = safeWidth / 960;
  const compact = variant === 'compact';
  const mobileAxisTitles = safeWidth <= 720;
  const showXAxisTitle = !compact && !mobileAxisTitles;
  const top = Math.max(compact ? 10 : 12, (compact ? 12 : 22) * scale);
  const left = mobileAxisTitles
    ? Math.max(compact ? 42 : 46, axisLabelWidth + 10)
    : Math.max(compact ? 58 : 68, rootFontSize * (compact ? 3.7 : 4.3), axisLabelWidth + rootFontSize * 2.1);
  const right = Math.max(12, (compact ? 18 : 24) * scale);
  let priceHeight = Math.max(compact ? 72 : 112, (compact ? 78 : 208) * scale);
  const priceVolumeGap = 0;
  const minimumVolumeHeight = compact
    ? Math.max(48, rootFontSize * 3)
    : Math.max(68, rootFontSize * 4.25);
  const ratioProtectedVolumeHeight = (0.22 / 0.78) * priceHeight;
  const preferredVolumeHeight = (compact ? 33 : 106) * scale;
  let volumeHeight = Math.max(preferredVolumeHeight, minimumVolumeHeight, ratioProtectedVolumeHeight);
  const timeLabelHeight = compact ? Math.max(26, rootFontSize * 1.7) : Math.max(44, rootFontSize * 2.75);
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
    mobileAxisTitles,
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
  const baseGeometry = useMemo(
    () => buildMarketChartGeometry(width, rootFontSize, variant, 0, minimumHeight),
    [minimumHeight, rootFontSize, variant, width],
  );
  const priceHeight = baseGeometry.priceBottom - baseGeometry.top;
  const volumeHeight = baseGeometry.volumeBottom - baseGeometry.volumeTop;
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
  const axisLabelWidth = useMemo(() => estimateMarketAxisLabelWidth([
    ...priceScale.ticks.map(formatIntegerPriceTick),
    ...volumeScale.ticks.slice(1).map(formatCompactVolumeTick),
  ], rootFontSize), [priceScale.ticks, rootFontSize, volumeScale.ticks]);
  const geometry = useMemo(
    () => buildMarketChartGeometry(width, rootFontSize, variant, axisLabelWidth, minimumHeight),
    [axisLabelWidth, minimumHeight, rootFontSize, variant, width],
  );
  const plotWidth = Math.max(1, geometry.width - geometry.left - geometry.right);
  const priceBoundaryLabel = formatIntegerPriceTick(priceScale.min);
  const volumeBoundaryLabel = formatCompactVolumeTick(volumeScale.max);
  const visibleVolumeTicks = volumeScale.ticks.filter((value) => value !== volumeScale.max);
  const hasVisibleNonZeroVolumeTick = visibleVolumeTicks.some((value) => value > 0);
  const windowStart = safeBuckets[0].startAt;
  const windowEnd = windowStart + MARKET_WINDOW_MS;
  const axisInterval = chooseMarketTimeInterval(plotWidth, rootFontSize, variant, MARKET_WINDOW_MS);
  const barWidth = Math.max(1, (plotWidth / safeBuckets.length) * 0.74);
  const chartInstanceRef = useRef<EChartsType | null>(null);
  const pointerInsideRef = useRef(false);
  const hoveredBucketIndexRef = useRef<number | null>(null);
  const activePointerRef = useRef<{ x: number; y: number; touch: boolean } | null>(null);
  const restoreFrameRef = useRef<number | null>(null);
  const interactionRef = useRef({ geometry, plotWidth, safeBuckets, windowStart });
  interactionRef.current = { geometry, plotWidth, safeBuckets, windowStart };

  const hideActiveTooltip = useCallback(() => {
    pointerInsideRef.current = false;
    hoveredBucketIndexRef.current = null;
    activePointerRef.current = null;
    if (restoreFrameRef.current !== null) cancelAnimationFrame(restoreFrameRef.current);
    restoreFrameRef.current = null;
    const chart = chartInstanceRef.current;
    if (chart && !chart.isDisposed()) {
      chart.dispatchAction({ type: 'updateAxisPointer', currTrigger: 'leave' });
      chart.dispatchAction({ type: 'hideTip' });
    }
    if (ref.current) {
      delete ref.current.dataset.activeBucketIndex;
      delete ref.current.dataset.activeAxisValue;
      delete ref.current.dataset.pricePointerX;
      delete ref.current.dataset.volumePointerX;
    }
  }, [ref]);

  const scheduleActiveTooltip = useCallback((chartInstance: EChartsType | null = chartInstanceRef.current) => {
    if (restoreFrameRef.current !== null) cancelAnimationFrame(restoreFrameRef.current);
    restoreFrameRef.current = null;
    if (!chartInstance || !pointerInsideRef.current || !activePointerRef.current) return;
    restoreFrameRef.current = requestAnimationFrame(() => {
      restoreFrameRef.current = null;
      const pointer = activePointerRef.current;
      const element = ref.current;
      if (!pointerInsideRef.current || !pointer || !element || chartInstance.isDisposed()) return;
      const current = interactionRef.current;
      const bounds = element.getBoundingClientRect();
      const pointerX = pointer.x - bounds.left;
      const pointerY = pointer.y - bounds.top;
      if (pointerX < current.geometry.left || pointerX > current.geometry.width - current.geometry.right
        || pointerY < current.geometry.top || pointerY > current.geometry.volumeBottom) {
        hideActiveTooltip();
        return;
      }
      const ratio = Math.min(1, Math.max(0, (pointerX - current.geometry.left) / current.plotWidth));
      const dataIndex = resolveMarketBucketIndex(current.windowStart + ratio * MARKET_WINDOW_MS,
        current.windowStart, current.safeBuckets.length, MARKET_BUCKET_MS);
      hoveredBucketIndexRef.current = dataIndex;
      const axisValue = current.safeBuckets[dataIndex].startAt + MARKET_BUCKET_MS / 2;
      // One manual action drives both linked axes and the sole tooltip. Native
      // mouse/click handlers are disabled, so neither Grid can race this selection.
      const axisIndex = pointerY >= current.geometry.volumeTop ? 1 : 0;
      const top = axisIndex === 0 ? current.geometry.top : current.geometry.volumeTop;
      const bottom = axisIndex === 0 ? current.geometry.priceBottom : current.geometry.volumeBottom;
      // Trigger inside the hovered Grid rather than at the series' y-value: a
      // price at the min/max boundary must not hide the tooltip after refresh.
      chartInstance.dispatchAction({
        type: 'updateAxisPointer',
        x: Number(chartInstance.convertToPixel({ xAxisIndex: axisIndex }, axisValue)),
        y: Math.max(top + 1, Math.min(bottom - 1, pointerY)),
        axesInfo: [{ axisDim: 'x', axisIndex, value: axisValue }],
      });
      element.dataset.activeBucketIndex = String(dataIndex);
      element.dataset.activeAxisValue = String(axisValue);
      element.dataset.pricePointerX = String(chartInstance.convertToPixel({ xAxisIndex: 0 }, axisValue));
      element.dataset.volumePointerX = String(chartInstance.convertToPixel({ xAxisIndex: 1 }, axisValue));
    });
  }, [hideActiveTooltip, ref]);

  const handleChartReady = useCallback((chartInstance: EChartsType) => {
    chartInstanceRef.current = chartInstance;
    scheduleActiveTooltip(chartInstance);
  }, [scheduleActiveTooltip]);

  const restoreActiveTooltip = useCallback((chartInstance: EChartsType) => {
    scheduleActiveTooltip(chartInstance);
  }, [scheduleActiveTooltip]);

  const handlePointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    activePointerRef.current = { x: event.clientX, y: event.clientY, touch: event.pointerType === 'touch' || event.pointerType === 'pen' };
    pointerInsideRef.current = true;
    scheduleActiveTooltip();
  }, [scheduleActiveTooltip]);

  const handlePointerLeave = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    // Touch emits pointerleave when a finger lifts. Keep the selected day until
    // the next tap, outside interaction, scrolling, cancellation or Escape.
    if (event.pointerType !== 'mouse' && activePointerRef.current?.touch) return;
    hideActiveTooltip();
  }, [hideActiveTooltip]);

  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !ref.current?.contains(event.target)) hideActiveTooltip();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !pointerInsideRef.current) return;
      hideActiveTooltip();
      event.preventDefault();
      event.stopImmediatePropagation();
    };
    const scroll = (event: Event) => {
      if (event.target instanceof Node && ref.current && event.target.contains(ref.current)) hideActiveTooltip();
    };
    const focusOutside = (event: FocusEvent) => {
      if (event.target instanceof Node && !ref.current?.contains(event.target)) hideActiveTooltip();
    };
    document.addEventListener('focusin', focusOutside, true);
    document.addEventListener('pointerdown', outside, true);
    document.addEventListener('keydown', escape, true);
    document.addEventListener('scroll', scroll, true);
    return () => {
      document.removeEventListener('focusin', focusOutside, true);
      document.removeEventListener('pointerdown', outside, true);
      document.removeEventListener('keydown', escape, true);
      document.removeEventListener('scroll', scroll, true);
      if (restoreFrameRef.current !== null) cancelAnimationFrame(restoreFrameRef.current);
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
    axisPointer: { triggerOn: 'none', animation: false, link: [{ xAxisIndex: [0, 1] }] },
    tooltip: {
      ...commonTooltip,
      trigger: 'axis',
      triggerOn: 'none',
      transitionDuration: 0,
      hideDelay: 0,
      axisPointer: {
        type: 'line',
        snap: true,
        animation: false,
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
        return `<strong>${escapeChartHtml(new Date(bucket.startAt).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit', timeZone: 'Asia/Shanghai' }))}</strong>`
          + `<div><small>价格</small> ${escapeChartHtml(formatCurrency(bucket.price))}</div>`
          + `<div><small>总成交量</small> ${escapeChartHtml(formatCompactVolumeTick(bucket.volume))}</div>`
          + `<div><small>主动买入</small> ${escapeChartHtml(formatCompactVolumeTick(bucket.buyVolume))}</div>`
          + `<div><small>主动卖出</small> ${escapeChartHtml(formatCompactVolumeTick(bucket.sellVolume))}</div>`
          + `<div><small>方向未知</small> ${escapeChartHtml(formatCompactVolumeTick(bucket.neutralVolume))}</div>`
          + `<div><small>净主动量</small> ${escapeChartHtml(`${sign}${fullIntegerFormatter.format(bucket.netVolume)}`)}</div>`;
      },
    },
    xAxis: [
      {
        id: 'market-price-time-axis', type: 'value', gridIndex: 0, containShape: false, boundaryGap: [0, 0], min: windowStart, max: windowEnd, interval: axisInterval,
        axisLine: { show: false }, axisTick: { show: false }, axisLabel: { show: false },
        // Cartesian y extents run bottom-to-top. Continue the lower segment's
        // phase at the shared boundary rather than restarting the upper dash.
        axisPointer: { show: true, snap: true, animation: false, label: { show: false },
          lineStyle: { ...MARKET_AXIS_POINTER_LINE_STYLE, dashOffset: volumeHeight % 8 } },
        splitLine: { show: true, lineStyle: { color: chartColor.border } },
      },
      {
        id: 'market-volume-time-axis', type: 'value', gridIndex: 1, containShape: false, boundaryGap: [0, 0], min: windowStart, max: windowEnd, interval: axisInterval,
        axisLine: { lineStyle: { color: chartColor.secondary } }, axisTick: { show: false },
        axisPointer: { show: true, snap: true, animation: false, label: { show: false }, lineStyle: MARKET_AXIS_POINTER_LINE_STYLE },
        axisLabel: {
          color: chartColor.secondary,
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
        name: geometry.mobileAxisTitles ? undefined : '价格', nameLocation: 'middle', nameRotate: 90, nameGap: geometry.left - 18,
        nameTextStyle: { color: chartColor.secondary, fontSize: Math.max(11, rootFontSize * 0.75) },
        axisLine: { lineStyle: { color: chartColor.secondary } }, axisTick: { show: false },
        axisLabel: {
          color: chartColor.secondary,
          fontSize: Math.max(11, rootFontSize * 0.75),
          showMinLabel: true,
          showMaxLabel: true,
          formatter: (value: number) => formatIntegerPriceTick(value),
        },
        splitLine: { lineStyle: { color: chartColor.border } },
      },
      {
        id: 'market-volume-value-axis', type: 'value', gridIndex: 1, min: 0, max: volumeScale.max, interval: volumeScale.step,
        name: geometry.mobileAxisTitles ? undefined : '成交量', nameLocation: 'middle', nameRotate: 90, nameGap: geometry.left - 18,
        nameTextStyle: { color: chartColor.secondary, fontSize: Math.max(11, rootFontSize * 0.75) },
        axisLine: { lineStyle: { color: chartColor.secondary } }, axisTick: { show: false },
        axisLabel: {
          color: chartColor.secondary,
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
      onPointerMove={handlePointerMove}
      onPointerDown={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      onPointerCancel={hideActiveTooltip}
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
      data-tooltip-trigger="pointer"
      data-shared-boundary-label-owner="price"
      data-price-min-label={priceBoundaryLabel}
      data-volume-max-label={volumeBoundaryLabel}
      data-volume-max-label-visible="false"
      data-volume-nonzero-label-visible={hasVisibleNonZeroVolumeTick ? 'true' : 'false'}
      data-price-color-role="info"
      data-mobile-axis-titles={geometry.mobileAxisTitles ? 'true' : 'false'}
      data-x-axis-title-visible={geometry.showXAxisTitle ? 'true' : 'false'}
      data-price-ticks={priceScale.ticks.join(',')}
      data-volume-ticks={volumeScale.ticks.join(',')}
      style={{ height: geometry.height }}
    >
      <EconomyChart
        option={option}
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
      {geometry.mobileAxisTitles ? (
        <>
          <div className="market-chart-section-label" style={{ top: geometry.top + 4, left: geometry.left + 4 }} aria-hidden="true">价格</div>
          <div className="market-chart-section-label" style={{ top: geometry.volumeTop + 4, left: geometry.left + 4 }} aria-hidden="true">成交量</div>
        </>
      ) : null}
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
