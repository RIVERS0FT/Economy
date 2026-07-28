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
    'from __future__ import annotations\n\nimport os\n',
    'from __future__ import annotations\n\nimport gzip\nimport os\n',
)
replace_once(
    configure,
    'DOMAIN = "game.riversoft.top"\n',
    'DOMAIN = "game.riversoft.top"\nLOCAL_ORIGIN = "http://127.0.0.1"\nSTATIC_WEB_ROOT = Path("/var/www/game/economy")\n',
)

helpers = r'''

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
'''
replace_once(
    configure,
    '\n\ndef main() -> int:\n',
    helpers + '\n\ndef main() -> int:\n',
)
replace_once(
    configure,
    '''        run(["nginx", "-t"])
        run(["systemctl", "reload", "nginx"])
    except Exception:
        for changed_path, backup in reversed(backups):
            shutil.copy2(backup, changed_path)
        subprocess.run(["nginx", "-t"], check=False)
        raise
''',
    '''        run(["nginx", "-t"])
        run(["systemctl", "reload", "nginx"])
        verify_static_compression()
    except Exception:
        for changed_path, backup in reversed(backups):
            shutil.copy2(backup, changed_path)
        subprocess.run(["nginx", "-t"], check=False)
        subprocess.run(["systemctl", "reload", "nginx"], check=False)
        raise
''',
)
replace_once(
    configure,
    'Configured Economy API proxy and JSON compression in ',
    'Configured Economy API proxy and static compression in ',
)
replace_once(
    configure,
    'Economy API proxy and JSON compression already configured in {path}',
    'Economy API proxy and static compression already configured in {path}',
)


tests = 'scripts/test_configure_economy_nginx.py'
replace_once(
    tests,
    'import importlib.util\nimport unittest\n',
    'import gzip\nimport importlib.util\nimport unittest\n',
)
replace_once(
    tests,
    '''    def test_legacy_broad_route_is_replaced(self) -> None:
''',
    '''    def test_static_asset_paths_and_gzip_payload_validation(self) -> None:
        html = (
            '<script type="module" src="/economy/assets/index-abc.js"></script>'
            '<link rel="stylesheet" href="/economy/assets/index-def.css">'
        )
        self.assertEqual(
            nginx.find_static_asset_paths(html),
            ("/economy/assets/index-abc.js", "/economy/assets/index-def.css"),
        )
        source = (b"const economy = true;" * 200)
        payload = gzip.compress(source, compresslevel=6)
        self.assertEqual(
            nginx.validate_gzip_payload(
                "javascript",
                {"content-encoding": "gzip", "vary": "Accept-Encoding"},
                payload,
                source,
            ),
            (len(source), len(payload)),
        )

    def test_gzip_payload_validation_rejects_missing_headers(self) -> None:
        source = b"body" * 400
        payload = gzip.compress(source, compresslevel=6)
        with self.assertRaisesRegex(RuntimeError, "ECONOMY_STATIC_GZIP_MISSING"):
            nginx.validate_gzip_payload("css", {}, payload, source)
        with self.assertRaisesRegex(RuntimeError, "ECONOMY_STATIC_GZIP_VARY_MISSING"):
            nginx.validate_gzip_payload(
                "css",
                {"content-encoding": "gzip"},
                payload,
                source,
            )

    def test_legacy_broad_route_is_replaced(self) -> None:
''',
)


design = 'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md'
replace_once(
    design,
    '部署完成后必须以 `Accept-Encoding: gzip` 实测 HTML、实际构建 JS 与 CSS，要求 `Content-Encoding: gzip`、`Vary: Accept-Encoding`，且线上压缩响应体必须小于构建产物原始字节数。',
    '`scripts/configure-economy-nginx.py` 重载 Nginx 后必须从本机入口以 `Accept-Encoding: gzip` 实测 HTML、实际构建 JS 与 CSS，要求 `Content-Encoding: gzip`、`Vary: Accept-Encoding`、压缩流可解码且正文与磁盘源文件一致，线上压缩响应体必须小于构建产物原始字节数；任一检查失败必须恢复旧配置并重新加载 Nginx。',
)

verify = 'scripts/verify-state-delivery-capacity.mjs'
replace_once(
    verify,
    '''  'remove_top_level_directives',
  'ensure_static_compression',
]);
''',
    '''  'remove_top_level_directives',
  'ensure_static_compression',
  'find_static_asset_paths',
  'validate_gzip_payload',
  'verify_static_compression',
  'ECONOMY_STATIC_GZIP_MISSING',
  'ECONOMY_STATIC_GZIP_VARY_MISSING',
  'ECONOMY_STATIC_GZIP_CONTENT_MISMATCH',
  'ECONOMY_STATIC_GZIP_NOT_SMALLER',
  'ECONOMY_STATIC_GZIP_VERIFIED',
]);
''',
)
replace_once(
    verify,
    '''requireText('.github/workflows/deploy.yml', [
  'verify_gzip_response()',
  "--header 'Accept-Encoding: gzip'",
  'ECONOMY_STATIC_GZIP_MISSING',
  'ECONOMY_STATIC_GZIP_VARY_MISSING',
  'ECONOMY_STATIC_GZIP_NOT_SMALLER',
  'verify_gzip_response javascript',
  'verify_gzip_response css',
]);

''',
    '',
)
