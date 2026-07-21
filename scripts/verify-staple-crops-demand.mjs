import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  FACILITY_TYPE_CATALOG,
  MARKET_DEMAND_GROUP_CATALOG,
  MARKET_DEMAND_MODEL_VERSION,
  MARKET_DEMAND_PRODUCT_IDS,
  PRODUCT_CATALOG,
} from '../server/src/domain.js';

const read = (path) => readFileSync(path, 'utf8');
const products = new Map(PRODUCT_CATALOG.map((product) => [product.id, product]));
assert.equal(PRODUCT_CATALOG.length, 31);
assert.equal(MARKET_DEMAND_MODEL_VERSION, 6);
assert.deepEqual(MARKET_DEMAND_GROUP_CATALOG.map((group) => group.id), ['food', 'household']);
assert.deepEqual(MARKET_DEMAND_GROUP_CATALOG.map((group) => group.ownerName), ['食品市场需求', '家庭消费市场需求']);
assert.deepEqual(MARKET_DEMAND_GROUP_CATALOG.map((group) => group.baseBudget), [3_000, 2_700]);
assert.ok(MARKET_DEMAND_GROUP_CATALOG.every((group) => group.directBudgetShare === 0.70));

const groups = new Map(MARKET_DEMAND_GROUP_CATALOG.map((group) => [group.id, group]));
assert.deepEqual(groups.get('food').classes.map((item) => item.id), ['staples', 'protein', 'fresh-drinks', 'convenience']);
assert.deepEqual(groups.get('household').classes.map((item) => item.id), ['home', 'wear', 'daily', 'durables']);
assert.ok(groups.get('food').classes.find((item) => item.id === 'fresh-drinks').products.some((item) => item.productId === 'fruit'));
assert.ok(groups.get('household').classes.find((item) => item.id === 'durables').products.some((item) => item.productId === 'appliance'));

for (const id of ['wheat', 'rice', 'flour', 'food', 'meat', 'eggs', 'milk', 'fruit', 'fish', 'beverage', 'prepared-meal']) {
  assert.equal(products.get(id)?.marketDemandGroupId, 'food', id);
  assert.equal(products.get(id)?.marketDemandRole, 'direct', id);
}
for (const id of ['furniture', 'clothing', 'electronics', 'paper', 'appliance']) {
  assert.equal(products.get(id)?.marketDemandGroupId, 'household', id);
  assert.equal(products.get(id)?.marketDemandRole, 'direct', id);
}
for (const id of ['sugarcane', 'sugar']) {
  assert.equal(products.get(id)?.marketDemandGroupId, 'food', id);
  assert.equal(products.get(id)?.marketDemandRole, 'derived-liquidity', id);
}
for (const id of ['timber', 'cotton', 'wool', 'ore', 'copper-ore', 'crude-oil', 'lumber', 'steel', 'textile', 'copper', 'plastic', 'pulp', 'machinery']) {
  assert.equal(products.get(id)?.marketDemandGroupId, 'household', id);
  assert.equal(products.get(id)?.marketDemandRole, 'derived-liquidity', id);
}
assert.ok(MARKET_DEMAND_PRODUCT_IDS.includes('fruit'));
assert.ok(MARKET_DEMAND_PRODUCT_IDS.includes('appliance'));
assert.equal(MARKET_DEMAND_PRODUCT_IDS.includes('sugar'), false);

const runtime = [
  'server/src/market-demand.js',
  'server/src/market-liquidity.js',
  'server/src/market-demand/catalog.js',
  'server/src/market-demand/math.js',
  'server/src/market-demand/signals.js',
  'server/src/market-demand/state.js',
  'server/src/market-demand/price-transmission.js',
  'server/src/market-demand/allocation.js',
  'server/src/balanced-market.js',
  'server/src/order-matching.js',
  'server/src/order-book-integrity.js',
].map(read).join('\n');
for (const text of [
  'MARKET_DEMAND_MODEL_VERSION = 6',
  'DIRECT_BUDGET_SHARE = 0.70',
  'LIQUIDITY_BASE_SPREAD = 0.08',
  'LIQUIDITY_MIN_SPREAD = 0.04',
  'LIQUIDITY_MAX_SPREAD = 0.24',
  'LIQUIDITY_QUOTE_BUDGET_SHARE = 0.25',
  'LIQUIDITY_SIGNAL_WEIGHT = 0.50',
  "LIQUIDITY_BUY = 'liquidity-buy'",
  "LIQUIDITY_SELL = 'liquidity-sell'",
  'seeded: wasSeeded || seedNow',
  'rebuildSeededState',
  'groupState.frozenCredits += reservedCredits',
  'reserve.frozenInventory += sellQuantity',
  "resting.ownerType === 'population' && incoming.ownerType === 'population'",
  'settleLiquidityBuy',
  'settleLiquiditySell',
  'signalWeight',
  'bestSystemPrice',
  'systemBookIsCrossed',
  "id: 'fresh-drinks'",
  "productId: 'fruit'",
  "productId: 'appliance'",
  'RELATION_LAG_WEIGHTS',
  'ACTIVE_PLAYER_WINDOW_MS',
  'SYSTEM_ORDER_RETENTION_RATE',
  'DEMAND_CURVE',
  'PRODUCT_ORDER_VALUE_CYCLES',
  'PRODUCT_PRESSURE_SMOOTHING',
  'DERIVED_UNMET_WEIGHT',
  'marketRole',
  'playerValue',
  'lastCycleSettlement',
  'lastClassShares',
  'SYSTEM_ORDER_VALUE_CYCLES',
  'lastInventoryBoost: 0',
  'lastStockValue: 0',
  'smoothShares',
  'recipeSharesFor',
  'complementGate',
  'derivedRequirements',
  'previousDemandQuantities',
  'productRoles',
  'hasDownstreamRecipe',
  'hasProducingRecipe',
  'processPriceTransmission',
]) assert.ok(runtime.includes(text), '市场需求实现缺少: ' + text);
for (const forbidden of ['DEMAND_INVENTORY_BOOST_RATE', 'stockSnapshot.totalValue', 'inventoryFactor']) {
  assert.equal(runtime.includes(forbidden), false, '消费需求不得恢复库存增发逻辑: ' + forbidden);
}

const domain = read('server/src/domain.js');
for (const text of [
  'buildMarketDemandMetadata',
  'reachableGroups',
  'MARKET_DEMAND_MODEL_VERSION',
  'marketDemand.initializeWorld',
  'marketDemand.normalizeWorld',
  'marketDemand.process',
  'applyCommodityOrder',
  'balancedMarket.matchOrder(world, incoming, now)',
  'reconcileCommodityOrderBook',
  'world.version = 13',
]) assert.ok(domain.includes(text), 'domain.js 缺少: ' + text);

const facilities = new Map(FACILITY_TYPE_CATALOG.map((facility) => [facility.id, facility]));
assert.deepEqual(facilities.get('beverage-factory').recipes.map((recipe) => recipe.inputs), [
  [{ productId: 'sugar', quantity: 1 }, { productId: 'milk', quantity: 1 }],
  [{ productId: 'fruit', quantity: 2 }, { productId: 'sugar', quantity: 1 }],
]);
assert.deepEqual(facilities.get('appliance-factory').recipes[0].inputs, [
  { productId: 'machinery', quantity: 1 }, { productId: 'electronics', quantity: 1 },
]);

const domainTests = read('server/test/domain.test.js');
for (const text of [
  'player inventory never increases market demand budget or product allocation',
  'beverage production paths shift toward cheaper fruit inputs',
  'fruit participates in fresh direct demand without expanding the food budget',
]) assert.ok(domainTests.includes(text), '领域测试缺少: ' + text);
const liquidityTests = read('server/test/market-liquidity.test.js');
for (const text of [
  'market model 6 creates inventory-backed buy and sell orders without system self-trades',
  'system liquidity asks reprice above retained consumption bids instead of crossing',
  'selling to a reserve transfers reserve funds and does not count as consumption issuance',
  'buying from a reserve transfers real inventory and returns credits to the reserve',
  'liquidity orders are cancelled and re-reserved on the next cycle',
  'model 3 migrates directly to model 6 with one-time reserve seeding',
  'model 5 migrates to model 6 and releases obsolete liquidity reservations',
]) assert.ok(liquidityTests.includes(text), '储备测试缺少: ' + text);
const v6Tests = read('server/test/market-demand-v6.test.js');
for (const text of [
  'market model 6 settles fills that happen after demand orders are created',
  'market model 6 stops issuing new consumption budget when no player is active',
  'player-only activity excludes consumption and reserve trades from budget activity',
]) assert.ok(v6Tests.includes(text), 'V6 测试缺少: ' + text);
const transmissionTests = read('server/test/demand-transmission.test.js');
for (const text of [
  'hybrid fruit prices respond to beverage value after one relation lag',
  'appliance value makes machinery an automatically derived chain product',
]) assert.ok(transmissionTests.includes(text), '价格传导测试缺少: ' + text);

for (const [path, texts] of [
  ['README.md', ['市场需求模型版本：`6`', '市场储备每 5 分钟撤销并重挂双边商品订单', '真实资金和库存同时生成商品买单与卖单', '最高系统买价严格低于最低系统卖价']],
  ['docs/PRODUCT_AND_GAMEPLAY_DESIGN.md', ['市场需求模型版本：6', 'marketDemand.modelVersion = 6', '双边市场储备', '一次性种子资金', '所有系统订单互相禁止成交', '从模型 5 升级到模型 6']],
  ['docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md', ['市场需求模型版本：6', 'liquidity-buy', 'liquidity-sell', '真实储备可用资金', '任何系统订单之间都不得成交', '最高系统买价 < 最低系统卖价']],
  ['docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md', ['market-liquidity.js', '市场需求模型 3 升级到 4', '重复补发储备资产']],
]) {
  const content = read(path);
  for (const text of texts) assert.ok(content.includes(text), path + ' 缺少: ' + text);
}

console.log('市场需求验证通过：模型 6 使用周期末结算、玩家成交活跃度、三档需求曲线、双向压力和资产守恒市场储备。');
