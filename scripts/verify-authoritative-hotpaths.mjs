import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const required = [
  'server/src/world-deadline-runtime.js',
  'server/src/economic-mutation.js',
  'server/src/runtime-action-executor.js',
  'server/src/runtime-store.js',
  'server/src/order-book-runtime.js',
  'server/src/order-matching.js',
  'src/app/stateDelivery.js',
  'src/app/stateDelivery.d.ts',
  'src/app/gameAuthorityStore.ts',
  'src/app/gameViewModel.ts',
  'server/test/authoritative-hotpaths.test.js',
  'server/test/order-book-price-level.test.js',
  'docs/README.md',
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

const runtimeStore = read('server/src/runtime-store.js');
for (const text of [
  "from './world-deadline-runtime.js'",
  'deadlineRuntime: worldDeadlineRuntimeFor(this).getDiagnostics()',
  "if (options.force && !explicitForceDomains && currentUserId !== undefined)",
  'const dueDomains = new Set(dueWorldDeadlineDomains(plan, now));',
  "if (dueDomains.has('bank'))",
  "if (dueDomains.has('research'))",
  "if (dueDomains.has('contract'))",
  'assertEconomicStateInvariants(world)',
  'return executeRuntimeAction(this, user, requestMeta, now)',
]) assert.ok(runtimeStore.includes(text), `运行时存储缺少权威热路径规则: ${text}`);

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
  'boundary.rollback()',
  'boundary.assert()',
  'savepoint.release()',
  'store.insertIdempotency.run(',
]) assert.ok(actionExecutor.includes(text), `普通经济动作执行器缺少: ${text}`);

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

const stateDelivery = read('src/app/stateDelivery.js');
for (const text of [
  'authorityListeners',
  'export function getStateAuthoritySnapshot',
  'export function getStateAuthorityPartition',
  'export function subscribeStateAuthority',
  'publishAuthority(revision, state, partitions, changedPartitions)',
]) assert.ok(stateDelivery.includes(text), `客户端权威状态交付缺少: ${text}`);
const authorityStore = read('src/app/gameAuthorityStore.ts');
for (const text of [
  "useSyncExternalStore",
  'useGameAuthorityState',
  'useGameAuthorityRevision',
  'useGameAuthorityPartition',
]) assert.ok(authorityStore.includes(text), `客户端权威订阅缺少: ${text}`);
const viewModel = read('src/app/gameViewModel.ts');
assert.ok(viewModel.includes('const authorityGame = useGameAuthorityState();'), '大型视图模型必须读取独立权威状态存储');
assert.equal(viewModel.includes('const [game, setGame] = useState<EconomyState | null>'), false, '视图模型不得重新持有第二份 EconomyState React 状态');

const design = read('docs/README.md');
for (const text of [
  '价格档位 + 同价 FIFO',
  '按实际到期领域推进',
  'SQLite `SAVEPOINT`',
  '`useSyncExternalStore`',
]) assert.ok(design.includes(text), `设计索引缺少权威热路径规则: ${text}`);

console.log('权威热路径验证通过：按领域截止时间推进、经济动作保存点回滚、价格档位撮合和客户端六分区订阅均受防回退约束。');
