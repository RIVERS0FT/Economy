import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const requiredFiles = [
  'tests/stress/accounts.json',
  'tests/stress/loadAccounts.mjs',
  'tests/stress/localHarness.mjs',
  'tests/stress/metrics.mjs',
  'tests/stress/safety.mjs',
  'tests/stress/run.mjs',
  'tests/stress/budgets.json',
  'tests/stress/stress-flow.test.mjs',
  '.github/workflows/stress.yml',
];
for (const path of requiredFiles) assert.equal(existsSync(resolve(root, path)), true, `缺少压力测试流程文件 ${path}`);

for (const text of [
  "production-readonly",
  "ECONOMY_PRODUCTION_READ_ONLY",
  "definition.writes",
  "pollIntervalMs < 3_000",
  "users > 24",
  "本地隔离压力测试只能访问回环地址",
]) assert.equal(read('tests/stress/safety.mjs').includes(text), true, `压力测试安全门禁缺少 ${text}`);

for (const text of [
  'STATE_PARTITIONS',
  '状态修订号发生倒退',
  'serverNow 发生倒退',
  '相同幂等键返回了不同动作确认',
  'Promise.allSettled',
  'accountSlots',
  'unexpectedStatusCount',
]) assert.equal(read('tests/stress/run.mjs').includes(text), true, `压力测试执行器缺少 ${text}`);

for (const text of ['p50Ms', 'p90Ms', 'p95Ms', 'p99Ms', 'serverErrorCount', 'timeoutCount', 'statusCodes']) {
  assert.equal(read('tests/stress/metrics.mjs').includes(text), true, `压力测试指标缺少 ${text}`);
}

const workflow = read('.github/workflows/stress.yml');
for (const text of [
  'workflow_dispatch:',
  'schedule:',
  'environment: economy-stress',
  'ECONOMY_STRESS_TEST_PASSWORD:',
  'ECONOMY_STRESS_BASE_URL:',
  'npm run stress:run',
  'actions/upload-artifact@v4',
  'retention-days: 14',
]) assert.equal(workflow.includes(text), true, `压力测试工作流缺少 ${text}`);
assert.equal(workflow.includes('pull_request:'), false, '完整压力测试工作流不得在每个 PR 自动运行');

const packageJson = JSON.parse(read('package.json'));
assert.equal(packageJson.scripts?.['test:stress'], 'node --test tests/stress/stress-flow.test.mjs');
assert.equal(packageJson.scripts?.['stress:smoke'], 'node tests/stress/run.mjs --target local --profile smoke --users 4 --duration-seconds 5 --poll-interval-ms 500');
assert.equal(packageJson.scripts?.['stress:run'], 'node tests/stress/run.mjs');
assert.equal(packageJson.scripts?.['verify:stress'], 'node scripts/verify-stress-test-accounts.mjs && node scripts/verify-stress-test-flow.mjs && npm run test:stress');

const budgets = JSON.parse(read('tests/stress/budgets.json'));
assert.equal(budgets.profiles?.mixed?.routes?.['POST /api/game/work']?.maxP95Ms, 1_100, 'mixed work p95 预算必须使用三次 Node 24 基线校准值');
assert.equal(budgets.baselines?.mixedGithubNode24?.runIds?.length, 3, 'mixed 预算校准必须保存三个同环境 run ID');
assert.equal(budgets.baselines?.mixedGithubNode24?.workP95Ms?.length, 3, 'mixed 预算校准必须保存三个同环境观测值');

for (const text of ['隔离环境', '生产环境只允许', 'p50／p90／p95／p99', 'GitHub Actions', 'run ID、环境和观测值']) {
  assert.equal(read('docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md').includes(text), true, `服务器设计缺少压力测试规则 ${text}`);
}
assert.equal(read('docs/README.md').includes('压力测试执行器、环境隔离、安全门禁'), true, '设计索引缺少压力测试跨模块规则');

console.log('压力测试执行器、隔离环境、协议断言、性能预算、生产安全门禁、报告和工作流均已锁定。');
