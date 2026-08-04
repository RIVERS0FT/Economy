import { useMemo } from 'react';
import type { AdminServerMetricBucket, AdminServerStatusGranularity } from '../../api/admin';
import { EconomyChart } from './EconomyChart';
import type { EChartsCoreOption } from './echartsCore';
import {
  STABLE_TOOLTIP_EMPHASIS,
  chartColor,
  commonCategoryAxis,
  commonTooltip,
  commonValueAxis,
  escapeChartHtml,
} from './chartOptions';

const minuteFormatter = new Intl.DateTimeFormat('zh-CN', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});
const hourFormatter = new Intl.DateTimeFormat('zh-CN', {
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  hour12: false,
});
const dayFormatter = new Intl.DateTimeFormat('zh-CN', {
  month: '2-digit',
  day: '2-digit',
});

export type AdminServerTrendSeries = {
  name: string;
  values: Array<number | null>;
  color: string;
  format: (value: number) => string;
};

function timeLabel(value: number, granularity: AdminServerStatusGranularity) {
  if (granularity === 'day') return dayFormatter.format(value);
  if (granularity === 'hour') return hourFormatter.format(value);
  return minuteFormatter.format(value);
}

function tooltipRows(title: string, rows: Array<[string, string]>) {
  return `<strong>${escapeChartHtml(title)}</strong>${rows.map(([label, value]) => (
    `<div><small>${escapeChartHtml(label)}</small> ${escapeChartHtml(value)}</div>`
  )).join('')}`;
}

export function AdminServerTrendChart({
  history,
  series,
  granularity,
  ariaLabel,
  className,
}: {
  history: AdminServerMetricBucket[];
  series: AdminServerTrendSeries[];
  granularity: AdminServerStatusGranularity;
  ariaLabel: string;
  className?: string;
}) {
  const labels = history.map((bucket) => timeLabel(bucket.startsAt, granularity));
  const option = useMemo<EChartsCoreOption>(() => ({
    animation: false,
    aria: { enabled: true, description: ariaLabel },
    color: series.map((entry) => entry.color),
    grid: { top: series.length > 1 ? 34 : 16, right: 14, bottom: 30, left: 48, containLabel: false },
    legend: series.length > 1 ? {
      top: 0,
      right: 4,
      textStyle: { color: chartColor.muted, fontSize: 11 },
      itemWidth: 14,
      itemHeight: 7,
    } : undefined,
    tooltip: {
      ...commonTooltip,
      trigger: 'axis',
      axisPointer: { type: 'line' },
      formatter: (params: any) => {
        const list = Array.isArray(params) ? params : [params];
        const index = Number(list[0]?.dataIndex ?? 0);
        return tooltipRows(labels[index] || '', series.map((entry) => {
          const value = entry.values[index];
          return [entry.name, value === null ? '无数据' : entry.format(value)];
        }));
      },
    },
    xAxis: {
      ...commonCategoryAxis,
      type: 'category',
      boundaryGap: false,
      data: labels,
      axisLabel: {
        ...commonCategoryAxis.axisLabel,
        interval: labels.length <= 12 ? 0 : Math.max(0, Math.ceil(labels.length / 8) - 1),
      },
    },
    yAxis: {
      ...commonValueAxis,
      type: 'value',
      min: 0,
      axisLabel: {
        ...commonValueAxis.axisLabel,
        formatter: (value: number) => series[0]?.format(Number(value)) || String(value),
      },
    },
    series: series.map((entry) => ({
      name: entry.name,
      type: 'line',
      showSymbol: false,
      connectNulls: false,
      smooth: false,
      data: entry.values,
      lineStyle: { width: 2, color: entry.color },
      itemStyle: { color: entry.color },
      emphasis: STABLE_TOOLTIP_EMPHASIS,
    })),
  }), [ariaLabel, labels, series]);

  return (
    <EconomyChart
      option={option}
      className={`admin-echart admin-server-trend-chart${className ? ` ${className}` : ''}`}
      ariaLabel={ariaLabel}
      accessibleSummary={history.map((bucket, index) => (
        `${labels[index]}：${series.map((entry) => `${entry.name}${entry.values[index] === null ? '无数据' : entry.format(entry.values[index] as number)}`).join('，')}`
      )).join('；')}
    />
  );
}
