import assert from 'node:assert/strict';
import test from 'node:test';
import { createWorld, ensurePlayer } from '../src/domain.js';
import {
  CLIENT_RECENT_CLOSED_ORDER_LIMIT,
  createFacilityGroupClientState,
  createOrderHistoryPage,
} from '../src/facility-groups.js';

const alice = { id: 1, email: 'alice@example.com', name: 'Alice', role: 'user' };
const bob = { id: 2, email: 'bob@example.com', name: 'Bob', role: 'user' };

function order({ id, ownerId, status = 'filled', createdAt, fillAt = createdAt + 1 }) {
  return {
    id,
    assetKind: 'commodity',
    assetId: 'wheat',
    productId: 'wheat',
    side: 'buy',
    ownerType: 'player',
    ownerId,
    ownerName: ownerId === 1 ? 'Alice' : 'Bob',
    price: 10,
    quantity: 1,
    remaining: status === 'open' ? 1 : 0,
    status,
    createdAt,
    fills: status === 'open' ? [] : [{
      id: `fill-${id}`,
      quantity: 1,
      price: 10,
      total: 10,
      fee: 0,
      netTotal: 10,
      createdAt: fillAt,
      counterpartyId: 999,
      makerOrderId: 'private-maker',
    }],
  };
}

function populatedWorld(now = 1_700_000_000_000) {
  const world = createWorld(now);
  ensurePlayer(world, alice, now);
  ensurePlayer(world, bob, now);
  world.orders = [];
  for (let index = 0; index < CLIENT_RECENT_CLOSED_ORDER_LIMIT + 8; index += 1) {
    world.orders.push(order({ id: `alice-closed-${index}`, ownerId: 1, createdAt: now + index * 10 }));
  }
  for (let index = 0; index < 5; index += 1) {
    world.orders.push(order({ id: `bob-closed-${index}`, ownerId: 2, createdAt: now + index * 10 }));
  }
  world.orders.push(order({ id: 'alice-open', ownerId: 1, status: 'open', createdAt: now + 10_000 }));
  world.orders.push(order({ id: 'bob-open', ownerId: 2, status: 'open', createdAt: now + 10_001 }));
  return world;
}

test('main state keeps only current player open orders and bounded recent closed orders', () => {
  const world = populatedWorld();
  const state = createFacilityGroupClientState(world, 1, 1_700_000_020_000);
  const closed = state.orders.filter((entry) => !['open', 'partial'].includes(entry.status));

  assert.equal(state.orders.filter((entry) => ['open', 'partial'].includes(entry.status)).length, 1);
  assert.equal(state.orders.some((entry) => entry.id === 'bob-open'), false);
  assert.equal(closed.length, CLIENT_RECENT_CLOSED_ORDER_LIMIT);
  assert.ok(closed.every((entry) => entry.isOwn));
  assert.equal(state.orders.some((entry) => entry.id === 'bob-closed-0'), false);
  assert.equal(state.orders.some((entry) => entry.id === 'alice-closed-0'), false);
  assert.equal(state.orders.some((entry) => entry.id === `alice-closed-${CLIENT_RECENT_CLOSED_ORDER_LIMIT + 7}`), true);
});

test('order history provides opaque cursor pagination with only the current player anonymous fills', () => {
  const world = populatedWorld();
  const first = createOrderHistoryPage(world, 1, { limit: 20 });
  assert.equal(first.total, CLIENT_RECENT_CLOSED_ORDER_LIMIT + 8);
  assert.equal(first.items.length, 20);
  assert.ok(first.nextCursor);
  assert.ok(first.items.every((entry) => entry.isOwn));
  assert.equal('ownerId' in first.items[0], false);
  assert.equal('ownerName' in first.items[0], false);
  assert.equal('counterpartyId' in first.items[0].fills[0], false);
  assert.equal('makerOrderId' in first.items[0].fills[0], false);

  const second = createOrderHistoryPage(world, 1, { limit: 20, cursor: first.nextCursor });
  assert.equal(second.items.length, 20);
  assert.equal(new Set([...first.items, ...second.items].map((entry) => entry.id)).size, 40);
  assert.equal(second.total, first.total);
});

test('order history rejects malformed cursors', () => {
  const world = populatedWorld();
  assert.throws(
    () => createOrderHistoryPage(world, 1, { cursor: 'not-a-valid-cursor' }),
    (error) => error?.statusCode === 400 && error?.message === '订单历史游标无效',
  );
});
