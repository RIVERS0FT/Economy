import assert from 'node:assert/strict';
import test from 'node:test';
import { createProductionSettlementClaim } from '../../shared/production-settlement.js';
import { migrateFacilityGroupWorld } from '../src/facility-groups.js';
import { createProductionSettlementBasis } from '../src/production-settlement.js';
import { EconomyStore } from '../src/runtime-store.js';

const now = 1_850_000_000_000;
const settleThrough = now + 200_000;
const user = { id: 1, email: 'settlement-fallback@example.com', role: 'user' };

function prepareStore() {
  const store = new EconomyStore(':memory:', { scheduledProcessing: false });
  store.getState(user, now);
  const world = store.worldCache.world;
  const player = world.players['1'];
  player.credits = 1_000;
  player.facilityGroups = [{
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
  }];
  migrateFacilityGroupWorld(world, now);
  return { store, world, player };
}

function settlementRequest(claim, requestKey) {
  return {
    action: 'settleProduction',
    payload: { productionSettlement: claim },
    requestKey,
    method: 'POST',
    path: '/api/game/production/settle',
  };
}

test('stale fingerprinted production proposal falls back server-side in the same action request', () => {
  const { store, world, player } = prepareStore();
  try {
    const basis = createProductionSettlementBasis(world, user.id, settleThrough);
    const claim = createProductionSettlementClaim(basis);
    assert.ok(claim?.basisId);

    // Simulate an authoritative resource change after the GET state snapshot that created the proposal.
    player.credits -= 1;
    const response = store.apply(user, settlementRequest(claim, 'stale-production-fallback'), settleThrough);

    assert.equal(response.result.ok, true);
    assert.equal(store.worldCache.world.players['1'].facilityGroups[0].lifetimeOutput > 0, true);
    assert.equal(store.selectIdempotency.get(1, 'stale-production-fallback') !== undefined, true);
  } finally {
    store.close();
  }
});

test('invalid proposal with a matching basis fingerprint still returns 409 and does not fall back', () => {
  const { store, world } = prepareStore();
  try {
    const basis = createProductionSettlementBasis(world, user.id, settleThrough);
    const claim = createProductionSettlementClaim(basis);
    assert.ok(claim?.basisId);
    claim.groups[0].completedCycles += 1;
    const revisionBefore = store.worldCache.revision;

    assert.throws(
      () => store.apply(user, settlementRequest(claim, 'invalid-production-rejected'), settleThrough),
      (error) => error?.statusCode === 409 && error?.code === 'PRODUCTION_SETTLEMENT_INVALID',
    );
    assert.equal(store.worldCache.revision, revisionBefore);
  } finally {
    store.close();
  }
});
