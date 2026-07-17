import type {
  CollectibleAdminRecord,
  CollectibleImportRecord,
  CollectibleOwnershipRecord,
} from '../collectibles/types';
import type { AdminSummary, GiftCodeAdminRecord } from '../types';
import { GameApiError } from './game';

const ADMIN_API_BASE = '/economy-api/game/admin';

export type ExtendedAdminSummary = AdminSummary & {
  collectibleCount: number;
  openAuctionCount: number;
};

export type GiftCodeCreationPayload = {
  rewardCredits: number;
  maxRedemptions: number;
  startsAt?: number;
  expiresAt?: number | null;
  note?: string;
};

export type GiftCodeBatchResult = GiftCodeCreationPayload & {
  createdCount: number;
  codes: string[];
  startsAt: number;
  expiresAt: number | null;
  note: string;
};

export interface CursorPage<T> {
  items: T[];
  total: number;
  nextCursor: string | null;
}

export interface GiftRedemptionRecord {
  user_id: number;
  reward_credits: number;
  redeemed_at: number;
}

export interface BanIncidentSummary {
  id: number;
  status: 'active' | 'reviewed' | 'closed';
  detected_at: number;
  updated_at: number;
  detected_user_count: number;
  fingerprint_preview: string;
  active_ban_count: number;
}

export interface BanIncidentMember {
  user_id: number;
  registered_at: number;
  registration_source: 'email_verification' | 'homepage_session';
  email: string;
  ban_status: 'active' | 'lifted' | null;
  banned_at: number | null;
  unbanned_at: number | null;
  admin_note: string | null;
}

export interface BanIncidentDetails {
  incident: BanIncidentSummary & {
    fingerprint_preview: string;
    created_reason: string;
  };
  members: BanIncidentMember[];
}

export function createAdminRequestKey() {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `admin-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function request<T>(path: string, init?: RequestInit, idempotencyKey?: string): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body) headers.set('Content-Type', 'application/json');
  if (init?.method && init.method !== 'GET') {
    headers.set('Idempotency-Key', idempotencyKey || createAdminRequestKey());
  }
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

function pagePath(path: string, cursor?: string | null) {
  if (!cursor) return path;
  return `${path}?cursor=${encodeURIComponent(cursor)}`;
}

export const adminApi = {
  summary: async () => (await request<{ summary: ExtendedAdminSummary }>('/summary', { method: 'GET' })).summary,
  giftCodes: async (cursor?: string | null): Promise<CursorPage<GiftCodeAdminRecord>> => {
    const payload = await request<{ giftCodes: GiftCodeAdminRecord[]; total: number; nextCursor: string | null }>(
      pagePath('/gift-codes', cursor),
      { method: 'GET' },
    );
    return { items: payload.giftCodes, total: payload.total, nextCursor: payload.nextCursor };
  },
  createGiftCode: async (payload: GiftCodeCreationPayload & { code?: string }, idempotencyKey?: string) => (
    await request<{ giftCode: { id: number; code: string } & GiftCodeCreationPayload }>('/gift-codes', {
      method: 'POST',
      body: JSON.stringify(payload),
    }, idempotencyKey)
  ).giftCode,
  createGiftCodeBatch: async (payload: GiftCodeCreationPayload & { count: number }, idempotencyKey?: string) => (
    await request<{ result: GiftCodeBatchResult }>('/gift-codes/batch', {
      method: 'POST',
      body: JSON.stringify(payload),
    }, idempotencyKey)
  ).result,
  disableGiftCode: (id: number) => request<{ ok: boolean; id: number }>(`/gift-codes/${id}/disable`, { method: 'POST' }),
  redemptions: async (id: number, cursor?: string | null): Promise<CursorPage<GiftRedemptionRecord>> => {
    const payload = await request<{ redemptions: GiftRedemptionRecord[]; total: number; nextCursor: string | null }>(
      pagePath(`/gift-codes/${id}/redemptions`, cursor),
      { method: 'GET' },
    );
    return { items: payload.redemptions, total: payload.total, nextCursor: payload.nextCursor };
  },
  collectibles: async () => (await request<{ collectibles: CollectibleAdminRecord[] }>('/collectibles', { method: 'GET' })).collectibles,
  importCollectibles: async (items: CollectibleImportRecord[]) => (
    await request<{ result: { importedCount: number; collectibles: CollectibleAdminRecord[] } }>('/collectibles/import', {
      method: 'POST',
      body: JSON.stringify({ items }),
    })
  ).result,
  collectibleOwnership: async (id: string) => (
    await request<{ ownership: CollectibleOwnershipRecord[] }>(`/collectibles/${encodeURIComponent(id)}/ownership`, { method: 'GET' })
  ).ownership,
  banIncidents: async () => (
    await request<{ incidents: BanIncidentSummary[] }>('/bans', { method: 'GET' })
  ).incidents,
  banIncident: (id: number) => request<BanIncidentDetails>(`/bans/${id}`, { method: 'GET' }),
  unbanUser: (userId: number, note: string) => request<{ ok: boolean; message: string }>(
    `/bans/users/${userId}/unban`,
    { method: 'POST', body: JSON.stringify({ note }) },
  ),
  rebanUser: (userId: number, note: string) => request<{ ok: boolean; message: string }>(
    `/bans/users/${userId}/reban`,
    { method: 'POST', body: JSON.stringify({ note }) },
  ),
  unbanIncident: (incidentId: number, note: string) => request<{ ok: boolean; message: string; changedCount: number }>(
    `/bans/${incidentId}/unban-all`,
    { method: 'POST', body: JSON.stringify({ note }) },
  ),
};
