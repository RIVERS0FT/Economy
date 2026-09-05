import assert from 'node:assert/strict';
import test from 'node:test';
import { createWorld, ensurePlayer } from '../src/domain.js';
import { FACILITY_TYPE_CATALOG } from '../src/industry-catalog.js';
import { migrateFacilityGroupWorld } from '../src/facility-groups.js';
import { applyCommercialBuildingAction } from '../src/commercial-buildings.js';
import { buildingFreezeSource, reconcileBuildingInputFreezes } from '../src/building-input-freezes.js';
import { freezeCommodity, frozenForSource, assertCommodityFreezeInvariant } from '../src/commodity-freezes.js';
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
  Object.assign(commerce, { enabled: true, status: 'running', staffingRateBps: 10_000, staffingUpdatedAt: now });
  return { world, player, commerce };
}

test('commercial coverage is real source custody; turning procurement off releases only extra cycles', () => {
  const { world, player, commerce } = setup('convenience-store');
  const stock = inventoryForProvince(player, 'food', provinceId);
  stock.available = 100;
  freezeCommodity(stock, 'auction', 'auction-food', 20);
  reconcileBuildingInputFreezes(world, player, now, provinceId);
  assert.equal(frozenForSource(stock, 'commercial', buildingFreezeSource(commerce, 'commercial')), 6);
  assert.equal(stock.available, 74);
  commerce.autoOperationPolicy = { enabled: false, inputCoverageCycles: 5 };
  reconcileBuildingInputFreezes(world, player, now, provinceId);
  assert.equal(frozenForSource(stock, 'commercial', buildingFreezeSource(commerce, 'commercial')), 3);
  assert.equal(stock.available, 77);
  commerce.enabled = false;
  reconcileBuildingInputFreezes(world, player, now, provinceId);
  assert.equal(stock.available, 80);
  assert.equal(stock.frozen, 20);
  assertCommodityFreezeInvariant(stock);
});

test('industrial, commercial and contract custody are additive and repeated reconciliation never duplicates goods', () => {
  const { world, player, commerce } = setup('fresh-market');
  const type = FACILITY_TYPE_CATALOG.find((type) => type.recipes.some((recipe) => recipe.inputs.some((input) => input.productId === 'fruit')));
  const recipe = type.recipes.find((recipe) => recipe.inputs.some((input) => input.productId === 'fruit'));
  const input = recipe.inputs.find((input) => input.productId === 'fruit');
  for (const item of recipe.inputs) inventoryForProvince(player, item.productId, provinceId).available = 100;
  player.facilityGroups = [{ provinceId, facilityTypeId: type.id, activeRecipeId: recipe.id, count: 2, participatingCount: 2,
    enabled: true, status: 'running', cycleStartedAt: now, lifetimeOutput: 0, staffingRateBps: 10_000,
    staffingUpdatedAt: now, staffingBatchCarryBps: 0 }];
  player.factoryAutoOperationPolicies = { [provinceScopedKey(provinceId, type.id)]: {
    enabled: true, inputCoverageCycles: 3, mode: 'balanced', outputMode: 'surplus',
  } };
  migrateFacilityGroupWorld(world, now);
  const stock = inventoryForProvince(player, 'fruit', provinceId);
  freezeCommodity(stock, 'contract', 'fruit-supply', 7);
  reconcileBuildingInputFreezes(world, player, now, provinceId);
  assert.equal(frozenForSource(stock, 'production', provinceScopedKey(provinceId, type.id)), input.quantity * 2 * 3);
  assert.equal(frozenForSource(stock, 'commercial', buildingFreezeSource(commerce, 'commercial')), 12);
  assert.equal(frozenForSource(stock, 'contract', 'fruit-supply'), 7);
  const before = structuredClone(stock);
  reconcileBuildingInputFreezes(world, player, now, provinceId);
  assert.deepEqual(stock, before);
  assert.equal(stock.available + stock.frozen, 100);
  assertCommodityFreezeInvariant(stock);
});

test('insufficient inventory creates only actual freezes and cannot consume another reservation', () => {
  const { world, player, commerce } = setup('convenience-store');
  const stock = inventoryForProvince(player, 'food', provinceId);
  const credits = player.credits;
  stock.available = 4;
  freezeCommodity(stock, 'contract', 'existing-obligation', 3);
  reconcileBuildingInputFreezes(world, player, now, provinceId);
  assert.equal(frozenForSource(stock, 'commercial', buildingFreezeSource(commerce, 'commercial')), 1);
  assert.equal(stock.frozen, 4);
  assert.equal(stock.available, 0);
  assert.equal(player.credits, credits);
  assertCommodityFreezeInvariant(stock);
});
