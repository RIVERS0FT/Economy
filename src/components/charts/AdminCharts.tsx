import { useMemo } from 'react';
import type { AdminPlayerStatisticsSeriesPoint } from '../../api/admin';
import { formatCurrency } from '../../utils/formatters';
import { EconomyChart } from './EconomyChart';
import type { EChartsCoreOption } from './echartsCore';
import {
  chartColor,
  commonCategoryAxis,
  commonTooltip,
  commonValueAxis,
  escapeChartHtml,
  formatChartPercent,
  integerChartNumber,
} from './chartOptions';

type PercentRow = {
  label: string;
  value: number;
  detail?: string;
  unavailable?: boolean;
};

type NumberRow = {
  label: string;
  value: number;
  detail?: string;
};

function tooltipRows(title: string, rows: Array<[string, string]>) {
  return `<strong>${escapeChartHtml(title)}</strong>${rows.map(([label, value]) => (
    `<div><small>${escapeChartHtml(label)}</small> ${escapeChartHtml(value)}</div>`
  )).join('')}`;
}

export function PlayerActivityChart({
  points,
}: {
  points: AdminPlayerStatisticsSeriesPoint[];
}) {
  const option = useMemo<EChartsCoreOption>(() => ({
    animation: false,
    aria: { enabled: true, description: '每日新增玩家与成功经济操作玩家趋势。未覆盖日期不显示活跃人数。' },
    color: [chartColor.warning, chartColor.info],
    grid: { top: 14, right: 10, bottom: 34, left: 42, containLabel: false },
    tooltip: {
      ...commonTooltip,
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params: any) => {
        const list = Array.isArray(params) ? params : [params];
        const index = Number(list[0]?.dataIndex ?? 0);
        const point = points[index];
        if (!point) return '';
        return tooltipRows(point.day, [
          ['新增玩家', integerChartNumber(point.newPlayers)],
          ['经济活跃', point.activePlayers === null ? '精确记录未覆盖' : integerChartNumber(point.activePlayers)],
        ]);
      },
    },
    xAxis: {
      ...commonCategoryAxis,
      type: 'category',
      data: points.map((point) => point.day.slice(5)),
      axisLabel: {
        ...commonCategoryAxis.axisLabel,
        interval: points.length <= 14 ? 0 : Math.max(0, Math.ceil(points.length / 8) - 1),
      },
    },
    yAxis: {
      ...commonValueAxis,
      type: 'value',
      min: 0,
      minInterval: 1,
      axisLabel: { ...commonValueAxis.axisLabel, formatter: (value: number) => integerChartNumber(value) },
    },
    series: [
      {
        name: '新增玩家',
        type: 'bar',
        barMaxWidth: 12,
        data: points.map((point) => point.newPlayers),
        itemStyle: {
          color: 'rgba(0,0,0,0)',
          borderColor: chartColor.warning,
          borderWidth: 1.5,
          borderRadius: [4, 4, 0, 0],
        },
      },
      {
        name: '经济活跃',
        type: 'bar',
        barMaxWidth: 12,
        data: points.map((point) => point.activePlayers),
        itemStyle: { color: chartColor.info, borderRadius: [4, 4, 0, 0] },
      },
    ],
  }), [points]);

  const summary = points.map((point) => (
    `${point.day}新增${point.newPlayers}人，活跃${point.activePlayers === null ? '未覆盖' : `${point.activePlayers}人`}`
  )).join('；');

  return (
    <EconomyChart
      option={option}
      className="admin-echart admin-player-activity-chart"
      ariaLabel={`${points.length} 日新增与经济活跃趋势图`}
      accessibleSummary={summary}
    />
  );
}

export function HorizontalPercentChart({
  rows,
  ariaLabel,
  className,
  color = chartColor.info,
}: {
  rows: PercentRow[];
  ariaLabel: string;
  className?: string;
  color?: string;
}) {
  const option = useMemo<EChartsCoreOption>(() => ({
    animation: false,
    aria: { enabled: true, description: ariaLabel },
    grid: { top: 6, right: 72, bottom: 6, left: 96, containLabel: false },
    tooltip: {
      ...commonTooltip,
      trigger: 'item',
      formatter: (params: any) => {
        const row = rows[Number(params?.dataIndex ?? 0)];
        if (!row) return '';
        return tooltipRows(row.label, [
          ['比例', row.unavailable ? '覆盖不足' : formatChartPercent(row.value)],
          ...(row.detail ? [['详情', row.detail] as [string, string]] : []),
        ]);
      },
    },
    xAxis: {
      ...commonValueAxis,
      type: 'value',
      min: 0,
      max: 100,
      splitNumber: 4,
      axisLabel: { ...commonValueAxis.axisLabel, formatter: (value: number) => `${value}%` },
    },
    yAxis: {
      ...commonCategoryAxis,
      type: 'category',
      inverse: true,
      data: rows.map((row) => row.label),
      axisLabel: { ...commonCategoryAxis.axisLabel, width: 88, overflow: 'truncate' },
    },
    series: [{
      type: 'bar',
      barMaxWidth: 18,
      showBackground: true,
      backgroundStyle: { color: 'rgba(255,255,255,.055)', borderRadius: 999 },
      data: rows.map((row) => ({ value: row.unavailable ? 0 : Math.max(0, Math.min(100, row.value)), detail: row.detail })),
      itemStyle: { color, borderRadius: 999 },
      label: {
        show: true,
        position: 'right',
        color: chartColor.text,
        formatter: (params: any) => {
          const row = rows[Number(params?.dataIndex ?? 0)];
          return row?.unavailable ? '覆盖不足' : formatChartPercent(row?.value ?? 0);
        },
      },
    }],
  }), [ariaLabel, color, rows]);

  return (
    <EconomyChart
      option={option}
      className={`admin-echart admin-echart--compact${className ? ` ${className}` : ''}`}
      ariaLabel={ariaLabel}
      accessibleSummary={rows.map((row) => `${row.label}${row.unavailable ? '覆盖不足' : formatChartPercent(row.value)}${row.detail ? `，${row.detail}` : ''}`).join('；')}
    />
  );
}

export function DonutChart({
  rows,
  ariaLabel,
  valueFormatter = integerChartNumber,
  className,
}: {
  rows: NumberRow[];
  ariaLabel: string;
  valueFormatter?: (value: number) => string;
  className?: string;
}) {
  const option = useMemo<EChartsCoreOption>(() => ({
    animation: false,
    aria: { enabled: true, description: ariaLabel },
    tooltip: {
      ...commonTooltip,
      trigger: 'item',
      formatter: (params: any) => {
        const row = rows[Number(params?.dataIndex ?? 0)];
        if (!row) return '';
        const percent = Number(params?.percent ?? 0);
        return tooltipRows(row.label, [
          ['数值', valueFormatter(row.value)],
          ['占比', formatChartPercent(percent)],
          ...(row.detail ? [['详情', row.detail] as [string, string]] : []),
        ]);
      },
    },
    series: [{
      type: 'pie',
      radius: ['52%', '78%'],
      center: ['50%', '50%'],
      avoidLabelOverlap: true,
      minAngle: 2,
      label: { show: false },
      labelLine: { show: false },
      emphasis: { scale: false },
      itemStyle: { borderColor: 'rgba(7,20,15,.9)', borderWidth: 2, borderRadius: 4 },
      data: rows.map((row) => ({ name: row.label, value: Math.max(0, row.value) })),
    }],
  }), [ariaLabel, rows, valueFormatter]);

  return (
    <EconomyChart
      option={option}
      className={`admin-echart admin-echart--compact${className ? ` ${className}` : ''}`}
      ariaLabel={ariaLabel}
      accessibleSummary={rows.map((row) => `${row.label}${valueFormatter(row.value)}`).join('；')}
    />
  );
}

export function NumberBarChart({
  rows,
  ariaLabel,
  horizontal = false,
  money = false,
  className,
}: {
  rows: NumberRow[];
  ariaLabel: string;
  horizontal?: boolean;
  money?: boolean;
  className?: string;
}) {
  const valueFormatter = money ? formatCurrency : integerChartNumber;
  const categoryAxis = {
    ...commonCategoryAxis,
    type: 'category' as const,
    data: rows.map((row) => row.label),
    axisLabel: { ...commonCategoryAxis.axisLabel, interval: 0, width: horizontal ? 92 : undefined, overflow: 'truncate' as const },
    inverse: horizontal || undefined,
  };
  const valueAxis = {
    ...commonValueAxis,
    type: 'value' as const,
    min: 0,
    minInterval: money ? undefined : 1,
    axisLabel: { ...commonValueAxis.axisLabel, formatter: (value: number) => money ? integerChartNumber(value) : integerChartNumber(value) },
  };
  const option = useMemo<EChartsCoreOption>(() => ({
    animation: false,
    aria: { enabled: true, description: ariaLabel },
    grid: horizontal
      ? { top: 8, right: 16, bottom: 28, left: 96, containLabel: false }
      : { top: 12, right: 10, bottom: 36, left: 50, containLabel: false },
    tooltip: {
      ...commonTooltip,
      trigger: 'item',
      formatter: (params: any) => {
        const row = rows[Number(params?.dataIndex ?? 0)];
        if (!row) return '';
        return tooltipRows(row.label, [
          [money ? '金额' : '数量', valueFormatter(row.value)],
          ...(row.detail ? [['详情', row.detail] as [string, string]] : []),
        ]);
      },
    },
    xAxis: horizontal ? valueAxis : categoryAxis,
    yAxis: horizontal ? categoryAxis : valueAxis,
    series: [{
      type: 'bar',
      barMaxWidth: horizontal ? 18 : 28,
      data: rows.map((row) => Math.max(0, row.value)),
      itemStyle: { color: chartColor.info, borderRadius: horizontal ? 999 : [5, 5, 0, 0] },
    }],
  }), [ariaLabel, categoryAxis, horizontal, money, rows, valueAxis, valueFormatter]);

  return (
    <EconomyChart
      option={option}
      className={`admin-echart${className ? ` ${className}` : ''}`}
      ariaLabel={ariaLabel}
      accessibleSummary={rows.map((row) => `${row.label}${valueFormatter(row.value)}${row.detail ? `，${row.detail}` : ''}`).join('；')}
    />
  );
}

export function PopulationBudgetChart({
  rows,
}: {
  rows: Array<{ label: string; food: number; household: number }>;
}) {
  const normalized = rows.map((row) => {
    const total = Math.max(0, row.food + row.household);
    return {
      ...row,
      foodPercent: total > 0 ? (row.food / total) * 100 : 0,
      householdPercent: total > 0 ? (row.household / total) * 100 : 0,
    };
  });
  const option = useMemo<EChartsCoreOption>(() => ({
    animation: false,
    aria: { enabled: true, description: '三类人口食品与家庭预算的百分比构成。' },
    grid: { top: 8, right: 16, bottom: 28, left: 88, containLabel: false },
    tooltip: {
      ...commonTooltip,
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params: any) => {
        const list = Array.isArray(params) ? params : [params];
        const index = Number(list[0]?.dataIndex ?? 0);
        const row = normalized[index];
        if (!row) return '';
        return tooltipRows(row.label, [
          ['食品预算', `${formatCurrency(row.food)} · ${formatChartPercent(row.foodPercent)}`],
          ['家庭预算', `${formatCurrency(row.household)} · ${formatChartPercent(row.householdPercent)}`],
        ]);
      },
    },
    xAxis: {
      ...commonValueAxis,
      type: 'value',
      min: 0,
      max: 100,
      axisLabel: { ...commonValueAxis.axisLabel, formatter: (value: number) => `${value}%` },
    },
    yAxis: {
      ...commonCategoryAxis,
      type: 'category',
      inverse: true,
      data: normalized.map((row) => row.label),
    },
    series: [
      {
        name: '食品',
        type: 'bar',
        stack: 'budget',
        barMaxWidth: 20,
        data: normalized.map((row) => row.foodPercent),
        itemStyle: { color: chartColor.warning, borderRadius: [999, 0, 0, 999] },
      },
      {
        name: '家庭',
        type: 'bar',
        stack: 'budget',
        barMaxWidth: 20,
        data: normalized.map((row) => row.householdPercent),
        itemStyle: { color: chartColor.info, borderRadius: [0, 999, 999, 0] },
      },
    ],
  }), [normalized]);

  return (
    <EconomyChart
      option={option}
      className="admin-echart admin-echart--compact admin-population-budget-chart"
      ariaLabel="人口食品与家庭预算构成图"
      accessibleSummary={normalized.map((row) => `${row.label}食品${formatChartPercent(row.foodPercent)}，家庭${formatChartPercent(row.householdPercent)}`).join('；')}
    />
  );
}
