import { expect, test } from '@playwright/test';

const configurations = [
  { name: 'single recipe', path: '/facilities/farm/recipe', body: { provinceId: '110000', recipeId: 'rice-crop' } },
  { name: 'batch recipes', path: '/facilities/recipes', body: { targets: [
    { provinceId: '110000', facilityTypeId: 'farm', recipeId: 'rice-crop' },
    { provinceId: '120000', facilityTypeId: 'farm', recipeId: 'cotton-crop' },
  ] } },
  { name: 'factory policy', path: '/orders', body: { execution: 'factory-auto-operation-policy', provinceId: '110000', facilityTypeId: 'farm', policy: { enabled: true, inputCoverageCycles: 5 } } },
  { name: 'commercial policy', path: '/commercial-buildings', body: { operation: 'auto-operation', provinceId: '110000', commercialTypeId: 'convenience-store', policy: { enabled: true, inputCoverageCycles: 5 } } },
];

test.beforeEach(async ({ page }) => {
  await page.route('**/configuration-write-harness', (route) => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Configuration write identity</title>' }));
  await page.goto('configuration-write-harness');
});

for (const configuration of configurations) {
  test(`${configuration.name} confirms the same request after the production proposal changes`, async ({ page }) => {
    const result = await page.evaluate(async (config) => {
      const moduleUrl = '/economy/src/api/idempotentGameWriteFetch.ts';
      const sessionUrl = '/economy/src/api/gameWriteSession.ts';
      const { createIdempotentGameWriteFetch } = await import(moduleUrl);
      const { beginGameWriteSession } = await import(sessionUrl);
      beginGameWriteSession(901);
      const calls: { key: string; body: string }[] = [];
      const client = createIdempotentGameWriteFetch(async (_input: RequestInfo | URL, init: RequestInit) => {
        calls.push({ key: new Headers(init.headers).get('Idempotency-Key')!, body: String(init.body) });
        return calls.length === 1 ? Response.json({ message: 'unknown' }, { status: 503 })
          : Response.json({ result: { ok: true, message: 'confirmed' }, revision: 2 });
      });
      const send = (key: string, basisId: string) => client('/economy-api/game' + config.path, {
        method: 'POST', headers: { 'Idempotency-Key': key, 'X-Economy-Save-Epoch': '3' },
        body: JSON.stringify({ ...config.body, productionSettlement: { basisId } }),
      });
      await send('configuration-original', 'before-poll');
      await send('configuration-must-not-replace-key', 'after-poll');
      // Once confirmed, a later deliberate operation is independent of the old reservation.
      await send('configuration-next-operation', 'later-poll');
      return calls;
    }, configuration);
    expect(result.map((call) => call.key)).toEqual(['configuration-original', 'configuration-original', 'configuration-next-operation']);
    expect(new Set(result.map((call) => call.body)).size).toBe(1);
    for (const call of result) expect(JSON.parse(call.body)).toEqual(configuration.body);
  });
}

test('non-configuration writes retain their production settlement proposal', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const moduleUrl = '/economy/src/api/idempotentGameWriteFetch.ts';
    const sessionUrl = '/economy/src/api/gameWriteSession.ts';
    const { createIdempotentGameWriteFetch } = await import(moduleUrl);
    const { beginGameWriteSession } = await import(sessionUrl);
    beginGameWriteSession(902);
    const bodies: unknown[] = [];
    const client = createIdempotentGameWriteFetch(async (_input: RequestInfo | URL, init: RequestInit) => {
      bodies.push(JSON.parse(String(init.body)));
      return Response.json({ result: { ok: true, message: 'confirmed' }, revision: 1 });
    });
    for (const path of ['/production/settle', '/facilities']) {
      await client('/economy-api/game' + path, { method: 'POST',
        headers: { 'Idempotency-Key': 'non-config-' + path, 'X-Economy-Save-Epoch': '3' },
        body: JSON.stringify({ provinceId: '110000', productionSettlement: { basisId: 'required-proposal' } }),
      });
    }
    return bodies;
  });
  expect(result).toEqual(Array(2).fill({ provinceId: '110000', productionSettlement: { basisId: 'required-proposal' } }));
});
