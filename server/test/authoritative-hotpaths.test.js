import assert from 'node:assert/strict';
import test from 'node:test';
import { createWorld, ensurePlayer } from '../src/domain.js';
import {
  assertEconomicStateInvariants,
  beginEconomicSavepoint,
  createEconomicActionBoundary,
} from '../src/economic-mutation.js';
import { EconomyStore } from '../src/runtime-store.js';
import {
  dueWorldDeadlineDomains,
  WorldDeadlineRuntime,
} from '../src/world-deadline-runtime.js';
import {
  createStateDeliveryCache,
  getStateAuthorityPartition,
  getStateAuthoritySnapshot,
  subscribeStateAuthority,
} from '../../src/app/stateDelivery.js';
import { CURRENT_CLIENT_STATE_VERSION } from '../shared/economy-state-version.js';

function user(id = 1) {
  return { id, email: `player-${id}@example.com`, role: 'user' };
}

test('world deadline runtime reuses one plan for the same authoritative revision', () => {
  const now = 1_800_000_000_000;
  const world = createWorld(now);
  const runtime = new WorldDeadlineRuntime();
  const first = runtime.planFor(world, 7, now);
  const second = runtime.planFor(world, 7, now);
  assert.equal(second, first);
  assert.deepEqual(runtime.getDiagnostics(), {
    builds: 1,
    cacheHits: 1,
    invalidations: 0,
    lastBuildAt: now,
    lastDueDomains: dueWorldDeadlineDomains(first, now),
  });
});

test('deadline domain selection only reports authoritative deadlines that are actually due', () => {
  const now = 10_000;
  const plan = {
    deadlines: {
      facility: now - 1,
      market: now + 1,
      contract: now,
      bank: null,
      research: Number.POSITIVE_INFINITY,
    },
  };
  assert.deepEqual(dueWorldDeadlineDomains(plan, now), ['facility', 'contract']);
});

test('scheduler-style forced processing uses due domains instead of the legacy full-world force path', () => {
  const now = 1_800_000_000_000;
  const store = new EconomyStore(':memory:', { scheduledProcessing: false });
  try {
    const world = createWorld(now);
    store.resetSchedulerDiagnostics();
    store.processWorldIfDue(world, now, undefined, { force: true, auditTrigger: 'scheduler' });
    const diagnostics = store.getSchedulerDiagnostics().deadlineRuntime;
    assert.equal(diagnostics.lastDueDomains.includes('legacy-force'), false);
  } finally {
    store.close();
  }
});

test('economic action boundary restores world state after a failed mutation', () => {
  const now = 1_800_000_000_000;
  const world = createWorld(now);
  const player = ensurePlayer(world, user(), now);
  const beforeCredits = player.credits;
  const boundary = createEconomicActionBoundary(world);
  player.credits = -1;
  assert.throws(() => boundary.assert(), /经济状态不变量失败/);
  boundary.rollback();
  assert.equal(world.players['1'].credits, beforeCredits);
  assert.equal(assertEconomicStateInvariants(world), true);
});

test('economic savepoint rolls back SQLite side effects without aborting the outer transaction', () => {
  const store = new EconomyStore(':memory:', { scheduledProcessing: false });
  try {
    store.transaction(() => {
      const savepoint = beginEconomicSavepoint(store, 'test_action');
      store.upsertSetting.run('test.hotpath', 'temporary', 100, 1);
      assert.equal(store.selectSetting.get('test.hotpath')?.setting_value, 'temporary');
      savepoint.rollback();
      assert.equal(store.selectSetting.get('test.hotpath'), undefined);
    });
  } finally {
    store.close();
  }
});

test('failed registered runtime action persists idempotency but leaves authoritative world revision unchanged', () => {
  const now = 1_800_000_000_000;
  const store = new EconomyStore(':memory:', { scheduledProcessing: false });
  try {
    store.getState(user(), now);
    const revisionBefore = store.worldCache.revision;
    const stateJsonBefore = store.worldCache.stateJson;
    const response = store.apply(user(), {
      action: 'bankWithdraw',
      payload: { amount: 1 },
      requestKey: 'failed-action-hotpath',
      method: 'POST',
      path: '/economy-api/game/bank/withdraw',
    }, now + 10);
    assert.equal(response.result.ok, false);
    assert.equal(response.revision, revisionBefore);
    assert.equal(store.worldCache.revision, revisionBefore);
    assert.equal(store.worldCache.stateJson, stateJsonBefore);
    assert.ok(store.selectIdempotency.get(1, 'failed-action-hotpath'));
  } finally {
    store.close();
  }
});

test('state delivery publishes stable partition references for unchanged partitions', () => {
  const cache = createStateDeliveryCache();
  let notifications = 0;
  const unsubscribe = subscribeStateAuthority(() => { notifications += 1; });
  try {
    cache.reset();
    cache.accept({
      revision: 1,
      unchanged: false,
      serverNow: 1_000,
      partitionRevisions: {
        catalog: 'c1', player: 'p1', market: 'm1', auction: 'a1', contract: 'x1', leaderboard: 'l1',
      },
      patches: {
        catalog: {
          version: CURRENT_CLIENT_STATE_VERSION,
          products: [{ id: 'wheat' }],
          facilityTypes: [{ id: 'farm' }],
          commercialBuildingTypes: [{ id: 'convenience-store' }],
          researchLevels: [{ id: 'C1' }],
          provinces: [{ id: '110000' }],
          defaultProvinceId: '110000',
        },
        player: { userId: 1, credits: 100 },
        market: { orders: [] },
        auction: { assetAuctions: [] },
        contract: { productionContracts: [] },
        leaderboard: { leaderboard: [] },
      },
    });
    const playerPartition = getStateAuthorityPartition('player');
    cache.accept({
      revision: 2,
      unchanged: false,
      serverNow: 2_000,
      partitionRevisions: {
        catalog: 'c1', player: 'p1', market: 'm2', auction: 'a1', contract: 'x1', leaderboard: 'l1',
      },
      patches: { market: { orders: [{ id: 'order-1' }] } },
    });
    assert.equal(getStateAuthorityPartition('player'), playerPartition);
    assert.equal(getStateAuthoritySnapshot().revision, 2);
    assert.deepEqual(getStateAuthoritySnapshot().changedPartitions, ['market']);
    assert.ok(notifications >= 3);
  } finally {
    unsubscribe();
    cache.reset();
  }
});
