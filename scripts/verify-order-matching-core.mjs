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
  assert.equal(commodity.includes(forbidden), false, `商品内部模拟残留重复撮合逻辑: ${forbidden}`);
}
for (const forbidden of ['function executeFacilityTrade(', 'function sortCandidates(', 'function appendPlayerOrderFill(']) {
  assert.equal(facility.includes(forbidden), false, `工厂历史兼容模块残留重复撮合逻辑: ${forbidden}`);
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
  assert.ok(runtime.includes(text), `内部订单运行时索引缺少: ${text}`);
}
const tests = read('server/test/order-matching.test.js');
for (const text of ['price-time priority', 'maker price', 'partial fills', 'same-player', 'system orders']) {
  assert.ok(tests.includes(text), `共享撮合测试缺少: ${text}`);
}
const runtimeTests = read('server/test/order-book-runtime.test.js');
for (const text of ['4000 orders', 'tail appends', 'repeated matching reuses one runtime index']) {
  assert.ok(runtimeTests.includes(text), `内部订单索引测试缺少: ${text}`);
}
const priceLevelTests = read('server/test/order-book-price-level.test.js');
for (const text of ['50000 open orders', 'explicit close removes an order', 'visits only crossing price-level nodes']) {
  assert.ok(priceLevelTests.includes(text), `价格档位内部索引测试缺少: ${text}`);
}
const design = read('docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md');
for (const text of [
  '服务器内部人口与储备订单',
  '内部人口／储备订单不是玩家商品交易入口',
  '普通玩家页面不得展示内部订单',
  '玩家商品交易不得创建 `open`／`partial` 商品订单',
]) {
  assert.ok(design.includes(text), `商品即时市场设计缺少内部撮合边界: ${text}`);
}

for (const text of [
  'function finalizeRuntimeBooks(state)',
  'openOrders: new WeakSet()',
  'recordOrderBookReduction',
  'closeOrderInOrderBook',
  'orderById',
]) assert.ok(runtime.includes(text), `内部订单索引优化缺少: ${text}`);
for (const forbidden of ['playerBooks', 'systemBooks', 'playerOrdersByAsset', 'systemOrdersByAsset', 'compactClosedOrders']) {
  assert.equal(runtime.includes(forbidden), false, `内部订单索引不得恢复旧扫描结构: ${forbidden}`);
}
const runtimeBuild = runtime.slice(runtime.indexOf('function buildRuntime(world)'), runtime.indexOf('function runtimeFor(world)'));
assert.equal(runtimeBuild.includes('insertSorted('), false, '内部订单全量构建不得逐单二分插入');

const marketPage = read('src/pages/MarketPage.tsx');
assert.equal(marketPage.includes('orderBook.bids'), false, '玩家市场页面不得把内部订单索引恢复成买盘。');
assert.equal(marketPage.includes('orderBook.asks'), false, '玩家市场页面不得把内部订单索引恢复成卖盘。');

console.log('共享撮合内核验证通过：共享内核继续服务服务器内部模拟与历史兼容；玩家商品交易保持每日系统价即时成交且不暴露盘口。');
