import type { AssetKind, AssetOrder } from '../types';

export function orderKind(order: AssetOrder): AssetKind {
  return order.assetKind === 'facility' || order.facilityTypeId
    ? 'facility'
    : 'commodity';
}

export function orderAssetId(order: AssetOrder): string {
  return orderKind(order) === 'facility'
    ? order.assetId || order.facilityTypeId || ''
    : order.assetId || order.productId || 'wheat';
}
