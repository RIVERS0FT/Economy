#!/usr/bin/env python3
from __future__ import annotations

import datetime
import gzip
import grp
import hashlib
import os
import pwd
import secrets
import shutil
import sqlite3
import subprocess
import sys
from pathlib import Path

SERVICE_NAME = "riversoft-economy-api.service"
SERVICE_PATH = Path("/etc/systemd/system") / SERVICE_NAME
STATE_DIRECTORY = Path("/var/lib/riversoft-economy")
REGISTRATION_SECRET_PATH = STATE_DIRECTORY / "registration-secret"
DATABASE_PATH = STATE_DIRECTORY / "economy.sqlite"
BACKUP_DIRECTORY = STATE_DIRECTORY / "backups"
SHARED_EMAIL_ENVIRONMENT_FILE = Path("/etc/riversoft-email.env")
ENVIRONMENT_FILE = Path("/etc/riversoft-economy-api.env")
MINIMUM_NODE = (22, 16, 0)
COPY_CHUNK_BYTES = 1024 * 1024


def run(command: list[str], *, capture: bool = False) -> str:
    completed = subprocess.run(command, check=True, text=True, capture_output=capture)
    return completed.stdout.strip() if capture else ""


def quote_sql_string(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


def sha256_file(path: Path) -> tuple[str, int]:
    digest = hashlib.sha256()
    size = 0
    with path.open("rb") as source:
        while chunk := source.read(COPY_CHUNK_BYTES):
            digest.update(chunk)
            size += len(chunk)
    return digest.hexdigest(), size


def compress_gzip(source_path: Path, target_path: Path) -> None:
    with source_path.open("rb") as source, target_path.open("wb") as raw_target:
        with gzip.GzipFile(
            filename=source_path.name,
            mode="wb",
            compresslevel=6,
            fileobj=raw_target,
            mtime=0,
        ) as compressed:
            shutil.copyfileobj(source, compressed, length=COPY_CHUNK_BYTES)
        raw_target.flush()
        os.fsync(raw_target.fileno())


def verify_gzip(path: Path, expected_sha256: str, expected_size: int) -> None:
    digest = hashlib.sha256()
    size = 0
    with gzip.open(path, "rb") as source:
        while chunk := source.read(COPY_CHUNK_BYTES):
            digest.update(chunk)
            size += len(chunk)
    if size != expected_size or digest.hexdigest() != expected_sha256:
        raise RuntimeError(
            "contract audit gzip verification failed "
            f"expected_size={expected_size} actual_size={size}"
        )


def backup_before_contract_audit(owner_uid: int, owner_gid: int) -> None:
    if not DATABASE_PATH.exists():
        print("ECONOMY_CONTRACT_AUDIT_BACKUP_SKIPPED_NO_DATABASE")
        return

    BACKUP_DIRECTORY.mkdir(mode=0o700, parents=True, exist_ok=True)
    timestamp = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    compact_path = BACKUP_DIRECTORY / f".economy-pre-contract-audit-{timestamp}.sqlite.tmp"
    compressed_path = BACKUP_DIRECTORY / f".economy-pre-contract-audit-{timestamp}.sqlite.gz.tmp"
    backup_path = BACKUP_DIRECTORY / f"economy-pre-contract-audit-{timestamp}.sqlite.gz"

    try:
        with sqlite3.connect(DATABASE_PATH, isolation_level=None, timeout=60) as source:
            audit_table = source.execute(
                "SELECT 1 FROM sqlite_master "
                "WHERE type = 'table' AND name = 'economy_contract_audit_events'"
            ).fetchone()
            if audit_table:
                print("ECONOMY_CONTRACT_AUDIT_BACKUP_SKIPPED_TABLE_EXISTS")
                return
            source_auto_vacuum = int(source.execute("PRAGMA auto_vacuum").fetchone()[0])
            source.execute(f"VACUUM INTO {quote_sql_string(str(compact_path))}")

        compact_uri = f"file:{compact_path.as_posix()}?mode=ro"
        with sqlite3.connect(compact_uri, uri=True, timeout=60) as compact:
            compact.execute("PRAGMA query_only = ON")
            quick_check = str(compact.execute("PRAGMA quick_check(1)").fetchone()[0])
            foreign_key_violations = len(compact.execute("PRAGMA foreign_key_check").fetchall())
            backup_auto_vacuum = int(compact.execute("PRAGMA auto_vacuum").fetchone()[0])
        if quick_check != "ok":
            raise RuntimeError(f"contract audit backup quick check failed: {quick_check}")
        if foreign_key_violations:
            raise RuntimeError(
                f"contract audit backup foreign key check failed: {foreign_key_violations}"
            )
        if backup_auto_vacuum != source_auto_vacuum:
            raise RuntimeError(
                "contract audit backup auto_vacuum mismatch "
                f"source={source_auto_vacuum} backup={backup_auto_vacuum}"
            )

        compact_sha256, compact_size = sha256_file(compact_path)
        compress_gzip(compact_path, compressed_path)
        verify_gzip(compressed_path, compact_sha256, compact_size)
        os.chown(compressed_path, owner_uid, owner_gid)
        os.chmod(compressed_path, 0o600)
        os.replace(compressed_path, backup_path)
    finally:
        compact_path.unlink(missing_ok=True)
        compressed_path.unlink(missing_ok=True)

    os.chown(BACKUP_DIRECTORY, owner_uid, owner_gid)
    os.chmod(BACKUP_DIRECTORY, 0o700)
    backups = sorted(
        [
            *BACKUP_DIRECTORY.glob("economy-pre-contract-audit-*.sqlite"),
            *BACKUP_DIRECTORY.glob("economy-pre-contract-audit-*.sqlite.gz"),
        ],
        key=lambda path: (path.stat().st_mtime_ns, path.name),
        reverse=True,
    )
    for stale in backups[10:]:
        stale.unlink()
    print(f"ECONOMY_CONTRACT_AUDIT_BACKUP_CREATED={backup_path}")


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
        release_dir / "src" / "app.js",
        release_dir / "src" / "domain.js",
        release_dir / "src" / "storage.js",
        release_dir / "src" / "registration.js",
        release_dir / "src" / "registration-store.js",
        release_dir / "src" / "email.js",
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
    backup_before_contract_audit(account.pw_uid, account.pw_gid)
    if not REGISTRATION_SECRET_PATH.exists():
        REGISTRATION_SECRET_PATH.write_text(secrets.token_urlsafe(48), encoding="utf-8")
    os.chown(REGISTRATION_SECRET_PATH, account.pw_uid, account.pw_gid)
    os.chmod(REGISTRATION_SECRET_PATH, 0o600)

    service = f"""[Unit]
Description=RIVERSOFT Economy authoritative game API
After=network.target

[Service]
Type=simple
User={service_user}
Group={service_group}
WorkingDirectory={release_dir}
EnvironmentFile=-{SHARED_EMAIL_ENVIRONMENT_FILE}
EnvironmentFile=-{ENVIRONMENT_FILE}
Environment=NODE_ENV=production
Environment=PORT=3002
Environment=ECONOMY_DB_PATH={STATE_DIRECTORY / 'economy.sqlite'}
Environment=ECONOMY_REGISTRATION_SECRET_FILE={REGISTRATION_SECRET_PATH}
Environment=ACCOUNT_SERVICE_URL=http://127.0.0.1:3001
Environment=ACCOUNT_SERVICE_HOST=riversoft.top
Environment=ACCOUNT_AUTH_STATE_CACHE_TTL_MS=10000
Environment=ACCOUNT_AUTH_WRITE_CACHE_TTL_MS=2000
Environment=ACCOUNT_AUTH_NEGATIVE_CACHE_TTL_MS=1000
Environment=ACCOUNT_AUTH_CACHE_MAX_ENTRIES=5000
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
