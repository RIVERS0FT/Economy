from pathlib import Path

path = Path('scripts/verify-provincial-economy.mjs')
text = path.read_text(encoding='utf-8')
old = "}) assert.ok(mapComponent.includes(text), `ECharts 美国本土地图缺少: ${text}`);"
new = "]) assert.ok(mapComponent.includes(text), `ECharts 美国本土地图缺少: ${text}`);"
if text.count(old) != 1:
    raise SystemExit(f'expected exactly one malformed verifier closing token, found {text.count(old)}')
path.write_text(text.replace(old, new, 1), encoding='utf-8')
