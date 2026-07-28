#!/usr/bin/env python3
from __future__ import annotations

import gzip
import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

DOMAIN = "game.riversoft.top"
LOCAL_ORIGIN = "http://127.0.0.1"
STATIC_WEB_ROOT = Path("/var/www/game/economy")
ACCOUNT_SNIPPET = "/etc/nginx/snippets/game-riversoft-economy-account.conf"
GAME_API_SNIPPET = "/etc/nginx/snippets/game-riversoft-economy-game-api.conf"
BEGIN = "# BEGIN MANAGED ECONOMY API PROXY"
END = "# END MANAGED ECONOMY API PROXY"
STATIC_COMPRESSION_BEGIN = "# BEGIN MANAGED ECONOMY STATIC COMPRESSION"
STATIC_COMPRESSION_END = "# END MANAGED ECONOMY STATIC COMPRESSION"
GAME_API_COMPRESSION = (
    ("gzip", "on"),
    ("gzip_vary", "on"),
    ("gzip_proxied", "any"),
    ("gzip_min_length", "1024"),
    ("gzip_comp_level", "5"),
    ("gzip_types", "application/json"),
)
STATIC_COMPRESSION = (
    ("gzip", "on"),
    ("gzip_vary", "on"),
    ("gzip_proxied", "any"),
    ("gzip_min_length", "1024"),
    ("gzip_comp_level", "6"),
    (
        "gzip_types",
        "text/css text/plain text/javascript application/javascript application/json "
        "application/manifest+json application/xml application/xhtml+xml application/rss+xml "
        "application/atom+xml image/svg+xml application/wasm",
    ),
)
STATIC_COMPRESSION_NAMES = frozenset(name for name, _value in STATIC_COMPRESSION)

ACCOUNT_BLOCK = """
    location = /economy-api/login {
        proxy_pass http://127.0.0.1:3001/api/login;
        proxy_http_version 1.1;
        proxy_set_header Host riversoft.top;
        proxy_set_header X-Forwarded-Host riversoft.top;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header Origin "";
        proxy_cookie_path / /;
    }

    location = /economy-api/me {
        proxy_pass http://127.0.0.1:3001/api/me;
        proxy_http_version 1.1;
        proxy_set_header Host riversoft.top;
        proxy_set_header X-Forwarded-Host riversoft.top;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header Origin "";
        proxy_cookie_path / /;
    }

    location = /economy-api/logout {
        proxy_pass http://127.0.0.1:3001/api/logout;
        proxy_http_version 1.1;
        proxy_set_header Host riversoft.top;
        proxy_set_header X-Forwarded-Host riversoft.top;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header Origin "";
        proxy_cookie_path / /;
    }
""".strip("\n")

GAME_API_BLOCK = """
    location ^~ /economy-api/game/ {
        proxy_pass http://127.0.0.1:3002/api/game/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        proxy_connect_timeout 5s;
        proxy_read_timeout 30s;
        client_max_body_size 256k;
        gzip on;
        gzip_vary on;
        gzip_proxied any;
        gzip_min_length 1024;
        gzip_comp_level 5;
        gzip_types application/json;
    }
""".strip("\n")


def managed_block(*, account: bool, game_api: bool) -> str:
    sections = []
    if account:
        sections.append(ACCOUNT_BLOCK)
    if game_api:
        sections.append(GAME_API_BLOCK)
    if not sections:
        return ""
    return f"    {BEGIN}\n" + "\n\n".join(sections) + f"\n    {END}"


def managed_pattern() -> re.Pattern[str]:
    return re.compile(
        rf"^[ \t]*{re.escape(BEGIN)}.*?^[ \t]*{re.escape(END)}[ \t]*(?:\n|$)",
        re.MULTILINE | re.DOTALL,
    )


def static_compression_block() -> str:
    directives = "\n".join(
        f"    {name} {value};"
        for name, value in STATIC_COMPRESSION
    )
    return (
        f"    {STATIC_COMPRESSION_BEGIN}\n"
        f"{directives}\n"
        f"    {STATIC_COMPRESSION_END}"
    )


def static_compression_pattern() -> re.Pattern[str]:
    return re.compile(
        rf"^[ \t]*{re.escape(STATIC_COMPRESSION_BEGIN)}.*?"
        rf"^[ \t]*{re.escape(STATIC_COMPRESSION_END)}[ \t]*(?:\n|$)",
        re.MULTILINE | re.DOTALL,
    )


def remove_top_level_directives(text: str, names: frozenset[str]) -> str:
    view = masked(text)
    removals: list[tuple[int, int]] = []
    depth = 0
    line_start = 0
    index = 0

    while index < len(view):
        if index == line_start and depth == 1:
            line_end = view.find("\n", index)
            if line_end < 0:
                line_end = len(view)
            match = re.match(r"[ \t]*([A-Za-z0-9_]+)\b", view[index:line_end])
            if match and match.group(1) in names:
                semicolon = view.find(";", index)
                if semicolon < 0:
                    raise RuntimeError(f"Missing semicolon for {match.group(1)}")
                nested_opening = view.find("{", index, semicolon)
                nested_closing = view.find("}", index, semicolon)
                if nested_opening >= 0 or nested_closing >= 0:
                    raise RuntimeError(f"Unexpected block in {match.group(1)} directive")
                end = semicolon + 1
                while end < len(text) and text[end] in " \t":
                    end += 1
                if end < len(text) and text[end] == "\n":
                    end += 1
                removals.append((index, end))
                index = end
                line_start = end
                continue

        char = view[index]
        if char == "{":
            depth += 1
        elif char == "}":
            depth -= 1
        elif char == "\n":
            line_start = index + 1
        index += 1

    for start, end in reversed(removals):
        text = text[:start] + text[end:]
    return text


def ensure_static_compression(block: str) -> tuple[str, bool]:
    cleaned = static_compression_pattern().sub("", block, count=1)
    cleaned = remove_top_level_directives(cleaned, STATIC_COMPRESSION_NAMES)
    closing = cleaned.rfind("}")
    if closing < 0:
        raise RuntimeError("Target server block has no closing brace")
    normalized = cleaned[:closing].rstrip()
    updated = normalized + "\n\n" + static_compression_block() + "\n" + cleaned[closing:]
    return updated, updated != block


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


def has_include(block: str, path: str) -> bool:
    return bool(
        re.search(
            rf"\binclude\s+{re.escape(path)}\s*;",
            masked(block),
            re.IGNORECASE,
        )
    )


def has_location(block: str, path: str) -> bool:
    return bool(
        re.search(
            rf"\blocation\s+(?:(?:\^~|=)\s+)?{re.escape(path)}\s*\{{",
            masked(block),
            re.IGNORECASE,
        )
    )


def has_account_proxy(block: str) -> bool:
    return has_include(block, ACCOUNT_SNIPPET) or all(
        has_location(block, path)
        for path in (
            "/economy-api/login",
            "/economy-api/me",
            "/economy-api/logout",
        )
    )


def has_game_api_proxy(block: str) -> bool:
    return has_include(block, GAME_API_SNIPPET) or has_location(
        block, "/economy-api/game/"
    )


def ensure_game_api_compression(text: str) -> tuple[str, bool]:
    view = masked(text)
    location = re.search(
        r"\blocation\s+(?:(?:\^~|=)\s+)?/economy-api/game/\s*\{",
        view,
        re.IGNORECASE,
    )
    if not location:
        return text, False

    opening = view.find("{", location.start())
    closing = matching_brace(text, opening)
    body = text[opening + 1 : closing]
    clean_body = masked(body)
    canonical = all(
        re.search(
            rf"(?m)^\s*{re.escape(name)}\s+{re.escape(value)}\s*;\s*$",
            clean_body,
        )
        for name, value in GAME_API_COMPRESSION
    )
    if canonical:
        return text, False

    for name, _ in GAME_API_COMPRESSION:
        body = re.sub(
            rf"(?im)^[ \t]*{re.escape(name)}\s+[^;]*;[ \t]*(?:\n|$)",
            "",
            body,
        )

    closing_line = text.rfind("\n", 0, closing) + 1
    closing_indent = re.match(r"[ \t]*", text[closing_line:closing]).group(0)
    directive_indent = closing_indent + "    "
    directives = "\n".join(
        f"{directive_indent}{name} {value};"
        for name, value in GAME_API_COMPRESSION
    )
    updated_body = body.rstrip() + "\n" + directives + "\n" + closing_indent
    return text[: opening + 1] + updated_body + text[closing:], True


def remove_legacy_economy_api_location(block: str) -> tuple[str, bool]:
    view = masked(block)
    location = re.search(
        r"\blocation\s+(?:(?:\^~|=)\s+)?/economy-api/?\s*\{",
        view,
        re.IGNORECASE,
    )
    if not location:
        return block, False

    opening = view.find("{", location.start())
    closing = matching_brace(block, opening)
    start = location.start()
    while start > 0 and block[start - 1] in " \t":
        start -= 1
    end = closing + 1
    if end < len(block) and block[end] == "\n":
        end += 1
    return block[:start] + block[end:], True


def replace_or_insert(block: str) -> str:
    pattern = managed_pattern()
    had_managed = bool(pattern.search(block))
    cleaned = pattern.sub("", block, count=1)
    cleaned, removed_legacy = remove_legacy_economy_api_location(cleaned)
    cleaned, added_compression = ensure_game_api_compression(cleaned)
    cleaned, added_static_compression = ensure_static_compression(cleaned)

    include_account = not has_account_proxy(cleaned)
    include_game_api = not has_game_api_proxy(cleaned)
    desired = managed_block(account=include_account, game_api=include_game_api)

    if not desired:
        if not had_managed and not removed_legacy and not added_compression and not added_static_compression:
            return block
        return re.sub(r"\n{3,}", "\n\n", cleaned)

    closing = cleaned.rfind("}")
    if closing < 0:
        raise RuntimeError("Target server block has no closing brace")
    normalized = cleaned[:closing].rstrip()
    return normalized + "\n\n" + desired + "\n" + cleaned[closing:]


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


def parse_http_headers(text: str) -> dict[str, str]:
    headers: dict[str, str] = {}
    for line in text.replace("\r", "").splitlines():
        if ":" not in line:
            continue
        name, value = line.split(":", 1)
        key = name.strip().lower()
        normalized = value.strip()
        if key in headers:
            headers[key] = headers[key] + ", " + normalized
        else:
            headers[key] = normalized
    return headers


def find_static_asset_paths(html: str) -> tuple[str, str]:
    javascript = re.search(r'src="(?P<path>/economy/assets/[^" ]+\.js)"', html)
    stylesheet = re.search(r'href="(?P<path>/economy/assets/[^" ]+\.css)"', html)
    if not javascript:
        raise RuntimeError("ECONOMY_STATIC_JAVASCRIPT_NOT_FOUND")
    if not stylesheet:
        raise RuntimeError("ECONOMY_STATIC_CSS_NOT_FOUND")
    return javascript.group("path"), stylesheet.group("path")


def validate_gzip_payload(
    label: str,
    headers: dict[str, str],
    payload: bytes,
    source: bytes,
) -> tuple[int, int]:
    if headers.get("content-encoding", "").lower() != "gzip":
        raise RuntimeError(f"ECONOMY_STATIC_GZIP_MISSING label={label}")
    if "accept-encoding" not in headers.get("vary", "").lower():
        raise RuntimeError(f"ECONOMY_STATIC_GZIP_VARY_MISSING label={label}")
    try:
        decoded = gzip.decompress(payload)
    except (OSError, EOFError) as error:
        raise RuntimeError(f"ECONOMY_STATIC_GZIP_INVALID label={label}: {error}") from error
    if decoded != source:
        raise RuntimeError(f"ECONOMY_STATIC_GZIP_CONTENT_MISMATCH label={label}")
    if len(payload) >= len(source):
        raise RuntimeError(
            f"ECONOMY_STATIC_GZIP_NOT_SMALLER label={label} "
            f"source_bytes={len(source)} wire_bytes={len(payload)}"
        )
    return len(source), len(payload)


def fetch_local_response(path: str, *, accept_gzip: bool) -> tuple[dict[str, str], bytes]:
    with tempfile.TemporaryDirectory(prefix="economy-gzip-check-") as directory:
        root = Path(directory)
        headers_path = root / "headers.txt"
        body_path = root / "body.bin"
        command = [
            "curl",
            "--fail",
            "--silent",
            "--show-error",
            "--http1.1",
            "--header",
            f"Host: {DOMAIN}",
            "--dump-header",
            str(headers_path),
            "--output",
            str(body_path),
        ]
        if accept_gzip:
            command.extend(["--header", "Accept-Encoding: gzip"])
        command.append(f"{LOCAL_ORIGIN}{path}")
        run(command)
        return (
            parse_http_headers(headers_path.read_text(encoding="utf-8", errors="replace")),
            body_path.read_bytes(),
        )


def static_source_path(public_path: str) -> Path:
    prefix = "/economy/"
    if not public_path.startswith(prefix):
        raise RuntimeError(f"ECONOMY_STATIC_PATH_INVALID path={public_path}")
    relative = public_path[len(prefix):]
    candidate = (STATIC_WEB_ROOT / relative).resolve()
    root = STATIC_WEB_ROOT.resolve()
    if candidate != root and root not in candidate.parents:
        raise RuntimeError(f"ECONOMY_STATIC_PATH_ESCAPE path={public_path}")
    return candidate


def verify_static_compression() -> None:
    _plain_headers, plain_html = fetch_local_response("/economy/", accept_gzip=False)
    javascript_path, stylesheet_path = find_static_asset_paths(plain_html.decode("utf-8"))
    targets = (
        ("html", "/economy/", STATIC_WEB_ROOT / "index.html"),
        ("javascript", javascript_path, static_source_path(javascript_path)),
        ("css", stylesheet_path, static_source_path(stylesheet_path)),
    )
    for label, public_path, source_path in targets:
        if not source_path.is_file():
            raise RuntimeError(f"ECONOMY_STATIC_SOURCE_MISSING label={label} path={source_path}")
        headers, payload = fetch_local_response(public_path, accept_gzip=True)
        source_bytes, wire_bytes = validate_gzip_payload(
            label,
            headers,
            payload,
            source_path.read_bytes(),
        )
        print(
            f"ECONOMY_STATIC_GZIP_VERIFIED label={label} "
            f"source_bytes={source_bytes} wire_bytes={wire_bytes}"
        )


def main() -> int:
    if os.geteuid() != 0:
        raise RuntimeError("This script must run as root")

    path, text, (start, end) = find_target()
    updated_block = replace_or_insert(text[start:end])
    updated = text[:start] + updated_block + text[end:]
    changes = []
    if updated != text:
        changes.append((path, text, updated))

    snippet_path = Path(GAME_API_SNIPPET)
    if snippet_path.exists():
        snippet_text = snippet_path.read_text(encoding="utf-8")
        snippet_updated, snippet_changed = ensure_game_api_compression(snippet_text)
        if snippet_changed:
            changes.append((snippet_path, snippet_text, snippet_updated))

    backups = []
    try:
        for changed_path, _original, changed_content in changes:
            backup = changed_path.with_suffix(changed_path.suffix + ".economy-proxy.bak")
            shutil.copy2(changed_path, backup)
            backups.append((changed_path, backup))
            write_atomic(changed_path, changed_content)
        run(["nginx", "-t"])
        run(["systemctl", "reload", "nginx"])
        verify_static_compression()
    except Exception:
        for changed_path, backup in reversed(backups):
            shutil.copy2(backup, changed_path)
        subprocess.run(["nginx", "-t"], check=False)
        subprocess.run(["systemctl", "reload", "nginx"], check=False)
        raise

    if changes:
        print("Configured Economy API proxy and static compression in " + ", ".join(str(item[0]) for item in changes))
    else:
        print(f"Economy API proxy and static compression already configured in {path}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print(f"ECONOMY_PROXY_CONFIGURATION_FAILED: {error}", file=sys.stderr)
        raise SystemExit(1)
