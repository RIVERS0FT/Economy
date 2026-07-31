export const chartColor = {
  text: 'var(--color-text-primary)',
  muted: 'var(--color-text-muted)',
  secondary: 'var(--color-text-secondary)',
  border: 'var(--color-border)',
  borderStrong: 'var(--color-border-strong)',
  success: 'var(--color-success)',
  warning: 'var(--color-warning)',
  danger: 'var(--color-danger)',
  info: 'var(--color-info)',
  surface: 'rgba(7, 20, 15, 0.98)',
} as const;

const compactFormatter = new Intl.NumberFormat('zh-CN', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

const integerFormatter = new Intl.NumberFormat('zh-CN', {
  maximumFractionDigits: 0,
});

export function compactChartNumber(value: number) {
  return compactFormatter.format(Math.max(0, Number(value) || 0));
}

export function integerChartNumber(value: number) {
  return integerFormatter.format(Math.max(0, Math.round(Number(value) || 0)));
}

export function percentFromBps(value: number) {
  return Math.max(0, Number(value) || 0) / 100;
}

export function formatChartPercent(value: number) {
  const percent = Math.max(0, Number(value) || 0);
  if (percent === 0) return '0%';
  if (percent < 0.1) return '<0.1%';
  if (percent < 10) return `${percent.toFixed(1)}%`;
  return `${Math.round(percent)}%`;
}

export function escapeChartHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export const commonTooltip = {
  className: 'economy-chart-tooltip',
  backgroundColor: chartColor.surface,
  borderColor: chartColor.borderStrong,
  borderWidth: 1,
  textStyle: {
    color: chartColor.text,
    fontSize: 12,
  },
  extraCssText: 'border-radius:10px;box-shadow:0 12px 28px rgba(0,0,0,.32);',
  confine: true,
  appendToBody: false,
} as const;

export const commonCategoryAxis = {
  axisLine: { lineStyle: { color: chartColor.borderStrong } },
  axisTick: { show: false },
  axisLabel: {
    color: chartColor.muted,
    fontSize: 11,
    hideOverlap: true,
  },
} as const;

export const commonValueAxis = {
  axisLine: { show: false },
  axisTick: { show: false },
  axisLabel: {
    color: chartColor.muted,
    fontSize: 11,
  },
  splitLine: {
    lineStyle: {
      color: chartColor.border,
      type: 'dashed' as const,
    },
  },
} as const;
