import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';

const lines = (items) => items.join('\n');

function replaceOnce(path, oldText, newText) {
  const source = readFileSync(path, 'utf8');
  if (!source.includes(oldText)) throw new Error(`${path}: target text not found`);
  const next = source.replace(oldText, newText);
  if (next === source) throw new Error(`${path}: replacement made no change`);
  writeFileSync(path, next);
}

replaceOnce(
  'server/src/market-demand.js',
  "  const signals = createMarketSignalRuntime({ marketFor, isOpenOrder });",
  "  const signals = createMarketSignalRuntime({ marketFor });",
);

replaceOnce(
  'server/src/market-demand.js',
  lines([
    '      const quote = signals.orderBookQuote(',
    '        world,',
    '        product,',
    '        requested,',
    '        Number(priceState?.referencePrice || product.basePrice),',
    '      );',
  ]),
  lines([
    '      const quote = signals.orderBookQuote(',
    '        world,',
    '        product,',
    '        requested,',
    '        Number(priceState?.referencePrice || product.basePrice),',
    '        DEFAULT_PROVINCE_ID,',
    '        now,',
    '      );',
  ]),
);

replaceOnce(
  'server/test/domain.test.js',
  lines([
    "test('consumer substitutes shift demand toward the cheaper grain without changing total budget', () => {",
    '  const world = createWorld(now);',
    '  ensurePlayer(world, bob, now);',
    '  world.priceTransmission.products.wheat.referencePrice = 6;',
    '  world.priceTransmission.products.rice.referencePrice = 2;',
    '',
    "  prepareDemand(world, 'food', now + 3);",
    '  processWorld(world, now + 3);',
    '  const shares = world.demandGroups.food.lastClassAllocation.basic.staples.shares;',
    '  assert.ok(shares.rice > shares.wheat);',
    '  assert.ok(world.demandGroups.food.lastBudget > 0);',
    '});',
  ]),
  lines([
    "test('consumer substitutes shift demand toward the cheaper grain without changing total budget', () => {",
    '  const world = createWorld(now);',
    '  ensurePlayer(world, bob, now);',
    '  world.markets.wheat.officialPrice = 3;',
    '  world.markets.rice.officialPrice = 0.6;',
    '',
    "  prepareDemand(world, 'food', now + 3);",
    '  processWorld(world, now + 3);',
    '  const shares = world.demandGroups.food.lastClassAllocation.basic.staples.shares;',
    '  assert.ok(shares.rice > shares.wheat);',
    '  assert.ok(world.demandGroups.food.lastBudget > 0);',
    "  assert.equal(world.orders.some((order) => order.ownerType === 'player' && ['open', 'partial'].includes(order.status)), false);",
    '});',
  ]),
);

replaceOnce(
  'server/test/domain.test.js',
  lines([
    "test('complement gating prioritizes the bottleneck input for electronics', () => {",
    '  const world = createWorld(now);',
    '  ensurePlayer(world, bob, now);',
    '  world.priceTransmission.products.plastic.referencePrice = 24;',
    '',
    "  prepareDemand(world, 'household', now + 2);",
    '  processWorld(world, now + 2);',
    '  const allocation = world.demandGroups.household.lastAllocation;',
    '  assert.ok(allocation.copper.requiredQuantity > allocation.plastic.requiredQuantity);',
    '  const relations = world.demandGroups.household.lastDerivedRelations',
    "    .filter((item) => item.outputProductId === 'electronics');",
    "  assert.ok(relations.find((item) => item.inputProductId === 'copper').complementGate",
    "    > relations.find((item) => item.inputProductId === 'plastic').complementGate);",
    '});',
  ]),
  lines([
    "test('complement gating prioritizes the bottleneck input for electronics', () => {",
    '  const world = createWorld(now);',
    '  const seller = ensurePlayer(world, bob, now);',
    '  seller.inventories.plastic.available = 1_000;',
    '  deferDemand(world);',
    "  assert.equal(applyAction(world, bob, 'placeOrder', {",
    "    productId: 'plastic', side: 'sell', quantity: 1_000, price: 24,",
    '  }, now + 1).ok, true);',
    "  assert.equal(world.orders.some((order) => order.ownerType === 'player' && ['open', 'partial'].includes(order.status)), false);",
    '',
    "  prepareDemand(world, 'household', now + 2);",
    '  processWorld(world, now + 2);',
    '  const allocation = world.demandGroups.household.lastAllocation;',
    '  assert.ok(allocation.copper.requiredQuantity > allocation.plastic.requiredQuantity);',
    '  const relations = world.demandGroups.household.lastDerivedRelations',
    "    .filter((item) => item.outputProductId === 'electronics');",
    "  assert.ok(relations.find((item) => item.inputProductId === 'copper').complementGate",
    "    > relations.find((item) => item.inputProductId === 'plastic').complementGate);",
    '});',
  ]),
);

const productModelParagraph = '市场需求模型版本：20。模型 19 的 38 种正式商品全部具有直接终端需求；燃料与化学品加入社会消费市场的能源／化工类别，同时继续通过 C2 正式作业制度产生派生需求。模型 18 升级到模型 19 时只重建人口消费与市场储备系统订单，玩家真实资金、库存、开放订单和成交历史保持不变。';
replaceOnce(
  'docs/PRODUCT_AND_GAMEPLAY_DESIGN.md',
  productModelParagraph,
  productModelParagraph + '\n\n玩家商品挂单退役后，人口替代份额、生产路线可得性和互补瓶颈不得再读取玩家开放卖单。玩家侧可执行价格信号统一读取同州当日 `officialPrice`；供给覆盖只统计最近 30 分钟真实玩家向官方系统完成的卖出数量，并按当前所需深度归一到 0～1。玩家从系统买入、人口／储备内部成交、合同交付和跨州运输都不计入这项供给覆盖；没有近期玩家卖出证据时覆盖率为 0，但人口内部订单仍按既有最低份额和互补门控继续运行。',
);

replaceOnce(
  'docs/INDUSTRY_AND_PRODUCTION_DESIGN.md',
  '- 同一输出商品的生产路线份额同时读取单位生产成本和各输入公开卖单覆盖率；理论便宜但无法获得原料的路线不得主导派生需求。',
  '- 同一输出商品的生产路线份额同时读取单位生产成本和各输入的内部可执行供给信号；价格读取同州当日 `officialPrice`，覆盖率只按最近 30 分钟真实玩家向官方系统完成的卖出数量相对当前所需深度计算。理论便宜但近期没有玩家供给证据的路线不得主导派生需求。',
);

const internalOrdersParagraph = '市场需求模型仍可在服务器内部维护人口消费、派生需求和市场储备订单，用于预算、需求满足、储备资产与价格传导等模拟。内部订单必须携带 `provinceId`，不同州不得互相撮合或共享资金。';
replaceOnce(
  'docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md',
  internalOrdersParagraph,
  internalOrdersParagraph + '\n\n玩家挂单退役后，内部需求规划不得再扫描玩家开放卖单生成价格或覆盖率。可执行价格读取同州当前 `officialPrice`；供给覆盖只统计最近 30 分钟真实玩家向官方系统完成的卖出数量，并按所需深度归一到 0～1。玩家买入、人口／储备内部成交、合同和运输不计入这项玩家侧供给覆盖。该信号只服务人口替代份额、生产路线可得性、互补瓶颈和需求压力，不是公开盘口，也不得创建玩家挂单。',
);

replaceOnce(
  'scripts/verify-staple-crops-demand.mjs',
  lines([
    "for (const forbidden of ['DEMAND_INVENTORY_BOOST_RATE', 'stockSnapshot.totalValue', 'inventoryFactor', 'playerScaleBudget * tradeActivityFactor', 'totalPopulationBaseBudget']) {",
    "  assert.equal(runtime.includes(forbidden), false, '人口需求不得恢复库存或活跃玩家增发预算: ' + forbidden);",
    '}',
  ]),
  lines([
    "for (const forbidden of ['DEMAND_INVENTORY_BOOST_RATE', 'stockSnapshot.totalValue', 'inventoryFactor', 'playerScaleBudget * tradeActivityFactor', 'totalPopulationBaseBudget']) {",
    "  assert.equal(runtime.includes(forbidden), false, '人口需求不得恢复库存或活跃玩家增发预算: ' + forbidden);",
    '}',
    "const marketSignalSource = read('server/src/market-demand/signals.js');",
    "for (const text of ['playerSellQuantity', 'market?.officialPrice', 'available / targetDepth']) {",
    "  assert.ok(marketSignalSource.includes(text), '人口需求即时市场信号缺少: ' + text);",
    '}',
    "assert.equal(marketSignalSource.includes('iterateOrderBookSide'), false, '人口需求即时市场信号不得扫描玩家开放卖单');",
    "assert.equal(marketSignalSource.includes('recordOrderBookVisit'), false, '人口需求即时市场信号不得伪装成盘口访问');",
  ]),
);

let stapleVerifier = readFileSync('scripts/verify-staple-crops-demand.mjs', 'utf8');
const docsAnchor = "for (const [path, texts] of [\n  ['docs/PRODUCT_AND_GAMEPLAY_DESIGN.md',";
if (!stapleVerifier.includes(docsAnchor)) throw new Error('verify-staple-crops-demand.mjs: docs anchor missing');
const docChecks = lines([
  "for (const [path, texts] of [",
  "  ['docs/PRODUCT_AND_GAMEPLAY_DESIGN.md', ['最近 30 分钟真实玩家向官方系统完成的卖出数量', '同州当日 `officialPrice`']],",
  "  ['docs/INDUSTRY_AND_PRODUCTION_DESIGN.md', ['内部可执行供给信号', '最近 30 分钟真实玩家向官方系统完成的卖出数量', '同州当日 `officialPrice`']],",
  "  ['docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md', ['内部需求规划不得再扫描玩家开放卖单', '最近 30 分钟真实玩家向官方系统完成的卖出数量', '同州当前 `officialPrice`']],",
  "]) {",
  "  const source = read(path);",
  "  for (const text of texts) assert.ok(source.includes(text), `${path} 缺少即时市场人口需求规则: ${text}`);",
  '}',
  '',
]);
stapleVerifier = stapleVerifier.replace(docsAnchor, docChecks + docsAnchor);
const marketDemandTestAnchor = "const marketDemandTests = read('server/test/market-demand-v6.test.js');";
if (!stapleVerifier.includes(marketDemandTestAnchor)) throw new Error('verify-staple-crops-demand.mjs: market test anchor missing');
const domainChecks = lines([
  "const domainDemandTests = read('server/test/domain.test.js');",
  "for (const text of [",
  "  'consumer substitutes shift demand toward the cheaper grain without changing total budget',",
  "  'complement gating prioritizes the bottleneck input for electronics',",
  "]) assert.ok(domainDemandTests.includes(text), '人口需求即时市场回归缺少: ' + text);",
  '',
]);
stapleVerifier = stapleVerifier.replace(marketDemandTestAnchor, domainChecks + marketDemandTestAnchor);
writeFileSync('scripts/verify-staple-crops-demand.mjs', stapleVerifier);

replaceOnce(
  'scripts/verify-runtime-efficiency.mjs',
  lines([
    "requireText('server/src/market-demand/signals.js', [",
    "  'beginPlanningCache',",
    "  'endPlanningCache',",
    "  'planningCache = {',",
    "  'tradeStats: new Map()',",
    "  'quotes: new Map()',",
    ']);',
  ]),
  lines([
    "requireText('server/src/market-demand/signals.js', [",
    "  'beginPlanningCache',",
    "  'endPlanningCache',",
    "  'planningCache = {',",
    "  'tradeStats: new Map()',",
    "  'quotes: new Map()',",
    "  'playerSellQuantity',",
    "  'market?.officialPrice',",
    "  'available / targetDepth',",
    ']);',
    "const demandSignalSource = read('server/src/market-demand/signals.js');",
    "assert.equal(demandSignalSource.includes('iterateOrderBookSide'), false, '玩家挂单退役后人口需求信号不得扫描订单簿');",
    "assert.equal(demandSignalSource.includes('recordOrderBookVisit'), false, '人口需求即时市场信号不得增加订单簿访问计数');",
  ]),
);

for (const temp of [
  'scripts/codex-finalize-demand-signal-migration.mjs',
  'scripts/codex-finalize-demand-signal-migration-v2.mjs',
  '.github/workflows/codex-finalize-demand-signal-migration.yml',
]) {
  if (existsSync(temp)) unlinkSync(temp);
}
