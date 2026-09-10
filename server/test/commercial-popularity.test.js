import assert from 'node:assert/strict';
import test from 'node:test';
import { ensurePlayerResearch } from '../src/research.js';
import {
  COMMERCIAL_BUILDING_TYPE_CATALOG,
  applyCommercialBuildingAction,
  processCommercialWorld,
} from '../src/commercial-buildings.js';
import { createWorld, ensurePlayer } from '../src/domain.js';
import { inventoryForProvince } from '../src/provinces.js';

const user = { id: 77111, email: 'popularity@example.com', name: 'Popularity' };
const now = 1_800_000_000_000;
const provinceId = '110000';

function setup() {
  const world = createWorld(now);
  const player = ensurePlayer(world, user, now);
  ensurePlayerResearch(world, player, now);
  player.research.completedTechnologyIds.push('urban-commerce', 'department-retail');
  player.credits = 20_000;
  return { world, player };
}

function typeFor(id = 'convenience-store') {
  const type = COMMERCIAL_BUILDING_TYPE_CATALOG.find((candidate) => candidate.id === id);
  assert.ok(type);
  return type;
}

function stock(player, type, count) {
  for (const input of type.consumptionInputs) {
    inventoryForProvince(player, input.productId, provinceId).available = input.quantity * count;
  }
}

function stoppedGroup(type, overrides = {}) {
  return {
    commercialTypeId: type.id,
    provinceId,
    count: 1,
    participatingCount: 0,
    enabled: false,
    status: 'stopped',
    statusReason: 'manual',
    staffingRateBps: 10_000,
    staffingUpdatedAt: now,
    staffingBatchCarryBps: 0,
    popularity: 0,
    popularityProtectionCycles: 0,
    serviceLevel: 'standard',
    promotionCyclesRemaining: 0,
    promotionCoveredCount: 0,
    lifetimeRevenue: 0,
    lifetimeProfit: 0,
    lifetimeGoodsConsumed: 0,
    lifetimeFootfall: 0,
    ...overrides,
  };
}

test('new commercial groups start at zero popularity and commit locked footfall at settlement', () => {
  const { world, player } = setup();
  const type = typeFor();
  stock(player, type, 1);
  assert.equal(applyCommercialBuildingAction(world, user, {
    operation: 'build', provinceId, commercialTypeId: type.id, quantity: 1,
  }, now + 1).ok, true);
  const group = player.commercialBuildingGroups[0];
  assert.equal(group.popularity, 0);
  assert.equal(group.pendingStarRating, 1);
  assert.equal(group.pendingProfit, type.profitPerCycleByStar[0]);
  assert.equal(group.pendingFootfall, 100);
  assert.equal(group.pendingTargetFootfall, 100);
  assert.equal(group.pendingPopularityChange, 2);
  assert.equal(group.popularityProtectionCycles, 1);

  applyCommercialBuildingAction(world, user, { operation: 'stop', provinceId, commercialTypeId: type.id }, now + 2);
  processCommercialWorld(world, group.cycleCompletesAt);
  assert.equal(group.popularity, 2);
  assert.equal(group.lastFootfall, 100);
  assert.equal(group.lastTargetFootfall, 100);
  assert.equal(group.lastPopularityChange, 2);
  assert.equal(group.lifetimeFootfall, 100);
  assert.equal(player.stats.commercialFootfall, 100);
});

test('star profit, premium service cost and traffic are locked when a cycle begins', () => {
  const { world, player } = setup();
  const type = typeFor();
  const group = stoppedGroup(type, { count: 2, popularity: 21 });
  player.commercialBuildingGroups.push(group);
  stock(player, type, 2);

  assert.equal(applyCommercialBuildingAction(world, user, {
    operation: 'service-level', provinceId, commercialTypeId: type.id, serviceLevel: 'premium',
  }, now + 1).ok, true);
  const creditsBefore = player.credits;
  assert.equal(applyCommercialBuildingAction(world, user, {
    operation: 'start', provinceId, commercialTypeId: type.id,
  }, now + 2).ok, true);
  assert.equal(group.pendingStarRating, 2);
  assert.equal(group.pendingProfit, type.profitPerCycleByStar[1] * 2);
  assert.equal(group.pendingServiceLevel, 'premium');
  assert.equal(group.pendingServiceCost, type.premiumServiceCostPerCycle * 2);
  assert.equal(group.pendingFootfall, 250);
  assert.equal(group.pendingTargetFootfall, 220);
  assert.equal(player.credits, creditsBefore - type.operatingCost * 2 - type.premiumServiceCostPerCycle * 2);
  assert.equal(player.stats.commercialServiceCosts, type.premiumServiceCostPerCycle * 2);
});

test('promotion covers three effective cycles for the purchased store count', () => {
  const { world, player } = setup();
  const type = typeFor();
  const group = stoppedGroup(type, { count: 2, popularity: 21 });
  player.commercialBuildingGroups.push(group);
  stock(player, type, 2);
  const creditsBefore = player.credits;

  assert.equal(applyCommercialBuildingAction(world, user, {
    operation: 'promote', provinceId, commercialTypeId: type.id,
  }, now + 1).ok, true);
  assert.equal(player.credits, creditsBefore - type.promotionCostPerBuilding * 2);
  assert.equal(group.promotionCyclesRemaining, 3);
  assert.equal(group.promotionCoveredCount, 2);
  assert.equal(applyCommercialBuildingAction(world, user, {
    operation: 'start', provinceId, commercialTypeId: type.id,
  }, now + 2).ok, true);
  assert.equal(group.pendingPromotionActive, true);
  assert.equal(group.pendingFootfall, 300);
  assert.equal(group.pendingTargetFootfall, 220);
  assert.equal(group.pendingPopularityChange, 3);
  assert.equal(group.promotionCyclesRemaining, 2);
  assert.equal(player.stats.commercialPromotionCosts, type.promotionCostPerBuilding * 2);
});

test('expansion keeps popularity and existing promotion coverage while granting one decline-protection cycle', () => {
  const { world, player } = setup();
  const type = typeFor();
  const group = stoppedGroup(type, {
    popularity: 61, promotionCyclesRemaining: 3, promotionCoveredCount: 1,
  });
  player.commercialBuildingGroups.push(group);
  assert.equal(applyCommercialBuildingAction(world, user, {
    operation: 'build', provinceId, commercialTypeId: type.id, quantity: 1,
  }, now + 1).ok, true);
  assert.equal(group.count, 2);
  assert.equal(group.popularity, 61);
  assert.equal(group.promotionCoveredCount, 1);
  assert.equal(group.popularityProtectionCycles, 1);
  assert.equal(group.enabled, false);
});

test('decline protection suppresses zero-footfall loss but is consumed only by a started cycle', () => {
  const { world, player } = setup();
  const type = typeFor();
  const group = stoppedGroup(type, {
    popularity: 50, popularityProtectionCycles: 1, staffingRateBps: 0,
  });
  player.commercialBuildingGroups.push(group);
  assert.equal(applyCommercialBuildingAction(world, user, {
    operation: 'start', provinceId, commercialTypeId: type.id,
  }, now + 1).ok, true);
  assert.equal(group.pendingFootfall, 0);
  assert.equal(group.pendingTargetFootfall, 130);
  assert.equal(group.pendingPopularityChange, 0);
  assert.equal(group.popularityProtectionCycles, 0);
});
