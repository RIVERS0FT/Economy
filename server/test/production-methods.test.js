import assert from 'node:assert/strict';
import test from 'node:test';
import { createWorld, ensurePlayer, FACILITY_TYPE_CATALOG, PRODUCT_CATALOG } from '../src/domain.js';
import {
  applyFacilityGroupAction,
  createFacilityGroupClientState,
  migrateFacilityGroupWorld,
  processFacilityGroupWorld,
} from '../src/facility-groups.js';
import { migrateResearchWorld } from '../src/research.js';

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
    !recipe.legacyProductionMethod
    && recipe.baseRecipeId === baseRecipeId
    && recipe.productionMethodId === productionMethodId
  ));
}

const dedicatedMethods = ['standard', 'assisted', 'intensive', 'mechanized'];
const genericMethods = ['standard', 'rapid', 'economical', 'high-yield'];

const expectedC1Methods = {
  farm: {
    standard: { inputs: [], output: 1 },
    assisted: { inputs: [{ productId: 'tools', quantity: 1 }], output: 12 },
    intensive: { inputs: [{ productId: 'fertilizer', quantity: 2 }], output: 14 },
    mechanized: { inputs: [{ productId: 'tractor', quantity: 1 }], output: 16 },
  },
  orchard: {
    standard: { inputs: [], output: 1 },
    assisted: { inputs: [{ productId: 'tools', quantity: 1 }], output: 11 },
    intensive: { inputs: [{ productId: 'fertilizer', quantity: 2 }], output: 13 },
    mechanized: { inputs: [{ productId: 'tractor', quantity: 1 }], output: 15 },
  },
  ranch: {
    standard: { inputs: [], output: 1 },
    assisted: { inputs: [{ productId: 'feed', quantity: 1 }], output: 4 },
    intensive: { inputs: [{ productId: 'veterinary-medicine', quantity: 1 }], output: 8 },
    mechanized: { inputs: [{ productId: 'machinery', quantity: 1 }], output: 9 },
  },
  fishery: {
    standard: { inputs: [], output: 1 },
    assisted: { inputs: [{ productId: 'feed', quantity: 1 }], output: 4 },
    intensive: { inputs: [{ productId: 'veterinary-medicine', quantity: 1 }], output: 8 },
    mechanized: { inputs: [{ productId: 'machinery', quantity: 1 }], output: 9 },
  },
};

const expectedC2Profits = { standard: 3, assisted: 6, intensive: 9, mechanized: 10.5 };
const expectedC2Plans = {
  'logging-camp': [
    [[], 2, 9],
    [[['tools', 1]], 4, 6],
    [[['tools', 1], ['industrial-fuel', 1]], 5, 5],
    [[['machinery', 1], ['industrial-fuel', 2]], 7, 7.95],
  ],
  mine: [
    [[], 2, 11],
    [[['tools', 1]], 4, 10],
    [[['tools', 1], ['industrial-chemicals', 1]], 5, 9],
    [[['machinery', 1], ['industrial-chemicals', 1], ['industrial-fuel', 1]], 6, 6.95],
  ],
  'oil-field': [
    [[], 2, 15],
    [[['industrial-chemicals', 1]], 3, 16],
    [[['machinery', 1], ['industrial-chemicals', 1]], 5, 15.45],
    [[['machinery', 1], ['industrial-chemicals', 1], ['industrial-fuel', 1]], 6, 18.95],
  ],
  mill: [
    [[['wheat', 2]], 1, 8.6],
    [[['wheat', 4], ['tools', 1]], 2, 5.2],
    [[['wheat', 6], ['machinery', 1]], 3, 10.25],
    [[['wheat', 6], ['machinery', 1], ['industrial-fuel', 1]], 4, 18.25],
  ],
  sawmill: [
    [[['timber', 2]], 1, 3],
    [[['timber', 8], ['tools', 1]], 4, 4],
    [[['timber', 7], ['machinery', 1]], 4, 4.45],
    [[['timber', 8], ['machinery', 1], ['industrial-fuel', 1]], 5, 10.45],
  ],
  'feed-factory': [
    [[['wheat', 2], ['fruit', 1]], 2, 4.9],
    [[['wheat', 4], ['fruit', 2], ['tools', 1]], 5, 3.6],
    [[['wheat', 6], ['fruit', 3], ['machinery', 1]], 8, 10.75],
    [[['wheat', 8], ['fruit', 4], ['machinery', 1], ['industrial-fuel', 1]], 11, 18.95],
  ],
};

test('every factory route exposes dedicated C1/C2 methods and generic C3-C7 methods', () => {
  for (const type of FACILITY_TYPE_CATALOG) {
    const methodGroup = productionGroup(type);
    assert.ok(methodGroup, `${type.id} 缺少作业制度`);
    assert.equal(methodGroup.defaultMethodId, 'standard');
    const dedicated = type.complexity === 'C1' || type.complexity === 'C2';
    const expectedMethodIds = dedicated ? dedicatedMethods : genericMethods;
    assert.deepEqual(methodGroup.methods.map((method) => method.id), expectedMethodIds);

    for (const method of methodGroup.methods) {
      assert.ok(Array.isArray(method.requiredTechnologyIds));
      if (dedicated && method.id !== 'standard') assert.ok(method.requiredTechnologyIds.length > 0);
      if (!dedicated) assert.deepEqual(method.requiredTechnologyIds, []);
    }

    const baseRecipes = type.recipes.filter((recipe) => (
      !recipe.legacyProductionMethod && recipe.productionMethodId === 'standard'
    ));
    for (const baseRecipe of baseRecipes) {
      const variants = expectedMethodIds.map((methodId) => variant(type, baseRecipe.id, methodId));
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

      if (type.complexity === 'C2') {
        for (const recipe of variants) {
          assert.ok(Math.abs(referenceProfitPerMinute(recipe) - expectedC2Profits[recipe.productionMethodId]) < 1e-9);
        }
        continue;
      }

      const baseProfit = referenceProfitPerMinute(baseRecipe);
      for (const recipe of variants) {
        assert.ok(Math.abs(referenceProfitPerMinute(recipe) - baseProfit) < 1e-9, `${type.id}/${recipe.id} 参考分钟利润错误`);
      }
      const [standard, rapid, economical, highYield] = variants;
      assert.equal(rapid.cycleMs <= standard.cycleMs, true);
      assert.equal(rapid.operatingCost >= standard.operatingCost, true);
      assert.equal(economical.cycleMs >= standard.cycleMs, true);
      assert.equal(economical.operatingCost <= standard.operatingCost, true);
      assert.equal(highYield.cycleMs, standard.cycleMs);
      assert.equal(highYield.output.quantity, standard.output.quantity * 2);
      assert.deepEqual(highYield.inputs, standard.inputs.map((input) => ({ ...input, quantity: input.quantity * 2 })));
    }

    if (type.complexity === 'C2') {
      const aliases = type.recipes.filter((recipe) => recipe.legacyProductionMethod);
      assert.equal(aliases.length, baseRecipes.length * 3);
      assert.equal(aliases.every((recipe) => ['rapid', 'economical', 'high-yield'].includes(recipe.productionMethodId)), true);
    }
  }
});

test('representative C1 and all C2 dedicated plans use approved fixed-precision values', () => {
  const farm = FACILITY_TYPE_CATALOG.find((type) => type.id === 'farm');
  assert.deepEqual(
    dedicatedMethods.map((methodId) => {
      const recipe = variant(farm, 'wheat-crop', methodId);
      return [recipe.cycleMs, recipe.inputs, recipe.output.quantity, recipe.operatingCost];
    }),
    [
      [20_000, [], 1, 1],
      [20_000, [{ productId: 'tools', quantity: 1 }], 12, 1],
      [20_000, [{ productId: 'fertilizer', quantity: 2 }], 14, 1],
      [20_000, [{ productId: 'tractor', quantity: 1 }], 16, 1],
    ],
  );

  for (const [facilityId, expectedPlans] of Object.entries(expectedC2Plans)) {
    const type = FACILITY_TYPE_CATALOG.find((candidate) => candidate.id === facilityId);
    const baseRecipe = type.recipes.find((recipe) => !recipe.legacyProductionMethod && recipe.productionMethodId === 'standard');
    assert.deepEqual(dedicatedMethods.map((methodId) => {
      const recipe = variant(type, baseRecipe.id, methodId);
      return [recipe.inputs.map((input) => [input.productId, input.quantity]), recipe.output.quantity, recipe.operatingCost];
    }), expectedPlans);
  }
});

test('C4 refinery provides plastic, industrial fuel, and industrial chemicals at the C4 baseline', () => {
  const refinery = FACILITY_TYPE_CATALOG.find((type) => type.id === 'refinery');
  const routes = refinery.recipes.filter((recipe) => !recipe.legacyProductionMethod && recipe.productionMethodId === 'standard');
  assert.deepEqual(routes.map((recipe) => recipe.output.productId), ['plastic', 'industrial-fuel', 'industrial-chemicals']);
  assert.equal(routes.every((recipe) => Math.abs(referenceProfitPerMinute(recipe) - 6) < 1e-9), true);

  const fuelEconomical = variant(refinery, 'industrial-fuel-refining', 'economical');
  assert.equal(fuelEconomical.cycleMs, 70_000);
  assert.equal(fuelEconomical.operatingCost, 0);
  assert.ok(Math.abs(referenceProfitPerMinute(fuelEconomical) - 6) < 1e-9);
});

test('public client state hides legacy C2 aliases and exposes current method metadata', () => {
  const world = createWorld(now);
  ensurePlayer(world, alice, now);
  const state = createFacilityGroupClientState(world, alice.id, now);

  for (const type of state.facilityTypes) {
    assert.ok(Array.isArray(type.productionMethodGroups));
    assert.equal(type.productionMethodGroups.length, 1);
    assert.equal(type.recipes.every((recipe) => (recipe.productionMethodId || 'standard') === 'standard'), true);
    assert.equal(type.recipes.some((recipe) => recipe.legacyProductionMethod), false);
    const internal = FACILITY_TYPE_CATALOG.find((candidate) => candidate.id === type.id);
    const expectedBaseRecipeCount = internal.recipes.filter((recipe) => (
      !recipe.legacyProductionMethod && recipe.productionMethodId === 'standard'
    )).length;
    assert.equal(type.recipes.length, expectedBaseRecipeCount);
  }
});

test('running factory switches C1 method immediately with one staffing penalty', () => {
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
  assert.equal(player.inventories.wheat.available, 48);
  assert.equal(player.inventories.tools.available, 6);
  assert.ok(Math.abs(player.credits - 96) < 1e-9);
  assert.equal(player.facilityGroups[0].lifetimeOutput, 48);
});

test('legacy C2 generic method IDs preserve the selected base route and migrate to standard without staffing penalty', () => {
  const world = createWorld(now);
  const player = ensurePlayer(world, alice, now);
  player.facilityGroups = [{
    facilityTypeId: 'mine', count: 1, participatingCount: 1, enabled: true,
    status: 'running', cycleStartedAt: now - 20_000, staffingRateBps: 9_000,
    staffingUpdatedAt: now, staffingBatchCarryBps: 321, activeRecipeId: 'copper-ore-mining--rapid', lifetimeOutput: 0,
  }];

  migrateFacilityGroupWorld(world, now);
  assert.equal(player.facilityGroups[0].activeRecipeId, 'copper-ore-mining--rapid');
  migrateResearchWorld(world, now + 1);

  assert.equal(player.facilityGroups[0].activeRecipeId, 'copper-ore-mining');
  assert.equal(player.facilityGroups[0].cycleStartedAt, now + 1);
  assert.equal(player.facilityGroups[0].staffingRateBps, 9_000);
  assert.equal(player.facilityGroups[0].staffingBatchCarryBps, 321);
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