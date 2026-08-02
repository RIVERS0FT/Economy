import React from 'react';
import ReactDOM from 'react-dom/client';
import './app/interactionBootstrap';
import { AssetAllocationChart } from './components/charts/AssetAllocationChart';
import {
  DonutChart,
  HorizontalPercentChart,
  NumberBarChart,
  PlayerActivityChart,
  PopulationBudgetChart,
} from './components/charts/AdminCharts';
import { EconomyChart } from './components/charts/EconomyChart';
import type { EChartsCoreOption } from './components/charts/echartsCore';
import { STABLE_TOOLTIP_EMPHASIS, chartColor, commonTooltip } from './components/charts/chartOptions';
import './styles/globals.css';
import './styles/charts.css';
import './styles/design-system.css';
import './styles/interaction-states.css';

const activityPoints = [
  { day: '2026-08-01', startsAt: 0, covered: true, partialCoverage: false, newPlayers: 3, activePlayers: 8, firstActivities: 2, productionParticipants: 5, tradeParticipants: 3 },
  { day: '2026-08-02', startsAt: 1, covered: true, partialCoverage: true, newPlayers: 5, activePlayers: 11, firstActivities: 4, productionParticipants: 7, tradeParticipants: 4 },
];

const callbackColorOption: EChartsCoreOption = {
  animation: false,
  grid: { top: 12, right: 12, bottom: 28, left: 36 },
  tooltip: { ...commonTooltip, trigger: 'item' },
  xAxis: { type: 'category', data: ['回调颜色'] },
  yAxis: { type: 'value', min: 0 },
  series: [{
    type: 'bar',
    data: [12],
    itemStyle: { color: () => chartColor.success },
    emphasis: STABLE_TOOLTIP_EMPHASIS,
  }],
};

function ChartCase({ id, children }: { id: string; children: React.ReactNode }) {
  return <section data-testid={id}><h2>{id}</h2>{children}</section>;
}

function Runtime() {
  return (
    <main style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(320px, 1fr))', gap: 24, padding: 24 }}>
      <ChartCase id="player-activity-chart"><PlayerActivityChart points={activityPoints} /></ChartCase>
      <ChartCase id="horizontal-percent-chart"><HorizontalPercentChart rows={[{ label: 'D1', value: 72 }, { label: 'D7', value: 48 }]} ariaLabel="留存率测试" /></ChartCase>
      <ChartCase id="number-bar-chart"><NumberBarChart rows={[{ label: 'C1', value: 20 }, { label: 'C2', value: 12 }]} ariaLabel="数量柱图测试" /></ChartCase>
      <ChartCase id="population-budget-chart"><PopulationBudgetChart rows={[{ label: '基础人口', food: 68, household: 32 }, { label: '技术人口', food: 45, household: 55 }]} /></ChartCase>
      <ChartCase id="admin-donut-chart"><DonutChart rows={[{ label: '现金', value: 50 }, { label: '商品', value: 30 }, { label: '工厂', value: 20 }]} ariaLabel="管理员圆环测试" /></ChartCase>
      <ChartCase id="asset-allocation-chart"><AssetAllocationChart cash={500} commodities={300} facilities={200} /></ChartCase>
      <ChartCase id="callback-color-chart"><EconomyChart option={callbackColorOption} ariaLabel="颜色回调柱图测试" /></ChartCase>
    </main>
  );
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode><Runtime /></React.StrictMode>,
);
