import assert from 'node:assert/strict';
import test from 'node:test';
import { createWorld, ensurePlayer } from '../src/domain.js';
import { applyCommercialBuildingAction, processCommercialWorld, COMMERCIAL_BUILDING_TYPE_CATALOG } from '../src/commercial-buildings.js';
import { applyOnlineAutoBuy } from '../src/online-auto-buy.js';
import { applyOnlineAutoSell } from '../src/online-auto-sell.js';
import { factoryAutoTradeExecutionPolicyFor } from '../src/factory-auto-operation.js';
import { buildingFreezeSource, buildingInputPlans, planInputTotals, reconcileBuildingInputFreezes } from '../src/building-input-freezes.js';
import { frozenForSource } from '../src/commodity-freezes.js';
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
  const group = {
    commercialTypeId,
    provinceId,
    count,
    participatingCount: 0,
    enabled: true,
    status: 'error',
    statusReason: 'insufficient_input',
    staffingRateBps: 10_000,
    staffingUpdatedAt: now,
    staffingBatchCarryBps: 0,
    lifetimeRevenue: 0,
    lifetimeProfit: 0,
    lifetimeGoodsConsumed: 0,
  };
  player.commercialBuildingGroups = [group];
  for (const input of type.consumptionInputs) world.markets[provinceScopedKey(provinceId, input.productId)].officialPrice = 15;
  return { world, player, group, type };
}
function setPolicy(world, policy, owner = user, region = provinceId) {
  return applyCommercialBuildingAction(world, owner, { operation: 'auto-operation', provinceId: region, commercialTypeId: 'convenience-store', policy }, now + 2);
}

test('commercial auto settings are strict, owned and independent of running intent', () => {
  const { world, player, group } = setup();
  group.autoOperationPolicy = { enabled: false, inputCoverageCycles: 2 };
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
  assert.equal(factoryAutoTradeExecutionPolicyFor(player, 'food', provinceId).buy.enabled, false);
  assert.deepEqual(group, original);
});

test('commercial completion buys and freezes next-cycle goods at official prices without moving other-region stock', () => {
  const { world, player, group, type } = setup(1);
  for (const input of type.consumptionInputs) inventoryForProvince(player, input.productId, provinceId).available = input.quantity * 2;
  inventoryForProvince(player, 'food', other).available = 77;
  inventoryForProvince(player, 'fruit', provinceId).available = 4;
  const market = world.markets[provinceScopedKey(provinceId, 'food')];
  const before = Number(market.todayBuyQuantity || 0);
  applyCommercialBuildingAction(world, user, { operation: 'start', provinceId, commercialTypeId: type.id }, now + 1);
  assert.equal(Number(market.todayBuyQuantity || 0), before, 'prepared first cycles must not buy before completion');
  const dueAt = group.cycleCompletesAt;
  processCommercialWorld(world, dueAt - 1);
  assert.equal(Number(market.todayBuyQuantity || 0), before);
  processCommercialWorld(world, dueAt);
  assert.equal(player.autoOperationCycleCursors[`commercial:${buildingFreezeSource(group, 'commercial')}`], dueAt);
  assert.equal(group.status, 'running');
  assert.ok(Number(market.todayBuyQuantity || 0) > before);
  const stock = inventoryForProvince(player, 'food', provinceId);
  assert.equal(stock.available, 0);
  assert.ok(frozenForSource(stock, 'commercial', buildingFreezeSource(group, 'commercial')) > 0);
  assert.equal(inventoryForProvince(player, 'food', other).available, 77);
  assert.equal(inventoryForProvince(player, 'fruit', provinceId).available, 0);
  const snapshot = structuredClone({ stock, credits: player.credits, bought: market.todayBuyQuantity });
  processCommercialWorld(world, dueAt);
  assert.deepEqual({ stock, credits: player.credits, bought: market.todayBuyQuantity }, snapshot);
});

test('missing first commercial inputs use purchase-only bootstrap while legacy direct requests stay disabled', () => {
  const { world, player, group, type } = setup(1);
  group.autoOperationBootstrapPending = true;
  const before = player.credits;
  const market = world.markets[provinceScopedKey(provinceId, 'food')];
  const buyBefore = Number(market.todayBuyQuantity || 0);
  applyCommercialBuildingAction(world, user, { operation: 'start', provinceId, commercialTypeId: type.id }, now + 1);
  assert.equal(group.status, 'running');
  assert.ok(Number(market.todayBuyQuantity || 0) > buyBefore);
  assert.ok(player.credits < before);
  assert.equal(Object.keys(player.autoOperationCycleCursors || {}).length, 0);
  assert.equal(applyOnlineAutoBuy(world, user, { provinceId, productId: 'food' }, now + 1).ok, false);
  assert.equal(applyOnlineAutoSell(world, user, { provinceId, productId: 'food' }, now + 1).ok, false);
});

test('commercial consumers keep separate real freezes and procurement-off retains only one unconsumed cycle', () => {
  const { world, player, group } = setup(3);
  inventoryForProvince(player, 'food', provinceId).available = 100;
  reconcileBuildingInputFreezes(world, player, now, provinceId);
  const stock = inventoryForProvince(player, 'food', provinceId);
  assert.equal(frozenForSource(stock, 'commercial', buildingFreezeSource(group, 'commercial')), 6);
  group.autoOperationPolicy = { enabled: false, inputCoverageCycles: 5 };
  reconcileBuildingInputFreezes(world, player, now, provinceId);
  assert.equal(frozenForSource(stock, 'commercial', buildingFreezeSource(group, 'commercial')), 3);
  group.enabled = false;
  reconcileBuildingInputFreezes(world, player, now, provinceId);
  assert.equal(stock.frozen, 0);
  assert.equal(stock.available, 100);
});

test('server locks all commercial settlement details across price, count and policy changes', () => {
  const { world, player, type } = setup(1);
  for (const input of type.consumptionInputs) inventoryForProvince(player, input.productId, provinceId).available = input.quantity * 2;
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

test('zero-effective recovery is a real completed cycle; bootstrap waits until a positive batch exists', () => {
  const { world, player, group } = setup(3);
  group.staffingRateBps = 0;
  group.staffingUpdatedAt = now;
  group.status = 'error';
  group.statusReason = 'insufficient_input';
  const before = player.credits;
  const market = world.markets[provinceScopedKey(provinceId, 'food')];
  processCommercialWorld(world, now + 1);
  assert.equal(player.credits, before);
  assert.equal(group.status, 'running');
  assert.equal(group.pendingEffectiveCount, 0);
  assert.equal(Number(market.todayBuyQuantity || 0), 0);
  const dueAt = group.cycleCompletesAt;
  processCommercialWorld(world, dueAt);
  assert.equal(player.autoOperationCycleCursors[`commercial:${buildingFreezeSource(group, 'commercial')}`], dueAt);
  assert.ok(Number(market.todayBuyQuantity || 0) > 0);
  assert.ok(player.credits < before);
  assert.equal(group.status, 'running');
});
