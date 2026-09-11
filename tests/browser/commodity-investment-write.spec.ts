import { expect, test } from '@playwright/test';

const trade = { productId: 'wheat', contractId: 'wheat-week1', priceDateKey: '2026-09-11', side: 'buy', quantity: 5 };
test.beforeEach(async ({ page }) => {
  await page.route('**/investment-write-harness', (route) => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Investment write</title>' }));
  await page.goto('investment-write-harness');
});

test('investment retries same canonical request across changed settlement proposals, then permits a deliberate new trade', async ({ page }) => {
  const calls = await page.evaluate(async (body) => {
    const moduleUrl = '/economy/src/api/idempotentGameWriteFetch.ts';
    const sessionUrl = '/economy/src/api/gameWriteSession.ts';
    const { createIdempotentGameWriteFetch } = await import(moduleUrl);
    const { beginGameWriteSession } = await import(sessionUrl); beginGameWriteSession(9820);
    const calls: { key: string; body: object }[] = [];
    const client = createIdempotentGameWriteFetch(async (_input: RequestInfo | URL, init: RequestInit) => {
      calls.push({ key: new Headers(init.headers).get('Idempotency-Key')!, body: JSON.parse(String(init.body)) });
      return calls.length === 1 ? Response.json({ message: 'unknown' }, { status: 503 })
        : Response.json({ result: { ok: true, message: '' }, revision: calls.length });
    });
    const send = (key: string, basis: string) => client('/economy-api/game/investments/commodities', {
      method: 'POST', headers: { 'Idempotency-Key': key, 'X-Economy-Save-Epoch': '1' },
      body: JSON.stringify({ ...body, productionSettlement: { basisId: basis } }),
    });
    await send('first', 'old'); await send('retry-key-must-not-be-used', 'new'); await send('deliberate-second', 'latest');
    return calls;
  }, trade);
  expect(calls.map((call) => call.key)).toEqual(['first', 'first', 'deliberate-second']);
  expect(calls.map((call) => call.body)).toEqual([trade, trade, trade]);
});

test('a new date or quantity cannot overtake an uncertain trade and is not automatically sent after confirming it', async ({ page }) => {
  const result = await page.evaluate(async (body) => {
    const moduleUrl = '/economy/src/api/idempotentGameWriteFetch.ts';
    const sessionUrl = '/economy/src/api/gameWriteSession.ts';
    const { createIdempotentGameWriteFetch } = await import(moduleUrl);
    const { beginGameWriteSession } = await import(sessionUrl); beginGameWriteSession(9821);
    const calls: { key: string; body: object }[] = [];
    const client = createIdempotentGameWriteFetch(async (_input: RequestInfo | URL, init: RequestInit) => {
      calls.push({ key: new Headers(init.headers).get('Idempotency-Key')!, body: JSON.parse(String(init.body)) });
      return calls.length === 1 ? Response.json({ message: 'unknown' }, { status: 503 })
        : Response.json({ result: { ok: true, message: '' }, revision: calls.length });
    });
    const send = (key: string, payload: object) => client('/economy-api/game/investments/commodities', {
      method: 'POST', headers: { 'Idempotency-Key': key, 'X-Economy-Save-Epoch': '1' }, body: JSON.stringify(payload),
    });
    await send('old-trade', body);
    let code = '';
    const next = { ...body, quantity: 10, priceDateKey: '2026-09-12' };
    try { await send('new-trade', next); } catch (error) { code = (error as { code: string }).code; }
    const afterConfirmation = calls.length;
    await send('explicit-new-trade', next);
    return { calls, code, afterConfirmation };
  }, trade);
  expect(result.code).toBe('INVESTMENT_PREVIOUS_CONFIRMED');
  expect(result.afterConfirmation).toBe(2);
  expect(result.calls.slice(0, 2).map((call) => call.body)).toEqual([trade, trade]);
  expect(result.calls.map((call) => call.key)).toEqual(['old-trade', 'old-trade', 'explicit-new-trade']);
});
