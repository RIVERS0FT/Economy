from pathlib import Path

path = Path('scripts/verify-provincial-economy.mjs')
text = path.read_text(encoding='utf-8')
old = "  'if (event.target) return;',"
new = "  \"if (event.target || event.event?.pointerType === 'touch') return;\","
count = text.count(old)
if count != 1:
    raise SystemExit(f'expected exactly one old map double-click verifier fragment, found {count}')
path.write_text(text.replace(old, new, 1), encoding='utf-8')
