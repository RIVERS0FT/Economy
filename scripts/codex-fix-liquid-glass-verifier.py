from pathlib import Path

path = Path('scripts/verify-liquid-glass-chrome.mjs')
source = path.read_text(encoding='utf-8')
old = "  'pageTransitionKey={model.tab}',\n"
new = "  'pageTransitionKey={playerPageLocationKey(pageLocation)}',\n  'data-strategic-page-location={playerPageLocationKey(pageLocation)}',\n"
if old not in source:
    raise SystemExit('stale pageTransitionKey verifier token not found')
path.write_text(source.replace(old, new, 1), encoding='utf-8')
