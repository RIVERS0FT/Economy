from pathlib import Path

path = Path('scripts/verify-game-shell-layout.mjs')
content = path.read_text(encoding='utf-8')
old = '  "role="tooltip"", \'floatingLayer.getBoundingClientRect()\','
new = '  \'role="tooltip"\', \'floatingLayer.getBoundingClientRect()\','
if old not in content:
    raise SystemExit('Generated tooltip verifier quote anchor missing')
path.write_text(content.replace(old, new, 1), encoding='utf-8')
print('Fixed SafeTooltip verifier quoting.')
