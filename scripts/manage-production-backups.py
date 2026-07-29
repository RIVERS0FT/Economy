#!/usr/bin/env python3
from __future__ import annotations

import argparse
import datetime as dt
import gzip
import hashlib
import json
import os
import re
import shutil
import sqlite3
import stat
import sys
from pathlib import Path
from typing import Any

DEFAULT_DATABASE = Path('/var/lib/riversoft-economy/economy.sqlite')
DEFAULT_BACKUP_DIRECTORY = Path('/var/lib/riversoft-economy/backups')
MAX_BACKUP_FAMILIES = 5
MIN_BACKUP_HEADROOM_BYTES = 512 * 1024 * 1024
COPY_CHUNK_BYTES = 1024 * 1024
TIMESTAMP_PATTERN = re.compile(
    r'^(?P<family>economy-pre-.+)-\d{8}T\d{6}Z\.sqlite(?:\.(?:gz|zst))?$'
)


def _utc_timestamp() -> str:
    return dt.datetime.now(dt.timezone.utc).strftime('%Y%m%dT%H%M%SZ')


def _quote_sql_string(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


def _snapshot_key(path: Path) -> tuple[int, str]:
    file_stat = path.stat()
    return file_stat.st_mtime_ns, path.name


def _backup_family(path: Path) -> str:
    match = TIMESTAMP_PATTERN.match(path.name)
    return match.group('family') if match else path.name


def _backup_snapshots(backup_directory: Path) -> list[Path]:
    return sorted(
        (
            path
            for path in backup_directory.glob('economy-pre-*')
            if path.is_file() and TIMESTAMP_PATTERN.match(path.name)
        ),
        key=_snapshot_key,
        reverse=True,
    )


def prune_backups(backup_directory: Path, maximum_families: int) -> dict[str, int]:
    backup_directory.mkdir(mode=0o700, parents=True, exist_ok=True)
    snapshots = _backup_snapshots(backup_directory)
    latest_by_family: dict[str, Path] = {}
    for snapshot in snapshots:
        latest_by_family.setdefault(_backup_family(snapshot), snapshot)
    representatives = sorted(latest_by_family.values(), key=_snapshot_key, reverse=True)
    keep = set(representatives[:maximum_families])
    removed_count = 0
    removed_bytes = 0
    for snapshot in snapshots:
        if snapshot in keep:
            continue
        removed_bytes += snapshot.stat().st_size
        snapshot.unlink()
        removed_count += 1
    return {
        'families': len(keep),
        'removedCount': removed_count,
        'removedBytes': removed_bytes,
    }


def _single(connection: sqlite3.Connection, sql: str) -> Any:
    row = connection.execute(sql).fetchone()
    return None if row is None else row[0]


def _world_info(connection: sqlite3.Connection) -> dict[str, Any]:
    try:
        row = connection.execute(
            'SELECT revision, state_json, updated_at FROM economy_world WHERE id = 1'
        ).fetchone()
    except sqlite3.OperationalError as error:
        if 'no such table' not in str(error).lower():
            raise
        row = None
    if not row:
        return {'present': False, 'version': 0}
    state_json = str(row[1])
    parsed = json.loads(state_json)
    return {
        'present': True,
        'revision': int(row[0]),
        'version': int(parsed.get('version') or 0),
        'updatedAt': int(row[2]),
        'stateJsonBytes': len(state_json.encode('utf-8')),
        'stateJsonSha256': hashlib.sha256(state_json.encode('utf-8')).hexdigest(),
    }


def _database_metrics(connection: sqlite3.Connection, database_path: Path) -> dict[str, int]:
    page_size = int(_single(connection, 'PRAGMA page_size') or 0)
    page_count = int(_single(connection, 'PRAGMA page_count') or 0)
    freelist_count = int(_single(connection, 'PRAGMA freelist_count') or 0)
    allocated_bytes = page_size * page_count
    reclaimable_bytes = page_size * freelist_count
    return {
        'fileBytes': database_path.stat().st_size,
        'pageSize': page_size,
        'pageCount': page_count,
        'freelistCount': freelist_count,
        'allocatedBytes': allocated_bytes,
        'reclaimableBytes': reclaimable_bytes,
        'estimatedLiveBytes': max(0, allocated_bytes - reclaimable_bytes),
        'autoVacuum': int(_single(connection, 'PRAGMA auto_vacuum') or 0),
    }


def _check_database(connection: sqlite3.Connection) -> dict[str, int | str]:
    quick_check = str(_single(connection, 'PRAGMA quick_check(1)') or 'missing')
    foreign_key_violations = len(connection.execute('PRAGMA foreign_key_check').fetchall())
    if quick_check != 'ok':
        raise RuntimeError(f'ECONOMY_BACKUP_QUICK_CHECK_FAILED: {quick_check}')
    if foreign_key_violations:
        raise RuntimeError(
            f'ECONOMY_BACKUP_FOREIGN_KEY_CHECK_FAILED: rows={foreign_key_violations}'
        )
    return {
        'quickCheck': quick_check,
        'foreignKeyViolations': foreign_key_violations,
    }


def _sha256_file(path: Path) -> tuple[str, int]:
    digest = hashlib.sha256()
    size = 0
    with path.open('rb') as source:
        while chunk := source.read(COPY_CHUNK_BYTES):
            digest.update(chunk)
            size += len(chunk)
    return digest.hexdigest(), size


def _compress_gzip(source_path: Path, target_path: Path) -> None:
    with source_path.open('rb') as source, target_path.open('wb') as raw_target:
        with gzip.GzipFile(
            filename=source_path.name,
            mode='wb',
            compresslevel=6,
            fileobj=raw_target,
            mtime=0,
        ) as compressed:
            shutil.copyfileobj(source, compressed, length=COPY_CHUNK_BYTES)
        raw_target.flush()
        os.fsync(raw_target.fileno())


def _verify_gzip(path: Path, expected_sha256: str, expected_size: int) -> None:
    digest = hashlib.sha256()
    size = 0
    with gzip.open(path, 'rb') as source:
        while chunk := source.read(COPY_CHUNK_BYTES):
            digest.update(chunk)
            size += len(chunk)
    if size != expected_size or digest.hexdigest() != expected_sha256:
        raise RuntimeError(
            'ECONOMY_BACKUP_GZIP_VERIFICATION_FAILED '
            f'expected_size={expected_size} actual_size={size}'
        )


def _fsync_directory(path: Path) -> None:
    descriptor = os.open(path, os.O_RDONLY)
    try:
        os.fsync(descriptor)
    finally:
        os.close(descriptor)


def _remove_if_exists(path: Path) -> None:
    try:
        path.unlink()
    except FileNotFoundError:
        pass


def create_world_backup(args: argparse.Namespace) -> dict[str, Any]:
    database_path = Path(args.database).resolve()
    backup_directory = Path(args.backup_directory).resolve()
    retention_before = prune_backups(backup_directory, args.maximum_families)
    if not database_path.is_file():
        return {
            'status': 'skipped',
            'reason': 'database-missing',
            'retentionBefore': retention_before,
        }

    database_stat = database_path.stat()
    with sqlite3.connect(database_path, isolation_level=None, timeout=60) as source:
        source_world = _world_info(source)
        source_metrics = _database_metrics(source, database_path)
        if source_world['version'] >= args.target_world_version:
            return {
                'status': 'skipped',
                'reason': 'world-version-current',
                'currentWorldVersion': source_world['version'],
                'retentionBefore': retention_before,
            }

        required_bytes = max(
            MIN_BACKUP_HEADROOM_BYTES,
            int(source_metrics['estimatedLiveBytes']) * 2 + 64 * 1024 * 1024,
        )
        available_bytes = shutil.disk_usage(database_path.parent).free
        if available_bytes < required_bytes:
            raise RuntimeError(
                'ECONOMY_BACKUP_INSUFFICIENT_DISK '
                f'available_bytes={available_bytes} required_bytes={required_bytes}'
            )

        timestamp = _utc_timestamp()
        family = f'economy-pre-world-v{args.target_world_version}'
        compact_path = backup_directory / f'.{family}-{timestamp}.sqlite.tmp'
        compressed_path = backup_directory / f'.{family}-{timestamp}.sqlite.gz.tmp'
        final_path = backup_directory / f'{family}-{timestamp}.sqlite.gz'
        for path in (compact_path, compressed_path, final_path):
            if path.exists():
                raise RuntimeError(f'ECONOMY_BACKUP_TARGET_ALREADY_EXISTS: {path}')

        try:
            source.execute(f'VACUUM INTO {_quote_sql_string(str(compact_path))}')

            compact_uri = f'file:{compact_path.as_posix()}?mode=ro'
            with sqlite3.connect(compact_uri, uri=True, timeout=60) as compact:
                compact.execute('PRAGMA query_only = ON')
                checks = _check_database(compact)
                backup_world = _world_info(compact)
                compact_metrics = _database_metrics(compact, compact_path)
            if compact_metrics['autoVacuum'] != source_metrics['autoVacuum']:
                raise RuntimeError(
                    'ECONOMY_BACKUP_AUTO_VACUUM_MISMATCH '
                    f'source={source_metrics["autoVacuum"]} '
                    f'backup={compact_metrics["autoVacuum"]}'
                )
            if backup_world['version'] >= args.target_world_version:
                raise RuntimeError(
                    'ECONOMY_BACKUP_NOT_PRE_MIGRATION '
                    f'backup_world_version={backup_world["version"]}'
                )

            compact_sha256, compact_size = _sha256_file(compact_path)
            _compress_gzip(compact_path, compressed_path)
            _verify_gzip(compressed_path, compact_sha256, compact_size)
            os.chown(compressed_path, database_stat.st_uid, database_stat.st_gid)
            os.chmod(compressed_path, stat.S_IRUSR | stat.S_IWUSR)
            os.replace(compressed_path, final_path)
            _fsync_directory(backup_directory)
        finally:
            _remove_if_exists(compact_path)
            _remove_if_exists(compressed_path)

    retention_after = prune_backups(backup_directory, args.maximum_families)
    return {
        'status': 'created',
        'path': str(final_path),
        'source': source_metrics,
        'backup': compact_metrics,
        'compressedBytes': final_path.stat().st_size,
        'compressionRatioPpm': round(final_path.stat().st_size * 1_000_000 / compact_size),
        'world': backup_world,
        'checks': checks,
        'availableBytes': available_bytes,
        'requiredBytes': required_bytes,
        'retentionBefore': retention_before,
        'retentionAfter': retention_after,
    }


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description='Economy compact compressed backups')
    subparsers = parser.add_subparsers(dest='command', required=True)
    backup = subparsers.add_parser('backup-world')
    backup.add_argument('--database', default=str(DEFAULT_DATABASE))
    backup.add_argument('--backup-directory', default=str(DEFAULT_BACKUP_DIRECTORY))
    backup.add_argument('--target-world-version', type=int, required=True)
    backup.add_argument('--maximum-families', type=int, default=MAX_BACKUP_FAMILIES)
    backup.set_defaults(handler=create_world_backup)
    return parser


def main() -> int:
    args = build_parser().parse_args()
    report = args.handler(args)
    print(json.dumps(report, ensure_ascii=False, sort_keys=True))
    return 0


if __name__ == '__main__':
    try:
        raise SystemExit(main())
    except Exception as error:  # noqa: BLE001 - emit one stable workflow marker
        print(f'ECONOMY_BACKUP_FAILED: {error}', file=sys.stderr)
        raise SystemExit(1)
