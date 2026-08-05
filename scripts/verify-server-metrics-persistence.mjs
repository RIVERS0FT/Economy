import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { ServerMetricsStore } from '../server/src/server-metrics-store.js';

const root = process.cwd();
const failures = [];
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const files = {
  bootstrap: 'server/src/server-status-bootstrap.js',
  persistentRuntime: 'server/src/persistent-server-runtime-metrics.js',
  store: 'server/src/server-metrics-store.js',
  test: 'server/test/server-metrics-persistence.test.js',
  degradationTest: 'server/test/server-metrics-degradation.test.js',
  installer: 'scripts/install-economy-api.py',
  design: 'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md',
  docsIndex: 'docs/README.md',
  readme: 'README.md',
};

for (const path of Object.values(files)) {
  if (!existsSync(resolve(root, path))) failures.push(`缺少文件: ${path}`);
}

function requireText(path, text) {
  if (!read(path).includes(text)) failures.push(`${path} 缺少: ${text}`);
}

if (failures.length === 0) {
  requireText(files.bootstrap, 'installPersistentServerRuntimeMetrics');
  for (const text of [
    'economy_server_metric_boots',
    'economy_server_metric_buckets',
    "PRIMARY KEY (boot_id, granularity, starts_at)",
    "join(dirname(economyDatabasePath), 'server-metrics.sqlite')",
    'SERVER_METRICS_RETENTION',
  ]) requireText(files.store, text);
  for (const text of [
    'excludeBootId: bootId',
    'mergeBucketCollections',
    'store.upsertBuckets(bootId, range.granularity',
    "process.once('SIGTERM'",
    'trendBuckets.map(publicServerMetricBucket)',
    'continuing without persistence',
    'returning live metrics only',
  ]) requireText(files.persistentRuntime, text);
  requireText(files.degradationTest, 'keeps the live server collector available');
  for (const text of [
    'Environment=ECONOMY_SERVER_METRICS_DB_PATH=',
    'ECONOMY_SERVER_METRICS_DATABASE_VERIFIED',
    'PRAGMA quick_check(1)',
    'economy_server_metric_boots',
    'economy_server_metric_buckets',
  ]) requireText(files.installer, text);
  for (const text of [
    '/var/lib/riversoft-economy/server-metrics.sqlite',
    '按进程启动批次',
    '分钟聚合桶保留 48 小时',
    '不得写入 `/var/www/game/economy-api`',
    '服务安装脚本',
  ]) requireText(files.design, text);
  requireText(files.docsIndex, '独立服务器监控 SQLite');
  requireText(files.readme, 'ECONOMY_SERVER_METRICS_DB_PATH');
}

if (failures.length === 0) {
  const directory = mkdtempSync(join(tmpdir(), 'economy-server-metrics-verify-'));
  const databasePath = join(directory, 'server-metrics.sqlite');
  try {
    const store = new ServerMetricsStore(databasePath, { now: () => 1_700_000_000_000 });
    store.startBoot('verify-boot', 1_699_999_940_000, '1234567890abcdef');
    store.upsertBuckets('verify-boot', 'minute', [{
      startsAt: 1_699_999_940_000,
      endsAt: 1_700_000_000_000,
      requestCount: 1,
      routes: [],
    }]);
    store.stopBoot('verify-boot', 1_700_000_000_000);
    if (store.quickCheck() !== 'ok') failures.push('服务器监控 SQLite quick_check 未通过');
    if (store.listBuckets('minute', 1_699_999_000_000).length !== 1) {
      failures.push('服务器监控聚合桶未成功写入');
    }
    store.close();

    const reopened = new ServerMetricsStore(databasePath);
    if (reopened.listBuckets('minute', 1_699_999_000_000).length !== 1) {
      failures.push('服务器监控聚合桶在重新打开后丢失');
    }
    reopened.close();
  } catch (error) {
    failures.push(`服务器监控持久化行为验证异常: ${error.stack || error}`);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

if (failures.length > 0) {
  console.error('管理员服务器监控持久化验证失败：');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('管理员服务器监控独立 SQLite、跨启动批次合并、保留策略、故障降级、部署目录隔离和安装验收验证通过。');
