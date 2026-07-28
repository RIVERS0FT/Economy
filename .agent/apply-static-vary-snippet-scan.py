from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text(encoding='utf-8')
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{path}: expected one match, found {count}: {old[:180]!r}')
    file.write_text(text.replace(old, new, 1), encoding='utf-8')


configure = 'scripts/configure-economy-nginx.py'
replace_once(
    configure,
    '''STATIC_VARY_HEADER = 'add_header Vary "Accept-Encoding" always;'
''',
    '''STATIC_VARY_HEADER = 'add_header Vary "Accept-Encoding" always;'
NGINX_CONFIG_ROOTS = (
    Path("/etc/nginx/sites-enabled"),
    Path("/etc/nginx/conf.d"),
    Path("/etc/nginx/sites-available"),
    Path("/etc/nginx/snippets"),
)
''',
)
old_find_target = '''def find_target() -> tuple[Path, str, tuple[int, int]]:
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
'''
new_find_target = '''def nginx_config_files():
    seen: set[Path] = set()
    for root in NGINX_CONFIG_ROOTS:
        if not root.exists():
            continue
        for candidate in sorted(root.glob("*")):
            if not candidate.is_file() and not candidate.is_symlink():
                continue
            resolved = candidate.resolve()
            if resolved in seen:
                continue
            seen.add(resolved)
            yield resolved


def collect_static_vary_changes(
    config_paths=None,
    excluded_paths=(),
) -> list[tuple[Path, str, str]]:
    excluded = {Path(path).resolve() for path in excluded_paths}
    paths = nginx_config_files() if config_paths is None else config_paths
    changes: list[tuple[Path, str, str]] = []
    for candidate in paths:
        resolved = Path(candidate).resolve()
        if resolved in excluded:
            continue
        try:
            text = resolved.read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError):
            continue
        updated, changed = ensure_static_vary_headers(text)
        if changed:
            changes.append((resolved, text, updated))
    return changes


def find_target() -> tuple[Path, str, tuple[int, int]]:
    for resolved in nginx_config_files():
        try:
            text = resolved.read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError):
            continue
        for start, end in server_blocks(text):
            if is_target_server(text[start:end]):
                return resolved, text, (start, end)

    raise RuntimeError(f"No HTTPS Nginx server block found for {DOMAIN}")
'''
replace_once(configure, old_find_target, new_find_target)
replace_once(
    configure,
    '''    snippet_path = Path(GAME_API_SNIPPET)
    if snippet_path.exists():
        snippet_text = snippet_path.read_text(encoding="utf-8")
        snippet_updated, snippet_changed = ensure_game_api_compression(snippet_text)
        if snippet_changed:
            changes.append((snippet_path, snippet_text, snippet_updated))

    backups = []
''',
    '''    snippet_path = Path(GAME_API_SNIPPET)
    if snippet_path.exists():
        snippet_text = snippet_path.read_text(encoding="utf-8")
        snippet_updated, snippet_changed = ensure_game_api_compression(snippet_text)
        if snippet_changed:
            changes.append((snippet_path, snippet_text, snippet_updated))

    excluded_static_paths = {path.resolve()}
    if snippet_path.exists():
        excluded_static_paths.add(snippet_path.resolve())
    changes.extend(collect_static_vary_changes(excluded_paths=excluded_static_paths))

    backups = []
''',
)

tests = 'scripts/test_configure_economy_nginx.py'
replace_once(
    tests,
    '''import gzip
import importlib.util
import unittest
''',
    '''import gzip
import importlib.util
import tempfile
import unittest
''',
)
replace_once(
    tests,
    '''    def test_static_asset_paths_and_gzip_payload_validation(self) -> None:
''',
    '''    def test_collects_static_vary_changes_from_separate_snippets(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            assets = root / "assets.conf"
            html = root / "html.conf"
            unrelated = root / "unrelated.conf"
            assets.write_text(
                'location ^~ /economy/assets/ { add_header Cache-Control immutable; try_files $uri =404; }\n',
                encoding="utf-8",
            )
            html.write_text(
                'location ^~ /economy/ { try_files $uri /economy/index.html; }\n',
                encoding="utf-8",
            )
            unrelated.write_text('location /other/ { return 404; }\n', encoding="utf-8")

            changes = nginx.collect_static_vary_changes(
                config_paths=(assets, html, unrelated),
            )
            self.assertEqual({item[0] for item in changes}, {assets.resolve(), html.resolve()})
            for _path, original, updated in changes:
                self.assertNotEqual(original, updated)
                self.assertIn(nginx.STATIC_VARY_HEADER, updated)

    def test_static_asset_paths_and_gzip_payload_validation(self) -> None:
''',
)
replace_once(
    tests,
    '''            "两个静态 `location` 必须直接输出 `Vary: Accept-Encoding`",
''',
    '''            "两个静态 `location` 必须直接输出 `Vary: Accept-Encoding`",
            "扫描 `sites-enabled`、`conf.d`、`sites-available` 与 `snippets`",
''',
)

design = 'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md'
replace_once(
    design,
    '`/economy/assets/` 与 `/economy/` 两个静态 `location` 必须直接输出 `Vary: Accept-Encoding`，不得只依赖服务器级继承；资产位置原有 `Cache-Control` 必须保留。',
    '`/economy/assets/` 与 `/economy/` 两个静态 `location` 必须直接输出 `Vary: Accept-Encoding`，不得只依赖服务器级继承；资产位置原有 `Cache-Control` 必须保留。配置脚本必须扫描 `sites-enabled`、`conf.d`、`sites-available` 与 `snippets` 四个 Nginx 配置根目录，按解析后的真实路径去重，并修补位于主 `server` 文件或任意被 include 的独立 snippet 中的 Economy 静态位置。',
)

verify = 'scripts/verify-state-delivery-capacity.mjs'
replace_once(
    verify,
    "  'STATIC_VARY_HEADER',\n",
    "  'STATIC_VARY_HEADER',\n  'NGINX_CONFIG_ROOTS',\n  'collect_static_vary_changes',\n  '/etc/nginx/snippets',\n",
)
