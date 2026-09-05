import { expect, test, type Page } from '@playwright/test';

async function openCommerce(page: Page, scenario = 'activity') {
  await page.goto(`runtime-test.html?view=commerce&scenario=${scenario}`);
  await expect(page.locator('.commercial-build-card')).toBeVisible();
}

async function updateGroup(page: Page, patch: Record<string, unknown>) {
  await page.evaluate((value) => {
    const fixture = window as unknown as { __updateCommercialGroup: (id: string, patch: Record<string, unknown>) => void };
    fixture.__updateCommercialGroup('convenience-store', value);
  }, patch);
}

async function assertNoOverflow(page: Page) {
  const sizes = await page.locator('.page-content--player, .commercial-buildings-management, .commercial-cluster-detail-page').evaluateAll(
    (elements) => elements.map((element) => [element.scrollWidth, element.clientWidth]),
  );
  expect(sizes.length).toBeGreaterThan(0);
  for (const [scroll, client] of sizes) expect(scroll).toBeLessThanOrEqual(client + 1);
}

for (const width of [320, 390, 720, 1440]) {
  test(`commercial cards and details reuse industrial geometry at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await openCommerce(page);
    const cards = page.locator('.commercial-building-card');
    await expect(cards).toHaveCount(6);
    const columns = await page.locator('.commercial-cluster-selector-list').evaluate((element) => getComputedStyle(element).gridTemplateColumns);
    expect(columns.trim().split(/\s+/)).toHaveLength(3);
    const card = cards.first();
    const box = await card.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height / box!.width).toBeCloseTo(1.25, 1);
    const style = await card.evaluate((element) => {
      const computed = getComputedStyle(element);
      return { radius: computed.borderRadius, ratio: computed.aspectRatio, maxWidth: computed.maxWidth };
    });
    expect(style.maxWidth).toBe('none');
    await expect(cards.locator('[data-commercial-artwork]')).toHaveCount(6);
    await expect(card.locator('button')).toHaveCount(0);
    await expect(page.getByText('查看经营详情', { exact: true })).toHaveCount(0);
    await assertNoOverflow(page);
    await card.click();
    await expect(page.locator('.commercial-cluster-detail-page')).toBeVisible();
    await expect(page.locator('.commercial-cluster-selector-region')).toHaveCount(0);
    await expect(page.locator('.regional-entity-title')).toContainText('便利店');
    const summary = page.locator('.facility-information-summary');
    await expect(summary).toBeVisible();
    const control = summary.locator('.ui-switch');
    const pill = summary.locator('.ui-status-tag');
    const controlBox = await control.boundingBox();
    const pillBox = await pill.boundingBox();
    expect(controlBox).not.toBeNull();
    expect(pillBox).not.toBeNull();
    expect(Math.abs(controlBox!.height - pillBox!.height)).toBeLessThanOrEqual(1);
    await assertNoOverflow(page);
    await page.locator('.page-navigation-button--back').click();
    await expect(page.locator('.commercial-build-card')).toBeVisible();
    await page.goto('runtime-test.html?view=production&scenario=activity');
    const industrial = page.locator('.facility-cluster-selector-card').first();
    await expect(industrial).toBeVisible();
    expect(await industrial.evaluate((element) => {
      const computed = getComputedStyle(element);
      return { radius: computed.borderRadius, ratio: computed.aspectRatio, maxWidth: computed.maxWidth };
    })).toEqual(style);
  });
}

test('commercial cards show per-building profit and details show server-locked totals', async ({ page }) => {
  await openCommerce(page);
  const first = page.locator('.commercial-building-card').first();
  await expect(first.locator('.facility-cluster-profit')).toContainText('0.50');
  await first.focus();
  await first.press('Enter');
  await expect(page.locator('.facility-average-profit')).toContainText('0.50');
  await expect(page.getByText('集群额定利润／分钟', { exact: true }).locator('..')).toContainText('1.50');
  await expect(page.getByText('本周期锁定收入', { exact: true }).locator('..')).toContainText('101.25');
  await expect(page.getByText('本周期锁定利润', { exact: true }).locator('..')).toContainText('5.00');
  await expect(page.getByText('本周期锁定利润', { exact: true }).locator('..')).not.toContainText('7.50');
  await expect(page.locator('.commercial-consumption-item[data-shortage="true"]')).toHaveCount(2);
  await expect(page.locator('.commercial-consumption-item').first()).toContainText('库存不足');
  await expect(page.locator('.commercial-consumption-item button')).toHaveCount(0);
  await expect(page.getByText('满员率', { exact: true })).toHaveCount(0);
});

test('commercial switch prevents repeated requests and preserves an invested cycle after stop', async ({ page }) => {
  let requests = 0;
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  await page.route('**/economy-api/game/commercial-buildings', async (route) => {
    requests += 1;
    expect(route.request().postDataJSON()).toMatchObject({ operation: 'stop', commercialTypeId: 'convenience-store' });
    await gate;
    await route.fulfill({ json: { result: { ok: true, message: '已停止后续营业' } } });
  });
  await openCommerce(page);
  await page.locator('.commercial-building-card').first().click();
  const control = page.locator('.facility-information-summary .ui-switch');
  await expect(control).toBeChecked();
  await control.click();
  await expect(control).toBeDisabled();
  await control.evaluate((element) => (element as HTMLInputElement).click());
  await expect.poll(() => requests).toBe(1);
  await updateGroup(page, { enabled: false });
  release();
  await expect(control).toBeEnabled();
  await expect(control).not.toBeChecked();
  await expect(page.locator('.facility-information-summary .ui-status-tag')).toHaveText('营业中');
  await expect(page.getByText('已停止后续营业，本周期仍按锁定结果完成结算。')).toBeVisible();
  await expect(page.getByText('本周期锁定利润', { exact: true }).locator('..')).toContainText('5.00');
});

for (const failure of ['network', 'server'] as const) {
  test(`commercial ${failure} failure leaves the authoritative switch intact`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.route('**/economy-api/game/commercial-buildings', async (route) => {
      if (failure === 'network') await route.abort('failed');
      else await route.fulfill({ json: { result: { ok: false, message: '运营资金不足' } } });
    });
    await openCommerce(page);
    await page.locator('.commercial-building-card').first().click();
    const control = page.locator('.facility-information-summary .ui-switch');
    await control.click();
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(control).toBeEnabled();
    await expect(control).toBeChecked();
    expect(errors).toEqual([]);
  });
}

test('commercial countdown waits for the server and does not settle or restart locally', async ({ page }) => {
  let requests = 0;
  page.on('request', (request) => { if (request.url().includes('/economy-api/game/commercial-buildings')) requests += 1; });
  await openCommerce(page);
  await page.locator('.commercial-building-card').first().click();
  const now = Date.now();
  await updateGroup(page, { cycleStartedAt: now - 600_000, cycleCompletesAt: now - 300_000 });
  const progress = page.getByRole('progressbar', { name: '营业周期进度' });
  await expect(progress).toHaveAttribute('aria-valuenow', '100');
  await expect(progress).toContainText('等待服务器结算');
  await expect(page.getByText('累计营业收入', { exact: true }).locator('..')).toContainText('200.00');
  expect(requests).toBe(0);
});

test('commercial empty state and long names remain usable at 320px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await openCommerce(page, 'empty');
  await expect(page.locator('.commercial-building-card')).toHaveCount(0);
  await expect(page.getByText('尚未拥有商业建筑。先建设第一座商业建筑。')).toBeVisible();
  await openCommerce(page, 'commercial-long');
  await expect(page.locator('.commercial-building-card').first().locator('.facility-cluster-count')).toContainText('M');
  await assertNoOverflow(page);
  await page.locator('.commercial-building-card').first().click();
  await assertNoOverflow(page);
  await expect(page.locator('.regional-entity-title__name')).toContainText('超长名称');
});
