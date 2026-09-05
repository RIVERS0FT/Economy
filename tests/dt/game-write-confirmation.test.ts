import assert from 'node:assert/strict';
import test from 'node:test';
import { fetchConfirmedGameWrite, GameWriteUnconfirmedError, isConfirmedActionResult, isUnconfirmedWriteStatus } from '../../src/api/gameWriteConfirmation.ts';

const receipt = { result: { ok: true, message: '成交完成' }, revision: 3 };
const init = { method: 'POST', headers: { 'Idempotency-Key': 'original-key' }, body: '{"quantity":2}' };
const response = () => Response.json(receipt);

test('complete receipt is buffered and reusable after timeout cleanup', async () => {
  const result = await fetchConfirmedGameWrite(async () => response(), '/orders', init, { timeoutMs: 30, validateSuccess: isConfirmedActionResult });
  assert.deepEqual(result.payload, receipt);
  assert.deepEqual(await result.response.clone().json(), receipt);
  assert.deepEqual(await result.response.json(), receipt);
});

test('headers without a completed body hit the deadline and confirm the identical request', async () => {
  const requests: RequestInit[] = [];
  let confirming = 0;
  const result = await fetchConfirmedGameWrite(async (_, request) => {
    requests.push(request!);
    return requests.length === 1 ? new Response(new ReadableStream({ start() {} })) : response();
  }, '/orders', init, { timeoutMs: 10, validateSuccess: isConfirmedActionResult, onConfirming: () => { confirming += 1; } });
  assert.equal(confirming, 1); assert.equal(requests.length, 2);
  assert.equal(requests[0].signal?.aborted, true); assert.equal(requests[1].signal?.aborted, false);
  assert.equal(requests[0].body, requests[1].body);
  assert.equal(new Headers(requests[1].headers).get('Idempotency-Key'), 'original-key');
  assert.deepEqual(result.payload, receipt);
});

test('two missing receipts finish as unknown rather than claimed failure or success', async () => {
  const signals: AbortSignal[] = [];
  await assert.rejects(fetchConfirmedGameWrite(async (_, request) => {
    signals.push(request!.signal!);
    return new Response(new ReadableStream({ start() {} }));
  }, '/orders', init, { timeoutMs: 5 }), GameWriteUnconfirmedError);
  assert.equal(signals.length, 2);
  assert.ok(signals.every((signal) => signal.aborted));
});

for (const text of ['{"result":', '{}', '{"result":{"ok":"true","message":"x"},"revision":1}']) {
  test(`unusable success receipt is confirmed before being accepted: ${text}`, async () => {
    let calls = 0;
    const result = await fetchConfirmedGameWrite(async () => ++calls === 1 ? new Response(text) : response(), '/orders', init,
      { timeoutMs: 50, validateSuccess: isConfirmedActionResult });
    assert.equal(calls, 2); assert.deepEqual(result.payload, receipt);
  });
}

test('definitive business rejection and retryable status preserve their real HTTP results', async () => {
  for (const status of [400, 401, 409, 408, 429, 500, 503]) {
    let calls = 0;
    const result = await fetchConfirmedGameWrite(async () => { calls += 1; return Response.json({ message: 'server decision' }, { status }); }, '/orders', init, { timeoutMs: 50 });
    assert.equal(calls, 1); assert.equal(result.response.status, status);
    assert.equal(isUnconfirmedWriteStatus(status), [408, 429, 500, 503].includes(status));
  }
});

test('confirmation has a fresh signal even if the first caller signal was aborted', async () => {
  const caller = new AbortController();
  let calls = 0;
  const result = await fetchConfirmedGameWrite(async (_, request) => {
    calls += 1;
    if (calls === 1) { caller.abort(); return new Promise<Response>(() => {}); }
    assert.equal(request?.signal?.aborted, false);
    return response();
  }, '/orders', init, { timeoutMs: 50, signal: caller.signal });
  assert.equal(calls, 2); assert.deepEqual(result.payload, receipt);
});

test('a request already aborted before send is not retried into a new economic action', async () => {
  const controller = new AbortController(); controller.abort();
  let calls = 0;
  await assert.rejects(fetchConfirmedGameWrite(async () => { calls += 1; return response(); }, '/orders', init,
    { timeoutMs: 50, signal: controller.signal }), { name: 'AbortError' });
  assert.equal(calls, 0);
});
