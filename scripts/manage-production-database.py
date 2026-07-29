#!/usr/bin/env python3
from __future__ import annotations

import argparse
import contextlib
import datetime as dt
import fcntl
import hashlib
import json
import os
import shutil
import sqlite3
import stat
import subprocess
import sys
import time
import urllib.request
from pathlib import Path
from typing import Any, Iterator

SERVICE_NAME = 'riversoft-economy-api.service'
DEFAULT_DATABASE = Path('/var/lib/riversoft-economy/economy.sqlite')
DEFAULT_BACKUP_DIRECTORY = Path('/var/lib/riversoft-economy/backups')
DEFAULT_LOCK_PATH = Path('/var/lock/riversoft-economy-database-maintenance.lock')
DEFAULT_HEALTH_URL = 'http://127.0.0.1:3002/health'
MINIMUM_HEADROOM_BYTES = 512 * 1024 * 1024
INCREMENTAL_MODE = 2
NONE_MODE = 0
REPORT_SCHEMA_VERSION = 1


def _utc_timestamp() -> str:
    return dt.datetime.now(dt.timezone.utc).strftime('%Y%m%dT%H%M%SZ')


def _quote_identifier(value: str) -> str:
    return '"' + value.replace('"', '""') + '"'


def _quote_sql_string(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


def _run(command: list[str], *, check: bool = True, capture: bool = False) -> subprocess.CompletedProcess[str]:
    return subprocess.run(command, check=check, text=True, capture_output=capture)


def _service_is_active(service_name: str) -> bool:
    result = _run(['systemctl', 'is-active', '--quiet', service_name], check=False)
    return result.returncode == 0


def _set_service(service_name: str, action: str) -> None:
    _run(['systemctl', action, service_name])


def _wait_for_health(url: str, timeout_seconds: int = 45) -> None:
    deadline = time.monotonic() + timeout_seconds
    last_error: Exception | None = None
    while time.monotonic() < deadline:
        try:
            with urllib.request.urlopen(url, timeout=3) as response:
                if response.status == 200:
                    return
        except Exception as error:  # noqa: BLE001 - surface the last concrete health failure
            last_error = error
        time.sleep(0.5)
    raise RuntimeError(f'ECONOMY_DATABASE_HEALTH_CHECK_FAILED: {last_error}')


@contextlib.contextmanager
def _exclusive_lock(path: Path) -> Iterator[None]:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open('a+', encoding='utf-8') as handle:
        fcntl.flock(handle.fileno(), fcntl.LOCK_EX)
        try:
            yield
        finally:
            fcntl.flock(handle.fileno(), fcntl.LOCK_UN)


def _connect(path: Path, *, readonly: bool = False, timeout: float = 60.0) -> sqlite3.Connection:
    if readonly:
        uri = f'file:{path.resolve().as_posix()}?mode=ro'
        connection = sqlite3.connect(uri, uri=True, timeout=timeout)
        connection.execute('PRAGMA query_only = ON')
    else:
        connection = sqlite3.connect(path, timeout=timeout)
    connection.row_factory = sqlite3.Row
    return connection


def _single(connection: sqlite3.Connection, sql: str) -> Any:
    row = connection.execute(sql).fetchone()
    return None if row is None else row[0]


def _check_database(connection: sqlite3.Connection) -> dict[str, Any]:
    quick_check = str(_single(connection, 'PRAGMA quick_check(1)') or 'missing')
    foreign_key_rows = connection.execute('PRAGMA foreign_key_check').fetchall()
    if quick_check != 'ok':
        raise RuntimeError(f'ECONOMY_DATABASE_QUICK_CHECK_FAILED: {quick_check}')
    if foreign_key_rows:
        raise RuntimeError(f'ECONOMY_DATABASE_FOREIGN_KEY_CHECK_FAILED: rows={len(foreign_key_rows)}')
    return {'quickCheck': quick_check, 'foreignKeyViolations': 0}


def _database_metrics(connection: sqlite3.Connection, database_path: Path) -> dict[str, Any]:
    page_size = int(_single(connection, 'PRAGMA page_size') or 0)
    page_count = int(_single(connection, 'PRAGMA page_count') or 0)
    freelist_count = int(_single(connection, 'PRAGMA freelist_count') or 0)
    allocated_bytes = page_size * page_count
    reclaimable_bytes = page_size * freelist_count
    estimated_live_bytes = max(0, allocated_bytes - reclaimable_bytes)
    ratio_ppm = round(reclaimable_bytes * 1_000_000 / allocated_bytes) if allocated_bytes else 0
    return {
        'fileBytes': database_path.stat().st_size if database_path.exists() else 0,
        'walBytes': Path(f'{database_path}-wal').stat().st_size if Path(f'{database_path}-wal').exists() else 0,
        'shmBytes': Path(f'{database_path}-shm').stat().st_size if Path(f'{database_path}-shm').exists() else 0,
        'pageSize': page_size,
        'pageCount': page_count,
        'freelistCount': freelist_count,
        'allocatedBytes': allocated_bytes,
        'reclaimableBytes': reclaimable_bytes,
        'estimatedLiveBytes': estimated_live_bytes,
        'reclaimableRatioPpm': ratio_ppm,
        'autoVacuum': int(_single(connection, 'PRAGMA auto_vacuum') or 0),
        'journalMode': str(_single(connection, 'PRAGMA journal_mode') or ''),
        'schemaVersion': int(_single(connection, 'PRAGMA schema_version') or 0),
        'userVersion': int(_single(connection, 'PRAGMA user_version') or 0),
        'applicationId': int(_single(connection, 'PRAGMA application_id') or 0),
    }


def _canonical_value(value: Any) -> Any:
    if value is None:
        return ['null']
    if isinstance(value, bytes):
        return ['blob', len(value), hashlib.sha256(value).hexdigest()]
    if isinstance(value, int):
        return ['integer', str(value)]
    if isinstance(value, float):
        return ['real', value.hex()]
    return ['text', str(value)]


def _row_hash(row: sqlite3.Row) -> str:
    payload = [_canonical_value(row[index]) for index in range(len(row))]
    encoded = json.dumps(payload, ensure_ascii=False, separators=(',', ':')).encode('utf-8')
    return hashlib.sha256(encoded).hexdigest()


def _schema_rows(connection: sqlite3.Connection) -> list[sqlite3.Row]:
    return connection.execute(
        "SELECT type, name, tbl_name, COALESCE(sql, '') AS sql "
        "FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%' "
        "ORDER BY type, name"
    ).fetchall()


def _table_names(connection: sqlite3.Connection) -> list[str]:
    return [
        str(row[0])
        for row in connection.execute(
            "SELECT name FROM sqlite_schema WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
        ).fetchall()
    ]


def _assert_declared_primary_keys(connection: sqlite3.Connection) -> None:
    missing: list[str] = []
    for table in _table_names(connection):
        table_sql_row = connection.execute(
            "SELECT COALESCE(sql, '') FROM sqlite_schema WHERE type = 'table' AND name = ?",
            (table,),
        ).fetchone()
        table_sql = str(table_sql_row[0] if table_sql_row else '')
        if table_sql.lstrip().upper().startswith('CREATE VIRTUAL TABLE'):
            continue
        columns = connection.execute(f'PRAGMA table_info({_quote_identifier(table)})').fetchall()
        if not any(int(column['pk'] or 0) > 0 for column in columns):
            missing.append(table)
    if missing:
        raise RuntimeError('ECONOMY_DATABASE_IMPLICIT_ROWID_TABLES=' + ','.join(missing))


def _database_fingerprint(connection: sqlite3.Connection) -> dict[str, Any]:
    schema_payload = [list(row) for row in _schema_rows(connection)]
    schema_hash = hashlib.sha256(
        json.dumps(schema_payload, ensure_ascii=False, separators=(',', ':')).encode('utf-8')
    ).hexdigest()

    tables: dict[str, Any] = {}
    for table in _table_names(connection):
        rows = connection.execute(f'SELECT * FROM {_quote_identifier(table)}').fetchall()
        row_hashes = sorted(_row_hash(row) for row in rows)
        digest = hashlib.sha256()
        for value in row_hashes:
            digest.update(value.encode('ascii'))
            digest.update(b'\n')
        tables[table] = {'rowCount': len(rows), 'contentHash': digest.hexdigest()}

    world: dict[str, Any] = {'present': False}
    if 'economy_world' in tables:
        row = connection.execute(
            'SELECT revision, state_json, updated_at FROM economy_world WHERE id = 1'
        ).fetchone()
        if row:
            state_json = str(row['state_json'])
            world = {
                'present': True,
                'revision': int(row['revision']),
                'updatedAt': int(row['updated_at']),
                'stateJsonBytes': len(state_json.encode('utf-8')),
                'stateJsonSha256': hashlib.sha256(state_json.encode('utf-8')).hexdigest(),
            }

    return {
        'schemaSha256': schema_hash,
        'tables': tables,
        'world': world,
        'userVersion': int(_single(connection, 'PRAGMA user_version') or 0),
        'applicationId': int(_single(connection, 'PRAGMA application_id') or 0),
    }


def _checkpoint(connection: sqlite3.Connection) -> dict[str, int]:
    row = connection.execute('PRAGMA wal_checkpoint(TRUNCATE)').fetchone()
    if row is None:
        return {'busy': 0, 'logFrames': 0, 'checkpointedFrames': 0}
    busy, log_frames, checkpointed_frames = (int(row[index]) for index in range(3))
    if busy != 0:
        raise RuntimeError(
            'ECONOMY_DATABASE_WAL_CHECKPOINT_BUSY '
            f'busy={busy} log_frames={log_frames} checkpointed_frames={checkpointed_frames}'
        )
    return {'busy': busy, 'logFrames': log_frames, 'checkpointedFrames': checkpointed_frames}


def _fsync_directory(path: Path) -> None:
    descriptor = os.open(path, os.O_RDONLY)
    try:
        os.fsync(descriptor)
    finally:
        os.close(descriptor)


def _preserve_stat(path: Path, original_stat: os.stat_result) -> None:
    os.chown(path, original_stat.st_uid, original_stat.st_gid)
    os.chmod(path, stat.S_IMODE(original_stat.st_mode))


def _ensure_space(database_path: Path, estimated_live_bytes: int) -> dict[str, int]:
    available = shutil.disk_usage(database_path.parent).free
    required = max(MINIMUM_HEADROOM_BYTES, estimated_live_bytes * 3 + 64 * 1024 * 1024)
    if available < required:
        raise RuntimeError(
            'ECONOMY_DATABASE_MAINTENANCE_INSUFFICIENT_DISK '
            f'available_bytes={available} required_bytes={required}'
        )
    return {'availableBytes': available, 'requiredBytes': required}


def _vacuum_into(connection: sqlite3.Connection, target_path: Path) -> None:
    if target_path.exists():
        raise RuntimeError(f'ECONOMY_DATABASE_STAGE_ALREADY_EXISTS: {target_path}')
    connection.execute(f'VACUUM INTO {_quote_sql_string(str(target_path))}')


def _configure_incremental(database_path: Path) -> None:
    with _connect(database_path) as connection:
        connection.execute('PRAGMA journal_mode = DELETE')
        connection.execute('PRAGMA auto_vacuum = INCREMENTAL')
        connection.execute('VACUUM')
        connection.execute('PRAGMA journal_mode = DELETE')
        if int(_single(connection, 'PRAGMA auto_vacuum') or 0) != INCREMENTAL_MODE:
            raise RuntimeError('ECONOMY_DATABASE_INCREMENTAL_MODE_NOT_APPLIED')
        _check_database(connection)


def _validate_fingerprint(expected: dict[str, Any], actual: dict[str, Any]) -> None:
    if expected != actual:
        expected_tables = expected.get('tables', {})
        actual_tables = actual.get('tables', {})
        mismatched_tables = sorted(
            table for table in set(expected_tables) | set(actual_tables)
            if expected_tables.get(table) != actual_tables.get(table)
        )
        raise RuntimeError(
            'ECONOMY_DATABASE_FINGERPRINT_MISMATCH '
            f'schema_match={expected.get("schemaSha256") == actual.get("schemaSha256")} '
            f'world_match={expected.get("world") == actual.get("world")} '
            f'tables={",".join(mismatched_tables[:20])}'
        )


def _remove_if_exists(path: Path) -> None:
    try:
        path.unlink()
    except FileNotFoundError:
        pass


def migrate_incremental(args: argparse.Namespace) -> dict[str, Any]:
    database_path = Path(args.database).resolve()
    backup_directory = Path(args.backup_directory).resolve()
    lock_path = Path(args.lock_path).resolve()
    if not database_path.is_file():
        raise FileNotFoundError(f'ECONOMY_DATABASE_NOT_FOUND: {database_path}')

    timestamp = _utc_timestamp()
    stage_path = database_path.parent / f'.economy-incremental-stage-{timestamp}.sqlite'
    backup_path = backup_directory / f'economy-pre-incremental-{timestamp}.sqlite'
    failed_path = database_path.parent / f'economy-incremental-failed-{timestamp}.sqlite'
    original_stat = database_path.stat()
    service_was_active = False
    service_stopped = False
    swapped = False
    old_sidecars: dict[Path, Path] = {}

    with _exclusive_lock(lock_path):
        if not args.offline:
            service_was_active = _service_is_active(args.service_name)
            if not service_was_active:
                raise RuntimeError('ECONOMY_DATABASE_SERVICE_NOT_ACTIVE_BEFORE_MIGRATION')
            _set_service(args.service_name, 'stop')
            service_stopped = True
            if _service_is_active(args.service_name):
                raise RuntimeError('ECONOMY_DATABASE_SERVICE_DID_NOT_STOP')

        try:
            with _connect(database_path) as source:
                checkpoint = _checkpoint(source)
                checks_before = _check_database(source)
                _assert_declared_primary_keys(source)
                before_metrics = _database_metrics(source, database_path)
                if before_metrics['autoVacuum'] not in (NONE_MODE, INCREMENTAL_MODE):
                    raise RuntimeError(
                        f'ECONOMY_DATABASE_UNSUPPORTED_AUTO_VACUUM={before_metrics["autoVacuum"]}'
                    )
                before_fingerprint = _database_fingerprint(source)
                disk = _ensure_space(database_path, int(before_metrics['estimatedLiveBytes']))
                _vacuum_into(source, stage_path)

            _configure_incremental(stage_path)
            with _connect(stage_path, readonly=True) as stage:
                checks_stage = _check_database(stage)
                stage_metrics = _database_metrics(stage, stage_path)
                stage_fingerprint = _database_fingerprint(stage)
            _validate_fingerprint(before_fingerprint, stage_fingerprint)
            if stage_metrics['autoVacuum'] != INCREMENTAL_MODE:
                raise RuntimeError('ECONOMY_DATABASE_STAGE_AUTO_VACUUM_NOT_INCREMENTAL')
            if stage_metrics['reclaimableRatioPpm'] > 50_000:
                raise RuntimeError(
                    'ECONOMY_DATABASE_STAGE_FREELIST_TOO_LARGE '
                    f'ratio_ppm={stage_metrics["reclaimableRatioPpm"]}'
                )

            backup_directory.mkdir(mode=0o700, parents=True, exist_ok=True)
            os.chown(backup_directory, original_stat.st_uid, original_stat.st_gid)
            os.chmod(backup_directory, 0o700)

            for suffix in ('-wal', '-shm'):
                source_sidecar = Path(f'{database_path}{suffix}')
                backup_sidecar = Path(f'{backup_path}{suffix}')
                if source_sidecar.exists():
                    os.replace(source_sidecar, backup_sidecar)
                    old_sidecars[source_sidecar] = backup_sidecar

            os.replace(database_path, backup_path)
            swapped = True
            os.replace(stage_path, database_path)
            _preserve_stat(database_path, original_stat)
            _preserve_stat(backup_path, original_stat)
            _fsync_directory(database_path.parent)

            with _connect(database_path, readonly=True) as current:
                checks_prestart = _check_database(current)
                prestart_metrics = _database_metrics(current, database_path)
                prestart_fingerprint = _database_fingerprint(current)
            if prestart_metrics['autoVacuum'] != INCREMENTAL_MODE:
                raise RuntimeError('ECONOMY_DATABASE_PRODUCTION_AUTO_VACUUM_NOT_INCREMENTAL')
            _validate_fingerprint(before_fingerprint, prestart_fingerprint)

            if not args.offline:
                _set_service(args.service_name, 'start')
                service_stopped = False
                _wait_for_health(args.health_url, args.health_timeout_seconds)

            with _connect(database_path, readonly=True) as current:
                checks_after = _check_database(current)
                after_metrics = _database_metrics(current, database_path)
                after_fingerprint = _database_fingerprint(current)
            if after_metrics['autoVacuum'] != INCREMENTAL_MODE:
                raise RuntimeError('ECONOMY_DATABASE_PRODUCTION_AUTO_VACUUM_NOT_INCREMENTAL')
            baseline_revision = int(before_fingerprint.get('world', {}).get('revision') or 0)
            current_revision = int(after_fingerprint.get('world', {}).get('revision') or 0)
            if current_revision < baseline_revision:
                raise RuntimeError(
                    'ECONOMY_DATABASE_WORLD_REVISION_REGRESSED '
                    f'before={baseline_revision} after={current_revision}'
                )

            return {
                'schemaVersion': REPORT_SCHEMA_VERSION,
                'operation': 'migrate-incremental',
                'status': 'success',
                'timestamp': timestamp,
                'database': str(database_path),
                'backup': str(backup_path),
                'checkpoint': checkpoint,
                'disk': disk,
                'checksBefore': checks_before,
                'checksStage': checks_stage,
                'checksPrestart': checks_prestart,
                'checksAfter': checks_after,
                'before': before_metrics,
                'prestart': prestart_metrics,
                'after': after_metrics,
                'world': after_fingerprint.get('world', {}),
            }
        except Exception:
            _remove_if_exists(stage_path)
            if swapped:
                if not args.offline and _service_is_active(args.service_name):
                    _set_service(args.service_name, 'stop')
                if database_path.exists():
                    os.replace(database_path, failed_path)
                for suffix in ('-wal', '-shm'):
                    current_sidecar = Path(f'{database_path}{suffix}')
                    failed_sidecar = Path(f'{failed_path}{suffix}')
                    if current_sidecar.exists():
                        os.replace(current_sidecar, failed_sidecar)
                if backup_path.exists():
                    os.replace(backup_path, database_path)
                    _preserve_stat(database_path, original_stat)
                for source_sidecar, backup_sidecar in old_sidecars.items():
                    if backup_sidecar.exists():
                        os.replace(backup_sidecar, source_sidecar)
                _fsync_directory(database_path.parent)
            if not args.offline and service_was_active:
                _set_service(args.service_name, 'start')
                service_stopped = False
                _wait_for_health(args.health_url, args.health_timeout_seconds)
            raise
        finally:
            if not args.offline and service_stopped and service_was_active:
                _set_service(args.service_name, 'start')
                _wait_for_health(args.health_url, args.health_timeout_seconds)


def maintain_incremental(args: argparse.Namespace) -> dict[str, Any]:
    database_path = Path(args.database).resolve()
    lock_path = Path(args.lock_path).resolve()
    if not database_path.is_file():
        raise FileNotFoundError(f'ECONOMY_DATABASE_NOT_FOUND: {database_path}')

    with _exclusive_lock(lock_path):
        with _connect(database_path, readonly=True) as readonly:
            before = _database_metrics(readonly, database_path)
            _check_database(readonly)
        if before['autoVacuum'] != INCREMENTAL_MODE:
            raise RuntimeError(f'ECONOMY_DATABASE_AUTO_VACUUM_NOT_INCREMENTAL={before["autoVacuum"]}')
        threshold_met = (
            before['reclaimableBytes'] >= args.minimum_reclaimable_bytes
            and before['reclaimableRatioPpm'] >= args.minimum_reclaimable_ratio_ppm
        )
        if not threshold_met and not args.force:
            return {
                'schemaVersion': REPORT_SCHEMA_VERSION,
                'operation': 'maintain-incremental',
                'status': 'skipped',
                'reason': 'below-threshold',
                'before': before,
                'after': before,
                'batches': [],
            }

        service_was_active = False
        service_stopped = False
        if not args.offline:
            service_was_active = _service_is_active(args.service_name)
            if not service_was_active:
                raise RuntimeError('ECONOMY_DATABASE_SERVICE_NOT_ACTIVE_BEFORE_MAINTENANCE')
            _set_service(args.service_name, 'stop')
            service_stopped = True

        batches: list[dict[str, int]] = []
        try:
            with _connect(database_path) as connection:
                checkpoint_before = _checkpoint(connection)
                for index in range(args.max_batches):
                    free_before = int(_single(connection, 'PRAGMA freelist_count') or 0)
                    if free_before <= 0:
                        break
                    connection.execute(f'PRAGMA incremental_vacuum({args.pages_per_batch})').fetchall()
                    connection.commit()
                    free_after = int(_single(connection, 'PRAGMA freelist_count') or 0)
                    batches.append({
                        'batch': index + 1,
                        'freelistBefore': free_before,
                        'freelistAfter': free_after,
                        'pagesReclaimed': max(0, free_before - free_after),
                    })
                    if free_after >= free_before:
                        break
                checkpoint_after = _checkpoint(connection)
                checks = _check_database(connection)

            if not args.offline:
                _set_service(args.service_name, 'start')
                service_stopped = False
                _wait_for_health(args.health_url, args.health_timeout_seconds)

            with _connect(database_path, readonly=True) as readonly:
                after = _database_metrics(readonly, database_path)
                _check_database(readonly)
            return {
                'schemaVersion': REPORT_SCHEMA_VERSION,
                'operation': 'maintain-incremental',
                'status': 'success',
                'before': before,
                'after': after,
                'batches': batches,
                'checkpointBefore': checkpoint_before,
                'checkpointAfter': checkpoint_after,
                'checks': checks,
            }
        finally:
            if not args.offline and service_stopped and service_was_active:
                _set_service(args.service_name, 'start')
                _wait_for_health(args.health_url, args.health_timeout_seconds)


def _format_bytes(value: Any) -> str:
    amount = float(value or 0)
    units = ['B', 'KiB', 'MiB', 'GiB', 'TiB']
    for unit in units:
        if abs(amount) < 1024 or unit == units[-1]:
            return f'{amount:.2f} {unit}'
        amount /= 1024
    return f'{amount:.2f} TiB'


def render_summary(args: argparse.Namespace) -> dict[str, Any]:
    report = json.loads(Path(args.report).read_text(encoding='utf-8'))
    operation = report.get('operation', 'database-maintenance')
    status = report.get('status', 'unknown')
    lines = [f'# Economy 生产数据库维护', '', f'- 操作：`{operation}`', f'- 状态：`{status}`']
    if 'before' in report:
        before = report['before']
        lines.extend([
            f'- 维护前文件：{_format_bytes(before.get("fileBytes"))}',
            f'- 维护前可回收：{_format_bytes(before.get("reclaimableBytes"))}',
            f'- 维护前 auto_vacuum：`{before.get("autoVacuum")}`',
        ])
    if 'after' in report:
        after = report['after']
        lines.extend([
            f'- 维护后文件：{_format_bytes(after.get("fileBytes"))}',
            f'- 维护后可回收：{_format_bytes(after.get("reclaimableBytes"))}',
            f'- 维护后 auto_vacuum：`{after.get("autoVacuum")}`',
        ])
    if report.get('backup'):
        lines.append(f'- 回滚备份：`{report["backup"]}`')
    if report.get('batches') is not None:
        reclaimed = sum(int(batch.get('pagesReclaimed', 0)) for batch in report.get('batches', []))
        lines.append(f'- 回收批次：{len(report.get("batches", []))}，回收页数：{reclaimed}')
    Path(args.output).write_text('\n'.join(lines) + '\n', encoding='utf-8')
    return report


def _add_common_service_arguments(parser: argparse.ArgumentParser) -> None:
    parser.add_argument('--database', default=str(DEFAULT_DATABASE))
    parser.add_argument('--service-name', default=SERVICE_NAME)
    parser.add_argument('--health-url', default=DEFAULT_HEALTH_URL)
    parser.add_argument('--health-timeout-seconds', type=int, default=45)
    parser.add_argument('--lock-path', default=str(DEFAULT_LOCK_PATH))
    parser.add_argument('--offline', action='store_true')


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description='Economy production SQLite maintenance')
    subparsers = parser.add_subparsers(dest='command', required=True)

    migrate = subparsers.add_parser('migrate-incremental')
    _add_common_service_arguments(migrate)
    migrate.add_argument('--backup-directory', default=str(DEFAULT_BACKUP_DIRECTORY))
    migrate.set_defaults(handler=migrate_incremental)

    maintain = subparsers.add_parser('maintain-incremental')
    _add_common_service_arguments(maintain)
    maintain.add_argument('--minimum-reclaimable-bytes', type=int, default=64 * 1024 * 1024)
    maintain.add_argument('--minimum-reclaimable-ratio-ppm', type=int, default=250_000)
    maintain.add_argument('--pages-per-batch', type=int, default=1024)
    maintain.add_argument('--max-batches', type=int, default=4)
    maintain.add_argument('--force', action='store_true')
    maintain.set_defaults(handler=maintain_incremental)

    summary = subparsers.add_parser('render-summary')
    summary.add_argument('report')
    summary.add_argument('output')
    summary.set_defaults(handler=render_summary)

    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    report = args.handler(args)
    if args.command != 'render-summary':
        print(json.dumps(report, ensure_ascii=False, sort_keys=True))
    return 0


if __name__ == '__main__':
    try:
        raise SystemExit(main())
    except Exception as error:  # noqa: BLE001 - workflow needs a single explicit failure marker
        print(f'ECONOMY_DATABASE_MAINTENANCE_FAILED: {error}', file=sys.stderr)
        raise SystemExit(1)
