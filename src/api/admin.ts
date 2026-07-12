import type { AdminSummary, GiftCodeAdminRecord } from '../types';
import { GameApiError } from './game';

const ADMIN_API_BASE = '/economy-api/game/admin';

function requestKey() {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `admin-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body) headers.set('Content-Type', 'application/json');
  if (init?.method && init.method !== 'GET') headers.set('Idempotency-Key', requestKey());
  const response = await fetch(`${ADMIN_API_BASE}${path}`, { ...init, credentials: 'include', headers });
  if (!response.ok) {
    let message = '管理员接口请求失败';
    try {
      const body = (await response.json()) as { message?: string };
      if (body.message) message = body.message;
    } catch { /* preserve fallback */ }
    throw new GameApiError(response.status, message);
  }
  return response.json() as Promise<T>;
}

export const adminApi = {
  summary: async () => (await request<{ summary: AdminSummary }>('/summary', { method: 'GET' })).summary,
  giftCodes: async () => (await request<{ giftCodes: GiftCodeAdminRecord[] }>('/gift-codes', { method: 'GET' })).giftCodes,
  createGiftCode: async (payload: {
    code?: string;
    rewardCredits: number;
    maxRedemptions: number;
    startsAt?: number;
    expiresAt?: number | null;
    note?: string;
  }) => (await request<{ giftCode: { id: number; code: string } & typeof payload }>('/gift-codes', {
    method: 'POST',
    body: JSON.stringify(payload),
  })).giftCode,
  disableGiftCode: (id: number) => request<{ ok: boolean; id: number }>(`/gift-codes/${id}/disable`, { method: 'POST' }),
  redemptions: async (id: number) => (await request<{ redemptions: Array<{ user_id: number; reward_credits: number; redeemed_at: number }> }>(`/gift-codes/${id}/redemptions`, { method: 'GET' })).redemptions,
};
