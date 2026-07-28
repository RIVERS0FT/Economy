from pathlib import Path

path = Path('scripts/test_configure_economy_nginx.py')
text = path.read_text(encoding='utf-8')
start_marker = '    def test_collects_static_vary_changes_from_separate_snippets(self) -> None:\n'
end_marker = '    def test_static_asset_paths_and_gzip_payload_validation(self) -> None:\n'
start = text.index(start_marker)
end = text.index(end_marker, start)
method = r'''    def test_collects_static_vary_changes_from_separate_snippets(self) -> None:
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

'''
path.write_text(text[:start] + method + text[end:], encoding='utf-8')
