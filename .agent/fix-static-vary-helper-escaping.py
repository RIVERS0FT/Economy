from pathlib import Path

path = Path('scripts/configure-economy-nginx.py')
text = path.read_text(encoding='utf-8')
old = '''def ensure_static_vary_headers(block: str) -> tuple[str, bool]:
    changed = False
    for location_path in STATIC_LOCATION_PATHS:
        view = masked(block)
        location = re.search(
            rf"\\\\blocation\\\\s+(?:(?:\\\\^~|=)\\\\s+)?{re.escape(location_path)}\\\\s*\\\\{{",
            view,
            re.IGNORECASE,
        )
        if not location:
            raise RuntimeError(f"ECONOMY_STATIC_LOCATION_MISSING path={location_path}")

        opening = view.find("{", location.start())
        closing = matching_brace(block, opening)
        body = block[opening + 1 : closing]
        if re.search(
            r'(?im)^\\\\s*add_header\\\\s+Vary\\\\s+"?Accept-Encoding"?\\\\s+always\\\\s*;\\\\s*$',
            masked(body),
        ):
            continue

        closing_line = block.rfind("\\\\n", 0, closing) + 1
        closing_indent = re.match(r"[ \\\\t]*", block[closing_line:closing]).group(0)
        directive_indent = closing_indent + "    "
        updated_body = body.rstrip() + "\\\\n" + directive_indent + STATIC_VARY_HEADER + "\\\\n" + closing_indent
        block = block[: opening + 1] + updated_body + block[closing:]
        changed = True

    return block, changed
'''
new = '''def ensure_static_vary_headers(block: str) -> tuple[str, bool]:
    changed = False
    for location_path in STATIC_LOCATION_PATHS:
        view = masked(block)
        location = re.search(
            rf"\\blocation\\s+(?:(?:\\^~|=)\\s+)?{re.escape(location_path)}\\s*\\{{",
            view,
            re.IGNORECASE,
        )
        if not location:
            raise RuntimeError(f"ECONOMY_STATIC_LOCATION_MISSING path={location_path}")

        opening = view.find("{", location.start())
        closing = matching_brace(block, opening)
        body = block[opening + 1 : closing]
        if re.search(
            r'(?im)^\\s*add_header\\s+Vary\\s+"?Accept-Encoding"?\\s+always\\s*;\\s*$',
            masked(body),
        ):
            continue

        closing_line = block.rfind("\\n", 0, closing) + 1
        closing_indent = re.match(r"[ \\t]*", block[closing_line:closing]).group(0)
        directive_indent = closing_indent + "    "
        updated_body = body.rstrip() + "\\n" + directive_indent + STATIC_VARY_HEADER + "\\n" + closing_indent
        block = block[: opening + 1] + updated_body + block[closing:]
        changed = True

    return block, changed
'''
count = text.count(old)
if count != 1:
    raise SystemExit(f'expected one helper block, found {count}')
path.write_text(text.replace(old, new, 1), encoding='utf-8')
