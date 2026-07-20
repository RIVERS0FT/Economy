import type { AssetKind, EconomyState, OrderSide } from '../types';
import type { AuctionItem } from '../collectibles/types';
import {
  createStateDeliveryCache,
  type StateDeliveryEnvelope,
  type StatePartitionPatches,
  type StatePartitionRevisions,
} from '../app/stateDelivery.js';

const GAME_API_BASE = '/economy-api/game';
const STATE_REVISIONS_HEADER = 'X-Economy-State-Revisions';
const stateDeliveryCache = createStateDeliveryCache();

export const DEFAULT_QQ_GROUP_URL = 'https://qm.qq.com/q/eN8hya0Yn0';

export interface GameActionResult { ok: boolean; message: string; }
export interface GameActionResponse extends StateDeliveryEnvelope {
  result: GameActionResult;
  state?: EconomyState;
}
export interface GameStatePollResponse extends StateDeliveryEnvelope { state?: EconomyState; }
export interface GemShopExchangeRecord {
  gemsSpent: number;
  creditsReceived: number;
  createdAt: number;
}
export interface GemShopSummary {
  gems: number;
  credits: number;
  creditsPerGem: number;
  minExchangeGems: number;
  maxExchangeGems: number;
  maxExchangeableGems: number;
  totalGemsSpent: number;
  totalCreditsReceived: number;
  recentExchanges: GemShopExchangeRecord[];
}
export interface CommunityLinkConfig {
  qqGroupUrl: string;
  updatedAt: number | null;
}

export type { StatePartitionPatches, StatePartitionRevisions };

export class GameApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'GameApiError';
    this.status = status;
  }
}

function createRequestKey() {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `request-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function isStateDeliveryPayload(value: unknown): value is StateDeliveryEnvelope {
  if (!value || typeof value !== 'object') return false;
  const payload = value as Partial<StateDeliveryEnvelope>;
  return Number.isInteger(payload.revision) && typeof payload.unchanged === 'boolean';
}

function knownPartitionRevisions() {
  return stateDeliveryCache.getPartitionRevisions();
}

export function resetGameStateDelivery() {
  stateDeliveryCache.reset();
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body) headers.set('Content-Type', 'application/json');
  if (init?.method && init.method !== 'GET') {
    headers.set('Idempotency-Key', createRequestKey());
    const revisions = knownPartitionRevisions();
    if (Object.keys(revisions).length > 0) headers.set(STATE_REVISIONS_HEADER, JSON.stringify(revisions));
  }
  const response = await fetch(`${GAME_API_BASE}${path}`, { ...init, credentials: 'include', headers });
  if (!response.ok) {
    let message = '游戏服务器请求失败';
    try {
      const payload = (await response.json()) as { message?: string };
      if (payload.message) message = payload.message;
    } catch { /* preserve generic message */ }
    throw new GameApiError(response.status, message);
  }
  const payload = await response.json() as unknown;
  return (isStateDeliveryPayload(payload) ? stateDeliveryCache.accept(payload) : payload) as T;
}

function postAction(path: string, body: Record<string, unknown> = {}) {
  return request<GameActionResponse>(path, { method: 'POST', body: JSON.stringify(body) });
}

export async function getGameState(revision?: number | null, signal?: AbortSignal): Promise<GameStatePollResponse> {
  if (!Number.isInteger(revision)) stateDeliveryCache.reset();
  const params = new URLSearchParams();
  if (Number.isInteger(revision)) params.set('revision', String(revision));
  for (const [name, value] of Object.entries(knownPartitionRevisions())) {
    if (value) params.set(name, value);
  }
  const query = params.toString();
  const suffix = query ? `?${query}` : '';
  return request<GameStatePollResponse>(`/state${suffix}`, { method: 'GET', signal });
}

export async function getGemShopSummary(): Promise<GemShopSummary> {
  const payload = await request<{ gemShop: GemShopSummary }>('/gem-shop', { method: 'GET' });
  return payload.gemShop;
}

export async function getCommunityLink(signal?: AbortSignal): Promise<CommunityLinkConfig> {
  const payload = await request<{ communityLink: CommunityLinkConfig }>('/community-link', { method: 'GET', signal });
  return payload.communityLink;
}

export const gameActions = {
  work: () => postAction('/work'),
  upgradeWarehouse: () => postAction('/warehouse/upgrade'),
  buildFacility: (facilityTypeId: string) => postAction('/facilities', { facilityTypeId }),
  startFacility: (facilityTypeId: string) => postAction(`/facilities/${encodeURIComponent(facilityTypeId)}/start`),
  stopFacility: (facilityTypeId: string) => postAction(`/facilities/${encodeURIComponent(facilityTypeId)}/stop`),
  pauseFacility: (facilityTypeId: string) => postAction(`/facilities/${encodeURIComponent(facilityTypeId)}/pause`),
  setFacilityRecipe: (facilityTypeId: string, recipeId: string) => (
    postAction(`/facilities/${encodeURIComponent(facilityTypeId)}/recipe`, { recipeId })
  ),
  placeAssetOrder: (assetKind: AssetKind, assetId: string, side: OrderSide, quantity: number, price: number) => (
    postAction('/orders', {
      assetKind,
      assetId,
      productId: assetKind === 'commodity' ? assetId : undefined,
      facilityTypeId: assetKind === 'facility' ? assetId : undefined,
      side,
      quantity,
      price,
    })
  ),
  placeCommodityOrder: (productId: string, side: OrderSide, quantity: number, price: number) => (
    postAction('/orders', { assetKind: 'commodity', assetId: productId, productId, side, quantity, price })
  ),
  cancelOrder: (orderId: string) => postAction(`/orders/${encodeURIComponent(orderId)}/cancel`),
  createAuction: (items: AuctionItem[], startingBid: number, durationHours: number) => (
    postAction('/auctions', { items, startingBid, durationHours })
  ),
  placeAuctionBid: (auctionId: string, amount: number) => (
    postAction(`/auctions/${encodeURIComponent(auctionId)}/bids`, { amount })
  ),
  cancelAuction: (auctionId: string) => (
    postAction(`/auctions/${encodeURIComponent(auctionId)}/cancel`)
  ),
  createCollectibleAuction: (collectibleId: string, startingBid: number, durationHours: number) => (
    postAction('/collectible-auctions', { collectibleId, startingBid, durationHours })
  ),
  placeCollectibleBid: (auctionId: string, amount: number) => (
    postAction(`/collectible-auctions/${encodeURIComponent(auctionId)}/bids`, { amount })
  ),
  cancelCollectibleAuction: (auctionId: string) => (
    postAction(`/collectible-auctions/${encodeURIComponent(auctionId)}/cancel`)
  ),
  renamePlayer: (playerName: string) => request<GameActionResponse>('/profile', {
    method: 'PATCH',
    body: JSON.stringify({ playerName }),
  }),
  redeemGift: (code: string) => postAction('/gifts/redeem', { code }),
  exchangeGems: (gems: number) => postAction('/gem-shop/exchange', { gems }),
};
