import { init, use, type EChartsCoreOption, type EChartsType } from 'echarts/core';
import { BarChart, LineChart, PieChart } from 'echarts/charts';
import {
  AriaComponent,
  GridComponent,
  TooltipComponent,
} from 'echarts/components';
import { SVGRenderer } from 'echarts/renderers';

use([
  BarChart,
  LineChart,
  PieChart,
  GridComponent,
  TooltipComponent,
  AriaComponent,
  SVGRenderer,
]);

export { init as initECharts };
export type { EChartsCoreOption, EChartsType };
