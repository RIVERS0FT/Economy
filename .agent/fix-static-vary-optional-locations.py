from pathlib import Path

path = Path('scripts/configure-economy-nginx.py')
text = path.read_text(encoding='utf-8')
old = '''        if not location:
            raise RuntimeError(f"ECONOMY_STATIC_LOCATION_MISSING path={location_path}")
'''
new = '''        if not location:
            continue
'''
count = text.count(old)
if count != 1:
    raise SystemExit(f'expected one missing-location guard, found {count}')
path.write_text(text.replace(old, new, 1), encoding='utf-8')
