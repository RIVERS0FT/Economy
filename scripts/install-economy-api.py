#!/usr/bin/env python3
from __future__ import annotations

import grp
import os
import pwd
import shutil
import subprocess
import sys
from pathlib import Path

SERVICE_NAME = "riversoft-economy-api.service"
SERVICE_PATH = Path("/etc/systemd/system") / SERVICE_NAME
STATE_DIRECTORY = Path("/var/lib/riversoft-economy")
MINIMUM_NODE = (22, 16, 0)


def run(command: list[str], *, capture: bool = False) -> str:
    completed = subprocess.run(command, check=True, text=True, capture_output=capture)
    return completed.stdout.strip() if capture else ""


def find_node(release_dir: Path) -> Path:
    bundled = release_dir / "runtime" / "bin" / "node"
    candidates = [bundled]
    system_node = shutil.which("node")
    if system_node:
        candidates.append(Path(system_node))

    for candidate in candidates:
        if candidate.is_file() and os.access(candidate, os.X_OK):
            return candidate.resolve()

    raise RuntimeError(
        "Node.js runtime is unavailable; expected "
        f"{bundled} or a system node executable"
    )


def main() -> int:
    if os.geteuid() != 0:
        raise RuntimeError("This script must run as root")
    if len(sys.argv) != 3:
        raise RuntimeError("Usage: install-economy-api.py <release-dir> <service-user>")

    release_dir = Path(sys.argv[1]).resolve()
    service_user = sys.argv[2]
    account = pwd.getpwnam(service_user)
    service_group = grp.getgrgid(account.pw_gid).gr_name

    required = [
        release_dir / "package.json",
        release_dir / "src" / "index.js",
        release_dir / "src" / "domain.js",
        release_dir / "src" / "storage.js",
    ]
    missing = [str(path) for path in required if not path.is_file()]
    if missing:
        raise RuntimeError("Missing Economy API files: " + ", ".join(missing))

    node_path = find_node(release_dir)
    version = run([str(node_path), "-p", "process.versions.node"], capture=True)
    major, minor, patch = (int(part) for part in version.split(".")[:3])
    if (major, minor, patch) < MINIMUM_NODE:
        raise RuntimeError(f"Node.js 22.16.0 or newer is required, found {version}")

    run([str(node_path), "-e", "require('node:sqlite')"])

    STATE_DIRECTORY.mkdir(parents=True, exist_ok=True)
    os.chown(STATE_DIRECTORY, account.pw_uid, account.pw_gid)
    os.chmod(STATE_DIRECTORY, 0o750)

    service = f"""[Unit]
Description=RIVERSOFT Economy authoritative game API
After=network.target

[Service]
Type=simple
User={service_user}
Group={service_group}
WorkingDirectory={release_dir}
Environment=NODE_ENV=production
Environment=PORT=3002
Environment=ECONOMY_DB_PATH={STATE_DIRECTORY / 'economy.sqlite'}
Environment=ACCOUNT_SERVICE_URL=http://127.0.0.1:3001
Environment=ACCOUNT_SERVICE_HOST=riversoft.top
Environment=PUBLIC_ORIGIN=https://game.riversoft.top
ExecStart={node_path} src/index.js
Restart=on-failure
RestartSec=3
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths={STATE_DIRECTORY}

[Install]
WantedBy=multi-user.target
"""
    SERVICE_PATH.write_text(service, encoding="utf-8")
    os.chmod(SERVICE_PATH, 0o644)

    run(["systemctl", "daemon-reload"])
    run(["systemctl", "enable", SERVICE_NAME])
    run(["systemctl", "restart", SERVICE_NAME])
    run(["systemctl", "is-active", "--quiet", SERVICE_NAME])
    print(f"Installed {SERVICE_NAME} with Node.js {version} at {node_path}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print(f"ECONOMY_API_INSTALL_FAILED: {error}", file=sys.stderr)
        raise SystemExit(1)
