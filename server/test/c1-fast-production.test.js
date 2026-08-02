import assert from 'node:assert/strict';
import test from 'node:test';
import { FACILITY_TYPE_CATALOG, PRODUCT_CATALOG } from '../src/domain.js';

const products = new Map(PRODUCT_CATALOG.map((product) => [product.id, product]));
const facilities = new Map(FACILITY_TYPE_CATALOG.map((facility) => [facility.id, facility]));

function standardRecipes(facilityId) {
  const facility = facilities.get(facilityId);
  assert.ok(facility, `${facilityId} 必须存在于正式目录`);
  return facility.recipes.filter((recipe) => recipe.productionMethodId === 'standard');
}

function profitPerMinute(recipe) {
  const outputValue = products.get(recipe.output.productId).basePrice * recipe.output.quantity;
  const inputValue = recipe.inputs.reduce(
    (sum, input) => sum + products.get(input.productId).basePrice * input.quantity,
    0,
  );
  return (outputValue - inputValue - recipe.operatingCost) * 60_000 / recipe.cycleMs;
}

const expected = {
  farm: { productIds: ['wheat', 'rice', 'cotton', 'sugarcane'], value: 1.2, cycleMs: 20_000, cost: 1, profit: 0.6 },
  orchard: { productIds: ['fruit'], value: 1.3, cycleMs: 20_000, cost: 1, profit: 0.9 },
  ranch: { productIds: ['meat', 'eggs', 'milk', 'wool'], value: 2.4, cycleMs: 30_000, cost: 2, profit: 0.8 },
  fishery: { productIds: ['fish'], value: 2.5, cycleMs: 30_000, cost: 2, profit: 1 },
};

test('C1 factories use the approved fast-production parameters', () => {
  for (const [facilityId, rule] of Object.entries(expected)) {
    const recipes = standardRecipes(facilityId);
    assert.deepEqual(recipes.map((recipe) => recipe.output.productId), rule.productIds);
    for (const recipe of recipes) {
      assert.equal(recipe.output.quantity, 1, `${facilityId}/${recipe.id} 单周期产出必须为 1`);
      assert.equal(recipe.cycleMs, rule.cycleMs, `${facilityId}/${recipe.id} 周期错误`);
      assert.equal(recipe.operatingCost, rule.cost, `${facilityId}/${recipe.id} 周期成本错误`);
      assert.equal(products.get(recipe.output.productId).basePrice, rule.value, `${recipe.output.productId} 参考价值错误`);
      assert.ok(
        Math.abs(profitPerMinute(recipe) - rule.profit) < 1e-9,
        `${facilityId}/${recipe.id} 每分钟利润错误`,
      );
    }
  }
});
