import { readFileSync, writeFileSync } from 'node:fs';

function read(path) {
  return readFileSync(path, 'utf8');
}

function write(path, content) {
  writeFileSync(path, content);
}

function replaceOnce(path, before, after) {
  let source = read(path);
  if (source.includes(after)) return;
  const index = source.indexOf(before);
  if (index < 0) throw new Error(`missing replacement target in ${path}: ${before.slice(0, 120)}`);
  if (source.indexOf(before, index + before.length) >= 0) {
    throw new Error(`ambiguous replacement target in ${path}: ${before.slice(0, 120)}`);
  }
  source = source.slice(0, index) + after + source.slice(index + before.length);
  write(path, source);
}

function replaceCount(path, before, after, expectedCount) {
  let source = read(path);
  if (source.includes(after) && !source.includes(before)) return;
  const parts = source.split(before);
  const count = parts.length - 1;
  if (count !== expectedCount) throw new Error(`unexpected replacement count in ${path}: expected ${expectedCount}, got ${count}`);
  source = parts.join(after);
  write(path, source);
}

write('server/src/admin-summary.js', `import { createPopulationAdminSummary } from './population-admin-control.js';
import { measureRequestPhase } from './request-performance.js';

function buildAdminSummary(store, world, revision, now) {
  let openOrderCount = 0;
  let commodityOrderCount = 0;
  let facilityOrderCount = 0;
  for (const order of world.orders || []) {
    if (!(Number(order?.remaining) > 0) || !['open', 'partial'].includes(order?.status)) continue;
    openOrderCount += 1;
    if (order.assetKind === 'facility') facilityOrderCount += 1;
    else commodityOrderCount += 1;
  }

  return {
    playerCount: Object.keys(world.players || {}).length,
    openOrderCount,
    commodityOrderCount,
    facilityOrderCount,
    openAuctionCount: (world.assetAuctions || []).filter((auction) => auction.status === 'open').length,
    openContractCount: (world.productionContracts || []).filter((contract) => (
      contract.status === 'open' || contract.status === 'active'
    )).length,
    worldVersion: Number(world.version || 0),
    revision: Number(revision),
    lastProcessedAt: Number(world.lastProcessedAt || now),
    apiStatus: 'ok',
    authoritativeWriteExecutor: store.getAuthoritativeWriteDiagnostics(),
    populationEconomy: createPopulationAdminSummary(world, now),
  };
}

function committedWorldForAdminSummary(store, now) {
  if (store.worldCache?.world) {
    return {
      revision: Number(store.worldCache.revision),
      world: store.worldCache.world,
    };
  }
  return store.transaction(() => {
    const { revision, world } = store.loadWorld(now);
    return { revision: Number(revision), world };
  }, { immediate: false });
}

export function getStableAdminSummary(store, user, now = Date.now()) {
  store.requireAdmin(user);
  const { revision, world } = committedWorldForAdminSummary(store, now);
  return measureRequestPhase('adminSummaryProjectionMs', () => (
    buildAdminSummary(store, world, revision, now)
  ));
}
`);

replaceOnce(
  'server/src/app.js',
  "        const summary = await enqueueAuthoritativeWrite(userWriteOptions(user, 'admin-summary'), () => getStableAdminSummary(store, user));",
  "        const summary = getStableAdminSummary(store, user);",
);
replaceOnce(
  'server/src/app.js',
  "        const summary = await enqueueAuthoritativeWrite(userWriteOptions(user, 'admin-population-summary'), () => getStableAdminSummary(store, user));",
  "        const summary = getStableAdminSummary(store, user);",
);

replaceOnce(
  'server/src/request-metrics.js',
  '    const bytes = finiteNonNegative(responseBytes);',
  '    const bytes = finiteNonNegative(gauges?.responseJsonBytes ?? responseBytes);',
);

replaceOnce(
  'server/src/runtime-store-core.js',
  `    const unchanged = cached
      && cached.revision === revision
      && !cached.needsPersistence
      && isDeepStrictEqual(world, cached.world);`,
  `    const unchanged = cached
      && cached.revision === revision
      && !cached.needsPersistence
      && measureRequestPhase('worldEqualityMs', () => isDeepStrictEqual(world, cached.world));`,
);
replaceOnce(
  'server/src/runtime-store-core.js',
  `    world.lastProcessedAt = now;
    const stateJson = JSON.stringify(world);
    const nextRevision = revision + 1;
    this.updateWorld.run(nextRevision, stateJson, now);`,
  `    world.lastProcessedAt = now;
    const stateJson = measureRequestPhase('serializeWorldMs', () => JSON.stringify(world));
    const nextRevision = revision + 1;
    measureRequestPhase('worldUpdateMs', () => this.updateWorld.run(nextRevision, stateJson, now));`,
);

replaceOnce(
  'server/src/storage.js',
  `    const stateJson = this.serializeWorld(world, now);
    const nextRevision = revision + 1;
    this.updateWorld.run(nextRevision, stateJson, now);`,
  `    const stateJson = this.serializeWorld(world, now);
    const nextRevision = revision + 1;
    measureRequestPhase('worldUpdateMs', () => this.updateWorld.run(nextRevision, stateJson, now));`,
);
replaceOnce(
  'server/src/storage.js',
  `    const unchanged = cached
      && cached.revision === revision
      && !cached.needsPersistence
      && isDeepStrictEqual(world, cached.world);`,
  `    const unchanged = cached
      && cached.revision === revision
      && !cached.needsPersistence
      && measureRequestPhase('worldEqualityMs', () => isDeepStrictEqual(world, cached.world));`,
);
replaceOnce(
  'server/src/storage.js',
  `    world.lastProcessedAt = now;
    const stateJson = JSON.stringify(world);
    const nextRevision = revision + 1;
    this.updateWorld.run(nextRevision, stateJson, now);`,
  `    world.lastProcessedAt = now;
    const stateJson = measureRequestPhase('serializeWorldMs', () => JSON.stringify(world));
    const nextRevision = revision + 1;
    measureRequestPhase('worldUpdateMs', () => this.updateWorld.run(nextRevision, stateJson, now));`,
);

replaceOnce(
  'server/src/runtime-action-executor.js',
  "import { normalizePlayerMoneyPayload } from './money.js';\n",
  "import { normalizePlayerMoneyPayload } from './money.js';\nimport { measureRequestPhase } from './request-performance.js';\n",
);
replaceOnce(
  'server/src/runtime-action-executor.js',
  "  const playerBeforeAction = structuredClone(world.players?.[String(user.id)] ?? null);",
  "  const playerBeforeAction = measureRequestPhase('playerSnapshotMs', () => (\n    structuredClone(world.players?.[String(user.id)] ?? null)\n  ));",
);
replaceCount(
  'server/src/runtime-action-executor.js',
  '      assertEconomicStateInvariants(world);',
  "      measureRequestPhase('economicInvariantMs', () => assertEconomicStateInvariants(world));",
  2,
);

write('server/test/admin-summary.test.js', `import assert from 'node:assert/strict';
import test from 'node:test';
import { getStableAdminSummary } from '../src/admin-summary.js';
import { EconomyStore } from '../src/storage.js';

test('unchanged admin summary does not advance the world revision', () => {
  const store = new EconomyStore(':memory:');
  const admin = { id: 1, email: 'admin@example.com', role: 'admin' };
  const now = Date.UTC(2026, 6, 17, 12, 0, 0);
  try {
    const first = getStableAdminSummary(store, admin, now);
    const revisionBefore = store.worldCache.revision;
    const worldBefore = structuredClone(store.worldCache.world);

    store.transaction = () => { throw new Error('committed admin summary must not open a transaction'); };
    store.processWorldIfDue = () => { throw new Error('committed admin summary must not process the world'); };
    store.saveWorldIfChanged = () => { throw new Error('committed admin summary must not persist the world'); };

    const second = getStableAdminSummary(store, admin, now + 1_000);
    assert.equal(second.revision, first.revision);
    assert.equal(store.worldCache.revision, revisionBefore);
    assert.equal(second.playerCount, first.playerCount);
    assert.equal(second.openOrderCount, first.openOrderCount);
    assert.deepEqual(store.worldCache.world, worldBefore);
  } finally {
    store.close();
  }
});
`);

replaceOnce(
  'server/test/request-metrics.test.js',
  "test('request latency histograms merge across minute, hour, and day rollups', () => {",
  `test('request metrics prefer application response byte gauges when response headers are unavailable', () => {
  const collector = createRequestMetricsCollector({
    now: () => 1_000,
    log: () => {},
    warn: () => {},
  });
  collector.record({
    method: 'GET',
    url: '/api/game/state',
    statusCode: 200,
    durationMs: 5,
    responseBytes: undefined,
    gauges: { responseJsonBytes: 321 },
  });
  const summary = collector.snapshot();
  assert.equal(summary.routes[0].averageResponseBytes, 321);
  assert.equal(summary.routes[0].maxResponseBytes, 321);
});

test('request latency histograms merge across minute, hour, and day rollups', () => {`,
);

replaceOnce(
  'scripts/verify-runtime-efficiency.mjs',
  "  \"response.getHeader('Content-Length')\",\n  'DEFAULT_MAX_ROUTE_KEYS = 256',",
  "  \"response.getHeader('Content-Length')\",\n  'gauges?.responseJsonBytes ?? responseBytes',\n  'DEFAULT_MAX_ROUTE_KEYS = 256',",
);
replaceOnce(
  'scripts/verify-runtime-efficiency.mjs',
  `requireText('server/src/app.js', [
  'store.enqueueAuthoritativeWrite(options, callback)',
  'store.stateReadRequiresWrite(user)',
  "userWriteOptions(user, 'state-read-settlement')",
  "errorCode.startsWith('WRITE_QUEUE_')",
  "response.setHeader('Retry-After'",
  'void store.shutdown().then(',
]);`,
  `requireText('server/src/app.js', [
  'store.enqueueAuthoritativeWrite(options, callback)',
  'store.stateReadRequiresWrite(user)',
  "userWriteOptions(user, 'state-read-settlement')",
  "errorCode.startsWith('WRITE_QUEUE_')",
  "response.setHeader('Retry-After'",
  'void store.shutdown().then(',
]);
const appSource = read('server/src/app.js');
const adminSummaryRoute = appSource.slice(
  appSource.indexOf("if (method === 'GET' && path === '/api/game/admin/summary')"),
  appSource.indexOf("if (method === 'GET' && path === '/api/game/admin/server-status')"),
);
const adminPopulationRoute = appSource.slice(
  appSource.indexOf("if (method === 'GET' && path === '/api/game/admin/population-economy')"),
  appSource.indexOf("if (method === 'GET' && path === '/api/game/admin/player-statistics')"),
);
for (const [label, source] of [['admin summary', adminSummaryRoute], ['admin population', adminPopulationRoute]]) {
  assert.ok(source.includes('getStableAdminSummary(store, user)'), `${label} 必须直接读取已提交世界`);
  assert.equal(source.includes('enqueueAuthoritativeWrite'), false, `${label} 只读接口不得进入权威写队列`);
}
requireText('server/src/admin-summary.js', [
  'store.worldCache?.world',
  "measureRequestPhase('adminSummaryProjectionMs'",
  '{ immediate: false }',
]);
assert.equal(read('server/src/admin-summary.js').includes('processWorldIfDue'), false, '管理员汇总不得强制推进世界');
assert.equal(read('server/src/admin-summary.js').includes('saveWorldIfChanged'), false, '管理员汇总不得保存世界');`,
);
replaceOnce(
  'scripts/verify-runtime-efficiency.mjs',
  `requireText('server/src/runtime-store.js', [
  'createClientPartitionSnapshot',`,
  `requireText('server/src/runtime-store-core.js', [
  "measureRequestPhase('worldEqualityMs'",
  "measureRequestPhase('serializeWorldMs'",
  "measureRequestPhase('worldUpdateMs'",
]);
requireText('server/src/runtime-action-executor.js', [
  "measureRequestPhase('playerSnapshotMs'",
  "measureRequestPhase('economicInvariantMs'",
]);
requireText('server/src/runtime-store.js', [
  'createClientPartitionSnapshot',`,
);
replaceOnce(
  'scripts/verify-runtime-efficiency.mjs',
  "  'request metrics cap route cardinality and aggregate overflow',\n  'p95DurationMs',",
  "  'request metrics cap route cardinality and aggregate overflow',\n  'request metrics prefer application response byte gauges when response headers are unavailable',\n  'p95DurationMs',",
);
replaceOnce(
  'scripts/verify-runtime-efficiency.mjs',
  "  '幂等记录过期清理最多每 5 分钟执行一次',\n  '最终客户端状态必须在运行时存储层直接形成六分区快照',",
  "  '幂等记录过期清理最多每 5 分钟执行一次',\n  '`responseJsonBytes`',\n  '管理员 `GET /api/game/admin/summary` 与 `GET /api/game/admin/population-economy`',\n  '最终客户端状态必须在运行时存储层直接形成六分区快照',",
);
replaceOnce(
  'scripts/verify-runtime-efficiency.mjs',
  "  '统一账号可用性检查、邮件发送和统一账号创建／登录等外部网络调用必须在队列外执行',\n  '优雅关闭必须先停止 HTTP 接收与世界调度',",
  "  '统一账号可用性检查、邮件发送和统一账号创建／登录等外部网络调用必须在队列外执行',\n  '`responseJsonBytes`',\n  '`worldEqualityMs`',\n  '管理员 `/api/game/admin/summary` 与 `/api/game/admin/population-economy`',\n  '优雅关闭必须先停止 HTTP 接收与世界调度',",
);

replaceOnce(
  'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md',
  '每个路由必须同时汇总请求总耗时的平均值、p50、p95、p99、最大值和应用层 JSON 响应字节数，并在同一请求上下文中记录事务等待、世界复制、世界推进、资金规范化、状态投影、合同投影、分区构造、分区哈希、世界序列化、响应序列化和 SQLite 提交等阶段耗时。',
  '每个路由必须同时汇总请求总耗时的平均值、p50、p95、p99、最大值和应用层 JSON 响应字节数。响应字节以 `sendJson` 写入请求上下文的 `responseJsonBytes` 为优先权威来源，`Content-Length` 只允许作为无应用层字节指标时的回退；响应结束后头部不可读不得把已经记录的非零 JSON 响应误记为 `0 B`。同一请求上下文必须记录事务等待、世界草稿解析／复制、玩家动作前快照、世界推进、经济不变量检查、资金规范化、世界等值比较、状态投影、合同投影、分区构造、分区哈希、世界序列化、世界 SQLite 更新、响应序列化和 SQLite 提交等阶段耗时，其中正式名称至少包括 `playerSnapshotMs`、`economicInvariantMs`、`worldEqualityMs`、`serializeWorldMs` 与 `worldUpdateMs`。',
);
replaceOnce(
  'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md',
  '管理员 `/api/game/admin/summary` 在同一世界事务返回只读人口经济摘要',
  '管理员 `/api/game/admin/summary` 与 `/api/game/admin/population-economy` 必须直接读取已提交世界并返回只读人口经济摘要；已有世界缓存时不得进入 SQLite 事务、权威写队列、强制世界推进或世界保存路径，冷缓存仅允许通过只读事务装载当前持久化世界',
);

replaceOnce(
  'docs/README.md',
  '合同、拍卖、银行、研发和排行榜客户端状态同样必须只读生成。正式调度继续复用同一修订号计划并只按实际到期领域推进',
  '合同、拍卖、银行、研发和排行榜客户端状态同样必须只读生成。管理员 `GET /api/game/admin/summary` 与 `GET /api/game/admin/population-economy` 也必须直接读取已提交世界，已有缓存时不得进入权威写队列、SQLite 事务、强制世界推进或保存路径。正式调度继续复用同一修订号计划并只按实际到期领域推进',
);
replaceOnce(
  'docs/README.md',
  '应用层 JSON 响应字节数、固定阶段耗时、事件循环延迟和无身份容量指标',
  '应用层 JSON 响应字节数（优先使用 `responseJsonBytes`，`Content-Length` 仅作回退）、固定阶段耗时（至少包含 `playerSnapshotMs`、`economicInvariantMs`、`worldEqualityMs`、`serializeWorldMs`、`worldUpdateMs`）、事件循环延迟和无身份容量指标',
);

console.log('API latency observability v3 patch applied');
