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
print('Updated market and ECharts architecture verifiers for the merge-capable chart lifecycle.')
