import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const required = [
  'server/src/world-deadline-runtime.js',
  'server/src/economic-mutation.js',
  'server/src/runtime-action-executor.js',
  'server/src/runtime-store.js',
  'server/src/runtime-store-core.js',
  'server/src/world-storage-v2.js',
  'server/src/player-action-registry.js',
  'server/src/authoritative-write-executor.js',
  'server/src/order-book-runtime.js',
  'server/src/order-matching.js',
  'server/shared/economy-state-slices.js',
  'src/app/stateDelivery.js',
  'src/app/stateDelivery.d.ts',
  'src/app/gameAuthorityStore.ts',
  'src/app/clientOrderIndex.ts',
  'src/app/gameViewModel.ts',
  'src/pages/PageRouter.tsx',
  'server/test/authoritative-hotpaths.test.js',
  'server/test/runtime-hotpath-architecture.test.js',
  'server/test/order-book-price-level.test.js',
  'docs/README.md',
  'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md',
  'docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md',
];
for (const path of required) assert.ok(existsSync(path), `缺少权威热路径文件: ${path}`);

const deadline = read('server/src/world-deadline-runtime.js');
for (const text of [
  'export function dueWorldDeadlineDomains',
  'export class WorldDeadlineRuntime',
  'worldDeadlineRuntimeFor',
  'deadline !== null',
  'cacheHits',
]) assert.ok(deadline.includes(text), `截止时间运行时缺少: ${text}`);

const runtimeWrapper = read('server/src/runtime-store.js');
const runtimeStore = `${read('server/src/runtime-store-core.js')}\n${runtimeWrapper}`;
for (const text of [
  "from './world-deadline-runtime.js'",
  'deadlineRuntime: worldDeadlineRuntimeFor(this).getDiagnostics()',
  "if (options.force && !explicitForceDomains && currentUserId !== undefined)",
  'const dueDomains = new Set(dueWorldDeadlineDomains(plan, now));',
  "if (dueDomains.has('bank'))",
  "if (dueDomains.has('research'))",
  "if (dueDomains.has('contract'))",
  'assertEconomicStateInvariants(world)',
  'worldDraftCowMs',
  'worldDraftCloneMs',
  'createVersionedClientState',
  'const world = this.worldCache.world',
  'ensureScheduledProcessingBarrier',
  'schedulerBarrierWaitMs',
]) assert.ok(runtimeStore.includes(text), `运行时存储缺少权威热路径规则: ${text}`);
for (const text of [
  'return executeRuntimeAction(this, user, requestMeta, now)',
  'cloneWorldForMutation',
  'worldDraftCowMs',
  'settledSynchronously',
  'captureRequestContext: false',
]) assert.ok(runtimeWrapper.includes(text), `正式运行时编排层缺少: ${text}`);
for (const text of [
  'committedWorldForCache(world)',
  'stateProjectionCacheIsolationDepth',
  'worldCacheIsolationCloneMs',
  'contractProjectionForState',
  'JSON.parse(this.worldCache.stateJson)',
  'isDeepStrictEqual(world, cached.world)',
]) assert.equal(runtimeStore.includes(text), false, `正式状态读取和 V2 热保存不得恢复旧完整世界路径: ${text}`);

const worldStorage = read('server/src/world-storage-v2.js');
const actionRegistry = read('server/src/player-action-registry.js');
for (const text of [
  'WORLD_STORAGE_SCHEMA_VERSION = 2',
  'createRuntimeMutationScope',
  'cloneWorldForMutation',
  'prepareSegmentedWorldWrite',
  'applySegmentedWorldWrite',
  'getPlayerActionMetadata(action)',
  'requireOrderExecutionMetadata(execution)',
  "? 'commodity:placeOrder'",
]) assert.ok(worldStorage.includes(text), `分段世界存储缺少: ${text}`);
for (const text of [
  "placeOrder: defineAction({ rateLimitCategory: 'orders', mutationScope: 'order'",
  "cancelOrder: defineAction({ rateLimitCategory: 'orders', mutationScope: 'order'",
  'ORDER_EXECUTION_REGISTRY',
]) assert.ok(actionRegistry.includes(text), `玩家动作注册表缺少订单热路径规则: ${text}`);
for (const forbidden of ['isDeepStrictEqual(world, cached.world)', 'JSON.parse(this.worldCache.stateJson)']) {
  assert.equal(runtimeStore.includes(forbidden), false, `V2 运行时不得恢复旧完整世界热路径: ${forbidden}`);
}

const mutation = read('server/src/economic-mutation.js');
for (const text of [
  'export function assertEconomicStateInvariants',
  'export function createEconomicActionBoundary',
  'export function beginEconomicSavepoint',
  'SAVEPOINT',
  'ROLLBACK TO SAVEPOINT',
]) assert.ok(mutation.includes(text), `经济动作边界缺少: ${text}`);

const actionExecutor = read('server/src/runtime-action-executor.js');
for (const text of [
  "beginEconomicSavepoint(store, 'economy_player_action')",
  'assertEconomicStateInvariantsScoped(world, mutationScope)',
  'structuredClone(world.players?.[String(user.id)]',
  'CONTRACT_ACTIONS',
  'applyProductionContractAction',
  'processProductionContracts',
  'contractsBeforeAction',
  'applySettledCommodityOrder',
  'if (!store.scheduledProcessing)',
  'savepoint.release()',
  'store.insertIdempotency.run(',
  'createActionAcknowledgement(gameResult, revision)',
]) assert.ok(actionExecutor.includes(text), `普通经济动作执行器缺少: ${text}`);
assert.equal(actionExecutor.includes('createEconomicActionBoundary'), false, '正式玩家动作不得恢复第二份全世界回滚快照');

const writeExecutor = read('server/src/authoritative-write-executor.js');
for (const text of [
  'captureRequestContext = true',
  'captureRequestContext ? requestPerformanceContext() : null',
]) assert.ok(writeExecutor.includes(text), `权威写执行器缺少调度上下文隔离: ${text}`);

const orderBook = read('server/src/order-book-runtime.js');
for (const text of [
  'levels: new Map()',
  'sortedPrices: []',
  'nodesByOrder: new WeakMap()',
  'export function iterateOrderBookSide',
  'export function getOrderBookDepth',
]) assert.ok(orderBook.includes(text), `价格档位订单簿缺少: ${text}`);
assert.equal(orderBook.includes('compactClosedOrders'), false, '订单簿热路径不得恢复整侧关闭订单压缩扫描');
const matching = read('server/src/order-matching.js');
assert.ok(matching.includes('iterateOrderBookSide'), '撮合必须流式遍历价格档位订单');
assert.equal(matching.includes('getOrderBookSide'), false, '撮合不得重新物化完整盘口侧数组');

const stateSlices = read('server/shared/economy-state-slices.js');
for (const text of [
  "'player.assets'",
  "'player.production'",
  "'market.orders'",
  "'market.quotes'",
  'stateSliceNameForKey',
]) assert.ok(stateSlices.includes(text), `客户端状态子切片缺少: ${text}`);

const stateDelivery = read('src/app/stateDelivery.js');
for (const text of [
  'authorityListeners',
  'partitionAuthorityListeners',
  'sliceAuthorityListeners',
  'export function getStateAuthoritySnapshot',
  'export function getStateAuthorityPartition',
  'export function subscribeStateAuthority',
  'export function subscribeStateAuthorityPartition',
  'export function subscribeStateAuthorityDependencies',
  'reuseUnchangedSliceReferences',
  'notifyPartitionListeners',
  'notifySliceListeners',
]) assert.ok(stateDelivery.includes(text), `客户端权威状态交付缺少: ${text}`);
const authorityStore = read('src/app/gameAuthorityStore.ts');
for (const text of [
  'useSyncExternalStore',
  'useAuthorityRenderSnapshot',
  'readGameAuthorityState',
  'useGameAuthorityState',
  'useGameAuthorityDependencies',
  'useGameAuthorityRevision',
  'useGameAuthorityPartition',
  'getStateAuthoritySliceRevision',
]) assert.ok(authorityStore.includes(text), `客户端权威订阅缺少: ${text}`);
const rootAuthorityHook = authorityStore.match(/export function useGameAuthorityState\(\)[\s\S]*?\n}\n/)?.[0] || '';
assert.ok(rootAuthorityHook.includes('useAuthorityRenderSnapshot'), '根权威 hook 必须通过 render 快照读取已接受状态');
assert.equal(rootAuthorityHook.includes('AUTHORITY_STATE_VIEW'), false, '根权威 hook 不得重新返回会被 reset 撕裂的实时 Proxy');
const viewModel = read('src/app/gameViewModel.ts');
assert.ok(viewModel.includes('const authorityGame = useGameAuthorityState();'), '根游戏控制器必须读取单次 render 一致的权威状态快照');
assert.equal(viewModel.includes('const [game, setGame] = useState<EconomyState | null>'), false, '视图模型不得重新持有第二份 EconomyState React 状态');
const pageRouter = read('src/pages/PageRouter.tsx');
for (const text of [
  'PAGE_AUTHORITY_DEPENDENCIES',
  'AuthorityPageBoundary',
  'useGameAuthorityDependencies(dependencies);',
  "'player.assets'",
  "'player.production'",
  "'market.orders'",
  "'market.quotes'",
]) assert.ok(pageRouter.includes(text), `页面子切片消费边界缺少: ${text}`);
const clientOrderIndex = read('src/app/clientOrderIndex.ts');
for (const text of [
  'orderById',
  'ownOpenOrders',
  'openOrdersByAsset',
  'commodityPriceExtrema',
]) assert.ok(clientOrderIndex.includes(text), `客户端订单热路径索引缺少: ${text}`);

const docsIndex = read('docs/README.md');
assert.ok(docsIndex.includes('`SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md`'), '设计索引必须路由服务器权威热路径');
assert.ok(docsIndex.includes('`UNIFIED_ASSET_ORDER_BOOK_DESIGN.md`'), '设计索引必须路由订单簿热路径');

const serverDesign = read('docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md');
for (const text of [
  '玩家 V2 持久化行不得保存仅用于旧客户端展示的',
  '失败动作、重复操作或其他无业务状态变化的动作',
  '不得仅因兼容规范化、空数组补全',
  '合同历史冷启动导入必须优先读取 V2 分段世界',
]) assert.ok(serverDesign.includes(text), `服务器设计缺少 V2 持久化防回退规则: ${text}`);

const orderBookDesign = read('docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md');
for (const text of [
  '内部人口／储备订单继续复用共享撮合内核',
  '价格档位 FIFO 状态机',
  '玩家即时商品交易不得经过该共享撮合内核',
  '具体索引构建、分组方式和裁剪阈值属于运行实现，由代码与专项测试锁定',
]) {
  assert.ok(orderBookDesign.includes(text), `即时市场设计缺少内部热路径边界: ${text}`);
}

console.log('权威热路径验证通过：按领域截止时间推进、分段存储 V2、Copy-on-Write 动作草稿、Dirty Row 持久化、纯只读状态投影、内部订单运行时索引与六分区客户端权威状态均受防回退约束。');
