import assert from 'node:assert/strict';
import test from 'node:test';
import { createWorld, ensurePlayer } from '../src/domain.js';
import { applyFacilityGroupAction, createFacilityGroupClientState, migrateFacilityGroupWorld } from '../src/facility-groups.js';

const now = 1_700_000_000_000;
const alice = { id: 1, email: 'alice@example.com', name: 'Alice' };

test('cancelling a running factory sell order joins the quantity next cycle', () => {
  const world = createWorld(now);
  const player = ensurePlayer(world, alice, now);
  player.facilityGroups = [{ facilityTypeId: 'farm', count: 5, participatingCount: 5, pendingJoinCount: 0, status: 'running', cycleStartedAt: now, productionMode: 'continuous', completedQuantity: 0 }];
  migrateFacilityGroupWorld(world, now);
  applyFacilityGroupAction(world, alice, 'placeOrder', { assetKind: 'facility', assetId: 'farm', side: 'sell', quantity: 2, price: 100 }, now + 1);
  const order = world.orders.find((item) => item.ownerId === alice.id && item.assetKind === 'facility');
  assert.equal(player.facilityGroups[0].participatingCount, 3);
  applyFacilityGroupAction(world, alice, 'cancelOrder', { orderId: order.id }, now + 2);
  assert.equal(player.facilityGroups[0].pendingJoinCount, 2);
  assert.equal(createFacilityGroupClientState(world, alice.id, now + 2).facilityGroups[0].listedCount, 0);
});

test('selling every participating factory pauses the group', () => {
  const world = createWorld(now);
  const player = ensurePlayer(world, alice, now);
  player.facilityGroups = [{ facilityTypeId: 'farm', count: 2, participatingCount: 2, pendingJoinCount: 0, status: 'running', cycleStartedAt: now, productionMode: 'continuous', completedQuantity: 0 }];
  migrateFacilityGroupWorld(world, now);
  applyFacilityGroupAction(world, alice, 'placeOrder', { assetKind: 'facility', assetId: 'farm', side: 'sell', quantity: 2, price: 100 }, now + 1);
  assert.equal(player.facilityGroups[0].status, 'paused');
  assert.equal(player.facilityGroups[0].stopReason, 'listed');
  assert.equal(player.facilityGroups[0].participatingCount, 0);
});
