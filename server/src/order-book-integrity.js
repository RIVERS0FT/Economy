import { isOpenOrder } from './order-identity.js';
import { playerMoneyToCents } from './money.js';
import {
  bestSystemOrder,
  getOwnerOrderBookSide,
  recordOrderBookVisit,
} from './order-book-runtime.js';

export const SELF_CROSS_MESSAGE = '该价格会与自己的反向订单交叉，请先撤销原订单';

export function pricesCross(side, price, oppositePrice) {
  const incoming = playerMoneyToCents(price);
  const resting = playerMoneyToCents(oppositePrice);
  if (incoming === null || resting === null) return false;
  return side === 'buy' ? incoming >= resting : side === 'sell' ? incoming <= resting : false;
}

export function findSelfCrossingOrder(world, {
  ownerId,
  assetKind,
  assetId,
  side,
  price,
}) {
  const normalizedOwnerId = Number(ownerId);
  const normalizedKind = assetKind === 'facility' ? 'facility' : 'commodity';
  const normalizedAssetId = String(assetId || '');
  if (!Number.isFinite(normalizedOwnerId) || !normalizedAssetId || (side !== 'buy' && side !== 'sell')) return null;

  const oppositeSide = side === 'buy' ? 'sell' : 'buy';
  const orders = getOwnerOrderBookSide(world, normalizedOwnerId, {
    assetKind: normalizedKind,
    assetId: normalizedAssetId,
    side: oppositeSide,
  });
  let visited = 0;
  for (const order of orders) {
    visited += 1;
    if (!isOpenOrder(order)) continue;
    if (!pricesCross(side, price, order.price)) break;
    recordOrderBookVisit(world, visited);
    return order;
  }
  recordOrderBookVisit(world, visited);
  return null;
}

export function findSelfCrossingOrderForPayload(world, ownerId, payload = {}) {
  const assetKind = payload.assetKind === 'facility' ? 'facility' : 'commodity';
  const assetId = assetKind === 'facility'
    ? String(payload.assetId || payload.facilityTypeId || '')
    : String(payload.assetId || payload.productId || 'wheat');
  return findSelfCrossingOrder(world, {
    ownerId,
    assetKind,
    assetId,
    side: payload.side,
    price: payload.price ?? payload.unitPrice,
  });
}

export function bestSystemPrice(world, productId, side) {
  const order = bestSystemOrder(world, 'commodity', productId, side);
  const price = Number(order?.price);
  return Number.isFinite(price) && price > 0 ? price : null;
}

export function systemBookIsCrossed(world, productId) {
  const bid = bestSystemPrice(world, productId, 'buy');
  const ask = bestSystemPrice(world, productId, 'sell');
  return bid !== null && ask !== null && bid >= ask;
}
