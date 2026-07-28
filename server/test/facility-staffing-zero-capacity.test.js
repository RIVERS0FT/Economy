import assert from 'node:assert/strict';
import test from 'node:test';
import { createWorld, ensurePlayer } from '../src/domain.js';
import { migrateFacilityGroupWorld, processFacilityGroupWorld } from '../src/facility-groups.js';

const now = 1_700_000_000_000;
const alice = { id: 1, email: 'alice@example.com', name: 'Alice' };

function group(typeId, count, overrides = {}) {
  return {
    facilityTypeId: typeId,
    count,
    participatingCount: 0,
    pendingJoinCount: 0,
    enabled: false,
    status: 'stopped',
    statusReason: 'manual',
    activeRecipeId: typeId === 'farm' ? 'wheat-crop' : `${typeId}-default`,
    lifetimeOutput: 0,
    ...overrides,
  };
}

test('zero effective capacity can run without funds until a payable batch is due', () => {
  const world = createWorld(now);
  const player = ensurePlayer(world, alice, now);
  player.credits = 0;
  player.facilityGroups = [group('farm', 1, {
    enabled: true,
    status: 'error',
    statusReason: 'insufficient_funds',
    staffingRateBps: 0,
    staffingUpdatedAt: now,
    staffingBatchCarryBps: 0,
  })];
  migrateFacilityGroupWorld(world, now);

  processFacilityGroupWorld(world, now + 1);
  assert.equal(player.facilityGroups[0].status, 'running');
  assert.equal(player.facilityGroups[0].cycleStaffingRateBps, 0);

  processFacilityGroupWorld(world, now + 120_001);
  assert.equal(player.facilityGroups[0].status, 'running');
  assert.equal(player.credits, 0);
  assert.equal(player.inventories.wheat.available, 0);

  processFacilityGroupWorld(world, now + 600_001);
  assert.equal(player.facilityGroups[0].status, 'error');
  assert.equal(player.facilityGroups[0].statusReason, 'insufficient_funds');
  assert.equal(player.credits, 0);
  assert.equal(player.inventories.wheat.available, 0);
});
