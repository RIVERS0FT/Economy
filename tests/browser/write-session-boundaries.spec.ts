import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('**/audit-write-harness', (route) => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Write boundary harness</title>' }));
  await page.goto('audit-write-harness');
});

test('rapid start-stop-start receives three ordered keys and keeps the final intent', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const moduleUrl = '/economy/src/api/idempotentGameWriteFetch.ts';
    const sessionUrl = '/economy/src/api/gameWriteSession.ts';
    const { createIdempotentGameWriteFetch } = await import(moduleUrl);
    const { beginGameWriteSession } = await import(sessionUrl);
    beginGameWriteSession(801);
    let release!: () => void;
    let started!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const firstStarted = new Promise<void>((resolve) => { started = resolve; });
    const calls: { key: string; path: string }[] = [];
    const cache = new Set<string>();
    let enabled = false;
    const client = createIdempotentGameWriteFetch(async (input: RequestInfo | URL, init: RequestInit) => {
      const key = new Headers(init.headers).get('Idempotency-Key')!;
      const path = String(input);
      calls.push({ key, path });
      if (calls.length === 1) { started(); await gate; }
      if (!cache.has(key)) { cache.add(key); enabled = path.endsWith('/start'); }
      return Response.json({ result: { ok: true, message: 'confirmed' }, revision: calls.length });
    });
    const send = (action: string, key: string) => client('/economy-api/game/facilities/wheat-farm/' + action,
      { method: 'POST', headers: { 'Idempotency-Key': key, 'X-Economy-Save-Epoch': '0' }, body: JSON.stringify({ provinceId: '110000' }) });
    const first = send('start', 'audit-start-first');
    const second = send('stop', 'audit-stop-second');
    const third = send('start', 'audit-start-third');
    await firstStarted;
    release();
    await Promise.all([first, second, third]);
    return { keys: calls.map((call) => call.key), enabled };
  });
  expect(result.keys).toEqual(['audit-start-first', 'audit-stop-second', 'audit-start-third']);
  expect(result.enabled).toBe(true);
});

test('unconfirmed control blocks an opposite command and only the original key can confirm it', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const moduleUrl = '/economy/src/api/idempotentGameWriteFetch.ts';
    const sessionUrl = '/economy/src/api/gameWriteSession.ts';
    const { createIdempotentGameWriteFetch } = await import(moduleUrl);
    const { beginGameWriteSession } = await import(sessionUrl);
    beginGameWriteSession(802);
    const keys: string[] = [];
    const client = createIdempotentGameWriteFetch(async (_input: RequestInfo | URL, init: RequestInit) => {
      keys.push(new Headers(init.headers).get('Idempotency-Key')!);
      return keys.length === 1 ? Response.json({ message: 'unknown' }, { status: 503 })
        : Response.json({ result: { ok: true, message: 'confirmed' }, revision: keys.length });
    });
    const send = (action: string, key: string) => client('/economy-api/game/facilities/wheat-farm/' + action,
      { method: 'POST', headers: { 'Idempotency-Key': key, 'X-Economy-Save-Epoch': '0' }, body: JSON.stringify({ provinceId: '110000' }) });
    await send('start', 'unknown-start-first');
    let blocked = '';
    try { await send('stop', 'unknown-stop-second'); } catch (error) { blocked = (error as { code: string }).code; }
    await send('start', 'replacement-not-used');
    await send('stop', 'confirmed-stop-final');
    return { blocked, keys };
  });
  expect(result.blocked).toBe('WRITE_RESULT_UNCONFIRMED');
  expect(result.keys).toEqual(['unknown-start-first', 'unknown-start-first', 'confirmed-stop-final']);
});

test('account switch aborts the old result, isolates identical writes and preserves the original account reservation', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const moduleUrl = '/economy/src/api/idempotentGameWriteFetch.ts';
    const sessionUrl = '/economy/src/api/gameWriteSession.ts';
    const { createIdempotentGameWriteFetch } = await import(moduleUrl);
    const { beginGameWriteSession, endGameWriteSession } = await import(sessionUrl);
    const calls: { user: string; key: string }[] = [];
    let release!: () => void;
    let started!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const firstStarted = new Promise<void>((resolve) => { started = resolve; });
    const client = createIdempotentGameWriteFetch(async (_input: RequestInfo | URL, init: RequestInit) => {
      const headers = new Headers(init.headers);
      const user = headers.get('X-Economy-User-Id')!;
      calls.push({ user, key: headers.get('Idempotency-Key')! });
      if (calls.length === 1) { started(); await gate; }
      return Response.json({ result: { ok: true, message: user }, revision: calls.length });
    });
    const send = (key: string) => client('/economy-api/game/orders', { method: 'POST',
      headers: { 'Idempotency-Key': key, 'X-Economy-Save-Epoch': '0' },
      body: JSON.stringify({ assetKind: 'commodity', productId: 'ore', side: 'buy', quantity: 1, provinceId: '110000' }) });
    beginGameWriteSession(803);
    const old = send('account-a-original').then(() => 'incorrect-success', (error: { code: string }) => error.code);
    await firstStarted;
    endGameWriteSession();
    beginGameWriteSession(804);
    const second = await (await send('account-b-original')).json();
    release();
    const oldCode = await old;
    endGameWriteSession();
    beginGameWriteSession(803);
    await send('account-a-new-key-not-used');
    return { calls, oldCode, second: second.result.message };
  });
  expect(result.oldCode).toBe('WRITE_SESSION_CHANGED');
  expect(result.second).toBe('804');
  expect(result.calls).toEqual([{ user: '803', key: 'account-a-original' }, { user: '804', key: 'account-b-original' }, { user: '803', key: 'account-a-original' }]);
});

test('logout prevents queued controls and prevents a retry after transport failure', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const moduleUrl = '/economy/src/api/idempotentGameWriteFetch.ts';
    const sessionUrl = '/economy/src/api/gameWriteSession.ts';
    const confirmationUrl = '/economy/src/api/gameWriteConfirmation.ts';
    const { createIdempotentGameWriteFetch } = await import(moduleUrl);
    const session = await import(sessionUrl);
    const { fetchConfirmedGameWrite } = await import(confirmationUrl);
    session.beginGameWriteSession(805);
    let started!: () => void;
    let release!: () => void;
    const firstStarted = new Promise<void>((resolve) => { started = resolve; });
    const gate = new Promise<void>((resolve) => { release = resolve; });
    let calls = 0;
    const client = createIdempotentGameWriteFetch(async () => { calls += 1; started(); await gate;
      return Response.json({ result: { ok: true, message: 'old' }, revision: 1 }); });
    const send = (action: string) => client('/economy-api/game/facilities/wheat-farm/' + action, { method: 'POST',
      headers: { 'Idempotency-Key': 'queued-' + action, 'X-Economy-Save-Epoch': '0' }, body: JSON.stringify({ provinceId: '110000' }) })
      .then(() => 'incorrect-success', (error: { code: string }) => error.code);
    const first = send('start');
    const second = send('stop');
    await firstStarted;
    session.endGameWriteSession();
    release();
    const codes = await Promise.all([first, second]);
    session.beginGameWriteSession(806);
    const captured = session.captureGameWriteSession();
    let retries = 0;
    let retryCode = '';
    try { await fetchConfirmedGameWrite(async () => { retries += 1; throw new TypeError('lost connection'); }, '/economy-api/game/orders', {},
      { timeoutMs: 1000, sessionSignal: captured.signal, onConfirming: session.endGameWriteSession }); }
    catch (error) { retryCode = (error as { code: string }).code; }
    return { calls, codes, retries, retryCode };
  });
  expect(result.calls).toBe(1);
  expect(result.codes).toEqual(['WRITE_SESSION_CHANGED', 'WRITE_SESSION_CHANGED']);
  expect(result.retries).toBe(1);
  expect(result.retryCode).toBe('WRITE_SESSION_CHANGED');
});

test('a late game state read cannot publish into a new account session', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const sessionUrl = '/economy/src/api/gameWriteSession.ts';
    const apiUrl = '/economy/src/api/game.ts';
    const deliveryUrl = '/economy/src/app/stateDelivery.js';
    const session = await import(sessionUrl);
    const api = await import(apiUrl);
    const delivery = await import(deliveryUrl);
    session.beginGameWriteSession(807);
    let started!: () => void;
    let release!: () => void;
    const firstStarted = new Promise<void>((resolve) => { started = resolve; });
    const gate = new Promise<void>((resolve) => { release = resolve; });
    window.fetch = async () => { started(); await gate; return Response.json({ state: { userId: 807 }, revision: 1 }); };
    const pending = api.getGameState().then(() => 'incorrect-success', (error: { code: string }) => error.code);
    await firstStarted;
    session.endGameWriteSession();
    session.beginGameWriteSession(808);
    release();
    return { code: await pending, state: delivery.getStateAuthoritySnapshot().state };
  });
  expect(result.code).toBe('WRITE_SESSION_CHANGED');
  expect(result.state).toBeNull();
});
