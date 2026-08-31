import assert from 'node:assert/strict';
import test from 'node:test';
import { createWorld, ensurePlayer } from '../src/domain.js';
import { applyFacilityGroupAction, createFacilityGroupClientState, migrateFacilityGroupWorld } from '../src/facility-groups.js';

const now = 1_700_000_000_000;
const alice = { id: 1, email: 'alice@example.com', name: 'Alice' };

test('factory direct sell cannot remove running production capacity', () => {
  const world = createWorld(now);
  const player = ensurePlayer(world, alice, now);
  player.facilityGroups = [{
    facilityTypeId: 'farm', count: 5, participatingCount: 5,
    enabled: true, status: 'running', cycleStartedAt: now,
    staffingRateBps: 10_000, staffingUpdatedAt: now,
    activeRecipeId: 'wheat-crop', lifetimeOutput: 0,
  }];
  migrateFacilityGroupWorld(world, now);

  const response = applyFacilityGroupAction(world, alice, 'placeOrder', {
    assetKind: 'facility', assetId: 'farm', side: 'sell', quantity: 5, price: 100,
  }, now + 1);

  assert.deepEqual(response, { ok: false, message: '工厂资产仅允许通过拍卖交易' });
  const farm = player.facilityGroups[0];
  assert.equal(farm.status, 'running');
  assert.equal(farm.enabled, true);
  assert.equal(farm.count, 5);
  assert.equal(farm.participatingCount, 5);
  assert.equal(farm.staffingRateBps, 10_000);
  const state = createFacilityGroupClientState(world, alice.id, now + 1).facilityGroups[0];
  assert.equal(state.listedCount, 0);
});
