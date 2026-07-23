import assert from 'node:assert/strict';
import test from 'node:test';
import { createWorld } from '../src/domain.js';
import {
  applyPopulationPolicy,
  populationBaseBudgetTotal,
  topUpPopulationByPolicy,
} from '../src/population-admin-control.js';
import {
  createPopulationEconomySummary,
  ensurePopulationEconomy,
  preparePopulationDemandCycle,
} from '../src/population-economy.js';
import { EconomyStore } from '../src/runtime-store.js';

const now = Date.UTC(2026, 6, 22, 8, 0, 0);

test('population economy version 4 migration does not repeat bootstrap issuance', () => {
  const world = createWorld(now);
  const state = ensurePopulationEconomy(world, now);
  const beforeCredits = Object.values(state.models).reduce((sum, model) => sum + model.credits, 0);
  const beforeMigration = state.stats.migrationIssued;
  state.modelVersion = 1;
  ensurePopulationEconomy(world, now);
  assert.equal(state.modelVersion, 4);
  assert.equal(Object.values(state.models).reduce((sum, model) => sum + model.credits, 0), beforeCredits);
  assert.equal(state.stats.migrationIssued, beforeMigration);
});

test('manual population top-up shares the same per-cycle cap with automatic stabilization', () => {
  const world = createWorld(now);
  const state = ensurePopulationEconomy(world, now);
  for (const model of Object.values(state.models)) {
    model.credits = 0;
    model.frozenCredits = 0;
    model.incomeEma = 0;
    model.recentPeakIncome = 0;
    model.lastBudget = 0;
  }
  applyPopulationPolicy(world, {
    stabilizationShareBps: 2_500,
    targetWalletCycles: 8,
    refillCapBps: 25_000,
    productionWageMultiplierBps: 18_000,
    modelMultipliersBps: { basic: 16_000, skilled: 15_500, professional: 15_200 },
    durationCycles: 400,
  }, { adminUserId: 1, now });

  const first = topUpPopulationByPolicy(world, { targetModel: 'all' }, { now });
  assert.ok(first.issuedTotal > 0);

  const second = topUpPopulationByPolicy(world, { targetModel: 'all' }, { now });
  assert.equal(second.issuedTotal, 0);

  const cycleId = Math.floor(now / (5 * 60 * 1000));
  preparePopulationDemandCycle(world, cycleId, now, { totalBaseBudget: populationBaseBudgetTotal() });
  const summary = createPopulationEconomySummary(world, now, { totalBaseBudget: populationBaseBudgetTotal() });
  const issuedThisCycle = Object.values(summary.policy.currentCycleIssued.issuedByModel).reduce((sum, value) => sum + value, 0);
  assert.equal(issuedThisCycle, first.issuedTotal);
  assert.equal(summary.issuance.adminPopulation, first.issuedTotal);
});

test('runtime population policy mutations are idempotent, accept values above former caps, and create no audit rows', () => {
  const store = new EconomyStore(':memory:');
  const admin = { id: 1, email: 'admin@example.com', role: 'admin' };
  const requestMeta = {
    requestKey: 'policy-test-key-0001',
    method: 'PUT',
    path: '/api/game/admin/population-economy/policy',
  };
  try {
    const payload = {
      stabilizationShareBps: 2_500,
      targetWalletCycles: 8,
      refillCapBps: 25_000,
      productionWageMultiplierBps: 18_000,
      modelMultipliersBps: { basic: 16_000, skilled: 15_500, professional: 15_200 },
      durationCycles: 400,
    };
    const first = store.updatePopulationPolicy(admin, payload, requestMeta, now);
    const repeated = store.updatePopulationPolicy(admin, payload, requestMeta, now);
    assert.deepEqual(repeated, first);
    assert.equal(first.populationEconomy.policy.stabilizationShareBps, 2_500);
    assert.equal(first.populationEconomy.policy.targetWalletCycles, 8);
    assert.equal(first.populationEconomy.policy.durationCycles, 400);
    assert.equal(first.populationEconomy.policy.productionWageMultiplierBps, 18_000);
    assert.equal(store.listPopulationPolicyAudit(admin, {}).total, 0);
  } finally {
    store.close();
  }
});

test('population policy rejects only unsafe numeric results rather than fixed business maxima', () => {
  const world = createWorld(now);
  assert.throws(() => applyPopulationPolicy(world, {
    stabilizationShareBps: 10_000,
    targetWalletCycles: Number.MAX_SAFE_INTEGER,
    refillCapBps: 0,
    productionWageMultiplierBps: 5_000,
    modelMultipliersBps: { basic: 5_000, skilled: 5_000, professional: 5_000 },
    durationCycles: 1,
  }, { adminUserId: 1, now }), /超出系统可表示范围/);
});
