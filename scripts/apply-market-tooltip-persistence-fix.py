from pathlib import Path

market_verify_path = Path('scripts/verify-market-chart.mjs')
market_verify = market_verify_path.read_text(encoding='utf-8')
old_market = "  'chartRef.current?.setOption', 'chart.dispose()', 'data-echarts-ready',"
new_market = "  'chart.setOption', 'chart.dispose()', 'data-echarts-ready',"
if old_market not in market_verify:
    raise SystemExit('Old market EconomyChart setOption verifier anchor missing')
market_verify_path.write_text(market_verify.replace(old_market, new_market), encoding='utf-8')

echarts_verify_path = Path('scripts/verify-echarts-adoption.mjs')
echarts_verify = echarts_verify_path.read_text(encoding='utf-8')
old_echarts = "  'chartRef.current?.setOption', 'chart.dispose()', 'data-echarts-ready', 'economy-chart__accessible-summary',"
new_echarts = "  'chart.setOption', 'chart.dispose()', 'data-echarts-ready', 'economy-chart__accessible-summary',\n  \"updateMode = 'replace'\", \"notMerge: updateMode !== 'merge'\",\n  'onChartReadyRef.current?.(chart)', 'onOptionAppliedRef.current?.(chart)',"
if old_echarts not in echarts_verify:
    raise SystemExit('Old ECharts adoption setOption verifier anchor missing')
echarts_verify_path.write_text(echarts_verify.replace(old_echarts, new_echarts), encoding='utf-8')

harness_path = Path('tests/browser/market-tooltip-persistence-harness.tsx')
harness = harness_path.read_text(encoding='utf-8')
root_import = "import { createRoot } from 'react-dom/client';\n"
bootstrap_import = "import '../../src/app/interactionBootstrap';\n"
if root_import not in harness:
    raise SystemExit('Tooltip harness React root import missing')
harness = harness.replace(root_import, root_import + bootstrap_import)
design_import = "import '../../src/styles/design-system.css';\n"
interaction_import = "import '../../src/styles/interaction-states.css';\n"
if design_import not in harness:
    raise SystemExit('Tooltip harness design-system import missing')
harness = harness.replace(design_import, design_import + interaction_import)
harness_path.write_text(harness, encoding='utf-8')

print('Updated verifiers and installed the shared interaction bootstrap/styles in the tooltip harness.')
