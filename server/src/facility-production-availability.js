import { leasedInFacilityQuantity, leasedOutFacilityQuantity } from './contract-asset-locks.js';
import { facilitySellQuantityForOwner } from './order-book-runtime.js';
import { normalizeProvinceId } from './provinces.js';

function nonNegativeInteger(value) {
  const number = Math.floor(Number(value));
  return Number.isSafeInteger(number) && number > 0 ? number : 0;
}

function auctionItems(auction) {
  if (Array.isArray(auction?.items) && auction.items.length > 0) return auction.items;
  const assetId = String(auction?.assetId || auction?.facilityTypeId || '');
  return auction?.assetKind === 'facility' && assetId
    ? [{ assetKind: 'facility', assetId, quantity: Math.max(1, Number(auction.quantity || 1)), provinceId: auction.provinceId }]
    : [];
}

function auctionedFacilityQuantity(world, ownerId, typeId, provinceId) {
  const selectedProvinceId = normalizeProvinceId(provinceId);
  let total = 0;
  for (const auction of world.assetAuctions || []) {
    if (
      Number(auction?.sellerId) !== Number(ownerId)
      || auction?.status !== 'open'
      || auction?.escrowStatus === 'released'
      || auction?.escrowStatus === 'transferred'
    ) continue;
    for (const item of auctionItems(auction)) {
      if (
        item.assetKind === 'facility'
        && String(item.assetId || '') === String(typeId || '')
        && normalizeProvinceId(item.provinceId ?? auction.provinceId) === selectedProvinceId
      ) total += nonNegativeInteger(item.quantity);
    }
  }
  return total;
}

export function productionAvailableCount(world, player, group) {
  const listed = facilitySellQuantityForOwner(world, player.userId, group.facilityTypeId, group.provinceId);
  const auctioned = auctionedFacilityQuantity(world, player.userId, group.facilityTypeId, group.provinceId);
  const leasedOut = leasedOutFacilityQuantity(world, player.userId, group.facilityTypeId, group.provinceId);
  const leasedIn = leasedInFacilityQuantity(world, player.userId, group.facilityTypeId, group.provinceId);
  return Math.max(0, nonNegativeInteger(group.count) - listed - auctioned - leasedOut + leasedIn);
}
