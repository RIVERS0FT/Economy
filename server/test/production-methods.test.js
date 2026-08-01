import assert from 'node:assert/strict';
import test from 'node:test';
import { createWorld, ensurePlayer, FACILITY_TYPE_CATALOG, PRODUCT_CATALOG } from '../src/domain.js';
import {
  applyFacilityGroupAction,
  createFacilityGroupClientState,
  migrateFacilityGroupWorld,
  processFacilityGroupWorld,
} from '../src/facility-groups.js';

const now = 1_700_000_000_000;
const alice = { id: 1, email: 'alice@example.com', name: 'Alice' };
const expectedProfitByComplexity = { C1: 1, C2: 3, C3: 6, C4: 6, C5: 8, C6: 10, C7: 12 };
const prices = new Map(PRODUCT_CATALOG.map((product) => [product.id, product.basePrice]));

function referenceProfitPerMinute(recipe) {
  const inputValue = recipe.inputs.reduce(
    (sum, input) => sum + prices.get(input.productId) * input.quantity,
    0,
  );
  const outputValue = prices.get(recipe.output.productId) * recipe.output.quantity;
  return (outputValue - inputValue - recipe.operatingCost) * 60_000 / recipe.cycleMs;
}

function productionGroup(type) {
  return type.productionMethodGroups.find((group) => group.id === 'operation');
}

function variant(type, baseRecipeId, productionMethodId) {
  return type.recipes.find((recipe) => (
    recipe.baseRecipeId === baseRecipeId
    && recipe.productionMethodId === productionMethodId
  ));
}

test('every factory route exposes four balanced production methods', () => {
  for (const type of FACILITY_TYPE_CATALOG) {
    const methodGroup = productionGroup(type);
    assert.ok(methodGroup, `${type.id} 缺少作业制度`);
    assert.equal(methodGroup.defaultMethodId, 'standard');
    assert.deepEqual(
      methodGroup.methods.map((method) => method.id),
      ['standard', 'rapid', 'economical', 'high-yield'],
    );

    const baseRecipes = type.recipes.filter((recipe) => recipe.productionMethodId === 'standard');
    for (const baseRecipe of baseRecipes) {
      const variants = methodGroup.methods.map((method) => variant(type, baseRecipe.id, method.id));
      assert.equal(variants.every(Boolean), true, `${type.id}/${baseRecipe.id} 生产方式不完整`);
      for (const recipe of variants) {
        assert.equal(Number.isInteger(recipe.cycleMs / 1_000), true);
        assert.equal(Number.isInteger(recipe.operatingCost), true);
        assert.equal(recipe.operatingCost >= 0, true);
        assert.equal(
          referenceProfitPerMinute(recipe),
          expectedProfitByComplexity[type.complexity],
          `${type.id}/${recipe.id} 参考分钟利润错误`,
        );
      }

      const [standard, rapid, economical, highYield] = variants;
      assert.equal(rapid.cycleMs <= standard.cycleMs, true);
      assert.equal(rapid.operatingCost >= standard.operatingCost, true);
      assert.equal(economical.cycleMs >= standard.cycleMs, true);
      assert.equal(economical.operatingCost <= standard.operatingCost, true);
      assert.equal(highYield.cycleMs, standard.cycleMs);
      assert.equal(highYield.output.quantity, standard.output.quantity * 2);
      assert.deepEqual(
        highYield.inputs,
        standard.inputs.map((input) => ({ ...input, quantity: input.quantity * 2 })),
      );
    }
  }
});

test('representative production method plans use the approved integer values', () => {
  const farm = FACILITY_TYPE_CATALOG.find((type) => type.id === 'farm');
  const steelworks = FACILITY_TYPE_CATALOG.find((type) => type.id === 'steelworks');
  const electronics = FACILITY_TYPE_CATALOG.find((type) => type.id === 'electronics-factory');

  assert.deepEqual(
    ['standard', 'rapid', 'economical', 'high-yield'].map((methodId) => {
      const recipe = variant(farm, 'wheat-crop', methodId);
      return [recipe.cycleMs, recipe.output.quantity, recipe.operatingCost];
    }),
    [
      [120_000, 4, 6],
      [60_000, 4, 7],
      [180_000, 4, 5],
      [120_000, 8, 14],
    ],
  );

  assert.deepEqual(
    ['standard', 'rapid', 'economical', 'high-yield'].map((methodId) => {
      const recipe = variant(steelworks, 'steelworks-default', methodId);
      return [recipe.cycleMs, recipe.inputs[0].quantity, recipe.output.quantity, recipe.operatingCost];
    }),
    [
      [40_000, 3, 1, 4],
      [20_000, 3, 1, 6],
      [60_000, 3, 1, 2],
      [40_000, 6, 2, 12],
    ],
  );

  assert.deepEqual(
    ['standard', 'rapid', 'economical', 'high-yield'].map((methodId) => {
      const recipe = variant(electronics, 'electronics-factory-default', methodId);
      return [recipe.cycleMs, recipe.inputs.map((input) => input.quantity), recipe.output.quantity, recipe.operatingCost];
    }),
    [
      [60_000, [1, 1], 1, 15],
      [30_000, [1, 1], 1, 20],
      [90_000, [1, 1], 1, 10],
      [60_000, [2, 2], 2, 40],
    ],
  );
});

test('public client state keeps the legacy recipe list and exposes optional method metadata', () => {
  const world = createWorld(now);
  ensurePlayer(world, alice, now);
  const state = createFacilityGroupClientState(world, alice.id, now);

  for (const type of state.facilityTypes) {
    assert.ok(Array.isArray(type.productionMethodGroups));
    assert.equal(type.productionMethodGroups.length, 1);
    assert.equal(type.recipes.every((recipe) => (recipe.productionMethodId || 'standard') === 'standard'), true);
    const internal = FACILITY_TYPE_CATALOG.find((candidate) => candidate.id === type.id);
    const expectedBaseRecipeCount = internal.recipes.filter(
      (recipe) => recipe.productionMethodId === 'standard',
    ).length;
    assert.equal(type.recipes.length, expectedBaseRecipeCount);
  }
});

test('running factory switches production method only after the current full cycle', () => {
  const world = createWorld(now);
  const player = ensurePlayer(world, alice, now);
  player.credits = 100;
  player.facilityGroups = [{
    facilityTypeId: 'farm',
    count: 1,
    participatingCount: 1,
    pendingJoinCount: 0,
    enabled: true,
    status: 'running',
    cycleStartedAt: now,
    activeRecipeId: 'wheat-crop',
    lifetimeOutput: 0,
  }];
  migrateFacilityGroupWorld(world, now);

  const result = applyFacilityGroupAction(world, alice, 'setFacilityRecipe', {
    facilityTypeId: 'farm',
    recipeId: 'wheat-crop--rapid',
  }, now + 1);
  assert.equal(result.ok, true);
  assert.equal(player.facilityGroups[0].activeRecipeId, 'wheat-crop');
  assert.equal(player.facilityGroups[0].pendingRecipeId, 'wheat-crop--rapid');

  processFacilityGroupWorld(world, now + 120_000);
  assert.equal(player.inventories.wheat.available, 4);
  assert.equal(player.credits, 94);
  assert.equal(player.facilityGroups[0].activeRecipeId, 'wheat-crop--rapid');
  assert.equal(player.facilityGroups[0].pendingRecipeId, undefined);
  assert.equal(player.facilityGroups[0].cycleStartedAt, now + 120_000);

  processFacilityGroupWorld(world, now + 180_000);
  assert.equal(player.inventories.wheat.available, 8);
  assert.equal(player.credits, 87);
  assert.equal(player.facilityGroups[0].lifetimeOutput, 8);
});
