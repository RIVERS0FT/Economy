import assert from 'node:assert/strict';
import test from 'node:test';
import { matchIncomingOrder } from '../src/order-matching.js';
import {
  closeOrderInOrderBook,
  getOrderBookDepth,
  getOrderBookRuntimeDiagnostics,
  getOrderBookSide,
  resetOrderBookRuntimeDiagnostics,
} from '../src/order-book-runtime.js';

function order({ id, side, price, createdAt, ownerId, quantity = 1, assetId = 'wheat' }) {
  return {
    id,
    assetKind: 'commodity',
    assetId,
    productId: assetId,
    side,
    ownerType: 'player',
    ownerId,
    ownerName: `玩家 ${ownerId}`,
    price,
    quantity,
    remaining: quantity,
    status: 'open',
    createdAt,
    fills: [],
  };
}

test('price-level runtime aggregates 50000 open orders without changing price-time priority', () => {
  const orders = [];
  for (let index = 0; index < 50_000; index += 1) {
    orders.push(order({
      id: `sell-${index}`,
      side: 'sell',
      price: 10 + (index % 100) / 100,
      createdAt: 1_000 + index,
      ownerId: index + 1,
      quantity: 1 + (index % 3),
    }));
  }
  const world = { orders };
  resetOrderBookRuntimeDiagnostics(world);
  const depth = getOrderBookDepth(world, {
    assetKind: 'commodity', assetId: 'wheat', side: 'sell', limit: 5,
  });
  assert.equal(depth.length, 5);
  assert.deepEqual(depth.map((level) => level.price), [10, 10.01, 10.02, 10.03, 10.04]);
  assert.equal(depth[0].orderCount, 500);
  const bestOrders = getOrderBookSide(world, {
    assetKind: 'commodity', assetId: 'wheat', side: 'sell',
  }).slice(0, 3);
  assert.deepEqual(bestOrders.map((entry) => entry.id), ['sell-0', 'sell-100', 'sell-200']);
  assert.equal(getOrderBookRuntimeDiagnostics(world).builds, 1);
});

test('explicit close removes an order from its level immediately', () => {
  const first = order({ id: 'sell-a', side: 'sell', price: 10, createdAt: 1, ownerId: 1, quantity: 4 });
  const second = order({ id: 'sell-b', side: 'sell', price: 10, createdAt: 2, ownerId: 2, quantity: 6 });
  const world = { orders: [first, second] };
  assert.deepEqual(getOrderBookDepth(world, {
    assetKind: 'commodity', assetId: 'wheat', side: 'sell', limit: 1,
  }), [{ price: 10, quantity: 10, orderCount: 2 }]);
  first.status = 'cancelled';
  closeOrderInOrderBook(world, first);
  assert.deepEqual(getOrderBookDepth(world, {
    assetKind: 'commodity', assetId: 'wheat', side: 'sell', limit: 1,
  }), [{ price: 10, quantity: 6, orderCount: 1 }]);
});

test('matching visits only crossing price-level nodes instead of materializing the full side', () => {
  const world = { orders: [] };
  for (let index = 0; index < 20_000; index += 1) {
    world.orders.push(order({
      id: `resting-${index}`,
      side: 'sell',
      price: index === 0 ? 10 : 20 + (index % 50),
      createdAt: index,
      ownerId: index + 1,
    }));
  }
  resetOrderBookRuntimeDiagnostics(world);
  const incoming = order({
    id: 'incoming-buy',
    side: 'buy',
    price: 10,
    createdAt: 30_000,
    ownerId: 99_999,
  });
  world.orders.push(incoming);
  matchIncomingOrder({ world, incoming, createdAt: 30_001, settleTrade: () => {} });
  assert.equal(incoming.status, 'filled');
  const diagnostics = getOrderBookRuntimeDiagnostics(world);
  assert.equal(diagnostics.builds, 1);
  assert.ok(diagnostics.ordersVisited <= 1, `撮合访问了过多订单: ${diagnostics.ordersVisited}`);
});
