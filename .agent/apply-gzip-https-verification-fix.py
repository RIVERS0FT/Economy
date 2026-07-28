from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text(encoding='utf-8')
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{path}: expected one match, found {count}: {old[:160]!r}')
    file.write_text(text.replace(old, new, 1), encoding='utf-8')


configure = 'scripts/configure-economy-nginx.py'
replace_once(
    configure,
    'LOCAL_ORIGIN = "http://127.0.0.1"\n',
    'LOCAL_ORIGIN = f"https://{DOMAIN}"\n',
)
replace_once(
    configure,
    '''def find_static_asset_paths(html: str) -> tuple[str, str]:
    javascript = re.search(r'src="(?P<path>/economy/assets/[^" ]+\\.js)"', html)
    stylesheet = re.search(r'href="(?P<path>/economy/assets/[^" ]+\\.css)"', html)
    if not javascript:
        raise RuntimeError("ECONOMY_STATIC_JAVASCRIPT_NOT_FOUND")
    if not stylesheet:
        raise RuntimeError("ECONOMY_STATIC_CSS_NOT_FOUND")
    return javascript.group("path"), stylesheet.group("path")
''',
    '''def normalize_static_asset_path(path: str) -> str:
    normalized = str(path or "").strip()
    if normalized.startswith("/economy/assets/"):
        return normalized
    if normalized.startswith("./assets/"):
        return "/economy/" + normalized[2:]
    if normalized.startswith("assets/"):
        return "/economy/" + normalized
    raise RuntimeError(f"ECONOMY_STATIC_PATH_INVALID path={normalized}")


def find_static_asset_paths(html: str) -> tuple[str, str]:
    asset_prefix = r"(?:/economy/|\\./)?assets/"
    javascript = re.search(rf'src="(?P<path>{asset_prefix}[^" ]+\\.js)"', html)
    stylesheet = re.search(rf'href="(?P<path>{asset_prefix}[^" ]+\\.css)"', html)
    if not javascript:
        raise RuntimeError("ECONOMY_STATIC_JAVASCRIPT_NOT_FOUND")
    if not stylesheet:
        raise RuntimeError("ECONOMY_STATIC_CSS_NOT_FOUND")
    return (
        normalize_static_asset_path(javascript.group("path")),
        normalize_static_asset_path(stylesheet.group("path")),
    )
''',
)
replace_once(
    configure,
    '''        command = [
            "curl",
            "--fail",
            "--silent",
            "--show-error",
            "--http1.1",
            "--header",
            f"Host: {DOMAIN}",
            "--dump-header",
''',
    '''        command = [
            "curl",
            "--fail",
            "--silent",
            "--show-error",
            "--http1.1",
            "--insecure",
            "--resolve",
            f"{DOMAIN}:443:127.0.0.1",
            "--dump-header",
''',
)

tests = 'scripts/test_configure_economy_nginx.py'
replace_once(
    tests,
    '''        self.assertEqual(
            nginx.find_static_asset_paths(html),
            ("/economy/assets/index-abc.js", "/economy/assets/index-def.css"),
        )
        source = (b"const economy = true;" * 200)
''',
    '''        self.assertEqual(
            nginx.find_static_asset_paths(html),
            ("/economy/assets/index-abc.js", "/economy/assets/index-def.css"),
        )
        relative_html = (
            '<script type="module" src="./assets/index-relative.js"></script>'
            '<link rel="stylesheet" href="assets/index-relative.css">'
        )
        self.assertEqual(
            nginx.find_static_asset_paths(relative_html),
            ("/economy/assets/index-relative.js", "/economy/assets/index-relative.css"),
        )
        self.assertEqual(nginx.LOCAL_ORIGIN, "https://game.riversoft.top")
        source = (b"const economy = true;" * 200)
''',
)

design = 'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md'
replace_once(
    design,
    '`scripts/configure-economy-nginx.py` 重载 Nginx 后必须从本机入口以 `Accept-Encoding: gzip` 实测 HTML、实际构建 JS 与 CSS，',
    '`scripts/configure-economy-nginx.py` 重载 Nginx 后必须通过 `--resolve game.riversoft.top:443:127.0.0.1` 命中本机正式 HTTPS 与 TLS SNI 入口，禁止使用可能返回 301 跳转页的 80 端口；必须以 `Accept-Encoding: gzip` 实测 HTML、实际构建 JS 与 CSS，',
)

verify = 'scripts/verify-state-delivery-capacity.mjs'
replace_once(
    verify,
    "  'find_static_asset_paths',\n  'validate_gzip_payload',\n",
    "  'normalize_static_asset_path',\n  'find_static_asset_paths',\n  'validate_gzip_payload',\n  '--resolve',\n  '443:127.0.0.1',\n",
)
