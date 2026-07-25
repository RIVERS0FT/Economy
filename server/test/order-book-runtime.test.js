import assert from 'node:assert/strict';
import test from 'node:test';
import { compareRestingOrders, matchIncomingOrder } from '../src/order-matching.js';
import { isOpenOrder } from '../src/order-identity.js';
import {
  countOpenOrdersForOwner,
  facilitySellQuantityForOwner,
  getOrderBookRuntimeDiagnostics,
  getOrderBookSide,
  pendingCommodityBuyQuantityForOwner,
  resetOrderBookRuntimeDiagnostics,
} from '../src/order-book-runtime.js';

function order({
  id,
  assetKind = 'commodity',
  assetId = 'wheat',
  side,
  ownerId = 1,
  ownerType = 'player',
  price,
  quantity = 1,
  createdAt,
  status = 'open',
}) {
  return {
    id,
    assetKind,
    assetId,
    ...(assetKind === 'facility' ? { facilityTypeId: assetId } : { productId: assetId }),
    side,
    ownerType,
    ownerId,
    ownerName: ownerType === 'population' ? '市场系统' : `玩家 ${ownerId}`,
    price,
    quantity,
    remaining: status === 'filled' ? 0 : quantity,
    status,
    createdAt,
    fills: [],
  };
}

test('runtime order book preserves price-time-array priority for 4000 orders', () => {
  const orders = [];
  for (let index = 0; index < 4_000; index += 1) {
    orders.push(order({
      id: `order-${index}`,
      assetId: index % 3 === 0 ? 'rice' : 'wheat',
      side: index % 2 === 0 ? 'sell' : 'buy',
      ownerId: index % 25 + 1,
      price: 5 + index % 17,
      createdAt: 100 + index % 7,
      status: index % 19 === 0 ? 'filled' : 'open',
    }));
  }
  const world = { orders };
  resetOrderBookRuntimeDiagnostics(world);
  const actual = getOrderBookSide(world, {
    assetKind: 'commodity', assetId: 'wheat', side: 'sell',
  }).filter(isOpenOrder).map((entry) => entry.id);
  const sequence = new Map(orders.map((entry, index) => [entry.id, index]));
  const expected = orders
    .filter((entry) => entry.assetId === 'wheat' && entry.side === 'sell' && entry.status !== 'filled')
    .sort((left, right) => compareRestingOrders('buy', left, right)
      || sequence.get(left.id) - sequence.get(right.id))
    .map((entry) => entry.id);
  assert.deepEqual(actual, expected);
  assert.equal(getOrderBookRuntimeDiagnostics(world).builds, 1);
});

test('runtime order book tracks tail appends and rebuilds after array replacement', () => {
  const world = {
    orders: [
      order({ id: 'sell-10', side: 'sell', price: 10, createdAt: 1 }),
      order({ id: 'buy-8', side: 'buy', price: 8, createdAt: 2 }),
    ],
  };
  resetOrderBookRuntimeDiagnostics(world);
  getOrderBookSide(world, { assetKind: 'commodity', assetId: 'wheat', side: 'sell' });
  world.orders.push(order({ id: 'sell-9', side: 'sell', price: 9, createdAt: 3 }));
  const afterAppend = getOrderBookSide(world, {
    assetKind: 'commodity', assetId: 'wheat', side: 'sell',
  });
  assert.deepEqual(afterAppend.map((entry) => entry.id), ['sell-9', 'sell-10']);
  assert.deepEqual(getOrderBookRuntimeDiagnostics(world), {
    builds: 1,
    tailAppends: 1,
    sideQueries: 2,
    ordersVisited: 0,
  });

  world.orders = [...world.orders];
  getOrderBookSide(world, { assetKind: 'commodity', assetId: 'wheat', side: 'sell' });
  assert.equal(getOrderBookRuntimeDiagnostics(world).builds, 2);
});

test('runtime owner summaries share the indexed orders', () => {
  const world = {
    orders: [
      order({ id: 'commodity-buy', side: 'buy', ownerId: 7, price: 10, quantity: 8, createdAt: 1 }),
      order({ id: 'commodity-sell', side: 'sell', ownerId: 7, price: 11, quantity: 2, createdAt: 2 }),
      order({ id: 'facility-sell', assetKind: 'facility', assetId: 'farm', side: 'sell', ownerId: 7, price: 100, quantity: 3, createdAt: 3 }),
      order({ id: 'closed', side: 'buy', ownerId: 7, price: 5, quantity: 9, createdAt: 4, status: 'filled' }),
    ],
  };
  assert.equal(countOpenOrdersForOwner(world, 7), 3);
  assert.equal(pendingCommodityBuyQuantityForOwner(world, 7), 8);
  assert.equal(facilitySellQuantityForOwner(world, 7, 'farm'), 3);
});

test('repeated matching reuses one runtime index', () => {
  const world = { orders: [] };
  for (let index = 0; index < 500; index += 1) {
    world.orders.push(order({
      id: `sell-${index}`,
      side: 'sell',
      ownerId: index + 1,
      price: 10,
      createdAt: index,
    }));
  }
  for (let index = 0; index < 3_500; index += 1) {
    world.orders.push(order({
      id: `unrelated-${index}`,
      assetId: 'rice',
      side: index % 2 ? 'buy' : 'sell',
      ownerId: 10_000 + index,
      price: 20,
      createdAt: index,
    }));
  }
  resetOrderBookRuntimeDiagnostics(world);
  for (let index = 0; index < 50; index += 1) {
    const incoming = order({
      id: `buy-${index}`,
      side: 'buy',
      ownerId: 20_000 + index,
      price: 10,
      createdAt: 10_000 + index,
    });
    world.orders.push(incoming);
    matchIncomingOrder({ world, incoming, createdAt: 20_000 + index, settleTrade: () => {} });
    assert.equal(incoming.status, 'filled');
  }
  const diagnostics = getOrderBookRuntimeDiagnostics(world);
  assert.equal(diagnostics.builds, 1);
  assert.equal(diagnostics.tailAppends, 49);
  assert.ok(diagnostics.ordersVisited <= 100, `访问订单数过高: ${diagnostics.ordersVisited}`);
});
