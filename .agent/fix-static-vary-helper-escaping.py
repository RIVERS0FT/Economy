from pathlib import Path

path = Path('scripts/configure-economy-nginx.py')
text = path.read_text(encoding='utf-8')
start_marker = '\n\ndef ensure_static_vary_headers(block: str) -> tuple[str, bool]:\n'
end_marker = '\n\ndef masked(text: str) -> str:\n'
start = text.index(start_marker)
end = text.index(end_marker, start)
helper = r'''

def ensure_static_vary_headers(block: str) -> tuple[str, bool]:
    changed = False
    canonical_pattern = re.compile(
        r'(?im)^\s*add_header\s+Vary\s+"?Accept-Encoding"?\s+always\s*;\s*$',
    )
    vary_pattern = re.compile(
        r'(?im)^[ \t]*add_header\s+Vary\s+"?Accept-Encoding"?(?:\s+always)?\s*;[ \t]*(?:\n|$)',
    )

    for location_path in STATIC_LOCATION_PATHS:
        view = masked(block)
        location = re.search(
            rf"\blocation\s+(?:(?:\^~|=)\s+)?{re.escape(location_path)}\s*\{{",
            view,
            re.IGNORECASE,
        )
        if not location:
            raise RuntimeError(f"ECONOMY_STATIC_LOCATION_MISSING path={location_path}")

        opening = view.find("{", location.start())
        closing = matching_brace(block, opening)
        body = block[opening + 1 : closing]
        if canonical_pattern.search(masked(body)):
            continue

        body, _removed = vary_pattern.subn("", body)
        closing_line = block.rfind("\n", 0, closing) + 1
        closing_indent_match = re.match(r"[ \t]*", block[closing_line:closing])
        closing_indent = closing_indent_match.group(0) if closing_indent_match else ""
        directive_indent = closing_indent + "    "
        updated_body = (
            body.rstrip()
            + "\n"
            + directive_indent
            + STATIC_VARY_HEADER
            + "\n"
            + closing_indent
        )
        block = block[: opening + 1] + updated_body + block[closing:]
        changed = True

    return block, changed
'''
path.write_text(text[:start] + helper + text[end:], encoding='utf-8')
