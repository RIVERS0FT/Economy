import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), 'utf8').replace(/\r\n?/g, '\n');
const failures = [];

function walk(directory) {
  return readdirSync(resolve(root, directory), { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name).replaceAll('\\', '/');
    return entry.isDirectory() ? walk(path) : [path];
  });
}
function requireText(path, fragments) {
  const content = read(path);
  for (const fragment of fragments) if (!content.includes(fragment)) failures.push(`${path} 缺少 ECharts 架构规则: ${fragment}`);
}
function forbidText(path, fragments) {
  const content = read(path);
  for (const fragment of fragments) if (content.includes(fragment)) failures.push(`${path} 不得恢复旧图表实现: ${fragment}`);
}
function requireCount(path, fragment, expected) {
  const content = read(path);
  const actual = content.split(fragment).length - 1;
  if (actual !== expected) failures.push(`${path} 必须包含 ${expected} 个 ${fragment}，当前为 ${actual}`);
}

const pkg = JSON.parse(read('package.json'));
if (pkg.dependencies?.echarts !== '6.1.0') failures.push('package.json 必须精确锁定 echarts 6.1.0');
if (pkg.dependencies?.['echarts-for-react'] || pkg.devDependencies?.['echarts-for-react']) failures.push('不得引入 echarts-for-react');
if (!pkg.scripts?.['verify:echarts']) failures.push('package.json 必须登记 verify:echarts');

const sourceFiles = walk('src').filter((path) => /\.(?:ts|tsx)$/.test(path));
const pieSeriesFiles = sourceFiles.filter((path) => /type:\s*['"]pie['"]/.test(read(path)));
for (const path of pieSeriesFiles) {
  const content = read(path);
  const pieSeriesCount = content.match(/type:\s*['"]pie['"]/g)?.length ?? 0;
  const padAngleCount = content.match(/padAngle:\s*PIE_PAD_ANGLE/g)?.length ?? 0;
  if (pieSeriesCount !== padAngleCount) {
    failures.push(`${path} 的每个 Pie 系列都必须使用共享 PIE_PAD_ANGLE，当前 Pie=${pieSeriesCount}、padAngle=${padAngleCount}`);
  }
}
const tooltipOptionFiles = sourceFiles.filter((path) => /\btooltip\s*:/.test(read(path)));
for (const path of tooltipOptionFiles) {
  const content = read(path);
  const tooltipOptionCount = content.match(/\btooltip\s*:/g)?.length ?? 0;
  const sharedTooltipCount = content.match(/\.\.\.commonTooltip/g)?.length ?? 0;
  if (tooltipOptionCount !== sharedTooltipCount) {
    failures.push(`${path} 的每个 ECharts Tooltip 都必须展开共享 commonTooltip，当前 Tooltip=${tooltipOptionCount}、commonTooltip=${sharedTooltipCount}`);
  }
}
const directEChartsImports = sourceFiles.filter((path) => /from ['"]echarts(?:\/|['"])/.test(read(path)));
if (directEChartsImports.length !== 1 || directEChartsImports[0] !== 'src/components/charts/echartsCore.ts') {
  failures.push(`ECharts 直接导入只能位于 echartsCore.ts，当前为: ${directEChartsImports.join(', ') || '无'}`);
}

requireText('src/components/charts/echartsCore.ts', [
  'BarChart', 'LineChart', 'PieChart', 'AxisPointerComponent', 'GridComponent', 'TooltipComponent', 'AriaComponent', 'SVGRenderer',
]);
forbidText('src/components/charts/echartsCore.ts', ['MapChart', 'GeoComponent', 'registerMap', 'registerEChartsMap']);
requireText('src/components/charts/chartOptions.ts', [
  'export const PIE_PAD_ANGLE = 5;', 'STABLE_TOOLTIP_EMPHASIS', 'disabled: true',
  "className: 'economy-chart-tooltip ui-tooltip-surface'", 'appendToBody: false', 'confine: true',
]);
requireText('src/components/charts/resolveEChartsCssColors.ts', [
  'resolveEChartsCssColors', 'resolveCssColorVariables', 'getComputedStyle(container)', 'propertyName?.endsWith', 'resolvedColorCallback',
]);
requireText('src/components/charts/EconomyChart.tsx', [
  'initECharts', "renderer: 'svg'", 'new ResizeObserver', 'requestAnimationFrame',
  'chart.setOption', 'chart.dispose()', 'data-echarts-ready', 'economy-chart__accessible-summary',
  "updateMode = 'replace'", "notMerge: updateMode !== 'merge'",
  'resolveEChartsCssColors', 'dataset.echartsCssColorsResolved', 'applyChartOption',
  'onChartReadyRef.current?.(chart)', 'onOptionAppliedRef.current?.(chart)',
  'hasRenderableSize', 'if (!hasRenderableSize(container)) return;',
  "chart.on('click', handleClick)", "chart.off('click', handleClick)",
  'useWorkspaceTooltipLayer', 'optionWithTooltipLayer', 'appendTo: tooltipLayer',
  "dataset.echartsTooltipLayer = tooltipLayer ? 'workspace' : 'local'",
]);
requireText('src/components/provinces/UsMainlandMap.tsx', [
  'province-map-world-svg', 'province-map-camera-surface', 'province-map-region',
  'createProvinceMapCamera', 'createProvinceMapProjection', 'layoutProvinceMapLabels',
  "className=\"economy-chart-tooltip ui-tooltip-surface province-map-tooltip province-map-static-tooltip\"",
  'useWorkspaceTooltipLayer', 'createPortal(tooltipNode, tooltipLayer)',
]);
forbidText('src/components/provinces/UsMainlandMap.tsx', [
  '<EconomyChart', "type: 'map'", 'registerEChartsMap', 'geoRoam', 'dispatchAction',
]);
requireText('src/components/charts/PriceSparkline.tsx', [
  '<EconomyChart', "type: 'line'", "type: 'bar'", 'buildMarketChartGeometry', 'data-volume-share', 'STABLE_TOOLTIP_EMPHASIS',
]);
requireCount('src/components/charts/PriceSparkline.tsx', 'emphasis: STABLE_TOOLTIP_EMPHASIS', 2);
requireText('src/components/charts/AssetAllocationChart.tsx', [
  '<EconomyChart', "type: 'pie'", "radius: ['64%', '84%']", 'padAngle: PIE_PAD_ANGLE', 'STABLE_TOOLTIP_EMPHASIS',
]);
requireCount('src/components/charts/AssetAllocationChart.tsx', 'emphasis: STABLE_TOOLTIP_EMPHASIS', 1);
requireText('src/components/charts/AdminCharts.tsx', [
  '<EconomyChart', "type: 'bar'", "type: 'pie'", 'padAngle: PIE_PAD_ANGLE', 'PopulationBudgetChart', 'STABLE_TOOLTIP_EMPHASIS',
]);
requireCount('src/components/charts/AdminCharts.tsx', 'emphasis: STABLE_TOOLTIP_EMPHASIS', 7);
requireText('src/main.tsx', ["import './styles/charts.css';"]);
requireText('tests/browser/chart-hover-visibility.spec.ts', [
  'data-echarts-css-colors-resolved', 'assertStableHover', 'economy-chart-tooltip', 'callback-color-chart',
]);
requireText('tests/browser/shell-floating-safe-zone.spec.ts', [
  'data-echarts-tooltip-layer', '.workspace-tooltip-layer', "element.matches(':popover-open')",
]);
requireText('docs/UI_DESIGN_SYSTEM.md', [
  '`EconomyChart` 是业务数据图表的唯一 React 入口', '不得引入 `echarts-for-react`',
  '战略地图不属于业务数据图表', '静态 SVG 世界面',
  '图表容器宽或高为 `0` 时必须延迟 `setOption` 并跳过 `resize`',
  '`PIE_PAD_ANGLE = 5`', '`padAngle: PIE_PAD_ANGLE`', 'STABLE_TOOLTIP_EMPHASIS',
  '不得把 `var(--color-*)` 原样交给 ZRender', '每次 `setOption` 前读取图表容器的浏览器计算样式',
  '`commonTooltip`', '`.ui-tooltip-surface`', '`.workspace-tooltip-layer`', '`appendTo`',
]);
requireText('docs/MARKET_CHART_LAYOUT_DESIGN.md', ['ECharts SVG', '双 Grid', '稳定 `data-*`']);
requireText('docs/GIFT_CODE_AND_ADMIN_DESIGN.md', ['玩家运营图统一使用共享 `EconomyChart`', '人口分析图统一使用共享 `EconomyChart`']);
requireText('docs/README.md', ['`UI_DESIGN_SYSTEM.md`', '`MARKET_CHART_LAYOUT_DESIGN.md`', '`GIFT_CODE_AND_ADMIN_DESIGN.md`']);

forbidText('src/components/charts/PriceSparkline.tsx', ['<svg', '<polyline', '<polygon', '<rect']);
forbidText('src/utils/assetAllocation.ts', ['CSSProperties', 'allocationStyle', 'conic-gradient']);
forbidText('src/components/AdminPlayerStatistics.tsx', ['function RatioBar', 'admin-player-statistics__trend-bars']);
forbidText('src/components/AdminPopulationHealth.tsx', ['function Bar(', 'admin-population-budget-split']);
forbidText('src/styles/admin-player-statistics.css', ['.admin-player-statistics__bar', '.admin-player-statistics__trend-bars']);
forbidText('src/styles/admin-overview-density.css', ['.admin-population-bar', '.admin-population-budget-split']);
forbidText('package-lock.json', ['echarts-for-react']);

if (failures.length) {
  console.error(`ECharts 架构验证失败:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log('ECharts 架构验证通过：唯一 EconomyChart 继续负责业务数据图表，战略地图使用独立静态 SVG 世界面与 SVG viewBox Camera；统一 commonTooltip 进入共享 Top Layer Tooltip 宿主，毛玻璃材质、精确依赖、SVG 按需模块、生命周期、无障碍、市场动态几何、统一 Pie padAngle 及管理员与资产图表均已锁定。');
