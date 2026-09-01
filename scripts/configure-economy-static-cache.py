#!/usr/bin/env python3
from __future__ import annotations

import os
import re
import shutil
import stat
import subprocess
import tempfile
import time
from pathlib import Path

DOMAIN = "game.riversoft.top"
LOCAL_ORIGIN = f"https://{DOMAIN}"
STATIC_WEB_ROOT = Path("/var/www/game/economy")
STATIC_ASSET_CACHE_CONTROL = "public, max-age=31536000, immutable"
STATIC_HTML_CACHE_CONTROL = "no-cache, max-age=0, must-revalidate"
STATIC_VARY_VALUE = "Accept-Encoding"
STATIC_LOCATION_CACHE = {
    "/economy/assets/": STATIC_ASSET_CACHE_CONTROL,
    "/economy/": STATIC_HTML_CACHE_CONTROL,
}
STATIC_VERIFY_ATTEMPTS = 20
STATIC_VERIFY_RETRY_DELAY_SECONDS = 0.25
NGINX_CONFIG_ROOTS = (
    Path("/etc/nginx/sites-enabled"),
    Path("/etc/nginx/conf.d"),
    Path("/etc/nginx/sites-available"),
    Path("/etc/nginx/snippets"),
)
NGINX_BACKUP_NAME_PATTERN = re.compile(
    r"(?:^|[._-])(?:bak|backup)(?:$|[._-])",
    re.IGNORECASE,
)
NGINX_BACKUP_DIRECTORY = Path("/var/tmp/economy-nginx-backups")


def create_nginx_backup(path: Path) -> Path:
    NGINX_BACKUP_DIRECTORY.mkdir(parents=True, exist_ok=True)
    descriptor, backup_name = tempfile.mkstemp(
        prefix=f"{path.name}.",
        suffix=".bak",
        dir=NGINX_BACKUP_DIRECTORY,
    )
    os.close(descriptor)
    backup = Path(backup_name)
    shutil.copy2(path, backup)
    return backup


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


def is_nginx_backup_path(path: Path) -> bool:
    return bool(NGINX_BACKUP_NAME_PATTERN.search(path.name))


def nginx_config_files():
    seen: set[Path] = set()
    for root in NGINX_CONFIG_ROOTS:
        if not root.exists():
            continue
        for candidate in sorted(root.glob("*")):
            if is_nginx_backup_path(candidate):
                continue
            try:
                if not candidate.is_file() and not candidate.is_symlink():
                    continue
                resolved = candidate.resolve()
            except (OSError, RuntimeError):
                continue
            if is_nginx_backup_path(resolved) or resolved in seen:
                continue
            seen.add(resolved)
            yield resolved


def canonical_cache_header(value: str) -> str:
    return f'add_header Cache-Control "{value}" always;'


def canonical_vary_header() -> str:
    return f'add_header Vary "{STATIC_VARY_VALUE}" always;'


def remove_managed_headers(body: str) -> str:
    body = re.sub(
        r'(?im)^[ \t]*expires\s+[^;]*;[ \t]*(?:\n|$)',
        "",
        body,
    )
    body = re.sub(
        r'(?im)^[ \t]*add_header\s+Cache-Control\s+[^;]*;[ \t]*(?:\n|$)',
        "",
        body,
    )
    return re.sub(
        r'(?im)^[ \t]*add_header\s+Vary\s+[^;]*;[ \t]*(?:\n|$)',
        "",
        body,
    )


def ensure_location_headers(text: str, location_path: str, cache_control: str) -> tuple[str, bool, bool]:
    view = masked(text)
    location = re.search(
        rf"\blocation\s+(?:(?:\^~|=)\s+)?{re.escape(location_path)}\s*\{{",
        view,
        re.IGNORECASE,
    )
    if not location:
        return text, False, False

    opening = view.find("{", location.start())
    closing = matching_brace(text, opening)
    body = remove_managed_headers(text[opening + 1 : closing])

    closing_line = text.rfind("\n", 0, closing) + 1
    closing_indent_match = re.match(r"[ \t]*", text[closing_line:closing])
    closing_indent = closing_indent_match.group(0) if closing_indent_match else ""
    directive_indent = closing_indent + "    "
    directives = (
        f"{directive_indent}{canonical_cache_header(cache_control)}\n"
        f"{directive_indent}{canonical_vary_header()}\n"
        f"{closing_indent}"
    )
    updated_body = body.rstrip() + "\n" + directives
    updated = text[: opening + 1] + updated_body + text[closing:]
    return updated, updated != text, True


def ensure_static_cache_headers(text: str) -> tuple[str, bool, set[str]]:
    updated = text
    changed = False
    found: set[str] = set()
    for location_path, cache_control in STATIC_LOCATION_CACHE.items():
        updated, location_changed, location_found = ensure_location_headers(
            updated,
            location_path,
            cache_control,
        )
        changed = changed or location_changed
        if location_found:
            found.add(location_path)
    return updated, changed, found


def collect_config_changes(config_paths=None) -> tuple[list[tuple[Path, str, str]], set[str]]:
    paths = nginx_config_files() if config_paths is None else config_paths
    changes: list[tuple[Path, str, str]] = []
    found: set[str] = set()
    for candidate in paths:
        path = Path(candidate)
        if is_nginx_backup_path(path):
            continue
        try:
            resolved = path.resolve()
            text = resolved.read_text(encoding="utf-8")
        except (OSError, RuntimeError, UnicodeDecodeError):
            continue
        updated, changed, file_found = ensure_static_cache_headers(text)
        found.update(file_found)
        if changed:
            changes.append((resolved, text, updated))
    return changes, found


def write_atomic(path: Path, content: str) -> None:
    descriptor, temp_name = tempfile.mkstemp(prefix=path.name + ".", dir=str(path.parent))
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8") as handle:
            handle.write(content)
        os.chmod(temp_name, stat.S_IMODE(path.stat().st_mode))
        os.replace(temp_name, path)
    finally:
        if os.path.exists(temp_name):
            os.unlink(temp_name)


def run(command: list[str]) -> None:
    subprocess.run(command, check=True)


def parse_http_headers(text: str) -> dict[str, str]:
    headers: dict[str, str] = {}
    for line in text.replace("\r", "").splitlines():
        if ":" not in line:
            continue
        name, value = line.split(":", 1)
        key = name.strip().lower()
        normalized = value.strip()
        headers[key] = f"{headers[key]}, {normalized}" if key in headers else normalized
    return headers


def find_static_asset_path(html: str) -> str:
    match = re.search(r'(?:src|href)="(?P<path>/economy/assets/[^" ]+)"', html)
    if not match:
        match = re.search(r'(?:src|href)="(?P<path>\.?/?assets/[^" ]+)"', html)
    if not match:
        raise RuntimeError("ECONOMY_STATIC_CACHE_ASSET_NOT_FOUND")
    path = match.group("path")
    if path.startswith("/economy/assets/"):
        return path
    return "/economy/" + path.removeprefix("./").removeprefix("/")


def fetch_headers(path: str) -> dict[str, str]:
    result = subprocess.run(
        [
            "curl",
            "--fail",
            "--silent",
            "--show-error",
            "--insecure",
            "--http1.1",
            "--resolve",
            f"{DOMAIN}:443:127.0.0.1",
            "--dump-header",
            "-",
            "--output",
            "/dev/null",
            f"{LOCAL_ORIGIN}{path}",
        ],
        check=True,
        capture_output=True,
        text=True,
    )
    return parse_http_headers(result.stdout)


def validate_cache_headers(label: str, headers: dict[str, str], expected_cache_control: str) -> None:
    actual_cache = headers.get("cache-control", "").lower().replace(" ", "")
    expected_cache = expected_cache_control.lower().replace(" ", "")
    expected_max_age = re.search(r"max-age=(\d+)", expected_cache)
    actual_max_ages = set(re.findall(r"max-age=(\d+)", actual_cache))
    if expected_cache not in actual_cache or not expected_max_age or actual_max_ages != {expected_max_age.group(1)}:
        raise RuntimeError(
            f"ECONOMY_STATIC_CACHE_CONTROL_INVALID label={label} actual={actual_cache}"
        )
    if STATIC_VARY_VALUE.lower() not in headers.get("vary", "").lower():
        raise RuntimeError(f"ECONOMY_STATIC_CACHE_VARY_MISSING label={label}")


def verify_static_cache_headers() -> None:
    index_path = STATIC_WEB_ROOT / "index.html"
    html = index_path.read_text(encoding="utf-8")
    asset_path = find_static_asset_path(html)
    validate_cache_headers(
        "html",
        fetch_headers("/economy/"),
        STATIC_HTML_CACHE_CONTROL,
    )
    validate_cache_headers(
        "index",
        fetch_headers("/economy/index.html"),
        STATIC_HTML_CACHE_CONTROL,
    )
    validate_cache_headers(
        "asset",
        fetch_headers(asset_path),
        STATIC_ASSET_CACHE_CONTROL,
    )


def verify_after_reload() -> None:
    last_error: Exception | None = None
    for attempt in range(STATIC_VERIFY_ATTEMPTS):
        try:
            verify_static_cache_headers()
            return
        except (RuntimeError, OSError, subprocess.CalledProcessError) as error:
            last_error = error
            if attempt + 1 < STATIC_VERIFY_ATTEMPTS:
                time.sleep(STATIC_VERIFY_RETRY_DELAY_SECONDS)
    if last_error is not None:
        raise last_error


def apply_changes() -> None:
    changes, found = collect_config_changes()
    missing = set(STATIC_LOCATION_CACHE) - found
    if missing:
        raise RuntimeError(
            "ECONOMY_STATIC_CACHE_LOCATIONS_MISSING=" + ",".join(sorted(missing))
        )

    backups = []
    for path, original, updated in changes:
        backup = create_nginx_backup(path)
        backups.append((path, backup))
        write_atomic(path, updated)

    try:
        run(["nginx", "-t"])
        run(["systemctl", "reload", "nginx"])
        verify_after_reload()
    except Exception:
        for path, backup in reversed(backups):
            shutil.copy2(backup, path)
        if changes:
            run(["nginx", "-t"])
            run(["systemctl", "reload", "nginx"])
        raise

    print(
        "ECONOMY_STATIC_CACHE_VERIFIED "
        f"assets={STATIC_ASSET_CACHE_CONTROL!r} html={STATIC_HTML_CACHE_CONTROL!r}"
    )


if __name__ == "__main__":
    apply_changes()
