import assert from 'node:assert/strict';
import test from 'node:test';
import { createWorld, ensurePlayer } from '../src/domain.js';
import { applyCommercialBuildingAction, processCommercialWorld, COMMERCIAL_BUILDING_TYPE_CATALOG } from '../src/commercial-buildings.js';
import { applyOnlineAutoBuy } from '../src/online-auto-buy.js';
import { applyOnlineAutoSell } from '../src/online-auto-sell.js';
import { factoryAutoTradeExecutionPolicyFor } from '../src/factory-auto-operation.js';
import { buildingReservedQuantitiesForPlayer, commercialInputReservations } from '../src/building-input-reservations.js';
import { inventoryForProvince, provinceScopedKey } from '../src/provinces.js';
import { commercialAutoOperationPolicyFor } from '../../shared/commercial-auto-operation.js';

const user = { id: 77901, email: 'commercial-auto@example.com', name: 'Commerce' };
const now = 1_800_000_000_000;
const provinceId = '110000';
const other = '120000';
function setup(count = 3, commercialTypeId = 'convenience-store') {
  const world = createWorld(now);
  const player = ensurePlayer(world, user, now);
  player.credits = 100_000;
  const type = COMMERCIAL_BUILDING_TYPE_CATALOG.find((item) => item.id === commercialTypeId);
  assert.ok(type);
  assert.equal(applyCommercialBuildingAction(world, user, { operation: 'build', provinceId, commercialTypeId, quantity: count }, now + 1).ok, true);
  const group = player.commercialBuildingGroups.find((item) => item.commercialTypeId === commercialTypeId);
  group.enabled = true;
  for (const input of type.consumptionInputs) world.markets[provinceScopedKey(provinceId, input.productId)].officialPrice = 1;
  return { world, player, group, type };
}
function setPolicy(world, policy, owner = user, region = provinceId) {
  return applyCommercialBuildingAction(world, owner, { operation: 'auto-operation', provinceId: region, commercialTypeId: 'convenience-store', policy }, now + 2);
}

test('commercial auto settings are strict, owned and independent of running intent', () => {
  const { world, player, group } = setup();
  const cash = player.credits;
  assert.equal(setPolicy(world, { enabled: false, inputCoverageCycles: 5 }).ok, true);
  assert.deepEqual(group.autoOperationPolicy, { enabled: false, inputCoverageCycles: 5 });
  assert.equal(group.enabled, true); assert.equal(player.credits, cash);
  for (const policy of [{ enabled: 'false', inputCoverageCycles: 2 }, { enabled: true, inputCoverageCycles: 4 }, { enabled: true, inputCoverageCycles: '2' }]) assert.equal(setPolicy(world, policy).ok, false);
  assert.equal(setPolicy(world, { enabled: true, inputCoverageCycles: 2 }, { ...user, id: 99199 }).ok, false);
  assert.equal(setPolicy(world, { enabled: true, inputCoverageCycles: 2 }, user, other).ok, false);
  assert.deepEqual(group.autoOperationPolicy, { enabled: false, inputCoverageCycles: 5 });
});

test('legacy default and derived execution policy do not rewrite saved groups', () => {
  const { player, group } = setup();
  const original = structuredClone(group);
  assert.deepEqual(commercialAutoOperationPolicyFor(group), { enabled: true, inputCoverageCycles: 2 });
  assert.equal(factoryAutoTradeExecutionPolicyFor(player, 'food', provinceId).buy.enabled, true);
  assert.deepEqual(group, original);
});

test('commercial purchase fills only the local two-cycle shortfall once', () => {
  const { world, player } = setup();
  inventoryForProvince(player, 'food', provinceId).available = 0;
  inventoryForProvince(player, 'food', other).available = 77;
  const market = world.markets[provinceScopedKey(provinceId, 'food')];
  const volume = Number(market.todayBuyQuantity || 0);
  const credits = player.credits;
  assert.equal(applyOnlineAutoBuy(world, user, { productId: 'food', provinceId }, now + 3).ok, true);
  assert.equal(inventoryForProvince(player, 'food', provinceId).available, 6);
  assert.equal(inventoryForProvince(player, 'food', other).available, 77);
  assert.equal(player.credits, credits - 6);
  assert.equal(market.todayBuyQuantity, volume + 6);
  assert.equal(applyOnlineAutoBuy(world, user, { productId: 'food', provinceId }, now + 4).ok, true);
  assert.equal(player.credits, credits - 6);
});

test('commercial auto-purchase respects price caps, cash and operating intent', () => {
  const { world, player, group } = setup();
  const inventory = inventoryForProvince(player, 'food', provinceId);
  inventory.available = 0;
  world.markets[provinceScopedKey(provinceId, 'food')].officialPrice = 1_000_000;
  assert.equal(applyOnlineAutoBuy(world, user, { productId: 'food', provinceId }, now + 3).ok, true);
  assert.equal(inventory.available, 0);
  world.markets[provinceScopedKey(provinceId, 'food')].officialPrice = 1;
  player.credits = 2;
  assert.equal(applyOnlineAutoBuy(world, user, { productId: 'food', provinceId }, now + 4).ok, true);
  assert.equal(inventory.available, 2);
  group.enabled = false;
  assert.equal(applyOnlineAutoBuy(world, user, { productId: 'food', provinceId }, now + 5).ok, false);
  assert.equal(applyOnlineAutoBuy(world, user, { productId: 'food', provinceId: other }, now + 5).ok, false);
});

test('commercial inventory protection adds per-consumer demand and survives disabling procurement', () => {
  const { world, player, group } = setup();
  assert.equal(applyCommercialBuildingAction(world, user, { operation: 'build', provinceId, commercialTypeId: 'restaurant', quantity: 2 }, now + 2).ok, true);
  const restaurant = player.commercialBuildingGroups.find((item) => item.commercialTypeId === 'restaurant');
  restaurant.enabled = true;
  const recipe = COMMERCIAL_BUILDING_TYPE_CATALOG.find((item) => item.id === 'restaurant');
  const beverage = recipe.consumptionInputs.find((item) => item.productId === 'beverage');
  assert.ok(beverage);
  assert.equal(commercialInputReservations(player, provinceId).beverage, 3 + 2 * beverage.quantity);
  group.autoOperationPolicy = { enabled: false, inputCoverageCycles: 5 };
  assert.equal(commercialInputReservations(player, provinceId).food, 3);
  assert.equal(buildingReservedQuantitiesForPlayer(world, user.id, provinceId).food, 3);
  assert.deepEqual(commercialInputReservations(player, other), {});
});

test('commerce alone cannot create an automatic sale or return goods on stop', () => {
  const { world, player, group } = setup();
  inventoryForProvince(player, 'food', provinceId).available = 99;
  assert.equal(applyOnlineAutoSell(world, user, { productId: 'food', provinceId }, now + 2).ok, false);
  group.enabled = false;
  assert.equal(commercialInputReservations(player, provinceId).food, undefined);
  assert.equal(inventoryForProvince(player, 'food', provinceId).available, 99);
});

test('server locks all commercial settlement details across price, count and policy changes', () => {
  const { world, player, type } = setup(1);
  for (const input of type.consumptionInputs) inventoryForProvince(player, input.productId, provinceId).available = input.quantity;
  assert.equal(applyCommercialBuildingAction(world, user, { operation: 'start', provinceId, commercialTypeId: type.id }, now + 2).ok, true);
  const group = player.commercialBuildingGroups.find((item) => item.commercialTypeId === type.id);
  const locked = structuredClone({ inputs: group.pendingInputs, value: group.pendingInputValue, cost: group.pendingOperatingCost, revenue: group.pendingRevenue, profit: group.pendingProfit });
  assert.deepEqual(locked.inputs, type.consumptionInputs);
  assert.equal(locked.cost, type.operatingCost);
  for (const input of type.consumptionInputs) world.markets[provinceScopedKey(provinceId, input.productId)].officialPrice = 999;
  applyCommercialBuildingAction(world, user, { operation: 'build', provinceId, commercialTypeId: type.id, quantity: 2 }, now + 3);
  setPolicy(world, { enabled: false, inputCoverageCycles: 5 });
  applyCommercialBuildingAction(world, user, { operation: 'stop', provinceId, commercialTypeId: type.id }, now + 4);
  assert.equal(group.pendingRevenue, locked.revenue); assert.equal(group.pendingProfit, locked.profit);
  assert.deepEqual(group.pendingInputs, locked.inputs);
  processCommercialWorld(world, group.cycleCompletesAt);
  assert.equal(group.lifetimeRevenue, locked.revenue); assert.equal(group.pendingInputs, undefined);
  assert.equal(group.status, 'stopped');
});

test('offline commercial world advancement does not invoke automatic purchases', () => {
  const { world, player, group } = setup();
  for (const input of COMMERCIAL_BUILDING_TYPE_CATALOG[0].consumptionInputs) inventoryForProvince(player, input.productId, provinceId).available = 0;
  const before = player.credits;
  const market = world.markets[provinceScopedKey(provinceId, 'food')];
  const volume = Number(market.todayBuyQuantity || 0);
  processCommercialWorld(world, now + 86_400_000);
  assert.equal(player.credits, before);
  assert.equal(Number(market.todayBuyQuantity || 0), volume);
  assert.equal(group.status, 'error');
});
