import assert from 'node:assert/strict';
import test from 'node:test';
import { createWorld } from '../src/domain.js';
import {
  advancePopulationDemographics,
  ensurePopulationDemographics,
  POPULATION_BASE_WORLD,
  POPULATION_C1_CAPACITY,
  POPULATION_COMPLEXITY_WEIGHTS_BPS,
  POPULATION_MIGRATION_IN_BPS,
  POPULATION_MIGRATION_OUT_BPS,
  populationReferenceBudget,
} from '../src/population-demographics.js';
import { ensurePopulationEconomy, preparePopulationDemandCycle } from '../src/population-economy.js';

const now = 1_700_000_000_000;
const cycle = Math.floor(now / 300_000);

function group(facilityTypeId, count, { running = false, staffingRateBps = 10_000 } = {}) {
  return {
    facilityTypeId,
    count,
    participatingCount: running ? count : 0,
    enabled: running,
    status: running ? 'running' : 'stopped',
    statusReason: running ? undefined : 'manual',
    staffingRateBps,
    staffingUpdatedAt: now,
  };
}

function installPlayer(world, id, groups) {
  world.players[String(id)] = { userId: id, facilityGroups: groups };
}

test('new worlds start with the permanent base population and no factory instances', () => {
  const world = createWorld(now);
  const state = ensurePopulationEconomy(world, now);
  assert.equal(state.modelVersion, 7);
  assert.equal(state.demographics.currentPopulation, POPULATION_BASE_WORLD);
  assert.deepEqual(Object.fromEntries(Object.entries(state.models).map(([id, model]) => [id, model.population])), {
    basic: 600, skilled: 300, professional: 100,
  });
  assert.equal(populationReferenceBudget(POPULATION_BASE_WORLD), 570);
  assert.equal(state.stats.migrationIssued, 570);
  assert.equal(Object.values(state.models).reduce((sum, model) => sum + model.credits, 0), 570);
});

test('legacy population model migrates once to 10000 without changing wallets', () => {
  const world = createWorld(now);
  const state = ensurePopulationEconomy(world, now);
  const before = Object.fromEntries(Object.entries(state.models).map(([id, model]) => [id, model.credits]));
  state.modelVersion = 6;
  delete state.demographics;
  for (const model of Object.values(state.models)) {
    delete model.population;
    delete model.targetPopulation;
  }
  ensurePopulationEconomy(world, now);
  assert.equal(state.demographics.currentPopulation, 10_000);
  assert.deepEqual(Object.fromEntries(Object.entries(state.models).map(([id, model]) => [id, model.population])), {
    basic: 6_000, skilled: 3_000, professional: 1_000,
  });
  assert.deepEqual(Object.fromEntries(Object.entries(state.models).map(([id, model]) => [id, model.credits])), before);
  ensurePopulationEconomy(world, now);
  assert.equal(state.demographics.currentPopulation, 10_000);
});

test('one C1 factory adds exactly eleven structural capacity and transfer keeps world capacity', () => {
  const world = createWorld(now);
  const state = ensurePopulationEconomy(world, now);
  installPlayer(world, 1, [group('farm', 1)]);
  advancePopulationDemographics(world, state, cycle + 1, now + 300_000);
  assert.equal(POPULATION_C1_CAPACITY, 11);
  assert.equal(state.demographics.structuralCapacity, POPULATION_BASE_WORLD + 11);
  assert.equal(state.demographics.structuralCapacityByComplexity.C1.count, 1);

  world.players['1'].facilityGroups = [];
  installPlayer(world, 2, [group('farm', 1)]);
  advancePopulationDemographics(world, state, cycle + 2, now + 600_000);
  assert.equal(state.demographics.structuralCapacity, POPULATION_BASE_WORLD + 11);
});

test('complexity weights and running staffing affect active capacity but not structure', () => {
  const world = createWorld(now);
  const state = ensurePopulationEconomy(world, now);
  installPlayer(world, 1, [
    group('farm', 10, { running: true, staffingRateBps: 5_000 }),
    group('electronics-factory', 2, { running: false }),
  ]);
  advancePopulationDemographics(world, state, cycle + 1, now + 300_000);
  const expectedStructure = POPULATION_BASE_WORLD
    + 10 * POPULATION_C1_CAPACITY
    + Math.floor(2 * POPULATION_C1_CAPACITY * POPULATION_COMPLEXITY_WEIGHTS_BPS.C6 / 10_000);
  assert.equal(state.demographics.structuralCapacity, expectedStructure);
  assert.equal(state.demographics.activeCapacity, 55);
  assert.equal(state.demographics.structuralCapacityByComplexity.C6.count, 2);
  assert.equal(state.demographics.structuralCapacityByComplexity.C6.activeCapacity, 0);
});

test('population migration is directional, bounded, and idempotent within one cycle', () => {
  const world = createWorld(now);
  const state = ensurePopulationEconomy(world, now);
  installPlayer(world, 1, [group('farm', 1_000, { running: true })]);
  const before = state.demographics.currentPopulation;
  advancePopulationDemographics(world, state, cycle + 1, now + 300_000);
  assert.equal(state.demographics.lastMigrationDirection, 'in');
  assert.ok(state.demographics.lastMigration >= 1);
  assert.ok(state.demographics.lastMigration <= Math.ceil((state.demographics.targetPopulation - before) * POPULATION_MIGRATION_IN_BPS / 10_000));
  const after = state.demographics.currentPopulation;
  advancePopulationDemographics(world, state, cycle + 1, now + 300_001);
  assert.equal(state.demographics.currentPopulation, after);

  world.players['1'].facilityGroups = [];
  advancePopulationDemographics(world, state, cycle + 2, now + 600_000);
  assert.equal(state.demographics.lastMigrationDirection, 'out');
  assert.ok(state.demographics.lastMigration <= Math.ceil((after - state.demographics.targetPopulation) * POPULATION_MIGRATION_OUT_BPS / 10_000));
});

test('dynamic stabilization budget follows actual population and preserves wallet-gap cap', () => {
  const world = createWorld(now);
  const state = ensurePopulationEconomy(world, now);
  state.models.basic.population = 6_165;
  state.models.skilled.population = 2_845;
  state.models.professional.population = 1_142;
  state.demographics.currentPopulation = 10_152;
  state.demographics.referenceBudget = populationReferenceBudget(10_152);
  state.demographics.lastPopulationCycleId = Number.MAX_SAFE_INTEGER;
  for (const model of Object.values(state.models)) {
    model.credits = 0;
    model.frozenCredits = 0;
    model.incomeEma = 0;
    model.recentPeakIncome = 0;
    model.perCapitaIncomeEma = 0;
    model.recentPeakPerCapitaIncome = 0;
    model.lastBudget = 0;
  }
  const demand = preparePopulationDemandCycle(world, cycle + 1, now + 300_000);
  assert.equal(demand.population.referenceBudget, 5_786.64);
  assert.equal(demand.stabilizationTotal, 694.3968);
  assert.equal(Object.values(state.models).reduce((sum, model) => sum + model.lastStabilizationIssued, 0), 694.3968);
  for (const model of Object.values(state.models)) {
    model.credits = model.stabilizationBudget * state.policy.targetWalletCycles;
  }
  preparePopulationDemandCycle(world, cycle + 2, now + 600_000);
  assert.ok(Object.values(state.models).every((model) => model.lastStabilizationIssued === 0));
});

test('population classes remain conserved after adjacent structure conversion', () => {
  const world = createWorld(now);
  const state = ensurePopulationEconomy(world, now);
  installPlayer(world, 1, [group('appliance-factory', 1_000, { running: true })]);
  const before = Object.values(state.models).reduce((sum, model) => sum + model.population, 0);
  advancePopulationDemographics(world, state, cycle + 1, now + 300_000);
  const after = Object.values(state.models).reduce((sum, model) => sum + model.population, 0);
  assert.equal(after, state.demographics.currentPopulation);
  assert.equal(after, before + state.demographics.lastMigration);
  assert.ok(state.demographics.lastClassConversions <= Math.ceil(after * 0.01));
});
