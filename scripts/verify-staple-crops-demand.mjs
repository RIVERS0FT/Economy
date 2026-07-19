import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  FACILITY_TYPE_CATALOG,
  MARKET_DEMAND_GROUP_CATALOG,
  MARKET_DEMAND_PRODUCT_IDS,
  PRODUCT_CATALOG,
} from '../server/src/domain.js';

const read = (path) => readFileSync(path, 'utf8');
const products = new Map(PRODUCT_CATALOG.map((product) => [product.id, product]));
assert.equal(PRODUCT_CATALOG.length, 22);
assert.deepEqual(MARKET_DEMAND_GROUP_CATALOG.map((group) => group.id), ['food', 'household']);
assert.deepEqual(MARKET_DEMAND_GROUP_CATALOG.map((group) => group.ownerName), ['食品市场需求', '家庭消费市场需求']);
assert.deepEqual(MARKET_DEMAND_GROUP_CATALOG.map((group) => group.baseBudget), [1_000, 900]);
assert.ok(MARKET_DEMAND_GROUP_CATALOG.every((group) => group.directBudgetShare === 0.85));
assert.ok(MARKET_DEMAND_GROUP_CATALOG.every((group) => group.classes.length > 0));

for (const id of ['wheat', 'rice', 'flour', 'food', 'meat', 'eggs', 'milk']) {
  assert.equal(products.get(id)?.marketDemandGroupId, 'food', id);
  assert.equal(products.get(id)?.marketDemandRole, 'direct', id);
}
for (const id of ['furniture', 'clothing', 'electronics']) {
  assert.equal(products.get(id)?.marketDemandGroupId, 'household', id);
  assert.equal(products.get(id)?.marketDemandRole, 'direct', id);
}
for (const id of ['timber', 'cotton', 'wool', 'copper-ore', 'crude-oil', 'lumber', 'textile', 'copper', 'plastic']) {
  assert.equal(products.get(id)?.marketDemandGroupId, 'household', id);
  assert.equal(products.get(id)?.marketDemandRole, 'derived-liquidity', id);
}
for (const id of ['ore', 'steel', 'machinery']) assert.equal(products.get(id)?.marketDemandGroupId, undefined, id);
assert.ok(MARKET_DEMAND_PRODUCT_IDS.includes('electronics'));
assert.equal(MARKET_DEMAND_PRODUCT_IDS.includes('copper'), false);

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
  'DIRECT_BUDGET_SHARE = 0.85',
  'RELATION_LAG_WEIGHTS',
  'ACTIVE_PLAYER_WINDOW_MS',
  'lastInventoryBoost: 0',
  'lastStockValue: 0',
  'smoothShares',
  'recipeSharesFor',
  'complementGate',
  'derivedRequirements',
  'previousDemandQuantities',
  'demandPressureAnchor',
  'processPriceTransmission',
  'ownerName: \'食品市场需求\'',
  'ownerName: \'家庭消费市场需求\'',
]) assert.ok(runtime.includes(text), 'market-demand.js 缺少: ' + text);
for (const forbidden of ['DEMAND_INVENTORY_BOOST_RATE', 'stockSnapshot.totalValue', 'inventoryFactor']) {
  assert.equal(runtime.includes(forbidden), false, '市场需求不得恢复库存增发逻辑: ' + forbidden);
}

const domain = read('server/src/domain.js');
for (const text of [
  "import {\n  createMarketDemandRuntime",
  'marketDemand.initializeWorld',
  'marketDemand.normalizeWorld',
  'marketDemand.process',
  'marketDemand.isValidMarketOrder',
  'world.version = 13',
]) assert.ok(domain.includes(text), 'domain.js 缺少: ' + text);

const facilities = new Map(FACILITY_TYPE_CATALOG.map((facility) => [facility.id, facility]));
assert.deepEqual(facilities.get('textile-mill').recipes.map((recipe) => recipe.inputs), [
  [{ productId: 'cotton', quantity: 6 }],
  [{ productId: 'wool', quantity: 2 }],
]);
assert.deepEqual(facilities.get('electronics-factory').recipes[0].inputs, [
  { productId: 'plastic', quantity: 1 }, { productId: 'copper', quantity: 1 },
]);

const tests = read('server/test/domain.test.js');
for (const text of [
  'player inventory never increases market demand budget or product allocation',
  'consumer substitutes shift demand toward the cheaper grain without changing total budget',
  'complement gating prioritizes the bottleneck input for electronics',
  'downstream price signals move upstream only after relation lag cycles',
  'legacy demand migration immediately rebuilds market demand without losing player assets',
]) assert.ok(tests.includes(text), '测试缺少: ' + text);

for (const [path, texts] of [
  ['README.md', ['市场需求', '替代关系', '互补关系', '派生流动性']],
  ['docs/PRODUCT_AND_GAMEPLAY_DESIGN.md', ['市场需求模型', '库存不得扩大市场需求总预算', '85%', '15%', '替代弹性']],
  ['docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md', ['市场需求订单', 'ownerType: \'population\'', '兼容标识']],
]) {
  const content = read(path);
  for (const text of texts) assert.ok(content.includes(text), path + ' 缺少: ' + text);
}

console.log('市场需求验证通过：预算不读取库存，直接需求与派生流动性共享总预算，并支持替代、互补与逐边滞后传导。');
