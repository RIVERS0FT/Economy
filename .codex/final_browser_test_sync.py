from pathlib import Path

path = Path('tests/browser/market-runtime.spec.ts')
text = path.read_text(encoding='utf-8')
old = "page.getByRole('textbox', { name: '价格' })"
new = "page.getByRole('textbox', { name: '价格', exact: true })"
count = text.count(old)
if count < 1:
    raise SystemExit('market-runtime.spec.ts: no ambiguous manual price locators found')
path.write_text(text.replace(old, new), encoding='utf-8')
print(f'updated {count} manual price locators')
