import assert from 'node:assert/strict';
import test from 'node:test';
import { createWorld } from '../src/domain.js';
import {
  applyPopulationPolicy,
  topUpPopulationByPolicy,
} from '../src/population-admin-control.js';
import {
  createPopulationEconomySummary,
  ensurePopulationEconomy,
  preparePopulationDemandCycle,
} from '../src/population-economy.js';
import { EconomyStore } from '../src/runtime-store.js';

const now = Date.UTC(2026, 6, 22, 8, 0, 0);

test('population economy version 5 migration does not repeat bootstrap issuance', () => {
  const world = createWorld(now);
  const state = ensurePopulationEconomy(world, now);
  const beforeCredits = Object.values(state.models).reduce((sum, model) => sum + model.credits, 0);
  const beforeMigration = state.stats.migrationIssued;
  state.modelVersion = 1;
  ensurePopulationEconomy(world, now);
  assert.equal(state.modelVersion, 7);
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
  preparePopulationDemandCycle(world, cycleId, now);
  const summary = createPopulationEconomySummary(world, now);
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
    assert.notEqual(first.populationEconomy.policy.expiresAfterCycleId, null);
    assert.equal(store.listPopulationPolicyAudit(admin, {}).total, 0);
  } finally {
    store.close();
  }
});

test('custom permanent population policy survives later cycles and normalization', () => {
  const world = createWorld(now);
  const applied = applyPopulationPolicy(world, {
    stabilizationShareBps: 1_500,
    targetWalletCycles: 4,
    refillCapBps: 10_000,
    productionWageMultiplierBps: 11_000,
    modelMultipliersBps: { basic: 11_000, skilled: 10_000, professional: 9_000 },
    durationMode: 'permanent',
  }, { adminUserId: 1, now });

  assert.equal(applied.afterPolicy.isDefault, false);
  assert.equal(applied.afterPolicy.expiresAfterCycleId, null);
  assert.equal(applied.afterPolicy.durationCycles, null);
  assert.equal(applied.afterPolicy.remainingCycles, null);
  assert.equal(applied.afterPolicy.elapsedCycles, 0);

  const state = ensurePopulationEconomy(world, now);
  state.policy = JSON.parse(JSON.stringify(state.policy));
  const later = now + 50 * 5 * 60 * 1000;
  const summary = createPopulationEconomySummary(world, later);
  assert.equal(summary.policy.isDefault, false);
  assert.equal(summary.policy.stabilizationShareBps, 1_500);
  assert.equal(summary.policy.expiresAfterCycleId, null);
  assert.equal(summary.policy.durationCycles, null);
  assert.equal(summary.policy.remainingCycles, null);
  assert.equal(summary.policy.elapsedCycles, 50);
});

test('population policy rejects unsupported duration modes', () => {
  const world = createWorld(now);
  assert.throws(() => applyPopulationPolicy(world, {
    stabilizationShareBps: 1_200,
    targetWalletCycles: 3,
    refillCapBps: 10_000,
    productionWageMultiplierBps: 10_000,
    modelMultipliersBps: { basic: 10_000, skilled: 10_000, professional: 10_000 },
    durationMode: 'forever-ish',
    durationCycles: 12,
  }, { adminUserId: 1, now }), /政策生效方式无效/);
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
