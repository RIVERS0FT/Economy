import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  effectivePollingRate,
  normalizeConfiguredPollingRate,
  POLLING_IDLE_AFTER_MS,
} from '../src/app/adaptivePolling.js';

const read = (path) => readFileSync(path, 'utf8');
const failures = [];

function requireText(path, fragments) {
  const content = read(path);
  for (const fragment of fragments) {
    if (!content.includes(fragment)) failures.push(`${path} 缺少运行时效率规则: ${fragment}`);
  }
}

assert.equal(normalizeConfiguredPollingRate('3'), '3');
assert.equal(normalizeConfiguredPollingRate('invalid'), '5');
assert.equal(effectivePollingRate({ configuredRate: '10' }), '10');
assert.equal(effectivePollingRate({ configuredRate: '3', idle: true }), '15');
assert.equal(effectivePollingRate({ configuredRate: '3', hidden: true, idle: true }), '60');
assert.equal(POLLING_IDLE_AFTER_MS, 30_000);

requireText('src/app/GameApp.tsx', [
  "import { useAdaptivePolling } from './useAdaptivePolling'",
  'const pollingPreference = useAdaptivePolling(model);',
  'refreshRate: pollingPreference.refreshRate',
  'setRefreshRate: pollingPreference.setRefreshRate',
]);
requireText('src/app/useAdaptivePolling.ts', [
  "document.addEventListener('pointerdown'",
  "document.addEventListener('keydown'",
  "document.addEventListener('focusin'",
  "document.addEventListener('visibilitychange'",
  "window.addEventListener('online'",
  'void refresh();',
  'POLLING_IDLE_AFTER_MS',
]);
requireText('server/src/world-deadline-planner.js', [
  'createWorldDeadlinePlan',
  'nextConstructionEmploymentAt',
  'createContractRuntimeIndex(world).nextDeadlineAt()',
  'createdAt + DAY_MS + 1',
]);
requireText('server/src/storage.js', [
  'new DatabaseSync(databasePath, { timeout: 5_000 })',
  'PRAGMA journal_mode = WAL;',
  'PRAGMA synchronous = NORMAL;',
  'PRAGMA foreign_keys = ON;',
  'scheduleWorldProcessing',
  'handleScheduledWorldWake',
  'setTimeoutFn',
  'schedulerMaxDelayMs',
  'schedulerNotBefore',
  'schedulerDiagnostics.transactions',
  'migrateLoadedWorld',
  'finalizeWorldForStorage',
  'cleanupExpiredIdempotency',
  'IDEMPOTENCY_CLEANUP_INTERVAL_MS = 5 * 60 * 1000',
]);
assert.doesNotMatch(read('server/src/storage.js'), /setInterval\(/, '正式世界调度不得恢复固定 setInterval');
assert.equal(read('server/src/storage.js').includes('prepareWorldForStorage'), false, '热保存不得恢复完整冷加载迁移入口');
const storageApply = read('server/src/storage.js').slice(read('server/src/storage.js').indexOf('  apply(user,'), read('server/src/storage.js').indexOf('  requireAdmin(user)'));
assert.equal((storageApply.match(/processWorldIfDue\(/g) || []).length, 1, '兼容普通动作入口只允许一次权威到期推进调用');
assert.equal((storageApply.match(/normalizeWorldMoneyPrecision\(world\)/g) || []).length, 0, '普通动作不得在最终保存前重复全世界资金扫描');
assert.equal((storageApply.match(/cleanupExpiredIdempotency\(now\)/g) || []).length, 1, '普通动作必须使用门控幂等清理');
requireText('server/src/index.js', [
  "import './request-metrics-bootstrap.js';",
  "import './app.js';",
]);
requireText('server/src/request-metrics.js', [
  'createRequestMetricsCollector',
  'averageDurationMs',
  'p50DurationMs',
  'p95DurationMs',
  'p99DurationMs',
  'averageResponseBytes',
  'Economy request outlier',
  'Economy request metrics',
  "response.getHeader('Content-Length')",
  'gauges?.responseJsonBytes ?? responseBytes',
  'DEFAULT_MAX_ROUTE_KEYS = 256',
  "OVERFLOW_ROUTE = '/api/other'",
  'overflowedRequestCount',
  'monitorEventLoopDelay',
  'createRequestPerformanceContext',
  'phases',
  'gauges',
]);
requireText('server/src/state-partitions.js', [
  'createStatePartitionSnapshot',
  'catalogSnapshot?.partition',
  'combineStatePartitions',
  'snapshot?.partitions && snapshot?.partitionRevisions',
]);
requireText('server/src/storage.js', [
  'clientStateProjectionCache = new Map()',
  'clientStateProjectionCacheLimit = 256',
  'canReuseStateProjection',
  'clientStateProjectionCache.clear()',
]);
requireText('server/src/request-performance.js', [
  'AsyncLocalStorage',
  'measureRequestPhase',
  'setRequestGauge',
  'snapshotRequestPerformance',
]);
requireText('server/src/authoritative-write-executor.js', [
  'export class AuthoritativeWriteExecutor',
  'DEFAULT_MAX_QUEUE_DEPTH = 128',
  'DEFAULT_MAX_PENDING_PER_ACTOR = 4',
  'DEFAULT_MAX_WAIT_MS = 10_000',
  'WRITE_QUEUE_BUSY',
  'WRITE_QUEUE_ACTOR_LIMIT',
  'WRITE_QUEUE_TIMEOUT',
  'WRITE_QUEUE_CLOSED',
  "addRequestPhase('writeQueueWaitMs'",
  "measureRequestPhase('writeExecutionMs'",
  "setRequestGauge('writeQueueDepth'",
  "setRequestGauge('writeQueueRejected'",
  '#drainNext()',
]);
requireText('server/src/storage.js', [
  'authoritativeWriteExecutor = new AuthoritativeWriteExecutor',
  'enqueueAuthoritativeWrite(options, callback)',
  'getAuthoritativeWriteDiagnostics()',
  'stateReadRequiresWrite(user, now = Date.now())',
  "actor: 'system:scheduler'",
  'allowWhenFull: true',
  'timeoutMs: null',
  'await this.authoritativeWriteExecutor.close({ drain: true })',
]);
requireText('server/src/registration.js', [
  'executeWrite = async (_options, callback) => callback()',
  "operation: 'registration-email-verification'",
  "operation: 'registration-completion'",
  "operation: 'registration-profile-creation'",
]);
requireText('server/src/app.js', [
  'store.enqueueAuthoritativeWrite(options, callback)',
  'store.stateReadRequiresWrite(user)',
  "userWriteOptions(user, 'state-read-settlement')",
  "errorCode.startsWith('WRITE_QUEUE_')",
  "response.setHeader('Retry-After'",
  'void store.shutdown().then(',
]);
const appSource = read('server/src/app.js');
assert.ok(appSource.includes('getStableAdminSummary(store, user)'), '管理员汇总只读接口必须直接读取已提交世界');
assert.equal(appSource.includes("userWriteOptions(user, 'admin-summary')"), false, '管理员汇总不得进入权威写队列');
assert.equal(appSource.includes("userWriteOptions(user, 'admin-population-summary')"), false, '人口经济汇总不得进入权威写队列');
requireText('server/src/admin-summary.js', [
  'store.worldCache?.world',
  "measureRequestPhase('adminSummaryProjectionMs'",
  '{ immediate: false }',
]);
assert.equal(read('server/src/admin-summary.js').includes('processWorldIfDue'), false, '管理员汇总不得强制推进世界');
assert.equal(read('server/src/admin-summary.js').includes('saveWorldIfChanged'), false, '管理员汇总不得保存世界');
requireText('server/src/order-book-runtime.js', [
  'getOrderBookSide',
  'getOwnerOrderBookSide',
  'pendingCommodityBuyQuantityForOwner',
  'facilitySellQuantityForOwner',
  'tailAppends',
  'function finalizeRuntimeBooks(state)',
  'openOrders: new WeakSet()',
  'recordOrderBookReduction',
  'closeOrderInOrderBook',
  'orderById',
]);
const orderBookRuntime = read('server/src/order-book-runtime.js');
for (const forbidden of ['playerBooks', 'systemBooks', 'playerOrdersByAsset', 'systemOrdersByAsset']) {
  assert.equal(orderBookRuntime.includes(forbidden), false, `统一订单簿不得分离玩家／系统盘口: ${forbidden}`);
}
const orderBookBuild = orderBookRuntime.slice(
  orderBookRuntime.indexOf('function buildRuntime(world)'),
  orderBookRuntime.indexOf('function runtimeFor(world)'),
);
assert.equal(orderBookBuild.includes('insertSorted('), false, '订单簿全量构建不得逐单二分插入');
requireText('server/src/domain-core.js', [
  'const retainedClosed = new Set(recentClosed.slice(-800))',
  'isOpenOrder(order) || retainedClosed.has(order)',
  'orderById(world, payload.orderId)',
]);
assert.equal(read('server/src/domain-core.js').includes('.slice(-4_000)'), false, '历史上限不得删除未完成订单');
requireText('server/src/domain.js', [
  'if (retainedOrders.length !== migratedOrders.length) migrated.orders = retainedOrders;',
]);
requireText('server/src/facility-groups.js', [
  'CLIENT_RECENT_CLOSED_ORDER_LIMIT',
  'clientOrdersForState',
  'createOrderHistoryPage',
  'const hasSystemFacilityOrder = orders.some',
  'if (!hasSystemFacilityOrder) return world;',
  'orderById(world, payload.orderId)',
]);
requireText('server/src/market-demand/state.js', [
  'const missingPlayers = Object.entries(world.players).filter',
  'if (missingPlayers.length === 0) return;',
]);
requireText('server/src/contract-runtime-index.js', [
  'runtimeByWorld',
  'createContractRuntimeIndex',
  'activeCountForParticipant',
  'openCountForPublisher',
  'nextDeadlineAt',
]);
requireText('server/src/contracts.js', [
  'processProductionContractsWithIndex',
  'runtimeIndex.activeCountForParticipant',
  'runtimeIndex.openCountForPublisher',
]);
for (const path of ['server/src/contract-runtime-index.js', 'server/src/contracts.js', 'server/src/warehouse.js']) {
  const source = read(path);
  assert.equal(source.includes('reservedIncomingForBuyer'), false, `${path} 不得恢复合同入库预留量索引`);
  assert.equal(source.includes('reservedContractIncomingForBuyer'), false, `${path} 不得恢复合同仓库预留量索引`);
}
assert.equal(read('server/src/warehouse.js').includes('createContractRuntimeIndex'), false, '无限仓库不得重新依赖合同运行时索引');
requireText('server/src/world-storage-v2.js', [
  'WORLD_STORAGE_SCHEMA_VERSION = 2',
  'AUTHORITATIVE_WORLD_VERSION = 31',
  'createRuntimeMutationScope',
  'cloneWorldForMutation',
  'prepareSegmentedWorldWrite',
  'applySegmentedWorldWrite',
  'economy_world_meta',
  'economy_world_players',
  'economy_world_segments',
  "label: 'commodity:placeOrder'",
]);
requireText('server/src/runtime-store-core.js', [
  'prepareSegmentedWorldWrite',
  'applySegmentedWorldWrite',
  'this.cacheWorld(nextRevision, null, world, false, plan.snapshot)',
]);
requireText('server/src/runtime-action-executor.js', [
  "measureRequestPhase('playerSnapshotMs'",
  "measureRequestPhase('economicInvariantMs'",
]);
requireText('server/src/runtime-store.js', [
  'cloneWorldForMutation',
  "measureRequestPhase('worldDraftCowMs'",
  'ensureScheduledProcessingBarrier',
  "measureRequestPhase('schedulerBarrierWaitMs'",
  'return executeRuntimeAction(this, user, requestMeta, now)',
]);
const runtimeStore = read('server/src/runtime-store.js');
assert.equal(runtimeStore.includes('isDeepStrictEqual(world, cached.world)'), false, 'V2 热保存不得恢复完整世界深比较');
assert.equal(runtimeStore.includes('this.updateWorld.run(nextRevision, stateJson, now)'), false, 'V2 热保存不得恢复单行完整世界写入');
const runtimeCore = read('server/src/runtime-store-core.js');
assert.ok(
  runtimeCore.indexOf('applySegmentedWorldWrite(this, plan, world, now)')
    < runtimeCore.indexOf('this.flushContractAuditEvents(world, revision, nextRevision)')
    && runtimeCore.indexOf('this.flushContractAuditEvents(world, revision, nextRevision)')
      < runtimeCore.indexOf('this.cacheWorld(nextRevision, null, world, false, plan.snapshot)'),
  '合同审计必须在分段世界写入后、运行时缓存推进前完成',
);
requireText('server/test/request-metrics.test.js', [
  'request metrics normalize route identifiers',
  'request metrics aggregate duration and application response bytes',
  'request metrics cap route cardinality and aggregate overflow',
  'request metrics prefer application response byte gauges when response headers are unavailable',
  'p95DurationMs',
  'worldCloneMs',
  'worldJsonBytes',
]);
requireText('server/test/order-history.test.js', [
  'main state keeps all open orders and only bounded recent closed orders for the current player',
  'order history provides opaque cursor pagination with only the current player anonymous fills',
]);
requireText('server/test/state-projection-cache.test.js', [
  'runtime state projection cache reuses final state and partition snapshots for one revision',
  'catalog partition cache is shared across users while player partitions remain isolated',
]);
requireText('server/test/request-performance.test.js', [
  'aggregates nested phases and gauges',
  'does nothing outside a request context',
]);
requireText('server/test/authoritative-write-executor.test.js', [
  'preserves FIFO order and single concurrency',
  'rejects total and per-actor overload',
  'expires queued writes before execution',
  'records queue phases in the submitting request context',
  'drains accepted work during graceful close',
]);
requireText('server/test/registration.test.js', [
  'registration external account and email calls run outside the authoritative write executor',
]);
requireText('server/test/world-deadline-planner.test.js', [
  'zero world transactions during a 60 second idle window',
  'wakes at the planned event and processes one world transaction',
  'instant construction registers no employment deadline',
  'long deadline timer segments early wakeups without opening a world transaction',
  'scheduler transaction failure preserves authority and retries after the one second floor',
]);
requireText('server/test/order-book-runtime.test.js', [
  'runtime order book preserves price-time-array priority for 4000 orders',
  'runtime order book tracks tail appends and rebuilds after array replacement',
  'repeated matching reuses one runtime index',
  'runtime index excludes closed history from active books',
  'runtime owner aggregates follow fills and explicit cancellation',
]);
requireText('server/test/order-book-pruning.test.js', [
  'world pruning keeps the order array reference when no history is removed',
  'world pruning never removes open orders and only keeps 800 recent closed orders',
  'legacy system facility cleanup preserves the array when there is nothing to remove',
]);
requireText('server/test/contract-runtime-index.test.js', [
  'contract runtime index caches counts for large contract sets without warehouse reservations',
  'contract runtime transitions update participant and publisher counts without rebuilding',
  'contract runtime deadline reads a live grace deadline without rebuilding',
]);
requireText('server/test/world-storage-v2.test.js', [
  'current V2 cold restarts do not advance revision or rewrite segmented rows',
  'legacy monolithic world migrates to V2 only once',
  'dirty player write leaves unrelated player and market rows byte-identical',
  'commodity order COW scope clones actor and crossing counterparties only',
]);
requireText('server/test/runtime-hotpath-architecture.test.js', [
  'segmented persistence reconstructs the same committed world without projection mutation',
]);
assert.equal(read('server/src/facility-groups.js').includes('clone(normalizeOrder(order))'), false, '公开订单投影不得先修改 committed order 再克隆');
requireText('server/test/state-polling.test.js', [
  'runtime failed actions keep the world row unchanged',
  'runtime state delivery reuses the current revision cache',
]);
requireText('server/test/runtime-hot-path.test.js', [
  'hot actions do not rerun cold world migrations and process global deadlines once',
  'idempotency expiry cleanup is throttled instead of running on every action',
]);
requireText('docs/README.md', [
  '状态刷新设置继续只保存和显示 `3s`／`5s`／`10s`',
  '连续 30 秒无交互后临时使用 15 秒',
  '页面隐藏时临时使用 60 秒',
  '重新可见、网络恢复或从限速状态恢复交互时立即请求一次权威状态',
  '每 60 秒输出一次按方法与归一化路由聚合的请求指标',
  '超过 1 秒、超过 200 KB 或返回 5xx',
  '单个窗口最多保留 256 个方法／路由键',
  '`OTHER /api/other`',
  '合同分区必须复用当前修订缓存',
  '失败或无变化动作仍保存幂等确认但不得触发全服补拉',
  '每次合同处理、动作和状态序列化只能建立一次事务内合同索引',
  '统一订单簿运行时索引只属于服务器事务内派生状态',
  '统一订单簿运行时性能属于订单簿与服务器共同规则',
  '单一混合盘口，不得按玩家／系统拆分盘口',
  '历史剪枝只限制已关闭订单为最近 800 笔',
  '正式世界调度只能使用 `world-deadline-planner.js` 计算的单一最早到期 `setTimeout`',
  '共享仓库统一预占必须同时包含未完成商品买单',
  '`DatabaseSync` 的 5 秒超时是 SQLite 锁等待上限',
  '不得记录 Cookie、请求体、玩家资产或其他敏感内容',
  '世界冷加载迁移与热保存必须分离',
  '只按实际到期领域推进',
  '幂等记录过期清理最多每 5 分钟执行一次',
  '`responseJsonBytes`',
  '管理员 `GET /api/game/admin/summary` 与 `GET /api/game/admin/population-economy`',
  '最终客户端状态必须在运行时存储层直接形成六分区快照',
  '目录分区固定为进程内共享静态快照',
  '所有可能修改 SQLite、世界状态、审计、注册、封禁、礼品、教程或运行时调度状态的操作必须进入同一进程内有界权威写执行器',
  '全局总深度最多 128、同一主体最多 4 个待处理操作、普通请求最多等待 10 秒',
  '注册邮件与统一账号网络调用必须位于写队列外',
]);

if (failures.length) {
  console.error(`运行时效率验证失败:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}

requireText('docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md', [
  '统一混合盘口',
  '先单次遍历未完成订单完成分组',
  '不得因历史保存上限删除任何未完成订单',
]);
requireText('docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md', [
  '统一订单簿运行时容量边界',
  '不得按玩家订单与系统订单拆分第二套盘口',
  '订单历史最多保留最近 800 笔未过期关闭订单',
  '世界存储必须区分冷加载迁移与热保存收口',
  '`migrateLoadedWorld`',
  '`finalizeWorldForStorage`',
  '幂等确认仍保留 24 小时，但过期删除使用服务内 5 分钟门控',
  '按 `世界修订号 + 玩家 ID` 缓存最终投影',
  'HTTP 交付层优先消费已经构造的 `partitions` 与 `partitionRevisions`',
  '六分区主状态不得发送全部 800 笔关闭历史',
  '`GET /api/game/orders/history?cursor=&limit=`',
  '`server/src/authoritative-write-executor.js` 的单一进程内执行器',
  '默认总深度上限固定为 128',
  '同一玩家、注册网络指纹或系统主体最多保留 4 个正在执行或排队任务',
  '统一账号可用性检查、邮件发送和统一账号创建／登录等外部网络调用必须在队列外执行',
  '`responseJsonBytes`',
  '`worldEqualityMs`',
  '管理员 `/api/game/admin/summary` 与 `/api/game/admin/population-economy`',
  '优雅关闭必须先停止 HTTP 接收与世界调度',
]);

console.log('运行时效率验证通过：自适应轮询、按到期领域调度、无变化动作不写世界、合同审计事务与缓存顺序、单一混合订单簿与合同线性索引、状态投影复用和有界请求指标均已锁定。');
