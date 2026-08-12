#!/usr/bin/env python3
from __future__ import annotations

import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

PUBLIC_IP = "123.60.108.5"
FORMAL_DOMAIN = "game.riversoft.top"
WEB_ROOT = Path("/var/www/game")
ECONOMY_ROOT = WEB_ROOT / "economy"
CONFIG_PATH = Path("/etc/nginx/conf.d/riversoft-economy-ip-fallback.conf")
CERTBOT_ROOT = Path("/opt/riversoft-certbot")
CERTBOT_VERSION = "5.4.0"
CERTBOT = CERTBOT_ROOT / "bin/certbot"
CERT_NAME = "riversoft-economy-ip-123-60-108-5"
CERTIFICATE = Path(f"/etc/letsencrypt/live/{CERT_NAME}/fullchain.pem")
PRIVATE_KEY = Path(f"/etc/letsencrypt/live/{CERT_NAME}/privkey.pem")
RENEW_SERVICE = Path("/etc/systemd/system/riversoft-economy-ip-cert-renew.service")
RENEW_TIMER = Path("/etc/systemd/system/riversoft-economy-ip-cert-renew.timer")


def account_locations() -> str:
    return """
    location = /economy-api/login {
        proxy_pass http://127.0.0.1:3001/api/login;
        proxy_http_version 1.1;
        proxy_set_header Host riversoft.top;
        proxy_set_header X-Forwarded-Host riversoft.top;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header Origin "";
        proxy_cookie_path / /;
    }

    location = /economy-api/me {
        proxy_pass http://127.0.0.1:3001/api/me;
        proxy_http_version 1.1;
        proxy_set_header Host riversoft.top;
        proxy_set_header X-Forwarded-Host riversoft.top;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header Origin "";
        proxy_cookie_path / /;
    }

    location = /economy-api/logout {
        proxy_pass http://127.0.0.1:3001/api/logout;
        proxy_http_version 1.1;
        proxy_set_header Host riversoft.top;
        proxy_set_header X-Forwarded-Host riversoft.top;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header Origin "";
        proxy_cookie_path / /;
    }
""".strip("\n")


def game_api_location() -> str:
    return f"""
    location ^~ /economy-api/game/ {{
        proxy_pass http://127.0.0.1:3002/api/game/;
        proxy_http_version 1.1;
        proxy_set_header Host {FORMAL_DOMAIN};
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header X-Forwarded-Host {FORMAL_DOMAIN};
        proxy_set_header Origin "";
        proxy_connect_timeout 5s;
        proxy_read_timeout 30s;
        client_max_body_size 256k;
        gzip on;
        gzip_vary on;
        gzip_proxied any;
        gzip_min_length 1024;
        gzip_comp_level 5;
        gzip_types application/json;
    }}
""".strip("\n")


def registration_location() -> str:
    return f"""
    location ^~ /economy-api/registration/ {{
        proxy_pass http://127.0.0.1:3002/api/registration/;
        proxy_http_version 1.1;
        proxy_set_header Host {FORMAL_DOMAIN};
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header X-Forwarded-Host {FORMAL_DOMAIN};
        proxy_set_header Origin "";
        proxy_connect_timeout 5s;
        proxy_read_timeout 30s;
        client_max_body_size 16k;
    }}
""".strip("\n")


def bootstrap_config() -> str:
    return f"""# Temporary Economy public-IP ACME bootstrap. Managed by {Path(__file__).name}.
server {{
    listen 80;
    listen [::]:80;
    server_name {PUBLIC_IP};

    location ^~ /.well-known/acme-challenge/ {{
        root {WEB_ROOT};
        try_files $uri =404;
    }}

    location / {{
        return 503;
    }}
}}
"""


def final_config() -> str:
    return f"""# Temporary Economy public-IP HTTPS fallback. Managed by {Path(__file__).name}.
server {{
    listen 80;
    listen [::]:80;
    server_name {PUBLIC_IP};

    location ^~ /.well-known/acme-challenge/ {{
        root {WEB_ROOT};
        try_files $uri =404;
    }}

    location / {{
        return 308 https://{PUBLIC_IP}$request_uri;
    }}
}}

server {{
    listen 443 ssl;
    listen [::]:443 ssl;
    server_name {PUBLIC_IP};

    ssl_certificate {CERTIFICATE};
    ssl_certificate_key {PRIVATE_KEY};
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_session_cache shared:ECONOMY_IP_SSL:10m;
    ssl_session_timeout 1d;
    ssl_session_tickets off;

    root {WEB_ROOT};
    index index.html;

    location = / {{
        return 302 /economy/;
    }}

    location = /economy {{
        return 308 /economy/;
    }}

    location ^~ /economy/assets/ {{
        try_files $uri =404;
        add_header Cache-Control "public, max-age=31536000, immutable" always;
        add_header Vary "Accept-Encoding" always;
    }}

    location ^~ /economy/ {{
        try_files $uri $uri/ /economy/index.html;
        add_header Cache-Control "no-cache, max-age=0, must-revalidate" always;
        add_header Vary "Accept-Encoding" always;
    }}

{account_locations()}

{game_api_location()}

{registration_location()}
}}
"""


def certbot_command() -> list[str]:
    return [
        str(CERTBOT),
        "certonly",
        "--non-interactive",
        "--agree-tos",
        "--register-unsafely-without-email",
        "--preferred-profile",
        "shortlived",
        "--webroot",
        "--webroot-path",
        str(WEB_ROOT),
        "--ip-address",
        PUBLIC_IP,
        "--cert-name",
        CERT_NAME,
        "--keep-until-expiring",
    ]


def renewal_service() -> str:
    return f"""[Unit]
Description=Renew temporary Economy public-IP certificate
After=network-online.target nginx.service
Wants=network-online.target

[Service]
Type=oneshot
ExecStart={CERTBOT} renew --quiet --cert-name {CERT_NAME} --deploy-hook \"/usr/bin/systemctl reload nginx\"
"""


def renewal_timer() -> str:
    return """[Unit]
Description=Renew temporary Economy public-IP certificate regularly

[Timer]
OnCalendar=*-*-* 00/6:17:00
RandomizedDelaySec=20m
Persistent=true
Unit=riversoft-economy-ip-cert-renew.service

[Install]
WantedBy=timers.target
"""


def write_atomic(path: Path, content: str, mode: int = 0o644) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temp_name = tempfile.mkstemp(prefix=path.name + ".", dir=str(path.parent))
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8", newline="\n") as handle:
            handle.write(content)
        os.chmod(temp_name, mode)
        os.replace(temp_name, path)
    finally:
        if os.path.exists(temp_name):
            os.unlink(temp_name)


def run(*args: str) -> None:
    subprocess.run(list(args), check=True)


def nginx_reload() -> None:
    run("nginx", "-t")
    run("systemctl", "reload", "nginx")


def ensure_certbot() -> None:
    expected = f"certbot {CERTBOT_VERSION}"
    if CERTBOT.exists():
        completed = subprocess.run(
            [str(CERTBOT), "--version"],
            check=False,
            capture_output=True,
            text=True,
        )
        if completed.returncode == 0 and completed.stdout.strip() == expected:
            return
        shutil.rmtree(CERTBOT_ROOT, ignore_errors=True)

    try:
        run("python3", "-m", "venv", str(CERTBOT_ROOT))
    except subprocess.CalledProcessError:
        run("apt-get", "update")
        run("apt-get", "install", "-y", "python3-venv")
        run("python3", "-m", "venv", str(CERTBOT_ROOT))

    run(
        str(CERTBOT_ROOT / "bin/pip"),
        "install",
        "--disable-pip-version-check",
        f"certbot=={CERTBOT_VERSION}",
    )


def install_renewal_timer() -> None:
    write_atomic(RENEW_SERVICE, renewal_service())
    write_atomic(RENEW_TIMER, renewal_timer())
    run("systemctl", "daemon-reload")
    run("systemctl", "enable", "--now", RENEW_TIMER.name)


def restore_config(previous: bytes | None) -> None:
    try:
        if previous is None:
            CONFIG_PATH.unlink(missing_ok=True)
        else:
            CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)
            CONFIG_PATH.write_bytes(previous)
        run("nginx", "-t")
        run("systemctl", "reload", "nginx")
    except Exception as error:
        print(f"ECONOMY_IP_FALLBACK_ROLLBACK_FAILED: {error}", file=sys.stderr)


def main() -> int:
    if os.geteuid() != 0:
        raise RuntimeError("This script must run as root")
    if not ECONOMY_ROOT.joinpath("index.html").is_file():
        raise RuntimeError(f"Economy entry is missing: {ECONOMY_ROOT / 'index.html'}")

    previous = CONFIG_PATH.read_bytes() if CONFIG_PATH.exists() else None
    (WEB_ROOT / ".well-known/acme-challenge").mkdir(parents=True, exist_ok=True)

    try:
        ensure_certbot()
        if not CERTIFICATE.is_file() or not PRIVATE_KEY.is_file():
            write_atomic(CONFIG_PATH, bootstrap_config())
            nginx_reload()
        run(*certbot_command())
        if not CERTIFICATE.is_file() or not PRIVATE_KEY.is_file():
            raise RuntimeError("Certbot completed without creating the IP certificate")
        write_atomic(CONFIG_PATH, final_config())
        nginx_reload()
        install_renewal_timer()
    except Exception:
        restore_config(previous)
        raise

    print(
        f"Configured trusted temporary Economy fallback at https://{PUBLIC_IP}/economy/ "
        f"with Certbot {CERTBOT_VERSION} and 6-hour renewal checks"
    )
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print(f"ECONOMY_IP_FALLBACK_CONFIGURATION_FAILED: {error}", file=sys.stderr)
        raise SystemExit(1)
