import { GameApiError, type GameActionResponse } from '../api/game';
import type { ProductionContractRole } from './types';

const GAME_API_BASE = '/economy-api/game';
const WRITE_TIMEOUT_MS = 12_000;

export interface CreateProductionContractInput {
  publisherRole: ProductionContractRole;
  productId: string;
  quantityPerDelivery: number;
  unitPrice: number;
  deliveryIntervalMs: number;
  totalDeliveries: number;
  firstDeliveryDelayMs: number;
}

function requestKey() {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `contract-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function post(path: string, body: Record<string, unknown> = {}): Promise<GameActionResponse> {
  const controller = new AbortController();
  const timeout = globalThis.setTimeout(() => controller.abort(), WRITE_TIMEOUT_MS);
  try {
    const response = await fetch(`${GAME_API_BASE}${path}`, {
      method: 'POST',
      credentials: 'include',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': requestKey(),
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      let message = '合同操作失败';
      try {
        const payload = await response.json() as { message?: string };
        if (payload.message) message = payload.message;
      } catch {
        // Preserve the generic message when the server did not return JSON.
      }
      throw new GameApiError(response.status, message);
    }
    return await response.json() as GameActionResponse;
  } catch (reason) {
    if (reason instanceof Error && reason.name === 'AbortError') {
      throw new GameApiError(408, '合同操作超时，请稍后重试');
    }
    throw reason;
  } finally {
    globalThis.clearTimeout(timeout);
  }
}

function contractPath(contractId: string, action: string) {
  return `/contracts/${encodeURIComponent(contractId)}/${action}`;
}

export const productionContractActions = {
  create: (input: CreateProductionContractInput) => post('/contracts', input),
  accept: (contractId: string) => post(contractPath(contractId, 'accept')),
  cancel: (contractId: string) => post(contractPath(contractId, 'cancel')),
  prepare: (contractId: string) => post(contractPath(contractId, 'prepare')),
  fund: (contractId: string) => post(contractPath(contractId, 'fund')),
  setAutoReserve: (contractId: string, enabled: boolean) => post(contractPath(contractId, 'auto-reserve'), { enabled }),
  setAutoFund: (contractId: string, enabled: boolean) => post(contractPath(contractId, 'auto-fund'), { enabled }),
  requestTermination: (contractId: string) => post(contractPath(contractId, 'request-termination')),
  terminateNow: (contractId: string) => post(contractPath(contractId, 'terminate-now')),
};
