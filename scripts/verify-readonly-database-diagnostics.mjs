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
import { DatabaseSync } from 'node:sqlite';

const root = process.cwd();
const workflowPath = '.github/workflows/diagnose-production-database.yml';
const diagnosticPath = 'scripts/diagnose-production-database.py';
const designPath = 'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md';
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

for (const path of [workflowPath, diagnosticPath, designPath, packagePath]) {
  if (!existsSync(resolve(root, path))) failures.push(`缺少文件: ${path}`);
}

if (failures.length === 0) {
  for (const text of [
    'workflow_dispatch:',
    'permissions:\n  contents: read',
    'SERVER_USER',
    'python3 - diagnose /var/lib/riversoft-economy/economy.sqlite',
    '< scripts/diagnose-production-database.py',
    'render-summary "$report" "$GITHUB_STEP_SUMMARY"',
  ]) requireText(workflowPath, text);

  for (const text of [
    'sudo ',
    'systemctl stop',
    'systemctl restart',
    'wal_checkpoint',
    'PRAGMA optimize',
    'ATTACH DATABASE',
    'DETACH DATABASE',
    '.backup',
    'actions/upload-artifact',
  ]) forbidText(workflowPath, text);

  for (const text of [
    '?mode=ro',
    'PRAGMA query_only = ON',
    'connection.set_authorizer(_authorizer)',
    'PRAGMA quick_check(1)',
    'FROM dbstat',
    'FROM sqlite_schema',
    'length(state_json)',
    'reclaimableRatioPpm',
  ]) requireText(diagnosticPath, text);

  for (const pattern of [
    /connection\.execute\(\s*['"]\s*(?:INSERT|UPDATE|DELETE|REPLACE|CREATE|DROP|ALTER|VACUUM|ATTACH|DETACH|REINDEX|ANALYZE)\b/i,
    /connection\.executescript\(/,
    /\.backup\b/,
    /wal_checkpoint/i,
  ]) {
    if (pattern.test(read(diagnosticPath))) {
      failures.push(`${diagnosticPath} 含有可写 SQL 或备份操作: ${pattern}`);
    }
  }

  for (const text of [
    '生产数据库只读诊断工作流固定为 `.github/workflows/diagnose-production-database.yml`',
    'SQLite URI `mode=ro`、`PRAGMA query_only = ON` 和 authorizer 三重只读约束',
    '不得执行 `VACUUM`、`wal_checkpoint`、`PRAGMA optimize`、备份、附加数据库、DDL 或 DML',
    '诊断不得上传数据库、WAL、SHM、备份或包含玩家明细的 Artifact',
  ]) requireText(designPath, text);

  requireText(packagePath, 'node scripts/verify-readonly-database-diagnostics.mjs');
}

function digest(path) {
  if (!existsSync(path)) return null;
  const data = readFileSync(path);
  const stat = statSync(path, { bigint: true });
  return {
    sha256: createHash('sha256').update(data).digest('hex'),
    size: Number(stat.size),
    mtimeNs: stat.mtimeNs.toString(),
  };
}

function snapshotDatabaseFiles(databasePath) {
  return {
    database: digest(databasePath),
    wal: digest(`${databasePath}-wal`),
    shm: digest(`${databasePath}-shm`),
  };
}

if (failures.length === 0) {
  const temporaryDirectory = mkdtempSync(join(tmpdir(), 'economy-db-diagnostics-'));
  try {
    const databasePath = join(temporaryDirectory, 'economy.sqlite');
    const database = new DatabaseSync(databasePath);
    database.exec(`
      PRAGMA auto_vacuum = NONE;
      CREATE TABLE economy_world (
        id INTEGER PRIMARY KEY,
        revision INTEGER NOT NULL,
        state_json TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      ) STRICT;
      INSERT INTO economy_world (id, revision, state_json, updated_at)
      VALUES (1, 77, '{"players":{}}', 1234567890);
      CREATE TABLE filler (
        id INTEGER PRIMARY KEY,
        payload BLOB NOT NULL
      ) STRICT;
    `);
    const insert = database.prepare('INSERT INTO filler (payload) VALUES (randomblob(4000))');
    for (let index = 0; index < 256; index += 1) insert.run();
    database.exec('DELETE FROM filler;');
    database.close();

    const before = snapshotDatabaseFiles(databasePath);
    const diagnosis = spawnSync(
      'python3',
      [resolve(root, diagnosticPath), 'diagnose', databasePath, '--top-objects', '10'],
      { encoding: 'utf8' },
    );
    if (diagnosis.status !== 0) {
      failures.push(`只读诊断执行失败: ${diagnosis.stderr || diagnosis.stdout}`);
    } else {
      let report;
      try {
        report = JSON.parse(diagnosis.stdout);
      } catch (error) {
        failures.push(`只读诊断没有输出有效 JSON: ${error}`);
      }
      if (report) {
        if (report?.checks?.quickCheck !== 'ok') failures.push('quick_check 未返回 ok');
        if (report?.sqlite?.queryOnly !== 1) failures.push('query_only 未启用');
        if (report?.world?.revision !== 77) failures.push('世界修订号诊断不正确');
        if (!(report?.sqlite?.freelistCount > 0)) failures.push('未诊断出测试数据库空闲页');
        if (!(report?.sqlite?.reclaimableBytes > 0)) failures.push('未计算可回收字节');
        if (!Array.isArray(report?.largestObjects) || report.largestObjects.length === 0) {
          failures.push('未输出 SQLite 对象占用');
        }

        const reportPath = join(temporaryDirectory, 'report.json');
        const summaryPath = join(temporaryDirectory, 'summary.md');
        writeFileSync(reportPath, diagnosis.stdout, 'utf8');
        const rendered = spawnSync(
          'python3',
          [resolve(root, diagnosticPath), 'render-summary', reportPath, summaryPath],
          { encoding: 'utf8' },
        );
        if (rendered.status !== 0) {
          failures.push(`诊断摘要渲染失败: ${rendered.stderr || rendered.stdout}`);
        } else {
          const summary = readFileSync(summaryPath, 'utf8');
          for (const text of ['生产数据库只读诊断', '可复用空页', 'quick_check', '最大 SQLite 对象']) {
            if (!summary.includes(text)) failures.push(`诊断摘要缺少: ${text}`);
          }
        }
      }
    }

    const after = snapshotDatabaseFiles(databasePath);
    if (JSON.stringify(after) !== JSON.stringify(before)) {
      failures.push('只读诊断改变了数据库、WAL 或 SHM 文件');
    }
  } finally {
    rmSync(temporaryDirectory, { recursive: true, force: true });
  }
}

if (failures.length > 0) {
  console.error('生产 SQLite 只读诊断防回退验证失败：');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('生产 SQLite 只读诊断、无写入行为、汇总输出与设计规则验证通过。');
