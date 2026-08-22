from pathlib import Path

path = Path('scripts/migrate-static-map-design.py')
text = path.read_text(encoding='utf-8')
lines = text.splitlines()
matches = [index for index, line in enumerate(lines) if "'Chrome map focus bullet'" in line]
if len(matches) != 1:
    raise SystemExit(f'migration focus fixer: expected one marker line, got {len(matches)}')
replacement = [
    "focus_prefix = '- 战略地图州面交互固定采用“镜头底色 + 中性轮廓”分层'",
    "focus_lines = [line for line in chrome.splitlines() if line.startswith(focus_prefix)]",
    "if len(focus_lines) != 1:",
    "    raise SystemExit(f'Chrome map focus bullet: expected exactly one prefix match, got {len(focus_lines)}')",
    "chrome = chrome.replace(focus_lines[0], chrome_focus, 1)",
]
lines[matches[0]:matches[0] + 1] = replacement
path.write_text('\n'.join(lines) + '\n', encoding='utf-8')
