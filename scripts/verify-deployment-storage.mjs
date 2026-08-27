import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { DatabaseSync } from 'node:sqlite';
import { pythonFailureOutput, spawnPythonSync } from './python-runtime.mjs';

const root = process.cwd();
const failures = [];
const read = (path) => readFileSync(resolve(root, path), 'utf8');

const files = {
  workflow: '.github/workflows/deploy.yml',
  verification: 'scripts/verify-production-deployment.sh',
  backupTool: 'scripts/manage-production-backups.py',
  installer: 'scripts/install-economy-api.py',
  design: 'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md',
};

for (const path of Object.values(files)) {
  if (!existsSync(resolve(root, path))) failures.push(`缺少文件: ${path}`);
}

const requireText = (path, text) => {
  if (!read(path).includes(text)) failures.push(`${path} 缺少: ${text}`);
};
const forbidText = (path, text) => {
  if (read(path).includes(text)) failures.push(`${path} 不应包含: ${text}`);
};

if (failures.length === 0) {
  for (const text of [
    'manage-production-backups.py',
    'backup-world --target-storage-schema-version 2',
    'Verify production host before publishing entry',
    'scripts/verify-production-deployment.sh',
    'minimum_free_kb=$((1024 * 1024))',
    'ECONOMY_DEPLOY_INSUFFICIENT_DISK',
    'ECONOMY_DEPLOY_AVAILABLE_KB=',
    'dist/assets/ "$SERVER_USER@$ECONOMY_PRODUCTION_PUBLIC_IP:/var/www/game/economy/assets/"',
    '--exclude assets/',
    '--exclude index.html',
    '--exclude runtime/',
    'ECONOMY_NODE_RUNTIME_REUSE',
    'ECONOMY_NODE_RUNTIME_UPLOAD_SKIPPED',
    'index.html.next',
  ]) requireText(files.workflow, text);

  for (const text of ['database-incremental', 'ECONOMY_DATABASE_INCREMENTAL_VERIFIED']) {
    requireText(files.verification, text);
  }

  const workflow = read(files.workflow);
  const deleteBeforeCount = (workflow.match(/run_rsync --delete-before/g) ?? []).length;
  if (deleteBeforeCount !== 2) {
    failures.push(`部署工作流必须只为 API 代码与按需更新的便携 Node 运行时保留 2 处 rsync --delete-before，当前为 ${deleteBeforeCount}`);
  }
  const legacyWebsiteDeleteBefore = String.raw`rsync -az --delete-before -e "ssh -i ~/.ssh/deploy_key -p $SERVER_PORT" \
            dist/ "$SERVER_USER@$ECONOMY_PRODUCTION_PUBLIC_IP:/var/www/game/economy/"`;
  if (workflow.includes(legacyWebsiteDeleteBefore)) {
    failures.push('网站同步不得使用 rsync --delete-before 删除仍被旧客户端引用的哈希资源');
  }

  for (const text of [
    'source.backup(destination)',
    "backup_dir.glob('economy-pre-*.sqlite')",
    'required_bytes = database.stat().st_size + MIN_BACKUP_HEADROOM_BYTES',
  ]) forbidText(files.workflow, text);

  for (const text of [
    'from contextlib import closing',
    'VACUUM INTO',
    'gzip.GzipFile(',
    'compresslevel=6',
    '_verify_gzip(',
    'PRAGMA quick_check(1)',
    'PRAGMA foreign_key_check',
    'ECONOMY_BACKUP_AUTO_VACUUM_MISMATCH',
    'MAX_BACKUP_FAMILIES = 5',
    'MIN_BACKUP_HEADROOM_BYTES = 512 * 1024 * 1024',
    "TIMESTAMP_PATTERN = re.compile(",
    "backup_directory.glob('economy-pre-*')",
    "with closing(sqlite3.connect(",
    '_storage_schema_version(',
    'target_storage_schema_version',
    "if hasattr(os, 'chown'):",
    "if os.name == 'nt':",
  ]) requireText(files.backupTool, text);

  for (const text of [
    'VACUUM INTO',
    'gzip.GzipFile(',
    'economy-pre-contract-audit-{timestamp}.sqlite.gz',
    'verify_gzip(',
  ]) requireText(files.installer, text);
  forbidText(files.installer, 'source.backup(destination)');

  for (const text of [
    '紧凑 gzip SQLite 快照',
    '`VACUUM INTO` 消除 freelist',
    '解压后的 `auto_vacuum` 必须保持 `INCREMENTAL`',
    '最多保留最近 5 个迁移族',
    '至少为预计有效数据两倍再加 512 MiB',
    '删除临时 SQLite 前显式关闭全部连接',
    'Windows 本地行为验证与 Linux 正式部署共用同一实现',
    '分段存储 V2 首次迁移前必须创建 `economy-pre-storage-v2`',
    'API 代码继续使用 `rsync --delete-before` 完整替换',
    '同步 `server/` 时必须排除 `runtime/`',
    '完全匹配时必须复用且不得重新下载或上传',
    '旧哈希资源至少保留 400 天',
  ]) requireText(files.design, text);
}

function digest(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

if (failures.length === 0) {
  const temporaryDirectory = mkdtempSync(join(tmpdir(), 'economy-compact-backup-'));
  try {
    const databasePath = join(temporaryDirectory, 'economy.sqlite');
    const backupDirectory = join(temporaryDirectory, 'backups');
    const restoredPath = join(temporaryDirectory, 'restored.sqlite');
    const database = new DatabaseSync(databasePath);
    database.exec(`
      PRAGMA auto_vacuum = INCREMENTAL;
      VACUUM;
      PRAGMA journal_mode = WAL;
      CREATE TABLE economy_world (
        id INTEGER PRIMARY KEY,
        revision INTEGER NOT NULL,
        state_json TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      ) STRICT;
      INSERT INTO economy_world (id, revision, state_json, updated_at)
      VALUES (1, 91, '{"version":17,"players":{}}', 1234567890);
      CREATE TABLE filler (
        id INTEGER PRIMARY KEY,
        payload BLOB NOT NULL
      ) STRICT;
    `);
    const insert = database.prepare('INSERT INTO filler (payload) VALUES (randomblob(4000))');
    for (let index = 0; index < 512; index += 1) insert.run();
    database.exec('DELETE FROM filler;');
    database.close();

    const sourceSizeBefore = statSync(databasePath).size;
    const sourceDigestBefore = digest(databasePath);
    const result = spawnPythonSync(
      [
        resolve(root, files.backupTool),
        'backup-world',
        '--database', databasePath,
        '--backup-directory', backupDirectory,
        '--target-world-version', '18',
      ],
      { encoding: 'utf8' },
    );
    if (result.status !== 0) {
      failures.push(`紧凑压缩备份执行失败: ${pythonFailureOutput(result)}`);
    } else {
      const report = JSON.parse(result.stdout);
      if (report.status !== 'created') failures.push(`备份状态异常: ${report.status}`);
      if (!report.path?.endsWith('.sqlite.gz')) failures.push(`备份扩展名异常: ${report.path}`);
      if (!existsSync(report.path)) failures.push('压缩备份文件不存在');
      if (existsSync(report.path.replace(/\.gz$/, ''))) failures.push('残留未压缩正式备份');
      if (!(report.backup.freelistCount <= 1)) failures.push('紧凑备份仍包含大量 freelist');
      if (report.backup.autoVacuum !== 2) failures.push('紧凑备份未保持 INCREMENTAL 模式');
      if (report.checks.quickCheck !== 'ok') failures.push('紧凑备份 quick_check 未通过');
      if (report.checks.foreignKeyViolations !== 0) failures.push('紧凑备份存在外键违规');
      if (!(report.compressedBytes < sourceSizeBefore)) failures.push('压缩备份未小于高水位源库');

      writeFileSync(restoredPath, gunzipSync(readFileSync(report.path)));
      const restored = new DatabaseSync(restoredPath, { readOnly: true });
      const mode = Number(restored.prepare('PRAGMA auto_vacuum').get().auto_vacuum);
      const quickCheck = String(restored.prepare('PRAGMA quick_check(1)').get().quick_check);
      const world = restored.prepare('SELECT revision, state_json FROM economy_world WHERE id = 1').get();
      restored.close();
      if (mode !== 2) failures.push(`恢复库 auto_vacuum=${mode}`);
      if (quickCheck !== 'ok') failures.push(`恢复库 quick_check=${quickCheck}`);
      if (Number(world.revision) !== 91) failures.push(`恢复库世界修订=${world.revision}`);
      if (String(world.state_json) !== '{"version":17,"players":{}}') {
        failures.push('恢复库世界 JSON 不一致');
      }
    }

    const storageBackupResult = spawnPythonSync(
      [
        resolve(root, files.backupTool),
        'backup-world',
        '--database', databasePath,
        '--backup-directory', backupDirectory,
        '--target-storage-schema-version', '2',
      ],
      { encoding: 'utf8' },
    );
    if (storageBackupResult.status !== 0) {
      failures.push(`存储 V2 迁移备份执行失败: ${pythonFailureOutput(storageBackupResult)}`);
    } else {
      const storageReport = JSON.parse(storageBackupResult.stdout);
      if (storageReport.status !== 'created') failures.push(`存储 V2 首次备份状态异常: ${storageReport.status}`);
      if (!String(storageReport.path || '').includes('economy-pre-storage-v2-')) failures.push('存储 V2 备份族命名异常');
      if (storageReport.storageSchemaVersion !== 0) failures.push(`迁移前存储 schema 应为 0，实际为 ${storageReport.storageSchemaVersion}`);
    }

    if (statSync(databasePath).size !== sourceSizeBefore || digest(databasePath) !== sourceDigestBefore) {
      failures.push('备份过程修改了源数据库主文件');
    }

    const migrated = new DatabaseSync(databasePath);
    migrated.exec(`
      CREATE TABLE IF NOT EXISTS economy_world_meta (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        revision INTEGER NOT NULL,
        world_version INTEGER NOT NULL,
        storage_schema_version INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      ) STRICT;
      INSERT OR REPLACE INTO economy_world_meta
        (id, revision, world_version, storage_schema_version, updated_at)
      VALUES (1, 92, 29, 2, 1234567891);
    `);
    migrated.close();

    const storageSkipResult = spawnPythonSync(
      [
        resolve(root, files.backupTool),
        'backup-world',
        '--database', databasePath,
        '--backup-directory', backupDirectory,
        '--target-storage-schema-version', '2',
      ],
      { encoding: 'utf8' },
    );
    if (storageSkipResult.status !== 0) {
      failures.push(`已迁移 V2 的备份检查失败: ${pythonFailureOutput(storageSkipResult)}`);
    } else {
      const storageSkipReport = JSON.parse(storageSkipResult.stdout);
      if (storageSkipReport.status !== 'skipped' || storageSkipReport.reason !== 'storage-schema-current') {
        failures.push(`已迁移 V2 应跳过重复备份，实际为 ${storageSkipReport.status}/${storageSkipReport.reason}`);
      }
    }
  } catch (error) {
    failures.push(`紧凑压缩备份行为验证异常: ${error.stack || error}`);
  } finally {
    rmSync(temporaryDirectory, { recursive: true, force: true });
  }
}

if (failures.length > 0) {
  console.error('部署紧凑压缩备份、保留策略与恢复验证失败：');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('部署 VACUUM INTO、gzip 压缩、恢复校验、保留策略与空间预检通过。');
