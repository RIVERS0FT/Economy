import { init, registerMap, use, type EChartsCoreOption, type EChartsType } from 'echarts/core';
import { BarChart, LineChart, MapChart, PieChart } from 'echarts/charts';
import {
  AriaComponent,
  AxisPointerComponent,
  GeoComponent,
  GridComponent,
  TooltipComponent,
} from 'echarts/components';
import { SVGRenderer } from 'echarts/renderers';

use([
  BarChart,
  LineChart,
  MapChart,
  PieChart,
  AxisPointerComponent,
  GeoComponent,
  GridComponent,
  TooltipComponent,
  AriaComponent,
  SVGRenderer,
]);

export { init as initECharts };

export function registerEChartsMap(mapName: string, source: unknown) {
  registerMap(mapName, source as Parameters<typeof registerMap>[1]);
}

export type { EChartsCoreOption, EChartsType };
