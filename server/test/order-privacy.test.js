import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, ensurePlayer } from '../src/domain.js';
import { createFacilityGroupClientState } from '../src/facility-groups.js';

const now = Date.UTC(2026, 6, 17, 12, 0, 0);
const alice = { id: 101, name: 'Alice' };
const bob = { id: 202, name: 'Bob' };

test('ordinary player order state removes counterparties, demand sources, and linked order ids', () => {
  const world = createWorld(now);
  ensurePlayer(world, alice, now);
  ensurePlayer(world, bob, now);
  world.orders = [
    {
      id: 'alice-sell', assetKind: 'commodity', assetId: 'wheat', productId: 'wheat',
      side: 'sell', ownerType: 'player', ownerId: alice.id, ownerName: 'Alice',
      price: 4, quantity: 10, remaining: 5, status: 'partial', createdAt: now,
      fills: [{
        id: 'fill-secret', quantity: 5, price: 4, total: 20, createdAt: now,
        counterparty: '饮食需求', makerOrderId: 'alice-sell', takerOrderId: 'population-secret', liquidity: 'maker',
      }],
    },
    {
      id: 'population-secret', assetKind: 'commodity', assetId: 'wheat', productId: 'wheat',
      side: 'buy', ownerType: 'population', ownerName: '饮食需求', demandGroupId: 'food', demandTier: 'raw', demandCycleId: 99,
      price: 3, quantity: 20, remaining: 20, status: 'open', createdAt: now,
      fills: [{ id: 'hidden-fill', quantity: 1, price: 3, total: 3, createdAt: now }],
    },
  ];

  const state = createFacilityGroupClientState(world, alice.id, now);
  assert.equal(state.version, 15);
  const own = state.orders.find((order) => order.id === 'alice-sell');
  const external = state.orders.find((order) => order.id === 'population-secret');

  assert.equal(own.isOwn, true);
  assert.deepEqual(own.fills, [{ id: 'fill-secret', quantity: 5, price: 4, total: 20, createdAt: now }]);
  assert.equal(external.isOwn, false);
  assert.equal('fills' in external, false);

  for (const order of state.orders) {
    for (const field of ['ownerType', 'ownerId', 'ownerName', 'demandGroupId', 'demandTier', 'demandCycleId']) {
      assert.equal(field in order, false, field + ' must not be public');
    }
  }
  const serialized = JSON.stringify(state.orders);
  for (const secret of ['饮食需求', 'counterparty', 'makerOrderId', 'takerOrderId', 'liquidity']) {
    assert.equal(serialized.includes(secret), false, secret + ' leaked');
  }
});
