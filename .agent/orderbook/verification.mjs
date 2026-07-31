import { replaceExact } from './helpers.mjs';

replaceExact(
  'scripts/verify-runtime-efficiency.mjs',
  "requireText('server/src/order-book-runtime.js', [\n  'getOrderBookSide',\n  'getOwnerOrderBookSide',\n  'pendingCommodityBuyQuantityForOwner',\n  'facilitySellQuantityForOwner',\n  'tailAppends',\n]);",
  "requireText('server/src/order-book-runtime.js', [\n  'getOrderBookSide',\n  'getOwnerOrderBookSide',\n  'pendingCommodityBuyQuantityForOwner',\n  'facilitySellQuantityForOwner',\n  'tailAppends',\n  'function finalizeRuntimeBooks(state)',\n  'openOrders: new WeakSet()',\n  'recordOrderBookReduction',\n  'closeOrderInOrderBook',\n  'orderById',\n]);\nconst orderBookRuntime = read('server/src/order-book-runtime.js');\nfor (const forbidden of ['playerBooks', 'systemBooks', 'playerOrdersByAsset', 'systemOrdersByAsset']) {\n  assert.equal(orderBookRuntime.includes(forbidden), false, `统一订单簿不得分离玩家／系统盘口: ${forbidden}`);\n}\nconst orderBookBuild = orderBookRuntime.slice(\n  orderBookRuntime.indexOf('function buildRuntime(world)'),\n  orderBookRuntime.indexOf('function runtimeFor(world)'),\n);\nassert.equal(orderBookBuild.includes('insertSorted('), false, '订单簿全量构建不得逐单二分插入');\nrequireText('server/src/domain-core.js', [\n  'const retainedClosed = new Set(recentClosed.slice(-800))',\n  'isOpenOrder(order) || retainedClosed.has(order)',\n  'orderById(world, payload.orderId)',\n]);\nassert.equal(read('server/src/domain-core.js').includes('.slice(-4_000)'), false, '历史上限不得删除未完成订单');\nrequireText('server/src/domain.js', [\n  'if (retainedOrders.length !== migratedOrders.length) migrated.orders = retainedOrders;',\n]);\nrequireText('server/src/facility-groups.js', [\n  'const hasSystemFacilityOrder = orders.some',\n  'if (!hasSystemFacilityOrder) return world;',\n  'orderById(world, payload.orderId)',\n]);\nrequireText('server/src/market-demand/state.js', [\n  'const missingPlayers = Object.entries(world.players).filter',\n  'if (missingPlayers.length === 0) return;',\n]);",
);

replaceExact(
  'scripts/verify-runtime-efficiency.mjs',
  "requireText('server/test/order-book-runtime.test.js', [\n  'runtime order book preserves price-time-array priority for 4000 orders',\n  'runtime order book tracks tail appends and rebuilds after array replacement',\n  'repeated matching reuses one runtime index',\n]);",
  "requireText('server/test/order-book-runtime.test.js', [\n  'runtime order book preserves price-time-array priority for 4000 orders',\n  'runtime order book tracks tail appends and rebuilds after array replacement',\n  'repeated matching reuses one runtime index',\n  'runtime index excludes closed history from active books',\n  'runtime owner aggregates follow fills and explicit cancellation',\n]);\nrequireText('server/test/order-book-pruning.test.js', [\n  'world pruning keeps the order array reference when no history is removed',\n  'world pruning never removes open orders and only keeps 800 recent closed orders',\n  'legacy system facility cleanup preserves the array when there is nothing to remove',\n]);",
);

replaceExact(
  'scripts/verify-runtime-efficiency.mjs',
  "  '统一订单簿运行时索引只属于服务器事务内派生状态',",
  "  '统一订单簿运行时索引只属于服务器事务内派生状态',\n  '统一订单簿运行时性能属于订单簿与服务器共同规则',\n  '单一混合盘口，不得按玩家／系统拆分盘口',\n  '历史剪枝只限制已关闭订单为最近 800 笔',",
);

replaceExact(
  'scripts/verify-runtime-efficiency.mjs',
  "console.log('运行时效率验证通过：自适应轮询、到期驱动调度、无变化动作不写世界、合同审计事务与缓存顺序、订单簿与合同线性索引、状态投影复用和有界请求指标均已锁定。');",
  "requireText('docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md', [\n  '统一混合盘口',\n  '先单次遍历未完成订单完成分组',\n  '不得因历史保存上限删除任何未完成订单',\n]);\nrequireText('docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md', [\n  '统一订单簿运行时容量边界',\n  '不得按玩家订单与系统订单拆分第二套盘口',\n  '订单历史最多保留最近 800 笔未过期关闭订单',\n]);\n\nconsole.log('运行时效率验证通过：自适应轮询、到期驱动调度、无变化动作不写世界、合同审计事务与缓存顺序、单一混合订单簿与合同线性索引、状态投影复用和有界请求指标均已锁定。');",
);

replaceExact(
  'scripts/verify-order-matching-core.mjs',
  "\nconsole.log('共享撮合内核验证通过：商品与工厂复用有界订单簿索引、价格时间优先、maker price、部分成交、fill 和手续费状态机。');",
  "\n\nfor (const text of [\n  'function finalizeRuntimeBooks(state)',\n  'openOrders: new WeakSet()',\n  'recordOrderBookReduction',\n  'closeOrderInOrderBook',\n  'orderById',\n]) assert.ok(runtime.includes(text), `订单簿索引优化缺少: ${text}`);\nfor (const forbidden of ['playerBooks', 'systemBooks', 'playerOrdersByAsset', 'systemOrdersByAsset']) {\n  assert.equal(runtime.includes(forbidden), false, `统一订单簿不得分离玩家／系统盘口: ${forbidden}`);\n}\nconst runtimeBuild = runtime.slice(runtime.indexOf('function buildRuntime(world)'), runtime.indexOf('function runtimeFor(world)'));\nassert.equal(runtimeBuild.includes('insertSorted('), false, '订单簿全量构建不得逐单二分插入');\nfor (const text of ['统一混合盘口', '先单次遍历未完成订单完成分组', '不得因历史保存上限删除任何未完成订单']) {\n  assert.ok(design.includes(text), `统一订单簿设计缺少运行时边界: ${text}`);\n}\n\nconsole.log('共享撮合内核验证通过：商品与工厂复用单一混合盘口、分组排序索引、价格时间优先、maker price、部分成交、fill 和手续费状态机。');",
);
