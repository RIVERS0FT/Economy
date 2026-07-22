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
import { EconomyStore } from '../src/storage.js';

const now = Date.UTC(2026, 6, 22, 8, 0, 0);

test('population economy version 2 migration does not repeat bootstrap issuance', () => {
  const world = createWorld(now);
  const state = ensurePopulationEconomy(world, now);
  const beforeCredits = Object.values(state.models).reduce((sum, model) => sum + model.credits, 0);
  const beforeMigration = state.stats.migrationIssued;
  state.modelVersion = 1;
  ensurePopulationEconomy(world, now);
  assert.equal(state.modelVersion, 2);
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
    stabilizationShareBps: 2_000,
    targetWalletCycles: 5,
    refillCapBps: 15_000,
    modelMultipliersBps: { basic: 15_000, skilled: 15_000, professional: 15_000 },
    durationCycles: 12,
    note: '测试管理员人口需求强力刺激',
  }, { adminUserId: 1, now });

  const first = topUpPopulationByPolicy(world, {
    targetModel: 'all',
    note: '测试立即执行一次受控补充',
  }, { now });
  assert.ok(first.issuedTotal > 0);

  const second = topUpPopulationByPolicy(world, {
    targetModel: 'all',
    note: '测试同周期再次执行受控补充',
  }, { now });
  assert.equal(second.issuedTotal, 0);

  const cycleId = Math.floor(now / (5 * 60 * 1000));
  preparePopulationDemandCycle(world, cycleId, now, { totalBaseBudget: populationBaseBudgetTotal() });
  const summary = createPopulationEconomySummary(world, now, { totalBaseBudget: populationBaseBudgetTotal() });
  const issuedThisCycle = Object.values(summary.policy.currentCycleIssued.issuedByModel).reduce((sum, value) => sum + value, 0);
  assert.equal(issuedThisCycle, first.issuedTotal);
  assert.equal(summary.issuance.adminPopulation, first.issuedTotal);
});

test('population policy store mutations are idempotent and audited', () => {
  const store = new EconomyStore(':memory:');
  const admin = { id: 1, email: 'admin@example.com', role: 'admin' };
  const requestMeta = {
    requestKey: 'policy-test-key-0001',
    method: 'PUT',
    path: '/api/game/admin/population-economy/policy',
  };
  try {
    const payload = {
      stabilizationShareBps: 1_500,
      targetWalletCycles: 4,
      refillCapBps: 10_000,
      modelMultipliersBps: { basic: 11_000, skilled: 10_000, professional: 9_000 },
      durationCycles: 12,
      note: '测试应用温和人口刺激政策',
    };
    const first = store.updatePopulationPolicy(admin, payload, requestMeta, now);
    const repeated = store.updatePopulationPolicy(admin, payload, requestMeta, now);
    assert.deepEqual(repeated, first);
    assert.equal(first.populationEconomy.policy.stabilizationShareBps, 1_500);
    const audit = store.listPopulationPolicyAudit(admin, {});
    assert.equal(audit.total, 1);
    assert.equal(audit.items[0].actionType, 'update_policy');
    assert.equal(audit.items[0].note, payload.note);
  } finally {
    store.close();
  }
});
