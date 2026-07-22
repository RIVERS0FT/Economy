import assert from 'node:assert/strict';
import test from 'node:test';
import { matchIncomingOrder } from '../src/order-matching.js';

function order({
  id,
  assetKind = 'commodity',
  assetId = 'wheat',
  side,
  ownerId,
  ownerType = 'player',
  price,
  quantity,
  createdAt,
}) {
  return {
    id,
    assetKind,
    assetId,
    ...(assetKind === 'facility' ? { facilityTypeId: assetId } : { productId: assetId }),
    side,
    ownerType,
    ownerId,
    ownerName: ownerType === 'population' ? '市场系统' : `玩家${ownerId}`,
    price,
    quantity,
    remaining: quantity,
    status: 'open',
    createdAt,
    fills: [],
  };
}

for (const assetKind of ['commodity', 'facility']) {
  test(`shared matcher preserves price-time priority, maker price, and partial fills for ${assetKind}`, () => {
    const assetId = assetKind === 'facility' ? 'farm' : 'wheat';
    const priceTenOlder = order({ id: `${assetKind}-sell-10-old`, assetKind, assetId, side: 'sell', ownerId: 1, price: 10, quantity: 1, createdAt: 2 });
    const priceTenNewer = order({ id: `${assetKind}-sell-10-new`, assetKind, assetId, side: 'sell', ownerId: 2, price: 10, quantity: 1, createdAt: 3 });
    const priceElevenEarlier = order({ id: `${assetKind}-sell-11`, assetKind, assetId, side: 'sell', ownerId: 3, price: 11, quantity: 2, createdAt: 1 });
    const incoming = order({ id: `${assetKind}-buy`, assetKind, assetId, side: 'buy', ownerId: 9, price: 12, quantity: 3, createdAt: 4 });
    const world = { orders: [priceElevenEarlier, priceTenNewer, priceTenOlder, incoming] };
    const settlements = [];

    const result = matchIncomingOrder({
      world,
      incoming,
      createdAt: 5,
      createFillId: (() => {
        let value = 0;
        return () => `fill-${++value}`;
      })(),
      settleTrade: ({ resting, quantity, price }) => settlements.push({ resting: resting.id, quantity, price }),
    });

    assert.deepEqual(result, { fillCount: 3, filledQuantity: 3 });
    assert.deepEqual(settlements, [
      { resting: priceTenOlder.id, quantity: 1, price: 10 },
      { resting: priceTenNewer.id, quantity: 1, price: 10 },
      { resting: priceElevenEarlier.id, quantity: 1, price: 11 },
    ]);
    assert.equal(incoming.status, 'filled');
    assert.equal(priceElevenEarlier.status, 'partial');
    assert.equal(priceElevenEarlier.remaining, 1);
    assert.deepEqual(incoming.fills.map((fill) => fill.price), [10, 10, 11]);
    assert.deepEqual(incoming.fills.map((fill) => fill.makerOrderId), [priceTenOlder.id, priceTenNewer.id, priceElevenEarlier.id]);
    assert.ok(incoming.fills.every((fill) => fill.takerOrderId === incoming.id && fill.liquidity === 'taker'));
    assert.equal(priceTenOlder.fills[0].liquidity, 'maker');
    assert.equal(priceTenOlder.fills[0].fee, 0);
    assert.equal(priceTenOlder.lastFilledAt, 5);
  });
}

test('shared matcher skips a same-player crossing order and continues to an eligible counterparty', () => {
  const ownSell = order({ id: 'own-sell', side: 'sell', ownerId: 1, price: 5, quantity: 1, createdAt: 1 });
  const otherSell = order({ id: 'other-sell', side: 'sell', ownerId: 2, price: 6, quantity: 1, createdAt: 2 });
  const incoming = order({ id: 'incoming-buy', side: 'buy', ownerId: 1, price: 6, quantity: 1, createdAt: 3 });
  const world = { orders: [ownSell, otherSell, incoming] };

  matchIncomingOrder({ world, incoming, createdAt: 4, settleTrade: () => {} });

  assert.equal(ownSell.status, 'open');
  assert.equal(ownSell.remaining, 1);
  assert.equal(otherSell.status, 'filled');
  assert.equal(incoming.fills[0].price, 6);
});

test('asset adapter can exclude otherwise crossing system orders without duplicating the matching loop', () => {
  const systemSell = order({ id: 'system-sell', side: 'sell', ownerType: 'population', price: 5, quantity: 1, createdAt: 1 });
  const playerSell = order({ id: 'player-sell', side: 'sell', ownerId: 2, price: 6, quantity: 1, createdAt: 2 });
  const incoming = order({ id: 'system-buy', side: 'buy', ownerType: 'population', price: 6, quantity: 1, createdAt: 3 });
  const world = { orders: [systemSell, playerSell, incoming] };

  matchIncomingOrder({
    world,
    incoming,
    createdAt: 4,
    canMatch: ({ incoming: taker, resting }) => !(taker.ownerType === 'population' && resting.ownerType === 'population'),
    settleTrade: () => {},
  });

  assert.equal(systemSell.status, 'open');
  assert.equal(playerSell.status, 'filled');
  assert.equal(incoming.status, 'filled');
  assert.deepEqual(incoming.fills, []);
});
