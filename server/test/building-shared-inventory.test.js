import assert from 'node:assert/strict';
import test from 'node:test';
import { createWorld, ensurePlayer } from '../src/domain.js';
import { FACILITY_TYPE_CATALOG } from '../src/industry-catalog.js';
import { migrateFacilityGroupWorld } from '../src/facility-groups.js';
import { applyCommercialBuildingAction } from '../src/commercial-buildings.js';
import { reconcileProvinceBuildingFreezes, runCycleAutoOperation } from '../src/cycle-auto-operation.js';
import { sourceFrozenQuantity } from '../src/inventory-freezes.js';
import { inventoryForProvince, provinceScopedKey } from '../src/provinces.js';

const now = 1_800_000_000_000;
const provinceId = '110000';
const user = { id: 77911, email: 'shared-building@example.com', name: 'Shared' };

function setup(commercialTypeId) {
  const world = createWorld(now);
  const player = ensurePlayer(world, user, now);
  player.credits = 100_000;
  applyCommercialBuildingAction(world, user, { operation: 'build', provinceId, commercialTypeId, quantity: 3 }, now + 1);
  const commerce = player.commercialBuildingGroups.find((group) => group.commercialTypeId === commercialTypeId);
  commerce.enabled = true;
  return { world, player, commerce };
}

function industrial(world, player, type, recipe, count, coverage = 2) {
  player.facilityGroups ??= [];
  player.facilityGroups.push({
    facilityTypeId: type.id,
    provinceId,
    count,
    participatingCount: count,
    productionAvailableCount: count,
    enabled: true,
    status: 'running',
    activeRecipeId: recipe.id,
    cycleStartedAt: now,
    lifetimeOutput: 0,
  });
  player.factoryAutoOperationPolicies ??= {};
  player.factoryAutoOperationPolicies[provinceScopedKey(provinceId, type.id)] = {
    enabled: true,
    inputCoverageCycles: coverage,
    mode: 'balanced',
    outputMode: 'surplus',
  };
  migrateFacilityGroupWorld(world, now);
}

test('industrial and commercial guarantees become additive real freezes without consuming contract frozen stock', () => {
  const { world, player } = setup('fresh-market');
  const consumer = FACILITY_TYPE_CATALOG.find((type) => type.recipes?.some((recipe) => recipe.inputs?.some((input) => input.productId === 'fruit')));
  assert.ok(consumer);
  const recipe = consumer.recipes.find((item) => item.inputs?.some((input) => input.productId === 'fruit'));
  const input = recipe.inputs.find((item) => item.productId === 'fruit');
  industrial(world, player, consumer, recipe, 2, 3);

  const inventory = inventoryForProvince(player, 'fruit', provinceId);
  inventory.available = 1_000;
  inventory.frozen = 4;
  world.productionContracts = [{
    id: 'commercial-shared-fruit',
    kind: 'supply',
    status: 'active',
    supplierId: user.id,
    provinceId,
    productId: 'fruit',
    quantityPerDelivery: 4,
    supplierReservedQuantity: 4,
    supplierAutoReserve: true,
    completedDeliveries: 0,
    totalDeliveries: null,
  }];

  reconcileProvinceBuildingFreezes(world, user.id, provinceId);

  const productionTarget = input.quantity * 2 * 3;
  const commercialTarget = 2 * 3 * 2;
  assert.equal(sourceFrozenQuantity(player, {
    kind: 'production', provinceId, productId: 'fruit', sourceId: consumer.id,
  }), productionTarget);
  assert.equal(sourceFrozenQuantity(player, {
    kind: 'commercial', provinceId, productId: 'fruit', sourceId: 'fresh-market',
  }), commercialTarget);
  assert.equal(inventory.frozen, 4 + productionTarget + commercialTarget);
  assert.equal(inventory.available, 1_000 - productionTarget - commercialTarget);
});

test('profitable completed cycle sells all available inventory but never touches existing frozen inventory', () => {
  const { world, player } = setup('convenience-store');
  const producer = FACILITY_TYPE_CATALOG.find((type) => type.recipes?.some((recipe) => (recipe.inputs?.length ?? 0) === 0));
  assert.ok(producer);
  const recipe = producer.recipes.find((item) => (item.inputs?.length ?? 0) === 0);
  industrial(world, player, producer, recipe, 1, 2);
  world.markets[provinceScopedKey(provinceId, recipe.output.productId)].officialPrice = 10_000;

  const food = inventoryForProvince(player, 'food', provinceId);
  food.available = 100;
  food.frozen = 7;
  const creditsBefore = player.credits;

  const outcome = runCycleAutoOperation(world, user.id, provinceId, [
    { kind: 'production', sourceId: producer.id },
  ], now + 2);

  assert.ok(outcome.sold >= 100);
  assert.equal(food.available, 0);
  assert.equal(food.frozen, 7);
  assert.ok(player.credits > creditsBefore);
});
