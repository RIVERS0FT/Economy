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
    const request = settlementRequest(claim, 'stale-production-fallback');
    const revisionBefore = store.worldCache.revision;
    const response = store.apply(user, request, settleThrough);

    assert.equal(response.result.ok, true);
    assert.equal(response.revision, revisionBefore + 1);
    const settledOutput = store.worldCache.world.players['1'].facilityGroups[0].lifetimeOutput;
    assert.equal(settledOutput > 0, true);
    assert.equal(store.selectIdempotency.get(1, 'stale-production-fallback') !== undefined, true);

    // A transport retry with the same logical request must replay the acknowledgement,
    // not run stale fallback or production settlement a second time.
    const replay = store.apply(user, request, settleThrough);
    assert.deepEqual(replay, response);
    assert.equal(store.worldCache.revision, response.revision);
    assert.equal(store.worldCache.world.players['1'].facilityGroups[0].lifetimeOutput, settledOutput);
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

test('a pre-balance client settles migrated costs through idempotent same-request fallback', () => {
  const { store, world, player } = prepareStore();
  try {
    const group = player.facilityGroups[0];
    group.productionBalanceVersion = 1;
    migrateFacilityGroupWorld(world, now + 25_000);
    const basis = createProductionSettlementBasis(world, user.id, settleThrough);
    delete basis.groups[0].recipe.costChangeAt;
    delete basis.groups[0].recipe.previousOperatingCostMicros;
    basis.basisId = '';
    const claim = createProductionSettlementClaim(basis);
    const request = settlementRequest(claim, 'pre-balance-client-fallback');
    const response = store.apply(user, request, settleThrough);
    assert.equal(response.result.ok, true);
    const after = store.worldCache.world.players['1'];
    assert.equal(after.stats.productionPayroll, 2 + 8 * 0.97);
    assert.equal(after.facilityGroups[0].lifetimeOutput, 10);
    assert.deepEqual(store.apply(user, request, settleThrough), response);
    assert.equal(store.worldCache.world.players['1'].stats.productionPayroll, 2 + 8 * 0.97);
  } finally { store.close(); }
});
