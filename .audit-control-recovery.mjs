import { readFileSync, writeFileSync } from 'node:fs';
function replace(path, from, to) {
  const source = readFileSync(path, 'utf8');
  if (source.split(from).length !== 2) throw new Error('Expected exact boundary: ' + path + ' / ' + from.slice(0, 80));
  writeFileSync(path, source.replace(from, to));
}
const coordinator = 'src/api/idempotentGameWriteFetch.ts';
replace('src/api/gameWriteConfirmation.ts', 'export interface ConfirmedWriteResponse {', `export class GameOperationUnconfirmedError extends Error {
  readonly code = 'OPERATION_RESULT_UNCONFIRMED';
  readonly cause: unknown;
  constructor(cause?: unknown) {
    super('前一次操作尚未确认，请稍后再次操作以确认原结果。');
    this.name = 'GameOperationUnconfirmedError';
    this.cause = cause;
  }
}

export interface ConfirmedWriteResponse {`);
replace(coordinator, 'fetchConfirmedGameWrite, GameWriteUnconfirmedError,', 'fetchConfirmedGameWrite, GameOperationUnconfirmedError, GameWriteUnconfirmedError,');
replace(coordinator, 'interface PendingWriteReservation {', `interface PendingControlRequest {
  method: 'POST';
  path: string;
  body: string;
  saveEpoch: string;
}

interface PendingWriteReservation {`);
replace(coordinator, '  queueKey?: string;\n}', '  queueKey?: string;\n  controlRequest?: PendingControlRequest;\n}');
replace(coordinator,
  "        ...(typeof reservation.queueKey === 'string' ? { queueKey: reservation.queueKey } : {}),",
  "        ...(typeof reservation.queueKey === 'string' ? { queueKey: reservation.queueKey } : {}),\n        ...(reservation.controlRequest?.method === 'POST' && typeof reservation.controlRequest.path === 'string'\n          && typeof reservation.controlRequest.body === 'string' && typeof reservation.controlRequest.saveEpoch === 'string'\n          ? { controlRequest: { method: 'POST', path: reservation.controlRequest.path, body: reservation.controlRequest.body, saveEpoch: reservation.controlRequest.saveEpoch } } : {}),");
replace(coordinator, 'function reserveWriteKey(fingerprint: string, proposedKey: string, queueKey?: string) {',
  'function reserveWriteKey(fingerprint: string, proposedKey: string, queueKey?: string, controlRequest?: PendingControlRequest) {');
replace(coordinator,
  "    throw new GameWriteUnconfirmedError();\n  }\n  if (existing) return existing;",
  "    throw new GameOperationUnconfirmedError();\n  }\n  if (existing) return existing;");
replace(coordinator,
  '  const reservation = { key: proposedKey, createdAt: now, ...(queueKey ? { queueKey } : {}) };',
  '  const reservation = { key: proposedKey, createdAt: now, ...(queueKey ? { queueKey } : {}), ...(controlRequest ? { controlRequest } : {}) };');
replace(coordinator, 'export function createIdempotentGameWriteFetch(nativeFetch: typeof fetch): typeof fetch {', `export function createIdempotentGameWriteFetch(nativeFetch: typeof fetch): typeof fetch {
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
      const match = original.path.match(/^\\/economy-api\\/game\\/facilities\\/([^/?#]+)\\/(start|stop|pause)(?:\\?[^#]*)?$/);
      const provinceId = JSON.parse(original.body)?.provinceId;
      valid = Boolean(match && typeof provinceId === 'string'
        && queueKey === owner + ':' + original.saveEpoch + ':' + provinceId + ':' + decodeURIComponent(match[1])
        && previousFingerprint === owner + ':' + stableFingerprint([original.method, original.path, original.saveEpoch, original.body].join('\\n')));
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
`);
replace(coordinator,
  '        if (pendingWrites.has(legacyFingerprint)) throw new GameWriteUnconfirmedError();\n        const wasPending = pendingWrites.has(fingerprint);',
  '        if (pendingWrites.has(legacyFingerprint)) throw deduplicate ? new GameWriteUnconfirmedError() : new GameOperationUnconfirmedError();\n        if (queueKey) await confirmPrecedingControl(queueKey, fingerprint, session);\n        assertGameWriteSession(session);\n        const wasPending = pendingWrites.has(fingerprint);');
replace(coordinator,
  '        const reservation = reserveWriteKey(fingerprint, proposedKey, queueKey);',
  "        const controlRequest: PendingControlRequest | undefined = immediateIntent && method === 'POST'\n          ? { method: 'POST', path: canonicalRequestPath(input), body: init.body as string, saveEpoch: headers.get('X-Economy-Save-Epoch') || '' } : undefined;\n        const reservation = reserveWriteKey(fingerprint, proposedKey, queueKey, controlRequest);");
const browser = 'tests/browser/write-session-boundaries.spec.ts';
replace(browser, "test('unconfirmed control blocks an opposite command and only the original key can confirm it'", "test('unconfirmed control blocks execution until same-key confirmation permits the new intent'");
replace(browser, '    const keys: string[] = [];\n    const client', '    const keys: string[] = [];\n    let canConfirm = false;\n    const client');
replace(browser, "      return keys.length === 1 ? Response.json({ message: 'unknown' }, { status: 503 })", "      return !canConfirm ? Response.json({ message: 'unknown' }, { status: 503 })");
replace(browser, "    await send('start', 'replacement-not-used');\n    await send('stop', 'confirmed-stop-final');", "    canConfirm = true;\n    await send('stop', 'confirmed-stop-final');");
replace(browser, "  expect(result.blocked).toBe('WRITE_RESULT_UNCONFIRMED');", "  expect(result.blocked).toBe('OPERATION_RESULT_UNCONFIRMED');");
replace(browser, "  expect(result.keys).toEqual(['unknown-start-first', 'unknown-start-first', 'confirmed-stop-final']);", "  expect(result.keys).toEqual(['unknown-start-first', 'unknown-start-first', 'unknown-start-first', 'confirmed-stop-final']);");
writeFileSync(browser, readFileSync(browser, 'utf8') + `
test('reloaded controls confirm the persisted original command before sending a different intent', async ({ page }) => {
  await page.evaluate(async () => {
    const moduleUrl = '/economy/src/api/idempotentGameWriteFetch.ts';
    const sessionUrl = '/economy/src/api/gameWriteSession.ts';
    const { createIdempotentGameWriteFetch } = await import(moduleUrl);
    const { beginGameWriteSession } = await import(sessionUrl);
    beginGameWriteSession(811);
    const client = createIdempotentGameWriteFetch(async () => Response.json({ message: 'unknown' }, { status: 503 }));
    await client('/economy-api/game/facilities/wheat-farm/start', { method: 'POST',
      headers: { 'Idempotency-Key': 'persisted-original-start', 'X-Economy-Save-Epoch': '0' }, body: JSON.stringify({ provinceId: '110000' }) });
  });
  await page.reload();
  const calls = await page.evaluate(async () => {
    const moduleUrl = '/economy/src/api/idempotentGameWriteFetch.ts';
    const sessionUrl = '/economy/src/api/gameWriteSession.ts';
    const { createIdempotentGameWriteFetch } = await import(moduleUrl);
    const { beginGameWriteSession } = await import(sessionUrl);
    beginGameWriteSession(811);
    const calls: { path: string; key: string }[] = [];
    const client = createIdempotentGameWriteFetch(async (input: RequestInfo | URL, init: RequestInit) => {
      calls.push({ path: String(input), key: new Headers(init.headers).get('Idempotency-Key')! });
      return Response.json({ result: { ok: true, message: 'confirmed' }, revision: calls.length });
    });
    await client('/economy-api/game/facilities/wheat-farm/stop', { method: 'POST',
      headers: { 'Idempotency-Key': 'reloaded-new-stop', 'X-Economy-Save-Epoch': '0' }, body: JSON.stringify({ provinceId: '110000' }) });
    return calls;
  });
  expect(calls).toEqual([
    { path: '/economy-api/game/facilities/wheat-farm/start', key: 'persisted-original-start' },
    { path: '/economy-api/game/facilities/wheat-farm/stop', key: 'reloaded-new-stop' },
  ]);
});
`);
replace('docs/AUTHORITATIVE_COUNTDOWN_DESIGN.md',
  '前一个不同命令仍未确认时，后续命令不得越过它执行；原命令只允许复用原键确认。',
  '前一个不同命令仍未确认时，后续命令不得越过它执行；原命令只允许复用原键确认。用户再次切换时，协调层先按持久化的原控制请求与原键完成确认，再执行新意图；确认仍未知则不发送新命令，稍后再次切换可继续确认，不要求用户通过已经变更状态的开关重建旧意图。控制请求只持久化方法、同源控制路径、稳定请求体与存档世代，不保存 Cookie 或任意请求头；恢复时重新校验玩家、实体和完整指纹，损坏或不匹配的记录不自动执行。');
console.log('CONTROL_CONFIRMATION_RECOVERY_APPLIED');
