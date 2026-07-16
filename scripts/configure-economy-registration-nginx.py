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
BEGIN = "# BEGIN MANAGED ECONOMY REGISTRATION API PROXY"
END = "# END MANAGED ECONOMY REGISTRATION API PROXY"
REGISTRATION_PATH = "/economy-api/registration/"

REGISTRATION_BLOCK = """
    location ^~ /economy-api/registration/ {
        proxy_pass http://127.0.0.1:3002/api/registration/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        proxy_connect_timeout 5s;
        proxy_read_timeout 30s;
        client_max_body_size 16k;
    }
""".strip("\n")


def masked(text: str) -> str:
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


def has_registration_proxy(block: str) -> bool:
    return bool(re.search(
        rf"\blocation\s+(?:(?:\^~|=)\s+)?{re.escape(REGISTRATION_PATH)}\s*\{{",
        masked(block),
        re.IGNORECASE,
    ))


def managed_pattern() -> re.Pattern[str]:
    return re.compile(
        rf"^[ \t]*{re.escape(BEGIN)}.*?^[ \t]*{re.escape(END)}[ \t]*(?:\n|$)",
        re.MULTILINE | re.DOTALL,
    )


def replace_or_insert(block: str) -> str:
    pattern = managed_pattern()
    had_managed = bool(pattern.search(block))
    cleaned = pattern.sub("", block, count=1)
    if has_registration_proxy(cleaned):
        return re.sub(r"\n{3,}", "\n\n", cleaned) if had_managed else block
    closing = cleaned.rfind("}")
    if closing < 0:
        raise RuntimeError("Target server block has no closing brace")
    normalized = cleaned[:closing].rstrip()
    managed = f"    {BEGIN}\n{REGISTRATION_BLOCK}\n    {END}"
    return normalized + "\n\n" + managed + "\n" + cleaned[closing:]


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


def write_atomic(path: Path, content: str) -> None:
    descriptor, temp_name = tempfile.mkstemp(prefix=path.name + ".", dir=str(path.parent))
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8") as handle:
            handle.write(content)
        os.chmod(temp_name, path.stat().st_mode)
        os.replace(temp_name, path)
    finally:
        if os.path.exists(temp_name):
            os.unlink(temp_name)


def main() -> int:
    if os.geteuid() != 0:
        raise RuntimeError("This script must run as root")
    path, text, (start, end) = find_target()
    updated_block = replace_or_insert(text[start:end])
    updated = text[:start] + updated_block + text[end:]
    if updated == text:
        print(f"Economy registration API proxy already configured in {path}")
        return 0
    backup = path.with_suffix(path.suffix + ".economy-registration-proxy.bak")
    shutil.copy2(path, backup)
    try:
        write_atomic(path, updated)
        subprocess.run(["nginx", "-t"], check=True)
        subprocess.run(["systemctl", "reload", "nginx"], check=True)
    except Exception:
        shutil.copy2(backup, path)
        subprocess.run(["nginx", "-t"], check=False)
        raise
    print(f"Configured Economy registration API proxy in {path}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print(f"ECONOMY_REGISTRATION_PROXY_CONFIGURATION_FAILED: {error}", file=sys.stderr)
        raise SystemExit(1)
