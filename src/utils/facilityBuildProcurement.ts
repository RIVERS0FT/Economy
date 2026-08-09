import type { AssetOrder } from '../types';
import { orderAssetId, orderKind } from './orderIdentity';

export interface FacilityBuildMaterialNeed {
  productId: string;
  quantity: number;
}

export interface FacilityBuildProcurementQuote {
  complete: boolean;
  estimatedTotal: number;
  missingQuantity: number;
  materialPriceCaps: Record<string, number>;
  unavailableProductIds: string[];
  selfCrossingProductIds: string[];
}

function priceCents(value: number) {
  const cents = Math.round(Number(value) * 100);
  return Number.isSafeInteger(cents) && cents >= 1 ? cents : null;
}

function openOrder(order: AssetOrder) {
  return order.status === 'open' || order.status === 'partial';
}

export function quoteFacilityBuildProcurement(
  orders: AssetOrder[],
  materialNeeds: FacilityBuildMaterialNeed[],
): FacilityBuildProcurementQuote {
  const needs = new Map<string, number>();
  for (const item of materialNeeds) {
    const quantity = Math.max(0, Math.floor(Number(item.quantity) || 0));
    if (quantity <= 0) continue;
    needs.set(item.productId, (needs.get(item.productId) ?? 0) + quantity);
  }

  let totalCents = 0n;
  let missingQuantity = 0;
  const materialPriceCaps: Record<string, number> = {};
  const unavailableProductIds: string[] = [];
  const selfCrossingProductIds: string[] = [];

  for (const [productId, quantity] of needs) {
    missingQuantity += quantity;
    const asks = orders
      .map((order, index) => ({ order, index }))
      .filter(({ order }) => (
        openOrder(order)
        && orderKind(order) === 'commodity'
        && orderAssetId(order) === productId
        && order.side === 'sell'
        && !order.isOwn
      ))
      .sort((left, right) => (
        Number(left.order.price || 0) - Number(right.order.price || 0)
        || Number(left.order.createdAt || 0) - Number(right.order.createdAt || 0)
        || left.index - right.index
      ));

    let remaining = quantity;
    let capCents: number | null = null;
    for (const { order } of asks) {
      if (remaining <= 0) break;
      const cents = priceCents(order.price);
      if (cents === null) continue;
      const take = Math.min(remaining, Math.max(0, Math.floor(Number(order.remaining || 0))));
      if (take <= 0) continue;
      totalCents += BigInt(cents) * BigInt(take);
      capCents = cents;
      remaining -= take;
    }

    if (remaining > 0 || capCents === null) {
      unavailableProductIds.push(productId);
      continue;
    }
    materialPriceCaps[productId] = capCents / 100;

    const crossesOwnOrder = orders.some((order) => {
      if (!order.isOwn || !openOrder(order) || order.side !== 'sell') return false;
      if (orderKind(order) !== 'commodity' || orderAssetId(order) !== productId) return false;
      const cents = priceCents(order.price);
      return cents !== null && cents <= capCents;
    });
    if (crossesOwnOrder) selfCrossingProductIds.push(productId);
  }

  const numericTotalCents = Number(totalCents);
  const safeTotal = Number.isSafeInteger(numericTotalCents);
  return {
    complete: unavailableProductIds.length === 0 && safeTotal,
    estimatedTotal: safeTotal ? numericTotalCents / 100 : 0,
    missingQuantity,
    materialPriceCaps,
    unavailableProductIds,
    selfCrossingProductIds,
  };
}
