#!/usr/bin/env python3
from __future__ import annotations

import importlib.util
import unittest
from pathlib import Path

MODULE_PATH = Path(__file__).with_name("configure-economy-registration-nginx.py")
SPEC = importlib.util.spec_from_file_location("configure_economy_registration_nginx", MODULE_PATH)
if SPEC is None or SPEC.loader is None:
    raise RuntimeError(f"Unable to load {MODULE_PATH}")
registration = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(registration)


def server(*directives: str) -> str:
    body = "\n".join(f"    {directive}" for directive in directives)
    return (
        "server {\n"
        "    server_name game.riversoft.top;\n"
        f"{body}\n"
        "    listen 443 ssl;\n"
        "}\n"
    )


class RegistrationProxyTests(unittest.TestCase):
    def test_adds_registration_and_password_reset_routes_idempotently(self) -> None:
        original = server("location / { return 404; }")
        updated = registration.replace_or_insert(original)
        self.assertIn("location ^~ /economy-api/registration/", updated)
        self.assertIn("proxy_pass http://127.0.0.1:3002/api/registration/;", updated)
        self.assertIn("location ^~ /economy-api/password-reset/", updated)
        self.assertIn("proxy_pass http://127.0.0.1:3001/api/password-reset/;", updated)
        self.assertIn('proxy_set_header Origin "";', updated)
        self.assertIn("client_max_body_size 16k;", updated)
        self.assertEqual(registration.replace_or_insert(updated), updated)

    def test_preserves_existing_manual_registration_route_and_adds_password_reset(self) -> None:
        original = server(
            "location ^~ /economy-api/registration/ { proxy_pass http://127.0.0.1:3002/api/registration/; }"
        )
        updated = registration.replace_or_insert(original)
        self.assertEqual(updated.count("location ^~ /economy-api/registration/"), 1)
        self.assertIn("location ^~ /economy-api/password-reset/", updated)
        self.assertEqual(registration.replace_or_insert(updated), updated)

    def test_preserves_both_existing_manual_routes(self) -> None:
        original = server(
            "location ^~ /economy-api/registration/ { proxy_pass http://127.0.0.1:3002/api/registration/; }",
            "location ^~ /economy-api/password-reset/ { proxy_pass http://127.0.0.1:3001/api/password-reset/; }",
        )
        self.assertEqual(registration.replace_or_insert(original), original)


if __name__ == "__main__":
    unittest.main()
