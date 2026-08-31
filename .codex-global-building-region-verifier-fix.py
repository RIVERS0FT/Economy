from pathlib import Path

path = Path('tests/browser/player-page-geometry.spec.ts')
text = path.read_text(encoding='utf-8')
old = "      await expect(page.locator('.global-facility-region-list')).toBeVisible();\n\n      const regionGeometry = await readPageGeometry(page);"
new = "      await expect(page.locator('.global-facility-region-list')).toBeVisible();\n      await expect(page.locator('.global-facility-region-row__quick-controls').first()).toBeVisible();\n\n      const regionGeometry = await readPageGeometry(page);"
count = text.count(old)
if count != 1:
    raise SystemExit(f'expected one region geometry anchor, got {count}')
path.write_text(text.replace(old, new, 1), encoding='utf-8', newline='\n')
print('Added regional two-line browser geometry assertion')