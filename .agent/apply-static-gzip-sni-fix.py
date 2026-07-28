from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text(encoding='utf-8')
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{path}: expected one match, found {count}: {old!r}')
    file.write_text(text.replace(old, new, 1), encoding='utf-8')


configure = 'scripts/configure-economy-nginx.py'
replace_once(
    configure,
    'LOCAL_ORIGIN = "http://127.0.0.1"',
    'LOCAL_ORIGIN = "https://game.riversoft.top"',
)
replace_once(
    configure,
    '''            "--header",
            f"Host: {DOMAIN}",
''',
    '''            "--resolve",
            f"{DOMAIN}:443:127.0.0.1",
''',
)

tests = 'scripts/test_configure_economy_nginx.py'
replace_once(
    tests,
    'import gzip\nimport importlib.util\n',
    'import gzip\nimport importlib.util\nimport inspect\n',
)
replace_once(
    tests,
    '''    def test_static_asset_paths_and_gzip_payload_validation(self) -> None:
''',
    '''    def test_local_compression_check_targets_https_sni(self) -> None:
        self.assertEqual(nginx.LOCAL_ORIGIN, "https://game.riversoft.top")
        source = inspect.getsource(nginx.fetch_local_response)
        self.assertIn('f"{DOMAIN}:443:127.0.0.1"', source)
        self.assertNotIn('f"Host: {DOMAIN}"', source)

    def test_static_asset_paths_and_gzip_payload_validation(self) -> None:
''',
)
replace_once(
    tests,
    '''            "线上压缩响应体必须小于构建产物原始字节数",
''',
    '''            "线上压缩响应体必须小于构建产物原始字节数",
            "127.0.0.1:443 的 HTTPS/SNI 入口",
''',
)

design = 'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md'
replace_once(
    design,
    '`scripts/configure-economy-nginx.py` 重载 Nginx 后必须从本机入口以 `Accept-Encoding: gzip` 实测 HTML、实际构建 JS 与 CSS',
    '`scripts/configure-economy-nginx.py` 重载 Nginx 后必须从本机 `127.0.0.1:443` 的 HTTPS/SNI 入口以 `Accept-Encoding: gzip` 实测 HTML、实际构建 JS 与 CSS',
)

verify = 'scripts/verify-state-delivery-capacity.mjs'
replace_once(
    verify,
    '''  'verify_static_compression',
''',
    '''  'verify_static_compression',
  'LOCAL_ORIGIN = "https://game.riversoft.top"',
  'f"{DOMAIN}:443:127.0.0.1"',
''',
)
replace_once(
    verify,
    '''  '线上压缩响应体必须小于构建产物原始字节数',
''',
    '''  '线上压缩响应体必须小于构建产物原始字节数',
  '127.0.0.1:443` 的 HTTPS/SNI 入口',
''',
)
