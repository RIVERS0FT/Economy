import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FACILITY_TYPE_CATALOG, MARKET_DEMAND_MODEL_VERSION, PRODUCT_CATALOG } from '../server/src/domain.js';

const prices = new Map(PRODUCT_CATALOG.map((product) => [product.id, product.basePrice]));
const facilities = new Map(FACILITY_TYPE_CATALOG.map((facility) => [facility.id, facility]));
const expectedPrices = { tools: 12, fertilizer: 6.76, tractor: 15.35, feed: 5.8, 'veterinary-medicine': 14.1, machinery: 15.55 };
const expectedUpstream = {
  'tool-workshop': { output: 5, cost: 8, profit: 6 },
  'fertilizer-factory': { output: 6, cost: 16.56, profit: 6 },
  'tractor-factory': { output: 4, cost: 8.85, profit: 8 },
  'feed-factory': { output: 2, cost: 5, profit: 3 },
  'veterinary-medicine-factory': { output: 4, cost: 13.64, profit: 6 },
  'machine-factory': { output: 5, cost: 11.75, profit: 8 },
};
const bands = { assisted: [3, 5], intensive: [6, 8], mechanized: [8, 10] };
const c1Ids = ['farm', 'orchard', 'ranch', 'fishery'];

function profit(recipe) {
  const input = recipe.inputs.reduce((sum, item) => sum + prices.get(item.productId) * item.quantity, 0);
  return (prices.get(recipe.output.productId) * recipe.output.quantity - input - recipe.operatingCost) * 60_000 / recipe.cycleMs;
}

assert.equal(MARKET_DEMAND_MODEL_VERSION, 18);
for (const [productId, expected] of Object.entries(expectedPrices)) assert.equal(prices.get(productId), expected);
for (const [facilityId, expected] of Object.entries(expectedUpstream)) {
  const recipe = facilities.get(facilityId).recipes.find((item) => item.productionMethodId === 'standard');
  assert.equal(recipe.output.quantity, expected.output, facilityId);
  assert.equal(recipe.operatingCost, expected.cost, facilityId);
  assert.ok(Math.abs(profit(recipe) - expected.profit) < 1e-9, facilityId);
}
const profitsByMethod = { assisted: [], intensive: [], mechanized: [] };
for (const facilityId of c1Ids) {
  const facility = facilities.get(facilityId);
  const variants = facility.recipes.filter((recipe) => recipe.baseRecipeId === facility.defaultRecipeId);
  const quantities = variants.map((recipe) => recipe.output.quantity);
  assert.deepEqual(quantities, [...quantities].sort((a, b) => a - b), facilityId);
  assert.equal(new Set(quantities).size, quantities.length, facilityId);
  for (const methodId of Object.keys(bands)) {
    const recipe = variants.find((item) => item.productionMethodId === methodId);
    const value = profit(recipe);
    const [minimum, maximum] = bands[methodId];
    assert.ok(value >= minimum - 1e-9 && value <= maximum + 1e-9, facilityId + '/' + methodId + ': ' + value);
    assert.ok(value < 12, facilityId + '/' + methodId);
    profitsByMethod[methodId].push(value);
  }
}
for (const [methodId, values] of Object.entries(profitsByMethod)) {
  assert.ok(Math.max(...values) - Math.min(...values) <= 2 + 1e-9, methodId);
}
const domain = readFileSync('server/src/domain.js', 'utf8');
const design = readFileSync('docs/INDUSTRY_AND_PRODUCTION_DESIGN.md', 'utf8');
for (const text of ['C1_INPUT_BALANCE_MODEL_VERSION = 18', 'C1_INPUT_BALANCE_PRODUCT_IDS', 'migrateC1InputBalance', 'multiplyMoneyByInteger(Number(order.price || 0), remaining)']) assert.ok(domain.includes(text), text);
for (const text of ['市场需求模型 18 重平衡工具、化肥、拖拉机、配合饲料、养殖药剂和机械', '不得按旧／新参考价换算或倍增', '工具／饲料制度为每分钟 3～5', '化肥／药剂制度为每分钟 6～8', '拖拉机／机械化制度为每分钟 8～10']) assert.ok(design.includes(text), text);
console.log('C1 投入品平衡验证通过：六种价格与上游批量产出、三级利润区间、同级差距和模型 18 幂等迁移规则均已锁定。');
