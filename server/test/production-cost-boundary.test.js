import { readFileSync } from 'node:fs';
import { FACILITY_TYPE_CATALOG } from '../src/industry-catalog.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { createProductionSettlementClaim, productionResourceUsage } from '../../shared/production-settlement.js';
import { createWorld, ensurePlayer } from '../src/domain.js';
import { migrateFacilityGroupWorld, processFacilityGroupWorld, createFacilityGroupClientState } from '../src/facility-groups.js';
import { applyProductionSettlementClaim, createProductionSettlementBasis, settleProductionForPlayerServerSide } from '../src/production-settlement.js';
import { DEFAULT_PROVINCE_ID, provinceScopedKey } from '../src/provinces.js';
import { legacyProductionOperatingCost, activeProductionRecipe } from '../src/production-balance.js';

const start = 1_700_000_000_000;
const user = { id: 91919, email: 'balance-boundary@example.com', name: 'Balance boundary' };
const key = provinceScopedKey(DEFAULT_PROVINCE_ID, 'farm');
function setup({ count = 1, rate = 10_000, carry = 0, cutoff = start + 25_000 } = {}) {
  const world = createWorld(start);
  const player = ensurePlayer(world, user, start);
  player.credits = 10_000_000;
  player.factoryAutoOperationPolicies = { [key]: { enabled: false, inputCoverageCycles: 2, mode: 'balanced', outputMode: 'surplus' } };
  player.facilityGroups = [{ facilityTypeId: 'farm', provinceId: DEFAULT_PROVINCE_ID,
    count, participatingCount: count, enabled: true, status: 'running', activeRecipeId: 'wheat-crop',
    lifetimeOutput: 0, cycleStartedAt: start, staffingRateBps: rate, staffingUpdatedAt: start,
    staffingBatchCarryBps: carry, cycleWageMultiplierBps: 10_000 }];
  migrateFacilityGroupWorld(world, cutoff);
  return { world, player };
}
const close = (a, b) => assert.ok(Math.abs(a - b) < 0.000001, `${a} !== ${b}`);
function financialSnapshot(player) {
  const g = player.facilityGroups[0];
  return { credits: player.credits, output: g.lifetimeOutput, started: g.cycleStartedAt,
    staffing: g.staffingRateBps, carry: g.staffingBatchCarryBps, payroll: player.stats.productionPayroll };
}

test('migration retains overdue and in-flight old costs then switches only at the next cycle start', () => {
  const { world, player } = setup();
  const group = player.facilityGroups[0];
  assert.equal(group.productionBalanceVersion, 2);
  assert.equal(group.productionCostChangeAt, start + 25_000);
  assert.equal(group.productionLegacyOperatingCost, 1);
  assert.equal(legacyProductionOperatingCost('farm', 'wheat-crop'), 1);
  const basis = createProductionSettlementBasis(world, user.id, start + 60_000);
  assert.equal(productionResourceUsage(basis.groups[0], 3).costMicros, 2_970_000n);
  settleProductionForPlayerServerSide(world, user.id, start + 60_000);
  close(player.credits, 10_000_000 - 2.97);
  close(player.stats.productionPayroll, 2.97);
  assert.equal(group.lifetimeOutput, 3);
  assert.equal(group.cycleStartedAt, start + 60_000);
  migrateFacilityGroupWorld(world, start + 75_000);
  assert.equal(player.facilityGroups[0].productionCostChangeAt, start + 25_000);
  settleProductionForPlayerServerSide(world, user.id, start + 80_000);
  close(player.stats.productionPayroll, 3.94);
});

test('bulk and segmented settlement agree across the cost boundary including staffing carry and payroll', () => {
  const bulk = setup({ count: 7, rate: 1733, carry: 8811 });
  const split = setup({ count: 7, rate: 1733, carry: 8811 });
  settleProductionForPlayerServerSide(bulk.world, user.id, start + 600_000);
  for (let at = start + 20_000; at <= start + 600_000; at += 20_000) {
    settleProductionForPlayerServerSide(split.world, user.id, at);
  }
  assert.deepEqual(financialSnapshot(bulk.player), financialSnapshot(split.player));
  assert.deepEqual(bulk.world.populationEconomy.stats, split.world.populationEconomy.stats);
});

test('existing explicit-cycle server path and bulk path use the same old/new cost boundary', () => {
  const bulk = setup();
  const loop = setup();
  settleProductionForPlayerServerSide(bulk.world, user.id, start + 60_000);
  processFacilityGroupWorld(loop.world, start + 60_000, { migrate: false });
  const a = financialSnapshot(bulk.player), b = financialSnapshot(loop.player);
  close(a.credits, b.credits);
  close(a.payroll, b.payroll);
  assert.deepEqual([a.output, a.started, a.carry], [b.output, b.started, b.carry]);
});

test('cost-boundary fingerprint rejects old-client and tampered proposals before any mutation', () => {
  for (const mode of ['remove', 'cost', 'time']) {
    const { world } = setup();
    const at = start + 60_000;
    const basis = createProductionSettlementBasis(world, user.id, at);
    const original = structuredClone(world);
    if (mode === 'remove') {
      delete basis.groups[0].recipe.costChangeAt;
      delete basis.groups[0].recipe.previousOperatingCostMicros;
    } else if (mode === 'cost') basis.groups[0].recipe.previousOperatingCostMicros = '1';
    else basis.groups[0].recipe.costChangeAt = start;
    // A client recalculates its own identity; the server compares against trusted persistence.
    basis.basisId = '';
    const claim = createProductionSettlementClaim(basis);
    assert.throws(() => applyProductionSettlementClaim(world, user.id, claim, at), error => error.code === 'PRODUCTION_SETTLEMENT_STALE');
    assert.deepEqual(world, original);
    assert.equal(settleProductionForPlayerServerSide(world, user.id, at).ok, true);
  }
});

test('public production state preserves the boundary while new starts and other recipes use current cost', () => {
  const { world, player } = setup();
  const state = createFacilityGroupClientState(world, user.id, start + 30_000);
  assert.equal(state.facilityGroups[0].productionLegacyOperatingCost, 1);
  const recipe = { id: 'wheat-crop', operatingCost: 0.97 };
  assert.equal(activeProductionRecipe(recipe, player.facilityGroups[0]).operatingCost, 1);
  assert.equal(activeProductionRecipe(recipe, { ...player.facilityGroups[0], cycleStartedAt: start + 40_000 }).operatingCost, 0.97);
  assert.equal(activeProductionRecipe({ id: 'rice-crop', operatingCost: 0.97 }, player.facilityGroups[0]).operatingCost, 0.97);
});

for (const days of [7, 30, 90]) test(`${days}-day fixed-fleet production settles without retroactive cost changes`, () => {
  const { world, player } = setup({ count: 7 });
  const cycles = days * 24 * 60 * 3;
  const at = start + days * 86_400_000;
  settleProductionForPlayerServerSide(world, user.id, at);
  assert.equal(player.facilityGroups[0].lifetimeOutput, cycles * 7);
  close(player.stats.productionPayroll, 14 + (cycles - 2) * 7 * 0.97);
  close(player.credits, 10_000_000 - player.stats.productionPayroll);
});

test('all pre-upgrade recipe costs remain immutable for pending-cycle migration', () => {
  const fixture = JSON.parse(readFileSync(new URL('./fixtures/production-balance-legacy-costs.json', import.meta.url), 'utf8'));
  const actual = Object.fromEntries(FACILITY_TYPE_CATALOG.flatMap(type => type.recipes.map(recipe => [
    `${type.id}:${recipe.id}`, legacyProductionOperatingCost(type.id, recipe.id),
  ])));
  assert.equal(Object.keys(actual).length, 160);
  assert.deepEqual(actual, fixture.costs);
});

test('zero-cost legacy cycles and increased new costs remain nonnegative in resource calculations', () => {
  const group = { status: 'running', enabled: true, participatingCount: 3,
    cycleStartedAt: start, staffingUpdatedAt: start, staffingRateBps: 10000, staffingBatchCarryBps: 0,
    recipe: { id: 'sample', cycleMs: 20000, operatingCostMicros: '2000000',
      costChangeAt: start + 25000, previousOperatingCostMicros: '0', inputs: [], output: { quantity: 1 } } };
  assert.equal(productionResourceUsage(group, 2).costMicros, 0n);
  assert.equal(productionResourceUsage(group, 3).costMicros, 6_000_000n);
  assert.equal(productionResourceUsage(group, 4).costMicros, 12_000_000n);
});
