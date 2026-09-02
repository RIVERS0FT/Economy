import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8');
const requiredFiles = [
  'server/src/order-matching.js',
  'server/src/order-book-runtime.js',
  'server/src/balanced-market.js',
  'server/src/facility-groups.js',
  'server/test/order-matching.test.js',
  'server/test/order-book-runtime.test.js',
  'server/test/order-book-price-level.test.js',
  'docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md',
  'docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md',
];
for (const path of requiredFiles) assert.ok(existsSync(path), `缺少共享撮合文件: ${path}`);

const core = read('server/src/order-matching.js');
for (const text of [
  'export function matchIncomingOrder',
  'export function compareRestingOrders',
  'export function orderPricesCross',
  "import { applyMarketSellFee } from './market-sell-fee.js'",
  "import { isOpenOrder, orderAssetId, orderKind, orderProvinceId } from './order-identity.js'",
  "import { iterateOrderBookSide, recordOrderBookReduction, recordOrderBookVisit } from './order-book-runtime.js'",
  'multiplyMoneyByInteger',
  "throw new RangeError('成交总额超出系统可表示范围')",
  'makerOrderId: resting.id',
  'takerOrderId: incoming.id',
  "order.status = order.remaining === 0 ? 'filled' : 'partial'",
  'samePlayer(incoming, resting)',
  'if (!orderPricesCross(incoming.side, incoming.price, resting.price)) break;',
]) assert.ok(core.includes(text), `共享撮合内核缺少: ${text}`);
for (const forbidden of ['PRODUCT_CATALOG', 'FACILITY_TYPE_CATALOG', 'inventoryFor(', 'groupFor(', '(world.orders || []).filter', '.sort(', 'roundInternalMoney(quantity * price)']) {
  assert.equal(core.includes(forbidden), false, `共享撮合内核不得绑定资产业务: ${forbidden}`);
}

for (const path of ['server/src/balanced-market.js', 'server/src/facility-groups.js']) {
  const source = read(path);
  assert.ok(source.includes("import { matchIncomingOrder } from './order-matching.js'"), `${path} 未接入共享撮合内核`);
  assert.ok(source.includes('matchIncomingOrder({'), `${path} 未调用共享撮合内核`);
}
const commodity = read('server/src/balanced-market.js');
const facility = read('server/src/facility-groups.js');
for (const forbidden of ['function executeTrade(', 'function appendFill(']) {
  assert.equal(commodity.includes(forbidden), false, `商品模块残留重复撮合逻辑: ${forbidden}`);
}
for (const forbidden of ['function executeFacilityTrade(', 'function sortCandidates(', 'function appendPlayerOrderFill(']) {
  assert.equal(facility.includes(forbidden), false, `工厂模块残留重复撮合逻辑: ${forbidden}`);
}

const runtime = read('server/src/order-book-runtime.js');
for (const text of [
  'getOrderBookSide',
  'iterateOrderBookSide',
  'getOwnerOrderBookSide',
  'getOrderBookDepth',
  'tailAppends',
  'pendingCommodityBuyQuantityForOwner',
  'facilitySellQuantityForOwner',
  'levels: new Map()',
  'sortedPrices: []',
  'nodesByOrder: new WeakMap()',
]) {
  assert.ok(runtime.includes(text), `订单簿运行时索引缺少: ${text}`);
}
const tests = read('server/test/order-matching.test.js');
for (const text of ['price-time priority', 'maker price', 'partial fills', 'same-player', 'system orders']) {
  assert.ok(tests.includes(text), `共享撮合测试缺少: ${text}`);
}
const runtimeTests = read('server/test/order-book-runtime.test.js');
for (const text of ['4000 orders', 'tail appends', 'repeated matching reuses one runtime index']) {
  assert.ok(runtimeTests.includes(text), `订单簿索引测试缺少: ${text}`);
}
const priceLevelTests = read('server/test/order-book-price-level.test.js');
for (const text of ['50000 open orders', 'explicit close removes an order', 'visits only crossing price-level nodes']) {
  assert.ok(priceLevelTests.includes(text), `价格档位订单簿测试缺少: ${text}`);
}
const design = read('docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md');
for (const text of ['共享撮合内核', '`server/src/order-matching.js`', '唯一撮合状态机', '不得各自重新实现', '`order-book-runtime.js`', '不得各自重新对完整 `world.orders` 过滤排序']) {
  assert.ok(design.includes(text), `统一订单簿设计缺少: ${text}`);
}
// 共享撮合实现路径由上面的源码、调用方与单元测试直接验证；
// SERVER DESIGN 只保留服务器领域边界，不复制模块文件目录。

for (const text of [
  'function finalizeRuntimeBooks(state)',
  'openOrders: new WeakSet()',
  'recordOrderBookReduction',
  'closeOrderInOrderBook',
  'orderById',
]) assert.ok(runtime.includes(text), `订单簿索引优化缺少: ${text}`);
for (const forbidden of ['playerBooks', 'systemBooks', 'playerOrdersByAsset', 'systemOrdersByAsset', 'compactClosedOrders']) {
  assert.equal(runtime.includes(forbidden), false, `统一订单簿不得恢复旧扫描结构: ${forbidden}`);
}
const runtimeBuild = runtime.slice(runtime.indexOf('function buildRuntime(world)'), runtime.indexOf('function runtimeFor(world)'));
assert.equal(runtimeBuild.includes('insertSorted('), false, '订单簿全量构建不得逐单二分插入');
for (const text of ['统一混合盘口', '先单次遍历未完成订单完成分组', '不得因历史保存上限删除任何未完成订单']) {
  assert.ok(design.includes(text), `统一订单簿设计缺少运行时边界: ${text}`);
}

console.log('共享撮合内核验证通过：商品与工厂复用单一混合盘口、价格档位 FIFO 运行时索引、流式价格时间优先撮合、maker price、部分成交、fill 和手续费状态机。');
