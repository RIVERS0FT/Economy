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
  'production-readonly',
  'ECONOMY_PRODUCTION_READ_ONLY',
  'definition.writes',
  'pollIntervalMs < 3_000',
  'users > 24',
  '本地隔离压力测试只能访问回环地址',
  "'transaction-mix'",
  'localOnly: true',
  '场景只能在本地隔离环境运行',
]) assert.equal(read('tests/stress/safety.mjs').includes(text), true, `压力测试安全门禁缺少 ${text}`);

const runner = read('tests/stress/run.mjs');
const serverApp = read('server/src/app.js');
const requestPerformance = read('server/src/request-performance.js');
for (const text of [
  'STATE_PARTITIONS',
  '修订号发生倒退',
  'serverNow 发生倒退',
  '相同幂等键返回了不同命令结果',
  'commandRevision',
  'X-Economy-State-Revisions',
  'acceptDelivery(client, payload',
  'acceptCompactActionConfirmation',
  "route === '/api/game/orders'",
  "body?.assetKind === 'commodity'",
  '!body?.execution',
  'Do not advance client.revision here',
  'Promise.allSettled',
  'accountSlots',
  'unexpectedStatusCount',
  'TRANSACTION_MIX_WEIGHTS',
  'state: 60',
  'order: 15',
  'facilityToggle: 10',
  'recipe: 5',
  'build: 5',
  'research: 5',
  "'/api/game/orders'",
  "const operation = running ? 'pause' : 'start';",
  '`/api/game/facilities/:id/${operation}`',
  "'/api/game/facilities/:id/recipe'",
  "'/api/game/facilities'",
  "'/api/game/research/start'",
  "'/api/game/research/accelerate'",
  'X-Economy-Save-Epoch',
  'serverTimingDurationMs',
  "timingSource: 'server-local'",
  "seedTransactionAssets: profile === 'transaction-mix'",
]) assert.equal(runner.includes(text), true, `压力测试执行器缺少 ${text}`);
assert.equal(runner.includes('/api/game/work'), false, '压力测试执行器不得恢复已退役工作路由');

assert.equal(
  runner.includes('seedTransactionAssets: true'),
  false,
  '隔离资产预置不得无条件启用，避免改变 mixed 等既有校准场景',
);

const harness = read('tests/stress/localHarness.mjs');
for (const text of [
  'seedLocalStressDatabase',
  'seedTransactionAssets = false',
  'if (seedTransactionAssets) seedLocalStressDatabase',
  'LOCAL_STRESS_CREDITS = 1_000_000',
  'LOCAL_STRESS_GEMS = 1_000',
  'LOCAL_STRESS_INVENTORY_CAPACITY = 1_000_000',
  'LOCAL_STRESS_INVENTORY_PER_PRODUCT = 1_000',
  'LOCAL_STRESS_FARM_COUNT = 10',
  "'buildFacility'",
  "{ facilityTypeId: 'farm', quantity: LOCAL_STRESS_FARM_COUNT }",
]) assert.equal(harness.includes(text), true, `本地隔离压力预置缺少 ${text}`);

for (const text of ['p50Ms', 'p90Ms', 'p95Ms', 'p99Ms', 'serverErrorCount', 'timeoutCount', 'statusCodes']) {
  assert.equal(read('tests/stress/metrics.mjs').includes(text), true, `压力测试指标缺少 ${text}`);
}
const stressMetrics = read('tests/stress/metrics.mjs');
assert.equal(
  stressMetrics.includes('performance.now() - startedAt'),
  false,
  '压力测试不得记录客户端端到端耗时',
);
assert.equal(
  stressMetrics.includes("timingSource === 'server-local'"),
  true,
  '压力测试延迟预算必须只采用服务端本地耗时',
);
assert.equal(
  runner.includes('performance.now() - startedAt'),
  false,
  '压力测试请求封装不得记录客户端端到端耗时',
);
assert.equal(
  runner.includes("method === 'GET' ? 30_000"),
  true,
  '远程只读 GET 不得因公网传输超过 8 秒被误判 abort',
);
assert.equal(
  serverApp.includes('requestProcessingMs().toFixed(3)'),
  true,
  'Server-Timing 必须输出服务端处理 phase 总和',
);
assert.equal(
  requestPerformance.includes('export function requestProcessingMs'),
  true,
  '服务器必须提供处理 phase 求和口径',
);

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
  '          - transaction-mix',
]) assert.equal(workflow.includes(text), true, `压力测试工作流缺少 ${text}`);
assert.equal(workflow.includes('pull_request:'), false, '完整压力测试工作流不得在每个 PR 自动运行');

const packageJson = JSON.parse(read('package.json'));
assert.equal(packageJson.scripts?.['test:stress'], 'node --test tests/stress/stress-flow.test.mjs');
assert.equal(packageJson.scripts?.['stress:smoke'], 'node tests/stress/run.mjs --target local --profile smoke --users 4 --duration-seconds 5 --poll-interval-ms 500');
assert.equal(packageJson.scripts?.['stress:run'], 'node tests/stress/run.mjs');
assert.equal(packageJson.scripts?.['verify:stress'], 'node scripts/verify-stress-test-accounts.mjs && node scripts/verify-stress-test-flow.mjs && npm run test:stress');

const budgets = JSON.parse(read('tests/stress/budgets.json'));
assert.equal(budgets.baselines?.mixedGithubNode24?.runIds?.length, 3, 'mixed 预算校准必须保存三个同环境 run ID');
assert.equal(JSON.stringify(budgets).includes('/api/game/work'), false, '压力预算不得恢复已退役工作路由');
assert.equal(budgets.profiles?.['transaction-mix']?.maxTimeouts, 0, 'transaction-mix 不允许超时');
assert.equal(budgets.profiles?.['transaction-mix']?.maxServerErrors, 0, 'transaction-mix 不允许 5xx');
assert.equal(budgets.profiles?.['transaction-mix']?.maxUnexpectedStatuses, 0, 'transaction-mix 不允许非预期状态码');
assert.equal(budgets.profiles?.['transaction-mix']?.maxP95Ms, 1_000, 'transaction-mix 总体 p95 预算必须为 1000ms');
assert.equal(budgets.profiles?.['transaction-mix']?.maxP99Ms, 3_000, 'transaction-mix 总体 p99 预算必须为 3000ms');

const stressTests = read('tests/stress/stress-flow.test.mjs');
for (const text of [
  'isolated transaction mix exercises state, orders, facilities, recipes, builds and research',
  "profile: 'transaction-mix'",
  '事务混合场景未覆盖',
  'report.metrics.unexpectedStatusCount',
]) assert.equal(stressTests.includes(text), true, `压力测试回归缺少 ${text}`);

for (const text of [
  '隔离环境',
  '生产环境只允许',
  'p50／p90／p95／p99',
  'GitHub Actions',
  'run ID、环境和观测值',
  '`transaction-mix`',
  '60% 状态读取',
  '15% 商品订单',
  '10% 工厂启停',
  '5% 配方切换',
  '5% 即时建设',
  '5% 研发',
]) {
  assert.equal(read('docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md').includes(text), true, `服务器设计缺少压力测试规则 ${text}`);
}

// 压力测试属于服务器容量与生产安全验证；设计索引只负责把容量／生产规则
// 路由到 SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN，不再复制压力场景正文。
assert.equal(
  read('docs/README.md').includes('`SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md`'),
  true,
  '设计索引必须登记服务器架构与部署 DESIGN',
);

console.log('压力测试执行器、事务混合覆盖、动作权威增量、幂等命令语义、隔离预置、性能预算、生产安全门禁、报告和工作流均已锁定。');
