import type { AssetKind, AssetOrder, OrderSide } from '../types';
import { orderAssetId, orderKind } from './orderIdentity';

function validOrderPrice(price: number) {
  return Number.isFinite(price) && Number.isInteger(price) && price >= 1;
}

export function defaultOrderPrice(
  orders: AssetOrder[],
  assetKind: AssetKind,
  assetId: string,
  side: OrderSide,
): number {
  let bestBid: number | undefined;
  let bestAsk: number | undefined;

  for (const order of orders) {
    if (!['open', 'partial'].includes(order.status) || order.remaining <= 0) continue;
    if (orderKind(order) !== assetKind || orderAssetId(order) !== assetId) continue;
    if (!validOrderPrice(order.price)) continue;

    if (order.side === 'buy') {
      bestBid = bestBid === undefined ? order.price : Math.max(bestBid, order.price);
    } else {
      bestAsk = bestAsk === undefined ? order.price : Math.min(bestAsk, order.price);
    }
  }

  return side === 'buy'
    ? bestAsk ?? bestBid ?? 1
    : bestBid ?? bestAsk ?? 1;
}
