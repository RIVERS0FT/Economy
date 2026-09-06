import { auditRecipe } from '../../scripts/audit-economy-balance.mjs';
import assert from 'node:assert/strict';
import test from 'node:test';
import { FACILITY_TYPE_CATALOG, PRODUCT_CATALOG } from '../src/domain.js';

const products = new Map(PRODUCT_CATALOG.map((product) => [product.id, product]));
const facilities = new Map(FACILITY_TYPE_CATALOG.map((facility) => [facility.id, facility]));

function standardRecipes(facilityId) {
  const facility = facilities.get(facilityId);
  assert.ok(facility, `${facilityId} 必须存在于正式目录`);
  const defaultMethodId = facility.productionMethodGroups[0].defaultMethodId;
  return facility.recipes.filter((recipe) => recipe.productionMethodId === defaultMethodId);
}

function routeVariants(facilityId, baseRecipeId) {
  const facility = facilities.get(facilityId);
  assert.ok(facility, `${facilityId} 必须存在于正式目录`);
  return facility.recipes.filter((recipe) => recipe.baseRecipeId === baseRecipeId);
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
  farm: { productIds: ['wheat', 'rice', 'cotton', 'sugarcane'], value: 1.2, cycleMs: 20_000, cost: 0.97, profit: 0.69 },
  orchard: { productIds: ['fruit'], value: 1.3, cycleMs: 20_000, cost: 0.99, profit: 0.93 },
  ranch: { productIds: ['meat', 'eggs', 'milk', 'wool'], value: 2.4, cycleMs: 30_000, cost: 1.79, profit: 1.22 },
  fishery: { productIds: ['fish'], value: 2.5, cycleMs: 30_000, cost: 1.83, profit: 1.34 },
};

test('C1 catalog contains exactly the approved fast-production factories', () => {
  assert.deepEqual(
    FACILITY_TYPE_CATALOG
      .filter((facility) => facility.complexity === 'C1')
      .map((facility) => facility.id),
    Object.keys(expected),
  );
});

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

test('C1 work systems keep fixed time and whole-good plans with balanced cash costs', () => {
  const plans = {
    farm: [
      { inputs: [], output: 1 },
      { inputs: [{ productId: 'tools', quantity: 1 }], output: 12 },
      { inputs: [{ productId: 'fertilizer', quantity: 2 }], output: 14 },
      { inputs: [{ productId: 'tractor', quantity: 1 }], output: 16 },
    ],
    orchard: [
      { inputs: [], output: 1 },
      { inputs: [{ productId: 'tools', quantity: 1 }], output: 11 },
      { inputs: [{ productId: 'fertilizer', quantity: 2 }], output: 13 },
      { inputs: [{ productId: 'tractor', quantity: 1 }], output: 15 },
    ],
    ranch: [
      { inputs: [], output: 1 },
      { inputs: [{ productId: 'feed', quantity: 1 }], output: 4 },
      { inputs: [{ productId: 'veterinary-medicine', quantity: 1 }], output: 8 },
      { inputs: [{ productId: 'machinery', quantity: 1 }], output: 9 },
    ],
    fishery: [
      { inputs: [], output: 1 },
      { inputs: [{ productId: 'feed', quantity: 1 }], output: 4 },
      { inputs: [{ productId: 'veterinary-medicine', quantity: 1 }], output: 8 },
      { inputs: [{ productId: 'machinery', quantity: 1 }], output: 9 },
    ],
  };

  for (const [facilityId, expectedPlans] of Object.entries(plans)) {
    const facility = facilities.get(facilityId);
    const baseRecipe = standardRecipes(facilityId)[0];
    const variants = routeVariants(facilityId, baseRecipe.id);
    const methodIds = facility.productionMethodGroups[0].methods.map((method) => method.id);
    assert.deepEqual(variants.map((recipe) => recipe.productionMethodId), methodIds);
    assert.equal(facility.productionMethodGroups[0].methods.length, 4);
    for (const [index, recipe] of variants.entries()) {
      assert.equal(recipe.cycleMs, baseRecipe.cycleMs);
      assert.ok(Math.abs(auditRecipe(facility, recipe).recoveryMinutes - [80, 75, 70, 65][index]) < 1);
      assert.deepEqual(recipe.inputs, expectedPlans[index].inputs);
      assert.equal(recipe.output.quantity, expectedPlans[index].output);
      assert.equal(recipe.inputs.every((input) => Number.isInteger(input.quantity)), true);
    }
  }
});
