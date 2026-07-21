import type { AssetKind, EconomyState, OrderSide } from '../types';
import type { AuctionItem } from '../collectibles/types';
import {
  createStateDeliveryCache,
  type StateDeliveryEnvelope,
  type StatePartitionPatches,
  type StatePartitionRevisions,
} from '../app/stateDelivery.js';
import { acceptServerNow, resetServerClock } from '../utils/serverClock.js';

const GAME_API_BASE = '/economy-api/game';
const stateDeliveryCache = createStateDeliveryCache();
const DEFAULT_READ_TIMEOUT_MS = 8_000;
const DEFAULT_WRITE_TIMEOUT_MS = 12_000;

export const DEFAULT_QQ_GROUP_URL = 'https://qm.qq.com/q/eN8hya0Yn0';

export interface GameActionResult { ok: boolean; message: string; }
export interface GameActionResponse {
  result: GameActionResult;
  revision: number;
}
export interface GameStatePollResponse extends StateDeliveryEnvelope { state?: EconomyState; }
export interface TutorialCompletionState {
  completedVersion: number;
  completedAt?: number;
}
export interface TutorialStatusResponse {
  tutorial: TutorialCompletionState;
  currentVersion: number;
}
export interface TutorialCompletionResponse {
  result: GameActionResult;
  tutorial: TutorialCompletionState;
}
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
  resetServerClock();
}

function createTimedSignal(source: AbortSignal | null | undefined, timeoutMs: number) {
  const controller = new AbortController();
  let timedOut = false;
  const forwardAbort = () => controller.abort();
  if (source?.aborted) controller.abort();
  else source?.addEventListener('abort', forwardAbort, { once: true });
  const timeoutId = globalThis.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  return {
    signal: controller.signal,
    didTimeout: () => timedOut,
    cleanup: () => {
      globalThis.clearTimeout(timeoutId);
      source?.removeEventListener('abort', forwardAbort);
    },
  };
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body) headers.set('Content-Type', 'application/json');
  if (init?.method && init.method !== 'GET') headers.set('Idempotency-Key', createRequestKey());
  const timeoutMs = init?.method && init.method !== 'GET'
    ? DEFAULT_WRITE_TIMEOUT_MS
    : DEFAULT_READ_TIMEOUT_MS;
  const timedSignal = createTimedSignal(init?.signal, timeoutMs);
  try {
    const response = await fetch(`${GAME_API_BASE}${path}`, {
      ...init,
      credentials: 'include',
      headers,
      signal: timedSignal.signal,
    });
    if (!response.ok) {
      let message = '游戏服务器请求失败';
      try {
        const payload = (await response.json()) as { message?: string };
        if (payload.message) message = payload.message;
      } catch { /* preserve generic message */ }
      throw new GameApiError(response.status, message);
    }
    const payload = await response.json() as unknown;
    if (isStateDeliveryPayload(payload)) {
      acceptServerNow(payload.serverNow);
      return stateDeliveryCache.accept(payload) as T;
    }
    return payload as T;
  } catch (reason) {
    if (timedSignal.didTimeout() && reason instanceof Error && reason.name === 'AbortError') {
      throw new GameApiError(408, '游戏服务器响应超时，请稍后重试');
    }
    throw reason;
  } finally {
    timedSignal.cleanup();
  }
}

function postAction(path: string, body: Record<string, unknown> = {}) {
  return request<GameActionResponse>(path, { method: 'POST', body: JSON.stringify(body) });
}

export async function getGameState(revision?: number | null, signal?: AbortSignal): Promise<GameStatePollResponse> {
  if (!Number.isInteger(revision)) resetGameStateDelivery();
  const params = new URLSearchParams();
  if (Number.isInteger(revision)) params.set('revision', String(revision));
  for (const [name, value] of Object.entries(knownPartitionRevisions())) {
    if (value) params.set(name, value);
  }
  const query = params.toString();
  const suffix = query ? `?${query}` : '';
  return request<GameStatePollResponse>(`/state${suffix}`, { method: 'GET', signal });
}

export async function getTutorialStatus(signal?: AbortSignal): Promise<TutorialStatusResponse> {
  return request<TutorialStatusResponse>('/tutorial', { method: 'GET', signal });
}

export async function completeTutorial(version: number): Promise<TutorialCompletionResponse> {
  return request<TutorialCompletionResponse>('/tutorial/complete', {
    method: 'POST',
    body: JSON.stringify({ version }),
  });
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
