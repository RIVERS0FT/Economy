import { pendingCommodityBuyQuantityForOwner } from './order-book-runtime.js';

function auctionItems(auction) {
  if (Array.isArray(auction?.items) && auction.items.length > 0) return auction.items;
  const kind = auction?.assetKind;
  const assetId = String(auction?.assetId || auction?.productId || auction?.facilityTypeId || '');
  return kind && assetId
    ? [{ assetKind: kind, assetId, quantity: Math.max(1, Number(auction.quantity || 1)) }]
    : [];
}

function auctionCommodityQuantity(auction) {
  return auctionItems(auction).reduce((sum, item) => (
    item.assetKind === 'commodity'
      ? sum + Math.max(0, Number(item.quantity || 0))
      : sum
  ), 0);
}

export function nonContractWarehouseReservation(world, userId) {
  const normalizedUserId = Number(userId);
  const orderReserved = pendingCommodityBuyQuantityForOwner(world, normalizedUserId);
  const auctionReserved = (world?.assetAuctions || []).reduce((sum, auction) => {
    if (
      Number(auction?.highestBidderId) !== normalizedUserId
      || auction?.status !== 'open'
      || auction?.escrowStatus === 'released'
      || auction?.escrowStatus === 'transferred'
    ) return sum;
    return sum + auctionCommodityQuantity(auction);
  }, 0);
  return orderReserved + auctionReserved;
}
