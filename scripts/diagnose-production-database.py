#!/usr/bin/env python3
from __future__ import annotations

import argparse
import datetime as dt
import json
import sqlite3
import sys
from pathlib import Path
from typing import Any

REPORT_SCHEMA_VERSION = 1
DEFAULT_TOP_OBJECTS = 20
READ_ONLY_PRAGMAS = frozenset({
    'application_id',
    'auto_vacuum',
    'data_version',
    'freelist_count',
    'journal_mode',
    'page_count',
    'page_size',
    'query_only',
    'quick_check',
    'schema_version',
    'user_version',
})
DENIED_AUTHORIZER_ACTIONS = frozenset(
    action
    for action in (
        getattr(sqlite3, 'SQLITE_ALTER_TABLE', None),
        getattr(sqlite3, 'SQLITE_ANALYZE', None),
        getattr(sqlite3, 'SQLITE_ATTACH', None),
        getattr(sqlite3, 'SQLITE_CREATE_INDEX', None),
        getattr(sqlite3, 'SQLITE_CREATE_TABLE', None),
        getattr(sqlite3, 'SQLITE_CREATE_TEMP_INDEX', None),
        getattr(sqlite3, 'SQLITE_CREATE_TEMP_TABLE', None),
        getattr(sqlite3, 'SQLITE_CREATE_TEMP_TRIGGER', None),
        getattr(sqlite3, 'SQLITE_CREATE_TEMP_VIEW', None),
        getattr(sqlite3, 'SQLITE_CREATE_TRIGGER', None),
        getattr(sqlite3, 'SQLITE_CREATE_VIEW', None),
        getattr(sqlite3, 'SQLITE_DELETE', None),
        getattr(sqlite3, 'SQLITE_DETACH', None),
        getattr(sqlite3, 'SQLITE_DROP_INDEX', None),
        getattr(sqlite3, 'SQLITE_DROP_TABLE', None),
        getattr(sqlite3, 'SQLITE_DROP_TEMP_INDEX', None),
        getattr(sqlite3, 'SQLITE_DROP_TEMP_TABLE', None),
        getattr(sqlite3, 'SQLITE_DROP_TEMP_TRIGGER', None),
        getattr(sqlite3, 'SQLITE_DROP_TEMP_VIEW', None),
        getattr(sqlite3, 'SQLITE_DROP_TRIGGER', None),
        getattr(sqlite3, 'SQLITE_DROP_VIEW', None),
        getattr(sqlite3, 'SQLITE_INSERT', None),
        getattr(sqlite3, 'SQLITE_REINDEX', None),
        getattr(sqlite3, 'SQLITE_SAVEPOINT', None),
        getattr(sqlite3, 'SQLITE_TRANSACTION', None),
        getattr(sqlite3, 'SQLITE_UPDATE', None),
    )
    if action is not None
)


def _file_size(path: Path) -> int:
    try:
        return path.stat().st_size
    except FileNotFoundError:
        return 0


def _single_value(connection: sqlite3.Connection, sql: str) -> Any:
    row = connection.execute(sql).fetchone()
    return None if row is None else row[0]


def _authorizer(
    action: int,
    first: str | None,
    second: str | None,
    _database_name: str | None,
    _trigger_name: str | None,
) -> int:
    if action in DENIED_AUTHORIZER_ACTIONS:
        return sqlite3.SQLITE_DENY
    if action == sqlite3.SQLITE_PRAGMA:
        pragma = str(first or '').lower()
        argument = None if second is None else str(second).upper()
        if pragma not in READ_ONLY_PRAGMAS:
            return sqlite3.SQLITE_DENY
        if pragma == 'query_only':
            return sqlite3.SQLITE_OK if argument in (None, '1', 'ON', 'TRUE') else sqlite3.SQLITE_DENY
        if pragma == 'quick_check':
            return sqlite3.SQLITE_OK if argument in (None, '1') else sqlite3.SQLITE_DENY
        return sqlite3.SQLITE_OK if argument is None else sqlite3.SQLITE_DENY
    return sqlite3.SQLITE_OK


def _database_uri(database_path: Path) -> str:
    return f'file:{database_path.as_posix()}?mode=ro'


def _safe_object_name(value: Any) -> str:
    return str(value or '').replace('\r', ' ').replace('\n', ' ')[:160]


def diagnose(database_path: Path, top_objects: int) -> dict[str, Any]:
    database_path = database_path.resolve()
    if not database_path.is_file():
        raise FileNotFoundError(f'生产数据库不存在: {database_path}')

    connection = sqlite3.connect(
        _database_uri(database_path),
        uri=True,
        timeout=60,
    )
    connection.row_factory = sqlite3.Row
    connection.set_authorizer(_authorizer)

    try:
        connection.execute('PRAGMA query_only = ON')
        query_only = int(_single_value(connection, 'PRAGMA query_only') or 0)
        if query_only != 1:
            raise RuntimeError('SQLite query_only 未启用')

        page_size = int(_single_value(connection, 'PRAGMA page_size') or 0)
        page_count = int(_single_value(connection, 'PRAGMA page_count') or 0)
        freelist_count = int(_single_value(connection, 'PRAGMA freelist_count') or 0)
        allocated_bytes = page_size * page_count
        reclaimable_bytes = page_size * freelist_count
        estimated_live_bytes = max(0, allocated_bytes - reclaimable_bytes)
        reclaimable_ratio_ppm = (
            round(reclaimable_bytes * 1_000_000 / allocated_bytes)
            if allocated_bytes > 0
            else 0
        )

        quick_check_row = connection.execute('PRAGMA quick_check(1)').fetchone()
        quick_check = str(quick_check_row[0] if quick_check_row else 'missing')

        table_count = int(connection.execute(
            "SELECT COUNT(*) FROM sqlite_schema WHERE type = 'table' AND name NOT LIKE 'sqlite_%'"
        ).fetchone()[0])
        index_count = int(connection.execute(
            "SELECT COUNT(*) FROM sqlite_schema WHERE type = 'index' AND name NOT LIKE 'sqlite_%'"
        ).fetchone()[0])

        world: dict[str, Any] = {'present': False}
        world_table = connection.execute(
            "SELECT 1 FROM sqlite_schema WHERE type = 'table' AND name = 'economy_world'"
        ).fetchone()
        if world_table:
            world_row = connection.execute(
                'SELECT revision, length(state_json) AS state_json_bytes, updated_at '
                'FROM economy_world WHERE id = 1'
            ).fetchone()
            if world_row:
                world = {
                    'present': True,
                    'revision': int(world_row['revision']),
                    'stateJsonBytes': int(world_row['state_json_bytes'] or 0),
                    'updatedAt': int(world_row['updated_at']),
                }

        largest_objects: list[dict[str, Any]] = []
        dbstat_available = True
        try:
            rows = connection.execute(
                'SELECT name, SUM(pgsize) AS bytes, SUM(unused) AS unused_bytes, COUNT(*) AS pages '
                'FROM dbstat GROUP BY name ORDER BY bytes DESC, name LIMIT ?',
                (top_objects,),
            ).fetchall()
            largest_objects = [
                {
                    'name': _safe_object_name(row['name']),
                    'bytes': int(row['bytes'] or 0),
                    'unusedBytes': int(row['unused_bytes'] or 0),
                    'pages': int(row['pages'] or 0),
                }
                for row in rows
            ]
        except sqlite3.DatabaseError as error:
            dbstat_available = False
            largest_objects = [{
                'name': 'dbstat unavailable',
                'bytes': 0,
                'unusedBytes': 0,
                'pages': 0,
                'detail': _safe_object_name(error),
            }]

        report = {
            'schemaVersion': REPORT_SCHEMA_VERSION,
            'generatedAt': dt.datetime.now(dt.timezone.utc).isoformat(),
            'database': {
                'path': str(database_path),
                'fileBytes': _file_size(database_path),
                'walBytes': _file_size(Path(f'{database_path}-wal')),
                'shmBytes': _file_size(Path(f'{database_path}-shm')),
            },
            'sqlite': {
                'libraryVersion': sqlite3.sqlite_version,
                'queryOnly': query_only,
                'journalMode': str(_single_value(connection, 'PRAGMA journal_mode') or ''),
                'autoVacuum': int(_single_value(connection, 'PRAGMA auto_vacuum') or 0),
                'pageSize': page_size,
                'pageCount': page_count,
                'freelistCount': freelist_count,
                'allocatedBytes': allocated_bytes,
                'reclaimableBytes': reclaimable_bytes,
                'estimatedLiveBytes': estimated_live_bytes,
                'reclaimableRatioPpm': reclaimable_ratio_ppm,
                'schemaVersion': int(_single_value(connection, 'PRAGMA schema_version') or 0),
                'userVersion': int(_single_value(connection, 'PRAGMA user_version') or 0),
                'applicationId': int(_single_value(connection, 'PRAGMA application_id') or 0),
                'dataVersion': int(_single_value(connection, 'PRAGMA data_version') or 0),
            },
            'schema': {
                'tableCount': table_count,
                'indexCount': index_count,
            },
            'world': world,
            'checks': {
                'quickCheck': quick_check,
                'dbstatAvailable': dbstat_available,
            },
            'largestObjects': largest_objects,
        }
        return report
    finally:
        connection.close()


def _format_bytes(value: Any) -> str:
    number = max(0, int(value or 0))
    units = ('B', 'KiB', 'MiB', 'GiB', 'TiB')
    amount = float(number)
    unit = units[0]
    for candidate in units:
        unit = candidate
        if amount < 1024 or candidate == units[-1]:
            break
        amount /= 1024
    return f'{amount:.2f} {unit}'


def _escape_cell(value: Any) -> str:
    return str(value).replace('|', '\\|').replace('\r', ' ').replace('\n', ' ')


def render_summary(report_path: Path, summary_path: Path) -> None:
    report = json.loads(report_path.read_text(encoding='utf-8'))
    database = report['database']
    sqlite = report['sqlite']
    checks = report['checks']
    world = report['world']
    ratio_percent = int(sqlite['reclaimableRatioPpm']) / 10_000

    lines = [
        '# Economy 生产数据库只读诊断',
        '',
        '| 指标 | 数值 |',
        '|---|---:|',
        f"| 主数据库文件 | {_format_bytes(database['fileBytes'])} |",
        f"| WAL 文件 | {_format_bytes(database['walBytes'])} |",
        f"| SHM 文件 | {_format_bytes(database['shmBytes'])} |",
        f"| SQLite 已分配页 | {_format_bytes(sqlite['allocatedBytes'])} |",
        f"| 预计有效页 | {_format_bytes(sqlite['estimatedLiveBytes'])} |",
        f"| 可复用空页 | {_format_bytes(sqlite['reclaimableBytes'])} ({ratio_percent:.2f}%) |",
        f"| page size / page count | {sqlite['pageSize']} / {sqlite['pageCount']} |",
        f"| freelist count | {sqlite['freelistCount']} |",
        f"| journal / auto vacuum | {_escape_cell(sqlite['journalMode'])} / {sqlite['autoVacuum']} |",
        f"| query_only | {sqlite['queryOnly']} |",
        f"| quick_check | {_escape_cell(checks['quickCheck'])} |",
        f"| dbstat | {'可用' if checks['dbstatAvailable'] else '不可用'} |",
    ]
    if world.get('present'):
        lines.extend([
            f"| 世界修订号 | {world['revision']} |",
            f"| state_json 长度 | {_format_bytes(world['stateJsonBytes'])} |",
            f"| 世界更新时间戳 | {world['updatedAt']} |",
        ])

    lines.extend([
        '',
        '## 最大 SQLite 对象',
        '',
        '| 对象 | 占用 | 页内未使用 | 页数 |',
        '|---|---:|---:|---:|',
    ])
    for item in report.get('largestObjects', []):
        lines.append(
            f"| `{_escape_cell(item.get('name', ''))}` | {_format_bytes(item.get('bytes'))} "
            f"| {_format_bytes(item.get('unusedBytes'))} | {int(item.get('pages') or 0)} |"
        )

    if ratio_percent >= 25:
        lines.extend([
            '',
            f'> ⚠️ 当前可复用空页占比为 {ratio_percent:.2f}%，建议安排离线 `VACUUM INTO` 缩容。',
        ])

    summary_path.parent.mkdir(parents=True, exist_ok=True)
    with summary_path.open('a', encoding='utf-8') as handle:
        handle.write('\n'.join(lines) + '\n')


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description='Economy production SQLite read-only diagnostics')
    subparsers = parser.add_subparsers(dest='command', required=True)

    diagnose_parser = subparsers.add_parser('diagnose')
    diagnose_parser.add_argument('database', type=Path)
    diagnose_parser.add_argument(
        '--top-objects',
        type=int,
        default=DEFAULT_TOP_OBJECTS,
        choices=range(1, 101),
        metavar='1..100',
    )

    render_parser = subparsers.add_parser('render-summary')
    render_parser.add_argument('report', type=Path)
    render_parser.add_argument('summary', type=Path)
    return parser


def main() -> int:
    args = build_parser().parse_args()
    if args.command == 'diagnose':
        report = diagnose(args.database, args.top_objects)
        print(json.dumps(report, ensure_ascii=False, sort_keys=True))
        return 0 if report['checks']['quickCheck'] == 'ok' else 2
    if args.command == 'render-summary':
        render_summary(args.report, args.summary)
        return 0
    raise AssertionError(f'unknown command: {args.command}')


if __name__ == '__main__':
    try:
        raise SystemExit(main())
    except Exception as error:
        print(f'ECONOMY_DATABASE_DIAGNOSTIC_FAILED: {error}', file=sys.stderr)
        raise SystemExit(1)
