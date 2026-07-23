import assert from 'node:assert/strict';
import test from 'node:test';
import { createWorld } from '../src/domain.js';
import {
  creditPopulationEmployment,
  ensurePopulationEconomy,
  POPULATION_GROUP_SHARES_BY_STATE,
  populationClassShares,
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


function configureQualifiedBasic(world, {
  state = 'normal',
  income = 1_000,
  credits = 5_000,
  prosperityCycles = 0,
  lavishCycles = 0,
} = {}) {
  const model = populationModelState(world, 'basic');
  model.credits = credits;
  model.frozenCredits = 0;
  model.pendingIncome = { production: income, construction: 0, warehouse: 0, marketService: 0 };
  model.incomeEma = income;
  model.recentPeakIncome = income;
  model.noIncomeCycles = 0;
  model.consumptionState = state;
  model.stateCycles = 1;
  model.prosperityCycles = prosperityCycles;
  model.lavishCycles = lavishCycles;
  model.downgradeCycles = 0;
  model.lastBudget = 0;
  return model;
}

test('five consumption states use the authoritative food and household budget shares', () => {
  assert.deepEqual(POPULATION_GROUP_SHARES_BY_STATE, {
    lavish: {
      basic: { food: 0.65, household: 0.35 },
      skilled: { food: 0.42, household: 0.58 },
      professional: { food: 0.22, household: 0.78 },
    },
    prosperous: {
      basic: { food: 0.72, household: 0.28 },
      skilled: { food: 0.50, household: 0.50 },
      professional: { food: 0.30, household: 0.70 },
    },
    normal: {
      basic: { food: 0.78, household: 0.22 },
      skilled: { food: 0.58, household: 0.42 },
      professional: { food: 0.38, household: 0.62 },
    },
    strained: {
      basic: { food: 0.88, household: 0.12 },
      skilled: { food: 0.73, household: 0.27 },
      professional: { food: 0.58, household: 0.42 },
    },
    subsistence: {
      basic: { food: 0.95, household: 0.05 },
      skilled: { food: 0.90, household: 0.10 },
      professional: { food: 0.85, household: 0.15 },
    },
  });
});

test('five consumption states expose complete food and household class shares', () => {
  const world = createWorld(now);
  const state = ensurePopulationEconomy(world, now);
  const states = ['lavish', 'prosperous', 'normal', 'strained', 'subsistence'];
  for (const consumptionState of states) {
    for (const model of Object.values(state.models)) model.consumptionState = consumptionState;
    for (const modelId of ['basic', 'skilled', 'professional']) {
      for (const groupId of ['food', 'household']) {
        const shares = populationClassShares(world, modelId, groupId);
        const total = Object.values(shares).reduce((sum, value) => sum + value, 0);
        assert.ok(Math.abs(total - 1) < 1e-9, `${consumptionState}/${modelId}/${groupId} must sum to 1`);
      }
    }
  }

  state.models.basic.consumptionState = 'lavish';
  assert.deepEqual(populationClassShares(world, 'basic', 'food'), {
    staples: 0.36, protein: 0.25, 'fresh-drinks': 0.16, convenience: 0.23,
  });
  state.models.professional.consumptionState = 'subsistence';
  assert.deepEqual(populationClassShares(world, 'professional', 'household'), {
    home: 0.12, wear: 0.38, daily: 0.50, durables: 0,
  });
});

test('population enters prosperous and lavish only after sustained qualification', () => {
  const world = createWorld(now);
  resetPopulation(world);
  const model = configureQualifiedBasic(world);

  preparePopulationDemandCycle(world, 1, now, { totalBaseBudget: 5_700 });
  assert.equal(model.consumptionState, 'normal');
  assert.equal(model.prosperityCycles, 1);
  assert.equal(model.lavishCycles, 1);

  model.pendingIncome.production = 1_000;
  preparePopulationDemandCycle(world, 2, now + 300_000, { totalBaseBudget: 5_700 });
  assert.equal(model.consumptionState, 'prosperous');
  assert.equal(model.stateCycles, 1);

  model.pendingIncome.production = 1_000;
  preparePopulationDemandCycle(world, 3, now + 600_000, { totalBaseBudget: 5_700 });
  assert.equal(model.consumptionState, 'lavish');
  assert.equal(model.stateCycles, 1);
});

test('a single income spike does not immediately create prosperity and peak follows EMA', () => {
  const world = createWorld(now);
  resetPopulation(world);
  const model = configureQualifiedBasic(world, { income: 1_000 });
  model.incomeEma = 100;
  model.recentPeakIncome = 100;

  preparePopulationDemandCycle(world, 1, now, { totalBaseBudget: 5_700 });
  assert.equal(model.incomeEma, 235);
  assert.equal(model.recentPeakIncome, 235);
  assert.equal(model.consumptionState, 'normal');
  assert.equal(model.prosperityCycles, 0);
});

test('lavish and prosperous states use two-cycle downgrade grace', () => {
  const world = createWorld(now);
  resetPopulation(world);
  const model = configureQualifiedBasic(world, {
    state: 'lavish', income: 500, credits: 2_000, prosperityCycles: 2, lavishCycles: 3,
  });

  preparePopulationDemandCycle(world, 1, now, { totalBaseBudget: 5_700 });
  assert.equal(model.consumptionState, 'lavish');
  assert.equal(model.downgradeCycles, 1);

  model.pendingIncome.production = 500;
  preparePopulationDemandCycle(world, 2, now + 300_000, { totalBaseBudget: 5_700 });
  assert.equal(model.consumptionState, 'prosperous');
  assert.equal(model.downgradeCycles, 0);

  for (const cycleId of [3, 4]) {
    model.incomeEma = 300;
    model.recentPeakIncome = 300;
    model.pendingIncome.production = 300;
    preparePopulationDemandCycle(world, cycleId, now + cycleId * 300_000, { totalBaseBudget: 5_700 });
  }
  assert.equal(model.consumptionState, 'normal');
});

test('income stress downgrades immediately and two zero-income cycles enter subsistence', () => {
  const world = createWorld(now);
  resetPopulation(world);
  const model = configureQualifiedBasic(world, { income: 0, credits: 1_000 });
  model.incomeEma = 200;
  model.recentPeakIncome = 500;
  model.pendingIncome.production = 0;

  preparePopulationDemandCycle(world, 1, now, { totalBaseBudget: 5_700 });
  assert.equal(model.consumptionState, 'strained');
  assert.equal(model.noIncomeCycles, 1);

  preparePopulationDemandCycle(world, 2, now + 300_000, { totalBaseBudget: 5_700 });
  assert.equal(model.consumptionState, 'subsistence');
  assert.equal(model.noIncomeCycles, 2);
});

test('consumption state changes allocation but not the spendable budget formula', () => {
  const normalWorld = createWorld(now);
  const lavishWorld = createWorld(now);
  resetPopulation(normalWorld);
  resetPopulation(lavishWorld);
  const normal = configureQualifiedBasic(normalWorld, { state: 'normal' });
  const lavish = configureQualifiedBasic(lavishWorld, {
    state: 'lavish', prosperityCycles: 2, lavishCycles: 3,
  });

  preparePopulationDemandCycle(normalWorld, 1, now, { totalBaseBudget: 5_700 });
  preparePopulationDemandCycle(lavishWorld, 1, now, { totalBaseBudget: 5_700 });

  assert.equal(normal.consumptionState, 'normal');
  assert.equal(lavish.consumptionState, 'lavish');
  assert.equal(normal.lastBudget, lavish.lastBudget);
  assert.equal(normal.foodBudget + normal.householdBudget, normal.lastBudget);
  assert.equal(lavish.foodBudget + lavish.householdBudget, lavish.lastBudget);
  const normalBase = Math.min(normal.lastBudget, normal.stabilizationBudget);
  const lavishBase = Math.min(lavish.lastBudget, lavish.stabilizationBudget);
  assert.equal(normal.foodBudget, Math.floor(normalBase * 0.78) + Math.floor((normal.lastBudget - normalBase) * 0.78));
  assert.equal(lavish.foodBudget, Math.floor(lavishBase * 0.65) + Math.floor((lavish.lastBudget - lavishBase) * 0.65));
});

test('version 3 cautious state migrates to strained without reissuing bootstrap funds', () => {
  const world = createWorld(now);
  const state = ensurePopulationEconomy(world, now);
  const beforeCredits = Object.values(state.models).reduce((sum, model) => sum + model.credits, 0);
  state.modelVersion = 3;
  state.models.skilled.consumptionState = 'cautious';
  delete state.models.skilled.stateCycles;
  delete state.models.skilled.incomeHealthBps;

  ensurePopulationEconomy(world, now);
  assert.equal(state.modelVersion, 4);
  assert.equal(state.models.skilled.consumptionState, 'strained');
  assert.equal(state.models.skilled.stateCycles, 1);
  assert.equal(Object.values(state.models).reduce((sum, model) => sum + model.credits, 0), beforeCredits);
});
