from pathlib import Path

path = Path('scripts/migrate-static-map-design.py')
text = path.read_text(encoding='utf-8')
lines = text.splitlines()
matches = [index for index, line in enumerate(lines) if "'Chrome map focus bullet'" in line]
if len(matches) != 1:
    raise SystemExit(f'migration focus regex fixer: expected one marker line, got {len(matches)}')
slash = chr(92)
lines[matches[0]] = (
    "chrome = replace_line(chrome, r'- 战略地图州面交互固定采用“镜头底色 "
    + slash
    + "+ 中性轮廓”分层', chrome_focus, 'Chrome map focus bullet')"
)
path.write_text('\n'.join(lines) + '\n', encoding='utf-8')
