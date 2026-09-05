export const WRITE_RESULT_UNCONFIRMED = 'WRITE_RESULT_UNCONFIRMED';
export const WRITE_RESULT_UNCONFIRMED_MESSAGE = '交易结果尚未确认，请勿重复交易；请确认原交易结果。';

export class GameWriteUnconfirmedError extends Error {
  readonly code = WRITE_RESULT_UNCONFIRMED;
  readonly cause: unknown;
  constructor(cause?: unknown) {
    super(WRITE_RESULT_UNCONFIRMED_MESSAGE);
    this.name = 'GameWriteUnconfirmedError';
    this.cause = cause;
  }
}

export interface ConfirmedWriteResponse {
  response: Response;
  payload: unknown;
}

interface WriteAttemptOptions {
  timeoutMs: number | null;
  signal?: AbortSignal | null;
  validateSuccess?: (payload: unknown) => boolean;
  onConfirming?: () => void;
  preserveTransportError?: boolean;
  sessionSignal?: AbortSignal;
}

export function isConfirmedActionResult(payload: unknown): boolean {
  if (!payload || typeof payload !== 'object') return false;
  const value = payload as { result?: { ok?: unknown; message?: unknown }; revision?: unknown };
  return typeof value.result?.ok === 'boolean' && typeof value.result.message === 'string'
    && Number.isSafeInteger(value.revision) && Number(value.revision) >= 0;
}

export function isUnconfirmedWriteStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

async function completeAttempt(nativeFetch: typeof fetch, input: RequestInfo | URL, init: RequestInit,
  options: WriteAttemptOptions): Promise<ConfirmedWriteResponse> {
  const controller = new AbortController();
  let rejectAbort!: (reason: unknown) => void;
  const aborted = new Promise<never>((_, reject) => { rejectAbort = reject; });
  const abort = () => {
    controller.abort();
    rejectAbort(new DOMException('Game write confirmation interrupted', 'AbortError'));
  };
  const abortSession = () => { controller.abort(); rejectAbort(options.sessionSignal?.reason ?? new Error('Game write session changed')); };
  const timeout = options.timeoutMs === null ? null : globalThis.setTimeout(abort, options.timeoutMs);
  options.sessionSignal?.addEventListener('abort', abortSession, { once: true });
  if (options.sessionSignal?.aborted) abortSession();
  options.signal?.addEventListener('abort', abort, { once: true });
  if (options.signal?.aborted) abort();
  try {
    // Bound both the response headers and the complete body. The returned Response
    // is buffered, so callers cannot encounter a second, unbounded body read.
    const read = async () => {
      if (controller.signal.aborted) throw new DOMException('Aborted', 'AbortError');
      const source = await nativeFetch(input, { ...init, signal: controller.signal });
      const text = await source.text();
      let payload: unknown;
      try { payload = JSON.parse(text); }
      catch {
        // Gateways and authentication errors may return HTML. A known HTTP
        // error is not a broken successful action receipt or permission to retry.
        if (source.ok) throw new TypeError('Incomplete game write receipt');
      }
      if (source.ok && options.validateSuccess && !options.validateSuccess(payload)) {
        throw new TypeError('Invalid game action receipt');
      }
      return {
        response: new Response(text, { status: source.status, statusText: source.statusText, headers: source.headers }),
        payload,
      };
    };
    return await Promise.race([read(), aborted]);
  } finally {
    if (timeout !== null) globalThis.clearTimeout(timeout);
    options.signal?.removeEventListener('abort', abort);
    options.sessionSignal?.removeEventListener('abort', abortSession);
  }
}

/** At most two attempts of the exact same request; reservation ownership stays outside. */
export async function fetchConfirmedGameWrite(nativeFetch: typeof fetch, input: RequestInfo | URL,
  init: RequestInit, options: WriteAttemptOptions): Promise<ConfirmedWriteResponse> {
  if (options.signal?.aborted) throw new DOMException('Game write was cancelled before sending', 'AbortError');
  let lastFailure: unknown;
  for (let attemptIndex = 0; attemptIndex < 2; attemptIndex += 1) {
    if (options.sessionSignal?.aborted) throw options.sessionSignal.reason;
    try {
      return await completeAttempt(nativeFetch, input, init, {
        ...options,
        signal: attemptIndex === 0 ? options.signal : undefined,
      });
    } catch (reason) {
      if (options.sessionSignal?.aborted) throw options.sessionSignal.reason;
      lastFailure = reason;
      const name = reason && typeof reason === 'object' && 'name' in reason ? reason.name : '';
      if (!(reason instanceof TypeError) && name !== 'AbortError' && name !== 'SyntaxError') throw reason;
      if (attemptIndex === 0) options.onConfirming?.();
    }
  }
  if (options.preserveTransportError) throw lastFailure;
  throw new GameWriteUnconfirmedError(lastFailure);
}
