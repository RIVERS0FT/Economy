import assert from 'node:assert/strict';
import test from 'node:test';
import { FACILITY_TYPE_CATALOG, createWorld, ensurePlayer } from '../src/domain.js';
import { applyFacilityGroupAction } from '../src/facility-groups.js';
import { settleProductionForPlayerServerSide } from '../src/production-settlement.js';
import { DEFAULT_PROVINCE_ID, inventoryForProvince, provinceScopedKey } from '../src/provinces.js';

const user = { id: 77201, email: 'first-building@example.test', name: 'First Building' };
const now = 1_800_100_000_000;

function setup() {
  const world = createWorld(now);
  const player = ensurePlayer(world, user, now);
  player.credits = 100_000;
  return { world, player };
}

function facility(id) {
  const type = FACILITY_TYPE_CATALOG.find((candidate) => candidate.id === id);
  assert.ok(type);
  return type;
}

function seedBuildMaterials(player, type, quantity = 1) {
  for (const input of type.buildInputs || []) {
    inventoryForProvince(player, input.productId, DEFAULT_PROVINCE_ID).available = input.quantity * quantity;
  }
}

test('first industrial build defaults to running and bootstraps inputs without auto-selling or faking completion', () => {
  const { world, player } = setup();
  const mill = facility('mill');
  const recipe = mill.recipes.find((candidate) => candidate.id === mill.defaultRecipeId) || mill.recipes[0];
  seedBuildMaterials(player, mill);
  inventoryForProvince(player, 'wheat', DEFAULT_PROVINCE_ID).available = 0;
  inventoryForProvince(player, 'fruit', DEFAULT_PROVINCE_ID).available = 7;
  const wheatMarket = world.markets[provinceScopedKey(DEFAULT_PROVINCE_ID, 'wheat')];
  const fruitMarket = world.markets[provinceScopedKey(DEFAULT_PROVINCE_ID, 'fruit')];
  const wheatBuyBefore = Number(wheatMarket.todayBuyQuantity || 0);
  const fruitSellBefore = Number(fruitMarket.todaySellQuantity || 0);

  const built = applyFacilityGroupAction(world, user, 'buildFacility', {
    provinceId: DEFAULT_PROVINCE_ID,
    facilityTypeId: mill.id,
    quantity: 1,
  }, now + 1, { migrate: false, process: false });

  assert.equal(built.ok, true);
  const group = player.facilityGroups.find((candidate) => candidate.facilityTypeId === mill.id);
  assert.ok(group);
  assert.equal(group.enabled, true);
  assert.equal(group.status, 'running');
  assert.equal(group.participatingCount, 1);
  assert.equal(inventoryForProvince(player, 'wheat', DEFAULT_PROVINCE_ID).frozen, recipe.inputs[0].quantity * 2);
  assert.equal(inventoryForProvince(player, 'fruit', DEFAULT_PROVINCE_ID).available, 7);
  assert.equal(Number(fruitMarket.todaySellQuantity || 0), fruitSellBefore);
  assert.equal(Number(wheatMarket.todayBuyQuantity || 0) - wheatBuyBefore, recipe.inputs[0].quantity * 2);
  assert.equal(Object.keys(player.autoOperationCycleCursors || {}).length, 0);
  const bootstrapBuys = (world.orders || []).filter((order) => order.execution === 'bootstrap-auto-buy');
  assert.equal(bootstrapBuys.reduce((sum, order) => sum + Number(order.quantity || 0), 0), recipe.inputs[0].quantity * 2);
});

test('industrial first-cycle bootstrap retries after funds recover during lazy authoritative settlement', () => {
  const { world, player } = setup();
  const mill = facility('mill');
  const recipe = mill.recipes.find((candidate) => candidate.id === mill.defaultRecipeId) || mill.recipes[0];
  seedBuildMaterials(player, mill);
  inventoryForProvince(player, 'wheat', DEFAULT_PROVINCE_ID).available = 0;
  player.credits = mill.buildCost + recipe.operatingCost;
  const wheatMarket = world.markets[provinceScopedKey(DEFAULT_PROVINCE_ID, 'wheat')];
  const buyBefore = Number(wheatMarket.todayBuyQuantity || 0);

  const built = applyFacilityGroupAction(world, user, 'buildFacility', {
    provinceId: DEFAULT_PROVINCE_ID,
    facilityTypeId: mill.id,
    quantity: 1,
  }, now + 1, { migrate: false, process: false });
  assert.equal(built.ok, true);
  const group = player.facilityGroups.find((candidate) => candidate.facilityTypeId === mill.id);
  assert.ok(group);
  assert.equal(group.enabled, true);
  assert.equal(group.status, 'error');
  assert.equal(group.statusReason, 'insufficient_input');
  assert.equal(Number(wheatMarket.todayBuyQuantity || 0), buyBefore);

  player.credits += 100;
  assert.equal(settleProductionForPlayerServerSide(world, user.id, now + 2).ok, true);
  assert.equal(group.enabled, true);
  assert.equal(group.status, 'running');
  assert.equal(group.participatingCount, 1);
  assert.ok(Number(wheatMarket.todayBuyQuantity || 0) > buyBefore);
  assert.equal(Object.keys(player.autoOperationCycleCursors || {}).length, 0);
});

test('expanding a manually stopped industrial group preserves the stopped intent', () => {
  const { world, player } = setup();
  const farm = facility('farm');

  assert.equal(applyFacilityGroupAction(world, user, 'buildFacility', {
    provinceId: DEFAULT_PROVINCE_ID,
    facilityTypeId: farm.id,
    quantity: 1,
  }, now + 1, { migrate: false, process: false }).ok, true);
  const group = player.facilityGroups.find((candidate) => candidate.facilityTypeId === farm.id);
  assert.ok(group);
  assert.equal(group.enabled, true);
  assert.equal(group.status, 'running');

  assert.equal(applyFacilityGroupAction(world, user, 'pauseFacility', {
    provinceId: DEFAULT_PROVINCE_ID,
    facilityTypeId: farm.id,
  }, now + 2, { migrate: false, process: false }).ok, true);
  assert.equal(group.enabled, false);
  assert.equal(group.status, 'stopped');

  assert.equal(applyFacilityGroupAction(world, user, 'buildFacility', {
    provinceId: DEFAULT_PROVINCE_ID,
    facilityTypeId: farm.id,
    quantity: 1,
  }, now + 3, { migrate: false, process: false }).ok, true);
  assert.equal(group.count, 2);
  assert.equal(group.enabled, false);
  assert.equal(group.status, 'stopped');
});
