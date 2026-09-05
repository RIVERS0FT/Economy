import assert from 'node:assert/strict';
import test from 'node:test';
import { createWorld, ensurePlayer } from '../src/domain.js';
import { FACILITY_TYPE_CATALOG } from '../src/industry-catalog.js';
import { migrateFacilityGroupWorld, productionReservedQuantitiesForPlayer } from '../src/facility-groups.js';
import { factoryAutoTradeExecutionPolicyFor } from '../src/factory-auto-operation.js';
import { applyOnlineAutoSell } from '../src/online-auto-sell.js';
import { applyOnlineAutoBuy } from '../src/online-auto-buy.js';
import { applyCommercialBuildingAction } from '../src/commercial-buildings.js';
import { buildingReservedQuantitiesForPlayer } from '../src/building-input-reservations.js';
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
  player.facilityGroups.push({ facilityTypeId: type.id, provinceId, count, participatingCount: count, productionAvailableCount: count,
    enabled: true, status: 'running', activeRecipeId: recipe.id, cycleStartedAt: now, lifetimeOutput: 0 });
  player.factoryAutoOperationPolicies ??= {};
  player.factoryAutoOperationPolicies[provinceScopedKey(provinceId, type.id)] = { enabled: true, inputCoverageCycles: coverage, mode: 'balanced', outputMode: 'surplus' };
  migrateFacilityGroupWorld(world, now);
}

test('industrial automatic sale protects commerce full coverage then its next cycle when procurement is off', () => {
  const { world, player, commerce } = setup('convenience-store');
  const producer = FACILITY_TYPE_CATALOG.find((type) => type.recipes?.some((recipe) => recipe.output?.productId === 'food'));
  assert.ok(producer);
  const recipe = producer.recipes.find((item) => item.output?.productId === 'food');
  industrial(world, player, producer, recipe, 1);
  const policy = factoryAutoTradeExecutionPolicyFor(player, 'food', provinceId).sell;
  world.markets[provinceScopedKey(provinceId, 'food')].officialPrice = policy.price;
  const inventory = inventoryForProvince(player, 'food', provinceId);
  inventory.available = 100;
  assert.equal(applyOnlineAutoSell(world, user, { productId: 'food', provinceId }, now + 2).ok, true);
  assert.equal(inventory.available, 6);
  commerce.autoOperationPolicy = { enabled: false, inputCoverageCycles: 5 };
  inventory.available = 100;
  assert.equal(applyOnlineAutoSell(world, user, { productId: 'food', provinceId }, now + 3).ok, true);
  assert.equal(inventory.available, 3);
  assert.equal(inventory.frozen, 0);
});

test('industrial, commercial and contract input holds are additive without double procurement', () => {
  const { world, player } = setup('fresh-market');
  const consumer = FACILITY_TYPE_CATALOG.find((type) => type.recipes?.some((recipe) => recipe.inputs?.some((input) => input.productId === 'fruit')));
  assert.ok(consumer);
  const recipe = consumer.recipes.find((item) => item.inputs?.some((input) => input.productId === 'fruit'));
  const input = recipe.inputs.find((item) => item.productId === 'fruit');
  industrial(world, player, consumer, recipe, 2, 3);
  world.productionContracts = [{ id: 'commercial-shared-fruit', kind: 'supply', status: 'active', supplierId: user.id, provinceId,
    productId: 'fruit', quantityPerDelivery: 4, supplierReservedQuantity: 1, supplierAutoReserve: true, completedDeliveries: 0, totalDeliveries: null }];
  const production = productionReservedQuantitiesForPlayer(world, user.id, provinceId).fruit;
  assert.equal(production, input.quantity * 2);
  assert.equal(buildingReservedQuantitiesForPlayer(world, user.id, provinceId).fruit, production + 6);
  const market = world.markets[provinceScopedKey(provinceId, 'fruit')];
  market.officialPrice = 1;
  const inventory = inventoryForProvince(player, 'fruit', provinceId);
  inventory.available = 0;
  assert.equal(applyOnlineAutoBuy(world, user, { productId: 'fruit', provinceId }, now + 2).ok, true);
  assert.equal(inventory.available, production * 3 + 6 * 2 + 3);
  const paid = player.credits;
  assert.equal(applyOnlineAutoBuy(world, user, { productId: 'fruit', provinceId }, now + 3).ok, true);
  assert.equal(player.credits, paid);
});
