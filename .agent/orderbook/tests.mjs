import { appendOnce, replaceExact } from './helpers.mjs';
import { writeFileSync } from 'node:fs';

replaceExact(
  'server/test/order-book-runtime.test.js',
  "  countOpenOrdersForOwner,\n  facilitySellQuantityForOwner,\n  getOrderBookRuntimeDiagnostics,\n  getOrderBookSide,\n  pendingCommodityBuyQuantityForOwner,\n  resetOrderBookRuntimeDiagnostics,",
  "  closeOrderInOrderBook,\n  countOpenOrdersForOwner,\n  facilitySellQuantityForOwner,\n  getOrderBookRuntimeDiagnostics,\n  getOrderBookSide,\n  orderById,\n  pendingCommodityBuyQuantityForOwner,\n  resetOrderBookRuntimeDiagnostics,",
);

appendOnce('server/test/order-book-runtime.test.js', 'runtime index excludes closed history from active books', `

test('runtime index excludes closed history from active books', () => {
  const world = { orders: [] };
  for (let index = 0; index < 3_999; index += 1) {
    world.orders.push(order({
      id: \`closed-\${index}\`,
      side: index % 2 === 0 ? 'buy' : 'sell',
      ownerId: index + 1,
      price: 10,
      createdAt: index,
      status: 'filled',
    }));
  }
  world.orders.push(order({ id: 'open-sell', side: 'sell', ownerId: 9_999, price: 11, createdAt: 4_000 }));
  resetOrderBookRuntimeDiagnostics(world);
  assert.deepEqual(
    getOrderBookSide(world, { assetKind: 'commodity', assetId: 'wheat', side: 'sell' }).map((entry) => entry.id),
    ['open-sell'],
  );
  assert.equal(getOrderBookRuntimeDiagnostics(world).builds, 1);
});

test('runtime owner aggregates follow fills and explicit cancellation', () => {
  const buy = order({ id: 'buy-aggregate', side: 'buy', ownerId: 7, price: 10, quantity: 5, createdAt: 1 });
  const world = { orders: [buy] };
  resetOrderBookRuntimeDiagnostics(world);
  assert.equal(countOpenOrdersForOwner(world, 7), 1);
  assert.equal(pendingCommodityBuyQuantityForOwner(world, 7), 5);

  const sell = order({ id: 'sell-aggregate', side: 'sell', ownerId: 8, price: 10, quantity: 2, createdAt: 2 });
  world.orders.push(sell);
  matchIncomingOrder({ world, incoming: sell, createdAt: 3, settleTrade: () => {} });
  assert.equal(buy.remaining, 3);
  assert.equal(pendingCommodityBuyQuantityForOwner(world, 7), 3);
  assert.equal(countOpenOrdersForOwner(world, 8), 0);

  buy.status = 'cancelled';
  closeOrderInOrderBook(world, buy);
  assert.equal(countOpenOrdersForOwner(world, 7), 0);
  assert.equal(pendingCommodityBuyQuantityForOwner(world, 7), 0);
  assert.equal(orderById(world, buy.id), buy);
});
`);

writeFileSync('server/test/order-book-pruning.test.js', `import assert from 'node:assert/strict';
import test from 'node:test';
import { createWorld, processWorld } from '../src/domain-core.js';
import { removeSystemFacilityOrders } from '../src/facility-groups.js';

function order({ id, status = 'open', createdAt = 0, assetKind = 'commodity', ownerType = 'player' }) {
  const open = status === 'open' || status === 'partial';
  return {
    id,
    assetKind,
    assetId: assetKind === 'facility' ? 'farm' : 'wheat',
    ...(assetKind === 'facility' ? { facilityTypeId: 'farm' } : { productId: 'wheat' }),
    side: 'buy',
    ownerType,
    ownerId: ownerType === 'player' ? 1 : undefined,
    ownerName: ownerType === 'market' ? '系统资产市场' : '玩家 1',
    price: 10,
    quantity: 1,
    remaining: open ? 1 : 0,
    status,
    createdAt,
  };
}

test('world pruning keeps the order array reference when no history is removed', () => {
  const now = 1_700_000_000_000;
  const world = createWorld(now);
  world.orders = [
    order({ id: 'open', createdAt: now - 1_000 }),
    order({ id: 'recent-closed', status: 'filled', createdAt: now - 2_000 }),
  ];
  const reference = world.orders;
  processWorld(world, now);
  assert.equal(world.orders, reference);
});

test('world pruning never removes open orders and only keeps 800 recent closed orders', () => {
  const now = 1_700_000_000_000;
  const world = createWorld(now);
  const openOrders = Array.from({ length: 4_100 }, (_, index) => (
    order({ id: \`open-\${index}\`, createdAt: now - index })
  ));
  const recentClosed = Array.from({ length: 901 }, (_, index) => (
    order({ id: \`closed-\${index}\`, status: 'filled', createdAt: now - index })
  ));
  world.orders = [
    order({ id: 'expired', status: 'cancelled', createdAt: now - 25 * 60 * 60 * 1_000 }),
    ...openOrders,
    ...recentClosed,
  ];

  processWorld(world, now);
  const retainedOpenIds = new Set(world.orders.filter((entry) => entry.remaining > 0).map((entry) => entry.id));
  assert.equal(retainedOpenIds.size, openOrders.length);
  for (const entry of openOrders) assert.equal(retainedOpenIds.has(entry.id), true);
  assert.equal(world.orders.filter((entry) => entry.remaining === 0).length, 800);
  assert.equal(world.orders.some((entry) => entry.id === 'expired'), false);
});

test('legacy system facility cleanup preserves the array when there is nothing to remove', () => {
  const world = { orders: [order({ id: 'commodity' })] };
  const reference = world.orders;
  removeSystemFacilityOrders(world);
  assert.equal(world.orders, reference);

  world.orders.push(order({ id: 'legacy-facility', assetKind: 'facility', ownerType: 'market' }));
  removeSystemFacilityOrders(world);
  assert.notEqual(world.orders, reference);
  assert.deepEqual(world.orders.map((entry) => entry.id), ['commodity']);
});
`);
