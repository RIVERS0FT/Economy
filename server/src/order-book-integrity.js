import { isOpenOrder, orderAssetId, orderKind } from './order-identity.js';

export const SELF_CROSS_MESSAGE = '该价格会与自己的反向订单交叉，请先撤销原订单';

export function pricesCross(side, price, oppositePrice) {
  const incoming = Number(price);
  const resting = Number(oppositePrice);
  if (!Number.isFinite(incoming) || !Number.isFinite(resting)) return false;
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

  return (world.orders || []).find((order) => (
    order.ownerType === 'player'
    && Number(order.ownerId) === normalizedOwnerId
    && orderKind(order) === normalizedKind
    && orderAssetId(order) === normalizedAssetId
    && order.side !== side
    && isOpenOrder(order)
    && pricesCross(side, price, order.price)
  )) || null;
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
  const prices = (world.orders || [])
    .filter((order) => (
      order.ownerType === 'population'
      && order.productId === productId
      && order.side === side
      && isOpenOrder(order)
    ))
    .map((order) => Number(order.price))
    .filter((price) => Number.isFinite(price) && price > 0);
  if (prices.length === 0) return null;
  return side === 'buy' ? Math.max(...prices) : Math.min(...prices);
}

export function systemBookIsCrossed(world, productId) {
  const bid = bestSystemPrice(world, productId, 'buy');
  const ask = bestSystemPrice(world, productId, 'sell');
  return bid !== null && ask !== null && bid >= ask;
}
