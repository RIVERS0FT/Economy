from pathlib import Path

invalid = "'data-liquid-glass-over-light={GLOBAL_OVER_LIGHT ? 'true' : 'false'}',"
valid = '"data-liquid-glass-over-light={GLOBAL_OVER_LIGHT ? \'true\' : \'false\'}",'

for path in [
    'scripts/verify-auth-three-layer.mjs',
    'scripts/verify-liquid-glass-chrome.mjs',
    'scripts/verify-desktop-primary-surfaces.mjs',
]:
    file = Path(path)
    text = file.read_text(encoding='utf-8')
    if invalid not in text:
        raise SystemExit(f'missing invalid verifier string in {path}')
    file.write_text(text.replace(invalid, valid), encoding='utf-8')
