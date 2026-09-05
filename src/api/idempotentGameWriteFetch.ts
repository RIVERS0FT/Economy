import { fetchConfirmedGameWrite, GameOperationUnconfirmedError, GameWriteUnconfirmedError, isConfirmedActionResult, isUnconfirmedWriteStatus } from './gameWriteConfirmation';
import { assertGameWriteSession, captureGameWriteSession, endGameWriteSession, GameWriteSessionChangedError, isCurrentGameWriteSession, subscribeGameWriteSession } from './gameWriteSession';
import { publishCommodityWriteProgress } from './commodityWriteProgress';
import {
  acceptExternalStateDelivery,
  getActiveStatePartitionRevisions,
} from '../app/stateDelivery.js';
import {
  acknowledgeFacilityEnabledIntent,
  rejectFacilityEnabledIntent,
  resetFacilityEnabledIntents,
  setFacilityEnabledIntent,
} from '../app/immediateCommandIntent';
import { acceptServerNow } from '../utils/serverClock.js';

const GAME_API_PATH_PREFIX = '/economy-api/game';
const SESSION_BOOTSTRAP_PATH = `${GAME_API_PATH_PREFIX}/session`;
const WRITE_ATTEMPT_TIMEOUT_MS = 12_000;
const PENDING_WRITE_TTL_MS = 24 * 60 * 60 * 1_000;
const MAX_PENDING_WRITES = 128;
const STORAGE_KEY = 'economy.pending-write-idempotency.v1';

interface PendingControlRequest {
  method: 'POST';
  path: string;
  body: string;
  saveEpoch: string;
}

interface PendingWriteReservation {
  key: string;
  createdAt: number;
  queueKey?: string;
  controlRequest?: PendingControlRequest;
}

interface FacilityToggleIntent {
  provinceId: string;
  facilityTypeId: string;
  enabled: boolean;
  sequence: number;
  queueKey: string;
}

interface ActionDeliveryReconciliation {
  commandOk: boolean | null;
  authorityApplied: boolean;
}

type StoredPendingWrites = Record<string, PendingWriteReservation>;

const pendingWrites = new Map<string, PendingWriteReservation>();
const inFlightWrites = new Map<string, Promise<Response>>();
const directControlTails = new Map<string, Promise<void>>();
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
        ...(typeof reservation.queueKey === 'string' ? { queueKey: reservation.queueKey } : {}),
        ...(reservation.controlRequest?.method === 'POST' && typeof reservation.controlRequest.path === 'string'
          && typeof reservation.controlRequest.body === 'string' && typeof reservation.controlRequest.saveEpoch === 'string'
          ? { controlRequest: { method: 'POST', path: reservation.controlRequest.path, body: reservation.controlRequest.body, saveEpoch: reservation.controlRequest.saveEpoch } } : {}),
      });
    }
  } catch {
    pendingWrites.clear();
  }
  prunePendingWrites(Date.now());
}

function reserveWriteKey(fingerprint: string, proposedKey: string, queueKey?: string, controlRequest?: PendingControlRequest) {
  hydratePendingWrites();
  const now = Date.now();
  prunePendingWrites(now);
  const existing = pendingWrites.get(fingerprint);
  if (queueKey && [...pendingWrites.entries()].some(([key, entry]) => key !== fingerprint && entry.queueKey === queueKey)) {
    throw new GameOperationUnconfirmedError();
  }
  if (existing) return existing;
  if (pendingWrites.size >= MAX_PENDING_WRITES) throw new Error('待确认操作较多，请先确认已有操作。');
  const reservation = { key: proposedKey, createdAt: now, ...(queueKey ? { queueKey } : {}), ...(controlRequest ? { controlRequest } : {}) };
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

function parsedRequestUrl(input: RequestInfo | URL) {
  const base = typeof globalThis.location?.origin === 'string'
    ? globalThis.location.origin
    : 'http://localhost';
  return new URL(requestUrl(input), base);
}

function isTargetGameWrite(input: RequestInfo | URL, method: string) {
  if (method === 'GET' || method === 'HEAD') return false;
  try {
    const url = parsedRequestUrl(input);
    return url.pathname === GAME_API_PATH_PREFIX || url.pathname.startsWith(`${GAME_API_PATH_PREFIX}/`);
  } catch {
    return false;
  }
}

function canonicalRequestPath(input: RequestInfo | URL) {
  const url = parsedRequestUrl(input);
  return `${url.pathname}${url.search}`;
}

function isSessionBootstrapWrite(input: RequestInfo | URL) {
  return canonicalRequestPath(input) === SESSION_BOOTSTRAP_PATH;
}

function isManualCommodityWrite(input: RequestInfo | URL, body: string) {
  if (parsedRequestUrl(input).pathname !== `${GAME_API_PATH_PREFIX}/orders`) return false;
  try {
    const value = JSON.parse(body);
    return value?.assetKind === 'commodity' && !value.execution && (value.side === 'buy' || value.side === 'sell');
  } catch { return false; }
}

function facilityToggleIntent(
  input: RequestInfo | URL,
  init: RequestInit,
): FacilityToggleIntent | null {
  if (typeof init.body !== 'string') return null;
  try {
    const path = parsedRequestUrl(input).pathname;
    const match = path.match(/^\/economy-api\/game\/facilities\/([^/]+)\/(start|stop|pause)$/);
    if (!match) return null;
    const body = JSON.parse(init.body) as { provinceId?: unknown };
    const provinceId = String(body.provinceId || '');
    const facilityTypeId = decodeURIComponent(match[1]);
    if (!provinceId || !facilityTypeId) return null;
    const enabled = match[2] === 'start';
    return {
      provinceId,
      facilityTypeId,
      enabled,
      sequence: setFacilityEnabledIntent(provinceId, facilityTypeId, enabled),
      queueKey: `${provinceId}:${facilityTypeId}`,
    };
  } catch {
    return null;
  }
}

function shouldKeepReservation(response: Response) {
  return isUnconfirmedWriteStatus(response.status);
}

function actionDeliveryPayload(value: unknown): value is {
  result: { ok?: unknown; message?: unknown };
  revision: number;
  unchanged: boolean;
  serverNow: number;
} {
  if (!value || typeof value !== 'object') return false;
  const payload = value as {
    result?: unknown;
    revision?: unknown;
    unchanged?: unknown;
    serverNow?: unknown;
  };
  return Boolean(payload.result && typeof payload.result === 'object')
    && Number.isInteger(payload.revision)
    && typeof payload.unchanged === 'boolean'
    && Number.isFinite(Number(payload.serverNow));
}

function attachKnownStateRevisions(input: RequestInfo | URL, headers: Headers) {
  if (isSessionBootstrapWrite(input)) return;
  const revisions = getActiveStatePartitionRevisions();
  if (Object.keys(revisions).length === 0) return;
  headers.set('X-Economy-State-Revisions', JSON.stringify(revisions));
}

function reconcileActionDelivery(response: Response, payload: unknown): ActionDeliveryReconciliation {
  if (!response.ok) return { commandOk: null, authorityApplied: false };
  if (!actionDeliveryPayload(payload)) return { commandOk: null, authorityApplied: false };
  const commandOk = payload.result.ok === true;
  try {
    acceptServerNow(payload.serverNow);
    acceptExternalStateDelivery(payload);
    return { commandOk, authorityApplied: true };
  } catch {
    // The write may already be committed. Never turn a successful HTTP write into
    // an apparent failed command because local delivery reconciliation failed;
    // the normal authority poll remains the recovery path.
    return { commandOk, authorityApplied: false };
  }
}

async function runSerializedDirectControl<T>(key: string | null, operation: () => Promise<T>) {
  if (!key) return operation();
  const previous = directControlTails.get(key) ?? Promise.resolve();
  let release = () => {};
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const tail = previous.catch(() => {}).then(() => gate);
  directControlTails.set(key, tail);
  await previous.catch(() => {});
  try {
    return await operation();
  } finally {
    release();
    void tail.finally(() => {
      if (directControlTails.get(key) === tail) directControlTails.delete(key);
    });
  }
}

export function createIdempotentGameWriteFetch(nativeFetch: typeof fetch): typeof fetch {
  async function confirmPrecedingControl(queueKey: string, fingerprint: string, session: ReturnType<typeof captureGameWriteSession>) {
    const preceding = [...pendingWrites.entries()].find(([key, entry]) => key !== fingerprint && entry.queueKey === queueKey);
    if (!preceding) return;
    const [previousFingerprint, reservation] = preceding;
    const original = reservation.controlRequest;
    if (!original || original.method !== 'POST') throw new GameOperationUnconfirmedError();
    const owner = String(session.userId ?? 'unbound');
    // Persist only control intent, never cookies or arbitrary headers. Revalidate the route, entity and fingerprint before replay.
    let valid = false;
    try {
      const match = original.path.match(/^\/economy-api\/game\/facilities\/([^/?#]+)\/(start|stop|pause)(?:\?[^#]*)?$/);
      const provinceId = JSON.parse(original.body)?.provinceId;
      valid = Boolean(match && typeof provinceId === 'string'
        && queueKey === owner + ':' + original.saveEpoch + ':' + provinceId + ':' + decodeURIComponent(match[1])
        && previousFingerprint === owner + ':' + stableFingerprint([original.method, original.path, original.saveEpoch, original.body].join('\n')));
    } catch { /* Corrupt reservations must not become a different command. */ }
    if (!valid) throw new GameOperationUnconfirmedError();
    const headers = new Headers({ 'Content-Type': 'application/json', 'Idempotency-Key': reservation.key,
      'X-Economy-Save-Epoch': original.saveEpoch });
    if (session.userId !== null) headers.set('X-Economy-User-Id', String(session.userId));
    attachKnownStateRevisions(original.path, headers);
    let receipt;
    try {
      receipt = await fetchConfirmedGameWrite(nativeFetch, original.path, {
        method: original.method, body: original.body, credentials: 'include', headers,
      }, { timeoutMs: WRITE_ATTEMPT_TIMEOUT_MS, sessionSignal: session.signal, validateSuccess: isConfirmedActionResult });
    } catch (reason) {
      assertGameWriteSession(session);
      throw new GameOperationUnconfirmedError(reason);
    }
    assertGameWriteSession(session);
    const { response, payload } = receipt;
    if (payload && typeof payload === 'object' && 'code' in payload && payload.code === 'WRITE_SESSION_MISMATCH') {
      endGameWriteSession();
      throw new GameWriteSessionChangedError();
    }
    if (isUnconfirmedWriteStatus(response.status)) throw new GameOperationUnconfirmedError();
    reconcileActionDelivery(response, payload);
    releaseWriteKey(previousFingerprint, reservation.key);
  }

  return async (input: RequestInfo | URL, init?: RequestInit) => {
    const method = requestMethod(input, init);
    if (!isTargetGameWrite(input, method) || typeof init?.body !== 'string') return nativeFetch(input, init);
    const headers = new Headers(init.headers);
    const proposedKey = headers.get('Idempotency-Key');
    if (!proposedKey) return nativeFetch(input, init);
    const session = captureGameWriteSession();
    if (session.userId !== null) headers.set('X-Economy-User-Id', String(session.userId));
    const legacyFingerprint = stableFingerprint([method, canonicalRequestPath(input),
      headers.get('X-Economy-Save-Epoch') || '', init.body].join('\n'));
    const owner = String(session.userId ?? 'unbound');
    const fingerprint = owner + ':' + legacyFingerprint;
    const flightKey = String(session.generation) + ':' + fingerprint;
    const deduplicate = isManualCommodityWrite(input, init.body);
    const existing = deduplicate ? inFlightWrites.get(flightKey) : undefined;
    if (existing) {
      const response = await existing;
      assertGameWriteSession(session);
      return response.clone();
    }
    const immediateIntent = facilityToggleIntent(input, init);
    const queueKey = immediateIntent ? owner + ':' + (headers.get('X-Economy-Save-Epoch') || '') + ':' + immediateIntent.queueKey : undefined;
    const isOrder = parsedRequestUrl(input).pathname === GAME_API_PATH_PREFIX + '/orders';
    const notify = (phase: Parameters<typeof publishCommodityWriteProgress>[1]) => {
      if (isOrder && isCurrentGameWriteSession(session)) publishCommodityWriteProgress(init.body as string, phase);
    };
    const operation = runSerializedDirectControl(queueKey ? String(session.generation) + ':' + queueKey : null, async () => {
      try {
        assertGameWriteSession(session);
        hydratePendingWrites();
        prunePendingWrites(Date.now());
        // Old unowned reservations cannot safely be assigned to whichever account logs in next.
        if (pendingWrites.has(legacyFingerprint)) throw deduplicate ? new GameWriteUnconfirmedError() : new GameOperationUnconfirmedError();
        if (queueKey) await confirmPrecedingControl(queueKey, fingerprint, session);
        assertGameWriteSession(session);
        const wasPending = pendingWrites.has(fingerprint);
        // Reserve after the preceding control has confirmed and released its key.
        // An unresolved different control blocks this queue rather than silently reordering commands.
        const controlRequest: PendingControlRequest | undefined = immediateIntent && method === 'POST'
          ? { method: 'POST', path: canonicalRequestPath(input), body: init.body as string, saveEpoch: headers.get('X-Economy-Save-Epoch') || '' } : undefined;
        const reservation = reserveWriteKey(fingerprint, proposedKey, queueKey, controlRequest);
        headers.set('Idempotency-Key', reservation.key);
        attachKnownStateRevisions(input, headers);
        notify(wasPending ? 'confirming' : 'submitting');
        const { response, payload } = await fetchConfirmedGameWrite(nativeFetch, input, { ...init, headers }, {
          timeoutMs: isSessionBootstrapWrite(input) ? null : WRITE_ATTEMPT_TIMEOUT_MS,
          signal: init.signal,
          sessionSignal: session.signal,
          validateSuccess: isOrder || immediateIntent ? isConfirmedActionResult : undefined,
          onConfirming: () => notify('confirming'),
          preserveTransportError: !deduplicate,
        });
        assertGameWriteSession(session);
        if (payload && typeof payload === 'object' && 'code' in payload && payload.code === 'WRITE_SESSION_MISMATCH') {
          endGameWriteSession();
          throw new GameWriteSessionChangedError();
        }
        const reconciliation = reconcileActionDelivery(response, payload);
        if (immediateIntent) {
          if (!response.ok || reconciliation.commandOk === false) {
            rejectFacilityEnabledIntent(immediateIntent.provinceId, immediateIntent.facilityTypeId, immediateIntent.sequence);
          } else {
            acknowledgeFacilityEnabledIntent(immediateIntent.provinceId, immediateIntent.facilityTypeId,
              immediateIntent.sequence, reconciliation.authorityApplied);
          }
        }
        if (!shouldKeepReservation(response)) {
          releaseWriteKey(fingerprint, reservation.key);
          notify('settled');
        } else notify('unconfirmed');
        return response;
      } catch (reason) {
        notify('unconfirmed');
        if (immediateIntent && isCurrentGameWriteSession(session)) {
          rejectFacilityEnabledIntent(immediateIntent.provinceId, immediateIntent.facilityTypeId, immediateIntent.sequence);
        }
        throw reason;
      }
    });
    if (deduplicate) inFlightWrites.set(flightKey, operation);
    try {
      const response = await operation;
      assertGameWriteSession(session);
      return response.clone();
    } finally { if (inFlightWrites.get(flightKey) === operation) inFlightWrites.delete(flightKey); }
  };
}

export function installIdempotentGameWriteFetch() {
  if (installed || typeof globalThis.fetch !== 'function') return;
  installed = true;
  subscribeGameWriteSession(resetFacilityEnabledIntents);
  globalThis.fetch = createIdempotentGameWriteFetch(globalThis.fetch.bind(globalThis));
}
