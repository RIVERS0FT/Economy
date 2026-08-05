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

const c1Methods = ['standard', 'assisted', 'intensive', 'mechanized'];
const genericMethods = ['standard', 'rapid', 'economical', 'high-yield'];

const expectedC1Methods = {
  farm: {
    standard: { inputs: [], output: 1 },
    assisted: { inputs: [{ productId: 'tools', quantity: 1 }], output: 51 },
    intensive: { inputs: [{ productId: 'fertilizer', quantity: 2 }], output: 58 },
    mechanized: { inputs: [{ productId: 'tractor', quantity: 1 }], output: 102 },
  },
  orchard: {
    standard: { inputs: [], output: 1 },
    assisted: { inputs: [{ productId: 'tools', quantity: 1 }], output: 48 },
    intensive: { inputs: [{ productId: 'fertilizer', quantity: 2 }], output: 55 },
    mechanized: { inputs: [{ productId: 'tractor', quantity: 1 }], output: 96 },
  },
  ranch: {
    standard: { inputs: [], output: 1 },
    assisted: { inputs: [{ productId: 'feed', quantity: 1 }], output: 6 },
    intensive: { inputs: [{ productId: 'veterinary-medicine', quantity: 1 }], output: 19 },
    mechanized: { inputs: [{ productId: 'machinery', quantity: 1 }], output: 35 },
  },
  fishery: {
    standard: { inputs: [], output: 1 },
    assisted: { inputs: [{ productId: 'feed', quantity: 1 }], output: 5 },
    intensive: { inputs: [{ productId: 'veterinary-medicine', quantity: 1 }], output: 18 },
    mechanized: { inputs: [{ productId: 'machinery', quantity: 1 }], output: 33 },
  },
};

test('every factory route exposes four production methods with dedicated C1 inputs', () => {
  for (const type of FACILITY_TYPE_CATALOG) {
    const methodGroup = productionGroup(type);
    assert.ok(methodGroup, `${type.id} 缺少作业制度`);
    assert.equal(methodGroup.defaultMethodId, 'standard');
    const expectedMethodIds = type.complexity === 'C1' ? c1Methods : genericMethods;
    assert.deepEqual(
      methodGroup.methods.map((method) => method.id),
      expectedMethodIds,
    );

    const baseRecipes = type.recipes.filter((recipe) => recipe.productionMethodId === 'standard');
    for (const baseRecipe of baseRecipes) {
      const baseProfit = referenceProfitPerMinute(baseRecipe);
      const variants = methodGroup.methods.map((method) => variant(type, baseRecipe.id, method.id));
      assert.equal(variants.every(Boolean), true, `${type.id}/${baseRecipe.id} 生产方式不完整`);
      for (const recipe of variants) {
        assert.equal(Number.isInteger(recipe.cycleMs / 1_000), true);
        assert.ok(Math.abs(recipe.operatingCost - Math.round(recipe.operatingCost * 100) / 100) < 1e-9);
        assert.equal(recipe.operatingCost >= 0, true);
      }

      if (type.complexity === 'C1') {
        for (const recipe of variants) {
          const expected = expectedC1Methods[type.id][recipe.productionMethodId];
          assert.equal(recipe.cycleMs, baseRecipe.cycleMs);
          assert.equal(recipe.operatingCost, baseRecipe.operatingCost);
          assert.deepEqual(recipe.inputs, expected.inputs);
          assert.equal(recipe.output.quantity, expected.output);
        }
        continue;
      }

      for (const recipe of variants) {
        assert.ok(
          Math.abs(referenceProfitPerMinute(recipe) - baseProfit) < 1e-9,
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

test('representative production method plans use the approved fixed-precision values', () => {
  const farm = FACILITY_TYPE_CATALOG.find((type) => type.id === 'farm');
  const steelworks = FACILITY_TYPE_CATALOG.find((type) => type.id === 'steelworks');
  const electronics = FACILITY_TYPE_CATALOG.find((type) => type.id === 'electronics-factory');

  assert.deepEqual(
    c1Methods.map((methodId) => {
      const recipe = variant(farm, 'wheat-crop', methodId);
      return [recipe.cycleMs, recipe.inputs, recipe.output.quantity, recipe.operatingCost];
    }),
    [
      [20_000, [], 1, 1],
      [20_000, [{ productId: 'tools', quantity: 1 }], 51, 1],
      [20_000, [{ productId: 'fertilizer', quantity: 2 }], 58, 1],
      [20_000, [{ productId: 'tractor', quantity: 1 }], 102, 1],
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

test('running factory switches production method immediately with one staffing penalty', () => {
  const world = createWorld(now);
  const player = ensurePlayer(world, alice, now);
  player.credits = 100;
  player.inventories.tools.available = 10;
  player.facilityGroups = [{
    facilityTypeId: 'farm',
    count: 5,
    participatingCount: 5,
    enabled: true,
    status: 'running',
    cycleStartedAt: now,
    staffingRateBps: 10_000,
    staffingUpdatedAt: now,
    staffingBatchCarryBps: 9_999,
    activeRecipeId: 'wheat-crop',
    lifetimeOutput: 0,
  }];
  migrateFacilityGroupWorld(world, now);

  const result = applyFacilityGroupAction(world, alice, 'setFacilityRecipe', {
    facilityTypeId: 'farm',
    recipeId: 'wheat-crop--assisted',
  }, now + 1);
  const farm = player.facilityGroups[0];
  assert.equal(result.ok, true);
  assert.equal(farm.activeRecipeId, 'wheat-crop--assisted');
  assert.equal(farm.cycleStartedAt, now + 1);
  assert.equal(farm.staffingRateBps, 8_000);
  assert.equal(farm.staffingBatchCarryBps, 0);
  assert.equal(Object.hasOwn(farm, 'pendingRecipeId'), false);

  processFacilityGroupWorld(world, now + 20_000);
  assert.equal(player.inventories.wheat.available, 0);
  processFacilityGroupWorld(world, now + 20_001);
  assert.equal(player.inventories.wheat.available, 204);
  assert.equal(player.inventories.tools.available, 6);
  assert.ok(Math.abs(player.credits - 96) < 1e-9);
  assert.equal(player.facilityGroups[0].lifetimeOutput, 204);
});

test('legacy C1 generic method IDs migrate safely to the base method', () => {
  const world = createWorld(now);
  const player = ensurePlayer(world, alice, now);
  player.facilityGroups = [{
    facilityTypeId: 'farm', count: 1, participatingCount: 1, enabled: true,
    status: 'running', cycleStartedAt: now, staffingRateBps: 10_000,
    staffingUpdatedAt: now, activeRecipeId: 'wheat-crop--rapid', lifetimeOutput: 0,
  }];

  migrateFacilityGroupWorld(world, now);

  assert.equal(player.facilityGroups[0].activeRecipeId, 'wheat-crop');
});

test('C1 whole-good inputs fail atomically when a complete cycle input is unavailable', () => {
  const world = createWorld(now);
  const player = ensurePlayer(world, alice, now);
  player.credits = 100;
  player.inventories.fertilizer.available = 2;
  player.facilityGroups = [{
    facilityTypeId: 'farm', count: 1, participatingCount: 1, enabled: true,
    status: 'running', cycleStartedAt: now, staffingRateBps: 10_000,
    staffingUpdatedAt: now, activeRecipeId: 'wheat-crop--intensive', lifetimeOutput: 0,
  }];
  migrateFacilityGroupWorld(world, now);
  player.inventories.fertilizer.available = 1;

  processFacilityGroupWorld(world, now + 20_000);

  assert.equal(player.facilityGroups[0].status, 'error');
  assert.equal(player.inventories.fertilizer.available, 1);
  assert.equal(player.inventories.wheat.available, 0);
  assert.equal(player.credits, 100);
  assert.equal(player.facilityGroups[0].lifetimeOutput, 0);
});
