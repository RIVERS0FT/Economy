import { getInstanceByDom, init, use, type EChartsCoreOption, type EChartsType } from 'echarts/core';
import { BarChart, LineChart, PieChart } from 'echarts/charts';
import {
  AriaComponent,
  AxisPointerComponent,
  GridComponent,
  TooltipComponent,
} from 'echarts/components';
import { SVGRenderer } from 'echarts/renderers';
import { transformLocalCoordClear } from 'zrender/lib/core/dom.js';

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

/** Invalidate both renderer coordinate directions after a Sheet moves.
 * ZRender 6.1 shares the bounds stamp for forward/inverse transforms; a touch
 * event can refresh one direction while leaving the other at the old position.
 * Use its exported cleanup rather than reading or patching private cache fields.
 */
export function createTooltipCoordinateGuard(chart: EChartsType, host: HTMLElement) {
  let previousBounds: number[] | null = null;
  let previousViewport: HTMLElement | null = null;
  return () => {
    if (chart.isDisposed()) return;
    const viewport = chart.getZr().painter.getViewportRoot();
    const source = viewport.getBoundingClientRect();
    const target = host.getBoundingClientRect();
    const bounds = [source.left, source.top, source.width, source.height,
      target.left, target.top, target.width, target.height];
    if (previousViewport === viewport && previousBounds?.every((value, index) => value === bounds[index])) return;
    transformLocalCoordClear(viewport, host);
    previousViewport = viewport;
    previousBounds = bounds;
  };
}

export type { EChartsCoreOption, EChartsType };
