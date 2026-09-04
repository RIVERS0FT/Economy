import assert from 'node:assert/strict';
import { createRequestMetricsCollector } from '../server/src/request-metrics.js';
import { ORDER_EXECUTION_REGISTRY, PLAYER_ACTION_REGISTRY } from '../server/src/player-action-registry.js';
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

const validMutationScopes = new Set(['local-player', 'factory', 'profile', 'contract', 'facility-listing', 'auction', 'order', 'save-deletion']);
for (const [action, metadata] of Object.entries(PLAYER_ACTION_REGISTRY)) {
  assert.ok(Number(metadata.latencyBudgetMs) > 0, `${action} 必须声明交互延迟预算`);
  if (metadata.lifecycle === 'active') {
    assert.equal(metadata.acknowledgement, 'immediate', `${action} 必须在服务器确认后立即完成交互`);
    assert.ok(validMutationScopes.has(metadata.mutationScope), `${action} 必须显式声明 Mutation Scope`);
  }
}
const routeSource = read('server/src/game-routes.js');
const routeActionCandidates = new Set([...routeSource.matchAll(/'([a-z][A-Za-z0-9]*[A-Z][A-Za-z0-9]*)'/g)].map((match) => match[1]));
for (const action of routeActionCandidates) {
  assert.ok(PLAYER_ACTION_REGISTRY[action], `公开路由动作必须登记在统一注册表: ${action}`);
}
for (const [action, metadata] of Object.entries(PLAYER_ACTION_REGISTRY)) {
  if (metadata.publicRoute) assert.ok(routeSource.includes(`'${action}'`), `公开注册动作必须存在路由: ${action}`);
}
const runtimeActionSourceForRegistry = read('server/src/runtime-action-executor.js');
const runtimeOrderExecutions = new Set([...runtimeActionSourceForRegistry.matchAll(/payload\.execution === '([^']+)'/g)].map((match) => match[1]));
for (const execution of runtimeOrderExecutions) {
  assert.ok(ORDER_EXECUTION_REGISTRY[execution], `订单执行方式必须登记: ${execution}`);
}
for (const execution of Object.keys(ORDER_EXECUTION_REGISTRY).filter(Boolean)) {
  assert.ok(runtimeActionSourceForRegistry.includes(`'${execution}'`), `已登记订单执行方式必须由运行时处理: ${execution}`);
}
const metricWarnings = [];
const metricCollector = createRequestMetricsCollector({
  slowRequestMs: 1_000,
  warn: (...args) => metricWarnings.push(args),
  log: () => {},
});
metricCollector.record({
  method: 'POST',
  url: '/api/game/check-in',
  statusCode: 200,
  durationMs: 300,
  responseBytes: 64,
  gauges: { interactiveActionBudgetMs: 250, mutationScopeFullWorld: 0 },
});
assert.equal(metricWarnings.length, 1, '玩家动作超过自身延迟预算时必须进入请求异常日志');

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
  'MAX_RECENT_CLOSED_ORDERS = 800',
  'closedOrderCount += 1',
  'if (closedOrderCount > MAX_RECENT_CLOSED_ORDERS) return now;',
]);
assert.equal(
  read('server/src/world-deadline-planner.js').includes('(world.orders || []).length > 4_000'),
  false,
  '开放订单数量不得触发历史订单清理截止时间',
);
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
  'DEFAULT_WINDOW_MS = 60_000',
  'DEFAULT_SLOW_REQUEST_MS = 1_000',
  'DEFAULT_LARGE_RESPONSE_BYTES = 200 * 1024',
  'DEFAULT_MAX_ROUTE_KEYS = 256',
  "OVERFLOW_METHOD = 'OTHER'",
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
  'serializeAndDigestJson',
  'stateOrdersJsonBytes',
  'stateProvinceMarketsJsonBytes',
  'stateProvinceFacilityMarketsJsonBytes',
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
requireText('server/src/player-action-registry.js', [
  'PLAYER_ACTION_REGISTRY',
  'ORDER_EXECUTION_REGISTRY',
  'latencyBudgetMs',
  "acknowledgement = 'immediate'",
  'mutationScope',
  "saveDeletionPreflight: defineAction({ mutationScope: 'save-deletion'",
  "saveDeletion: defineAction({ mutationScope: 'save-deletion'",
]);
requireText('server/src/request-metrics.js', [
  'interactiveActionBudgetMs',
  'unexpectedFullWorldAction',
  'slowThresholdMs',
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
  'actor: `system:registration:',
  'actor: `user:${Number(account.user.id)}`',
]);
requireText('server/src/app.js', [
  'store.enqueueAuthoritativeWrite(options, callback)',
  'store.stateReadRequiresWrite(user)',
  "userWriteOptions(user, 'state-read-settlement')",
  "errorCode.startsWith('WRITE_QUEUE_')",
  'const registrationActor = `system:registration-retention:',
  'registrationStore.sessionBootstrapMode(user.id)',
  "sessionMode === 'existing'",
  'sessionMetadataWriteOptions(user)',
  "userWriteOptions(user, 'session-profile-creation')",
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
requireText('server/test/world-deadline-planner.test.js', [
  'order pruning deadline ignores production-scale open order volume',
  'order pruning deadline runs immediately only when retained closed history exceeds its cap',
  'deadline scheduler does not spin when non-pruneable open orders exceed the historical cap',
  'assert.ok(before.nextDueAt - clock.now > 60_000)',
  'assert.equal(world.orders.length, 13_812)',
]);
requireText('server/src/facility-groups.js', [
  'CLIENT_RECENT_CLOSED_ORDER_LIMIT',
  'clientOrdersForState',
  'createOrderHistoryPage',
  'const hasSystemFacilityOrder = orders.some',
  'if (!hasSystemFacilityOrder) return world;',
  'orderById(world, payload.orderId)',
]);
requireText('server/src/market-demand/signals.js', [
  'beginPlanningCache',
  'endPlanningCache',
  'planningCache = {',
  'tradeStats: new Map()',
  'quotes: new Map()',
]);
requireText('server/src/market-demand.js', [
  'signals.beginPlanningCache(world, now);',
  'signals.endPlanningCache(world);',
  'provinceWeights ||= populationDemandProvinceWeights(world);',
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
  'AUTHORITATIVE_WORLD_VERSION = 32',
  'createRuntimeMutationScope',
  'cloneWorldForMutation',
  'prepareSegmentedWorldWrite',
  'applySegmentedWorldWrite',
  'economy_world_meta',
  'economy_world_players',
  'economy_world_segments',
  "? 'commodity:placeOrder'",
  'getPlayerActionMetadata(action)',
  'requireOrderExecutionMetadata(execution)',
  'finalizeInteractiveMutationScope',
  'unexpectedFullWorldAction',
  'factoryAutoOperationScope',
  'profileMutationScope',
  'contractMutationScope',
  'facilityListingMutationScope',
]);
const worldStorageSource = read('server/src/world-storage-v2.js');
assert.equal(worldStorageSource.includes('FACTORY_SCOPE_ACTIONS'), false, 'Mutation Scope 动作集合不得在存储层重复维护');
assert.equal(worldStorageSource.includes('LOCAL_PLAYER_ACTIONS'), false, '本地玩家动作集合不得在存储层重复维护');
assert.equal(worldStorageSource.includes('return createFullMutationScope();\n}\n\nfunction cloneScopedObject'), false, '正式玩家动作不得在函数末尾静默回退 full-world');
const profileScopeSource = worldStorageSource.slice(
  worldStorageSource.indexOf('function profileMutationScope'),
  worldStorageSource.indexOf('function contractParticipantIds'),
);
assert.ok(profileScopeSource.includes('segments: new Set(CORE_LOCAL_SEGMENTS)'), '资料修改必须保持当前玩家局部核心范围');
assert.equal(profileScopeSource.includes('world?.orders'), false, '资料修改 Mutation Scope 不得扫描全局订单');
assert.equal(profileScopeSource.includes("'orders'"), false, '资料修改 Mutation Scope 不得声明 orders segment');
const playerProfileSource = read('server/src/player-profile.js');
assert.equal(playerProfileSource.includes('world.orders'), false, '正式昵称保存不得遍历或回写全局订单');
requireText('server/src/runtime-store-core.js', [
  'prepareSegmentedWorldWrite',
  'applySegmentedWorldWrite',
  'this.cacheWorld(nextRevision, null, world, false, plan.snapshot)',
]);
requireText('server/src/runtime-action-executor.js', [
  "measureRequestPhase('playerSnapshotMs'",
  "measureRequestPhase('economicInvariantMs'",
  'requirePlayerActionMetadata(action)',
  "setRequestGauge('interactiveActionBudgetMs'",
  'createRuntimeMutationScope(',
]);
assert.equal(read('server/src/runtime-action-executor.js').includes('mutationScopeAction'), false, '运行时不得维护第二份 Mutation Scope 动作映射');
requireText('server/src/game-routes.js', [
  'function resolveActionUnchecked',
  'const metadata = requirePlayerActionMetadata(route.action);',
  'category: metadata.rateLimitCategory',
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
assert.ok(runtimeCore.includes('createMarketDetail(world, { ...options, now })'), '市场详情必须直接读取 committed world，以复用订单簿运行时索引');
assert.equal(runtimeCore.includes('createMarketDetail(currentSaveWorld(world'), false, '市场详情不得为只读聚合构造浅复制 world');
assert.ok(runtimeCore.includes('createFacilityBuildProcurementQuote(\n          world,'), '建造报价必须直接读取 committed world');
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
  'main state keeps only current player open orders and bounded recent closed orders',
  'order history provides opaque cursor pagination with only the current player anonymous fills',
]);
requireText('server/test/market-state-delivery.test.js', [
  'repeated commodity market detail reuses committed-world projection without building public order-book runtime',
  'commodity market detail must not build a public order-book runtime',
]);
requireText('server/test/state-projection-cache.test.js', [
  'runtime state projection cache reuses final state and partition snapshots for one revision',
  'catalog partition cache is shared across users while player partitions remain isolated',
]);
requireText('server/test/request-performance.test.js', [
  'aggregates nested phases and gauges',
  'does nothing outside a request context',
]);
requireText('server/test/state-partitions.test.js', [
  'partition hashing reports exact partition and high-volume field byte gauges',
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

// 文档只验证领域 owner 和非显然边界；运行时阈值与固定常量直接由上面的代码检查锁定，
// 不再要求 docs/README.md 复制实现常量或跨领域规则。
requireText('docs/PAGE_CONTENT_AND_NAVIGATION_DESIGN.md', [
  '当前可配置客户端偏好只有“状态刷新频率”',
  '默认 `5s`，可选 `3s`／`5s`／`10s`',
]);
requireText('docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md', [
  '内部人口／储备订单继续复用共享撮合内核',
  '不得为了公开行情再次对完整 `world.orders` 做逐请求过滤排序',
  '关闭订单历史裁剪只允许删除超过保留上限的已关闭历史记录',
  '处于 `open`／`partial` 的内部订单不得因历史保存上限被删除',
]);
requireText('docs/WAREHOUSE_EXPANSION_DESIGN.md', [
  '仓库容量永久无限',
  '商品即时买入、商品拍卖和采购合同不预占仓库空间',
]);
requireText('docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md', [
  '正式客户端默认每 5 秒轮询一次修订号，可选 3／5／10 秒',
  '正式服务的每个 60 秒请求指标窗口最多保留 256 个方法／归一化路由键',
  '`OTHER /api/other`',
  '`responseJsonBytes`',
  '异常摘要和周期日志不得记录 Cookie、请求体',
  '世界存储必须区分冷加载迁移与热保存收口',
  '`migrateLoadedWorld`',
  '`finalizeWorldForStorage`',
  '幂等确认仍保留 24 小时，但过期删除使用服务内 5 分钟门控',
  '按 `世界修订号 + 玩家 ID` 缓存最终投影',
  '目录分区在同一服务进程内是静态快照',
  '失败或无变化动作不得制造全服状态补拉',
  '单一全局到期调度器',
  '`server/src/authoritative-write-executor.js` 的单一进程内执行器',
  '默认总深度上限固定为 128',
  '同一玩家、注册网络指纹或系统主体最多保留 4 个正在执行或排队任务',
  '普通请求排队最多 10 秒',
  '统一账号可用性检查、邮件发送和统一账号创建／登录等外部网络调用必须在队列外执行',
  '管理员 `/api/game/admin/summary` 与 `/api/game/admin/population-economy`',
  '六分区主状态不得发送公共逐笔订单或全部 800 笔关闭历史',
  '`GET /api/game/orders/history?cursor=&limit=`',
  '优雅关闭必须先停止 HTTP 接收与世界调度',
]);

if (failures.length) {
  console.error(`运行时效率验证失败:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}

const playerIdentitySource = read('server/src/player-identity.js');
const orderMatchingSource = read('server/src/order-matching.js');
const domainIdentitySource = read('server/src/domain.js');
const facilityIdentitySource = read('server/src/facility-groups.js');
const domainCoreIdentitySource = read('server/src/domain-core.js');
const contractsIdentitySource = read('server/src/contracts.js');
const commercialIdentitySource = read('server/src/commercial-contracts.js');
const auctionsIdentitySource = read('server/src/asset-auctions.js');
const identityDesignSource = read('docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md');
assert.match(playerIdentitySource, /world\?\.players\?\.\[String\(id\)\]\?\.playerName/,
  'player display names should resolve centrally from stable player ids');
assert.equal(orderMatchingSource.includes('counterparty: describeCounterparty'), false,
  'persisted order fills must not copy mutable counterparty names');
assert.equal(domainIdentitySource.includes('ownerName: player.playerName'), false,
  'new commodity orders must persist ownerId rather than playerName mirrors');
assert.equal(facilityIdentitySource.includes('ownerName: player.playerName'), false,
  'legacy facility orders must persist ownerId rather than playerName mirrors');
assert.equal(facilityIdentitySource.includes('renameFacilityOrders'), false,
  'profile rename must never fan out into facility/order history');
assert.equal(domainCoreIdentitySource.includes('ownerName: player.playerName'), false,
  'compatibility market actions must not recreate playerName mirrors');
assert.equal(contractsIdentitySource.includes('publisherName: publisher.playerName'), false,
  'supply contracts must persist participant ids rather than publisher names');
assert.match(contractsIdentitySource, /playerDisplayName\(world, contract\.publisherId\)/,
  'supply contract DTOs should resolve current publisher names from ids');
assert.match(commercialIdentitySource, /publicCommercialContract\(world, contract, userId\)/,
  'commercial contract DTOs should resolve names with world plus participant ids');
assert.equal(commercialIdentitySource.includes('publisherName: publisher.playerName'), false,
  'commercial contracts must not persist mutable publisher names');
assert.match(auctionsIdentitySource, /playerDisplayName\(world, auction\.sellerId/,
  'player auction DTOs should resolve current seller name from sellerId');
assert.equal(auctionsIdentitySource.includes('sellerName: playerName(world'), false,
  'player auctions must not persist mutable seller names');
assert.match(identityDesignSource, /关系必须只用稳定数值 ID 持久化/,
  'server architecture must document stable-id player relationships');

const identityBalancedMarketSource = read('server/src/balanced-market.js');
const identitySystemMarketSource = read('server/src/system-market.js');
const identityMarketDemandStateSource = read('server/src/market-demand/state.js');
assert.equal(domainCoreIdentitySource.includes('player.trades ||='), false,
  'authoritative world migration must remove rather than recreate obsolete server trades');
assert.equal(domainCoreIdentitySource.includes('addTrade('), false,
  'compatibility actions must not recreate presentation-only server trades');
assert.equal(identityBalancedMarketSource.includes('addTrade('), false,
  'commodity settlement must not recreate presentation-only server trades');
assert.equal(identitySystemMarketSource.includes('addTrade('), false,
  'system market settlement must not recreate presentation-only server trades');
assert.equal(identityMarketDemandStateSource.includes('player.trades'), false,
  'activity migration must not depend on presentation-only server trades');
assert.match(identityDesignSource, /已结算排行榜历史/,
  'server architecture should distinguish immutable historical name snapshots from mutable identity mirrors');

console.log('运行时效率验证通过：自适应轮询、按到期领域调度、无变化动作不写世界、合同审计事务与缓存顺序、内部订单运行时索引与合同线性索引、状态投影复用和有界请求指标均已锁定。');
