#!/usr/bin/env python3
from __future__ import annotations

import importlib.util
import unittest
from pathlib import Path

SCRIPT = Path(__file__).with_name("configure-economy-ip-fallback-nginx.py")
spec = importlib.util.spec_from_file_location("economy_ip_fallback", SCRIPT)
module = importlib.util.module_from_spec(spec)
assert spec.loader is not None
spec.loader.exec_module(module)


class EconomyIpFallbackNginxTests(unittest.TestCase):
    def test_bootstrap_only_exposes_acme_and_refuses_other_http_requests(self):
        config = module.bootstrap_config()
        self.assertIn("server_name 123.60.108.5;", config)
        self.assertIn("location ^~ /.well-known/acme-challenge/", config)
        self.assertIn("return 503;", config)
        self.assertNotIn("listen 443 ssl", config)

    def test_final_config_redirects_http_and_serves_trusted_https_ip(self):
        config = module.final_config()
        self.assertIn("return 308 https://123.60.108.5$request_uri;", config)
        self.assertIn("listen 443 ssl;", config)
        self.assertIn("server_name 123.60.108.5;", config)
        self.assertIn(str(module.CERTIFICATE), config)
        self.assertIn(str(module.PRIVATE_KEY), config)
        self.assertIn("ssl_protocols TLSv1.2 TLSv1.3;", config)
        self.assertIn("location ^~ /economy/", config)
        self.assertIn("try_files $uri $uri/ /economy/index.html;", config)
        self.assertIn('/economy/assets/', config)
        self.assertIn('public, max-age=31536000, immutable', config)
        self.assertIn('no-cache, max-age=0, must-revalidate', config)

    def test_final_config_proxies_every_same_origin_api_needed_by_client(self):
        config = module.final_config()
        for path in (
            "/economy-api/login",
            "/economy-api/me",
            "/economy-api/logout",
            "/economy-api/game/",
            "/economy-api/registration/",
        ):
            self.assertIn(path, config)
        self.assertIn("proxy_pass http://127.0.0.1:3001/api/login;", config)
        self.assertIn("proxy_pass http://127.0.0.1:3002/api/game/;", config)
        self.assertIn("proxy_pass http://127.0.0.1:3002/api/registration/;", config)
        self.assertGreaterEqual(config.count('proxy_set_header Origin "";'), 5)
        self.assertIn("proxy_set_header X-Forwarded-Proto https;", config)

    def test_certbot_uses_pinned_ip_capable_release_and_shortlived_profile(self):
        command = module.certbot_command()
        self.assertEqual(module.CERTBOT_VERSION, "5.4.0")
        self.assertIn("--preferred-profile", command)
        self.assertEqual(command[command.index("--preferred-profile") + 1], "shortlived")
        self.assertIn("--ip-address", command)
        self.assertEqual(command[command.index("--ip-address") + 1], "123.60.108.5")
        self.assertIn("--webroot", command)
        self.assertIn("--keep-until-expiring", command)

    def test_renewal_timer_checks_six_hourly_and_reloads_nginx(self):
        service = module.renewal_service()
        timer = module.renewal_timer()
        self.assertIn("certbot renew --quiet", service)
        self.assertIn("--cert-name riversoft-economy-ip-123-60-108-5", service)
        self.assertIn("systemctl reload nginx", service)
        self.assertIn("OnCalendar=*-*-* 00/6:17:00", timer)
        self.assertIn("Persistent=true", timer)


if __name__ == "__main__":
    unittest.main()
