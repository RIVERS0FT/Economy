import { auditRecipe } from './audit-economy-balance.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FACILITY_TYPE_CATALOG, MARKET_DEMAND_MODEL_VERSION, PRODUCT_CATALOG } from '../server/src/domain.js';

const prices = new Map(PRODUCT_CATALOG.map((product) => [product.id, product.basePrice]));
const facilities = new Map(FACILITY_TYPE_CATALOG.map((facility) => [facility.id, facility]));
const expectedPrices = { tools: 12, fertilizer: 6.76, tractor: 15.35, feed: 5.8, 'veterinary-medicine': 14.1, machinery: 15.55 };
const expectedUpstream = {
  'tool-workshop': { output: 5, cost: 8.05, profit: 5.95 },
  'fertilizer-factory': { output: 6, cost: 17.15, profit: 5.41 },
  'tractor-factory': { output: 4, cost: 8.42, profit: 8.43 },
  'feed-factory': { output: 2, cost: 5.24, profit: 2.66 },
  'veterinary-medicine-factory': { output: 4, cost: 13.32, profit: 6.32 },
  'machine-factory': { output: 5, cost: 11.24, profit: 8.51 },
};
const bands = [[74, 76], [69, 71], [64, 66]];
const c1Ids = ['farm', 'orchard', 'ranch', 'fishery'];

function profit(recipe) {
  const input = recipe.inputs.reduce((sum, item) => sum + prices.get(item.productId) * item.quantity, 0);
  return (prices.get(recipe.output.productId) * recipe.output.quantity - input - recipe.operatingCost) * 60_000 / recipe.cycleMs;
}

assert.equal(MARKET_DEMAND_MODEL_VERSION, 20);
for (const [productId, expected] of Object.entries(expectedPrices)) assert.equal(prices.get(productId), expected);
for (const [facilityId, expected] of Object.entries(expectedUpstream)) {
  const facility = facilities.get(facilityId);
  const defaultMethodId = facility.productionMethodGroups[0].defaultMethodId;
  const recipe = facility.recipes.find((item) => item.productionMethodId === defaultMethodId);
  assert.equal(recipe.output.quantity, expected.output, facilityId);
  assert.equal(recipe.operatingCost, expected.cost, facilityId);
  assert.ok(Math.abs(profit(recipe) - expected.profit) < 1e-9, facilityId);
}
const feedFactory = facilities.get('feed-factory');
const feedRecipe = feedFactory.recipes.find(
  (item) => item.productionMethodId === feedFactory.productionMethodGroups[0].defaultMethodId,
);
assert.deepEqual(feedRecipe.inputs, [
  { productId: 'wheat', quantity: 2 },
  { productId: 'fruit', quantity: 1 },
]);
const profitsByMethod = [[], [], []];
for (const facilityId of c1Ids) {
  const facility = facilities.get(facilityId);
  const variants = facility.recipes.filter((recipe) => recipe.baseRecipeId === facility.defaultRecipeId);
  const quantities = variants.map((recipe) => recipe.output.quantity);
  assert.deepEqual(quantities, [...quantities].sort((a, b) => a - b), facilityId);
  assert.equal(new Set(quantities).size, quantities.length, facilityId);
  for (const [index, [minimum, maximum]] of bands.entries()) {
    const recipe = variants[index + 1];
    const value = auditRecipe(facility, recipe).recoveryMinutes;
    assert.ok(value >= minimum - 1e-9 && value <= maximum + 1e-9, `${facilityId}/method-${index + 1}: ${value}`);
    assert.ok(auditRecipe(facility, recipe).netPerMinute > 0);
    profitsByMethod[index].push(value);
  }
}
for (const [index, values] of profitsByMethod.entries()) {
  assert.ok(Math.max(...values) - Math.min(...values) <= 2 + 1e-9, `method-${index + 1}`);
}
const domain = readFileSync('server/src/domain.js', 'utf8');
const design = readFileSync('docs/INDUSTRY_AND_PRODUCTION_DESIGN.md', 'utf8');
for (const text of ['C1_INPUT_BALANCE_MODEL_VERSION = 18', 'C1_INPUT_BALANCE_PRODUCT_IDS', 'migrateC1InputBalance', 'multiplyMoneyByInteger(Number(order.price || 0), remaining)']) assert.ok(domain.includes(text), text);
for (const text of ['工具／饲料制度占款回收目标 75 分钟', '化肥／药剂制度占款回收目标 70 分钟', '拖拉机／机械化制度占款回收目标 65 分钟']) assert.ok(design.includes(text), text);
console.log('C1 投入品平衡验证通过：六种价格与上游批量产出、三级占款回收目标、同级差距和当前市场需求模型 20 均已锁定。');
