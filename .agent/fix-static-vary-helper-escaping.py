from pathlib import Path

path = Path('scripts/configure-economy-nginx.py')
text = path.read_text(encoding='utf-8')
replacements = [
    (
        '            rf"\\\\blocation\\\\s+(?:(?:\\\\^~|=)\\\\s+)?{re.escape(location_path)}\\\\s*\\\\{{",',
        '            rf"\\blocation\\s+(?:(?:\\^~|=)\\s+)?{re.escape(location_path)}\\s*\\{{",',
    ),
    (
        """            r'(?im)^\\\\s*add_header\\\\s+Vary\\\\s+"?Accept-Encoding"?\\\\s+always\\\\s*;\\\\s*$',""",
        """            r'(?im)^\\s*add_header\\s+Vary\\s+"?Accept-Encoding"?\\s+always\\s*;\\s*$',""",
    ),
    (
        '        closing_line = block.rfind("\\\\n", 0, closing) + 1',
        '        closing_line = block.rfind("\\n", 0, closing) + 1',
    ),
    (
        '        closing_indent = re.match(r"[ \\\\t]*", block[closing_line:closing]).group(0)',
        '        closing_indent = re.match(r"[ \\t]*", block[closing_line:closing]).group(0)',
    ),
    (
        '        updated_body = body.rstrip() + "\\\\n" + directive_indent + STATIC_VARY_HEADER + "\\\\n" + closing_indent',
        '        updated_body = body.rstrip() + "\\n" + directive_indent + STATIC_VARY_HEADER + "\\n" + closing_indent',
    ),
]
for old, new in replacements:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'expected one escaping fragment, found {count}: {old!r}')
    text = text.replace(old, new, 1)
path.write_text(text, encoding='utf-8')
