import { expect, test, type Page, type Route } from '@playwright/test';

const quoteUrl = '**/economy-api/game/facility-build-quote?*';
const quoteBody = (estimatedTotal = 20, price = 10) => ({
  revision: 1, serverNow: Date.UTC(2026, 8, 8),
  quote: { complete: true, estimatedTotal, missingQuantity: 2,
    materialPriceCaps: { timber: price }, materialOrderPrices: { timber: price },
    unavailableProductIds: [], selfCrossingProductIds: [] },
});
const shopSummary = {
  gems: 1_300, credits: 467_000_000, quoteDateKey: '2026-09-08', nextRateAt: Date.UTC(2026, 8, 9),
  creditsPerGem: 100, quoteDecision: 'pending', minExchangeGems: 1, maxExchangeGems: 100,
  maxExchangeableGems: 100, totalGemsSpent: 0, totalCreditsReceived: 0, recentExchanges: [],
};

interface Controls {
  patch: (changes: Record<string, unknown>) => void;
  writes: Array<{ kind: string; body: Record<string, unknown> }>;
  notices: string[];
}

async function patch(page: Page, changes: Record<string, unknown>) {
  await page.evaluate(async (value) => {
    (window as unknown as { actionReadiness: Controls }).actionReadiness.patch(value);
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  }, changes);
}

async function writes(page: Page) {
  return page.evaluate(() => (window as unknown as { actionReadiness: Controls }).actionReadiness.writes);
}

async function openHarness(page: Page, mode = 'build') {
  await page.route(/\/action-readiness-harness(?:\?.*)?$/, (route) => route.fulfill({
    contentType: 'text/html',
    body: '<!doctype html><html lang="zh-CN"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Action readiness</title><div id="root"></div><script type="module" src="/economy/tests/browser/action-readiness-harness.tsx"></script></html>',
  }));
  await page.route(/\/.*invitation[^/]*(?:\?.*)?$/, (route) => route.fulfill({ status: 503, json: { message: '邀请读取暂不可用' } }));
  await page.goto(`action-readiness-harness?mode=${mode}`);
  await page.waitForFunction(() => Boolean((window as unknown as { actionReadiness?: Controls }).actionReadiness));
}

async function ignoreQuoteAbort(page: Page) {
  await page.addInitScript(() => {
    const nativeFetch = window.fetch.bind(window);
    window.fetch = (input, init) => nativeFetch(input,
      String(input).includes('/facility-build-quote?') ? { ...init, signal: undefined } : init);
  });
}

test('farm and covered-material construction never depend on quote reads, including reference churn and remount', async ({ page }) => {
  let quotes = 0;
  await page.route(quoteUrl, (route) => { quotes += 1; return route.fulfill({ status: 503, json: { message: '不应请求报价' } }); });
  await openHarness(page);
  await expect(page.getByRole('button', { name: '立即建造农场', exact: true })).toBeEnabled();
  for (let noise = 1; noise <= 3; noise += 1) {
    await patch(page, { noise });
    await expect(page.getByRole('button', { name: '立即建造农场', exact: true })).toBeEnabled();
  }
  await patch(page, { typeId: 'ranch', timber: 100 });
  await expect(page.getByRole('button', { name: '立即建造牧场', exact: true })).toBeEnabled();
  await patch(page, { visible: false });
  await patch(page, { visible: true, typeId: 'farm' });
  await expect(page.getByRole('button', { name: '立即建造农场', exact: true })).toBeEnabled();
  expect(quotes).toBe(0);
});

test('a missing-material quote survives unrelated polls and funds changes without restarting', async ({ page }) => {
  const requests: Route[] = [];
  await page.route(quoteUrl, (route) => { requests.push(route); });
  await openHarness(page);
  await patch(page, { typeId: 'ranch' });
  const build = page.getByRole('button', { name: '一键购齐并建造牧场', exact: true });
  await expect(build).toBeDisabled();
  await expect.poll(() => requests.length).toBe(1);
  for (let noise = 1; noise <= 4; noise += 1) await patch(page, { noise });
  expect(requests).toHaveLength(1);
  await requests[0].fulfill({ json: quoteBody() });
  await expect(build).toBeEnabled();
  await patch(page, { credits: 125, noise: 5 });
  await expect(build).toBeDisabled();
  await expect(page.getByText(/建造与采购总资金不足/)).toBeVisible();
  await patch(page, { credits: 1_000, noise: 6 });
  await expect(build).toBeEnabled();
  expect(requests).toHaveLength(1);
});

test('switching to a farm or covering the shortage immediately releases a slow quote, even when abort is ignored', async ({ page }) => {
  await ignoreQuoteAbort(page);
  const requests: Route[] = [];
  await page.route(quoteUrl, (route) => { requests.push(route); });
  await openHarness(page);
  await patch(page, { typeId: 'ranch' });
  await expect.poll(() => requests.length).toBe(1);
  await patch(page, { typeId: 'farm' });
  await expect(page.getByRole('button', { name: '立即建造农场', exact: true })).toBeEnabled();
  await requests[0].fulfill({ status: 503, json: { message: '旧请求失败' } });
  await expect(page.getByRole('button', { name: '立即建造农场', exact: true })).toBeEnabled();
  await expect(page.getByText(/旧请求失败/)).toHaveCount(0);
  await patch(page, { typeId: 'ranch' });
  await expect.poll(() => requests.length).toBe(2);
  await patch(page, { timber: 2 });
  await expect(page.getByRole('button', { name: '立即建造牧场', exact: true })).toBeEnabled();
  await requests[1].fulfill({ json: quoteBody(999) });
  await expect(page.getByRole('button', { name: '立即建造牧场', exact: true })).toBeEnabled();
  await expect(page.getByText('预计采购', { exact: true })).toHaveCount(0);
});

test('quote results are isolated by quantity, province, player, save, shortage, and relevant price', async ({ page }) => {
  await ignoreQuoteAbort(page);
  const requests: Route[] = [];
  await page.route(quoteUrl, (route) => { requests.push(route); });
  await openHarness(page);
  await patch(page, { typeId: 'ranch' });
  await expect.poll(() => requests.length).toBe(1);
  const changes = [
    { quantity: 5 }, { provinceId: '120000' }, { userId: 902 }, { saveEpoch: 1 },
    { timber: 1 }, { price: 12 }, { quantity: 1, provinceId: '110000', userId: 901, saveEpoch: 0, timber: 0, price: 10 },
  ];
  for (let index = 0; index < changes.length; index += 1) {
    await patch(page, changes[index]);
    await expect.poll(() => requests.length).toBe(index + 2);
  }
  const build = page.getByRole('button', { name: '一键购齐并建造牧场', exact: true });
  await expect(build).toBeDisabled();
  // The first and final queries have the same key. The old request must still be ignored.
  await requests[0].fulfill({ json: quoteBody(9_999) });
  await expect(build).toBeDisabled();
  await requests.at(-1)!.fulfill({ json: quoteBody(20) });
  await expect(build).toBeEnabled();
  for (const request of requests.slice(1, -1).reverse()) {
    await request.fulfill({ status: 503, json: { message: '旧上下文不可用' } });
  }
  await expect(build).toBeEnabled();
  await expect(page.getByText(/旧上下文不可用/)).toHaveCount(0);
  await expect(page.locator('.ui-data-row').filter({ hasText: '预计采购' })).toContainText('20.00');
});

test('failed and incomplete quotes have a read-only retry and cannot submit construction', async ({ page }) => {
  let quotes = 0;
  await page.route(quoteUrl, (route) => {
    quotes += 1;
    if (quotes === 1) return route.fulfill({ status: 503, json: { message: '报价暂不可用' } });
    const body = quoteBody();
    if (quotes === 2) body.quote.complete = false;
    if (quotes === 3) body.quote.materialPriceCaps = {} as { timber: number };
    return route.fulfill({ json: body });
  });
  await openHarness(page);
  await patch(page, { typeId: 'ranch' });
  const retry = page.getByRole('button', { name: '重试采购报价', exact: true });
  await expect(retry).toBeEnabled();
  for (let attempt = 2; attempt <= 3; attempt += 1) {
    await retry.click();
    await expect.poll(() => quotes).toBe(attempt);
    await expect(retry).toBeEnabled();
  }
  expect(await writes(page)).toHaveLength(0);
  await retry.click();
  await expect(page.getByRole('button', { name: '一键购齐并建造牧场', exact: true })).toBeEnabled();
  expect(quotes).toBe(4);
  expect(await writes(page)).toHaveLength(0);
});

test('hidden construction does not fetch quotes and a shown form requests the current context', async ({ page }) => {
  let quotes = 0;
  await page.route(quoteUrl, (route) => { quotes += 1; return route.fulfill({ json: quoteBody() }); });
  await openHarness(page);
  await patch(page, { part: 'cards', typeId: 'ranch' });
  expect(quotes).toBe(0);
  await patch(page, { part: 'build' });
  await expect(page.getByRole('button', { name: '一键购齐并建造牧场', exact: true })).toBeEnabled();
  expect(quotes).toBe(1);
});

for (const ok of [true, false]) {
  test(`construction submission releases on a ${ok ? 'success' : 'failure'} receipt, not on notification completion`, async ({ page }) => {
    const requests: Route[] = [];
    await page.route('**/readiness-write/build', (route) => { requests.push(route); });
    await openHarness(page);
    await patch(page, { holdNotice: true });
    const build = page.getByRole('button', { name: '立即建造农场', exact: true });
    const before = await build.boundingBox();
    await build.evaluate((element: HTMLButtonElement) => { element.click(); element.click(); });
    await expect.poll(() => requests.length).toBe(1);
    const pending = page.getByRole('button', { name: '正在建造…', exact: true });
    await expect(pending).toBeDisabled();
    await expect(pending).toHaveAttribute('aria-busy', 'true');
    const during = await pending.boundingBox();
    expect(during!.width).toBeCloseTo(before!.width, 1);
    expect(during!.height).toBeCloseTo(before!.height, 1);
    await requests[0].fulfill({ json: { ok, message: ok ? '建造成功' : '资金已变化' } });
    await expect(build).toBeEnabled();
    expect(await writes(page)).toHaveLength(1);
  });
}

for (const action of ['exchange', 'reject'] as const) {
  for (const refresh of ['stale', 'failure', 'next-day'] as const) {
    test(`shop ${action} acknowledges before a ${refresh} summary refresh`, async ({ page }) => {
      let armed = false;
      const refreshRequests: Route[] = [];
      await page.route('**/economy-api/game/gem-shop', (route) => {
        if (armed) { refreshRequests.push(route); return; }
        return route.fulfill({ json: { gemShop: shopSummary } });
      });
      const mutations: Route[] = [];
      await page.route('**/readiness-write/*', (route) => { mutations.push(route); });
      await openHarness(page, 'shop');
      await expect(page.getByRole('button', { name: '确认兑换', exact: true })).toBeEnabled();
      await patch(page, { holdNotice: true });
      // Arm only after initial readiness; StrictMode may issue multiple cold reads.
      armed = true;
      await page.getByRole('button', { name: action === 'exchange' ? '确认兑换' : '放弃今日报价', exact: true }).click();
      await expect.poll(() => mutations.length).toBe(1);
      await expect(page.getByRole('button', { name: action === 'exchange' ? '兑换处理中…' : '提交处理中…', exact: true })).toBeDisabled();
      await mutations[0].fulfill({ json: { ok: true, message: '报价决策成功' } });
      const completed = action === 'exchange' ? '今日报价已经使用，请等待明日新报价。' : '今日报价已经放弃，请等待明日新报价。';
      await expect(page.getByText(completed, { exact: true })).toBeVisible();
      await expect.poll(() => refreshRequests.length).toBe(1);
      await expect(page.getByRole('button', { name: /处理中/ })).toHaveCount(0);
      if (refresh === 'failure') await refreshRequests[0].fulfill({ status: 503, json: { message: '摘要读取失败' } });
      else await refreshRequests[0].fulfill({ json: { gemShop: refresh === 'next-day'
        ? { ...shopSummary, quoteDateKey: '2026-09-09', nextRateAt: Date.UTC(2026, 8, 10) }
        : shopSummary } });
      if (refresh === 'next-day') await expect(page.getByRole('button', { name: '确认兑换', exact: true })).toBeEnabled();
      else {
        await expect(page.getByText(completed, { exact: true })).toBeVisible();
        await expect(page.getByRole('button', { name: '确认兑换', exact: true })).toHaveCount(0);
      }
      if (refresh === 'failure') await expect.poll(() => page.evaluate(() =>
        (window as unknown as { actionReadiness: Controls }).actionReadiness.notices.some((notice) => notice.includes('商店数据刷新失败')))).toBe(true);
      expect(await writes(page)).toHaveLength(1);
    });
  }
}

test('a failed shop decision stays pending and never starts a success refresh', async ({ page }) => {
  let armed = false;
  let refreshes = 0;
  await page.route('**/economy-api/game/gem-shop', (route) => {
    if (armed) refreshes += 1;
    return route.fulfill({ json: { gemShop: shopSummary } });
  });
  await page.route('**/readiness-write/exchange', (route) => route.fulfill({ json: { ok: false, message: '宝石余额已变化' } }));
  await openHarness(page, 'shop');
  const submit = page.getByRole('button', { name: '确认兑换', exact: true });
  await expect(submit).toBeEnabled();
  armed = true;
  await submit.click();
  await expect.poll(async () => (await writes(page)).length).toBe(1);
  await expect(submit).toBeEnabled();
  await expect(page.getByText('已接受', { exact: true })).toHaveCount(0);
  expect(refreshes).toBe(0);
});
