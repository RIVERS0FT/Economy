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
]);
assert.doesNotMatch(read('server/src/storage.js'), /setInterval\(/, '正式世界调度不得恢复固定 setInterval');
requireText('server/src/index.js', [
  "import './request-metrics-bootstrap.js';",
  "import './app.js';",
]);
requireText('server/src/request-metrics.js', [
  'createRequestMetricsCollector',
  'averageDurationMs',
  'averageResponseBytes',
  'Economy request outlier',
  'Economy request metrics',
  "response.getHeader('Content-Length')",
  'DEFAULT_MAX_ROUTE_KEYS = 256',
  "OVERFLOW_ROUTE = '/api/other'",
  'overflowedRequestCount',
]);
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
  'reservedIncomingForBuyer',
  'activeCountForParticipant',
  'openCountForPublisher',
  'nextDeadlineAt',
]);
requireText('server/src/warehouse.js', [
  'createContractRuntimeIndex',
  'runtimeIndex.reservedContractIncomingForBuyer',
]);
requireText('server/src/contracts.js', [
  'processProductionContractsWithIndex',
  'runtimeIndex.reservedIncomingForBuyer',
  'runtimeIndex.activeCountForParticipant',
  'runtimeIndex.openCountForPublisher',
]);
requireText('server/src/runtime-store.js', [
  'contractProjectionForState',
  'cached.revision === snapshot.revision',
  'saveWorld(revision, world, now)',
  'saveWorldIfChanged(revision, world, now',
  'isDeepStrictEqual(world, cached.world)',
  'this.flushContractAuditEvents(world, revision, revision)',
  'this.updateWorld.run(nextRevision, stateJson, now)',
  'this.flushContractAuditEvents(world, revision, nextRevision)',
  'this.cacheWorld(nextRevision, stateJson, world)',
]);
const runtimeStore = read('server/src/runtime-store.js');
assert.ok(
  runtimeStore.indexOf('this.updateWorld.run(nextRevision, stateJson, now)')
    < runtimeStore.indexOf('this.flushContractAuditEvents(world, revision, nextRevision)')
    && runtimeStore.indexOf('this.flushContractAuditEvents(world, revision, nextRevision)')
      < runtimeStore.indexOf('this.cacheWorld(nextRevision, stateJson, world)'),
  '合同审计必须在世界写入后、运行时缓存推进前完成',
);
requireText('server/test/request-metrics.test.js', [
  'request metrics normalize route identifiers',
  'request metrics aggregate duration and application response bytes',
  'request metrics cap route cardinality and aggregate overflow',
]);
requireText('server/test/world-deadline-planner.test.js', [
  'zero world transactions during a 60 second idle window',
  'wakes at the planned event and processes one world transaction',
  'next integer release boundary',
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
  'contract runtime index matches the reference reservation scan for 2000 contracts',
  'contract runtime transitions release and acquire counts without rebuilding',
]);
requireText('server/test/state-polling.test.js', [
  'runtime failed actions keep the world row unchanged',
  'runtime state delivery reuses the current revision cache',
]);
requireText('docs/README.md', [
  '状态刷新设置继续只保存和显示 `3s`／`5s`／`10s`',
  '连续 30 秒无交互后临时使用 15 秒',
  '页面隐藏时临时使用 60 秒',
  '重新可见、网络恢复或从限速状态恢复交互时立即请求一次权威状态',
  '每 60 秒输出一次按方法与归一化路由聚合的请求指标',
  '平均／最大处理时长和应用层 JSON 响应字节数',
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
]);

console.log('运行时效率验证通过：自适应轮询、到期驱动调度、无变化动作不写世界、合同审计事务与缓存顺序、单一混合订单簿与合同线性索引、状态投影复用和有界请求指标均已锁定。');
