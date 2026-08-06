#!/usr/bin/env python3
from __future__ import annotations

import importlib.util
import tempfile
import unittest
from pathlib import Path

MODULE_PATH = Path(__file__).with_name("configure-economy-static-cache.py")
SPEC = importlib.util.spec_from_file_location("configure_economy_static_cache", MODULE_PATH)
if SPEC is None or SPEC.loader is None:
    raise RuntimeError(f"Unable to load {MODULE_PATH}")
cache = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(cache)


class StaticCacheConfigurationTests(unittest.TestCase):
    def test_repairs_cache_headers_and_is_idempotent(self) -> None:
        original = """server {
    location ^~ /economy/assets/ {
        root /var/www/game;
        expires 7d;
        add_header Cache-Control "public, max-age=604800, immutable";
        add_header Vary Accept-Encoding;
        try_files $uri =404;
    }
    location ^~ /economy/ {
        root /var/www/game;
        add_header Cache-Control "public, max-age=60";
        try_files $uri $uri/ /economy/index.html;
    }
}
"""
        updated, changed, found = cache.ensure_static_cache_headers(original)

        self.assertTrue(changed)
        self.assertEqual(found, {"/economy/assets/", "/economy/"})
        self.assertIn(
            'add_header Cache-Control "public, max-age=31536000, immutable" always;',
            updated,
        )
        self.assertIn(
            'add_header Cache-Control "no-cache, max-age=0, must-revalidate" always;',
            updated,
        )
        self.assertEqual(updated.count(cache.canonical_vary_header()), 2)
        self.assertNotIn("max-age=604800", updated)
        self.assertEqual(
            cache.ensure_static_cache_headers(updated),
            (updated, False, {"/economy/assets/", "/economy/"}),
        )

    def test_reports_missing_locations(self) -> None:
        updated, changed, found = cache.ensure_static_cache_headers(
            "location /other/ { return 404; }\n"
        )
        self.assertFalse(changed)
        self.assertEqual(found, set())
        self.assertEqual(updated, "location /other/ { return 404; }\n")

    def test_collects_locations_across_separate_snippets(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            assets = root / "assets.conf"
            html = root / "html.conf"
            backup = root / "html.conf.economy-static-cache.bak"
            assets.write_text(
                "location ^~ /economy/assets/ {\n"
                "    root /var/www/game;\n"
                "    try_files $uri =404;\n"
                "}\n",
                encoding="utf-8",
            )
            html.write_text(
                "location ^~ /economy/ {\n"
                "    root /var/www/game;\n"
                "    try_files $uri /economy/index.html;\n"
                "}\n",
                encoding="utf-8",
            )
            backup.write_text(html.read_text(encoding="utf-8"), encoding="utf-8")

            changes, found = cache.collect_config_changes((assets, html, backup))

            self.assertEqual(found, {"/economy/assets/", "/economy/"})
            self.assertEqual({path for path, _old, _new in changes}, {assets.resolve(), html.resolve()})

    def test_finds_vite_asset_paths(self) -> None:
        self.assertEqual(
            cache.find_static_asset_path(
                '<script type="module" src="/economy/assets/index-abc.js"></script>'
            ),
            "/economy/assets/index-abc.js",
        )
        self.assertEqual(
            cache.find_static_asset_path(
                '<link rel="stylesheet" href="./assets/index-def.css">'
            ),
            "/economy/assets/index-def.css",
        )

    def test_validates_cache_and_vary_headers(self) -> None:
        cache.validate_cache_headers(
            "asset",
            {
                "cache-control": "public, max-age=31536000, immutable",
                "vary": "Accept-Encoding",
            },
            cache.STATIC_ASSET_CACHE_CONTROL,
        )
        with self.assertRaisesRegex(RuntimeError, "ECONOMY_STATIC_CACHE_CONTROL_INVALID"):
            cache.validate_cache_headers(
                "asset",
                {"cache-control": "max-age=60", "vary": "Accept-Encoding"},
                cache.STATIC_ASSET_CACHE_CONTROL,
            )
        with self.assertRaisesRegex(RuntimeError, "ECONOMY_STATIC_CACHE_VARY_MISSING"):
            cache.validate_cache_headers(
                "asset",
                {"cache-control": cache.STATIC_ASSET_CACHE_CONTROL},
                cache.STATIC_ASSET_CACHE_CONTROL,
            )


if __name__ == "__main__":
    unittest.main()
