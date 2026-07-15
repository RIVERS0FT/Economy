import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  DEMAND_GROUP_CATALOG,
  FACILITY_TYPE_CATALOG,
  PRODUCT_CATALOG,
} from '../server/src/domain.js';

const read = (path) => readFileSync(path, 'utf8');
const productIds = new Set(PRODUCT_CATALOG.map((product) => product.id));
assert.equal(PRODUCT_CATALOG.length, 13);
assert.equal(productIds.has('grain'), false, 'grain 不得继续作为正式商品');
assert.equal(productIds.has('wheat'), true);
assert.equal(productIds.has('rice'), true);

const staples = DEMAND_GROUP_CATALOG.find((group) => group.id === 'staples');
assert.ok(staples, '缺少主食需求组');
assert.equal(staples.baseBudget, 60);
assert.equal(staples.priceElasticity, 3);
assert.equal(staples.maxPriceIndex, 2);
assert.deepEqual(staples.products.map((item) => item.productId), ['wheat', 'rice']);

const farm = FACILITY_TYPE_CATALOG.find((facility) => facility.id === 'farm');
assert.ok(farm, '缺少农场');
assert.equal(farm.defaultRecipeId, 'wheat-crop');
assert.deepEqual(farm.recipes.map((recipe) => recipe.id), ['wheat-crop', 'rice-crop']);

const domain = read('server/src/domain.js');
for (const text of [
  'createGroupedDemand',
  'demandQuote',
  'priceIndex ** -group.priceElasticity',
  'expireDemandGroupOrders',
  'demandCycleId',
  "if (world.markets.grain)",
  "delete player.inventories.grain",
]) assert.equal(domain.includes(text), true, `domain.js 缺少: ${text}`);

const groups = read('server/src/facility-groups.js');
for (const text of [
  'activeRecipeId',
  'pendingRecipeId',
  'applyPendingRecipe',
  'setGroupRecipe',
  'group.lifetimeOutput += requirements.output',
  'world.version = 8',
]) assert.equal(groups.includes(text), true, `facility-groups.js 缺少: ${text}`);

const index = read('server/src/index.js');
assert.equal(index.includes('(start|pause|stop|list|recipe)'), true);
assert.equal(index.includes("sendError(response, 410, '生产计划已移除，工厂开启后仅持续生产')"), true);

const types = read('src/types.ts');
const productionPage = read('src/pages/ProductionPage.tsx');
const gameApi = read('src/api/game.ts');
for (const forbidden of ['ProductionMode', 'pendingProductionPlan', 'productionMode', 'targetQuantity']) {
  assert.equal(types.includes(forbidden), false, `客户端类型不得包含 ${forbidden}`);
  assert.equal(productionPage.includes(forbidden), false, `生产页不得包含 ${forbidden}`);
}
assert.equal(productionPage.includes('种植作物'), true);
assert.equal(productionPage.includes('下一周期改为'), true);
assert.equal(gameApi.includes('setFacilityRecipe'), true);
assert.equal(gameApi.includes('setProductionPlan'), false);

const tests = `${read('server/test/domain.test.js')}\n${read('server/test/facility-groups.test.js')}`;
for (const text of [
  'world version 7 grain assets migrate entirely to wheat',
  'staple demand shifts budget to rice when wheat is expensive',
  'running farm crop changes apply at the next cycle boundary',
  'legacy completed target plans migrate to a manual stop',
]) assert.equal(tests.includes(text), true, `测试缺少: ${text}`);

for (const [path, required] of [
  ['README.md', ['13 种商品和 12 种工厂类型', '主食需求共用每 5 分钟最多 60']],
  ['docs/INDUSTRY_AND_PRODUCTION_DESIGN.md', ['持续生产与农场改种', 'wheat-crop', 'rice-crop', '世界版本 8']],
  ['docs/PRODUCT_AND_GAMEPLAY_DESIGN.md', ['主食替代需求', '价格指数', '需求预算']],
  ['docs/SERVER_ARCHITECTURE_AND_DEPLOYMENT_DESIGN.md', ['world.demandGroups.staples', '410 Gone', 'grain']],
]) {
  const content = read(path);
  for (const text of required) assert.equal(content.includes(text), true, `${path} 缺少: ${text}`);
}

console.log('小麦水稻目录、农场周期边界改种、持续生产、主食预算替代和世界版本 8 迁移验证通过。');
