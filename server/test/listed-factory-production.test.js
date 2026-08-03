import assert from 'node:assert/strict';
import test from 'node:test';
import { createWorld, ensurePlayer } from '../src/domain.js';
import { applyFacilityGroupAction, createFacilityGroupClientState, migrateFacilityGroupWorld } from '../src/facility-groups.js';

const now = 1_700_000_000_000;
const alice = { id: 1, email: 'alice@example.com', name: 'Alice' };

test('cancelling a running factory sell order restores the quantity immediately and dilutes staffing', () => {
  const world = createWorld(now);
  const player = ensurePlayer(world, alice, now);
  player.facilityGroups = [{
    facilityTypeId: 'farm', count: 5, participatingCount: 5,
    enabled: true, status: 'running', cycleStartedAt: now,
    staffingRateBps: 10_000, staffingUpdatedAt: now,
    activeRecipeId: 'wheat-crop', lifetimeOutput: 0,
  }];
  migrateFacilityGroupWorld(world, now);
  applyFacilityGroupAction(world, alice, 'placeOrder', {
    assetKind: 'facility', assetId: 'farm', side: 'sell', quantity: 2, price: 100,
  }, now + 1);
  const order = world.orders.find((item) => item.ownerId === alice.id && item.assetKind === 'facility');
  assert.equal(player.facilityGroups[0].participatingCount, 3);
  applyFacilityGroupAction(world, alice, 'cancelOrder', { orderId: order.id }, now + 2);
  const farm = player.facilityGroups[0];
  assert.equal(farm.participatingCount, 5);
  assert.equal(farm.staffingRateBps, 6_000);
  const state = createFacilityGroupClientState(world, alice.id, now + 2).facilityGroups[0];
  assert.equal(state.listedCount, 0);
  assert.equal(Object.hasOwn(state, 'pendingJoinCount'), false);
});

test('selling every participating factory puts the enabled group in error', () => {
  const world = createWorld(now);
  const player = ensurePlayer(world, alice, now);
  player.facilityGroups = [{
    facilityTypeId: 'farm', count: 2, participatingCount: 2,
    enabled: true, status: 'running', cycleStartedAt: now,
    activeRecipeId: 'wheat-crop', lifetimeOutput: 0,
  }];
  migrateFacilityGroupWorld(world, now);
  applyFacilityGroupAction(world, alice, 'placeOrder', {
    assetKind: 'facility', assetId: 'farm', side: 'sell', quantity: 2, price: 100,
  }, now + 1);
  assert.equal(player.facilityGroups[0].status, 'error');
  assert.equal(player.facilityGroups[0].statusReason, 'no_available_facility');
  assert.equal(player.facilityGroups[0].enabled, true);
  assert.equal(player.facilityGroups[0].participatingCount, 0);
});
