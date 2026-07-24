import type { EconomyState } from '../types';

export type AuctionStatus = 'open' | 'sold' | 'ended' | 'cancelled';
export type AuctionAssetKind = 'commodity' | 'facility';

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
  assetKind: AuctionAssetKind;
  assetId: string;
  productId?: string;
  facilityTypeId?: string;
  quantity: number;
  asset: AuctionAssetSummary;
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

export interface AssetAuctionState {
  assetAuctions: AssetAuction[];
}

export function getAuctionState(game: EconomyState): AssetAuctionState {
  const state = game as EconomyState & Partial<AssetAuctionState>;
  return {
    assetAuctions: Array.isArray(state.assetAuctions) ? state.assetAuctions : [],
  };
}
