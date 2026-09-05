from pathlib import Path
p=Path('src/components/charts/echartsCore.ts');s=p.read_text();s="import { transformLocalCoordClear } from 'zrender/lib/core/dom.js';\n"+s
s+='''
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
''';p.write_text(s)
p=Path('src/components/charts/PriceSparkline.tsx');s=p.read_text().replace("import type { EChartsCoreOption, EChartsType } from './echartsCore';", "import { syncEChartsTooltipCoordinates, type EChartsCoreOption, type EChartsType } from './echartsCore';").replace('      const metrics = interactionGeometryRef.current;', '      syncEChartsTooltipCoordinates(chartInstance);\n      const metrics = interactionGeometryRef.current;');p.write_text(s)
p=Path('docs/MARKET_CHART_LAYOUT_DESIGN.md');s=p.read_text().replace('移动轻点绘图区立即选中日期并显示同一个 Tooltip，', '移动轻点绘图区立即选中日期并显示同一个 Tooltip；Sheet 位移或尺寸改变后，共享 ECharts 适配器需在主动显示前失效该图表的双向坐标转换缓存，避免触摸正向归一化留下入场动画期间的旧逆向转换。只在实际几何变化／首次显示时调用库提供的坐标清理接口，不修改库私有字段、不重建共享宿主、不逐帧创建新 Tooltip。');p.write_text(s)
p=Path('tests/browser/market-chart-pointer.spec.ts');s=p.read_text().replace("  expect(geometry.host).toBe('true');", "  expect(geometry.top).toBeGreaterThanOrEqual(geometry.safeTop);\n  expect(geometry.bottom).toBeLessThanOrEqual(geometry.safeBottom + 1);\n  expect(geometry.host).toBe('true');");p.write_text(s)
