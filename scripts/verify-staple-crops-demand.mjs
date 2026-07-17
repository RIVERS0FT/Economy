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
assert.ok(PRODUCT_CATALOG.every((product) => !Object.hasOwn(product, 'systemDemandMode')));

const food = DEMAND_GROUP_CATALOG.find((group) => group.id === 'food');
const household = DEMAND_GROUP_CATALOG.find((group) => group.id === 'household');
assert.equal(food.ownerName, '饮食需求');
assert.equal(food.baseBudget, 330);
assert.deepEqual(food.products.map((item) => item.productId), foodIds);
assert.equal(household.ownerName, '家庭用品需求');
assert.equal(household.baseBudget, 320);
assert.deepEqual(household.products.map((item) => item.productId), householdIds);

const domain = read('server/src/domain.js');
for (const text of [
  'processPriceTransmission', 'realTradeStats', 'costAnchor', 'downstreamValueAnchor',
  'geometricWeightedMean', 'PRICE_MAX_RISE_PER_CYCLE', 'PRICE_MAX_FALL_PER_CYCLE',
  "ownerName: '饮食需求'", "ownerName: '家庭用品需求'", 'previousVersion >= 11', 'previousVersion < 11', 'nextDemandAt: now',
]) assert.ok(domain.includes(text), 'domain.js 缺少: ' + text);
const assetEvents = read('server/src/asset-events.js');
assert.ok(assetEvents.includes('world.version = 11;'), '日志清理器必须保留世界版本 11');
assert.equal(assetEvents.includes('world.version = 9;'), false, '日志清理器不得把世界版本降回 9');
const balanced = read('server/src/balanced-market.js');
for (const forbidden of ['市场流动采购', '市场流动供给', '企业采购', "ownerType: 'market'"]) {
  assert.equal(balanced.includes(forbidden), false, forbidden);
}
const tests = read('server/test/demand-transmission.test.js');
for (const text of [
  'upstream cost changes propagate downstream one production edge per cycle',
  'downstream value changes propagate upstream one production edge per cycle',
  'multi-input downstream value reaches both copper and plastic with lag',
  'price transmission is damped and also carries price decreases',
]) assert.ok(tests.includes(text), '测试缺少: ' + text);
const domainTests = read('server/test/domain.test.js');
for (const text of [
  'new worlds create population demand during the first authoritative state read',
  'world version 10 migration immediately rebuilds current-cycle population demand',
]) assert.ok(domainTests.includes(text), '需求启动测试缺少: ' + text);
const facilities = new Map(FACILITY_TYPE_CATALOG.map((facility) => [facility.id, facility]));
assert.deepEqual(facilities.get('electronics-factory').recipes[0].inputs, [
  { productId: 'plastic', quantity: 1 }, { productId: 'copper', quantity: 1 },
]);
for (const [path, texts] of [
  ['README.md', ['仅允许玩家订单和人口需求订单', '饮食需求', '家庭用品需求', '双向价格传导', '立即生成当前周期人口买单']],
  ['docs/PRODUCT_AND_GAMEPLAY_DESIGN.md', ['成本推动', '需求拉动', '上一周期快照', '固定预算', '首次权威状态处理']],
  ['docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md', ["ownerType: 'player' | 'population'", '不提供系统流动性买单或卖单', '同一事务立即生成当前周期人口买单']],
  ['docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md', ['世界版本 10 升级到 11', '不得把世界版本写回旧值']],
]) {
  const content = read(path);
  for (const text of texts) assert.ok(content.includes(text), path + ' 缺少: ' + text);
}
console.log('人口需求验证通过：仅保留两类固定预算需求，并按生产链双向滞后传导价格。');
