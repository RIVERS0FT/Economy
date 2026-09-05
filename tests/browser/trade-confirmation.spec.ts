import { expect, test, type Page } from '@playwright/test';

const receipt = { result: { ok: true, message: '成交完成' }, revision: 10 };
const order = { provinceId: '110000', assetKind: 'commodity', assetId: 'food', productId: 'food', side: 'buy', quantity: 2 };

async function bootCoordinator(page: Page) {
  await page.goto('runtime-test.html?view=commerce&scenario=activity');
  await page.evaluate(async () => {
    const path = '/src/api/idempotentGameWriteFetch.ts';
    const module = await import(/* @vite-ignore */ path);
    module.installIdempotentGameWriteFetch();
  });
}
async function rawOrder(page: Page, key: string) {
  return page.evaluate(async ({ body, key }) => {
    try {
      const response = await fetch('/economy-api/game/orders', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key, 'X-Economy-Save-Epoch': '0' },
        body: JSON.stringify(body),
      });
      return { status: response.status, payload: await response.json() };
    } catch (error) {
      return { code: (error as { code?: string }).code };
    }
  }, { body: order, key });
}

test('concurrent identical writes share one HTTP attempt and each receives its own readable receipt', async ({ page }) => {
  let count = 0;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  await page.route('**/economy-api/game/orders', async (route) => { count += 1; await gate; await route.fulfill({ json: receipt }); });
  await bootCoordinator(page);
  const first = rawOrder(page, 'original-concurrent-key');
  const second = rawOrder(page, 'different-proposed-key');
  await expect.poll(() => count).toBe(1);
  release();
  expect(await first).toEqual({ status: 200, payload: receipt });
  expect(await second).toEqual({ status: 200, payload: receipt });
  expect(count).toBe(1);
});

test('two lost receipts retain one key across reload and successful confirmation releases it', async ({ page }) => {
  const keys: string[] = [];
  await page.route('**/economy-api/game/orders', async (route) => {
    keys.push(route.request().headers()['idempotency-key']);
    if (keys.length <= 2) await route.abort('failed');
    else await route.fulfill({ json: receipt });
  });
  await bootCoordinator(page);
  expect(await rawOrder(page, 'original-lost-receipt')).toEqual({ code: 'WRITE_RESULT_UNCONFIRMED' });
  expect(keys).toEqual(['original-lost-receipt', 'original-lost-receipt']);
  const stored = await page.evaluate(() => sessionStorage.getItem('economy.pending-write-idempotency.v1'));
  expect(stored).toContain('original-lost-receipt');
  expect(stored).not.toContain('food');
  await bootCoordinator(page);
  expect(await rawOrder(page, 'new-proposed-after-reload')).toEqual({ status: 200, payload: receipt });
  expect(keys[2]).toBe('original-lost-receipt');
  await rawOrder(page, 'next-intent-after-confirmed');
  expect(keys[3]).toBe('next-intent-after-confirmed');
});

test('HTTP success with a broken receipt does not release the original transaction key', async ({ page }) => {
  const keys: string[] = [];
  await page.route('**/economy-api/game/orders', async (route) => {
    keys.push(route.request().headers()['idempotency-key']);
    if (keys.length === 1) await route.fulfill({ status: 200, contentType: 'application/json', body: '{"result":' });
    else await route.fulfill({ json: receipt });
  });
  await bootCoordinator(page);
  expect(await rawOrder(page, 'broken-body-key')).toEqual({ status: 200, payload: receipt });
  expect(keys).toEqual(['broken-body-key', 'broken-body-key']);
});

for (const side of ['buy', 'sell']) {
  test(`${side} controls freeze pending parameters and confirm even after funds or inventory change`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 1000 });
    await page.goto('runtime-test.html?view=trade-confirmation&scenario=activity');
    const entry = page.getByRole('region', { name: '商品交易' });
    // The section has an accessible name and contains the actual production MarketPage controls.
    await expect(page.locator('.market-immediate-trade')).toBeVisible();
    if (side === 'sell') await page.locator('.market-side-switch').getByRole('button', { name: '卖出', exact: true }).click();
    const submit = page.locator('.market-submit-order');
    await submit.click();
    await expect(submit).toBeDisabled();
    await expect(page.locator('.market-side-switch button')).toBeDisabled();
    await expect(page.locator('#market-trade-quantity')).toBeDisabled();
    await page.evaluate(() => {
      const fixture = (window as unknown as { __tradeFixture: { confirming: () => void } }).__tradeFixture;
      fixture.confirming();
    });
    await expect(submit).toHaveText('正在确认交易结果…');
    await page.evaluate(() => {
      const fixture = (window as unknown as { __tradeFixture: {
        resources: (value: { credits: number; available: number }) => void;
        resolve: (value: unknown) => void;
      } }).__tradeFixture;
      fixture.resources({ credits: 0, available: 0 });
      fixture.resolve({ ok: false, message: '交易结果尚未确认，请勿重复交易。', code: 'WRITE_RESULT_UNCONFIRMED' });
    });
    await expect(submit).toHaveText('确认交易结果');
    await expect(submit).toBeEnabled();
    await submit.click();
    const calls = await page.evaluate(() => (window as unknown as { __tradeFixture: { calls: () => unknown[][] } }).__tradeFixture.calls());
    expect(calls).toHaveLength(2);
    expect(calls[1]).toEqual(calls[0]);
    expect(calls[0].slice(0, 4)).toEqual(['commodity', 'machinery', side, 2]);
    await page.evaluate(() => (window as unknown as { __tradeFixture: { resolve: (value: unknown) => void } }).__tradeFixture.resolve({ ok: true, message: '成交完成' }));
    await expect(page.locator('.market-trade-feedback')).toHaveText('成交完成');
    await expect(page.locator('.market-side-switch button').first()).toBeEnabled();
    expect(await page.locator('.market-immediate-trade').evaluate((element) => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
  });
}
