from pathlib import Path

path = Path('scripts/_temporary_apply_mobile_map_fix.py')
text = path.read_text(encoding='utf-8')
old = "}) assert.ok(mapComponent.includes(text), `ECharts 美国本土地图缺少: ${text}`);\\nfor (const forbidden of [\\n"
new = "]) assert.ok(mapComponent.includes(text), `ECharts 美国本土地图缺少: ${text}`);\\nfor (const forbidden of [\\n"
if old not in text:
    raise SystemExit('temporary patch assertion needle was not found')
path.write_text(text.replace(old, new, 1), encoding='utf-8')
