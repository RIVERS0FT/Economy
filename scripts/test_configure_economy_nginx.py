#!/usr/bin/env python3
from __future__ import annotations

import importlib.util
import unittest
from pathlib import Path

MODULE_PATH = Path(__file__).with_name("configure-economy-nginx.py")
SPEC = importlib.util.spec_from_file_location("configure_economy_nginx", MODULE_PATH)
if SPEC is None or SPEC.loader is None:
    raise RuntimeError(f"Unable to load {MODULE_PATH}")
nginx = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(nginx)


def server(*directives: str) -> str:
    body = "\n".join(f"    {directive}" for directive in directives)
    return (
        "server {\n"
        "    server_name game.riversoft.top;\n"
        f"{body}\n"
        "    listen 443 ssl;\n"
        "}\n"
    )


class ReplaceOrInsertTests(unittest.TestCase):
    def test_adds_full_proxy_when_no_routes_exist(self) -> None:
        original = server("location / { return 404; }")
        updated = nginx.replace_or_insert(original)

        self.assertIn("location = /economy-api/login", updated)
        self.assertIn("location = /economy-api/me", updated)
        self.assertIn("location = /economy-api/logout", updated)
        self.assertIn("location ^~ /economy-api/game/", updated)
        self.assertEqual(nginx.replace_or_insert(updated), updated)

    def test_account_snippet_adds_only_game_api_route(self) -> None:
        original = server(f"include {nginx.ACCOUNT_SNIPPET};")
        updated = nginx.replace_or_insert(original)

        self.assertIn(f"include {nginx.ACCOUNT_SNIPPET};", updated)
        self.assertNotIn("location = /economy-api/login", updated)
        self.assertNotIn("location = /economy-api/me", updated)
        self.assertNotIn("location = /economy-api/logout", updated)
        self.assertIn("location ^~ /economy-api/game/", updated)
        self.assertEqual(nginx.replace_or_insert(updated), updated)

    def test_existing_account_and_game_snippets_are_unchanged(self) -> None:
        original = server(
            f"include {nginx.ACCOUNT_SNIPPET};",
            f"include {nginx.GAME_API_SNIPPET};",
        )

        self.assertEqual(nginx.replace_or_insert(original), original)

    def test_legacy_managed_block_is_reduced_to_game_route(self) -> None:
        original = server(
            f"include {nginx.ACCOUNT_SNIPPET};",
            nginx.managed_block(account=True, game_api=True),
        )
        updated = nginx.replace_or_insert(original)

        self.assertNotIn("location = /economy-api/login", updated)
        self.assertIn("location ^~ /economy-api/game/", updated)
        self.assertEqual(updated.count(nginx.BEGIN), 1)
        self.assertEqual(nginx.replace_or_insert(updated), updated)

    def test_existing_manual_game_route_is_not_duplicated(self) -> None:
        original = server(
            f"include {nginx.ACCOUNT_SNIPPET};",
            "location ^~ /economy-api/game/ { proxy_pass http://127.0.0.1:3002/api/game/; }",
        )

        self.assertEqual(nginx.replace_or_insert(original), original)

    def test_legacy_broad_route_is_replaced(self) -> None:
        original = server(
            f"include {nginx.ACCOUNT_SNIPPET};",
            "location /economy-api/ { proxy_pass http://127.0.0.1:3001/api/; }",
        )
        updated = nginx.replace_or_insert(original)

        self.assertNotIn("location /economy-api/", updated)
        self.assertNotIn("location = /economy-api/login", updated)
        self.assertIn("location ^~ /economy-api/game/", updated)


if __name__ == "__main__":
    unittest.main()
