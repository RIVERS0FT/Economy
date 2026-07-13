import type { EconomyState } from '../types';

export type CollectibleAuctionStatus = 'open' | 'sold' | 'ended' | 'cancelled';

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

export interface CollectibleBid {
  bidderId: number;
  bidderName: string;
  amount: number;
  createdAt: number;
}

export interface CollectibleAuction {
  id: string;
  collectibleId: string;
  collectible: Collectible;
  sellerId: number;
  sellerName: string;
  startingBid: number;
  highestBid: number | null;
  highestBidderId: number | null;
  highestBidderName: string | null;
  status: CollectibleAuctionStatus;
  createdAt: number;
  endsAt: number;
  settledAt?: number;
  bids: CollectibleBid[];
  isSeller: boolean;
  isHighestBidder: boolean;
  minimumBid: number;
}

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
  collectibleAuctions: CollectibleAuction[];
}

export function getCollectibleState(game: EconomyState): CollectibleState {
  const state = game as EconomyState & Partial<CollectibleState>;
  return {
    collectibles: Array.isArray(state.collectibles) ? state.collectibles : [],
    collectibleAuctions: Array.isArray(state.collectibleAuctions) ? state.collectibleAuctions : [],
  };
}
