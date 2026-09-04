import assert from 'node:assert/strict';
import test from 'node:test';
import { nextCommercialBuildingDeadline } from '../src/commercial-building-deadline.js';
import { createWorldDeadlinePlan } from '../src/world-deadline-planner.js';

const now = 1_800_000_000_000;

test('commercial cycle completion advances the market world-processing deadline', () => {
  const cycleCompletesAt = now + 12_345;
  const world = {
    players: {
      1: {
        commercialBuildingGroups: [{
          commercialTypeId: 'convenience-store',
          provinceId: '110000',
          count: 1,
          pendingRevenue: 20,
          cycleCompletesAt,
        }],
      },
    },
    marketDemand: {
      priceTransmission: { cycleMs: 300_000, lastCycleId: Math.floor(now / 300_000) },
      groups: {},
    },
    populationEconomy: { policy: {} },
    assetAuctions: [],
    productionContracts: [],
    orders: [],
    leaderboardState: { periodKey: 'test', startsAt: now, endsAt: now + 86_400_000 },
  };

  assert.equal(nextCommercialBuildingDeadline(world), cycleCompletesAt);
  const plan = createWorldDeadlinePlan(world, now);
  assert.equal(plan.deadlines.market, cycleCompletesAt);
  assert.equal(plan.nextDueAt, cycleCompletesAt);
});

test('idle or blocked commercial groups do not create a scheduler spin deadline', () => {
  const world = {
    players: {
      1: {
        commercialBuildingGroups: [
          { enabled: true, status: 'error', pendingRevenue: 0 },
          { enabled: false, status: 'stopped' },
        ],
      },
    },
  };
  assert.equal(nextCommercialBuildingDeadline(world), null);
});
