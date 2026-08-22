from pathlib import Path

path = Path('scripts/migrate-static-map-design.py')
text = path.read_text(encoding='utf-8')
old = '镜头底色 \\\\+ 中性轮廓'
new = '镜头底色 \\+ 中性轮廓'
count = text.count(old)
if count != 1:
    raise SystemExit(f'migration focus regex fixer: expected one match, got {count}')
path.write_text(text.replace(old, new, 1), encoding='utf-8')
