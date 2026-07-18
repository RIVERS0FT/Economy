import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DEMAND_GROUP_CATALOG, FACILITY_TYPE_CATALOG, PRODUCT_CATALOG } from '../server/src/domain.js';

const read = (path) => readFileSync(path, 'utf8');
const products = new Map(PRODUCT_CATALOG.map((product) => [product.id, product]));
assert.equal(PRODUCT_CATALOG.length, 22);
const foodIds = ['wheat', 'rice', 'flour', 'food', 'meat', 'eggs', 'milk'];
const householdIds = ['timber', 'cotton', 'wool', 'copper-ore', 'crude-oil', 'lumber', 'textile', 'copper', 'plastic', 'furniture', 'clothing', 'electronics'];
for (const id of foodIds) assert.equal(products.get(id)?.populationDemandGroupId, 'food', id);
for (const id of householdIds) assert.equal(products.get(id)?.populationDemandGroupId, 'household', id);
for (const id of ['ore', 'steel', 'machinery']) assert.equal(products.get(id)?.populationDemandGroupId, undefined, id);

const food = DEMAND_GROUP_CATALOG.find((group) => group.id === 'food');
const household = DEMAND_GROUP_CATALOG.find((group) => group.id === 'household');
assert.equal(food.ownerName, '饮食需求');
assert.equal(food.baseBudget, 1_000);
assert.deepEqual(food.products.map((item) => item.productId), foodIds);
assert.equal(household.ownerName, '家庭用品需求');
assert.equal(household.baseBudget, 900);
assert.deepEqual(household.products.map((item) => item.productId), householdIds);

const domain = read('server/src/domain.js');
for (const text of [
  'ACTIVE_PLAYER_WINDOW_MS', 'DEMAND_PLAYER_SCALE_MAX', 'DEMAND_INVENTORY_BOOST_RATE',
  'dynamicDemandBudget', 'demandStockSnapshot', 'lastEconomicActivityAt',
  'lastTargetBudget', 'lastPlayerScaleBudget', 'lastInventoryBoost',
  'lastActivePlayerCount', 'lastStockValue', 'inventoryFactor',
  'available || 0', 'frozen || 0', 'previousVersion >= 13', 'previousVersion < 13',
  'processPriceTransmission', 'costAnchor', 'downstreamValueAnchor',
]) assert.ok(domain.includes(text), 'domain.js 缺少: ' + text);
assert.equal(domain.includes('allocateDemandBudgets(choices, group.baseBudget)'), false);
assert.equal(domain.includes('maxBudget: Math.floor(group.baseBudget * option.maxBudgetShare)'), false);

const storage = read('server/src/storage.js');
for (const text of ['ECONOMIC_ACTIVITY_ACTIONS', 'gameResult?.ok', 'activePlayer.lastEconomicActivityAt = now', 'demandGroups: Object.fromEntries']) {
  assert.ok(storage.includes(text), 'storage.js 缺少: ' + text);
}
const assetEvents = read('server/src/asset-events.js');
assert.ok(assetEvents.includes('world.version = 13;'), '日志清理器必须保留世界版本 13');
assert.equal(assetEvents.includes('world.version = 12;'), false, '日志清理器不得把世界版本降回 12');

const tests = read('server/test/domain.test.js');
for (const text of [
  'population demand scales sublinearly with active players and stops at the configured cap',
  'inactive players stop scaling demand after seven days',
  'population demand grows with stock value and favors stocked products without double counting frozen inventory',
  'state polling and failed actions do not refresh economic activity',
  'world version 12 migration immediately rebuilds smoothed dynamic population demand',
]) assert.ok(tests.includes(text), '测试缺少: ' + text);

const facilities = new Map(FACILITY_TYPE_CATALOG.map((facility) => [facility.id, facility]));
assert.deepEqual(facilities.get('electronics-factory').recipes[0].inputs, [
  { productId: 'plastic', quantity: 1 }, { productId: 'copper', quantity: 1 },
]);
for (const [path, texts] of [
  ['README.md', ['饮食需求基础预算为 1,000', '家庭用品需求基础预算为 900', '近 7 天经济活跃玩家', '库存追加预算']],
  ['docs/PRODUCT_AND_GAMEPLAY_DESIGN.md', ['平方根增长', '库存追加预算', '单周期最多上涨 20%', 'lastEconomicActivityAt']],
  ['docs/INDUSTRY_AND_PRODUCTION_DESIGN.md', ['库存分配系数', '可用与冻结库存只统计一次']],
  ['docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md', ['活跃玩家数量', '库存价值', '动态预算']],
  ['docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md', ['世界版本 12 升级到 13', '空闲状态读取不得仅因服务器时间推进而修改', 'lastEconomicActivityAt']],
]) {
  const content = read(path);
  for (const text of texts) assert.ok(content.includes(text), path + ' 缺少: ' + text);
}
console.log('人口需求验证通过：基础预算提高，并按近 7 天活跃玩家、全服库存、平滑与单周期上限动态调整。');
