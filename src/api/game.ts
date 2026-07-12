import type { AssetKind, EconomyState, OrderSide, ProductionMode } from '../types';

const GAME_API_BASE = '/economy-api/game';

export interface GameActionResult { ok: boolean; message: string; }
export interface GameActionResponse { result: GameActionResult; state: EconomyState; }

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

export async function getGameState(): Promise<EconomyState> {
  const payload = await request<{ state: EconomyState }>('/state', { method: 'GET' });
  return payload.state;
}

export const gameActions = {
  work: () => postAction('/work'),
  upgradeWarehouse: () => postAction('/warehouse/upgrade'),
  buildFacility: (facilityTypeId: string) => postAction('/facilities', { facilityTypeId }),
  startFacility: (facilityTypeId: string) => postAction(`/facilities/${encodeURIComponent(facilityTypeId)}/start`),
  stopFacility: (facilityTypeId: string) => postAction(`/facilities/${encodeURIComponent(facilityTypeId)}/stop`),
  pauseFacility: (facilityTypeId: string) => postAction(`/facilities/${encodeURIComponent(facilityTypeId)}/pause`),
  setProductionPlan: (facilityTypeId: string, mode: ProductionMode, targetQuantity?: number) => (
    postAction(`/facilities/${encodeURIComponent(facilityTypeId)}/plan`, { mode, targetQuantity })
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
  renamePlayer: (playerName: string) => request<GameActionResponse>('/profile', {
    method: 'PATCH',
    body: JSON.stringify({ playerName }),
  }),
  redeemGift: (code: string) => postAction('/gifts/redeem', { code }),
  reset: () => postAction('/reset'),
};
