import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

const priceSource = read('../src/utils/defaultOrderPrice.ts');
const priceFunctionMatch = priceSource.match(
  /export function isValidOrderPrice\(price: number\) \{[\s\S]*?\n\}/,
);
assert.ok(priceFunctionMatch, 'Missing shared two-decimal order-price validator.');
const executablePriceSource = priceFunctionMatch[0]
  .replace('export ', '')
  .replace('price: number', 'price');
const isValidOrderPrice = new Function(
  `${executablePriceSource}\nreturn isValidOrderPrice;`,
)();

const levelSource = read('../src/utils/orderBookLevels.ts');
const executableLevelSource = levelSource
  .replace(/^import .*;\n/gm, '')
  .replace(/export interface OrderBookLevel \{[\s\S]*?\n\}\n\n/, '')
  .replace('export function buildOrderBookLevels', 'function buildOrderBookLevels')
  .replace('orders: AssetOrder[]', 'orders')
  .replace('side: OrderSide', 'side')
  .replace('): OrderBookLevel[]', ')')
  .replace('new Map<number, OrderBookLevel>()', 'new Map()');
const buildOrderBookLevels = new Function(
  'isValidOrderPrice',
  `${executableLevelSource}\nreturn buildOrderBookLevels;`,
)(isValidOrderPrice);

const order = (id, side, price, remaining, status = 'open') => ({
  id,
  side,
  price,
  remaining,
  quantity: remaining,
  status,
});

assert.equal(isValidOrderPrice(0.01), true);
assert.equal(isValidOrderPrice(1.23), true);
assert.equal(isValidOrderPrice(2), true);
assert.equal(isValidOrderPrice(0), false);
assert.equal(isValidOrderPrice(1.234), false);
assert.equal(isValidOrderPrice(Number.POSITIVE_INFINITY), false);

const buyLevels = buildOrderBookLevels([
  order('buy-integer', 'buy', 2, 1),
  order('buy-decimal-a', 'buy', 1.23, 2),
  order('buy-decimal-b', 'buy', 1.23, 3, 'partial'),
  order('buy-minimum', 'buy', 0.01, 4),
  order('buy-invalid-precision', 'buy', 1.234, 100),
  order('buy-invalid-zero', 'buy', 0, 100),
  order('buy-closed', 'buy', 9.99, 100, 'filled'),
  order('buy-empty', 'buy', 8.88, 0),
], 'buy');

assert.deepEqual(
  buyLevels.map(({ price, remaining, orderCount }) => ({ price, remaining, orderCount })),
  [
    { price: 2, remaining: 1, orderCount: 1 },
    { price: 1.23, remaining: 5, orderCount: 2 },
    { price: 0.01, remaining: 4, orderCount: 1 },
  ],
);

const sellLevels = buildOrderBookLevels([
  order('sell-decimal-a', 'sell', 1.1, 2),
  order('sell-minimum', 'sell', 0.01, 1),
  order('sell-decimal-b', 'sell', 1.1, 4, 'partial'),
  order('sell-integer', 'sell', 2, 3),
], 'sell');

assert.deepEqual(
  sellLevels.map(({ price, remaining, orderCount }) => ({ price, remaining, orderCount })),
  [
    { price: 0.01, remaining: 1, orderCount: 1 },
    { price: 1.1, remaining: 6, orderCount: 2 },
    { price: 2, remaining: 3, orderCount: 1 },
  ],
);

assert.match(levelSource, /isValidOrderPrice\(order\.price\)/);
assert.doesNotMatch(levelSource, /Number\.isInteger\(order\.price\)|order\.price\s*<\s*1/);

const design = read('../docs/UNIFIED_ASSET_ORDER_BOOK_DESIGN.md');
assert.match(design, /价格为不低于 0\.01 的两位小数订单/);
assert.match(design, /同资产、同方向、同价格的有效订单按当前剩余数量聚合为价格档位/);
assert.match(design, /聚合完成后再按最优价格截取 5 档/);

console.log('Decimal order-book level verification passed.');
