import { GameApiError, type GameActionResponse } from '../api/game';
import type {
  ContractAuditDetail,
  ContractAuditHistoryPage,
  ContractPerformanceSummary,
  ContractKind,
  ProductionContractRole,
  ProductionContractStatus,
  SupplyPriorityCondition,
} from './types';

const GAME_API_BASE = '/economy-api/game';
const WRITE_TIMEOUT_MS = 12_000;
const READ_TIMEOUT_MS = 12_000;

export interface CreateSupplyContractInput {
  kind?: 'supply';
  publisherRole: ProductionContractRole;
  provinceId?: string;
  productId: string;
  dailyMaxQuantity?: number;
  unitPrice: number;
  durationDays?: number | null;
  startDelayDays?: number;
  /** Legacy finite-batch compatibility. */
  quantityPerDelivery?: number;
  deliveryIntervalMs?: number;
  totalDeliveries?: number | null;
  firstDeliveryDelayMs?: number;
}
export interface CreateLoanContractInput {
  kind: 'loan';
  publisherSide: 'lender' | 'borrower';
  provinceId: string;
  principal: number;
  interestRateBps: number;
  termDays?: number;
  /** Legacy UI compatibility; new UI sends termDays. */
  termMs?: number;
  facilityTypeId: string;
  collateralQuantity: number;
}
export interface CreateFacilityLeaseContractInput {
  kind: 'facility_lease';
  publisherSide: 'lessor' | 'lessee';
  provinceId: string;
  facilityTypeId: string;
  quantity: number;
  rentPerPeriod: number;
  periodDays?: number;
  /** Legacy UI compatibility; new UI sends periodDays. */
  periodMs?: number;
  totalPeriods: number;
  firstPeriodDelayDays?: number;
  firstPeriodDelayMs?: number;
}
export type CreateProductionContractInput = CreateSupplyContractInput | CreateLoanContractInput | CreateFacilityLeaseContractInput;
export interface RenewProductionContractInput {
  quantityPerDelivery: number;
  unitPrice: number;
  deliveryIntervalMs: number;
  totalDeliveries: number | null;
  firstDeliveryDelayMs: number;
}
export type SupplyNegotiationTermsInput = {
  dailyMaxQuantity?: number;
  unitPrice: number;
  durationDays?: number | null;
  startDelayDays?: number;
  /** Legacy page compatibility. */
  quantityPerDelivery?: number;
  deliveryIntervalMs?: number;
  totalDeliveries?: number | null;
  firstDeliveryDelayMs?: number;
};

export interface ContractHistoryQuery {
  cursor?: string | null;
  limit?: number;
  status?: ProductionContractStatus | '';
  kind?: ContractKind | '';
  productId?: string;
  role?: 'any' | 'publisher' | 'buyer' | 'supplier' | 'lender' | 'borrower' | 'lessor' | 'lessee';
  from?: number | null;
  to?: number | null;
}

function requestKey() {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `contract-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
async function readError(response: Response, fallback: string) {
  try { const payload = await response.json() as { message?: string }; return payload.message || fallback; }
  catch { return fallback; }
}
async function post(path: string, body: unknown = {}): Promise<GameActionResponse> {
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), WRITE_TIMEOUT_MS);
  try {
    const response = await fetch(`${GAME_API_BASE}${path}`, {
      method: 'POST', credentials: 'include', signal: controller.signal,
      headers: { 'Content-Type': 'application/json', 'Idempotency-Key': requestKey() },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new GameApiError(response.status, await readError(response, '合同操作失败'));
    return await response.json() as GameActionResponse;
  } catch (reason) {
    if (reason instanceof Error && reason.name === 'AbortError') throw new GameApiError(408, '合同操作超时，请稍后重试');
    throw reason;
  } finally { globalThis.clearTimeout(timeout); }
}
async function getJson<T>(path: string, search?: URLSearchParams): Promise<T> {
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), READ_TIMEOUT_MS);
  try {
    const query = search && search.size > 0 ? `?${search.toString()}` : '';
    const response = await fetch(`${GAME_API_BASE}${path}${query}`, { method: 'GET', credentials: 'include', signal: controller.signal, headers: { Accept: 'application/json' } });
    if (!response.ok) throw new GameApiError(response.status, await readError(response, '合同审计读取失败'));
    return await response.json() as T;
  } catch (reason) {
    if (reason instanceof Error && reason.name === 'AbortError') throw new GameApiError(408, '合同审计读取超时，请稍后重试');
    throw reason;
  } finally { globalThis.clearTimeout(timeout); }
}
function contractPath(contractId: string, action: string) { return `/contracts/${encodeURIComponent(contractId)}/${action}`; }

export const productionContractActions = {
  create: (input: CreateProductionContractInput) => post('/contracts', input),
  accept: (contractId: string) => post(contractPath(contractId, 'accept')),
  proposeNegotiation: (contractId: string, input: SupplyNegotiationTermsInput) => post(contractPath(contractId, 'negotiations'), input),
  counterNegotiation: (contractId: string, negotiationId: string, input: SupplyNegotiationTermsInput) => post(`${contractPath(contractId, 'negotiations')}/${encodeURIComponent(negotiationId)}/counter`, input),
  acceptNegotiation: (contractId: string, negotiationId: string) => post(`${contractPath(contractId, 'negotiations')}/${encodeURIComponent(negotiationId)}/accept`),
  rejectNegotiation: (contractId: string, negotiationId: string) => post(`${contractPath(contractId, 'negotiations')}/${encodeURIComponent(negotiationId)}/reject`),
  revokeNegotiation: (contractId: string, negotiationId: string) => post(`${contractPath(contractId, 'negotiations')}/${encodeURIComponent(negotiationId)}/revoke`),
  cancel: (contractId: string) => post(contractPath(contractId, 'cancel')),
  prepare: (contractId: string) => post(contractPath(contractId, 'prepare')),
  fund: (contractId: string) => post(contractPath(contractId, 'fund')),
  setAutoReserve: (contractId: string, enabled: boolean, prioritySupply?: SupplyPriorityCondition) => post(contractPath(contractId, 'auto-reserve'), { enabled, ...(prioritySupply ? { prioritySupply } : {}) }),
  setAutoFund: (contractId: string, enabled: boolean) => post(contractPath(contractId, 'auto-fund'), { enabled }),
  requestTermination: (contractId: string) => post(contractPath(contractId, 'request-termination')),
  terminateNow: (contractId: string) => post(contractPath(contractId, 'terminate-now')),
  repayLoan: (contractId: string) => post(contractPath(contractId, 'repay')),
  setLoanAutoRepay: (contractId: string, enabled: boolean) => post(contractPath(contractId, 'auto-repay'), { enabled }),
  fundLease: (contractId: string) => post(contractPath(contractId, 'lease-fund')),
  setLeaseAutoFund: (contractId: string, enabled: boolean) => post(contractPath(contractId, 'lease-auto-fund'), { enabled }),
  proposeRenewal: (contractId: string, input: RenewProductionContractInput) => post(`${contractPath(contractId, 'renewal')}/propose`, input),
  acceptRenewal: (contractId: string) => post(`${contractPath(contractId, 'renewal')}/accept`),
  rejectRenewal: (contractId: string) => post(`${contractPath(contractId, 'renewal')}/reject`),
  revokeRenewal: (contractId: string) => post(`${contractPath(contractId, 'renewal')}/revoke`),
};

export const productionContractAudit = {
  performance: async () => (await getJson<{ performance: ContractPerformanceSummary }>('/contracts/performance')).performance,
  history: async (query: ContractHistoryQuery = {}) => {
    const search = new URLSearchParams();
    if (query.cursor) search.set('cursor', query.cursor);
    if (query.limit) search.set('limit', String(query.limit));
    if (query.status) search.set('status', query.status);
    if (query.kind) search.set('kind', query.kind);
    if (query.productId) search.set('productId', query.productId);
    if (query.role && query.role !== 'any') search.set('role', query.role);
    if (query.from) search.set('from', String(query.from));
    if (query.to) search.set('to', String(query.to));
    const payload = await getJson<{ history: ContractAuditHistoryPage }>('/contracts/history', search);
    return payload.history;
  },
  detail: async (contractId: string, cursor?: string | null, limit = 100) => {
    const search = new URLSearchParams({ limit: String(limit) });
    if (cursor) search.set('cursor', cursor);
    const payload = await getJson<{ audit: ContractAuditDetail }>(`/contracts/${encodeURIComponent(contractId)}/audit`, search);
    return payload.audit;
  },
};
