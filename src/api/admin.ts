import type { AdminSummary, GiftCodeAdminRecord } from '../types';
import { GameApiError, type CommunityLinkConfig } from './game';

const ADMIN_API_BASE = '/economy-api/game/admin';

export type PopulationModelId = 'basic' | 'skilled' | 'professional';

export interface PopulationModelAdminSummary {
  id: PopulationModelId;
  name: string;
  consumptionState: 'lavish' | 'prosperous' | 'normal' | 'strained' | 'subsistence';
  credits: number;
  frozenCredits: number;
  pendingIncome: Record<'production' | 'construction' | 'warehouse' | 'marketService', number>;
  lastIncome: number;
  incomeEma: number;
  recentPeakIncome: number;
  noIncomeCycles: number;
  stateReason: string;
  stateCycles: number;
  incomeHealthBps: number;
  walletCoverageBps: number;
  incomeCoverageBps: number;
  lastBudget: number;
  foodBudget: number;
  householdBudget: number;
  stabilizationBudget: number;
  lastStabilizationIssued: number;
  lastAdminPopulationIssued: number;
  totalIncome: number;
  totalSpent: number;
}

export interface PopulationPolicy {
  stabilizationShareBps: number;
  targetWalletCycles: number;
  refillCapBps: number;
  productionWageMultiplierBps: number;
  modelMultipliersBps: Record<PopulationModelId, number>;
  effectiveCycleId: number;
  expiresAfterCycleId: number | null;
  updatedAt: number | null;
  updatedBy: number | null;
  isDefault: boolean;
  currentCycleId: number;
  durationCycles: number | null;
  elapsedCycles: number | null;
  remainingCycles: number | null;
  effectiveAt: number | null;
  expiresAt: number | null;
  nextCycleAt: number;
  currentCycleIssued: {
    issuedByModel: Record<PopulationModelId, number>;
    automaticByModel: Record<PopulationModelId, number>;
    adminByModel: Record<PopulationModelId, number>;
  };
}

export interface PopulationPolicyLimits {
  stabilizationShareBps: { min: number };
  targetWalletCycles: { min: number };
  refillCapBps: { min: number };
  productionWageMultiplierBps: { min: number };
  modelMultiplierBps: { min: number };
  durationCycles: { min: number };
}

export interface PopulationEconomyAdminSummary {
  credits: number;
  frozenCredits: number;
  pendingIncome: number;
  lastIncome: number;
  lastBudget: number;
  totalIncome: number;
  totalSpent: number;
  constructionEscrow: number;
  totalEmploymentIncome: number;
  totalConsumption: number;
  models: Record<PopulationModelId, PopulationModelAdminSummary>;
  sources: Record<'production' | 'construction' | 'warehouse' | 'marketService', number>;
  productionByComplexity: Record<'C1' | 'C2' | 'C3' | 'C4' | 'C5' | 'C6' | 'C7', number>;
  productionWageAdjustment: { subsidyIssued: number; withheld: number };
  issuance: { work: number; exchange: number; gift: number; legacyPopulation: number; migration: number; stabilization: number; adminPopulation: number; productionWageSubsidy: number; total: number };
  policy: PopulationPolicy;
  policyLimits: PopulationPolicyLimits;
  policyBaseBudget: number;
  policyProjectedStabilizationTotal: number;
}

export type ExtendedAdminSummary = AdminSummary & {
  openAuctionCount: number;
  openContractCount: number;
  populationEconomy: PopulationEconomyAdminSummary;
};

export type AdminPlayerStatisticsRange = '7d' | '30d' | '90d';

export interface AdminPlayerStatisticsRetentionRow {
  eligible: number;
  retained: number;
  rateBps: number;
}

export interface AdminPlayerStatisticsFunnelStage {
  id: string;
  label: string;
  count: number;
  medianHours: number | null;
  conversionBps: number;
}

export interface AdminPlayerStatisticsParticipationRow {
  id: string;
  label: string;
  count: number;
  shareBps: number;
}

export interface AdminPlayerStatisticsAttention {
  id: string;
  label: string;
  count: number;
  tone: 'neutral' | 'warning' | 'danger';
}

export interface AdminPlayerStatisticsSeriesPoint {
  day: string;
  startsAt: number;
  covered: boolean;
  partialCoverage: boolean;
  newPlayers: number;
  activePlayers: number | null;
  firstActivities: number | null;
  productionParticipants: number | null;
  tradeParticipants: number | null;
}

export interface AdminPlayerStatistics {
  generatedAt: number;
  coverageStartsAt: number;
  revision: number;
  range: {
    key: AdminPlayerStatisticsRange;
    days: number;
    startsAt: number;
    endsAt: number;
    timeZone: 'Asia/Shanghai';
    completeHistory: boolean;
  };
  snapshot: {
    totalPlayers: number;
    newToday: number;
    active24h: number;
    active7d: number;
    active30d: number;
    activeRate7dBps: number;
    registeredInRange: number;
    activatedInRange: number;
    activationRateBps: number;
    dormant30d: number;
  };
  acquisition: {
    total: number;
    direct: number;
    shareLink: number;
    manualCode: number;
    blocked: number;
  };
  activity: {
    activePlayersInRange: number;
    averageDailyActive: number;
    peakDailyActive: number;
    peakDay: string | null;
    productionParticipantsInRange: number;
    tradeParticipantsInRange: number;
  };
  retention: {
    d1: AdminPlayerStatisticsRetentionRow;
    d7: AdminPlayerStatisticsRetentionRow;
    d30: AdminPlayerStatisticsRetentionRow;
  };
  funnel: {
    stages: AdminPlayerStatisticsFunnelStage[];
    retained7d: AdminPlayerStatisticsRetentionRow;
  };
  participation: {
    active7d: number;
    rows: AdminPlayerStatisticsParticipationRow[];
  };
  wealth: {
    total: number;
    average: number;
    median: number;
    p25: number;
    p75: number;
    p90: number;
    p99: number;
    top1ShareBps: number;
    top10ShareBps: number;
    frozenShareBps: number;
    unpricedAssetPlayers: number;
    composition: {
      cash: number;
      commodities: number;
      facilities: number;
      frozen: number;
      total: number;
    };
    brackets: Array<{ id: string; label: string; count: number }>;
  };
  attention: AdminPlayerStatisticsAttention[];
  series: AdminPlayerStatisticsSeriesPoint[];
}

export interface PopulationPolicyPayload {
  stabilizationShareBps: number;
  targetWalletCycles: number;
  refillCapBps: number;
  productionWageMultiplierBps: number;
  modelMultipliersBps: Record<PopulationModelId, number>;
  durationCycles: number;
}

export interface PopulationPolicyMutationResponse {
  policy: PopulationPolicy;
  populationEconomy: PopulationEconomyAdminSummary;
  revision: number;
}

export interface PopulationTopUpResponse extends PopulationPolicyMutationResponse {
  targetModel: PopulationModelId | 'all';
  currentCycleId: number;
  issuedByModel: Record<PopulationModelId, number>;
  issuedTotal: number;
}

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
  playerStatistics: async (range: AdminPlayerStatisticsRange) => (
    await request<{ playerStatistics: AdminPlayerStatistics }>(
      `/player-statistics?range=${encodeURIComponent(range)}`,
      { method: 'GET' },
    )
  ).playerStatistics,
  populationEconomy: async () => (
    await request<{ summary: ExtendedAdminSummary }>('/population-economy', { method: 'GET' })
  ).summary,
  updatePopulationPolicy: (payload: PopulationPolicyPayload, idempotencyKey?: string) => request<PopulationPolicyMutationResponse>(
    '/population-economy/policy',
    { method: 'PUT', body: JSON.stringify(payload) },
    idempotencyKey,
  ),
  resetPopulationPolicy: (idempotencyKey?: string) => request<PopulationPolicyMutationResponse>(
    '/population-economy/policy/reset',
    { method: 'POST', body: JSON.stringify({}) },
    idempotencyKey,
  ),
  topUpPopulation: (
    targetModel: PopulationModelId | 'all',
    idempotencyKey?: string,
  ) => request<PopulationTopUpResponse>(
    '/population-economy/top-up',
    { method: 'POST', body: JSON.stringify({ targetModel }) },
    idempotencyKey,
  ),
  communityLink: async () => (
    await request<{ communityLink: CommunityLinkConfig }>('/community-link', { method: 'GET' })
  ).communityLink,
  updateCommunityLink: async (qqGroupUrl: string) => (
    await request<{ communityLink: CommunityLinkConfig }>('/community-link', {
      method: 'PUT',
      body: JSON.stringify({ qqGroupUrl }),
    })
  ).communityLink,
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
