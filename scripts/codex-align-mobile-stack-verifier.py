from pathlib import Path

path = Path('scripts/verify-mobile-page-sheet.mjs')
source = path.read_text(encoding='utf-8')
old = '''  "const showMap = useCallback(() => {\\n    model.setTab('map');",\n'''
new = '''  "const showMap = useCallback(() => {\\n    pageHistoryRef.current = [];\\n    applyPlayerPageLocation({ type: 'map' });",\n'''
if old not in source:
    raise SystemExit('stale mobile showMap verifier token not found')
path.write_text(source.replace(old, new, 1), encoding='utf-8')
