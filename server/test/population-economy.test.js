import assert from 'node:assert/strict';
import test from 'node:test';
import { createWorld } from '../src/domain.js';
import {
  creditPopulationEmployment,
  ensurePopulationEconomy,
  populationModelState,
  preparePopulationDemandCycle,
  releaseConstructionEmployment,
  releasePopulationOrderFunds,
  reservePopulationOrder,
  settlePopulationPurchase,
} from '../src/population-economy.js';

const now = 1_700_000_000_000;

function resetPopulation(world) {
  const state = ensurePopulationEconomy(world, now);
  for (const model of Object.values(state.models)) {
    model.credits = 0;
    model.frozenCredits = 0;
    model.pendingIncome = { production: 0, construction: 0, warehouse: 0, marketService: 0 };
    model.totalIncome = 0;
    model.totalSpent = 0;
  }
  return state;
}

test('production employment uses factory complexity and preserves every integer credit', () => {
  const world = createWorld(now);
  const state = resetPopulation(world);
  const allocation = creditPopulationEmployment(world, 100, 'production', { complexity: 'C7' });
  assert.deepEqual(allocation, { basic: 5, skilled: 25, professional: 70 });
  assert.equal(state.models.basic.pendingIncome.production, 5);
  assert.equal(state.models.skilled.pendingIncome.production, 25);
  assert.equal(state.models.professional.pendingIncome.production, 70);
});

test('construction employment is fixed at 60/30/10 and ignores factory complexity', () => {
  const world = createWorld(now);
  resetPopulation(world);
  const low = creditPopulationEmployment(world, 100, 'construction', { complexity: 'C1' });
  const high = creditPopulationEmployment(world, 100, 'construction', { complexity: 'C7' });
  assert.deepEqual(low, { basic: 60, skilled: 30, professional: 10 });
  assert.deepEqual(high, low);
});

test('construction escrow releases by progress without creating or deleting money', () => {
  const world = createWorld(now);
  const state = resetPopulation(world);
  const construction = { buildCost: 100, startedAt: now, completesAt: now + 1_000, employmentReleased: 0 };
  assert.equal(releaseConstructionEmployment(world, construction, now + 500), 50);
  assert.equal(construction.employmentReleased, 50);
  assert.equal(Object.values(state.models).reduce((sum, model) => sum + Object.values(model.pendingIncome).reduce((inner, value) => inner + value, 0), 0), 50);
  assert.equal(releaseConstructionEmployment(world, construction, now + 1_000), 50);
  assert.equal(construction.employmentReleased, 100);
});

test('population buy orders use real escrow and refund price improvement and cancellation', () => {
  const world = createWorld(now);
  resetPopulation(world);
  const model = populationModelState(world, 'basic');
  model.credits = 100;
  assert.equal(reservePopulationOrder(world, 'basic', 50), true);
  assert.equal(model.credits, 50);
  assert.equal(model.frozenCredits, 50);
  const order = { populationModelId: 'basic', price: 10, remaining: 5 };
  settlePopulationPurchase(world, order, 3, 8);
  assert.equal(model.credits, 56);
  assert.equal(model.frozenCredits, 20);
  assert.equal(model.totalSpent, 24);
  assert.equal(releasePopulationOrderFunds(world, order, 2), 20);
  assert.equal(model.credits, 76);
  assert.equal(model.frozenCredits, 0);
  assert.equal(model.credits + model.totalSpent, 100);
});


test('stabilization budget refills wallet gaps with a capped three-cycle target', () => {
  const world = createWorld(now);
  const state = resetPopulation(world);
  for (const model of Object.values(state.models)) {
    model.incomeEma = 100;
    model.recentPeakIncome = 100;
    model.lastBudget = 100;
  }
  const cycle = preparePopulationDemandCycle(world, 1, now, { totalBaseBudget: 5_700 });
  const issued = Object.values(state.models).reduce((sum, model) => sum + model.lastStabilizationIssued, 0);
  const baseBudget = Object.values(cycle.baseGroups.food).reduce((sum, value) => sum + value, 0)
    + Object.values(cycle.baseGroups.household).reduce((sum, value) => sum + value, 0);
  assert.equal(issued, 684);
  assert.equal(baseBudget, 684);
  assert.equal(state.stats.stabilizationIssued, 684);
  assert.ok(Object.values(state.models).every((model) => model.incomeEma === 85));

  for (const model of Object.values(state.models)) {
    model.credits = model.stabilizationBudget * 3;
    model.frozenCredits = 0;
  }
  preparePopulationDemandCycle(world, 2, now + 300_000, { totalBaseBudget: 5_700 });
  assert.ok(Object.values(state.models).every((model) => model.lastStabilizationIssued === 0));
  assert.equal(state.stats.stabilizationIssued, 684);
});
