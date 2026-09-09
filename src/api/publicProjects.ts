export interface PublicProjectActionResult {
  ok: boolean;
  message: string;
  code?: string;
  revision?: number;
}

function requestKey() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `public-project-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function runPublicProjectAction(
  saveEpoch: number,
  projectId: string,
  action: 'contribute' | 'claim',
  input: Record<string, unknown> = {},
): Promise<PublicProjectActionResult> {
  const response = await fetch(`/economy-api/game/public-projects/${encodeURIComponent(projectId)}/${action}`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': requestKey(),
      'X-Economy-Save-Epoch': String(Math.max(0, Math.floor(Number(saveEpoch) || 0))),
    },
    body: JSON.stringify(input),
  });
  let payload: { result?: PublicProjectActionResult; message?: string; revision?: number } = {};
  try {
    payload = await response.json() as typeof payload;
  } catch {
    // Preserve the generic transport message below.
  }
  if (!response.ok) {
    return {
      ok: false,
      message: String(payload.result?.message || payload.message || '公共项目操作失败，请刷新后重试'),
      ...(response.status >= 500 || response.status === 408 || response.status === 429 ? { code: 'ACTION_RESULT_UNCONFIRMED' } : {}),
    };
  }
  return payload.result && typeof payload.result.ok === 'boolean' && typeof payload.result.message === 'string'
    ? { ...payload.result, ...(Number.isInteger(payload.revision) ? { revision: payload.revision } : {}) }
    : { ok: false, code: 'ACTION_RESULT_UNCONFIRMED', message: '服务器未返回公共项目操作结果' };
}

export function contributePublicProject(
  saveEpoch: number,
  projectId: string,
  productId: string,
  quantity: number,
) {
  return runPublicProjectAction(saveEpoch, projectId, 'contribute', { productId, quantity });
}

export function claimPublicProjectReward(saveEpoch: number, projectId: string) {
  return runPublicProjectAction(saveEpoch, projectId, 'claim');
}
