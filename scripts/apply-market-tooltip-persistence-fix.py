from pathlib import Path

verify_path = Path('scripts/verify-market-chart.mjs')
verify = verify_path.read_text(encoding='utf-8')
old = "  'chartRef.current?.setOption', 'chart.dispose()', 'data-echarts-ready',"
new = "  'chart.setOption', 'chart.dispose()', 'data-echarts-ready',"
if old not in verify:
    raise SystemExit('Old EconomyChart setOption verifier anchor missing')
verify_path.write_text(verify.replace(old, new), encoding='utf-8')
print('Updated EconomyChart setOption verifier for the local chart lifecycle.')
