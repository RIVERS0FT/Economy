from pathlib import Path

path = Path(__file__).resolve().parents[1] / 'docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md'
content = path.read_text(encoding='utf-8')
old = '不得显示独立库存总量行。'
new = '不显示独立库存总量行。'
if content.count(old) != 1:
    raise RuntimeError(f'expected one match, found {content.count(old)}')
path.write_text(content.replace(old, new, 1), encoding='utf-8')
