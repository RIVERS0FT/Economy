import { expect, test, type Page } from '@playwright/test';

async function openDetail(page: Page) {
  await page.goto('runtime-test.html?view=commerce&scenario=activity');
  await page.locator('.commercial-building-card').first().click();
  await expect(page.locator('.commercial-settlement')).toBeVisible();
}
async function patch(page: Page, value: Record<string, unknown>) {
  await page.evaluate((patch) => {
    (window as unknown as { __updateCommercialGroup: (id: string, value: Record<string, unknown>) => void }).__updateCommercialGroup('convenience-store', patch);
  }, value);
}

for (const width of [320, 390, 720, 1440]) {
  test(`commercial staffing and cycle tracks remain distinct at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await openDetail(page);
    await patch(page, { staffingRateBps: 5000, staffingUpdatedAt: Date.now(), enabled: true, status: 'running' });
    const staffing = page.getByRole('progressbar', { name: '便利店满员率', exact: true });
    const cycle = page.getByRole('progressbar', { name: '营业周期进度', exact: true });
    await expect(staffing).toHaveAttribute('aria-valuenow', '50');
    await expect(staffing).toContainText('恢复中');
    await expect(cycle).toBeVisible();
    await expect(page.locator('.facility-information-summary .facility-staffing-summary')).toHaveCount(1);
    await expect(page.locator('.commercial-settlement .facility-staffing-summary')).toHaveCount(0);
    await expect(page.getByText('本周期锁定利润', { exact: true })).toHaveCount(0);
    await expect(page.locator('.commercial-settlement-revenue')).toContainText('101.25');
    const box = await staffing.boundingBox();
    expect(box).not.toBeNull();
    const style = await staffing.evaluate((element) => {
      const value = getComputedStyle(element);
      return { height: value.height, radius: value.borderRadius, border: value.borderWidth };
    });
    for (const size of await page.locator('.commercial-cluster-detail-page, .facility-information-summary').evaluateAll(
      (elements) => elements.map((element) => [element.scrollWidth, element.clientWidth]),
    )) expect(size[0]).toBeLessThanOrEqual(size[1] + 1);
    await page.goto('runtime-test.html?view=production&scenario=activity');
    await page.locator('.facility-cluster-selector-card').first().click();
    const industrial = page.locator('.facility-staffing-track');
    await expect(industrial).toBeVisible();
    expect(await industrial.evaluate((element) => {
      const value = getComputedStyle(element);
      return { height: value.height, radius: value.borderRadius, border: value.borderWidth };
    })).toEqual(style);
  });
}

test('staffing changes never overwrite an invested commercial cycle or claim local settlement', async ({ page }) => {
  const mutations: string[] = [];
  page.on('request', (request) => { if (request.method() === 'POST') mutations.push(request.url()); });
  await openDetail(page);
  const progress = page.getByRole('progressbar', { name: '便利店满员率', exact: true });
  const settlementRevenue = page.locator('.commercial-settlement-revenue');
  await patch(page, { staffingRateBps: 5000, staffingUpdatedAt: Date.now(), enabled: false, status: 'running', count: 100 });
  await expect(progress).toHaveAttribute('aria-valuenow', '50');
  await expect(progress).toContainText('下降中');
  await expect(settlementRevenue).toContainText('101.25');
  for (const label of ['本周期等效营业数量', '本周期锁定收入', '本周期锁定商品价值', '本周期已付运营成本', '本周期锁定利润']) {
    await expect(page.getByText(label, { exact: true })).toHaveCount(0);
  }
  await patch(page, { staffingRateBps: 0, staffingUpdatedAt: Date.now() });
  await expect(progress).toHaveAttribute('aria-valuenow', '0');
  await expect(progress).toContainText('已降至最低');
  await expect(settlementRevenue).toContainText('101.25');
  await expect(page.getByText('累计营业收入', { exact: true }).locator('..')).toContainText('200.00');
  expect(mutations).toEqual([]);
});

test('missing staffing is unknown without fabricating a visible locked-detail list', async ({ page }) => {
  await openDetail(page);
  await patch(page, { staffingRateBps: null, staffingUpdatedAt: null, pendingEffectiveCount: null });
  const staffing = page.getByRole('progressbar', { name: '便利店满员率', exact: true });
  await expect(staffing).not.toHaveAttribute('aria-valuenow');
  await expect(staffing).toContainText('满员率待同步');
  await expect(page.getByText('本周期等效营业数量', { exact: true })).toHaveCount(0);
  await expect(page.getByText('本周期锁定利润', { exact: true })).toHaveCount(0);
  await expect(page.locator('.commercial-settlement-revenue')).toContainText('101.25');
});
