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
import { spawnSync } from 'node:child_process';
import { gunzipSync } from 'node:zlib';
import { DatabaseSync } from 'node:sqlite';

const root = process.cwd();
const failures = [];
const read = (path) => readFileSync(resolve(root, path), 'utf8');

const files = {
  workflow: '.github/workflows/deploy.yml',
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
    'backup-world --target-world-version 18',
    'ECONOMY_DATABASE_INCREMENTAL_VERIFIED',
    'minimum_free_kb=$((1024 * 1024))',
    'ECONOMY_DEPLOY_INSUFFICIENT_DISK',
    'ECONOMY_DEPLOY_AVAILABLE_KB=',
  ]) requireText(files.workflow, text);

  const workflow = read(files.workflow);
  const deleteBeforeCount = (workflow.match(/rsync -az --delete-before/g) ?? []).length;
  if (deleteBeforeCount !== 3) {
    failures.push(`部署工作流必须有 3 次 rsync --delete-before，当前为 ${deleteBeforeCount}`);
  }

  for (const text of [
    'source.backup(destination)',
    "backup_dir.glob('economy-pre-*.sqlite')",
    'required_bytes = database.stat().st_size + MIN_BACKUP_HEADROOM_BYTES',
  ]) forbidText(files.workflow, text);

  for (const text of [
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
    const result = spawnSync(
      'python3',
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
      failures.push(`紧凑压缩备份执行失败: ${result.stderr || result.stdout}`);
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

    if (statSync(databasePath).size !== sourceSizeBefore || digest(databasePath) !== sourceDigestBefore) {
      failures.push('备份过程修改了源数据库主文件');
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
