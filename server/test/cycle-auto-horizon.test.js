import assert from 'node:assert/strict';
import test from 'node:test';
import { createWorld, ensurePlayer } from '../src/domain.js';
import { FACILITY_TYPE_CATALOG } from '../src/industry-catalog.js';
import { migrateFacilityGroupWorld } from '../src/facility-groups.js';
import { createProductionSettlementClaim } from '../../shared/production-settlement.js';
import { applyProductionSettlementClaim, createProductionSettlementBasis, settleProductionForPlayerServerSide } from '../src/production-settlement.js';
import { inventoryForProvince, provinceScopedKey } from '../src/provinces.js';
import { EconomyStore } from '../src/runtime-store.js';

const start = 1_800_000_000_000;
const provinceId = '110000';
const user = { id: 98321, name: 'Horizon', email: 'cycle-horizon@example.test', role: 'user' };
function setup(world = createWorld(start), player = ensurePlayer(world, user, start)) {
  const type = FACILITY_TYPE_CATALOG.find((item) => item.id === 'mill');
  const recipe = type.recipes.find((item) => item.id === type.defaultRecipeId) || type.recipes[0];
  player.facilityGroups = [{ provinceId, facilityTypeId: type.id, count: 1, participatingCount: 1,
    enabled: true, status: 'running', activeRecipeId: recipe.id, lifetimeOutput: 0, cycleStartedAt: start,
    staffingRateBps: 10000, staffingUpdatedAt: start, staffingBatchCarryBps: 0 }];
  player.credits = 10000;
  for (const input of recipe.inputs) inventoryForProvince(player, input.productId, provinceId).available = input.quantity;
  migrateFacilityGroupWorld(world, start);
  world.markets[provinceScopedKey(provinceId, 'wheat')].officialPrice = 5;
  world.markets[provinceScopedKey(provinceId, 'flour')].officialPrice = 25;
  return { world, player, recipe, group: player.facilityGroups[0] };
}
const claimAt = (world, through) => createProductionSettlementClaim(createProductionSettlementBasis(world, user.id, through));
const stale = (error) => error.code === 'PRODUCTION_SETTLEMENT_STALE';

test('old client horizons cannot spend new procurement on unprocessed historical cycles', () => {
  const { world, player, recipe, group } = setup();
  const horizon = start + recipe.cycleMs;
  const now = start + recipe.cycleMs * 10;
  const claim = claimAt(world, horizon);
  const before = JSON.stringify(world);
  assert.throws(() => applyProductionSettlementClaim(world, user.id, claim, now), stale);
  assert.equal(JSON.stringify(world), before, 'stale proposals are rejected before any mutation');
  assert.equal(settleProductionForPlayerServerSide(world, user.id, now).ok, true);
  assert.equal(group.lifetimeOutput, recipe.output.quantity);
  assert.equal(group.cycleStartedAt, now);
  const paid = player.credits;
  settleProductionForPlayerServerSide(world, user.id, now);
  assert.equal(group.lifetimeOutput, recipe.output.quantity);
  assert.equal(player.credits, paid);
});

test('a proposal crossing a future deadline cannot finish a not-yet-due cycle', () => {
  const { world, recipe, group } = setup();
  const due = start + recipe.cycleMs;
  const proposal = claimAt(world, due);
  assert.throws(() => applyProductionSettlementClaim(world, user.id, proposal, due - 100), stale);
  assert.equal(group.lifetimeOutput, 0);
});

test('ordinary latency within the same due window preserves the completed result and resumes at server time', () => {
  const { world, recipe, group } = setup();
  const due = start + recipe.cycleMs;
  assert.equal(applyProductionSettlementClaim(world, user.id, claimAt(world, due), due + 100).ok, true);
  assert.equal(group.lifetimeOutput, recipe.output.quantity);
  assert.equal(group.cycleStartedAt, due + 100);
});

test('stale horizon transparently falls back at the action boundary without duplicate production or trades', () => {
  const store = new EconomyStore(':memory:', { scheduledProcessing: true });
  try {
    store.getState(user, start);
    store.stopScheduler();
    const { world, recipe } = setup(store.worldCache.world, store.worldCache.world.players[String(user.id)]);
    const revision = store.worldCache.revision;
    store.transaction(() => store.saveWorldIfChanged(revision, world, start));
    store.stopScheduler();
    const now = start + recipe.cycleMs * 10;
    const request = {
      action: 'settleProduction', requestKey: 'stale-horizon-fallback',
      method: 'POST', path: '/api/game/production/settle',
      payload: { productionSettlement: claimAt(world, start + recipe.cycleMs) },
    };
    const response = store.apply(user, request, now);
    store.stopScheduler();
    assert.equal(response.result.ok, true);
    const player = store.worldCache.world.players[String(user.id)];
    assert.equal(player.facilityGroups[0].lifetimeOutput, recipe.output.quantity);
    assert.equal(player.facilityGroups[0].cycleStartedAt, now);
    const committed = JSON.stringify(store.worldCache.world);
    assert.deepEqual(store.apply(user, request, now), response);
    assert.equal(JSON.stringify(store.worldCache.world), committed);
  } finally {
    store.close();
  }
});
