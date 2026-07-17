import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DEMAND_GROUP_CATALOG, FACILITY_TYPE_CATALOG, PRODUCT_CATALOG } from '../server/src/domain.js';

const read = (path) => readFileSync(path, 'utf8');
const products = new Map(PRODUCT_CATALOG.map((product) => [product.id, product]));
assert.equal(PRODUCT_CATALOG.length, 22);
assert.equal(products.has('grain'), false);
for (const id of ['wheat', 'rice', 'food', 'meat', 'eggs', 'milk']) {
  assert.equal(products.get(id)?.substitutionGroupId, 'staples', `${id} 必须加入 staples`);
  assert.equal(products.get(id)?.systemDemandMode, 'grouped', `${id} 不得生成独立人口需求`);
}
for (const id of ['cotton', 'wool', 'copper-ore', 'copper', 'textile']) {
  assert.equal(products.get(id)?.systemDemandMode, 'none', `${id} 只能保留基础流动性`);
}

const staples = DEMAND_GROUP_CATALOG.find((group) => group.id === 'staples');
assert.ok(staples);
assert.equal(staples.baseBudget, 330);
assert.equal(staples.referenceUtilityPrice, 6);
assert.equal(staples.priceElasticity, 3);
assert.equal(staples.maxPriceIndex, 2);
assert.equal(staples.quoteUtilityDepth, 12);
assert.deepEqual(staples.products.map((item) => item.productId), ['wheat', 'rice', 'food', 'meat', 'eggs', 'milk']);
assert.deepEqual(staples.products.map((item) => item.utilityPerUnit), [1, 1, 3, 2, 1, 1]);
assert.deepEqual(staples.products.map((item) => item.preferenceWeight), [1, 1, 8, 4, 3, 3]);
assert.deepEqual(staples.products.map((item) => item.maxBudgetShare), [0.4, 0.4, 0.55, 0.35, 0.25, 0.25]);

const household = DEMAND_GROUP_CATALOG.find((group) => group.id === 'household-goods');
assert.ok(household);
assert.equal(household.baseBudget, 320);
assert.deepEqual(household.products.map((item) => item.productId), ['furniture', 'clothing']);

const facilities = new Map(FACILITY_TYPE_CATALOG.map((facility) => [facility.id, facility]));
assert.deepEqual(facilities.get('farm').recipes.map((recipe) => recipe.id), ['wheat-crop', 'rice-crop', 'cotton-crop']);
assert.deepEqual(facilities.get('ranch').recipes.map((recipe) => recipe.id), ['ranch-meat', 'ranch-eggs', 'ranch-milk', 'ranch-wool']);
for (const recipe of facilities.get('farm').recipes) {
  assert.equal(recipe.cycleMs, 120_000);
  assert.equal(recipe.operatingCost, 6);
  assert.equal(recipe.output.quantity, 4);
}

const domain = read('server/src/domain.js');
for (const text of [
  'GROUPED_DEMAND_PRODUCT_IDS', 'systemDemandMode', 'referenceUtilityPrice', 'quoteUtilityDepth',
  'utilityPerUnit', 'maxBudgetShare', 'effectivePrice', 'requestedUtility', 'filledUtility',
  'withLegacyDemandSuppressed', 'expireDemandGroupOrders', 'demandCycleId', 'previousVersion < 9',
]) assert.ok(domain.includes(text), `domain.js 缺少: ${text}`);
const balanced = read('server/src/balanced-market.js');
assert.ok(balanced.includes("product.systemDemandMode !== 'single'"));
const groups = read('server/src/facility-groups.js');
for (const text of ['recipeInputs', 'requirements.inputs', 'world.version = 9', 'version: 13']) {
  assert.ok(groups.includes(text), `facility-groups.js 缺少: ${text}`);
}

const tests = `${read('server/test/domain.test.js')}\n${read('server/test/facility-groups.test.js')}`;
for (const text of [
  'staple demand shifts budget to rice when wheat is expensive',
  'staple demand leaves budget unspent when every substitute is above the ceiling',
  'electronics factory atomically consumes plastic and copper',
  'electronics factory deducts no material when either input is missing',
]) assert.ok(tests.includes(text), `测试缺少: ${text}`);

for (const [path, texts] of [
  ['README.md', ['食品、小麦、水稻、肉、蛋和奶共享', '每 5 分钟最多 330', '同时消耗塑料和铜材']],
  ['docs/PRODUCT_AND_GAMEPLAY_DESIGN.md', ['食品、小麦、水稻、肉、蛋和奶', '单品预算上限分别为', '`systemDemandMode` 为 `none`', '`household-goods`']],
  ['docs/INDUSTRY_AND_PRODUCTION_DESIGN.md', ['无原料 → 4 棉花', '无原料 → 3 肉', '1 塑料 + 1 铜材 → 1 电子产品']],
]) {
  const content = read(path);
  for (const text of texts) assert.ok(content.includes(text), `${path} 缺少: ${text}`);
}

console.log('饮食需求验证通过：六种商品共享 330 预算，上游商品不独立增发，家具与服装共享需求。');
