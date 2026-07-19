import type { AssetOrder, OrderSide } from '../types';

export interface OrderBookLevel {
  side: OrderSide;
  price: number;
  remaining: number;
  orderCount: number;
}

/**
 * Aggregate active orders into price levels for anonymous order-book display.
 *
 * This is display-only: the server still stores, matches, fills, charges fees,
 * and cancels every order independently using price-time priority.
 */
export function buildOrderBookLevels(
  orders: AssetOrder[],
  side: OrderSide,
  limit = 5,
): OrderBookLevel[] {
  const levels = new Map<number, OrderBookLevel>();

  for (const order of orders) {
    if (
      order.side !== side
      || !['open', 'partial'].includes(order.status)
      || order.remaining <= 0
      || !Number.isInteger(order.price)
      || order.price < 1
    ) {
      continue;
    }

    const current = levels.get(order.price);
    if (current) {
      current.remaining += order.remaining;
      current.orderCount += 1;
    } else {
      levels.set(order.price, {
        side,
        price: order.price,
        remaining: order.remaining,
        orderCount: 1,
      });
    }
  }

  const normalizedLimit = Number.isFinite(limit)
    ? Math.max(0, Math.floor(limit))
    : 0;

  return [...levels.values()]
    .sort(side === 'buy'
      ? (left, right) => right.price - left.price
      : (left, right) => left.price - right.price)
    .slice(0, normalizedLimit);
}
