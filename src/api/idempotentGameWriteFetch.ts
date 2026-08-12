const GAME_API_PATH_PREFIX = '/economy-api/game';
const WRITE_ATTEMPT_TIMEOUT_MS = 12_000;
const PENDING_WRITE_TTL_MS = 24 * 60 * 60 * 1_000;
const MAX_PENDING_WRITES = 128;
const STORAGE_KEY = 'economy.pending-write-idempotency.v1';

interface PendingWriteReservation {
  key: string;
  createdAt: number;
}

type StoredPendingWrites = Record<string, PendingWriteReservation>;

const pendingWrites = new Map<string, PendingWriteReservation>();
let hydrated = false;
let installed = false;

function stableFingerprint(value: string) {
  let first = 0x811c9dc5;
  let second = 0x9e3779b9;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    first = Math.imul(first ^ code, 0x01000193);
    second = Math.imul(second ^ code, 0x85ebca6b);
  }
  return `${(first >>> 0).toString(36)}-${(second >>> 0).toString(36)}`;
}

function storage() {
  try {
    return globalThis.sessionStorage;
  } catch {
    return null;
  }
}

function persistPendingWrites() {
  const target = storage();
  if (!target) return;
  try {
    const serialized: StoredPendingWrites = {};
    for (const [fingerprint, reservation] of pendingWrites) {
      serialized[fingerprint] = reservation;
    }
    target.setItem(STORAGE_KEY, JSON.stringify(serialized));
  } catch {
    // Storage failures must not disable authoritative writes.
  }
}

function prunePendingWrites(now: number) {
  let changed = false;
  for (const [fingerprint, reservation] of pendingWrites) {
    if (now - reservation.createdAt >= PENDING_WRITE_TTL_MS) {
      pendingWrites.delete(fingerprint);
      changed = true;
    }
  }
  while (pendingWrites.size > MAX_PENDING_WRITES) {
    const oldest = pendingWrites.keys().next().value as string | undefined;
    if (!oldest) break;
    pendingWrites.delete(oldest);
    changed = true;
  }
  if (changed) persistPendingWrites();
}

function hydratePendingWrites() {
  if (hydrated) return;
  hydrated = true;
  const target = storage();
  if (!target) return;
  try {
    const raw = target.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as StoredPendingWrites;
    for (const [fingerprint, reservation] of Object.entries(parsed)) {
      if (!reservation || typeof reservation.key !== 'string' || !Number.isFinite(reservation.createdAt)) continue;
      pendingWrites.set(fingerprint, {
        key: reservation.key,
        createdAt: Number(reservation.createdAt),
      });
    }
  } catch {
    pendingWrites.clear();
  }
  prunePendingWrites(Date.now());
}

function reserveWriteKey(fingerprint: string, proposedKey: string) {
  hydratePendingWrites();
  const now = Date.now();
  prunePendingWrites(now);
  const existing = pendingWrites.get(fingerprint);
  if (existing) return existing;
  const reservation = { key: proposedKey, createdAt: now };
  pendingWrites.set(fingerprint, reservation);
  prunePendingWrites(now);
  persistPendingWrites();
  return reservation;
}

function releaseWriteKey(fingerprint: string, key: string) {
  if (pendingWrites.get(fingerprint)?.key !== key) return;
  pendingWrites.delete(fingerprint);
  persistPendingWrites();
}

function requestUrl(input: RequestInfo | URL) {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

function requestMethod(input: RequestInfo | URL, init?: RequestInit) {
  if (init?.method) return init.method.toUpperCase();
  if (typeof Request !== 'undefined' && input instanceof Request) return input.method.toUpperCase();
  return 'GET';
}

function isTargetGameWrite(input: RequestInfo | URL, method: string) {
  if (method === 'GET' || method === 'HEAD') return false;
  const base = typeof globalThis.location?.origin === 'string'
    ? globalThis.location.origin
    : 'http://localhost';
  try {
    const url = new URL(requestUrl(input), base);
    return url.pathname === GAME_API_PATH_PREFIX || url.pathname.startsWith(`${GAME_API_PATH_PREFIX}/`);
  } catch {
    return false;
  }
}

function canonicalRequestPath(input: RequestInfo | URL) {
  const base = typeof globalThis.location?.origin === 'string'
    ? globalThis.location.origin
    : 'http://localhost';
  const url = new URL(requestUrl(input), base);
  return `${url.pathname}${url.search}`;
}

function shouldKeepReservation(response: Response) {
  return response.status === 408 || response.status >= 500;
}

function errorName(reason: unknown) {
  if (!reason || typeof reason !== 'object' || !('name' in reason)) return '';
  return String((reason as { name?: unknown }).name || '');
}

function isAmbiguousTransportFailure(reason: unknown) {
  return reason instanceof TypeError || errorName(reason) === 'AbortError';
}

async function fetchWriteAttempt(
  nativeFetch: typeof globalThis.fetch,
  input: RequestInfo | URL,
  init: RequestInit,
  headers: Headers,
  callerSignal: AbortSignal | null | undefined,
) {
  const controller = new AbortController();
  const forwardAbort = () => controller.abort();
  if (callerSignal?.aborted) controller.abort();
  else callerSignal?.addEventListener('abort', forwardAbort, { once: true });
  const timeout = globalThis.setTimeout(() => controller.abort(), WRITE_ATTEMPT_TIMEOUT_MS);
  try {
    return await nativeFetch(input, {
      ...init,
      headers,
      signal: controller.signal,
    });
  } finally {
    globalThis.clearTimeout(timeout);
    callerSignal?.removeEventListener('abort', forwardAbort);
  }
}

export function installIdempotentGameWriteFetch() {
  if (installed || typeof globalThis.fetch !== 'function') return;
  installed = true;
  const nativeFetch = globalThis.fetch.bind(globalThis);

  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const method = requestMethod(input, init);
    if (!isTargetGameWrite(input, method) || typeof init?.body !== 'string') {
      return nativeFetch(input, init);
    }

    const headers = new Headers(init.headers);
    const proposedKey = headers.get('Idempotency-Key');
    if (!proposedKey) return nativeFetch(input, init);

    const fingerprint = stableFingerprint([
      method,
      canonicalRequestPath(input),
      headers.get('X-Economy-Save-Epoch') || '',
      init.body,
    ].join('\n'));
    const reservation = reserveWriteKey(fingerprint, proposedKey);
    headers.set('Idempotency-Key', reservation.key);

    let lastFailure: unknown;
    for (let attemptIndex = 0; attemptIndex < 2; attemptIndex += 1) {
      try {
        const response = await fetchWriteAttempt(
          nativeFetch,
          input,
          init,
          headers,
          attemptIndex === 0 ? init.signal : undefined,
        );
        if (!shouldKeepReservation(response)) {
          releaseWriteKey(fingerprint, reservation.key);
        }
        return response;
      } catch (reason) {
        lastFailure = reason;
        if (!isAmbiguousTransportFailure(reason)) {
          releaseWriteKey(fingerprint, reservation.key);
          throw reason;
        }
        if (attemptIndex === 0) continue;
      }
    }
    throw lastFailure;
  };
}
