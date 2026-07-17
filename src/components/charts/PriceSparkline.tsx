import { useLayoutEffect, useRef, useState } from 'react';
import type { MarketHistoryBucket } from '../../utils/marketHistory';
import { buildMarketAxisTicks } from '../../utils/marketHistory';

type MarketChartVariant = 'compact' | 'full';

type ChartGeometry = {
  width: number;
  height: number;
  top: number;
  priceBottom: number;
  volumeTop: number;
  volumeBottom: number;
  xLabelY: number;
  legendY: number;
  xAxisTitleY: number;
};

const compactGeometry: ChartGeometry = {
  width: 960,
  height: 228,
  top: 12,
  priceBottom: 90,
  volumeTop: 110,
  volumeBottom: 143,
  xLabelY: 164,
  legendY: 190,
  xAxisTitleY: 222,
};

const fullGeometry: ChartGeometry = {
  width: 960,
  height: 540,
  top: 22,
  priceBottom: 230,
  volumeTop: 276,
  volumeBottom: 382,
  xLabelY: 408,
  legendY: 452,
  xAxisTitleY: 526,
};

function formatAxisValue(value: number) {
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: value < 10 ? 2 : 1,
    notation: Math.abs(value) >= 10_000 ? 'compact' : 'standard',
  }).format(value);
}

function useChartFooterAxisFontSize(viewBoxWidth: number, viewBoxHeight: number, initialFontSize: number) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [axisFontSize, setAxisFontSize] = useState(initialFontSize);

  useLayoutEffect(() => {
    const svg = svgRef.current;
    if (!svg) return undefined;

    const container = svg.closest('.market-chart-card, .market-summary');
    const footer = container?.querySelector<HTMLElement>('.chart-footer, .overview-market-footer');
    const updateFontSize = () => {
      const bounds = svg.getBoundingClientRect();
      const scale = Math.min(bounds.width / viewBoxWidth, bounds.height / viewBoxHeight);
      const rootFontSize = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
      const footerFontSize = footer
        ? Number.parseFloat(getComputedStyle(footer).fontSize)
        : rootFontSize * 0.75;
      if (!(scale > 0) || !Number.isFinite(footerFontSize)) return;
      const nextFontSize = footerFontSize / scale;
      setAxisFontSize((current) => (Math.abs(current - nextFontSize) < 0.1 ? current : nextFontSize));
    };

    updateFontSize();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(updateFontSize);
    observer?.observe(svg);
    if (footer) observer?.observe(footer);
    window.addEventListener('resize', updateFontSize);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', updateFontSize);
    };
  }, [viewBoxHeight, viewBoxWidth]);

  return { svgRef, axisFontSize };
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
    volumeTop,
    volumeBottom,
    xLabelY,
    legendY,
    xAxisTitleY,
  } = geometry;
  const { svgRef, axisFontSize } = useChartFooterAxisFontSize(width, height, variant === 'compact' ? 14 : 18);
  const left = Math.max(variant === 'compact' ? 68 : 82, axisFontSize * (variant === 'compact' ? 3.1 : 3.5));
  const right = variant === 'compact' ? 18 : 24;
  const axisTitleX = Math.max(12, axisFontSize * 0.55);
  const tickBaselineOffset = axisFontSize * 0.32;
  const plotWidth = width - left - right;
  const safeBuckets: MarketHistoryBucket[] = buckets.length > 0
    ? buckets
    : [{
        startAt: Date.now(), price: 1, volume: 0, buyVolume: 0, sellVolume: 0,
        neutralVolume: 0, netVolume: 0, direction: 'neutral' as const,
      }];
  const rawMinPrice = Math.min(...safeBuckets.map((bucket) => bucket.price));
  const rawMaxPrice = Math.max(...safeBuckets.map((bucket) => bucket.price));
  const rawPriceRange = rawMaxPrice - rawMinPrice;
  const pricePadding = Math.max(1, rawPriceRange * 0.08);
  const minPrice = Math.max(0, rawMinPrice - pricePadding);
  const maxPrice = rawMaxPrice + pricePadding;
  const priceRange = Math.max(1, maxPrice - minPrice);
  const maxVolume = Math.max(1, ...safeBuckets.map((bucket) => bucket.volume));
  const priceHeight = priceBottom - top;
  const volumeHeight = volumeBottom - volumeTop;
  const barSlotWidth = plotWidth / safeBuckets.length;
  const barWidth = Math.max(1, barSlotWidth * 0.74);
  const allAxisTicks = buildMarketAxisTicks(safeBuckets);
  const labelIndexes = variant === 'compact' ? compactAxisLabelIndexes(allAxisTicks.length) : null;
  const axisLabelTicks = allAxisTicks.filter((_, index) => labelIndexes === null || labelIndexes.has(index));
  const priceTickCount = variant === 'compact' ? 3 : 5;
  const priceTicks = Array.from({ length: priceTickCount }, (_, index) => (
    maxPrice - (index / (priceTickCount - 1)) * priceRange
  ));
  const volumeTicks = variant === 'compact' ? [maxVolume, 0] : [maxVolume, maxVolume / 2, 0];
  const pricePoints = safeBuckets.map((bucket, index) => {
    const x = left + ((index + 0.5) / safeBuckets.length) * plotWidth;
    const y = priceBottom - ((bucket.price - minPrice) / priceRange) * priceHeight;
    return `${x},${y}`;
  }).join(' ');
  const tickX = (timestamp: number) => {
    const index = allAxisTicks.findIndex((candidate) => candidate.timestamp === timestamp);
    return left + (index / Math.max(1, allAxisTicks.length - 1)) * plotWidth;
  };
  const legendItems = [
    { label: variant === 'compact' ? '主动买入' : '净主动买入', color: 'var(--color-success)' },
    { label: variant === 'compact' ? '主动卖出' : '净主动卖出', color: 'var(--color-danger)' },
    { label: variant === 'compact' ? '均衡' : '均衡／方向未知', color: 'var(--color-text-muted)' },
  ];
  const legendSlotWidth = plotWidth / legendItems.length;

  return (
    <svg
      ref={svgRef}
      className={`price-chart market-history-chart ${variant}`}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="近 24 小时价格、成交量与主动买卖方向趋势图"
      data-chart-variant={variant}
      style={variant === 'full' ? { height: 'clamp(320px, 42vw, 410px)' } : undefined}
    >
      <title>近 24 小时价格、成交量与主动买卖方向趋势</title>
      <desc>每 6 分钟一个数据分段，共 240 个分段。价格折线位于上方，成交量柱状图位于下方；绿色表示净主动买入，红色表示净主动卖出，灰色表示主动买卖均衡或旧历史方向未知。</desc>
      <defs>
        <linearGradient id="marketPriceFill" x1="0" x2="0" y1="0" y2="1">
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

      {priceTicks.map((tick, index) => {
        const y = top + (index / (priceTicks.length - 1)) * priceHeight;
        return (
          <g key={`price-${index}`}>
            <line x1={left} x2={width - right} y1={y} y2={y} className="chart-gridline" />
            <text className="chart-price-tick-label" x={left - 8} y={y + tickBaselineOffset} fill="var(--color-text-muted)" fontSize={axisFontSize} textAnchor="end">
              {formatAxisValue(tick)}
            </text>
          </g>
        );
      })}

      {volumeTicks.map((tick, index) => {
        const y = volumeTop + (index / (volumeTicks.length - 1)) * volumeHeight;
        return (
          <g key={`volume-${index}`}>
            <line x1={left} x2={width - right} y1={y} y2={y} className="chart-gridline" />
            <text className="chart-volume-tick-label" x={left - 8} y={y + tickBaselineOffset} fill="var(--color-text-muted)" fontSize={axisFontSize} textAnchor="end">
              {formatAxisValue(tick)}
            </text>
          </g>
        );
      })}

      <polygon
        points={`${left},${priceBottom} ${pricePoints} ${width - right},${priceBottom}`}
        fill="url(#marketPriceFill)"
      />
      <polyline points={pricePoints} fill="none" className="chart-line" />

      {safeBuckets.map((bucket, index) => {
        const barHeight = (bucket.volume / maxVolume) * volumeHeight;
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

      {legendItems.map((item, index) => (
        <g
          className="chart-legend-item"
          key={item.label}
          transform={`translate(${left + index * legendSlotWidth}, ${legendY})`}
          fontSize={axisFontSize}
          fill="var(--color-text-muted)"
        >
          <circle cx={variant === 'compact' ? 5 : 6} cy={0} r={variant === 'compact' ? 4 : 6} fill={item.color} />
          <text x={variant === 'compact' ? 14 : 18} y={tickBaselineOffset}>{item.label}</text>
        </g>
      ))}

      <text className="chart-axis-title" x={(left + width - right) / 2} y={xAxisTitleY} fill="var(--color-text-muted)" fontSize={axisFontSize} textAnchor="middle">
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
