import { auditRecipe } from '../../scripts/audit-economy-balance.mjs';
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
const retiredMethodIds = new Set([
  'standard', 'rapid', 'economical', 'high-yield', 'assisted', 'intensive', 'mechanized',
]);
const retiredMethodNames = new Set(['标准生产', '高速生产', '节约生产', '高产生产']);

function productionGroup(type) {
  return type.productionMethodGroups.find((group) => group.id === 'operation');
}

function variantsFor(type, baseRecipeId) {
  const group = productionGroup(type);
  return group.methods.map((method) => type.recipes.find((recipe) => (
    recipe.baseRecipeId === baseRecipeId && recipe.productionMethodId === method.id
  )));
}

function baseRecipes(type) {
  const defaultMethodId = productionGroup(type).defaultMethodId;
  return type.recipes.filter((recipe) => recipe.productionMethodId === defaultMethodId);
}

test('every factory exposes four named special methods with semantic icons', () => {
  const sharedDefinitions = new Map();
  for (const type of FACILITY_TYPE_CATALOG) {
    const group = productionGroup(type);
    assert.ok(group, `${type.id} 缺少作业制度`);
    assert.equal(group.methods.length, 4, `${type.id} 作业制度数量错误`);
    assert.equal(group.defaultMethodId, group.methods[0].id);
    assert.equal(new Set(group.methods.map((method) => method.id)).size, 4);

    for (const method of group.methods) {
      assert.equal(retiredMethodIds.has(method.id), false, `${type.id} 仍公开旧制度 ${method.id}`);
      assert.equal(retiredMethodNames.has(method.name), false, `${type.id} 仍公开旧制度名称 ${method.name}`);
      assert.match(method.iconId, /^[a-z][a-z0-9-]*$/, `${type.id}/${method.id} 缺少语义图标`);
      assert.ok(Array.isArray(method.requiredTechnologyIds));
      const shared = sharedDefinitions.get(method.id);
      if (shared) {
        assert.deepEqual(
          [method.name, method.iconId, method.requiredTechnologyIds],
          shared,
          `${method.id} 跨工厂复用时定义不一致`,
        );
      } else {
        sharedDefinitions.set(method.id, [method.name, method.iconId, method.requiredTechnologyIds]);
      }
    }

    for (const baseRecipe of baseRecipes(type)) {
      const variants = variantsFor(type, baseRecipe.id);
      assert.equal(variants.every(Boolean), true, `${type.id}/${baseRecipe.id} 制度配方不完整`);
      assert.equal(variants[0].id, baseRecipe.id, '默认制度必须保留基础配方 ID');
      for (const recipe of variants) {
        assert.equal(Number.isInteger(recipe.cycleMs / 1_000), true);
        assert.ok(Math.abs(recipe.operatingCost - Math.round(recipe.operatingCost * 100) / 100) < 1e-9);
        assert.ok(recipe.operatingCost >= 0);
      }
    }
  }
  assert.ok(sharedDefinitions.has('precision-fertilization'));
  assert.ok(sharedDefinitions.has('automated-assembly'));
});

test('C1 and C2 special methods preserve their approved material plans', () => {
  const farm = FACILITY_TYPE_CATALOG.find((type) => type.id === 'farm');
  assert.deepEqual(
    variantsFor(farm, 'wheat-crop').map((recipe) => [recipe.inputs, recipe.output.quantity, recipe.operatingCost]),
    [
      [[], 1, 0.97],
      [[{ productId: 'tools', quantity: 1 }], 12, 1.91],
      [[{ productId: 'fertilizer', quantity: 2 }], 14, 2.72],
      [[{ productId: 'tractor', quantity: 1 }], 16, 3.21],
    ],
  );

  const mine = FACILITY_TYPE_CATALOG.find((type) => type.id === 'mine');
  assert.deepEqual(productionGroup(mine).methods.map((method) => method.id), [
    'conventional-mining', 'drill-mining', 'blast-mining', 'mechanized-mining',
  ]);
  assert.deepEqual(
    variantsFor(mine, 'mine-default').map((recipe) => [recipe.inputs, recipe.output.quantity, recipe.operatingCost]),
    [
      [[], 2, 11.53],
      [[{ productId: 'tools', quantity: 1 }], 4, 13],
      [[{ productId: 'tools', quantity: 1 }, { productId: 'industrial-chemicals', quantity: 1 }], 5, 14.61],
      [[
        { productId: 'machinery', quantity: 1 },
        { productId: 'industrial-chemicals', quantity: 1 },
        { productId: 'industrial-fuel', quantity: 1 },
      ], 6, 13.7],
    ],
  );
});

test('C3-C7 special methods retain their layouts with fee-inclusive capital tradeoffs', () => {
  for (const type of FACILITY_TYPE_CATALOG.filter((candidate) => Number(candidate.complexity.slice(1)) >= 3)) {
    for (const baseRecipe of baseRecipes(type)) {
      const variants = variantsFor(type, baseRecipe.id);
      const baseTarget = type.complexity === 'C3' ? 75 : 80;
      for (const [index, recipe] of variants.entries()) {
        const audit = auditRecipe(type, recipe);
        assert.ok(audit.netPerMinute > 0);
        assert.ok(Math.abs(audit.recoveryMinutes - (baseTarget + [0, 5, -5, 0][index])) < 1, recipe.id);
      }
      const [base, shortCycle, longCycle, doubleBatch] = variants;
      assert.ok(shortCycle.cycleMs <= base.cycleMs);
      assert.ok(shortCycle.operatingCost >= base.operatingCost);
      assert.ok(longCycle.cycleMs >= base.cycleMs);
      assert.ok(longCycle.operatingCost <= base.operatingCost);
      assert.equal(doubleBatch.cycleMs, base.cycleMs);
      assert.equal(doubleBatch.output.quantity, base.output.quantity * 2);
      assert.deepEqual(doubleBatch.inputs, base.inputs.map((input) => ({ ...input, quantity: input.quantity * 2 })));
    }
  }
});

test('public client state exposes default recipes plus all current method metadata', () => {
  const world = createWorld(now);
  ensurePlayer(world, alice, now);
  const state = createFacilityGroupClientState(world, alice.id, now);

  for (const type of state.facilityTypes) {
    const group = productionGroup(type);
    assert.equal(type.recipes.every((recipe) => recipe.productionMethodId === group.defaultMethodId), true);
    assert.equal(type.recipes.length, baseRecipes(FACILITY_TYPE_CATALOG.find((item) => item.id === type.id)).length);
    assert.equal(group.methods.every((method) => Boolean(method.iconId)), true);
  }
});

test('running factory switches to a named special method immediately', () => {
  const world = createWorld(now);
  const player = ensurePlayer(world, alice, now);
  player.credits = 100;
  player.inventories.tools.available = 10;
  player.factoryAutoOperationPolicies = { farm: { enabled: false, inputCoverageCycles: 2, mode: 'balanced', outputMode: 'surplus' } };
  player.facilityGroups = [{
    facilityTypeId: 'farm', count: 5, participatingCount: 5, enabled: true,
    status: 'running', cycleStartedAt: now, staffingRateBps: 10_000,
    staffingUpdatedAt: now, staffingBatchCarryBps: 9_999,
    activeRecipeId: 'wheat-crop', lifetimeOutput: 0,
  }];
  migrateFacilityGroupWorld(world, now);

  const result = applyFacilityGroupAction(world, alice, 'setFacilityRecipe', {
    facilityTypeId: 'farm', recipeId: 'wheat-crop--tool-tillage',
  }, now + 1);
  assert.equal(result.ok, true);
  assert.equal(player.facilityGroups[0].activeRecipeId, 'wheat-crop--tool-tillage');
  assert.equal(player.facilityGroups[0].staffingRateBps, 8_000);

  processFacilityGroupWorld(world, now + 20_001);
  assert.equal(player.inventories.wheat.available, 48);
  assert.equal(player.inventories.tools.available + player.inventories.tools.frozen, 6);
});

test('legacy method IDs migrate to equivalent special methods without resetting progress', () => {
  const world = createWorld(now);
  const player = ensurePlayer(world, alice, now);
  migrateResearchWorld(world, now);
  player.research.completedTechnologyIds.push('tool-manufacturing', 'tool-operation');
  player.facilityGroups = [
    {
      facilityTypeId: 'mine', count: 1, participatingCount: 1, enabled: true,
      status: 'running', cycleStartedAt: now - 20_000, staffingRateBps: 9_000,
      staffingUpdatedAt: now, staffingBatchCarryBps: 321,
      activeRecipeId: 'copper-ore-mining--assisted', lifetimeOutput: 0,
    },
    {
      facilityTypeId: 'machine-factory', count: 1, participatingCount: 1, enabled: true,
      status: 'running', cycleStartedAt: now - 40_000, staffingRateBps: 8_000,
      staffingUpdatedAt: now, staffingBatchCarryBps: 123,
      activeRecipeId: 'machine-factory-default--economical', lifetimeOutput: 0,
    },
  ];
  migrateFacilityGroupWorld(world, now);
  migrateResearchWorld(world, now + 1);

  assert.equal(player.facilityGroups[0].activeRecipeId, 'copper-ore-mining--drill-mining');
  assert.equal(player.facilityGroups[0].cycleStartedAt, now - 20_000);
  assert.equal(player.facilityGroups[0].staffingBatchCarryBps, 321);
  assert.equal(player.facilityGroups[1].activeRecipeId, 'machine-factory-default--cellular-manufacturing');
  assert.equal(player.facilityGroups[1].cycleStartedAt, now - 40_000);
  assert.equal(player.facilityGroups[1].staffingBatchCarryBps, 123);
});

test('whole-good inputs still fail atomically when a cycle input is unavailable', () => {
  const world = createWorld(now);
  const player = ensurePlayer(world, alice, now);
  migrateResearchWorld(world, now);
  player.research.completedTechnologyIds.push('fertilizer-engineering', 'fertilizer-application');
  player.credits = 100;
  player.inventories.fertilizer.available = 2;
  player.facilityGroups = [{
    facilityTypeId: 'farm', count: 1, participatingCount: 1, enabled: true,
    status: 'running', cycleStartedAt: now, staffingRateBps: 10_000,
    staffingUpdatedAt: now, activeRecipeId: 'wheat-crop--precision-fertilization', lifetimeOutput: 0,
  }];
  migrateFacilityGroupWorld(world, now);
  player.inventories.fertilizer.available = 1;
  processFacilityGroupWorld(world, now + 20_000);

  assert.equal(player.facilityGroups[0].status, 'error');
  assert.equal(player.inventories.fertilizer.available + player.inventories.fertilizer.frozen, 1);
  assert.equal(player.inventories.wheat.available, 0);
  assert.equal(player.credits, 100);
});
