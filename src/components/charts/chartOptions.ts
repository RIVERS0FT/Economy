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
} as const;

export const PIE_PAD_ANGLE = 5;

export const STABLE_TOOLTIP_EMPHASIS = {
  disabled: true,
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

/** ECharts positions are chart-local even when the HTML node is appended to a shared host. */
export function positionWorkspaceChartTooltip(point: number[], tooltipElement: HTMLElement, chart: HTMLElement): [number, number] {
  const gap = 8;
  const chartRect = chart.getBoundingClientRect();
  const hostRect = tooltipElement.parentElement?.getBoundingClientRect() ?? chartRect;
  const scaleX = chartRect.width / Math.max(1, chart.clientWidth) || 1;
  const scaleY = chartRect.height / Math.max(1, chart.clientHeight) || 1;
  const left = Math.max(0, (hostRect.left - chartRect.left) / scaleX) + gap;
  const top = Math.max(0, (hostRect.top - chartRect.top) / scaleY) + gap;
  const right = Math.min(chart.clientWidth, (hostRect.right - chartRect.left) / scaleX) - gap;
  const bottom = Math.min(chart.clientHeight, (hostRect.bottom - chartRect.top) / scaleY) - gap;
  tooltipElement.style.maxWidth = `${Math.max(1, right - left)}px`;
  tooltipElement.style.maxHeight = `${Math.max(1, bottom - top)}px`;
  tooltipElement.style.overflow = 'auto';
  const width = tooltipElement.offsetWidth;
  const height = tooltipElement.offsetHeight;
  const preferredTop = point[1] + gap + height <= bottom ? point[1] + gap : point[1] - gap - height;
  return [
    Math.max(left, Math.min(point[0] + gap, right - width)),
    Math.max(top, Math.min(preferredTop, bottom - height)),
  ];
}

export const commonTooltip = {
  className: 'economy-chart-tooltip ui-tooltip-surface',
  textStyle: {
    color: chartColor.text,
    fontSize: 12,
  },
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
