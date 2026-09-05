import assert from 'node:assert/strict';
import test from 'node:test';
import {
  COMMERCIAL_BUILDING_TYPE_CATALOG,
  applyCommercialBuildingAction,
  processCommercialWorld,
} from '../src/commercial-buildings.js';
import { createWorld, ensurePlayer } from '../src/domain.js';
import { migrateFacilityGroupWorld, processFacilityGroupWorld } from '../src/facility-groups.js';
import { inventoryForProvince } from '../src/provinces.js';

const user = { id: 77102, email: 'commercial-facility@example.com', name: 'Independent operations' };
const now = 1_800_000_000_000;
const provinceId = '110000';
const commercialTypeId = 'clothing-store';

function setup() {
  const world = createWorld(now);
  const player = ensurePlayer(world, user, now);
  player.credits = 10_000;
  player.facilityGroups = [{
    facilityTypeId: 'farm', provinceId, count: 2, participatingCount: 2,
    enabled: true, status: 'running', activeRecipeId: 'wheat-crop',
    cycleStartedAt: now, lifetimeOutput: 0,
  }];
  migrateFacilityGroupWorld(world, now);
  inventoryForProvince(player, 'clothing', provinceId).available = 5;
  const type = COMMERCIAL_BUILDING_TYPE_CATALOG.find((candidate) => candidate.id === commercialTypeId);
  assert.ok(type);
  const operate = (operation, time, quantity) => applyCommercialBuildingAction(world, user, {
    operation, provinceId, commercialTypeId, quantity,
  }, time);
  assert.equal(operate('build', now + 1, 1).ok, true);
  assert.equal(operate('start', now + 2).ok, true);
  const group = player.commercialBuildingGroups.find((candidate) => candidate.commercialTypeId === commercialTypeId);
  assert.ok(group);
  return { world, player, type, group, operate };
}

test('commercial and industrial cycles retain independent participation, intent and settlement', () => {
  const { world, player, type, group, operate } = setup();
  const commercialBeforeProduction = structuredClone(group);
  const wheatBefore = inventoryForProvince(player, 'wheat', provinceId).available;

  processFacilityGroupWorld(world, now + 20_000);
  assert.equal(player.facilityGroups[0].lifetimeOutput, 2);
  assert.equal(inventoryForProvince(player, 'wheat', provinceId).available, wheatBefore + 2);
  assert.deepEqual(group, commercialBeforeProduction, 'industrial settlement cannot rewrite commercial locked values');

  const industryBeforeStop = structuredClone(player.facilityGroups);
  const lockedRevenue = group.pendingRevenue;
  assert.equal(operate('stop', now + 20_001).ok, true);
  assert.equal(group.enabled, false);
  assert.equal(group.status, 'running');
  assert.equal(group.participatingCount, 1);
  assert.deepEqual(player.facilityGroups, industryBeforeStop, 'commercial switch cannot stop industrial operation');

  processCommercialWorld(world, group.cycleCompletesAt);
  assert.equal(group.status, 'stopped');
  assert.equal(group.lifetimeRevenue, lockedRevenue);
  assert.equal(group.lifetimeProfit, type.profitPerCycle);
  assert.deepEqual(player.facilityGroups, industryBeforeStop, 'commercial settlement cannot advance industrial cycles');
});

test('commercial expansion changes nominal capacity without rewriting either invested cycle', () => {
  const { world, player, type, group, operate } = setup();
  const industryBeforeExpansion = structuredClone(player.facilityGroups);
  const locked = {
    participatingCount: group.participatingCount,
    revenue: group.pendingRevenue,
    profit: group.pendingProfit,
    completesAt: group.cycleCompletesAt,
  };
  assert.equal(operate('build', now + 3, 2).ok, true);
  assert.equal(group.count, 3);
  assert.equal(group.participatingCount, locked.participatingCount);
  assert.equal(group.pendingRevenue, locked.revenue);
  assert.equal(group.pendingProfit, locked.profit);
  assert.equal(group.cycleCompletesAt, locked.completesAt);
  assert.equal(inventoryForProvince(player, 'clothing', provinceId).available, 4);
  assert.deepEqual(player.facilityGroups, industryBeforeExpansion);

  processCommercialWorld(world, locked.completesAt);
  assert.equal(group.lifetimeProfit, type.profitPerCycle);
  assert.equal(group.participatingCount, 3);
  assert.equal(group.pendingEffectiveCount, 2);
  assert.equal(group.pendingStaffingRateBps, 8332);
  assert.equal(group.staffingBatchCarryBps, 4996);
  assert.equal(group.pendingProfit, type.profitPerCycle * 2);
  assert.equal(inventoryForProvince(player, 'clothing', provinceId).available, 2);
  assert.deepEqual(player.facilityGroups, industryBeforeExpansion);
});

test('commercial action rejects an industrial type without touching either asset domain', () => {
  const { world, player } = setup();
  const before = structuredClone({
    credits: player.credits,
    industrial: player.facilityGroups,
    commercial: player.commercialBuildingGroups,
  });
  const result = applyCommercialBuildingAction(world, user, {
    operation: 'stop', provinceId, commercialTypeId: 'farm',
  }, now + 3);
  assert.equal(result.ok, false);
  assert.deepEqual({
    credits: player.credits,
    industrial: player.facilityGroups,
    commercial: player.commercialBuildingGroups,
  }, before);
});
