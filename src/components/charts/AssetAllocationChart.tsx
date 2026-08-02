import { useMemo } from 'react';
import { EconomyChart } from './EconomyChart';
import type { EChartsCoreOption } from './echartsCore';
import { PIE_PAD_ANGLE, STABLE_TOOLTIP_EMPHASIS, chartColor, commonTooltip, escapeChartHtml, formatChartPercent } from './chartOptions';
import { formatCurrency } from '../../utils/formatters';

export function AssetAllocationChart({
  cash,
  commodities,
  facilities,
}: {
  cash: number;
  commodities: number;
  facilities: number;
}) {
  const rows = [
    { name: '现金', value: Math.max(0, cash), color: chartColor.success },
    { name: '商品', value: Math.max(0, commodities), color: chartColor.warning },
    { name: '工厂', value: Math.max(0, facilities), color: chartColor.info },
  ];
  const option = useMemo<EChartsCoreOption>(() => ({
    animation: false,
    aria: { enabled: true, description: '按资产毛值计算的现金、商品与工厂配置比例。' },
    tooltip: {
      ...commonTooltip,
      trigger: 'item',
      formatter: (params: any) => (
        `<strong>${escapeChartHtml(params?.name)}</strong>`
        + `<div><small>金额</small> ${escapeChartHtml(formatCurrency(Number(params?.value ?? 0)))}</div>`
        + `<div><small>占比</small> ${escapeChartHtml(formatChartPercent(Number(params?.percent ?? 0)))}</div>`
      ),
    },
    series: [{
      type: 'pie',
      radius: ['64%', '84%'],
      center: ['50%', '50%'],
      padAngle: PIE_PAD_ANGLE,
      label: { show: false },
      labelLine: { show: false },
      emphasis: STABLE_TOOLTIP_EMPHASIS,
      itemStyle: { borderColor: 'rgba(7,20,15,.9)', borderWidth: 2 },
      data: rows.map((row) => ({ name: row.name, value: row.value, itemStyle: { color: row.color } })),
    }],
  }), [cash, commodities, facilities]);

  return (
    <div className="asset-allocation-chart-shell">
      <EconomyChart
        option={option}
        className="asset-allocation-chart"
        ariaLabel="资产配置比例圆环图"
        accessibleSummary={rows.map((row) => `${row.name}${formatCurrency(row.value)}`).join('；')}
      />
      <div className="asset-allocation-chart__center" aria-hidden="true">
        <strong>资产配置</strong>
        <span>按毛值占比</span>
      </div>
    </div>
  );
}
