import type { EconomyState } from '../types';

export type AuctionStatus = 'open' | 'sold' | 'ended' | 'cancelled';
export type AuctionAssetKind = 'collectible' | 'commodity' | 'facility';

export interface Collectible {
  id: string;
  source: 'art-institute-of-chicago';
  sourceArtworkId: number;
  title: string;
  artist: string;
  dateDisplay: string;
  mediumDisplay: string;
  dimensions: string;
  description: string;
  imageId: string;
  isPublicDomain: true;
  currentOwnerId: number | null;
  currentOwnerName: string;
  imageUrl: string;
  thumbnailUrl: string;
  sourceUrl: string;
  apiUrl: string;
  auctionId?: string;
  createdAt: number;
  createdBy: number;
}

export interface AuctionBid {
  bidderId: number;
  bidderName: string;
  amount: number;
  createdAt: number;
}

export interface AuctionItem {
  assetKind: AuctionAssetKind;
  assetId: string;
  quantity: number;
}

export interface AuctionAssetSummary {
  kind: AuctionAssetKind;
  id: string;
  name: string;
  subtitle: string;
  thumbnailUrl?: string;
  sourceUrl?: string;
  collectible?: Collectible;
}

export interface AuctionItemSummary extends AuctionAssetSummary {
  quantity: number;
}

export interface AssetAuction {
  id: string;
  items: AuctionItem[];
  itemSummaries: AuctionItemSummary[];
  itemCount: number;
  isBundle: boolean;
  /** Compatibility aliases for historical single-asset callers. */
  assetKind: AuctionAssetKind;
  assetId: string;
  collectibleId?: string;
  productId?: string;
  facilityTypeId?: string;
  quantity: number;
  asset: AuctionAssetSummary;
  /** Compatibility field retained for collectible-only callers. */
  collectible?: Collectible;
  sellerId: number;
  sellerName: string;
  startingBid: number;
  highestBid: number | null;
  highestBidderId: number | null;
  highestBidderName: string | null;
  status: AuctionStatus;
  escrowStatus: 'held' | 'released' | 'transferred';
  createdAt: number;
  endsAt: number;
  settledAt?: number;
  bids: AuctionBid[];
  isSeller: boolean;
  isHighestBidder: boolean;
  minimumBid: number;
}

export type CollectibleAuctionStatus = AuctionStatus;
export type CollectibleBid = AuctionBid;
export type CollectibleAuction = AssetAuction & {
  assetKind: 'collectible';
  collectibleId: string;
  collectible: Collectible;
};

export interface CollectibleOwnershipRecord {
  id: string;
  collectibleId: string;
  fromOwnerId: number | null;
  fromOwnerName: string;
  toOwnerId: number | null;
  toOwnerName: string;
  reason: 'created' | 'assigned' | 'auction';
  auctionId?: string;
  price?: number;
  auctionTotalPrice?: number;
  bundleItemCount?: number;
  createdAt: number;
}

export interface CollectibleAdminRecord extends Collectible {
  ownershipCount: number;
}

export interface CollectibleImportRecord {
  sourceArtworkId: number;
  title: string;
  artist?: string;
  dateDisplay?: string;
  mediumDisplay?: string;
  dimensions?: string;
  description?: string;
  imageId: string;
  isPublicDomain: true;
  initialOwnerId?: number | null;
}

export interface CollectibleState {
  collectibles: Collectible[];
  assetAuctions: AssetAuction[];
  collectibleAuctions: CollectibleAuction[];
}

export function getCollectibleState(game: EconomyState): CollectibleState {
  const state = game as EconomyState & Partial<CollectibleState>;
  const collectibleAuctions = Array.isArray(state.collectibleAuctions) ? state.collectibleAuctions : [];
  const assetAuctions = Array.isArray(state.assetAuctions) ? state.assetAuctions : collectibleAuctions;
  return {
    collectibles: Array.isArray(state.collectibles) ? state.collectibles : [],
    assetAuctions,
    collectibleAuctions: collectibleAuctions.length > 0
      ? collectibleAuctions
      : assetAuctions.filter((auction): auction is CollectibleAuction => (
        auction.itemCount === 1 && auction.assetKind === 'collectible'
      )),
  };
}
