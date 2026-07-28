from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text(encoding='utf-8')
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{path}: expected one match, found {count}: {old[:180]!r}')
    file.write_text(text.replace(old, new, 1), encoding='utf-8')


tests = 'scripts/test_configure_economy_nginx.py'
replace_once(
    tests,
    '''        self.assertIn("location ^~ /economy-api/game/", updated)
        self.assertIn("gzip_types application/json;", updated)
        self.assertEqual(nginx.replace_or_insert(updated), updated)
''',
    '''        self.assertIn("location ^~ /economy-api/game/", updated)
        self.assertIn("gzip_types application/json;", updated)
        self.assertIn(nginx.STATIC_COMPRESSION_BEGIN, updated)
        self.assertIn("text/css text/plain text/javascript application/javascript application/json", updated)
        self.assertEqual(nginx.replace_or_insert(updated), updated)
''',
)
replace_once(
    tests,
    '''    def test_existing_account_and_game_snippets_are_unchanged(self) -> None:
        original = server(
            f"include {nginx.ACCOUNT_SNIPPET};",
            f"include {nginx.GAME_API_SNIPPET};",
        )

        self.assertEqual(nginx.replace_or_insert(original), original)
''',
    '''    def test_existing_account_and_game_snippets_gain_static_compression_once(self) -> None:
        original = server(
            f"include {nginx.ACCOUNT_SNIPPET};",
            f"include {nginx.GAME_API_SNIPPET};",
        )
        updated = nginx.replace_or_insert(original)

        self.assertIn(f"include {nginx.ACCOUNT_SNIPPET};", updated)
        self.assertIn(f"include {nginx.GAME_API_SNIPPET};", updated)
        self.assertEqual(updated.count(nginx.STATIC_COMPRESSION_BEGIN), 1)
        self.assertEqual(nginx.replace_or_insert(updated), updated)
''',
)
replace_once(
    tests,
    '''    def test_legacy_broad_route_is_replaced(self) -> None:
''',
    '''    def test_static_compression_repairs_conflicting_top_level_values(self) -> None:
        original = server(
            "gzip off;",
            "gzip_comp_level 1;",
            "gzip_types application/json;",
            f"include {nginx.ACCOUNT_SNIPPET};",
            f"include {nginx.GAME_API_SNIPPET};",
        )
        updated = nginx.replace_or_insert(original)

        self.assertNotIn("gzip off;", updated)
        self.assertNotIn("gzip_comp_level 1;", updated)
        self.assertEqual(updated.count("gzip_comp_level 6;"), 1)
        self.assertIn("image/svg+xml application/wasm;", updated)
        self.assertEqual(updated.count(nginx.STATIC_COMPRESSION_BEGIN), 1)
        self.assertEqual(nginx.replace_or_insert(updated), updated)

    def test_static_compression_does_not_include_already_compressed_media(self) -> None:
        block = nginx.static_compression_block()
        for media_type in ("image/png", "image/jpeg", "image/webp", "image/avif", "font/woff2"):
            self.assertNotIn(media_type, block)

    def test_legacy_broad_route_is_replaced(self) -> None:
''',
)
replace_once(
    tests,
    '''            "未更新设计文档的架构回退不应合并",
''',
    '''            "未更新设计文档的架构回退不应合并",
            "超过 1 KB 的 HTML、JavaScript、CSS、JSON、SVG、Web Manifest、XML 与 WASM",
            "PNG、JPEG、WebP、AVIF 与 WOFF2",
            "线上压缩响应体必须小于构建产物原始字节数",
''',
)

deploy = '.github/workflows/deploy.yml'
replace_once(
    deploy,
    '''          curl --fail --silent --show-error \\
            --resolve "game.riversoft.top:443:$SERVER_HOST" \\
            --retry 3 --retry-delay 2 \\
            https://game.riversoft.top/economy/ >/dev/null

''',
    '''          PUBLIC_HTML="$(curl --fail --silent --show-error \\
            --resolve "game.riversoft.top:443:$SERVER_HOST" \\
            --retry 3 --retry-delay 2 \\
            https://game.riversoft.top/economy/)"

          JS_PATH="$(printf '%s' "$PUBLIC_HTML" | grep -oE 'src="/economy/assets/[^" ]+\\.js"' | head -n 1 | cut -d'"' -f2 || true)"
          CSS_PATH="$(printf '%s' "$PUBLIC_HTML" | grep -oE 'href="/economy/assets/[^" ]+\\.css"' | head -n 1 | cut -d'"' -f2 || true)"
          test -n "$JS_PATH" || { echo ECONOMY_STATIC_JAVASCRIPT_NOT_FOUND >&2; exit 1; }
          test -n "$CSS_PATH" || { echo ECONOMY_STATIC_CSS_NOT_FOUND >&2; exit 1; }

          verify_gzip_response() {
            local label="$1"
            local public_path="$2"
            local source_file="$3"
            local headers_file
            local body_file
            local source_bytes
            local wire_bytes
            headers_file="$(mktemp)"
            body_file="$(mktemp)"
            curl --fail --silent --show-error --http1.1 \\
              --resolve "game.riversoft.top:443:$SERVER_HOST" \\
              --retry 3 --retry-delay 2 \\
              --header 'Accept-Encoding: gzip' \\
              --dump-header "$headers_file" \\
              --output "$body_file" \\
              "https://game.riversoft.top${public_path}"
            if ! tr -d '\\r' < "$headers_file" | grep -Eqi '^content-encoding:[[:space:]]*gzip$'; then
              echo "ECONOMY_STATIC_GZIP_MISSING label=$label path=$public_path" >&2
              cat "$headers_file" >&2
              exit 1
            fi
            if ! tr -d '\\r' < "$headers_file" | grep -Eqi '^vary:.*accept-encoding'; then
              echo "ECONOMY_STATIC_GZIP_VARY_MISSING label=$label path=$public_path" >&2
              cat "$headers_file" >&2
              exit 1
            fi
            source_bytes="$(wc -c < "$source_file")"
            wire_bytes="$(wc -c < "$body_file")"
            if [ "$wire_bytes" -ge "$source_bytes" ]; then
              echo "ECONOMY_STATIC_GZIP_NOT_SMALLER label=$label source_bytes=$source_bytes wire_bytes=$wire_bytes" >&2
              exit 1
            fi
            echo "ECONOMY_STATIC_GZIP_VERIFIED label=$label source_bytes=$source_bytes wire_bytes=$wire_bytes"
            rm -f "$headers_file" "$body_file"
          }

          verify_gzip_response html /economy/ dist/index.html
          verify_gzip_response javascript "$JS_PATH" "dist/${JS_PATH#/economy/}"
          verify_gzip_response css "$CSS_PATH" "dist/${CSS_PATH#/economy/}"

''',
)


design = 'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md'
replace_once(
    design,
    '- Nginx 游戏 API 请求体上限为 256 KB；普通 JSON 仍由应用限制为 16 KB。\n',
    '- Nginx 游戏 API 请求体上限为 256 KB；普通 JSON 仍由应用限制为 16 KB。\n'
    '- 生产 HTTPS `server` 必须由 `scripts/configure-economy-nginx.py` 统一维护动态 gzip：`gzip_vary on`、`gzip_proxied any`、最小长度 `1024`、静态资源压缩级别 `6`。超过 1 KB 的 HTML、JavaScript、CSS、JSON、SVG、Web Manifest、XML 与 WASM 必须压缩；游戏 API `location` 继续使用面向 JSON 的压缩级别 `5`。PNG、JPEG、WebP、AVIF 与 WOFF2 等已经压缩的媒体和字体不得加入 `gzip_types` 重复压缩。脚本必须清除目标 `server` 中冲突的顶层 gzip 指令、写入唯一托管块并保持重复执行幂等；部署完成后必须以 `Accept-Encoding: gzip` 实测 HTML、实际构建 JS 与 CSS，要求 `Content-Encoding: gzip`、`Vary: Accept-Encoding`，且线上压缩响应体必须小于构建产物原始字节数。\n',
)

replace_once(
    'README.md',
    '大型 JSON 响应必须使用 gzip 压缩',
    '大型 JSON 响应以及超过 1 KB 的 HTML、JavaScript、CSS、SVG、Web Manifest、XML 与 WASM 必须使用 gzip 压缩，PNG、JPEG、WebP、AVIF 与 WOFF2 等已压缩资源不得重复压缩',
)

verify = 'scripts/verify-state-delivery-capacity.mjs'
replace_once(
    verify,
    "  '大型 JSON 响应必须使用 gzip 压缩',\n",
    "  '大型 JSON 响应以及超过 1 KB 的 HTML、JavaScript、CSS、SVG、Web Manifest、XML 与 WASM 必须使用 gzip 压缩',\n"
    "  'PNG、JPEG、WebP、AVIF 与 WOFF2 等已压缩资源不得重复压缩',\n",
)
replace_once(
    verify,
    "  '部署脚本必须修补既有游戏 API snippet 或手工 `location`',\n",
    "  '部署脚本必须修补既有游戏 API snippet 或手工 `location`',\n"
    "  '超过 1 KB 的 HTML、JavaScript、CSS、JSON、SVG、Web Manifest、XML 与 WASM',\n"
    "  '线上压缩响应体必须小于构建产物原始字节数',\n",
)
replace_once(
    verify,
    "requireText('server/src/storage.js', [\n",
    "requireText('scripts/configure-economy-nginx.py', [\n"
    "  'STATIC_COMPRESSION_BEGIN',\n"
    "  '(\\\"gzip_comp_level\\\", \\\"6\\\")',\n"
    "  'text/css text/plain text/javascript application/javascript application/json',\n"
    "  'application/atom+xml image/svg+xml application/wasm',\n"
    "  'remove_top_level_directives',\n"
    "  'ensure_static_compression',\n"
    "]);\n"
    "forbidText('scripts/configure-economy-nginx.py', [\n"
    "  'image/png',\n"
    "  'image/jpeg',\n"
    "  'image/webp',\n"
    "  'image/avif',\n"
    "  'font/woff2',\n"
    "]);\n"
    "requireText('.github/workflows/deploy.yml', [\n"
    "  'verify_gzip_response()',\n"
    "  \"--header 'Accept-Encoding: gzip'\",\n"
    "  'ECONOMY_STATIC_GZIP_MISSING',\n"
    "  'ECONOMY_STATIC_GZIP_VARY_MISSING',\n"
    "  'ECONOMY_STATIC_GZIP_NOT_SMALLER',\n"
    "  'verify_gzip_response javascript',\n"
    "  'verify_gzip_response css',\n"
    "]);\n\n"
    "requireText('server/src/storage.js', [\n",
)
