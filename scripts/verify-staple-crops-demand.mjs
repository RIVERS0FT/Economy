import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import {
  DEMAND_GROUP_CATALOG,
  FACILITY_TYPE_CATALOG,
  PRODUCT_CATALOG,
} from '../server/src/domain.js';

const read = (path) => readFileSync(path, 'utf8');
const productIds = new Set(PRODUCT_CATALOG.map((product) => product.id));

assert.equal(PRODUCT_CATALOG.length, 13, '本轮不得改变 13 种商品目录');
assert.equal(productIds.has('grain'), false, 'grain 不得继续作为正式商品');
for (const id of ['wheat', 'rice', 'food']) assert.equal(productIds.has(id), true, `饮食竞争缺少商品: ${id}`);
assert.equal(PRODUCT_CATALOG.find((product) => product.id === 'food')?.substitutionGroupId, 'staples');

const staples = DEMAND_GROUP_CATALOG.find((group) => group.id === 'staples');
assert.ok(staples, '缺少人口饮食需求组');
assert.equal(staples.name, '人口饮食需求');
assert.equal(staples.ownerName, '人口饮食需求');
assert.equal(staples.baseBudget, 330);
assert.equal(staples.referenceUtilityPrice, 6);
assert.equal(staples.priceElasticity, 3);
assert.equal(staples.maxPriceIndex, 2);
assert.equal(staples.quoteUtilityDepth, 12);
assert.deepEqual(staples.products.map((item) => item.productId), ['wheat', 'rice', 'food']);
assert.deepEqual(staples.products.map((item) => item.utilityPerUnit), [1, 1, 3]);
assert.deepEqual(staples.products.map((item) => item.preferenceWeight), [1, 1, 8]);
assert.deepEqual(staples.products.map((item) => item.maxBudgetShare), [0.5, 0.5, 0.8]);

const farm = FACILITY_TYPE_CATALOG.find((facility) => facility.id === 'farm');
assert.ok(farm, '缺少农场');
assert.equal(farm.defaultRecipeId, 'wheat-crop');
assert.deepEqual(farm.recipes.map((recipe) => recipe.id), ['wheat-crop', 'rice-crop']);
for (const recipe of farm.recipes) {
  assert.equal(recipe.cycleMs, 45_000, `${recipe.id} 周期必须为 45 秒`);
  assert.equal(recipe.operatingCost, 2, `${recipe.id} 单座周期成本必须为 2`);
  assert.equal(recipe.output.quantity, 4, `${recipe.id} 单座周期产量必须为 4`);
}

assert.equal(existsSync('server/src/domain-core.js'), true, '缺少兼容核心 domain-core.js');
const domain = read('server/src/domain.js');
const domainCore = read('server/src/domain-core.js');
for (const text of [
  "import * as core from './domain-core.js'",
  'GROUPED_DEMAND_PRODUCT_IDS',
  'referenceUtilityPrice',
  'quoteUtilityDepth',
  'utilityPerUnit',
  'maxBudgetShare',
  'effectivePrice',
  'requestedUtility',
  'filledUtility',
  'withLegacyDemandSuppressed',
  'expireDemandGroupOrders',
  'demandCycleId',
]) assert.equal(domain.includes(text), true, `domain.js 缺少: ${text}`);
assert.equal(domainCore.includes('baseBudget: 60'), true, '兼容核心应保持迁移前实现，当前规则由 domain.js 门面覆盖');
for (const path of ['server/src/storage.js', 'server/src/facility-groups.js']) {
  assert.equal(read(path).includes('domain-core.js'), false, `${path} 不得绕过 domain.js 权威门面`);
}

const groups = read('server/src/facility-groups.js');
for (const text of ['activeRecipeId', 'pendingRecipeId', 'applyPendingRecipe', 'setGroupRecipe', 'world.version = 8']) {
  assert.equal(groups.includes(text), true, `facility-groups.js 缺少: ${text}`);
}

const productionPage = read('src/pages/ProductionPage.tsx');
for (const forbidden of ['ProductionMode', 'pendingProductionPlan', 'productionMode', 'targetQuantity']) {
  assert.equal(productionPage.includes(forbidden), false, `生产页不得包含 ${forbidden}`);
}
assert.equal(productionPage.includes('生产配方'), true);
assert.equal(productionPage.includes('固定配方：'), true);
assert.equal(productionPage.includes('下一周期切换为：'), true);

const tests = `${read('server/test/domain.test.js')}\n${read('server/test/facility-groups.test.js')}`;
for (const text of [
  'world version 7 grain assets migrate entirely to wheat',
  'staple demand shifts budget to rice when wheat is expensive',
  'food competes with wheat and rice through utility-adjusted prices and capped budget shares',
  'food demand yields to grains when its utility-adjusted price exceeds the ceiling',
  'running farm crop changes apply at the next cycle boundary',
]) assert.equal(tests.includes(text), true, `测试缺少: ${text}`);

for (const [path, required] of [
  ['README.md', ['13 种商品和 12 种工厂类型', '食品、小麦和水稻共享', '每 5 分钟最多 330', '45 秒', '单座产量 4']],
  ['docs/PRODUCT_AND_GAMEPLAY_DESIGN.md', ['人口饮食替代需求', '消费效用', '食品最多获得 80%', '满足率按效用计算']],
  ['docs/INDUSTRY_AND_PRODUCTION_DESIGN.md', ['4 小麦或 4 水稻', '45 秒', '单座成本', '矿场和钢铁厂本轮保持不变']],
  ['docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md', ['`domain.js` 是当前权威门面', '`domain-core.js`', '不得绕过 `domain.js`']],
]) {
  const content = read(path);
  for (const text of required) assert.equal(content.includes(text), true, `${path} 缺少: ${text}`);
}

console.log('食品、小麦、水稻效用竞争、330 预算上限、农场 45 秒/4/2 参数和 domain 权威门面验证通过。');
