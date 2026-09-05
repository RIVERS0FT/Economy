import assert from 'node:assert/strict';
import test from 'node:test';
import { createWorld, ensurePlayer } from '../src/domain.js';
import { FACILITY_TYPE_CATALOG } from '../src/industry-catalog.js';
import { migrateFacilityGroupWorld } from '../src/facility-groups.js';
import { createProductionSettlementClaim } from '../../shared/production-settlement.js';
import { applyProductionSettlementClaim, createProductionSettlementBasis } from '../src/production-settlement.js';
import { reconcileBuildingInputFreezes, buildingFreezeSource, buildingInputPlans, planInputTotals } from '../src/building-input-freezes.js';
import { assertCommodityFreezeInvariant, freezeCommodity, frozenForSource } from '../src/commodity-freezes.js';
import { inventoryForProvince, provinceScopedKey } from '../src/provinces.js';
import { completeBuildingCycleAutoOperation } from '../src/cycle-auto-operation.js';
import { applyFactoryAutoOperationPolicyAction } from '../src/factory-auto-operation.js';
import { applyOnlineAutoBuy } from '../src/online-auto-buy.js';
import { applyOnlineAutoSell } from '../src/online-auto-sell.js';

const now = 1_800_000_000_000;
const provinceId = '110000';
const user = { id: 9311, name: 'Cycle trade', email: 'cycle-trade@example.test' };
function setup(typeId = 'mill', prices = { wheat: 5, flour: 25 }) {
  const world = createWorld(now);
  const player = ensurePlayer(world, user, now);
  const type = FACILITY_TYPE_CATALOG.find((type) => type.id === typeId);
  assert.ok(type);
  const recipe = type.recipes.find((recipe) => recipe.id === type.defaultRecipeId) || type.recipes[0];
  const group = { provinceId, facilityTypeId: typeId, count: 1, participatingCount: 1, enabled: true,
    status: 'running', activeRecipeId: recipe.id, lifetimeOutput: 0, cycleStartedAt: now,
    staffingRateBps: 10_000, staffingUpdatedAt: now, staffingBatchCarryBps: 0 };
  player.facilityGroups = [group];
  player.credits = 10_000;
  player.provinceAutoSaleEnabled = { [provinceId]: true };
  for (const input of recipe.inputs) inventoryForProvince(player, input.productId, provinceId).available = input.quantity;
  migrateFacilityGroupWorld(world, now);
  for (const [id, price] of Object.entries(prices)) world.markets[provinceScopedKey(provinceId, id)].officialPrice = price;
  for (const input of recipe.inputs) inventoryForProvince(player, input.productId, provinceId).available = input.quantity;
  return { world, player, group: player.facilityGroups[0], type, recipe };
}
function settle(world, through) {
  const basis = createProductionSettlementBasis(world, user.id, through);
  const claim = createProductionSettlementClaim(basis);
  if (claim) return applyProductionSettlementClaim(world, user.id, claim, through);
}
function orders(world) { return world.orders.filter((order) => order.ownerType === 'player' && order.ownerId === user.id); }

test('no automatic trade before completion, policy edits and legacy action calls cannot trade', () => {
  const { world, player, recipe } = setup();
  const before = player.credits;
  reconcileBuildingInputFreezes(world, player, now);
  settle(world, now + recipe.cycleMs - 1);
  assert.equal(applyFactoryAutoOperationPolicyAction(world, user, {
    provinceId, facilityTypeId: 'mill', policy: { enabled: true, inputCoverageCycles: 3, mode: 'balanced', outputMode: 'surplus' },
  }, now).ok, true);
  assert.equal(applyOnlineAutoBuy(world, user, { provinceId, productId: 'wheat' }, now).ok, false);
  assert.equal(applyOnlineAutoSell(world, user, { provinceId, productId: 'wheat' }, now).ok, false);
  assert.equal(player.credits, before);
  assert.equal(orders(world).length, 0);
});

test('completed cycle consumes its own freeze, sells all free goods and buys positive-profit coverage atomically', () => {
  const { world, player, group, recipe } = setup();
  const wheat = inventoryForProvince(player, 'wheat', provinceId);
  const unrelated = inventoryForProvince(player, 'fruit', provinceId);
  unrelated.available = 7;
  freezeCommodity(unrelated, 'contract', 'supplier-one', 2);
  reconcileBuildingInputFreezes(world, player, now);
  assert.equal(wheat.available, 0);
  assert.equal(wheat.frozen, recipe.inputs[0].quantity);
  const source = buildingFreezeSource(group);
  settle(world, now + recipe.cycleMs);
  assert.equal(group.lifetimeOutput, recipe.output.quantity);
  assert.equal(wheat.available, 0);
  assert.equal(frozenForSource(wheat, 'production', source), recipe.inputs[0].quantity * 2);
  assert.equal(unrelated.available, 0);
  assert.equal(frozenForSource(unrelated, 'contract', 'supplier-one'), 2);
  assert.equal(inventoryForProvince(player, 'flour', provinceId).available, 0);
  assert.equal(orders(world).filter((o) => o.side === 'buy').reduce((n, o) => n + o.quantity, 0), recipe.inputs[0].quantity * 2);
  assert.ok(orders(world).every((o) => o.status === 'filled' && o.remaining === 0));
  for (const inventory of Object.values(player.inventories)) assertCommodityFreezeInvariant(inventory);
  const before = structuredClone({ credits: player.credits, orders: orders(world), inventories: player.inventories });
  assert.equal(completeBuildingCycleAutoOperation(world, player, group, 'production', now + recipe.cycleMs, now + recipe.cycleMs), false);
  settle(world, now + recipe.cycleMs);
  assert.deepEqual({ credits: player.credits, orders: orders(world), inventories: player.inventories }, before);
});

test('net margin includes sale fee and does not use former base-price bounds', () => {
  for (const [flour, shouldBuy] of [[18.78, false], [18.79, true], [18.60, false]]) {
    const { world, player, recipe } = setup('mill', { wheat: 5, flour });
    assert.equal(recipe.operatingCost, 8.6);
    assert.equal(recipe.inputs[0].quantity, 2);
    settle(world, now + recipe.cycleMs);
    const bought = orders(world).some((o) => o.side === 'buy');
    assert.equal(bought, shouldBuy, `margin after 1% fee at flour ${flour}`);
    assert.equal(inventoryForProvince(player, 'wheat', provinceId).frozen > 0, shouldBuy);
  }
});

test('region automatic sale is explicit opt-in; stock is not liquidated by a default-enabled building', () => {
  const { world, player, recipe } = setup('farm', { wheat: 2 });
  delete player.provinceAutoSaleEnabled;
  inventoryForProvince(player, 'fruit', provinceId).available = 9;
  settle(world, now + recipe.cycleMs);
  assert.equal(inventoryForProvince(player, 'fruit', provinceId).available, 9);
  assert.equal(orders(world).length, 0);
});

test('automatic procurement cannot spend operating cash or manufacture goods when funds are insufficient', () => {
  const { world, player, recipe } = setup();
  player.credits = recipe.operatingCost;
  player.provinceAutoSaleEnabled[provinceId] = false;
  settle(world, now + recipe.cycleMs);
  assert.equal(player.credits, 0);
  assert.equal(orders(world).length, 0);
  assert.equal(inventoryForProvince(player, 'wheat', provinceId).frozen, 0);
});

test('late settlement never uses newly purchased goods to manufacture cycles during prior downtime', () => {
  const { world, player, group, recipe } = setup();
  settle(world, now + recipe.cycleMs * 10);
  assert.equal(group.lifetimeOutput, recipe.output.quantity);
  assert.equal(group.cycleStartedAt, now + recipe.cycleMs * 10);
  const plans = buildingInputPlans(world, player, now + recipe.cycleMs * 10, provinceId);
  assert.equal(inventoryForProvince(player, 'wheat', provinceId).frozen, planInputTotals(plans[0]).wheat);
  settle(world, now + recipe.cycleMs * 10);
  assert.equal(group.lifetimeOutput, recipe.output.quantity);
});

test('production and sale never draw on frozen goods or stock in a different region', () => {
  const { world, player, recipe } = setup();
  const input = inventoryForProvince(player, 'wheat', provinceId);
  freezeCommodity(input, 'auction', 'auction-one', input.available);
  const elsewhere = inventoryForProvince(player, 'wheat', '120000');
  elsewhere.available = 100;
  settle(world, now + recipe.cycleMs);
  assert.equal(player.facilityGroups[0].lifetimeOutput, 0);
  assert.equal(elsewhere.available, 100);
  assert.equal(frozenForSource(input, 'auction', 'auction-one'), recipe.inputs[0].quantity);
  assert.equal(orders(world).length, 0);
});

test('exact zero net profit is not positive and incomplete prices cannot trigger procurement', () => {
  for (const prices of [{ wheat: 5.6, flour: 20 }, { wheat: 5, flour: undefined }]) {
    const { world, player, recipe } = setup('mill', prices);
    player.provinceAutoSaleEnabled = {};
    settle(world, now + recipe.cycleMs);
    assert.equal(orders(world).some((order) => order.side === 'buy'), false);
    assert.equal(inventoryForProvince(player, 'wheat', provinceId).available + inventoryForProvince(player, 'wheat', provinceId).frozen, 0);
  }
});

test('multi-input procurement preflights the whole batch and leaves operating cash intact', () => {
  const type = FACILITY_TYPE_CATALOG.find((entry) => (entry.recipes.find((r) => r.id === entry.defaultRecipeId) || entry.recipes[0]).inputs.length > 1);
  assert.ok(type);
  const { world, player, recipe } = setup(type.id, {});
  player.provinceAutoSaleEnabled = {};
  let inputs = 0;
  for (const item of recipe.inputs) {
    world.markets[provinceScopedKey(provinceId, item.productId)].officialPrice = 1;
    inputs += item.quantity;
  }
  world.markets[provinceScopedKey(provinceId, recipe.output.productId)].officialPrice = 100_000;
  player.credits = recipe.operatingCost * 2 + inputs - 0.01;
  settle(world, now + recipe.cycleMs);
  assert.ok(player.facilityGroups[0].lifetimeOutput > 0);
  assert.equal(orders(world).some((order) => order.side === 'buy'), false);
  for (const item of recipe.inputs) {
    const inventory = inventoryForProvince(player, item.productId, provinceId);
    assert.equal(inventory.available + inventory.frozen, 0, 'no partially bought material batch');
  }
  assert.ok(player.credits >= recipe.operatingCost);
});
