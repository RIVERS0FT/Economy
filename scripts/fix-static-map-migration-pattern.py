from pathlib import Path

path = Path('scripts/migrate-static-map-design.py')
text = path.read_text(encoding='utf-8')
lines = text.splitlines()

line_helper_matches = [index for index, line in enumerate(lines) if "return replace_once(text, rf'^{prefix_pattern}.*$', replacement, label)" in line]
if len(line_helper_matches) != 1:
    raise SystemExit(f'migration line helper fixer: expected one helper line, got {len(line_helper_matches)}')
slash = chr(92)
lines[line_helper_matches[0]] = (
    "    return replace_once(text, rf'^{prefix_pattern}[^"
    + slash
    + "n]*$', replacement, label)"
)

focus_matches = [index for index, line in enumerate(lines) if "'Chrome map focus bullet'" in line]
if len(focus_matches) != 1:
    raise SystemExit(f'migration focus fixer: expected one marker line, got {len(focus_matches)}')
replacement = [
    "focus_prefix = '- 战略地图州面交互固定采用“镜头底色 + 中性轮廓”分层'",
    "focus_lines = [line for line in chrome.splitlines() if line.startswith(focus_prefix)]",
    "if len(focus_lines) != 1:",
    "    raise SystemExit(f'Chrome map focus bullet: expected exactly one prefix match, got {len(focus_lines)}')",
    "chrome = chrome.replace(focus_lines[0], chrome_focus, 1)",
]
lines[focus_matches[0]:focus_matches[0] + 1] = replacement
path.write_text('\n'.join(lines) + '\n', encoding='utf-8')
