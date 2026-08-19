import assert from 'node:assert/strict';
import test from 'node:test';
import { createProductionSettlementClaim, dueProductionCycles, projectProductionCycles } from '../../shared/production-settlement.js';
import { createWorld, ensurePlayer } from '../src/domain.js';
import { migrateFacilityGroupWorld } from '../src/facility-groups.js';
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
  assert.equal(dueProductionCycles(basis.groups[0], settleThrough), 10);
  assert.equal(claim.groups[0].completedCycles, 10);

  const result = applyProductionSettlementClaim(world, user.id, claim, settleThrough);
  assert.equal(result.ok, true);
  assert.equal(player.credits, 990);
  assert.equal(player.inventories.wheat.available, 10);
  assert.equal(player.facilityGroups[0].lifetimeOutput, 10);
  assert.equal(player.facilityGroups[0].cycleStartedAt, settleThrough);
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

test('world deadline plan no longer schedules global facility catch-up', () => {
  const { world } = productionWorld();
  const plan = createWorldDeadlinePlan(world, now + 10 * 60 * 60 * 1000);
  assert.equal(plan.deadlines.facility, null);
});
