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
assert.equal(MARKET_DEMAND_MODEL_VERSION, 2);
assert.deepEqual(MARKET_DEMAND_GROUP_CATALOG.map((group) => group.id), ['food', 'household']);
assert.deepEqual(MARKET_DEMAND_GROUP_CATALOG.map((group) => group.ownerName), ['食品市场需求', '家庭消费市场需求']);
assert.deepEqual(MARKET_DEMAND_GROUP_CATALOG.map((group) => group.baseBudget), [3_000, 2_700]);
assert.ok(MARKET_DEMAND_GROUP_CATALOG.every((group) => group.directBudgetShare === 0.85));

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
  'server/src/market-demand/catalog.js',
  'server/src/market-demand/math.js',
  'server/src/market-demand/signals.js',
  'server/src/market-demand/state.js',
  'server/src/market-demand/price-transmission.js',
  'server/src/market-demand/allocation.js',
].map(read).join('\n');
for (const text of [
  'MARKET_DEMAND_MODEL_VERSION = 2',
  'DIRECT_BUDGET_SHARE = 0.85',
  "id: 'fresh-drinks'",
  "productId: 'fruit'",
  "productId: 'appliance'",
  'RELATION_LAG_WEIGHTS',
  'ACTIVE_PLAYER_WINDOW_MS',
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
  assert.equal(runtime.includes(forbidden), false, '市场需求不得恢复库存增发逻辑: ' + forbidden);
}

const domain = read('server/src/domain.js');
for (const text of [
  'buildMarketDemandMetadata',
  'reachableGroups',
  'MARKET_DEMAND_MODEL_VERSION',
  'marketDemand.initializeWorld',
  'marketDemand.normalizeWorld',
  'marketDemand.process',
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
  'market demand model version 1 migrates to version 2 without resetting player assets',
]) assert.ok(domainTests.includes(text), '领域测试缺少: ' + text);
const transmissionTests = read('server/test/demand-transmission.test.js');
for (const text of [
  'hybrid fruit prices respond to beverage value after one relation lag',
  'appliance value makes machinery an automatically derived chain product',
]) assert.ok(transmissionTests.includes(text), '价格传导测试缺少: ' + text);

for (const [path, texts] of [
  ['README.md', ['市场需求模型版本：`2`', '水果', '家电', '库存数量和库存价值不得扩大市场需求总预算']],
  ['docs/PRODUCT_AND_GAMEPLAY_DESIGN.md', ['marketDemand.modelVersion = 2', '新鲜与饮品', '混合消费输入品', '新增商品和工厂不得自动提高']],
  ['docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md', ['市场需求模型版本：2', '兼容标识']],
]) {
  const content = read(path);
  for (const text of texts) assert.ok(content.includes(text), path + ' 缺少: ' + text);
}

console.log('市场需求验证通过：模型 2 在固定总预算内支持水果直接需求、饮料路线替代、多输入互补和图驱动价格角色。');
