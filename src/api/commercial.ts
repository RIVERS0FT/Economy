import type { CommercialAutoOperationPolicy } from '../types/commercial';
export interface CommercialBuildingActionResult {
  ok: boolean;
  message: string;
  code?: string;
}

export type CommercialBuildingOperation = 'build' | 'start' | 'stop' | 'auto-operation';

interface CommercialBuildingActionInput {
  operation: CommercialBuildingOperation;
  provinceId: string;
  commercialTypeId: string;
  quantity?: number;
  policy?: CommercialAutoOperationPolicy;
}

function requestKey() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `commercial-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export async function runCommercialBuildingAction(
  saveEpoch: number,
  input: CommercialBuildingActionInput,
): Promise<CommercialBuildingActionResult> {
  const response = await fetch('/economy-api/game/commercial-buildings', {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': requestKey(),
      'X-Economy-Save-Epoch': String(Math.max(0, Math.floor(Number(saveEpoch) || 0))),
    },
    body: JSON.stringify(input),
  });
  let payload: { result?: CommercialBuildingActionResult; message?: string } = {};
  try {
    payload = await response.json() as typeof payload;
  } catch {
    // Preserve the generic transport message below.
  }
  if (!response.ok) {
    return {
      ok: false,
      message: String(payload.result?.message || payload.message || '商业建筑操作失败，请刷新后重试'),
      ...(response.status >= 500 || response.status === 408 ? { code: 'ACTION_RESULT_UNCONFIRMED' } : {}),
    };
  }
  return payload.result && typeof payload.result.ok === 'boolean' && typeof payload.result.message === 'string'
    ? payload.result
    : { ok: false, code: 'ACTION_RESULT_UNCONFIRMED', message: '服务器未返回商业建筑操作结果' };
}
