from pathlib import Path

replacements = {
  'scripts/verify-market-assets.mjs': [("'world.version = 13'", "'world.version = 14'")],
  'scripts/verify-facility-groups.mjs': [("'world.version = 13'", "'world.version = 14'")],
  'server/test/domain.test.js': [
    ('world.version, 13', 'world.version, 14'),
    ('state.version, 15', 'state.version, 16'),
    ('modelVersion, 6', 'modelVersion, 7'),
    ('market demand model 6', 'market demand model 7'),
  ],
  'server/test/market-liquidity.test.js': [
    ('modelVersion, 6', 'modelVersion, 7'),
    ('market demand model 6', 'market demand model 7'),
  ],
}
for filename, pairs in replacements.items():
    path = Path(filename)
    text = path.read_text()
    for old, new in pairs:
        text = text.replace(old, new)
    path.write_text(text)
Path('population-validation.log').unlink(missing_ok=True)
Path('scripts/update-population-version-guards.py').unlink()
Path('.github/workflows/update-population-version-guards.yml').unlink()
