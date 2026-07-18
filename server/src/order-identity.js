export function isOpenOrder(order) {
  return Number(order?.remaining || 0) > 0
    && (order?.status === 'open' || order?.status === 'partial');
}

export function orderKind(order) {
  return order?.assetKind === 'facility' || order?.facilityTypeId
    ? 'facility'
    : 'commodity';
}

export function orderAssetId(order) {
  return orderKind(order) === 'facility'
    ? String(order?.assetId || order?.facilityTypeId || '')
    : String(order?.assetId || order?.productId || 'wheat');
}
