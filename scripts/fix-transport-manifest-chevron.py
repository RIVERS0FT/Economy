from pathlib import Path

path = Path('src/pages/TransportPage.tsx')
text = path.read_text(encoding='utf-8')
old = '<span>→ {provinceById.get(entry.destinationProvinceId)?.name ?? entry.destinationProvinceId}</span>'
new = '<span><ChevronIcon direction="right" />{provinceById.get(entry.destinationProvinceId)?.name ?? entry.destinationProvinceId}</span>'
if text.count(old) != 1:
    raise SystemExit(f'expected one manifest text arrow, got {text.count(old)}')
path.write_text(text.replace(old, new, 1), encoding='utf-8')
print('transport manifest chevron aligned')
