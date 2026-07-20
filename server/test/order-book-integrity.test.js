import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, createWorld, ensurePlayer, FACILITY_TYPE_CATALOG } from '../src/domain.js';
import { applyFacilityGroupAction } from '../src/facility-groups.js';
import { SELF_CROSS_MESSAGE } from '../src/order-book-integrity.js';

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

test('facility orders reject a price that crosses the same player resting order before freezing funds', () => {
  const world = createWorld(now);
  deferDemand(world);
  const player = ensurePlayer(world, alice, now);
  const farm = FACILITY_TYPE_CATALOG.find((type) => type.id === 'farm');
  assert.ok(farm);
  player.credits = 100_000;
  player.facilityGroups = [{ facilityTypeId: farm.id, count: 1 }];

  const sell = applyFacilityGroupAction(world, alice, 'placeOrder', {
    assetKind: 'facility', assetId: farm.id, side: 'sell', quantity: 1, price: farm.systemValue,
  }, now + 1);
  assert.equal(sell.ok, true);

  const creditsBefore = player.credits;
  const frozenCreditsBefore = player.frozenCredits;
  const orderCountBefore = world.orders.length;
  const buy = applyFacilityGroupAction(world, alice, 'placeOrder', {
    assetKind: 'facility', assetId: farm.id, side: 'buy', quantity: 1, price: farm.systemValue,
  }, now + 2);

  assert.deepEqual(buy, { ok: false, message: SELF_CROSS_MESSAGE });
  assert.equal(player.credits, creditsBefore);
  assert.equal(player.frozenCredits, frozenCreditsBefore);
  assert.equal(world.orders.length, orderCountBefore);
});
