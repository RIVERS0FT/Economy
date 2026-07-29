import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';

const root = process.cwd();
const maintenancePath = 'scripts/manage-production-database.py';
const migrationWorkflowPath = '.github/workflows/migrate-production-database-incremental.yml';
const maintenanceWorkflowPath = '.github/workflows/maintain-production-database-space.yml';
const docsIndexPath = 'docs/README.md';
const packagePath = 'package.json';
const failures = [];

function read(path) {
  return readFileSync(resolve(root, path), 'utf8');
}

function requireText(path, text) {
  if (!read(path).includes(text)) failures.push(`${path} 缺少: ${text}`);
}

function forbidText(path, text) {
  if (read(path).includes(text)) failures.push(`${path} 不应包含: ${text}`);
}

for (const path of [
  maintenancePath,
  migrationWorkflowPath,
  maintenanceWorkflowPath,
  docsIndexPath,
  packagePath,
]) {
  if (!existsSync(resolve(root, path))) failures.push(`缺少文件: ${path}`);
}

if (failures.length === 0) {
  for (const text of [
    "PRAGMA auto_vacuum = INCREMENTAL",
    "PRAGMA incremental_vacuum(",
    ".fetchall()",
    "VACUUM INTO",
    "PRAGMA wal_checkpoint(TRUNCATE)",
    "ECONOMY_DATABASE_FINGERPRINT_MISMATCH",
    "minimum-reclaimable-bytes",
    "pages-per-batch",
  ]) requireText(maintenancePath, text);

  for (const text of [
    'workflow_dispatch:',
    'ENABLE_INCREMENTAL_VACUUM_ON_PRODUCTION',
    'migrate-incremental',
    'economy-production-database-mutation',
    'render-summary',
  ]) requireText(migrationWorkflowPath, text);

  for (const text of [
    "cron: '30 18 * * 0'",
    'maintain-incremental',
    '--minimum-reclaimable-bytes 67108864',
    '--minimum-reclaimable-ratio-ppm 250000',
    '--pages-per-batch 1024',
    '--max-batches 4',
    'economy-production-database-mutation',
  ]) requireText(maintenanceWorkflowPath, text);

  for (const text of [
    '生产 SQLite `INCREMENTAL` 自动压缩',
    '`PRAGMA incremental_vacuum(1024)`',
    '每周一北京时间 02:30',
    '不得把 `incremental_vacuum` 放入玩家请求事务',
  ]) requireText(docsIndexPath, text);
  requireText(packagePath, 'node scripts/verify-production-database-maintenance.mjs');

  for (const text of [
    'PRAGMA auto_vacuum = FULL',
    'PRAGMA incremental_vacuum;',
    'PRAGMA incremental_vacuum\n',
  ]) forbidText(maintenancePath, text);
}

function runMaintenance(args, options = {}) {
  return spawnSync('python3', [resolve(root, maintenancePath), ...args], {
    encoding: 'utf8',
    ...options,
  });
}

if (failures.length === 0) {
  const temporaryDirectory = mkdtempSync(join(tmpdir(), 'economy-db-maintenance-'));
  try {
    const databasePath = join(temporaryDirectory, 'economy.sqlite');
    const backupDirectory = join(temporaryDirectory, 'backups');
    const lockPath = join(temporaryDirectory, 'maintenance.lock');
    const database = new DatabaseSync(databasePath);
    database.exec(`
      PRAGMA auto_vacuum = NONE;
      PRAGMA journal_mode = WAL;
      CREATE TABLE economy_world (
        id INTEGER PRIMARY KEY,
        revision INTEGER NOT NULL,
        state_json TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      ) STRICT;
      INSERT INTO economy_world (id, revision, state_json, updated_at)
      VALUES (1, 88, '{"version":17,"players":{}}', 1234567890);
      CREATE TABLE economy_idempotency (
        user_id INTEGER NOT NULL,
        request_key TEXT NOT NULL,
        response_json TEXT NOT NULL,
        PRIMARY KEY (user_id, request_key)
      ) STRICT;
      CREATE TABLE filler (
        id INTEGER PRIMARY KEY,
        payload BLOB NOT NULL
      ) STRICT;
    `);
    const insert = database.prepare('INSERT INTO filler (payload) VALUES (randomblob(4000))');
    for (let index = 0; index < 512; index += 1) insert.run();
    database.exec('DELETE FROM filler;');
    database.close();

    const originalSize = statSync(databasePath).size;
    const migration = runMaintenance([
      'migrate-incremental',
      '--offline',
      '--database', databasePath,
      '--backup-directory', backupDirectory,
      '--lock-path', lockPath,
    ]);
    if (migration.status !== 0) {
      failures.push(`INCREMENTAL 迁移测试失败: ${migration.stderr || migration.stdout}`);
    } else {
      const report = JSON.parse(migration.stdout);
      const migrated = new DatabaseSync(databasePath);
      const mode = Number(migrated.prepare('PRAGMA auto_vacuum').get().auto_vacuum);
      const quickCheck = String(migrated.prepare('PRAGMA quick_check(1)').get().quick_check);
      const revision = Number(migrated.prepare('SELECT revision FROM economy_world WHERE id = 1').get().revision);
      migrated.close();
      if (mode !== 2) failures.push(`迁移后 auto_vacuum=${mode}，预期 2`);
      if (quickCheck !== 'ok') failures.push(`迁移后 quick_check=${quickCheck}`);
      if (revision !== 88) failures.push(`迁移后世界修订号=${revision}`);
      if (!(statSync(databasePath).size < originalSize / 4)) failures.push('迁移未明显缩小测试数据库');
      if (!existsSync(report.backup)) failures.push('迁移未保留可回滚旧数据库');
    }

    const writable = new DatabaseSync(databasePath);
    const add = writable.prepare('INSERT INTO filler (payload) VALUES (randomblob(4000))');
    for (let index = 0; index < 320; index += 1) add.run();
    writable.exec('DELETE FROM filler;');
    const freelistBefore = Number(writable.prepare('PRAGMA freelist_count').get().freelist_count);
    writable.close();

    const maintenance = runMaintenance([
      'maintain-incremental',
      '--offline',
      '--force',
      '--database', databasePath,
      '--lock-path', lockPath,
      '--pages-per-batch', '64',
      '--max-batches', '2',
    ]);
    if (maintenance.status !== 0) {
      failures.push(`增量回收测试失败: ${maintenance.stderr || maintenance.stdout}`);
    } else {
      const report = JSON.parse(maintenance.stdout);
      const checked = new DatabaseSync(databasePath);
      const freelistAfter = Number(checked.prepare('PRAGMA freelist_count').get().freelist_count);
      checked.close();
      if (!(freelistBefore > freelistAfter)) failures.push('增量回收未减少 freelist');
      const reclaimed = report.batches.reduce((total, batch) => total + batch.pagesReclaimed, 0);
      if (!(reclaimed > 0 && reclaimed <= 128)) failures.push(`增量回收页数不受批量限制: ${reclaimed}`);
    }

  } catch (error) {
    failures.push(`生产数据库维护行为验证异常: ${error.stack || error}`);
  } finally {
    rmSync(temporaryDirectory, { recursive: true, force: true });
  }
}

if (failures.length > 0) {
  console.error('生产 SQLite INCREMENTAL 维护防回退验证失败：');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('生产 SQLite INCREMENTAL 迁移、限量回收与设计规则验证通过。');
