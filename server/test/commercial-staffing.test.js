import assert from 'node:assert/strict';
import test from 'node:test';
import { createWorld, ensurePlayer } from '../src/domain.js';
import { applyCommercialBuildingAction, COMMERCIAL_BUILDING_TYPE_CATALOG, ensureCommercialPlayer, processCommercialWorld } from '../src/commercial-buildings.js';
import { nextCommercialBuildingDeadline } from '../src/commercial-building-deadline.js';
import { inventoryForProvince, provinceScopedKey } from '../src/provinces.js';
import { hasCommercialCycle, projectCommercialStaffingRate } from '../../shared/commercial-staffing.js';

const now = 1_800_000_000_000;
const provinceId = '110000';
const user = { id: 77121, email: 'staffing@example.com', name: 'Staffing' };
const type = COMMERCIAL_BUILDING_TYPE_CATALOG.find((entry) => entry.id === 'convenience-store');
function setup(count = 2) {
  const world = createWorld(now);
  const player = ensurePlayer(world, user, now);
  player.credits = 100_000;
  player.commercialBuildingGroups = [{
    commercialTypeId: type.id,
    provinceId,
    count,
    participatingCount: 0,
    enabled: false,
    status: 'stopped',
    statusReason: 'manual',
    staffingRateBps: 10_000,
    staffingUpdatedAt: now,
    staffingBatchCarryBps: 0,
    lifetimeRevenue: 0,
    lifetimeProfit: 0,
    lifetimeGoodsConsumed: 0,
  }];
  ensureCommercialPlayer(player, now);
  const group = player.commercialBuildingGroups[0];
  for (const input of type.consumptionInputs) {
    inventoryForProvince(player, input.productId, provinceId).available = 1000;
    world.markets[provinceScopedKey(provinceId, input.productId)].officialPrice = 10;
  }
  return { world, player, group };
}
function action(world, operation, at, extra = {}) {
  const result = applyCommercialBuildingAction(world, user, { operation, provinceId, commercialTypeId: type.id, ...extra }, at);
  assert.equal(result.ok, true, result.message);
  return result;
}

test('commercial cycle locks staffing, integer inputs, costs and profit at start', () => {
  const { world, player, group } = setup(3);
  group.staffingRateBps = 5000;
  action(world, 'start', now);
  assert.equal(group.participatingCount, 3);
  assert.equal(group.pendingEffectiveCount, 1);
  assert.equal(group.pendingStaffingRateBps, 5000);
  assert.equal(group.staffingBatchCarryBps, 5000);
  assert.equal(group.pendingProfit, type.profitPerCycle);
  assert.equal(group.pendingOperatingCost, type.operatingCost);
  assert.deepEqual(group.pendingInputs, type.consumptionInputs);
  const locked = group.pendingRevenue;
  action(world, 'build', now + 60_000, { quantity: 3 });
  assert.equal(group.count, 6); assert.equal(group.participatingCount, 3);
  assert.equal(group.pendingEffectiveCount, 1); assert.equal(group.pendingRevenue, locked);
  assert.equal(group.staffingRateBps, 3000);
  world.markets[provinceScopedKey(provinceId, 'food')].officialPrice = 99;
  action(world, 'stop', now + 120_000);
  processCommercialWorld(world, now + type.cycleMs);
  assert.equal(group.lifetimeRevenue, locked); assert.equal(group.lifetimeProfit, type.profitPerCycle);
  assert.equal(player.stats.commercialGoodsConsumed, 2);
  assert.equal(group.pendingEffectiveCount, undefined);
  assert.equal(group.cycleActive, undefined);
});

test('zero staffing enters a real recovery cycle and is included in the scheduler deadline', () => {
  const { world, player, group } = setup(2);
  group.staffingRateBps = 0;
  const cash = player.credits;
  action(world, 'start', now);
  assert.equal(group.status, 'running'); assert.equal(group.cycleActive, true);
  assert.equal(group.pendingRevenue, 0); assert.equal(group.pendingEffectiveCount, 0);
  assert.equal(player.credits, cash);
  assert.equal(nextCommercialBuildingDeadline(world), now + type.cycleMs);
  const firstDeadline = group.cycleCompletesAt;
  action(world, 'start', now + 1000);
  assert.equal(group.cycleCompletesAt, firstDeadline);
  ensureCommercialPlayer(player, now + 2000);
  assert.equal(hasCommercialCycle(group), true);
  processCommercialWorld(world, firstDeadline);
  assert.equal(group.pendingEffectiveCount, 1); assert.equal(group.pendingStaffingRateBps, 5000);
  processCommercialWorld(world, firstDeadline + type.cycleMs);
  assert.equal(group.pendingEffectiveCount, 2); assert.equal(group.pendingStaffingRateBps, 10000);
  assert.equal(group.lifetimeProfit, type.profitPerCycle);
});

test('stopping a zero-output cycle cannot mint carry or restart its deadline', () => {
  const { world, group } = setup(1);
  group.staffingRateBps = 5000;
  action(world, 'start', now);
  assert.equal(group.pendingEffectiveCount, 0); assert.equal(group.staffingBatchCarryBps, 5000);
  const deadline = group.cycleCompletesAt;
  for (let index = 1; index <= 5; index += 1) {
    action(world, 'stop', now + index * 100);
    action(world, 'start', now + index * 100 + 1);
    assert.equal(group.cycleCompletesAt, deadline);
    assert.equal(group.staffingBatchCarryBps, 5000);
  }
  action(world, 'stop', now + 1000);
  processCommercialWorld(world, deadline);
  assert.equal(group.status, 'stopped'); assert.equal(group.lifetimeProfit, 0);
});

test('disabling procurement does not change staffing direction; stopping does', () => {
  const { world, group } = setup();
  group.staffingRateBps = 5000;
  action(world, 'start', now);
  action(world, 'auto-operation', now + 60_000, { policy: { enabled: false, inputCoverageCycles: 2 } });
  assert.equal(projectCommercialStaffingRate(group, now + 60_000), 6000);
  action(world, 'stop', now + 60_000);
  assert.equal(projectCommercialStaffingRate(group, now + 240_000), 5000);
});

test('persistent shortage decays from one baseline instead of losing fractional time on every poll', () => {
  const { world, player, group } = setup();
  inventoryForProvince(player, 'food', provinceId).available = 0;
  action(world, 'start', now);
  assert.equal(group.status, 'error');
  for (let offset = 1; offset <= 500; offset += 1) processCommercialWorld(world, now + offset);
  assert.equal(group.staffingUpdatedAt, now);
  assert.equal(projectCommercialStaffingRate(group, now + 500), 9998);
});

test('legacy invested amounts survive migration and missing staffing does not retroactively decay', () => {
  const { world, player, group } = setup();
  action(world, 'start', now);
  action(world, 'stop', now + 1);
  const locked = group.pendingRevenue;
  delete group.staffingRateBps; delete group.staffingUpdatedAt; delete group.staffingBatchCarryBps;
  delete group.cycleActive; delete group.pendingEffectiveCount; delete group.pendingStaffingRateBps;
  ensureCommercialPlayer(player, now + type.cycleMs * 2);
  assert.equal(group.staffingRateBps, 10000);
  assert.equal(group.staffingUpdatedAt, now + type.cycleMs * 2);
  assert.equal(group.pendingRevenue, locked);
  assert.equal(group.pendingEffectiveCount, undefined);
  processCommercialWorld(world, now + type.cycleMs * 2);
  assert.equal(group.lifetimeRevenue, locked);
});

test('staffed operation remains local and does not write market volumes', () => {
  const { world, player, group } = setup(4);
  group.staffingRateBps = 5000;
  const market = world.markets[provinceScopedKey(provinceId, 'food')];
  const volume = Number(market.todayBuyQuantity || 0);
  inventoryForProvince(player, 'food', '120000').available = 99;
  action(world, 'start', now);
  action(world, 'stop', now + 1);
  processCommercialWorld(world, now + type.cycleMs);
  assert.equal(inventoryForProvince(player, 'food', provinceId).available, 998);
  assert.equal(inventoryForProvince(player, 'food', '120000').available, 99);
  assert.equal(Number(market.todayBuyQuantity || 0), volume);
  assert.equal(group.lifetimeProfit, 2 * type.profitPerCycle);
});
