import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, createWorld, ensurePlayer } from '../src/domain.js';
import { findSelfCrossingOrderForPayload, SELF_CROSS_MESSAGE } from '../src/order-book-integrity.js';

const now = 1_700_000_000_000;
const alice = { id: 1, email: 'alice@example.com', name: 'Alice' };

function deferDemand(world) {
  for (const state of Object.values(world.demandGroups)) state.nextDemandAt = now + 60 * 60 * 1000;
}

test('commodity orders reject a price that crosses the same player resting order before freezing assets', () => {
  const world = createWorld(now);
  deferDemand(world);
  const player = ensurePlayer(world, alice, now);
  player.credits = 1_000;
  player.inventories.wheat.available = 3;

  const sell = applyAction(world, alice, 'placeOrder', {
    productId: 'wheat', side: 'sell', quantity: 2, price: 10,
  }, now + 1);
  assert.equal(sell.ok, true);
  assert.equal(player.inventories.wheat.available, 1);
  assert.equal(player.inventories.wheat.frozen, 2);

  const creditsBefore = player.credits;
  const frozenCreditsBefore = player.frozenCredits;
  const orderCountBefore = world.orders.length;
  const buy = applyAction(world, alice, 'placeOrder', {
    productId: 'wheat', side: 'buy', quantity: 1, price: 10,
  }, now + 2);

  assert.deepEqual(buy, { ok: false, message: SELF_CROSS_MESSAGE });
  assert.equal(player.credits, creditsBefore);
  assert.equal(player.frozenCredits, frozenCreditsBefore);
  assert.equal(world.orders.length, orderCountBefore);
});

test('self-cross detection applies to facility payloads used by the unified order book', () => {
  const world = createWorld(now);
  world.orders.push({
    id: 'facility-sell', assetKind: 'facility', assetId: 'farm', facilityTypeId: 'farm',
    side: 'sell', ownerType: 'player', ownerId: alice.id, ownerName: 'Alice',
    price: 100, quantity: 1, remaining: 1, status: 'open', createdAt: now,
  });

  assert.equal(Boolean(findSelfCrossingOrderForPayload(world, alice.id, {
    assetKind: 'facility', assetId: 'farm', side: 'buy', quantity: 1, price: 100,
  })), true);
  assert.equal(Boolean(findSelfCrossingOrderForPayload(world, alice.id, {
    assetKind: 'facility', assetId: 'farm', side: 'buy', quantity: 1, price: 99,
  })), false);
});
