import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

function replaceOnce(path, before, after) {
  let source = readFileSync(path, 'utf8');
  if (source.includes(after)) return;
  if (!source.includes(before)) throw new Error(`${path}: marker not found`);
  source = source.replace(before, after);
  writeFileSync(path, source);
}

function insertBefore(path, marker, addition) {
  let source = readFileSync(path, 'utf8');
  if (source.includes(addition.trim())) return;
  if (!source.includes(marker)) throw new Error(`${path}: insertion marker not found`);
  source = source.replace(marker, `${addition.trimEnd()}\n\n${marker}`);
  writeFileSync(path, source);
}

insertBefore(
  'scripts/manage-production-backups.py',
  '\ndef _database_metrics(connection: sqlite3.Connection, database_path: Path) -> dict[str, int]:',
  `\ndef _storage_schema_version(connection: sqlite3.Connection) -> int:\n    try:\n        row = connection.execute(\n            'SELECT storage_schema_version FROM economy_world_meta WHERE id = 1'\n        ).fetchone()\n    except sqlite3.OperationalError as error:\n        if 'no such table' not in str(error).lower():\n            raise\n        row = None\n    return 0 if not row else int(row[0] or 0)\n`,
);

replaceOnce(
  'scripts/manage-production-backups.py',
  `        source_world = _world_info(source)\n        source_metrics = _database_metrics(source, database_path)\n        if source_world['version'] >= args.target_world_version:\n            return {\n                'status': 'skipped',\n                'reason': 'world-version-current',\n                'currentWorldVersion': source_world['version'],\n                'retentionBefore': retention_before,\n            }`,
  `        source_world = _world_info(source)\n        source_storage_schema_version = _storage_schema_version(source)\n        source_metrics = _database_metrics(source, database_path)\n        if args.target_storage_schema_version is not None:\n            target_kind = 'storage'\n            target_version = int(args.target_storage_schema_version)\n            backup_family = f'economy-pre-storage-v{target_version}'\n            if source_storage_schema_version >= target_version:\n                return {\n                    'status': 'skipped',\n                    'reason': 'storage-schema-current',\n                    'currentStorageSchemaVersion': source_storage_schema_version,\n                    'retentionBefore': retention_before,\n                }\n        else:\n            target_kind = 'world'\n            target_version = int(args.target_world_version)\n            backup_family = f'economy-pre-world-v{target_version}'\n            if source_world['version'] >= target_version:\n                return {\n                    'status': 'skipped',\n                    'reason': 'world-version-current',\n                    'currentWorldVersion': source_world['version'],\n                    'retentionBefore': retention_before,\n                }`,
);

replaceOnce(
  'scripts/manage-production-backups.py',
  "        family = f'economy-pre-world-v{args.target_world_version}'\n        compact_path = backup_directory / f'.{family}-{timestamp}.sqlite.tmp'",
  "        family = backup_family\n        compact_path = backup_directory / f'.{family}-{timestamp}.sqlite.tmp'",
);

replaceOnce(
  'scripts/manage-production-backups.py',
  `                backup_world = _world_info(compact)\n                compact_metrics = _database_metrics(compact, compact_path)`,
  `                backup_world = _world_info(compact)\n                backup_storage_schema_version = _storage_schema_version(compact)\n                compact_metrics = _database_metrics(compact, compact_path)`,
);

replaceOnce(
  'scripts/manage-production-backups.py',
  `            if backup_world['version'] >= args.target_world_version:\n                raise RuntimeError(\n                    'ECONOMY_BACKUP_NOT_PRE_MIGRATION '\n                    f'backup_world_version={backup_world["version"]}'\n                )`,
  `            if target_kind == 'storage':\n                if backup_storage_schema_version >= target_version:\n                    raise RuntimeError(\n                        'ECONOMY_BACKUP_NOT_PRE_STORAGE_MIGRATION '\n                        f'backup_storage_schema_version={backup_storage_schema_version}'\n                    )\n            elif backup_world['version'] >= target_version:\n                raise RuntimeError(\n                    'ECONOMY_BACKUP_NOT_PRE_MIGRATION '\n                    f'backup_world_version={backup_world["version"]}'\n                )`,
);

replaceOnce(
  'scripts/manage-production-backups.py',
  `        'world': backup_world,\n        'checks': checks,`,
  `        'world': backup_world,\n        'storageSchemaVersion': backup_storage_schema_version,\n        'targetKind': target_kind,\n        'targetVersion': target_version,\n        'checks': checks,`,
);

replaceOnce(
  'scripts/manage-production-backups.py',
  `    backup.add_argument('--target-world-version', type=int, required=True)\n    backup.add_argument('--maximum-families', type=int, default=MAX_BACKUP_FAMILIES)`,
  `    target = backup.add_mutually_exclusive_group(required=True)\n    target.add_argument('--target-world-version', type=int)\n    target.add_argument('--target-storage-schema-version', type=int)\n    backup.add_argument('--maximum-families', type=int, default=MAX_BACKUP_FAMILIES)`,
);

replaceOnce(
  '.github/workflows/deploy.yml',
  `      - name: Prune backups and create compact compressed database backup before world 26 migration\n        id: backup_database`,
  `      - name: Prune backups and create compact compressed database backup before storage V2 migration\n        id: backup_database`,
);
replaceOnce(
  '.github/workflows/deploy.yml',
  "'if [ \"$(id -u)\" -eq 0 ]; then exec python3 - backup-world --target-world-version 26; elif command -v sudo >/dev/null 2>&1 && sudo -n true; then exec sudo -n python3 - backup-world --target-world-version 26; else echo ECONOMY_DEPLOY_PRIVILEGES_UNAVAILABLE >&2; exit 1; fi'",
  "'if [ \"$(id -u)\" -eq 0 ]; then exec python3 - backup-world --target-storage-schema-version 2; elif command -v sudo >/dev/null 2>&1 && sudo -n true; then exec sudo -n python3 - backup-world --target-storage-schema-version 2; else echo ECONOMY_DEPLOY_PRIVILEGES_UNAVAILABLE >&2; exit 1; fi'",
);

replaceOnce(
  'scripts/verify-deployment-storage.mjs',
  "    'backup-world --target-world-version 26',",
  "    'backup-world --target-storage-schema-version 2',",
);
replaceOnce(
  'scripts/verify-deployment-storage.mjs',
  "    \"with closing(sqlite3.connect(\",\n    \"if hasattr(os, 'chown'):\",",
  "    \"with closing(sqlite3.connect(\",\n    '_storage_schema_version(',\n    'target_storage_schema_version',\n    \"if hasattr(os, 'chown'):\",",
);
replaceOnce(
  'scripts/verify-deployment-storage.mjs',
  "    'Windows 本地行为验证与 Linux 正式部署共用同一实现',\n    'API 和便携 Node 运行时继续使用 `rsync --delete-before` 完整替换',",
  "    'Windows 本地行为验证与 Linux 正式部署共用同一实现',\n    '分段存储 V2 首次迁移前必须创建 `economy-pre-storage-v2`',\n    'API 和便携 Node 运行时继续使用 `rsync --delete-before` 完整替换',",
);

insertBefore(
  'scripts/verify-deployment-storage.mjs',
  `    if (statSync(databasePath).size !== sourceSizeBefore || digest(databasePath) !== sourceDigestBefore) {`,
  `    const storageBackupResult = spawnSync(\n      'python3',\n      [\n        resolve(root, files.backupTool),\n        'backup-world',\n        '--database', databasePath,\n        '--backup-directory', backupDirectory,\n        '--target-storage-schema-version', '2',\n      ],\n      { encoding: 'utf8' },\n    );\n    if (storageBackupResult.status !== 0) {\n      failures.push(\`存储 V2 迁移备份执行失败: \${storageBackupResult.stderr || storageBackupResult.stdout}\`);\n    } else {\n      const storageReport = JSON.parse(storageBackupResult.stdout);\n      if (storageReport.status !== 'created') failures.push(\`存储 V2 首次备份状态异常: \${storageReport.status}\`);\n      if (!String(storageReport.path || '').includes('economy-pre-storage-v2-')) failures.push('存储 V2 备份族命名异常');\n      if (storageReport.storageSchemaVersion !== 0) failures.push(\`迁移前存储 schema 应为 0，实际为 \${storageReport.storageSchemaVersion}\`);\n    }\n\n    const migrated = new DatabaseSync(databasePath);\n    migrated.exec(\`\n      CREATE TABLE IF NOT EXISTS economy_world_meta (\n        id INTEGER PRIMARY KEY CHECK (id = 1),\n        revision INTEGER NOT NULL,\n        world_version INTEGER NOT NULL,\n        storage_schema_version INTEGER NOT NULL,\n        updated_at INTEGER NOT NULL\n      ) STRICT;\n      INSERT OR REPLACE INTO economy_world_meta\n        (id, revision, world_version, storage_schema_version, updated_at)\n      VALUES (1, 92, 29, 2, 1234567891);\n    \`);\n    migrated.close();\n\n    const storageSkipResult = spawnSync(\n      'python3',\n      [\n        resolve(root, files.backupTool),\n        'backup-world',\n        '--database', databasePath,\n        '--backup-directory', backupDirectory,\n        '--target-storage-schema-version', '2',\n      ],\n      { encoding: 'utf8' },\n    );\n    if (storageSkipResult.status !== 0) {\n      failures.push(\`已迁移 V2 的备份检查失败: \${storageSkipResult.stderr || storageSkipResult.stdout}\`);\n    } else {\n      const storageSkipReport = JSON.parse(storageSkipResult.stdout);\n      if (storageSkipReport.status !== 'skipped' || storageSkipReport.reason !== 'storage-schema-current') {\n        failures.push(\`已迁移 V2 应跳过重复备份，实际为 \${storageSkipReport.status}/\${storageSkipReport.reason}\`);\n      }\n    }\n`,
);

replaceOnce(
  'scripts/verify-asset-auctions.mjs',
  "  'backup-world --target-world-version 26',",
  "  'backup-world --target-storage-schema-version 2',",
);

replaceOnce(
  'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md',
  '- 正式 SQLite 迁移备份的目标世界版本必须与待部署代码的当前世界版本一致；当前为 26，禁止继续传入旧版本导致升级前快照被跳过。',
  '- 分段存储 V2 首次迁移前必须创建 `economy-pre-storage-v2` 紧凑 gzip SQLite 快照；部署备份以 `economy_world_meta.storage_schema_version` 判断是否已经完成 V2，schema 小于 2 或表不存在时必须备份，schema 已为 2 时跳过重复的 V2 迁移备份。该备份覆盖完整 SQLite 文件，回滚到 V1 二进制时必须同时恢复迁移前数据库快照，禁止仅回滚服务代码后读取已经停止更新的旧 `economy_world.state_json`。后续世界版本迁移若需要独立快照，必须再以对应世界版本建立新的迁移族，不得复用 V2 存储迁移族。',
);

for (const path of [
  'scripts/.apply-storage-v2-backup.mjs',
  '.github/workflows/_apply-storage-v2-backup.yml',
]) {
  if (existsSync(path)) rmSync(path);
}
