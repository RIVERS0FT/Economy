import assert from 'node:assert/strict';
import test from 'node:test';
import { createProductionSettlementClaim, dueProductionCycles, projectProductionCycles } from '../../shared/production-settlement.js';
import { createWorld, ensurePlayer } from '../src/domain.js';
import { migrateFacilityGroupWorld } from '../src/facility-groups.js';
import { DEFAULT_PROVINCE_ID, provinceScopedKey } from '../src/provinces.js';
import {
  applyProductionSettlementClaim,
  createProductionSettlementBasis,
} from '../src/production-settlement.js';
import { createWorldDeadlinePlan } from '../src/world-deadline-planner.js';

const now = 1_700_000_000_000;
const user = { id: 1, email: 'lazy-production@example.com', name: 'Lazy Production' };

function farmGroup(overrides = {}) {
  return {
    facilityTypeId: 'farm',
    count: 1,
    participatingCount: 1,
    enabled: true,
    status: 'running',
    activeRecipeId: 'wheat-crop',
    lifetimeOutput: 0,
    cycleStartedAt: now,
    staffingRateBps: 10_000,
    staffingUpdatedAt: now,
    staffingBatchCarryBps: 0,
    ...overrides,
  };
}

function productionWorld() {
  const world = createWorld(now);
  const player = ensurePlayer(world, user, now);
  player.credits = 1_000;
  player.factoryAutoOperationPolicies = { [provinceScopedKey(DEFAULT_PROVINCE_ID, 'farm')]: { enabled: false, inputCoverageCycles: 2, mode: 'balanced', outputMode: 'surplus' } };
  player.facilityGroups = [farmGroup()];
  migrateFacilityGroupWorld(world, now);
  return { world, player };
}

test('closed-form production projection matches full staffing cycles without replaying each cycle', () => {
  const group = {
    status: 'running',
    enabled: true,
    cycleStartedAt: now,
    staffingRateBps: 10_000,
    staffingUpdatedAt: now,
    staffingBatchCarryBps: 0,
    participatingCount: 7,
    recipe: { cycleMs: 20_000, operatingCostMicros: '1000000', inputs: [], output: { quantity: 1 } },
  };
  const projection = projectProductionCycles(group, 1_000_000);
  assert.equal(projection.effectiveUnits, 7_000_000n);
  assert.equal(projection.finalStaffingRateBps, 10_000);
  assert.equal(projection.finalCarryBps, 0);
});

test('client proposal settles the maximum legal overdue production and server verifies it atomically', () => {
  const { world, player } = productionWorld();
  const settleThrough = now + 200_000;
  const basis = createProductionSettlementBasis(world, user.id, settleThrough);
  const claim = createProductionSettlementClaim(basis);
  assert.ok(claim);
  assert.ok(basis.basisId);
  assert.equal(claim.basisId, basis.basisId);
  assert.equal(dueProductionCycles(basis.groups[0], settleThrough), 10);
  assert.equal(claim.groups[0].completedCycles, 10);

  const result = applyProductionSettlementClaim(world, user.id, claim, settleThrough);
  assert.equal(result.ok, true);
  assert.equal(player.credits, 990);
  assert.equal(player.inventories.wheat.available, 10);
  assert.equal(player.facilityGroups[0].lifetimeOutput, 10);
  assert.equal(player.facilityGroups[0].cycleStartedAt, settleThrough);
});

test('authoritative resource drift marks a fingerprinted proposal stale before mutating production', () => {
  const { world, player } = productionWorld();
  const settleThrough = now + 200_000;
  const basis = createProductionSettlementBasis(world, user.id, settleThrough);
  const claim = createProductionSettlementClaim(basis);
  assert.ok(claim?.basisId);
  player.credits -= 1;
  const before = structuredClone(world);
  assert.throws(
    () => applyProductionSettlementClaim(world, user.id, claim, settleThrough),
    (error) => error?.code === 'PRODUCTION_SETTLEMENT_STALE' && error?.statusCode === 409,
  );
  assert.deepEqual(world, before);
});

test('server rejects an over-reported client production claim', () => {
  const { world } = productionWorld();
  const settleThrough = now + 200_000;
  const basis = createProductionSettlementBasis(world, user.id, settleThrough);
  const claim = createProductionSettlementClaim(basis);
  claim.groups[0].completedCycles += 1;
  assert.throws(
    () => applyProductionSettlementClaim(world, user.id, claim, settleThrough),
    (error) => error?.code === 'PRODUCTION_SETTLEMENT_INVALID' && error?.statusCode === 409,
  );
});

test('server rejects an under-reported claim when one more cycle still fits authoritative resources', () => {
  const { world } = productionWorld();
  const settleThrough = now + 200_000;
  const basis = createProductionSettlementBasis(world, user.id, settleThrough);
  const claim = createProductionSettlementClaim(basis);
  claim.groups[0].completedCycles -= 1;
  assert.throws(
    () => applyProductionSettlementClaim(world, user.id, claim, settleThrough),
    (error) => error?.code === 'PRODUCTION_SETTLEMENT_INVALID' && error?.statusCode === 409,
  );
});

test('resource-bound proposal stops at the maximum affordable cycle and marks the group blocked', () => {
  const { world, player } = productionWorld();
  player.credits = 3;
  const settleThrough = now + 200_000;
  const basis = createProductionSettlementBasis(world, user.id, settleThrough);
  const claim = createProductionSettlementClaim(basis);
  assert.equal(claim.groups[0].completedCycles, 3);

  applyProductionSettlementClaim(world, user.id, claim, settleThrough);
  assert.equal(player.credits, 0);
  assert.equal(player.inventories.wheat.available, 3);
  assert.equal(player.facilityGroups[0].lifetimeOutput, 3);
  assert.equal(player.facilityGroups[0].cycleStartedAt >= now + 60_000, true);
});

test('production wage settlement is batch invariant across an old first-cycle multiplier', () => {
  const combined = productionWorld();
  const split = productionWorld();
  for (const { world, player } of [combined, split]) {
    world.populationEconomy.policy.productionWageMultiplierBps = 10_000;
    player.facilityGroups[0].cycleWageMultiplierBps = 6_000;
  }

  const combinedThrough = now + 40_000;
  const combinedBasis = createProductionSettlementBasis(combined.world, user.id, combinedThrough);
  applyProductionSettlementClaim(
    combined.world,
    user.id,
    createProductionSettlementClaim(combinedBasis),
    combinedThrough,
  );

  const firstThrough = now + 20_000;
  const firstBasis = createProductionSettlementBasis(split.world, user.id, firstThrough);
  applyProductionSettlementClaim(
    split.world,
    user.id,
    createProductionSettlementClaim(firstBasis),
    firstThrough,
  );
  const secondBasis = createProductionSettlementBasis(split.world, user.id, combinedThrough);
  applyProductionSettlementClaim(
    split.world,
    user.id,
    createProductionSettlementClaim(secondBasis),
    combinedThrough,
  );

  assert.equal(combined.player.facilityGroups[0].productionEmploymentTotalMicros, '1600000');
  assert.equal(
    combined.player.facilityGroups[0].productionEmploymentTotalMicros,
    split.player.facilityGroups[0].productionEmploymentTotalMicros,
  );
  assert.deepEqual(
    combined.player.facilityGroups[0].productionEmploymentAllocatedMicros,
    split.player.facilityGroups[0].productionEmploymentAllocatedMicros,
  );
});

test('world deadline plan no longer schedules global facility catch-up', () => {
  const { world } = productionWorld();
  const plan = createWorldDeadlinePlan(world, now + 10 * 60 * 60 * 1000);
  assert.equal(plan.deadlines.facility, null);
});
