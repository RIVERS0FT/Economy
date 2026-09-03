import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MARKET_DEMAND_MODEL_VERSION,
  createWorld,
  ensurePlayer,
  processMarketDemand,
} from '../src/domain.js';
import { DEFAULT_PROVINCE_ID, PROVINCE_CATALOG } from '../src/provinces.js';
import {
  STATE_ECONOMIC_BASELINES,
  STATE_ECONOMIC_BASELINE_SOURCES,
  activePopulationDemandProvinceIds,
  populationDemandProvinceWeights,
  stateEconomicBaselineFor,
} from '../src/state-economic-baselines.js';

const NOW = 1_788_000_000_000;
const CALIFORNIA = DEFAULT_PROVINCE_ID;
const TEXAS = 'US-TX';

test('official state economic baseline covers every contiguous state with explicit source periods', () => {
  assert.equal(STATE_ECONOMIC_BASELINES.length, 48);
  assert.deepEqual(
    new Set(STATE_ECONOMIC_BASELINES.map((row) => row.provinceId)),
    new Set(PROVINCE_CATALOG.map((province) => province.id)),
  );
  assert.equal(STATE_ECONOMIC_BASELINE_SOURCES.population.period, '2025-07-01');
  assert.equal(STATE_ECONOMIC_BASELINE_SOURCES.wage.period, '2025-Q4');
  assert.equal(STATE_ECONOMIC_BASELINE_SOURCES.wage.status, 'preliminary');
  assert.equal(STATE_ECONOMIC_BASELINE_SOURCES.consumption.period, '2023');

  assert.deepEqual(stateEconomicBaselineFor(CALIFORNIA), {
    provinceId: CALIFORNIA,
    state: 'California',
    shortName: 'CA',
    population: 39_355_309,
    averageWeeklyWage: 1_954,
    pceMillions: 2_526_290,
  });
  assert.deepEqual(stateEconomicBaselineFor(TEXAS), {
    provinceId: TEXAS,
    state: 'Texas',
    shortName: 'TX',
    population: 31_709_821,
    averageWeeklyWage: 1_549,
    pceMillions: 1_595_278,
  });
});

test('population demand follows economic footprints instead of legacy access fields and falls back to California', () => {
  assert.deepEqual(activePopulationDemandProvinceIds({ players: {} }), [CALIFORNIA]);
  assert.deepEqual(activePopulationDemandProvinceIds({ players: { '1': { startingProvinceId: CALIFORNIA, unlockedProvinces: [CALIFORNIA, TEXAS], facilityGroups: [] } } }), [CALIFORNIA]);

  const world = {
    players: {
      '1': {
        startingProvinceId: CALIFORNIA,
        unlockedProvinces: [CALIFORNIA, TEXAS],
        facilityGroups: [],
      },
      '2': {
        startingProvinceId: TEXAS,
        unlockedProvinces: [TEXAS],
        facilityGroups: [],
      },
    },
  };
  assert.deepEqual(activePopulationDemandProvinceIds(world), [CALIFORNIA, TEXAS]);
  const weights = populationDemandProvinceWeights(world);
  assert.deepEqual(weights.map((row) => row.provinceId), [CALIFORNIA, TEXAS]);
  assert.ok(Math.abs(weights.reduce((sum, row) => sum + row.pceShare, 0) - 1) < 1e-12);
  assert.ok(weights.find((row) => row.provinceId === CALIFORNIA).pceShare
    > weights.find((row) => row.provinceId === TEXAS).pceShare);
});

test('population demand uses PCE weights to create state-local orders without duplicating wallet budget', () => {
  const world = createWorld(NOW);
  const californiaPlayer = ensurePlayer(world, { id: 1001, name: 'California player' }, NOW);
  const texasPlayer = ensurePlayer(world, { id: 1002, name: 'Texas player' }, NOW);

  Object.assign(californiaPlayer, {
    startingProvinceId: CALIFORNIA,
    startingProvinceChosen: true,
    unlockedProvinces: [CALIFORNIA],
  });
  Object.assign(texasPlayer, {
    startingProvinceId: TEXAS,
    startingProvinceChosen: true,
    unlockedProvinces: [TEXAS],
  });

  processMarketDemand(world, NOW);

  assert.equal(MARKET_DEMAND_MODEL_VERSION, 20);
  const demandOrders = world.orders.filter((order) => (
    order.ownerType === 'population'
    && (order.demandTier === 'direct' || order.demandTier === 'derived-liquidity')
  ));
  assert.ok(demandOrders.length > 0);
  assert.equal(demandOrders.every((order) => order.provinceId === CALIFORNIA || order.provinceId === TEXAS), true);
  assert.equal(demandOrders.some((order) => order.provinceId === CALIFORNIA), true);
  assert.equal(demandOrders.some((order) => order.provinceId === TEXAS), true);
  assert.equal(demandOrders.some((order) => !order.provinceId), false);

  const cycleId = Math.floor(NOW / 300_000);
  for (const group of Object.values(world.marketDemand.groups)) {
    const provinceBudget = Object.values(group.lastProvinceBudgets || {})
      .reduce((sum, amount) => sum + Number(amount || 0), 0);
    assert.ok(Math.abs(provinceBudget - Number(group.lastBudget || 0)) < 0.00001);
    const caBudget = Number(group.lastProvinceBudgets?.[CALIFORNIA] || 0);
    const txBudget = Number(group.lastProvinceBudgets?.[TEXAS] || 0);
    assert.ok(caBudget > txBudget && txBudget > 0);
    for (const provinceId of [CALIFORNIA, TEXAS]) {
      const committed = demandOrders
        .filter((order) => order.demandGroupId === group.demandGroupId
          && order.provinceId === provinceId
          && Number(order.demandCycleId) === cycleId)
        .reduce((sum, order) => sum + Number(order.price || 0) * Number(order.quantity || 0), 0);
      assert.ok(committed <= Number(group.lastProvinceBudgets?.[provinceId] || 0) + 0.00001);
    }
  }
});


test('full 48-state population demand cycle stays below the server timeout budget', () => {
  const world = createWorld(NOW + 60_000);
  let userId = 2_000;
  for (const province of PROVINCE_CATALOG) {
    const player = ensurePlayer(
      world,
      { id: userId, name: province.shortName },
      NOW + 60_000,
      { migrate: false },
    );
    Object.assign(player, {
      startingProvinceId: province.id,
      startingProvinceChosen: true,
      unlockedProvinces: [province.id],
    });
    userId += 1;
  }

  assert.equal(activePopulationDemandProvinceIds(world).length, 48);
  const startedAt = performance.now();
  processMarketDemand(world, NOW + 60_000);
  const elapsedMs = performance.now() - startedAt;
  assert.ok(elapsedMs < 8_000, `48-state demand cycle took ${elapsedMs.toFixed(1)}ms`);

  for (const group of Object.values(world.marketDemand.groups)) {
    assert.equal(Object.keys(group.lastProvinceBudgets || {}).length, 48);
    const provinceBudget = Object.values(group.lastProvinceBudgets || {})
      .reduce((sum, amount) => sum + Number(amount || 0), 0);
    assert.ok(Math.abs(provinceBudget - Number(group.lastBudget || 0)) < 0.00001);
  }
});
