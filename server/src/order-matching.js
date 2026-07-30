import { randomUUID } from 'node:crypto';
import { applyMarketSellFee } from './market-sell-fee.js';
import { centsToPlayerMoney, multiplyMoneyByInteger, playerMoneyToCents } from './money.js';
import { isOpenOrder, orderAssetId, orderKind } from './order-identity.js';
import { getOrderBookSide, recordOrderBookVisit } from './order-book-runtime.js';

const MAX_PLAYER_FILLS = 120;

function samePlayer(left, right) {
  return left?.ownerType === 'player'
    && right?.ownerType === 'player'
    && Number(left.ownerId) === Number(right.ownerId);
}

export function orderPricesCross(incomingSide, incomingPrice, restingPrice) {
  const incoming = playerMoneyToCents(incomingPrice);
  const resting = playerMoneyToCents(restingPrice);
  if (incoming === null || resting === null) return false;
  return incomingSide === 'buy' ? incoming >= resting : incomingSide === 'sell' ? incoming <= resting : false;
}

export function compareRestingOrders(incomingSide, left, right) {
  const leftPrice = playerMoneyToCents(left.price) || 0n;
  const rightPrice = playerMoneyToCents(right.price) || 0n;
  if (leftPrice !== rightPrice) {
    if (incomingSide === 'buy') return leftPrice < rightPrice ? -1 : 1;
    return leftPrice > rightPrice ? -1 : 1;
  }
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

  const candidates = getOrderBookSide(world, {
  assetKind: incomingKind,
  assetId: incomingAssetId,
  side: oppositeSide,
});

let fillCount = 0;
let filledQuantity = 0;
let visited = 0;
for (const resting of candidates) {
  if (!isOpenOrder(incoming)) break;
  visited += 1;
  if (resting.id === incoming.id || !isOpenOrder(resting)) continue;
  if (!orderPricesCross(incoming.side, incoming.price, resting.price)) break;
  if (samePlayer(incoming, resting) || !canMatch({ world, incoming, resting })) continue;

    const quantity = Math.min(Number(incoming.remaining), Number(resting.remaining));
    if (!Number.isFinite(quantity) || quantity <= 0) continue;
    const price = centsToPlayerMoney(playerMoneyToCents(resting.price)) ?? 0;
    const total = multiplyMoneyByInteger(price, quantity);
    if (total === null) throw new RangeError('成交总额超出系统可表示范围');
    const buy = incoming.side === 'buy' ? incoming : resting;
    const sell = incoming.side === 'sell' ? incoming : resting;
    const fillBase = {
      id: createFillId(),
      quantity,
      price,
      total,
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

  recordOrderBookVisit(world, visited);
  return { fillCount, filledQuantity };
}
