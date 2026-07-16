import type { MarketHistoryBucket } from '../../utils/marketHistory';
import { buildMarketAxisTicks } from '../../utils/marketHistory';

function CompactPriceSparkline({ values }: { values: number[] }) {
  const width = 720;
  const height = 220;
  const padding = 18;
  const safeValues = values.length > 1 ? values : [7, 7];
  const min = Math.min(...safeValues);
  const max = Math.max(...safeValues);
  const range = Math.max(1, max - min);
  const points = safeValues
    .map((value, index) => {
      const x = padding + (index / (safeValues.length - 1)) * (width - padding * 2);
      const y = height - padding - ((value - min) / range) * (height - padding * 2);
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg className="price-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="近期成交价格曲线">
      <defs>
        <linearGradient id="priceFillCompact" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.28" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <line x1={padding} x2={width - padding} y1={height / 2} y2={height / 2} className="chart-gridline" />
      <polygon points={`${padding},${height - padding} ${points} ${width - padding},${height - padding}`} fill="url(#priceFillCompact)" />
      <polyline points={points} fill="none" className="chart-line" />
    </svg>
  );
}

function formatAxisValue(value: number) {
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: value < 10 ? 2 : 1,
    notation: Math.abs(value) >= 10_000 ? 'compact' : 'standard',
  }).format(value);
}

function MarketHistoryChart({ buckets }: { buckets: MarketHistoryBucket[] }) {
  const width = 960;
  const height = 410;
  const left = 68;
  const right = 18;
  const top = 18;
  const priceBottom = 214;
  const volumeTop = 258;
  const volumeBottom = 344;
  const xLabelY = 366;
  const plotWidth = width - left - right;
  const safeBuckets = buckets.length > 0 ? buckets : [{ startAt: Date.now(), price: 1, volume: 0 }];
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
  const axisTicks = buildMarketAxisTicks(safeBuckets);
  const priceTicks = Array.from({ length: 5 }, (_, index) => maxPrice - (index / 4) * priceRange);
  const volumeTicks = [maxVolume, maxVolume / 2, 0];
  const pricePoints = safeBuckets.map((bucket, index) => {
    const x = left + ((index + 0.5) / safeBuckets.length) * plotWidth;
    const y = priceBottom - ((bucket.price - minPrice) / priceRange) * priceHeight;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg
      className="price-chart"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="近 24 小时价格与成交量趋势图"
      style={{ height: 'clamp(320px, 42vw, 410px)' }}
    >
      <title>近 24 小时价格与成交量趋势</title>
      <desc>每 6 分钟一个数据分段，共 240 个分段。价格折线位于上方，成交量柱状图位于下方，共用按系统时区显示的时间横轴。</desc>
      <defs>
        <linearGradient id="marketPriceFill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.24" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>

      {axisTicks.map((tick, index) => {
        const x = left + (index / (axisTicks.length - 1)) * plotWidth;
        return (
          <g key={tick.timestamp}>
            <line x1={x} x2={x} y1={top} y2={volumeBottom} className="chart-gridline" />
            <text
              x={x}
              y={xLabelY}
              fill="var(--color-text-muted)"
              fontSize="8"
              textAnchor="end"
              transform={`rotate(-45 ${x} ${xLabelY})`}
            >
              {tick.label}
            </text>
          </g>
        );
      })}

      {priceTicks.map((tick, index) => {
        const y = top + (index / (priceTicks.length - 1)) * priceHeight;
        return (
          <g key={`price-${index}`}>
            <line x1={left} x2={width - right} y1={y} y2={y} className="chart-gridline" />
            <text x={left - 8} y={y + 3} fill="var(--color-text-muted)" fontSize="10" textAnchor="end">
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
            <text x={left - 8} y={y + 3} fill="var(--color-text-muted)" fontSize="10" textAnchor="end">
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
            fill="var(--color-warning)"
            opacity={bucket.volume > 0 ? 0.72 : 0}
          />
        );
      })}

      <line x1={left} x2={left} y1={top} y2={priceBottom} stroke="var(--color-text-muted)" strokeWidth="1" />
      <line x1={left} x2={left} y1={volumeTop} y2={volumeBottom} stroke="var(--color-text-muted)" strokeWidth="1" />
      <line x1={left} x2={width - right} y1={volumeBottom} y2={volumeBottom} stroke="var(--color-text-muted)" strokeWidth="1" />
      <text x="15" y={(top + priceBottom) / 2} fill="var(--color-text-muted)" fontSize="11" textAnchor="middle" transform={`rotate(-90 15 ${(top + priceBottom) / 2})`}>
        价格
      </text>
      <text x="15" y={(volumeTop + volumeBottom) / 2} fill="var(--color-text-muted)" fontSize="11" textAnchor="middle" transform={`rotate(-90 15 ${(volumeTop + volumeBottom) / 2})`}>
        成交量
      </text>
      <text x={(left + width - right) / 2} y="404" fill="var(--color-text-muted)" fontSize="11" textAnchor="middle">
        时间（系统时区）
      </text>
    </svg>
  );
}

export function PriceSparkline(props: { values: number[] } | { buckets: MarketHistoryBucket[] }) {
  if ('values' in props) return <CompactPriceSparkline values={props.values} />;
  return <MarketHistoryChart buckets={props.buckets} />;
}
