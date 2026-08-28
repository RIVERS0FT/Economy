import type { AssetKind, AssetOrder, OrderSide } from '../types';
import { orderAssetId, orderKind } from './orderIdentity';

export function isValidOrderPrice(price: number) {
  return Number.isFinite(price) && price >= 0.01 && Math.abs(price * 100 - Math.round(price * 100)) < 1e-8;
}

export function defaultOrderPrice(
  orders: AssetOrder[],
  assetKind: AssetKind,
  assetId: string,
  side: OrderSide,
  summary?: { bestBid?: number | null; bestAsk?: number | null },
): number {
  let bestBid: number | undefined;
  let bestAsk: number | undefined;

  for (const order of orders) {
    if (!['open', 'partial'].includes(order.status) || order.remaining <= 0) continue;
    if (orderKind(order) !== assetKind || orderAssetId(order) !== assetId) continue;
    if (!isValidOrderPrice(order.price)) continue;

    if (order.side === 'buy') {
      bestBid = bestBid === undefined ? order.price : Math.max(bestBid, order.price);
    } else {
      bestAsk = bestAsk === undefined ? order.price : Math.min(bestAsk, order.price);
    }
  }

  const summaryBestBid = isValidOrderPrice(Number(summary?.bestBid))
    ? Number(summary?.bestBid)
    : undefined;
  const summaryBestAsk = isValidOrderPrice(Number(summary?.bestAsk))
    ? Number(summary?.bestAsk)
    : undefined;
  return side === 'buy'
    ? summaryBestAsk ?? summaryBestBid ?? bestAsk ?? bestBid ?? 1
    : summaryBestBid ?? summaryBestAsk ?? bestBid ?? bestAsk ?? 1;
}
