import type { EconomyState } from '../types';

export type AuctionStatus = 'open' | 'sold' | 'ended' | 'cancelled';
export type AuctionAssetKind = 'commodity' | 'facility';
export type AuctionSettlementReason =
  | 'sold'
  | 'no_bid'
  | 'reserve_not_met'
  | 'seller_cancelled'
  | 'settlement_failed'
  | 'migration_cancelled'
  | null;

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

export interface AuctionBidHistoryItem {
  bidderLabel: string;
  amount: number;
  createdAt: number;
  isMine: boolean;
}

export interface AuctionBidHistory {
  auctionId: string;
  bidCount: number;
  latestBidAt: number | null;
  bids: AuctionBidHistoryItem[];
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
  sellerName: string;
  startingBid: number;
  highestBid: number | null;
  highestBidderLabel: string | null;
  status: AuctionStatus;
  escrowStatus: 'held' | 'released' | 'transferred';
  settlementReason: AuctionSettlementReason;
  createdAt: number;
  originalEndsAt: number;
  endsAt: number;
  settledAt?: number;
  extensionCount: number;
  maxExtendedEndsAt: number;
  minimumIncrement: number;
  minimumBid: number;
  hasBids: boolean;
  bidCount: number;
  latestBidAt: number | null;
  hasHiddenReserve: boolean;
  reserveMet: boolean;
  sellerFeeBps: number;
  buyerFeeBps: number;
  isSeller: boolean;
  isHighestBidder: boolean;
  reservePrice?: number | null;
  listingFee?: number;
  listingFeeStatus?: 'held' | 'distributed' | 'refunded' | 'none';
  sellerFee?: number | null;
  sellerNetProceeds?: number | null;
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
