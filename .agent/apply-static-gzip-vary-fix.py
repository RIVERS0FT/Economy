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
    'STATIC_COMPRESSION_NAMES = frozenset(name for name, _value in STATIC_COMPRESSION)\n',
    'STATIC_COMPRESSION_NAMES = frozenset(name for name, _value in STATIC_COMPRESSION)\n'
    'STATIC_LOCATION_PATHS = ("/economy/assets/", "/economy/")\n'
    'STATIC_VARY_HEADER = \'add_header Vary "Accept-Encoding" always;\'\n',
)

helper = r'''


def ensure_static_vary_headers(block: str) -> tuple[str, bool]:
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
replace_once(
    configure,
    '\n\ndef masked(text: str) -> str:\n',
    helper + '\n\ndef masked(text: str) -> str:\n',
)
replace_once(
    configure,
    '''    cleaned, added_compression = ensure_game_api_compression(cleaned)
    cleaned, added_static_compression = ensure_static_compression(cleaned)
''',
    '''    cleaned, added_compression = ensure_game_api_compression(cleaned)
    cleaned, added_static_compression = ensure_static_compression(cleaned)
    cleaned, added_static_vary = ensure_static_vary_headers(cleaned)
''',
)
replace_once(
    configure,
    '        if not had_managed and not removed_legacy and not added_compression and not added_static_compression:\n',
    '        if not had_managed and not removed_legacy and not added_compression and not added_static_compression and not added_static_vary:\n',
)

nginx_conf = 'deploy/nginx/game.riversoft.top.economy-location.conf'
replace_once(
    nginx_conf,
    '''    add_header Cache-Control "public, max-age=604800, immutable";
    try_files $uri =404;
''',
    '''    add_header Cache-Control "public, max-age=604800, immutable";
    add_header Vary "Accept-Encoding" always;
    try_files $uri =404;
''',
)
replace_once(
    nginx_conf,
    '''    index index.html;
    try_files $uri $uri/ /economy/index.html;
''',
    '''    index index.html;
    add_header Vary "Accept-Encoding" always;
    try_files $uri $uri/ /economy/index.html;
''',
)

tests = 'scripts/test_configure_economy_nginx.py'
replace_once(
    tests,
    '''    def test_static_compression_does_not_include_already_compressed_media(self) -> None:
        block = nginx.static_compression_block()
        for media_type in ("image/png", "image/jpeg", "image/webp", "image/avif", "font/woff2"):
            self.assertNotIn(media_type, block)

''',
    '''    def test_static_compression_does_not_include_already_compressed_media(self) -> None:
        block = nginx.static_compression_block()
        for media_type in ("image/png", "image/jpeg", "image/webp", "image/avif", "font/woff2"):
            self.assertNotIn(media_type, block)

    def test_static_locations_emit_vary_header_without_removing_cache_control(self) -> None:
        original = server(
            "location ^~ /economy/assets/ { add_header Cache-Control immutable; try_files $uri =404; }",
            "location ^~ /economy/ { try_files $uri /economy/index.html; }",
            f"include {nginx.ACCOUNT_SNIPPET};",
            f"include {nginx.GAME_API_SNIPPET};",
        )
        updated = nginx.replace_or_insert(original)

        self.assertEqual(updated.count(nginx.STATIC_VARY_HEADER), 2)
        self.assertIn("add_header Cache-Control immutable;", updated)
        self.assertEqual(nginx.replace_or_insert(updated), updated)

''',
)
replace_once(
    tests,
    '''            "线上压缩响应体必须小于构建产物原始字节数",
''',
    '''            "线上压缩响应体必须小于构建产物原始字节数",
            "两个静态 `location` 必须直接输出 `Vary: Accept-Encoding`",
''',
)

design = 'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md'
replace_once(
    design,
    'PNG、JPEG、WebP、AVIF 与 WOFF2 等已经压缩的媒体和字体不得加入 `gzip_types` 重复压缩。',
    'PNG、JPEG、WebP、AVIF 与 WOFF2 等已经压缩的媒体和字体不得加入 `gzip_types` 重复压缩。`/economy/assets/` 与 `/economy/` 两个静态 `location` 必须直接输出 `Vary: Accept-Encoding`，不得只依赖服务器级继承；资产位置原有 `Cache-Control` 必须保留。',
)

verify = 'scripts/verify-state-delivery-capacity.mjs'
replace_once(
    verify,
    "  'ensure_static_compression',\n",
    "  'ensure_static_compression',\n  'ensure_static_vary_headers',\n  'STATIC_VARY_HEADER',\n",
)
replace_once(
    verify,
    "forbidText('scripts/configure-economy-nginx.py', [\n",
    "requireText('deploy/nginx/game.riversoft.top.economy-location.conf', [\n  'location ^~ /economy/assets/',\n  'location ^~ /economy/',\n  'add_header Vary \"Accept-Encoding\" always;',\n  'add_header Cache-Control \"public, max-age=604800, immutable\";',\n]);\nforbidText('scripts/configure-economy-nginx.py', [\n",
)
