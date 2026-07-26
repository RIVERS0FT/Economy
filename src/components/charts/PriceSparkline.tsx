import { useLayoutEffect, useRef, useState } from 'react';
import type { MarketHistoryBucket } from '../../utils/marketHistory';
import { buildMarketAxisTicks } from '../../utils/marketHistory';

type MarketChartVariant = 'compact' | 'full';

type ChartGeometry = {
  width: number;
  height: number;
  top: number;
  priceBottom: number;
  preferredVolumeTop: number;
};

type IntegerAxisScale = {
  min: number;
  max: number;
  ticks: number[];
};

const compactGeometry: ChartGeometry = {
  width: 960,
  height: 228,
  top: 12,
  priceBottom: 90,
  preferredVolumeTop: 110,
};

const fullGeometry: ChartGeometry = {
  width: 960,
  height: 540,
  top: 22,
  priceBottom: 230,
  preferredVolumeTop: 276,
};

const fullIntegerFormatter = new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 0 });
const compactVolumeFormatters = new Map<number, Intl.NumberFormat>();
const compactUnits = [
  { threshold: 1_000_000_000_000, suffix: 'T' },
  { threshold: 1_000_000_000, suffix: 'B' },
  { threshold: 1_000_000, suffix: 'M' },
  { threshold: 1_000, suffix: 'K' },
];

function niceIntegerStep(roughStep: number) {
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

function buildIntegerPriceScale(rawMin: number, rawMax: number, tickCount: number): IntegerAxisScale {
  const safeTickCount = Math.max(2, Math.floor(tickCount));
  const intervals = safeTickCount - 1;
  const minValue = Math.max(0, Math.floor(Math.min(rawMin, rawMax)));
  const maxValue = Math.max(minValue, Math.ceil(Math.max(rawMin, rawMax)));

  if (minValue === maxValue) {
    const step = niceIntegerStep(Math.max(1, minValue) / Math.max(2, intervals));
    const lowerIntervals = Math.floor(intervals / 2);
    const min = Math.max(0, minValue - step * lowerIntervals);
    const max = min + step * intervals;
    return {
      min,
      max,
      ticks: Array.from({ length: safeTickCount }, (_, index) => max - index * step),
    };
  }

  let step = niceIntegerStep((maxValue - minValue) / Math.max(1, safeTickCount - 2));
  let min = Math.floor(minValue / step) * step;
  let max = min + step * intervals;
  while (max < maxValue) {
    step = nextNiceIntegerStep(step);
    min = Math.floor(minValue / step) * step;
    max = min + step * intervals;
  }

  return {
    min,
    max,
    ticks: Array.from({ length: safeTickCount }, (_, index) => max - index * step),
  };
}

function buildIntegerVolumeScale(rawMax: number, tickCount: number): IntegerAxisScale {
  const safeTickCount = Math.max(2, Math.floor(tickCount));
  const intervals = safeTickCount - 1;
  const maxValue = Math.max(1, Math.ceil(rawMax));
  let step = niceIntegerStep(maxValue / intervals);
  while (step * intervals < maxValue) step = nextNiceIntegerStep(step);
  const max = step * intervals;
  return {
    min: 0,
    max,
    ticks: Array.from({ length: safeTickCount }, (_, index) => max - index * step),
  };
}

function formatIntegerPriceTick(value: number) {
  const integer = Math.max(0, Math.round(value));
  const unit = compactUnits.find(({ threshold }) => integer >= threshold && integer % threshold === 0);
  return unit ? `${integer / unit.threshold}${unit.suffix}` : fullIntegerFormatter.format(integer);
}

function formatCompactVolumeTick(value: number) {
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

function useChartAxisMetrics(
  viewBoxWidth: number,
  viewBoxHeight: number,
  axisLabels: string[],
  timeLabels: string[],
  legendLabels: string[],
  initialFontSize: number,
) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [axisFontSize, setAxisFontSize] = useState(initialFontSize);
  const [axisLabelWidth, setAxisLabelWidth] = useState(initialFontSize * 4);
  const [timeLabelWidth, setTimeLabelWidth] = useState(initialFontSize * 3);
  const [legendLabelWidths, setLegendLabelWidths] = useState<number[]>(
    legendLabels.map(() => initialFontSize * 4),
  );
  const axisLabelKey = axisLabels.join('\u0000');
  const timeLabelKey = timeLabels.join('\u0000');
  const legendLabelKey = legendLabels.join('\u0000');

  useLayoutEffect(() => {
    const svg = svgRef.current;
    if (!svg) return undefined;

    const unpackLabels = (key: string) => key ? key.split('\u0000') : [];
    const measuredAxisLabels = unpackLabels(axisLabelKey);
    const measuredTimeLabels = unpackLabels(timeLabelKey);
    const measuredLegendLabels = unpackLabels(legendLabelKey);
    let cancelled = false;
    const updateMetrics = () => {
      const bounds = svg.getBoundingClientRect();
      const scale = Math.min(bounds.width / viewBoxWidth, bounds.height / viewBoxHeight);
      const rootFontSize = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
      if (!(scale > 0) || !Number.isFinite(rootFontSize)) return;

      const nextFontSize = (rootFontSize * 0.75) / scale;
      const computedStyle = getComputedStyle(svg);
      const context = document.createElement('canvas').getContext('2d');
      const measureLabels = (values: string[], fallback: number) => {
        if (!context || values.length === 0) return fallback;
        return Math.max(fallback, ...values.map((label) => context.measureText(label).width));
      };
      if (context) {
        context.font = `${computedStyle.fontWeight} ${nextFontSize}px ${computedStyle.fontFamily}`;
      }
      const nextAxisLabelWidth = measureLabels(measuredAxisLabels, nextFontSize);
      const nextTimeLabelWidth = measureLabels(measuredTimeLabels, nextFontSize * 2.5);
      const nextLegendLabelWidths = measuredLegendLabels.map((label) => (
        measureLabels([label], nextFontSize * 2)
      ));
      if (cancelled) return;
      setAxisFontSize((current) => (Math.abs(current - nextFontSize) < 0.1 ? current : nextFontSize));
      setAxisLabelWidth((current) => (Math.abs(current - nextAxisLabelWidth) < 0.5 ? current : nextAxisLabelWidth));
      setTimeLabelWidth((current) => (Math.abs(current - nextTimeLabelWidth) < 0.5 ? current : nextTimeLabelWidth));
      setLegendLabelWidths((current) => (
        current.length === nextLegendLabelWidths.length
        && current.every((value, index) => Math.abs(value - nextLegendLabelWidths[index]) < 0.5)
          ? current
          : nextLegendLabelWidths
      ));
    };

    updateMetrics();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(updateMetrics);
    observer?.observe(svg);
    window.addEventListener('resize', updateMetrics);
    void document.fonts?.ready.then(updateMetrics);
    return () => {
      cancelled = true;
      observer?.disconnect();
      window.removeEventListener('resize', updateMetrics);
    };
  }, [axisLabelKey, initialFontSize, legendLabelKey, timeLabelKey, viewBoxHeight, viewBoxWidth]);

  return { svgRef, axisFontSize, axisLabelWidth, timeLabelWidth, legendLabelWidths };
}

function volumeColor(bucket: MarketHistoryBucket) {
  if (bucket.direction === 'buy') return 'var(--color-success)';
  if (bucket.direction === 'sell') return 'var(--color-danger)';
  return 'var(--color-text-muted)';
}

function compactAxisLabelIndexes(length: number) {
  const visibleCount = Math.min(6, length);
  if (visibleCount <= 1) return new Set([0]);
  return new Set(Array.from({ length: visibleCount }, (_, index) => (
    Math.round((index / (visibleCount - 1)) * (length - 1))
  )));
}

function MarketHistoryChart({ buckets, variant }: { buckets: MarketHistoryBucket[]; variant: MarketChartVariant }) {
  const geometry = variant === 'compact' ? compactGeometry : fullGeometry;
  const {
    width,
    height,
    top,
    priceBottom,
    preferredVolumeTop,
  } = geometry;
  const right = variant === 'compact' ? 18 : 24;
  const safeBuckets: MarketHistoryBucket[] = buckets.length > 0
    ? buckets
    : [{
        startAt: Date.now(), price: 1, volume: 0, buyVolume: 0, sellVolume: 0,
        neutralVolume: 0, netVolume: 0, direction: 'neutral' as const,
      }];
  const rawMinPrice = Math.min(...safeBuckets.map((bucket) => bucket.price));
  const rawMaxPrice = Math.max(...safeBuckets.map((bucket) => bucket.price));
  const priceScale = buildIntegerPriceScale(rawMinPrice, rawMaxPrice, variant === 'compact' ? 3 : 5);
  const volumeScale = buildIntegerVolumeScale(
    Math.max(1, ...safeBuckets.map((bucket) => bucket.volume)),
    variant === 'compact' ? 2 : 3,
  );
  const priceLabels = priceScale.ticks.map(formatIntegerPriceTick);
  const volumeLabels = volumeScale.ticks.map(formatCompactVolumeTick);
  const allAxisTicks = buildMarketAxisTicks(safeBuckets);
  const labelIndexes = variant === 'compact' ? compactAxisLabelIndexes(allAxisTicks.length) : null;
  const axisLabelTicks = allAxisTicks.filter((_, index) => labelIndexes === null || labelIndexes.has(index));
  const legendItems = [
    { label: variant === 'compact' ? '主动买入' : '净主动买入', color: 'var(--color-success)' },
    { label: variant === 'compact' ? '主动卖出' : '净主动卖出', color: 'var(--color-danger)' },
  ];
  const { svgRef, axisFontSize, axisLabelWidth, timeLabelWidth, legendLabelWidths } = useChartAxisMetrics(
    width,
    height,
    [...priceLabels, ...volumeLabels],
    axisLabelTicks.map((tick) => tick.label),
    legendItems.map((item) => item.label),
    variant === 'compact' ? 14 : 18,
  );
  const axisTitleX = Math.max(12, axisFontSize * 1.15);
  const tickLabelGap = Math.max(8, axisFontSize * 0.45);
  const left = Math.max(
    variant === 'compact' ? 68 : 82,
    axisTitleX + axisFontSize * 0.7 + tickLabelGap + axisLabelWidth,
  );
  const textAscent = axisFontSize * 0.8;
  const textDescent = axisFontSize * 0.24;
  const tickBaselineOffset = axisFontSize * 0.32;
  const bottomSafeInset = axisFontSize * 0.75;
  const timeLegendGap = axisFontSize * 0.9;
  const legendTitleGap = axisFontSize;
  const axisLineLabelGap = axisFontSize * 0.38;
  const legendCircleRadius = variant === 'compact' ? 4 : 6;
  const legendTextGap = axisFontSize * 0.5;
  const legendItemGap = axisFontSize * 1.5;
  const legendTopOffset = Math.min(-legendCircleRadius, tickBaselineOffset - textAscent);
  const legendBottomOffset = Math.max(legendCircleRadius, tickBaselineOffset + textDescent);
  const xAxisTitleY = height - bottomSafeInset - textDescent;
  const xAxisTitleTop = xAxisTitleY - textAscent;
  const legendY = xAxisTitleTop - legendTitleGap - legendBottomOffset;
  const legendTop = legendY + legendTopOffset;
  const timeLabelBottomOffset = variant === 'compact'
    ? textDescent
    : Math.SQRT1_2 * (timeLabelWidth + textDescent) + axisFontSize * 0.12;
  const xLabelY = legendTop - timeLegendGap - timeLabelBottomOffset;
  const volumeBottom = Math.max(priceBottom + 1, xLabelY - axisLineLabelGap);
  const minimumVolumeHeight = axisFontSize * (variant === 'compact' ? 1.15 : 1.35);
  const priceVolumeGap = axisFontSize * (variant === 'compact' ? 0.65 : 0.85);
  const volumeTop = Math.min(
    volumeBottom - 1,
    Math.max(
      priceBottom + priceVolumeGap,
      Math.min(preferredVolumeTop, volumeBottom - minimumVolumeHeight),
    ),
  );
  const plotWidth = Math.max(1, width - left - right);
  const priceRange = Math.max(1, priceScale.max - priceScale.min);
  const priceHeight = priceBottom - top;
  const volumeHeight = Math.max(1, volumeBottom - volumeTop);
  const barSlotWidth = plotWidth / safeBuckets.length;
  const barWidth = Math.max(1, barSlotWidth * 0.74);
  const pricePoints = safeBuckets.map((bucket, index) => {
    const x = left + ((index + 0.5) / safeBuckets.length) * plotWidth;
    const y = priceBottom - ((bucket.price - priceScale.min) / priceRange) * priceHeight;
    return `${x},${y}`;
  }).join(' ');
  const tickX = (timestamp: number) => {
    const index = allAxisTicks.findIndex((candidate) => candidate.timestamp === timestamp);
    return left + (index / Math.max(1, allAxisTicks.length - 1)) * plotWidth;
  };
  const legendItemWidths = legendItems.map((_, index) => (
    legendCircleRadius * 2 + legendTextGap + (legendLabelWidths[index] ?? axisFontSize * 4)
  ));
  let legendCursor = 0;
  const legendOffsets = legendItemWidths.map((itemWidth, index) => {
    const offset = legendCursor;
    legendCursor += itemWidth + (index < legendItemWidths.length - 1 ? legendItemGap : 0);
    return offset;
  });
  const legendTotalWidth = legendCursor;
  const legendStartX = legendTotalWidth >= plotWidth
    ? left
    : left + plotWidth / 2 - legendTotalWidth / 2;
  const gradientId = `marketPriceFill-${variant}`;

  return (
    <svg
      ref={svgRef}
      className={`price-chart market-history-chart ${variant}`}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="近 24 小时价格、成交量与主动买卖方向趋势图"
      data-chart-variant={variant}
      data-axis-left={left.toFixed(2)}
      data-volume-bottom={volumeBottom.toFixed(2)}
      data-x-label-y={xLabelY.toFixed(2)}
      data-legend-y={legendY.toFixed(2)}
      data-x-axis-title-y={xAxisTitleY.toFixed(2)}
      style={variant === 'full' ? { height: 'clamp(320px, 42vw, 410px)' } : undefined}
    >
      <title>近 24 小时价格、成交量与主动买卖方向趋势</title>
      <desc>每 6 分钟一个数据分段，共 240 个分段。价格折线位于上方，成交量柱状图位于下方；绿色表示净主动买入，红色表示净主动卖出，灰色表示未归类成交量。旋转时间刻度、方向图例和时间轴标题之间保留独立安全区。</desc>
      <defs>
        <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.24" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>

      {allAxisTicks.map((tick) => {
        const x = tickX(tick.timestamp);
        return <line key={`grid-${tick.timestamp}`} x1={x} x2={x} y1={top} y2={volumeBottom} className="chart-gridline" />;
      })}

      {axisLabelTicks.map((tick) => {
        const x = tickX(tick.timestamp);
        return (
          <text
            key={`label-${tick.timestamp}`}
            className="chart-x-tick-label"
            x={x}
            y={xLabelY}
            fill="var(--color-text-muted)"
            fontSize={axisFontSize}
            textAnchor={variant === 'compact' ? 'middle' : 'end'}
            transform={variant === 'compact' ? undefined : `rotate(-45 ${x} ${xLabelY})`}
          >
            {tick.label}
          </text>
        );
      })}

      {priceScale.ticks.map((tick, index) => {
        const y = priceBottom - ((tick - priceScale.min) / priceRange) * priceHeight;
        return (
          <g key={`price-${tick}-${index}`}>
            <line x1={left} x2={width - right} y1={y} y2={y} className="chart-gridline" />
            <text className="chart-price-tick-label" x={left - tickLabelGap} y={y + tickBaselineOffset} fill="var(--color-text-muted)" fontSize={axisFontSize} textAnchor="end">
              {priceLabels[index]}
            </text>
          </g>
        );
      })}

      {volumeScale.ticks.map((tick, index) => {
        const y = volumeBottom - ((tick - volumeScale.min) / Math.max(1, volumeScale.max - volumeScale.min)) * volumeHeight;
        return (
          <g key={`volume-${tick}-${index}`}>
            <line x1={left} x2={width - right} y1={y} y2={y} className="chart-gridline" />
            <text className="chart-volume-tick-label" x={left - tickLabelGap} y={y + tickBaselineOffset} fill="var(--color-text-muted)" fontSize={axisFontSize} textAnchor="end">
              {volumeLabels[index]}
            </text>
          </g>
        );
      })}

      <polygon
        points={`${left},${priceBottom} ${pricePoints} ${width - right},${priceBottom}`}
        fill={`url(#${gradientId})`}
      />
      <polyline points={pricePoints} fill="none" className="chart-line" />

      {safeBuckets.map((bucket, index) => {
        const barHeight = (bucket.volume / volumeScale.max) * volumeHeight;
        const x = left + index * barSlotWidth + (barSlotWidth - barWidth) / 2;
        return (
          <rect
            key={`${bucket.startAt}-${index}`}
            x={x}
            y={volumeBottom - barHeight}
            width={barWidth}
            height={Math.max(0, barHeight)}
            rx={Math.min(1.5, barWidth / 2)}
            fill={volumeColor(bucket)}
            opacity={bucket.volume > 0 ? 0.78 : 0}
            data-direction={bucket.direction}
          />
        );
      })}

      <line x1={left} x2={left} y1={top} y2={priceBottom} stroke="var(--color-text-muted)" strokeWidth="1" />
      <line x1={left} x2={left} y1={volumeTop} y2={volumeBottom} stroke="var(--color-text-muted)" strokeWidth="1" />
      <line x1={left} x2={width - right} y1={volumeBottom} y2={volumeBottom} stroke="var(--color-text-muted)" strokeWidth="1" />
      <text className="chart-axis-title" x={axisTitleX} y={(top + priceBottom) / 2} fill="var(--color-text-muted)" fontSize={axisFontSize} textAnchor="middle" transform={`rotate(-90 ${axisTitleX} ${(top + priceBottom) / 2})`}>
        价格
      </text>
      <text className="chart-axis-title" x={axisTitleX} y={(volumeTop + volumeBottom) / 2} fill="var(--color-text-muted)" fontSize={axisFontSize} textAnchor="middle" transform={`rotate(-90 ${axisTitleX} ${(volumeTop + volumeBottom) / 2})`}>
        成交量
      </text>

      <g className="chart-legend" transform={`translate(${legendStartX}, ${legendY})`}>
        {legendItems.map((item, index) => (
          <g
            className="chart-legend-item"
            key={item.label}
            transform={`translate(${legendOffsets[index]}, 0)`}
            fontSize={axisFontSize}
            fill="var(--color-text-muted)"
          >
            <circle cx={legendCircleRadius} cy={0} r={legendCircleRadius} fill={item.color} />
            <text x={legendCircleRadius * 2 + legendTextGap} y={tickBaselineOffset}>{item.label}</text>
          </g>
        ))}
      </g>

      <text className="chart-axis-title chart-x-axis-title" x={left + plotWidth / 2} y={xAxisTitleY} fill="var(--color-text-muted)" fontSize={axisFontSize} textAnchor="middle">
        时间
      </text>
    </svg>
  );
}

export function PriceSparkline({
  buckets,
  variant = 'full',
}: {
  buckets: MarketHistoryBucket[];
  variant?: MarketChartVariant;
}) {
  return <MarketHistoryChart buckets={buckets} variant={variant} />;
}
