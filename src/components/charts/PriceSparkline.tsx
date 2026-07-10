export function PriceSparkline({ values }: { values: number[] }) {
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
        <linearGradient id="priceFill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.28" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <line x1={padding} x2={width - padding} y1={height / 2} y2={height / 2} className="chart-gridline" />
      <polygon points={`${padding},${height - padding} ${points} ${width - padding},${height - padding}`} fill="url(#priceFill)" />
      <polyline points={points} fill="none" className="chart-line" />
    </svg>
  );
}
