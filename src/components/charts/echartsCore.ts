import { transformLocalCoordClear } from 'zrender/lib/core/dom.js';
import { getInstanceByDom, init, use, type EChartsCoreOption, type EChartsType } from 'echarts/core';
import { BarChart, LineChart, PieChart } from 'echarts/charts';
import {
  AriaComponent,
  AxisPointerComponent,
  GridComponent,
  TooltipComponent,
} from 'echarts/components';
import { SVGRenderer } from 'echarts/renderers';

use([
  BarChart,
  LineChart,
  PieChart,
  AxisPointerComponent,
  GridComponent,
  TooltipComponent,
  AriaComponent,
  SVGRenderer,
]);

export {
  getInstanceByDom as getEChartsInstanceByDom,
  init as initECharts,
};

export type { EChartsCoreOption, EChartsType };

const tooltipViewportGeometry = new WeakMap<HTMLElement, string>();

/** Refresh the library's bidirectional coordinate cache after a Sheet move/resize.
 * ZRender touch normalization can refresh the forward transform while leaving the
 * inverse from the entrance animation cached. Only the owning chart is cleared;
 * the shared tooltip host and its other charts are never recreated or mutated.
 */
export function syncEChartsTooltipCoordinates(chart: EChartsType) {
  const viewport = chart.getZr().painter.getViewportRoot();
  const rect = viewport.getBoundingClientRect();
  const geometry = `${rect.x}:${rect.y}:${rect.width}:${rect.height}`;
  if (tooltipViewportGeometry.get(viewport) === geometry) return;
  transformLocalCoordClear(viewport, chart.getDom());
  tooltipViewportGeometry.set(viewport, geometry);
}
