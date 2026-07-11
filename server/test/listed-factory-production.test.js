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
    count: 5,
    participatingCount: 0,
    pendingJoinCount: 0,
    status: 'paused',
    stopReason: 'manual',
    productionMode: 'continuous',
    completedQuantity: 0,
    ...overrides,
  };
}

function listing(ownerId, quantity = 2) {
  return {
    id: `farm-listing-${ownerId}`,
    facilityTypeId: 'farm',
    ownerType: 'player',
    ownerId,
    ownerName: ownerId === alice.id ? 'Alice' : 'Bob',
    quantity,
    unitPrice: 80,
    createdAt: now,
  };
}

function action(actionName, payload, key, path) {
  return { action: actionName, payload, requestKey: key, method: 'POST', path };
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

test('listed factories are excluded while unlisted factories can start and produce', () => {
  const store = seedStore(({ world, alicePlayer }) => {
    alicePlayer.facilityGroups = [group()];
    world.facilityListings.push(listing(alice.id, 2));
  });
  try {
    const started = store.apply(alice, action(
      'startFacility',
      { facilityTypeId: 'farm' },
      'start-listed-farm-12345678',
      '/api/game/facilities/farm/start',
    ), now + 1);
    const startedFarm = started.state.facilityGroups[0];
    assert.equal(started.result.ok, true);
    assert.equal(startedFarm.status, 'running');
    assert.equal(startedFarm.count, 5);
    assert.equal(startedFarm.listedCount, 2);
    assert.equal(startedFarm.availableCount, 3);
    assert.equal(startedFarm.participatingCount, 3);

    const produced = store.getState(alice, now + 30_001);
    assert.equal(produced.inventories.grain.available, 6);
    assert.equal(produced.credits, 9_997);
    assert.equal(produced.facilityGroups[0].participatingCount, 3);
  } finally {
    store.close();
  }
});

test('target plan uses only unlisted factory quantity', () => {
  const store = seedStore(({ world, alicePlayer }) => {
    alicePlayer.facilityGroups = [group()];
    world.facilityListings.push(listing(alice.id, 2));
  });
  try {
    const planned = store.apply(alice, action(
      'setProductionPlan',
      { facilityTypeId: 'farm', mode: 'target', targetQuantity: 12 },
      'plan-listed-farm-12345678',
      '/api/game/facilities/farm/plan',
    ), now + 1);
    assert.equal(planned.result.ok, true);
    assert.equal(planned.state.facilityGroups[0].targetQuantity, 12);

    const invalid = store.apply(alice, action(
      'setProductionPlan',
      { facilityTypeId: 'farm', mode: 'target', targetQuantity: 10 },
      'plan-listed-farm-invalid-12345678',
      '/api/game/facilities/farm/plan',
    ), now + 2);
    assert.equal(invalid.result.ok, false);
    assert.match(invalid.result.message, /周期产量 6/);
  } finally {
    store.close();
  }
});

test('cancelling a listing during production joins that quantity next cycle', () => {
  const store = seedStore(({ world, alicePlayer }) => {
    alicePlayer.facilityGroups = [group()];
    world.facilityListings.push(listing(alice.id, 2));
  });
  try {
    store.apply(alice, action(
      'startFacility',
      { facilityTypeId: 'farm' },
      'start-before-unlist-12345678',
      '/api/game/facilities/farm/start',
    ), now + 1);
    const cancelled = store.apply(alice, action(
      'cancelFacilityListing',
      { listingId: `farm-listing-${alice.id}` },
      'cancel-running-listing-12345678',
      `/api/game/facility-listings/farm-listing-${alice.id}/cancel`,
    ), now + 10_000);
    const pending = cancelled.state.facilityGroups[0];
    assert.equal(cancelled.result.ok, true);
    assert.equal(pending.status, 'running');
    assert.equal(pending.participatingCount, 3);
    assert.equal(pending.pendingJoinCount, 2);
    assert.equal(pending.nextCycleCount, 5);

    const nextCycle = store.getState(alice, now + 30_001);
    assert.equal(nextCycle.inventories.grain.available, 6);
    assert.equal(nextCycle.facilityGroups[0].participatingCount, 5);
    assert.equal(nextCycle.facilityGroups[0].pendingJoinCount, 0);
  } finally {
    store.close();
  }
});

test('selling listed factories does not stop the seller running group', () => {
  const store = seedStore(({ world, bobPlayer }) => {
    bobPlayer.facilityGroups = [group()];
    world.facilityListings.push(listing(bob.id, 2));
  });
  try {
    const started = store.apply(bob, action(
      'startFacility',
      { facilityTypeId: 'farm' },
      'start-seller-listed-farm-12345678',
      '/api/game/facilities/farm/start',
    ), now + 1);
    assert.equal(started.result.ok, true);
    assert.equal(started.state.facilityGroups[0].participatingCount, 3);

    const bought = store.apply(alice, action(
      'buyFacility',
      { listingId: `farm-listing-${bob.id}`, quantity: 1 },
      'buy-running-seller-listing-12345678',
      `/api/game/facility-listings/farm-listing-${bob.id}/buy`,
    ), now + 2);
    assert.equal(bought.result.ok, true);

    const seller = store.getState(bob, now + 3);
    const farm = seller.facilityGroups[0];
    assert.equal(farm.status, 'running');
    assert.equal(farm.count, 4);
    assert.equal(farm.listedCount, 1);
    assert.equal(farm.availableCount, 3);
    assert.equal(farm.participatingCount, 3);
  } finally {
    store.close();
  }
});
