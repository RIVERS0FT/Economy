from pathlib import Path

path = Path('scripts/configure-economy-nginx.py')
text = path.read_text(encoding='utf-8')
replacements = [
    (
        r'rf"\\blocation\\s+(?:(?:\\^~|=)\\s+)?{re.escape(location_path)}\\s*\\{{",'.replace('\\"', '"'),
        r'rf"\blocation\s+(?:(?:\^~|=)\s+)?{re.escape(location_path)}\s*\{{",'.replace('\\"', '"'),
    ),
    (
        r'''r'(?im)^\\s*add_header\\s+Vary\\s+"?Accept-Encoding"?\\s+always\\s*;\\s*$' ''`.strip().replace('`', ''),
        r'''r'(?im)^\s*add_header\s+Vary\s+"?Accept-Encoding"?\s+always\s*;\s*$' ''`.strip().replace('`', ''),
    ),
    (r'block.rfind("\\n", 0, closing)', r'block.rfind("\n", 0, closing)'),
    (r're.match(r"[ \\t]*",', r're.match(r"[ \t]*",'),
    (
        r'body.rstrip() + "\\n" + directive_indent + STATIC_VARY_HEADER + "\\n" + closing_indent',
        r'body.rstrip() + "\n" + directive_indent + STATIC_VARY_HEADER + "\n" + closing_indent',
    ),
]
for old, new in replacements:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'expected one escaping fragment, found {count}: {old!r}')
    text = text.replace(old, new, 1)
path.write_text(text, encoding='utf-8')
