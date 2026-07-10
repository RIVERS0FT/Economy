#!/usr/bin/env python3
from __future__ import annotations

import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

DOMAIN = "game.riversoft.top"
BEGIN = "# BEGIN MANAGED ECONOMY API PROXY"
END = "# END MANAGED ECONOMY API PROXY"
MANAGED_BLOCK = f"""
    {BEGIN}
    location ^~ /economy-api/ {{
        proxy_pass http://127.0.0.1:3001/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        proxy_connect_timeout 5s;
        proxy_read_timeout 30s;
    }}
    {END}
""".strip("\n")


def masked(text: str) -> str:
    """Mask comments and quoted strings while preserving character offsets."""
    chars = list(text)
    index = 0
    quote: str | None = None

    while index < len(chars):
        char = chars[index]
        if quote:
            chars[index] = " "
            if char == "\\" and index + 1 < len(chars):
                index += 1
                chars[index] = " "
            elif char == quote:
                quote = None
            index += 1
            continue

        if char in ("'", '"'):
            quote = char
            chars[index] = " "
            index += 1
            continue

        if char == "#":
            while index < len(chars) and chars[index] != "\n":
                chars[index] = " "
                index += 1
            continue

        index += 1

    return "".join(chars)


def matching_brace(text: str, opening: int) -> int:
    view = masked(text)
    depth = 0

    for index in range(opening, len(view)):
        if view[index] == "{":
            depth += 1
        elif view[index] == "}":
            depth -= 1
            if depth == 0:
                return index

    raise RuntimeError("Unbalanced Nginx braces")


def server_blocks(text: str):
    view = masked(text)
    for match in re.finditer(r"\bserver\s*\{", view):
        opening = view.find("{", match.start())
        closing = matching_brace(text, opening)
        yield match.start(), closing + 1


def is_target_server(block: str) -> bool:
    clean = masked(block)
    has_domain = re.search(
        rf"\bserver_name\s+[^;]*\b{re.escape(DOMAIN)}\b[^;]*;",
        clean,
        re.IGNORECASE | re.DOTALL,
    )
    has_https = re.search(r"\blisten\s+[^;]*\b443\b[^;]*;", clean, re.IGNORECASE)
    return bool(has_domain and has_https)


def replace_or_insert(block: str) -> str:
    if BEGIN in block and END in block:
        pattern = re.compile(
            rf"^[ \t]*{re.escape(BEGIN)}.*?^[ \t]*{re.escape(END)}[ \t]*$",
            re.MULTILINE | re.DOTALL,
        )
        return pattern.sub(MANAGED_BLOCK, block, count=1)

    view = masked(block)
    location = re.search(
        r"\blocation\s+(?:\^~\s+)?(?:=\s+)?/economy-api/?\s*\{",
        view,
        re.IGNORECASE,
    )
    if location:
        opening = view.find("{", location.start())
        closing = matching_brace(block, opening)
        start = location.start()
        while start > 0 and block[start - 1] in " \t":
            start -= 1
        return block[:start] + MANAGED_BLOCK + block[closing + 1 :]

    closing = block.rfind("}")
    if closing < 0:
        raise RuntimeError("Target server block has no closing brace")

    return block[:closing].rstrip() + "\n\n" + MANAGED_BLOCK + "\n" + block[closing:]


def find_target() -> tuple[Path, str, tuple[int, int]]:
    roots = [
        Path("/etc/nginx/sites-enabled"),
        Path("/etc/nginx/conf.d"),
        Path("/etc/nginx/sites-available"),
    ]
    seen: set[Path] = set()

    for root in roots:
        if not root.exists():
            continue

        for candidate in sorted(root.glob("*")):
            if not candidate.is_file() and not candidate.is_symlink():
                continue

            resolved = candidate.resolve()
            if resolved in seen:
                continue
            seen.add(resolved)

            try:
                text = resolved.read_text(encoding="utf-8")
            except (OSError, UnicodeDecodeError):
                continue

            for start, end in server_blocks(text):
                if is_target_server(text[start:end]):
                    return resolved, text, (start, end)

    raise RuntimeError(f"No HTTPS Nginx server block found for {DOMAIN}")


def run(command: list[str]) -> None:
    subprocess.run(command, check=True)


def main() -> int:
    if os.geteuid() != 0:
        raise RuntimeError("This script must run as root")

    path, text, (start, end) = find_target()
    updated_block = replace_or_insert(text[start:end])
    updated = text[:start] + updated_block + text[end:]

    if updated == text:
        print(f"Economy API proxy already configured in {path}")
        run(["nginx", "-t"])
        run(["systemctl", "reload", "nginx"])
        return 0

    backup = path.with_suffix(path.suffix + ".economy-proxy.bak")
    shutil.copy2(path, backup)

    descriptor, temp_name = tempfile.mkstemp(prefix=path.name + ".", dir=str(path.parent))
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8") as handle:
            handle.write(updated)
        os.chmod(temp_name, path.stat().st_mode)
        os.replace(temp_name, path)

        try:
            run(["nginx", "-t"])
            run(["systemctl", "reload", "nginx"])
        except Exception:
            shutil.copy2(backup, path)
            subprocess.run(["nginx", "-t"], check=False)
            raise
    finally:
        if os.path.exists(temp_name):
            os.unlink(temp_name)

    print(f"Configured Economy API proxy in {path}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print(f"ECONOMY_PROXY_CONFIGURATION_FAILED: {error}", file=sys.stderr)
        raise SystemExit(1)
