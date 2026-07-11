import assert from 'node:assert/strict';
import test from 'node:test';
import { createWorld, ensurePlayer } from '../src/domain.js';
import { EconomyStore } from '../src/storage.js';

const alice = { id: 1, email: 'alice@example.com', name: 'Alice' };
const bob = { id: 2, email: 'bob@example.com', name: 'Bob' };
const now = 1_700_000_000_000;

function group(overrides = {}) {
  return {
    facilityTypeId: 'farm',
    count: 2,
    participatingCount: 0,
    pendingJoinCount: 0,
    status: 'paused',
    stopReason: 'manual',
    productionMode: 'continuous',
    completedQuantity: 0,
    ...overrides,
  };
}

function action(actionName, payload, key, path) {
  return {
    action: actionName,
    payload,
    requestKey: key,
    method: 'POST',
    path,
  };
}

function seedStore(configure) {
  const store = new EconomyStore(':memory:');
  const world = createWorld(now);
  const alicePlayer = ensurePlayer(world, alice, now);
  const bobPlayer = ensurePlayer(world, bob, now);
  alicePlayer.credits = 10_000;
  bobPlayer.credits = 10_000;
  configure?.({ world, alicePlayer, bobPlayer });
  store.insertWorld.run(1, JSON.stringify(world), now - 60_000);
  return store;
}

function persistedWorld(store) {
  return JSON.parse(String(store.selectWorld.get().state_json));
}

test('legacy factory instances migrate into type groups without losing quantity or goods', () => {
  const store = seedStore(({ alicePlayer }) => {
    alicePlayer.facilities = [
      {
        id: 'farm-a', facilityTypeId: 'farm', name: '农场 1', ownerId: alice.id,
        status: 'paused', builtAt: now, outputProductId: 'grain', outputPerCycle: 2,
        inputPerCycle: 0, operatingCost: 1, cycleMs: 30_000, systemValue: 80,
        productionMode: 'continuous', completedQuantity: 4, internalGoods: 3,
      },
      {
        id: 'farm-b', facilityTypeId: 'farm', name: '农场 2', ownerId: alice.id,
        status: 'paused', builtAt: now, outputProductId: 'grain', outputPerCycle: 2,
        inputPerCycle: 0, operatingCost: 1, cycleMs: 30_000, systemValue: 80,
        productionMode: 'continuous', completedQuantity: 2, internalGoods: 2,
      },
      {
        id: 'mine-a', facilityTypeId: 'mine', name: '矿场 1', ownerId: alice.id,
        status: 'paused', builtAt: now, outputProductId: 'ore', outputPerCycle: 2,
        inputPerCycle: 0, operatingCost: 1, cycleMs: 35_000, systemValue: 90,
        productionMode: 'continuous', completedQuantity: 0,
      },
    ];
  });
  try {
    const state = store.getState(alice, now);
    assert.equal(state.version, 8);
    assert.equal(Object.hasOwn(state, 'facilities'), false);
    assert.equal(state.facilityGroups.find((item) => item.facilityTypeId === 'farm').count, 2);
    assert.equal(state.facilityGroups.find((item) => item.facilityTypeId === 'mine').count, 1);
    assert.equal(state.inventories.grain.available, 5);
    const persisted = persistedWorld(store).players['1'];
    assert.equal(Object.hasOwn(persisted, 'facilities'), false);
    assert.equal(persisted.facilityGroups.length, 2);
  } finally {
    store.close();
  }
});

test('same-type factories share one cycle and produce as one group', () => {
  const store = seedStore(({ alicePlayer }) => {
    alicePlayer.facilityGroups = [group({
      count: 2,
      participatingCount: 2,
      status: 'running',
      stopReason: undefined,
      cycleStartedAt: now - 60_000,
    })];
  });
  try {
    const state = store.getState(alice, now);
    const farm = state.facilityGroups[0];
    assert.equal(state.inventories.grain.available, 8);
    assert.equal(state.credits, 9_996);
    assert.equal(farm.completedQuantity, 8);
    assert.equal(farm.participatingCount, 2);
    assert.equal(farm.status, 'running');
  } finally {
    store.close();
  }
});

test('newly completed factory joins after the current cycle without resetting progress', () => {
  const store = seedStore(({ alicePlayer }) => {
    alicePlayer.facilityGroups = [group({
      count: 2,
      participatingCount: 2,
      status: 'running',
      stopReason: undefined,
      cycleStartedAt: now - 30_000,
    })];
    alicePlayer.facilityConstruction = {
      facilityTypeId: 'farm',
      startedAt: now - 300_000,
      completesAt: now,
    };
  });
  try {
    const state = store.getState(alice, now);
    const farm = state.facilityGroups[0];
    assert.equal(state.inventories.grain.available, 4);
    assert.equal(farm.count, 3);
    assert.equal(farm.participatingCount, 3);
    assert.equal(farm.pendingJoinCount, 0);
    assert.equal(farm.cycleStartedAt, now);
    assert.equal(Object.hasOwn(state, 'facilityConstruction'), false);
  } finally {
    store.close();
  }
});

test('same-type group starts and stops uniformly', () => {
  const store = seedStore(({ alicePlayer }) => {
    alicePlayer.facilityGroups = [group({ count: 4 })];
  });
  try {
    const started = store.apply(alice, action(
      'startFacility',
      { facilityTypeId: 'farm' },
      'start-farm-group-12345678',
      '/api/game/facilities/farm/start',
    ), now + 1);
    assert.equal(started.result.ok, true);
    assert.equal(started.state.facilityGroups[0].participatingCount, 4);
    assert.equal(started.state.facilityGroups[0].status, 'running');

    const stopped = store.apply(alice, action(
      'pauseFacility',
      { facilityTypeId: 'farm' },
      'stop-farm-group-12345678',
      '/api/game/facilities/farm/stop',
    ), now + 2);
    assert.equal(stopped.result.ok, true);
    assert.equal(stopped.state.facilityGroups[0].participatingCount, 0);
    assert.equal(stopped.state.facilityGroups[0].status, 'paused');
  } finally {
    store.close();
  }
});

test('processing group consumes input and charges cost for all participating factories', () => {
  const store = seedStore(({ alicePlayer }) => {
    alicePlayer.inventories.grain.available = 20;
    alicePlayer.facilityGroups = [group({
      facilityTypeId: 'mill',
      count: 3,
      participatingCount: 3,
      status: 'running',
      stopReason: undefined,
      cycleStartedAt: now - 40_000,
    })];
  });
  try {
    const state = store.getState(alice, now);
    assert.equal(state.inventories.grain.available, 14);
    assert.equal(state.inventories.flour.available, 3);
    assert.equal(state.credits, 9_994);
    assert.equal(state.facilityGroups[0].completedQuantity, 3);
  } finally {
    store.close();
  }
});

test('factory quantity listing and partial purchase transfer exact counts', () => {
  const store = seedStore(({ bobPlayer }) => {
    bobPlayer.facilityGroups = [group({ count: 5 })];
  });
  try {
    const listed = store.apply(bob, action(
      'listFacility',
      { facilityTypeId: 'farm', quantity: 3, unitPrice: 80 },
      'list-farm-group-12345678',
      '/api/game/facilities/farm/list',
    ), now + 1);
    assert.equal(listed.result.ok, true);
    const listing = listed.state.facilityListings.find((item) => item.ownerId === bob.id);
    assert.equal(listing.quantity, 3);
    assert.equal(listing.unitPrice, 80);

    const bought = store.apply(alice, action(
      'buyFacility',
      { listingId: listing.id, quantity: 2 },
      'buy-farm-group-12345678',
      `/api/game/facility-listings/${listing.id}/buy`,
    ), now + 2);
    assert.equal(bought.result.ok, true);
    assert.equal(bought.state.facilityGroups.find((item) => item.facilityTypeId === 'farm').count, 2);
    assert.equal(bought.state.facilityListings.find((item) => item.id === listing.id).quantity, 1);

    const bobState = store.getState(bob, now + 3);
    assert.equal(bobState.facilityGroups.find((item) => item.facilityTypeId === 'farm').count, 3);
    assert.equal(bobState.credits, 10_160);
  } finally {
    store.close();
  }
});

test('purchased factories join a running group on the next cycle', () => {
  const store = seedStore(({ world, alicePlayer }) => {
    alicePlayer.facilityGroups = [group({
      count: 2,
      participatingCount: 2,
      status: 'running',
      stopReason: undefined,
      cycleStartedAt: now - 15_000,
    })];
    world.facilityListings.push({
      id: 'market-farm-quantity',
      facilityTypeId: 'farm',
      ownerType: 'market',
      ownerName: '系统资产市场',
      quantity: 2,
      unitPrice: 80,
      createdAt: now,
    });
  });
  try {
    const bought = store.apply(alice, action(
      'buyFacility',
      { listingId: 'market-farm-quantity', quantity: 1 },
      'buy-running-farm-12345678',
      '/api/game/facility-listings/market-farm-quantity/buy',
    ), now);
    const farm = bought.state.facilityGroups.find((item) => item.facilityTypeId === 'farm');
    assert.equal(farm.count, 3);
    assert.equal(farm.participatingCount, 2);
    assert.equal(farm.pendingJoinCount, 1);
    assert.equal(farm.nextCycleCount, 3);
  } finally {
    store.close();
  }
});

test('pending join pauses an incompatible target plan after the current cycle', () => {
  const store = seedStore(({ alicePlayer }) => {
    alicePlayer.facilityGroups = [group({
      count: 3,
      participatingCount: 2,
      pendingJoinCount: 1,
      status: 'running',
      stopReason: undefined,
      cycleStartedAt: now - 30_000,
      productionMode: 'target',
      targetQuantity: 12,
      completedQuantity: 0,
    })];
  });
  try {
    const state = store.getState(alice, now);
    const farm = state.facilityGroups[0];
    assert.equal(state.inventories.grain.available, 4);
    assert.equal(farm.status, 'paused');
    assert.equal(farm.stopReason, 'plan_adjustment_required');
  } finally {
    store.close();
  }
});

test('facility group actions remain idempotent', () => {
  const store = seedStore(({ alicePlayer }) => {
    alicePlayer.facilityGroups = [group({ count: 2 })];
  });
  try {
    const request = action(
      'startFacility',
      { facilityTypeId: 'farm' },
      'idempotent-group-start-12345678',
      '/api/game/facilities/farm/start',
    );
    const first = store.apply(alice, request, now + 1);
    const second = store.apply(alice, request, now + 2);
    assert.deepEqual(second, first);
    assert.equal(store.getState(alice, now + 3).facilityGroups[0].participatingCount, 2);
  } finally {
    store.close();
  }
});
