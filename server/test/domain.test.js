import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, createClientState, createWorld, ensurePlayer } from '../src/domain.js';
import { EconomyStore } from '../src/storage.js';

const alice = { id: 1, email: 'alice@example.com', name: 'Alice' };
const bob = { id: 2, email: 'bob@example.com', name: 'Bob' };

test('player orders settle both players atomically in the world state', () => {
  const now = 1_700_000_000_000;
  const world = createWorld(now);
  const aliceState = ensurePlayer(world, alice, now);
  const bobState = ensurePlayer(world, bob, now);
  bobState.inventory = 5;

  const sell = applyAction(world, bob, 'placeOrder', { side: 'sell', quantity: 5, price: 7 }, now + 1);
  assert.equal(sell.ok, true);
  assert.equal(bobState.inventory, 0);
  assert.equal(bobState.frozenInventory, 5);

  const buy = applyAction(world, alice, 'placeOrder', { side: 'buy', quantity: 3, price: 8 }, now + 2);
  assert.equal(buy.ok, true);
  assert.equal(aliceState.inventory, 3);
  assert.equal(aliceState.credits, 79);
  assert.equal(aliceState.frozenCredits, 0);
  assert.equal(bobState.credits, 121);
  assert.equal(bobState.frozenInventory, 2);

  const aliceClient = createClientState(world, alice.id, now + 3);
  assert.equal(aliceClient.trades[0].counterparty, 'Bob');
  assert.equal(aliceClient.marketPrice, 7);
});

test('work cooldown uses server time', () => {
  const now = 1_700_000_000_000;
  const world = createWorld(now);
  ensurePlayer(world, alice, now);
  assert.equal(applyAction(world, alice, 'work', {}, now).ok, true);
  assert.equal(applyAction(world, alice, 'work', {}, now + 1_000).ok, false);
  assert.equal(applyAction(world, alice, 'work', {}, now + 3_000).ok, true);
});

test('player facility listing transfers the original unique facility', () => {
  const now = 1_700_000_000_000;
  const world = createWorld(now);
  const seller = ensurePlayer(world, bob, now);
  const buyer = ensurePlayer(world, alice, now);
  seller.facilities.push({
    id: 'facility-unique',
    name: '唯一设施',
    ownerId: bob.id,
    level: 1,
    status: 'ready',
    builtAt: now,
    cycleMs: 30_000,
    outputPerCycle: 1,
    operatingCost: 1,
    internalGoods: 0,
    internalCapacity: 20,
    lifetimeOutput: 9,
    systemValue: 80,
  });

  assert.equal(applyAction(world, bob, 'listFacility', { facilityId: 'facility-unique', price: 80 }, now + 1).ok, true);
  const listing = world.facilityListings.find((item) => item.ownerId === bob.id);
  assert.ok(listing);
  assert.equal(applyAction(world, alice, 'buyFacility', { listingId: listing.id }, now + 2).ok, true);
  assert.equal(seller.facilities.length, 0);
  assert.equal(seller.credits, 180);
  assert.equal(buyer.credits, 20);
  assert.equal(buyer.facilities[0].id, 'facility-unique');
  assert.equal(buyer.facilities[0].ownerId, alice.id);
});

test('idempotency returns the original response without applying an action twice', () => {
  const store = new EconomyStore(':memory:');
  try {
    const request = {
      action: 'work',
      payload: {},
      requestKey: 'request-12345678',
      method: 'POST',
      path: '/api/game/work',
    };
    const first = store.apply(alice, request, 1_700_000_000_000);
    const second = store.apply(alice, request, 1_700_000_000_500);
    assert.deepEqual(second, first);
    assert.equal(store.getState(alice, 1_700_000_000_500).credits, 101);
  } finally {
    store.close();
  }
});
