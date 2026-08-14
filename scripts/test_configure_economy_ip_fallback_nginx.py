#!/usr/bin/env python3
from __future__ import annotations

import importlib.util
import sys
import unittest
from pathlib import Path

SCRIPT = Path(__file__).with_name("configure-economy-ip-fallback-nginx.py")
ROOT = SCRIPT.parent.parent
PRODUCTION_IP = "116.204.134.56"
OLD_PUBLIC_IP = "123.60.108.5"
spec = importlib.util.spec_from_file_location("economy_ip_fallback", SCRIPT)
module = importlib.util.module_from_spec(spec)
assert spec.loader is not None
sys.modules[spec.name] = module
spec.loader.exec_module(module)


class EconomyIpFallbackNginxTests(unittest.TestCase):
    def setUp(self):
        self.target = module.public_ip_target(PRODUCTION_IP)

    def test_public_ip_target_requires_literal_global_ipv4(self):
        self.assertEqual(self.target.public_ip, PRODUCTION_IP)
        self.assertEqual(self.target.cert_name, "riversoft-economy-ip-116-204-134-56")
        self.assertEqual(
            self.target.certificate.as_posix(),
            "/etc/letsencrypt/live/riversoft-economy-ip-116-204-134-56/fullchain.pem",
        )
        for invalid in ("game.riversoft.top", "127.0.0.1", "10.0.0.1", "::1"):
            with self.subTest(invalid=invalid):
                with self.assertRaises(RuntimeError):
                    module.public_ip_target(invalid)

    def test_bootstrap_only_exposes_acme_and_refuses_other_http_requests(self):
        config = module.bootstrap_config(self.target)
        self.assertIn(f"server_name {PRODUCTION_IP};", config)
        self.assertIn("location ^~ /.well-known/acme-challenge/", config)
        self.assertIn("return 503;", config)
        self.assertNotIn("listen 443 ssl", config)

    def test_final_config_redirects_http_and_serves_trusted_https_ip(self):
        config = module.final_config(self.target)
        self.assertIn(f"return 308 https://{PRODUCTION_IP}$request_uri;", config)
        self.assertIn("listen 443 ssl;", config)
        self.assertIn(f"server_name {PRODUCTION_IP};", config)
        self.assertIn(self.target.certificate.as_posix(), config.replace('\\', '/'))
        self.assertIn(str(self.target.private_key), config)
        self.assertIn("ssl_protocols TLSv1.2 TLSv1.3;", config)
        self.assertIn("gzip_comp_level 6;", config)
        self.assertIn("location ^~ /economy/", config)
        self.assertIn("try_files $uri $uri/ /economy/index.html;", config)
        self.assertIn('/economy/assets/', config)
        self.assertIn('public, max-age=31536000, immutable', config)
        self.assertIn('no-cache, max-age=0, must-revalidate', config)
        self.assertIn("location / {\n        return 404;\n    }", config)

    def test_final_config_rechecks_original_browser_origin_before_proxying(self):
        config = module.final_config(self.target)
        self.assertIn("map $http_origin $economy_ip_origin_allowed", config)
        self.assertIn(f'"https://{PRODUCTION_IP}" 1;', config)
        self.assertIn("map $http_sec_fetch_site $economy_ip_fetch_site_allowed", config)
        self.assertIn("same-origin 1;", config)
        self.assertIn("same-site 1;", config)
        self.assertIn("if ($economy_ip_origin_allowed = 0) { return 403; }", config)
        self.assertIn("if ($economy_ip_fetch_site_allowed = 0) { return 403; }", config)

    def test_final_config_proxies_every_same_origin_api_needed_by_client(self):
        config = module.final_config(self.target)
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
        command = module.certbot_command(self.target)
        self.assertEqual(module.CERTBOT_VERSION, "5.4.0")
        self.assertIn("--preferred-profile", command)
        self.assertEqual(command[command.index("--preferred-profile") + 1], "shortlived")
        self.assertIn("--ip-address", command)
        self.assertEqual(command[command.index("--ip-address") + 1], PRODUCTION_IP)
        self.assertIn("--webroot", command)
        self.assertIn("--keep-until-expiring", command)

    def test_renewal_timer_checks_six_hourly_and_reloads_nginx(self):
        service = module.renewal_service(self.target)
        timer = module.renewal_timer()
        self.assertIn("certbot renew --quiet", service)
        self.assertIn("--cert-name riversoft-economy-ip-116-204-134-56", service)
        self.assertIn("systemctl reload nginx", service)
        self.assertIn("OnCalendar=*-*-* 00/6:17:00", timer)
        self.assertIn("Persistent=true", timer)

    def test_deploy_uses_one_production_ip_for_ssh_fallback_and_verification(self):
        workflow = (ROOT / ".github/workflows/deploy.yml").read_text(encoding="utf-8")
        verification = (ROOT / "scripts/verify-production-deployment.sh").read_text(encoding="utf-8")
        self.assertIn(f"ECONOMY_PRODUCTION_PUBLIC_IP: {PRODUCTION_IP}", workflow)
        self.assertNotIn("secrets.SERVER_HOST", workflow)
        self.assertIn('"$SERVER_USER@$ECONOMY_PRODUCTION_PUBLIC_IP"', workflow)
        self.assertIn("scripts/configure-economy-ip-fallback-nginx.py", workflow)
        self.assertIn("scripts/verify-production-deployment.sh", workflow)
        self.assertIn('"$ECONOMY_PRODUCTION_PUBLIC_IP"', workflow)
        self.assertIn("ECONOMY_IP_HTTP_REDIRECT_INVALID", verification)
        self.assertIn("riversoft-economy-ip-cert-renew.timer", verification)
        self.assertIn('"http://${PUBLIC_IP}/economy/"', verification)
        self.assertIn('"https://${PUBLIC_IP}/economy/"', verification)
        self.assertIn('--connect-to "${PUBLIC_IP}:443:127.0.0.1:443"', verification)
        self.assertIn("--noproxy '*'", verification)
        self.assertNotIn('/etc/letsencrypt/live/riversoft-economy-ip-', verification)
        self.assertNotIn(OLD_PUBLIC_IP, workflow)
        self.assertNotIn(OLD_PUBLIC_IP, verification)
        self.assertNotIn("curl -k", workflow)
        self.assertNotIn("curl -k", verification)
        self.assertNotIn("--insecure", workflow)
        self.assertNotIn("--insecure", verification)

    def test_authority_design_records_single_source_and_restore_boundaries(self):
        design = (ROOT / "docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md").read_text(encoding="utf-8")
        self.assertIn(f"`ECONOMY_PRODUCTION_PUBLIC_IP={PRODUCTION_IP}`", design)
        self.assertIn("SSH、IP 证书、临时 Nginx 入口和 Deploy 外部验收必须全部读取该值", design)
        self.assertIn("不得继续使用独立 `SERVER_HOST` Secret", design)
        self.assertIn("不得在脚本中维护第二个独立 IP 常量", design)
        self.assertIn("COOKIE_SECURE=true", design)
        self.assertIn("--preferred-profile shortlived", design)
        self.assertIn("riversoft-economy-ip-cert-renew.timer", design)
        self.assertIn("不得加 `-k`", design)
        self.assertIn("直接读取 `/etc/letsencrypt/live/`", design)
        self.assertIn("`--connect-to`", design)
        self.assertIn("127.0.0.1:443", design)
        self.assertIn("删除临时 IP 虚拟主机、续签 timer 和专用短期证书", design)
        self.assertNotIn(OLD_PUBLIC_IP, design)


if __name__ == "__main__":
    unittest.main()
