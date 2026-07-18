import type { AssetKind, EconomyState, OrderSide } from '../types';

const GAME_API_BASE = '/economy-api/game';

export interface GameActionResult { ok: boolean; message: string; }
export interface GameActionResponse { result: GameActionResult; revision: number; state: EconomyState; }
export interface GameStatePollResponse { revision: number; unchanged: boolean; state?: EconomyState; }
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

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body) headers.set('Content-Type', 'application/json');
  if (init?.method && init.method !== 'GET') headers.set('Idempotency-Key', createRequestKey());
  const response = await fetch(`${GAME_API_BASE}${path}`, { ...init, credentials: 'include', headers });
  if (!response.ok) {
    let message = '游戏服务器请求失败';
    try {
      const payload = (await response.json()) as { message?: string };
      if (payload.message) message = payload.message;
    } catch { /* preserve generic message */ }
    throw new GameApiError(response.status, message);
  }
  return response.json() as Promise<T>;
}

function postAction(path: string, body: Record<string, unknown> = {}) {
  return request<GameActionResponse>(path, { method: 'POST', body: JSON.stringify(body) });
}

export async function getGameState(revision?: number | null, signal?: AbortSignal): Promise<GameStatePollResponse> {
  const suffix = Number.isInteger(revision) ? `?revision=${revision}` : '';
  return request<GameStatePollResponse>(`/state${suffix}`, { method: 'GET', signal });
}

export async function getGemShopSummary(): Promise<GemShopSummary> {
  const payload = await request<{ gemShop: GemShopSummary }>('/gem-shop', { method: 'GET' });
  return payload.gemShop;
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
  createAuction: (assetKind: AssetKind | 'collectible', assetId: string, quantity: number, startingBid: number, durationHours: number) => (
    postAction('/auctions', { assetKind, assetId, quantity, startingBid, durationHours })
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
  reset: () => Promise.reject(new GameApiError(410, '经济状态重置功能已永久移除')),
};
