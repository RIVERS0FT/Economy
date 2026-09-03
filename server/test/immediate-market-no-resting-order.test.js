import assert from 'node:assert/strict';
import test from 'node:test';
import { applyAction, createWorld, ensurePlayer } from '../src/domain.js';
import { DEFAULT_PROVINCE_ID, provinceScopedKey } from '../src/provinces.js';

const NOW = Date.UTC(2026, 8, 3, 13, 0, 0, 0);
const BUYER = { id: 201, email: 'buyer-no-resting@example.com', name: '即时买家' };
const SELLER = { id: 202, email: 'seller-no-resting@example.com', name: '即时卖家' };

function openPlayerCommodityOrders(world) {
  return (world.orders || []).filter((order) => (
    order.ownerType === 'player'
    && order.assetKind === 'commodity'
    && ['open', 'partial'].includes(order.status)
  ));
}

test('manual commodity buys and sells never leave player resting orders or frozen assets', () => {
  const world = createWorld(NOW);
  const buyer = ensurePlayer(world, BUYER, NOW);
  const seller = ensurePlayer(world, SELLER, NOW);
  buyer.credits = 1_000;
  seller.inventories.wheat.available = 5;
  const market = world.markets[provinceScopedKey(DEFAULT_PROVINCE_ID, 'wheat')];
  market.officialPrice = 0.8;

  const buy = applyAction(world, BUYER, 'placeOrder', {
    provinceId: DEFAULT_PROVINCE_ID,
    productId: 'wheat',
    side: 'buy',
    quantity: 2,
    price: 0.01,
  }, NOW + 1);
  const sell = applyAction(world, SELLER, 'placeOrder', {
    provinceId: DEFAULT_PROVINCE_ID,
    productId: 'wheat',
    side: 'sell',
    quantity: 3,
    price: 999,
  }, NOW + 2);

  assert.equal(buy.ok, true);
  assert.equal(sell.ok, true);
  assert.equal(buy.quantity, 2);
  assert.equal(sell.quantity, 3);
  assert.equal(buy.executedPrice, 0.8);
  assert.equal(sell.executedPrice, 0.8);
  assert.equal(buy.total, 1.6);
  assert.equal(sell.total, 2.4);
  assert.equal(sell.fee, 0.024);
  assert.equal(sell.netTotal, 2.376);
  assert.equal(buyer.credits, 998.4);
  assert.equal(seller.credits, 2.376);
  assert.equal(buyer.inventories.wheat.available, 2);
  assert.equal(seller.inventories.wheat.available, 2);
  assert.equal(buyer.frozenCredits, 0);
  assert.equal(seller.inventories.wheat.frozen, 0);
  assert.equal(market.todayBuyQuantity, 2);
  assert.equal(market.todaySellQuantity, 3);
  const audit = world.systemMarketAudit.products[provinceScopedKey(DEFAULT_PROVINCE_ID, 'wheat')];
  assert.equal(audit.fillCount, 2);
  assert.equal(audit.soldQuantity, 2);
  assert.equal(audit.boughtQuantity, 3);
  assert.equal(openPlayerCommodityOrders(world).length, 0);
  const completed = world.orders.filter((order) => order.ownerType === 'player' && order.assetKind === 'commodity');
  assert.equal(completed.length, 2);
  assert.ok(completed.every((order) => order.status === 'filled' && order.remaining === 0));
  assert.ok(completed.every((order) => order.price === market.officialPrice));
  assert.ok(completed.every((order) => order.fills.length === 1 && order.fills[0].price === market.officialPrice));
  assert.deepEqual(completed.map((order) => order.fills[0].total).sort((left, right) => left - right), [1.6, 2.4]);
});
