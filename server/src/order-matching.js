import { randomUUID } from 'node:crypto';
import { applyMarketSellFee } from './market-sell-fee.js';
import { isOpenOrder, orderAssetId, orderKind } from './order-identity.js';

const MAX_PLAYER_FILLS = 120;

function samePlayer(left, right) {
  return left?.ownerType === 'player'
    && right?.ownerType === 'player'
    && Number(left.ownerId) === Number(right.ownerId);
}

export function orderPricesCross(incomingSide, incomingPrice, restingPrice) {
  const incoming = Number(incomingPrice);
  const resting = Number(restingPrice);
  if (!Number.isFinite(incoming) || !Number.isFinite(resting)) return false;
  return incomingSide === 'buy' ? incoming >= resting : incomingSide === 'sell' ? incoming <= resting : false;
}

export function compareRestingOrders(incomingSide, left, right) {
  const leftPrice = Number(left.price);
  const rightPrice = Number(right.price);
  if (leftPrice !== rightPrice) return incomingSide === 'buy' ? leftPrice - rightPrice : rightPrice - leftPrice;
  return Number(left.createdAt || 0) - Number(right.createdAt || 0);
}

function defaultCounterparty(order) {
  return order?.ownerName || (order?.ownerType === 'population' ? '市场系统' : '玩家');
}

function appendPlayerFill(order, fill) {
  if (order.ownerType !== 'player') return;
  order.fills = Array.isArray(order.fills) ? order.fills : [];
  order.fills.push(fill);
  order.fills = order.fills.slice(-MAX_PLAYER_FILLS);
}

function advanceOrder(order, quantity, createdAt) {
  order.remaining = Number(order.remaining) - quantity;
  order.status = order.remaining === 0 ? 'filled' : 'partial';
  order.lastFilledAt = createdAt;
}

export function matchIncomingOrder({
  world,
  incoming,
  createdAt,
  canMatch = () => true,
  describeCounterparty = defaultCounterparty,
  settleTrade,
  recordTrade = () => {},
  createFillId = () => `order-fill-${randomUUID()}`,
}) {
  if (!world || !incoming || typeof settleTrade !== 'function') {
    throw new TypeError('matchIncomingOrder requires world, incoming, and settleTrade');
  }
  if (!isOpenOrder(incoming)) return { fillCount: 0, filledQuantity: 0 };

  const incomingKind = orderKind(incoming);
  const incomingAssetId = orderAssetId(incoming);
  const oppositeSide = incoming.side === 'buy' ? 'sell' : incoming.side === 'sell' ? 'buy' : null;
  if (!oppositeSide || !incomingAssetId) return { fillCount: 0, filledQuantity: 0 };

  const candidates = (world.orders || [])
    .filter((resting) => (
      resting.id !== incoming.id
      && orderKind(resting) === incomingKind
      && orderAssetId(resting) === incomingAssetId
      && resting.side === oppositeSide
      && isOpenOrder(resting)
      && !samePlayer(incoming, resting)
      && orderPricesCross(incoming.side, incoming.price, resting.price)
      && canMatch({ world, incoming, resting })
    ))
    .sort((left, right) => compareRestingOrders(incoming.side, left, right));

  let fillCount = 0;
  let filledQuantity = 0;
  for (const resting of candidates) {
    if (!isOpenOrder(incoming)) break;
    if (!isOpenOrder(resting)) continue;

    const quantity = Math.min(Number(incoming.remaining), Number(resting.remaining));
    if (!Number.isFinite(quantity) || quantity <= 0) continue;
    const price = Number(resting.price);
    const buy = incoming.side === 'buy' ? incoming : resting;
    const sell = incoming.side === 'sell' ? incoming : resting;
    const fillBase = {
      id: createFillId(),
      quantity,
      price,
      total: quantity * price,
      createdAt,
      makerOrderId: resting.id,
      takerOrderId: incoming.id,
    };
    const sellerSettlement = sell.ownerType === 'player'
      ? applyMarketSellFee(sell, fillBase.total)
      : { fee: 0, netTotal: fillBase.total };

    advanceOrder(incoming, quantity, createdAt);
    advanceOrder(resting, quantity, createdAt);
    appendPlayerFill(buy, {
      ...fillBase,
      fee: 0,
      netTotal: fillBase.total,
      counterparty: describeCounterparty(sell),
      liquidity: buy.id === resting.id ? 'maker' : 'taker',
    });
    appendPlayerFill(sell, {
      ...fillBase,
      ...sellerSettlement,
      counterparty: describeCounterparty(buy),
      liquidity: sell.id === resting.id ? 'maker' : 'taker',
    });

    settleTrade({
      world,
      incoming,
      resting,
      buy,
      sell,
      quantity,
      price,
      fill: fillBase,
      sellerSettlement,
      createdAt,
    });
    recordTrade({
      world,
      incoming,
      resting,
      buy,
      sell,
      quantity,
      price,
      fill: fillBase,
      takerSide: incoming.side,
      createdAt,
    });
    fillCount += 1;
    filledQuantity += quantity;
  }

  return { fillCount, filledQuantity };
}
