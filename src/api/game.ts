import { installIdempotentGameWriteFetch } from './idempotentGameWriteFetch';
import { GameWriteUnconfirmedError, isUnconfirmedWriteStatus, WRITE_RESULT_UNCONFIRMED, WRITE_RESULT_UNCONFIRMED_MESSAGE } from './gameWriteConfirmation';
import type { AssetKind, EconomyState, MarketDetail, OrderSide, TransportModeId, TransportTripType } from '../types';
import type { AuctionBidHistory, AuctionItem } from '../auctions/types';
import type { FacilityBuildProcurementQuote } from '../utils/facilityBuildProcurement';
import {
  createStateDeliveryCache,
  StateDeliveryIntegrityError,
  type StateDeliveryEnvelope,
  type StatePartitionPatches,
  type StatePartitionRevisions,
} from '../app/stateDelivery.js';
import { acceptServerNow, resetServerClock } from '../utils/serverClock.js';
import { createClientProductionSettlementClaim } from '../utils/productionSettlement';
import type { ProductionSettlementClaim } from '../../shared/production-settlement.js';

const GAME_API_BASE = '/economy-api/game';
const PAGE_SAVE_EPOCH_STALE_MESSAGE = '当前存档已变化，请刷新页面后继续操作';
const SAVE_EPOCH_NOT_READY_MESSAGE = '当前存档世代正在同步，请稍后重试';
let pageSaveUserId: number | null = null;
let pageSaveEpoch: number | null = null;
let pageSaveEpochStaleMessage = '';
let pendingProductionSettlement: ProductionSettlementClaim | null = null;
let suppressedProductionSettlementBasisId: string | null = null;
const DEFAULT_READ_TIMEOUT_MS = 8_000;
const NETWORK_ERROR_MESSAGE = '无法连接服务器，客户端或服务器可能已经更新，请刷新页面后重试';
const marketDetailCache = new Map<string, MarketDetail>();

function rememberMarketDetail(key: string, detail: MarketDetail) {
  marketDetailCache.delete(key);
  marketDetailCache.set(key, detail);
  while (marketDetailCache.size > 32) {
    const oldestKey = marketDetailCache.keys().next().value;
    if (typeof oldestKey !== 'string') break;
    marketDetailCache.delete(oldestKey);
  }
  return detail;
}

export class SaveEpochPageMismatchError extends Error {
  readonly code = 'SAVE_EPOCH_PAGE_MISMATCH';
  constructor(message = PAGE_SAVE_EPOCH_STALE_MESSAGE) {
    super(message);
    this.name = 'SaveEpochPageMismatchError';
  }
}

function markPageSaveEpochStale(message = PAGE_SAVE_EPOCH_STALE_MESSAGE) {
  pageSaveEpochStaleMessage = message || PAGE_SAVE_EPOCH_STALE_MESSAGE;
}

function validatePageSaveEpoch(state: EconomyState) {
  const userId = Number(state.userId);
  const saveEpoch = Number(state.saveEpoch);
  if (!Number.isSafeInteger(userId) || userId < 1) {
    throw new StateDeliveryIntegrityError('服务器未返回有效的玩家身份');
  }
  if (!Number.isSafeInteger(saveEpoch) || saveEpoch < 0) {
    throw new StateDeliveryIntegrityError('服务器未返回有效的存档世代');
  }

  if (pageSaveUserId === null || pageSaveUserId !== userId) {
    pageSaveUserId = userId;
    pageSaveEpoch = saveEpoch;
    pageSaveEpochStaleMessage = '';
    suppressedProductionSettlementBasisId = null;
    return;
  }
  if (pageSaveEpoch === null) {
    pageSaveEpoch = saveEpoch;
    return;
  }
  if (pageSaveEpochStaleMessage) {
    throw new SaveEpochPageMismatchError(pageSaveEpochStaleMessage);
  }
  if (pageSaveEpoch !== saveEpoch) {
    const message = `当前存档已变化（页面世代 ${pageSaveEpoch}，服务器世代 ${saveEpoch}），请刷新页面后继续操作`;
    markPageSaveEpochStale(message);
    throw new SaveEpochPageMismatchError(message);
  }
}

const stateDeliveryCache = createStateDeliveryCache({ validateState: validatePageSaveEpoch });

function requiredPageSaveEpoch() {
  if (pageSaveEpochStaleMessage) {
    throw new SaveEpochPageMismatchError(pageSaveEpochStaleMessage);
  }
  if (!Number.isSafeInteger(pageSaveEpoch) || Number(pageSaveEpoch) < 0) {
    throw new GameApiError(409, SAVE_EPOCH_NOT_READY_MESSAGE, 'SAVE_EPOCH_NOT_READY');
  }
  return Number(pageSaveEpoch);
}

function productionSettlementClaimForState(
  state: EconomyState | undefined,
  serverNow: number,
) {
  const claim = createClientProductionSettlementClaim(state, serverNow);
  if (!claim) return null;
  const basisId = String(claim.basisId || '');
  if (suppressedProductionSettlementBasisId && basisId === suppressedProductionSettlementBasisId) {
    return null;
  }
  if (suppressedProductionSettlementBasisId && basisId !== suppressedProductionSettlementBasisId) {
    suppressedProductionSettlementBasisId = null;
  }
  return claim;
}

export function getPageSaveEpochErrorMessage() {
  return pageSaveEpochStaleMessage;
}

export function resetGameStateDelivery() {
  stateDeliveryCache.reset();
  marketDetailCache.clear();
  pendingProductionSettlement = null;
  resetServerClock();
}

export function resetGameSession() {
  pageSaveUserId = null;
  pageSaveEpoch = null;
  pageSaveEpochStaleMessage = '';
  suppressedProductionSettlementBasisId = null;
  resetGameStateDelivery();
}

export const DEFAULT_QQ_GROUP_URL = 'https://qm.qq.com/q/eN8hya0Yn0';

export interface GameActionResult { ok: boolean; message: string; code?: string; }
export interface GameActionResponse {
  result: GameActionResult;
  revision: number;
}
export type FacilityBuildProcurementActionResult = GameActionResult;
export type FacilityBuildProcurementActionResponse = GameActionResponse;
export interface OnlineAutoSellPolicyInput {
  enabled: boolean;
  price: number;
  minimumFreeInventory: number;
}
export interface OnlineAutoBuyPolicyInput {
  enabled: boolean;
  maxPrice: number;
  targetFreeInventory: number;
}
export interface OnlineAutoTradePolicyInput {
  buy: OnlineAutoBuyPolicyInput;
  sell: OnlineAutoSellPolicyInput;
}
export type FactoryAutoOperationMode = 'profit' | 'balanced' | 'supply';
export type FactoryAutoOperationOutputMode = 'surplus' | 'keep';
export interface FactoryAutoOperationPolicyInput {
  enabled: boolean;
  inputCoverageCycles: 1 | 2 | 3 | 5;
  mode: FactoryAutoOperationMode;
  outputMode: FactoryAutoOperationOutputMode;
}
export interface TransportRouteInput {
  sourceProvinceId: string;
  destinationProvinceId: string;
  viaProvinceIds?: string[];
  tripType?: TransportTripType;
  mode: TransportModeId;
}
export interface TransportCargoRequestItem {
  productId: string;
  quantity: number;
}
export interface FacilityBuildProcurementOptions {
  autoProcure: true;
  maxProcurementTotal: number;
  materialPriceCaps: Record<string, number>;
}
export interface SaveDeletionBlocker {
  type: string;
  message: string;
  targetTab?: 'market' | 'auction' | 'contracts' | 'bank' | 'settings';
}
export interface SaveDeletionPreflight {
  allowed: boolean;
  blockers: SaveDeletionBlocker[];
  autoClose: {
    orders: number;
    facilityListings: number;
    auctions: number;
    contracts: number;
  };
  saveEpoch: number;
  checkedAt: number;
  revision: number;
}
export interface SaveDeletionResponse extends GameActionResponse {
  saveEpoch: number;
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
  creditsPerGem?: number;
  dateKey?: string;
  createdAt: number;
}
export interface GemShopRateRecord {
  dateKey: string;
  creditsPerGem: number;
  demandTone: 'high' | 'neutral' | 'low' | 'returning';
}
export interface GemShopSummary {
  gems: number;
  credits: number;
  quoteDateKey?: string;
  creditsPerGem: number;
  previousCreditsPerGem?: number;
  rateDelta?: number;
  nextRateAt?: number;
  demandTone?: 'high' | 'neutral' | 'low' | 'returning';
  demandPressurePpm?: number;
  quoteDecision?: 'pending' | 'accepted' | 'rejected';
  quoteDecisionAt?: number | null;
  minExchangeGems: number;
  maxExchangeGems: number;
  maxExchangeableGems: number;
  totalGemsSpent: number;
  totalCreditsReceived: number;
  recentExchanges: GemShopExchangeRecord[];
  recentRates?: GemShopRateRecord[];
}
export interface CommunityLinkConfig {
  qqGroupUrl: string;
  updatedAt: number | null;
}

export type { StatePartitionPatches, StatePartitionRevisions };

export class GameApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, message: string, code = '') {
    super(message);
    this.name = 'GameApiError';
    this.status = status;
    this.code = code;
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

function isBrowserNetworkError(reason: unknown) {
  if (reason instanceof TypeError) return true;
  if (!(reason instanceof Error)) return false;
  return /failed to fetch|load failed|networkerror|network request failed/i.test(reason.message);
}

function knownPartitionRevisions() {
  return stateDeliveryCache.getPartitionRevisions();
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
  if (init?.method && init.method !== 'GET') {
    headers.set('Idempotency-Key', createRequestKey());
    if (path !== '/session') {
      headers.set('X-Economy-Save-Epoch', String(requiredPageSaveEpoch()));
    }
  }
  const isWrite = Boolean(init?.method && init.method !== 'GET' && init.method !== 'HEAD');
  let manualCommodity = false;
if (isWrite && path === '/orders' && typeof init?.body === 'string') {
  try {
    const body = JSON.parse(init.body);
    manualCommodity = body?.assetKind === 'commodity' && !body.execution
      && (body.side === 'buy' || body.side === 'sell');
  } catch { /* Let the server reject an invalid request body. */ }
}
if (isWrite) installIdempotentGameWriteFetch();
  const timedSignal = isWrite ? null : createTimedSignal(init?.signal, DEFAULT_READ_TIMEOUT_MS);
  try {
    const response = await fetch(`${GAME_API_BASE}${path}`, {
      ...init,
      credentials: 'include',
      headers,
      signal: timedSignal?.signal ?? init?.signal,
    });
    if (!response.ok) {
      let message = '游戏服务器请求失败';
      let code = '';
      try {
        const payload = (await response.json()) as { message?: string; code?: string };
        if (payload.message) message = payload.message;
        code = String(payload.code || '');
      } catch { /* preserve generic message */ }
      if (code === 'SAVE_EPOCH_MISMATCH') {
        markPageSaveEpochStale(message);
        throw new SaveEpochPageMismatchError(message);
      }
      if (manualCommodity && isUnconfirmedWriteStatus(response.status)) {
        throw new GameApiError(response.status, WRITE_RESULT_UNCONFIRMED_MESSAGE, WRITE_RESULT_UNCONFIRMED);
      }
      throw new GameApiError(response.status, message, code);
    }
    const payload = await response.json() as unknown;
    if ((path === '/state' || path.startsWith('/state?')) && isStateDeliveryPayload(payload)) {
      acceptServerNow(payload.serverNow);
      const accepted = stateDeliveryCache.accept(payload);
      return accepted as T;
    }
    return payload as T;
  } catch (reason) {
    if (reason instanceof GameWriteUnconfirmedError) {
      throw new GameApiError(408, reason.message, reason.code);
    }
    if ((timedSignal?.didTimeout() || (isWrite && !init?.signal?.aborted))
      && reason instanceof Error && reason.name === 'AbortError') {
      throw new GameApiError(408, '游戏服务器响应超时，请稍后重试');
    }
    if (isBrowserNetworkError(reason)) {
      throw new GameApiError(0, NETWORK_ERROR_MESSAGE);
    }
    throw reason;
  } finally {
    timedSignal?.cleanup();
  }
}

async function postAction(path: string, body: Record<string, unknown> = {}) {
  const manualCommodity = path === '/orders' && body.assetKind === 'commodity' && !body.execution
    && (body.side === 'buy' || body.side === 'sell');
  const requestBody = { ...body };
  // Manual commodity prices are server-owned. Omit volatile preview fields so a
  // pending intent stays identical across polls, price rollover and page reload.
  if (manualCommodity) { delete requestBody.price; delete requestBody.productionSettlement; }
  const claim = manualCommodity ? null : pendingProductionSettlement;
  const payload = claim ? { ...requestBody, productionSettlement: claim } : requestBody;
  try {
    const response = await request<GameActionResponse>(path, { method: 'POST', body: JSON.stringify(payload) });
    pendingProductionSettlement = null;
    return response;
  } catch (reason) {
    if (claim && reason instanceof GameApiError && reason.code.startsWith('PRODUCTION_SETTLEMENT_')) {
      pendingProductionSettlement = null;
    }
    throw reason;
  }
}

async function fetchGameStateOnce(revision?: number | null, signal?: AbortSignal) {
  const params = new URLSearchParams();
  if (Number.isInteger(revision)) params.set('revision', String(revision));
  for (const [name, value] of Object.entries(knownPartitionRevisions())) {
    if (value) params.set(name, value);
  }
  const query = params.toString();
  const suffix = query ? `?${query}` : '';
  return request<GameStatePollResponse>(`/state${suffix}`, { method: 'GET', signal });
}

async function fetchGameStateWithRecovery(revision?: number | null, signal?: AbortSignal) {
  try {
    return await fetchGameStateOnce(revision, signal);
  } catch (reason) {
    if (reason instanceof SaveEpochPageMismatchError) {
      resetGameStateDelivery();
      throw reason;
    }
    if (!(reason instanceof StateDeliveryIntegrityError)) throw reason;
    resetGameStateDelivery();
    try {
      return await fetchGameStateOnce(undefined, signal);
    } catch (retryReason) {
      if (retryReason instanceof SaveEpochPageMismatchError) {
        resetGameStateDelivery();
        throw retryReason;
      }
      if (retryReason instanceof StateDeliveryIntegrityError) {
        throw new GameApiError(
          502,
          `服务器状态同步异常：${retryReason.message}`,
          retryReason.code,
        );
      }
      throw retryReason;
    }
  }
}

export async function getGameState(revision?: number | null, signal?: AbortSignal): Promise<GameStatePollResponse> {
  if (!Number.isInteger(revision)) resetGameStateDelivery();
  let response = await fetchGameStateWithRecovery(revision, signal);
  pendingProductionSettlement = productionSettlementClaimForState(
    response.state,
    Number(response.serverNow),
  );
  if (!pendingProductionSettlement) return response;

  const attemptedClaim = pendingProductionSettlement;
  try {
    const settlement = await postAction('/production/settle');
    suppressedProductionSettlementBasisId = null;
    if (settlement.revision !== response.revision) {
      response = await fetchGameStateWithRecovery(response.revision, signal);
    }
    pendingProductionSettlement = productionSettlementClaimForState(
      response.state,
      Number(response.serverNow),
    );
    return response;
  } catch (reason) {
    pendingProductionSettlement = null;
    if (reason instanceof SaveEpochPageMismatchError) throw reason;
    if (reason instanceof GameApiError && reason.code.startsWith('PRODUCTION_SETTLEMENT_')) {
      const basisId = String(attemptedClaim?.basisId || '');
      if (basisId) suppressedProductionSettlementBasisId = basisId;
      return response;
    }
    throw reason;
  }
}

export async function getMarketDetail(
  provinceId: string,
  assetKind: AssetKind,
  assetId: string,
  signal?: AbortSignal,
): Promise<MarketDetail> {
  const key = `${provinceId}:${assetKind}:${assetId}`;
  const cached = marketDetailCache.get(key);
  const search = new URLSearchParams({ provinceId, assetKind, assetId });
  if (cached?.revision) search.set('revision', cached.revision);
  const payload = await request<{
    revision: number;
    serverNow: number;
    marketDetailRevision: string;
    unchanged: boolean;
    marketDetail?: MarketDetail;
  }>(`/market-detail?${search.toString()}`, { method: 'GET', signal });
  acceptServerNow(Number(payload.serverNow));
  if (payload.unchanged && cached) return rememberMarketDetail(key, cached);
  if (!payload.marketDetail) {
    throw new GameApiError(502, '服务器未返回市场详情', 'MARKET_DETAIL_MISSING');
  }
  return rememberMarketDetail(key, payload.marketDetail);
}

export async function getFacilityBuildProcurementQuote(
  provinceId: string,
  facilityTypeId: string,
  quantity: number,
  signal?: AbortSignal,
): Promise<FacilityBuildProcurementQuote> {
  const search = new URLSearchParams({
    provinceId,
    facilityTypeId,
    quantity: String(quantity),
  });
  const payload = await request<{
    revision: number;
    serverNow: number;
    quote: FacilityBuildProcurementQuote;
  }>(`/facility-build-quote?${search.toString()}`, { method: 'GET', signal });
  acceptServerNow(Number(payload.serverNow));
  return payload.quote;
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
  const payload = await request<{ communityLink: CommunityLinkConfig }>(
    '/community-link',
    { method: 'GET', signal },
  );
  return payload.communityLink;
}

export async function getAuctionBidHistory(auctionId: string, signal?: AbortSignal): Promise<AuctionBidHistory> {
  const payload = await request<{ history: AuctionBidHistory }>(
    `/auctions/${encodeURIComponent(auctionId)}/bids`,
    { method: 'GET', signal },
  );
  return payload.history;
}

export async function getSaveDeletionPreflight(signal?: AbortSignal): Promise<SaveDeletionPreflight> {
  const payload = await request<{ preflight: SaveDeletionPreflight }>(
    '/save-deletion/preflight',
    { method: 'GET', signal },
  );
  return payload.preflight;
}

export async function deleteGameSave(confirmation: string): Promise<SaveDeletionResponse> {
  return request<SaveDeletionResponse>('/save-deletion', {
    method: 'POST',
    body: JSON.stringify({ confirmation }),
  });
}

export function saveOnlineAutoSellPolicy(provinceId: string, productId: string, policy: OnlineAutoSellPolicyInput) {
  return postAction('/orders', {
    provinceId,
    assetKind: 'commodity',
    assetId: productId,
    productId,
    execution: 'online-auto-sell-policy',
    enabled: policy.enabled,
    price: policy.price,
    minimumFreeInventory: policy.minimumFreeInventory,
  });
}

export function saveOnlineAutoTradePolicy(provinceId: string, productId: string, policy: OnlineAutoTradePolicyInput) {
  return postAction('/orders', {
    provinceId,
    assetKind: 'commodity',
    assetId: productId,
    productId,
    execution: 'online-auto-trade-policy',
    buy: policy.buy,
    sell: policy.sell,
  });
}

export function saveFactoryAutoOperationPolicy(
  provinceId: string,
  facilityTypeId: string,
  policy: FactoryAutoOperationPolicyInput,
) {
  return postAction('/orders', {
    provinceId,
    assetKind: 'facility',
    assetId: facilityTypeId,
    facilityTypeId,
    execution: 'factory-auto-operation-policy',
    policy,
  });
}

export function saveProvinceAutoSalePolicy(provinceId: string, enabled: boolean) {
  return postAction('/orders', {
    provinceId,
    execution: 'factory-auto-operation-policy',
    operation: 'province-auto-sale',
    enabled,
  });
}

export function importLegacyOnlineAutoSellPolicies(policies: Record<string, OnlineAutoSellPolicyInput>) {
  return postAction('/orders', {
    execution: 'online-auto-sell-policy',
    legacyImport: true,
    policies,
  });
}

export function createFacilityBuildProcurement(
  provinceId: string,
  facilityTypeId: string,
  quantity: number,
  materialOrderPrices: Record<string, number>,
) {
  return request<FacilityBuildProcurementActionResponse>('/orders', {
    method: 'POST',
    body: JSON.stringify({
      execution: 'facility-build-procurement',
      provinceId,
      facilityTypeId,
      quantity,
      materialOrderPrices,
    }),
  });
}

export function cancelFacilityBuildProcurement(orderIds: string[]) {
  return postAction('/orders', {
    execution: 'facility-build-procurement-cancel',
    orderIds,
  });
}

export function updatePlayerAvatar(avatarData: string) {
  return request<GameActionResponse>('/profile', {
    method: 'PATCH',
    body: JSON.stringify({ avatarData }),
  });
}

export const gameActions = {
  checkIn: () => postAction('/check-in'),
  createTransportRoute: (input: TransportRouteInput) => postAction('/transport', {
    operation: 'route-create',
    ...input,
  }),
  updateTransportRoute: (routeId: string, input: TransportRouteInput) => postAction('/transport', {
    operation: 'route-update',
    routeId,
    ...input,
  }),
  renameTransportRoute: (routeId: string, name: string) => postAction('/transport', {
    operation: 'route-rename',
    routeId,
    name,
  }),
  deleteTransportRoute: (routeId: string) => postAction('/transport', {
    operation: 'route-delete',
    routeId,
  }),
  startTransportCycle: (routeId: string, load: TransportCargoRequestItem[]) => postAction('/transport', {
    operation: 'cycle-start',
    routeId,
    load,
  }),
  serviceTransportNode: (
    routeId: string,
    cycleId: string,
    visitIndex: number,
    unload: TransportCargoRequestItem[],
    load: TransportCargoRequestItem[],
  ) => postAction('/transport', {
    operation: 'node-service',
    routeId,
    cycleId,
    visitIndex,
    unload,
    load,
  }),
  bankDeposit: (amount: number) => postAction('/bank/deposits', { amount }),
  bankWithdraw: (amount: number) => postAction('/bank/withdrawals', { amount }),
  bankBorrow: (amount: number, collateral: Array<{ provinceId: string; facilityTypeId: string; quantity: number }>, autoRepay = true) => (
    postAction('/bank/loans', { amount, collateral, autoRepay })
  ),
  bankRepay: (loanId: string, amount: number | 'all') => (
    postAction(`/bank/loans/${encodeURIComponent(loanId)}/repay`, { amount })
  ),
  bankSetAutoRepay: (loanId: string, enabled: boolean) => (
    postAction(`/bank/loans/${encodeURIComponent(loanId)}/auto-repay`, { enabled })
  ),
  buildFacility: (provinceId: string, facilityTypeId: string, quantity = 1, procurement?: FacilityBuildProcurementOptions) => (
    postAction('/facilities', { provinceId, facilityTypeId, quantity, ...procurement })
  ),
  startResearch: (technologyId: string) => postAction('/research/start', { technologyId }),
  accelerateResearch: () => postAction('/research/accelerate'),
  startFacility: (provinceId: string, facilityTypeId: string) => postAction(`/facilities/${encodeURIComponent(facilityTypeId)}/start`, { provinceId }),
  stopFacility: (provinceId: string, facilityTypeId: string) => postAction(`/facilities/${encodeURIComponent(facilityTypeId)}/stop`, { provinceId }),
  pauseFacility: (provinceId: string, facilityTypeId: string) => postAction(`/facilities/${encodeURIComponent(facilityTypeId)}/pause`, { provinceId }),
  setFacilityRecipe: (provinceId: string, facilityTypeId: string, recipeId: string) => (
    postAction(`/facilities/${encodeURIComponent(facilityTypeId)}/recipe`, { provinceId, recipeId })
  ),
  setFacilityRecipes: (targets: Array<{ provinceId: string; facilityTypeId: string; recipeId: string }>) => (
    postAction('/facilities/recipes', { targets })
  ),
  placeAssetOrder: (provinceId: string, assetKind: AssetKind, assetId: string, side: OrderSide, quantity: number, price: number) => (
    postAction('/orders', {
      provinceId,
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
  autoBuyCommodity: (provinceId: string, productId: string, maxPrice: number, targetFreeInventory = 0) => (
    postAction('/orders', {
      provinceId,
      assetKind: 'commodity',
      assetId: productId,
      productId,
      side: 'buy',
      price: maxPrice,
      targetFreeInventory,
      execution: 'online-auto-buy',
    })
  ),
  autoSellCommodity: (provinceId: string, productId: string, price: number, minimumFreeInventory = 0) => (
    postAction('/orders', {
      provinceId,
      assetKind: 'commodity',
      assetId: productId,
      productId,
      side: 'sell',
      price,
      minimumFreeInventory,
      execution: 'online-auto-sell',
    })
  ),
  cancelOrder: (orderId: string) => postAction(`/orders/${encodeURIComponent(orderId)}/cancel`),
  createAuction: (items: AuctionItem[], startingBid: number, reservePrice: number | null, durationHours: number) => (
    postAction('/auctions', { items, startingBid, reservePrice, durationHours })
  ),
  placeAuctionBid: (auctionId: string, amount: number) => (
    postAction(`/auctions/${encodeURIComponent(auctionId)}/bids`, { amount })
  ),
  cancelAuction: (auctionId: string) => (
    postAction(`/auctions/${encodeURIComponent(auctionId)}/cancel`)
  ),
  renamePlayer: (playerName: string) => request<GameActionResponse>('/profile', {
    method: 'PATCH',
    body: JSON.stringify({ playerName }),
  }),
  redeemGift: (code: string) => postAction('/gifts/redeem', { code }),
  exchangeGems: (gems: number) => postAction('/gem-shop/exchange', { gems }),
  rejectGemShopQuote: () => postAction('/gem-shop/quote/reject'),
};