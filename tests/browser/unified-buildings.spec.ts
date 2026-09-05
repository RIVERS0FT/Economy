import { expect, test, type Page } from '@playwright/test';

async function openRegional(page: Page, scenario = 'activity') {
  await page.goto(`runtime-test.html?view=regional-buildings&scenario=${scenario}`);
  await expect(page.getByRole('tab', { name: '商业', exact: true })).toBeVisible();
  await page.getByRole('tab', { name: '商业', exact: true }).click();
  await expect(page.locator('.unified-regional-buildings')).toBeVisible();
}
async function filter(page: Page, label: '全部' | '商业建筑' | '工业建筑') {
  const disclosure = page.locator('.building-type-filter');
  if (!(await disclosure.evaluate((element) => (element as HTMLDetailsElement).open))) await disclosure.locator('summary').click();
  await disclosure.getByRole('button', { name: label, exact: true }).click();
  await expect(disclosure.getByRole('button', { name: label, exact: true })).toHaveAttribute('aria-pressed', 'true');
}
async function updateGroup(page: Page, patch: Record<string, unknown>) {
  await page.evaluate((value) => {
    (window as unknown as { __updateCommercialGroup: (id: string, patch: Record<string, unknown>) => void }).__updateCommercialGroup('convenience-store', value);
  }, patch);
}
async function assertNoOverflow(page: Page) {
  const widths = await page.locator('.page-content--player, .global-buildings-page, .unified-regional-buildings, .building-detail-page').evaluateAll(
    (elements) => elements.map((element) => ({ scroll: element.scrollWidth, client: element.clientWidth })),
  );
  expect(widths.length).toBeGreaterThan(0);
  for (const width of widths) expect(width.scroll).toBeLessThanOrEqual(width.client + 1);
}
async function openConvenienceDetail(page: Page) {
  await openRegional(page);
  await page.locator('.commercial-building-card').first().click();
  await expect(page.locator('.building-detail-page[data-building-kind="commercial"]')).toBeVisible();
}

for (const width of [320, 1440]) {
  test(`global catalog filters both building kinds at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('runtime-test.html?view=unified-buildings&scenario=activity');
    const rows = page.locator('.global-facility-catalog-row');
    await expect(rows).toHaveCount(7);
    await expect(page.locator('.building-type-filter')).not.toHaveAttribute('open');
    await expect(rows.filter({ hasText: '便利店' }).locator('.global-facility-catalog-row__metric').last()).toHaveText('10');
    await filter(page, '商业建筑');
    await expect(rows).toHaveCount(6);
    await expect(rows.locator('.global-facility-catalog-row__quick-controls')).toHaveCount(0);
    await expect(rows.locator('[data-commercial-artwork]')).toHaveCount(6);
    await assertNoOverflow(page);
    await filter(page, '工业建筑');
    await expect(rows).toHaveCount(1);
    await expect(rows.locator('.global-facility-catalog-row__quick-controls')).toHaveCount(1);
    await filter(page, '全部');
    await expect(rows).toHaveCount(7);
  });
  test(`regional directory and both shared details remain usable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await openRegional(page);
    await expect(page.getByRole('tab')).toHaveCount(5);
    await expect(page.getByRole('tab', { name: '商业', exact: true })).toBeVisible();
    await expect(page.locator('.unified-building-list')).toHaveCount(1);
    await expect(page.locator('.unified-building-list > .facility-cluster-selector-card')).toHaveCount(6);
    await expect(page.locator('.commercial-building-card').first().locator('.facility-cluster-count')).toHaveText('3');
    await expect(page.locator('.building-type-filter')).toHaveCount(0);
    await expect(page.locator('.unified-building-list > .facility-cluster-selector-card')).toHaveCount(6);
    await expect(page.locator('.production-build-card:not(.commercial-build-card)')).toHaveCount(0);
    await page.locator('.commercial-building-card').first().click();
    const detail = page.locator('.building-detail-page');
    await expect(detail).toHaveAttribute('data-building-kind', 'commercial');
    await expect(detail.locator('.facility-production-formula')).toHaveCount(1);
    await expect(detail.locator('.facility-production-formula-heading')).toHaveText('经营结算');
    await expect(detail.locator('.facility-production-settings')).toHaveCount(0);
    const label = await detail.locator('.facility-auto-operation__header > strong').boundingBox();
    const control = await detail.locator('.facility-auto-operation__header .ui-switch').boundingBox();
    expect(label).not.toBeNull(); expect(control).not.toBeNull();
    expect(Math.abs((label!.y + label!.height / 2) - (control!.y + control!.height / 2))).toBeLessThanOrEqual(2);
    await assertNoOverflow(page);
    await page.locator('.page-navigation-button--back').click();
    await expect(page.locator('.unified-building-list > .facility-cluster-selector-card')).toHaveCount(6);
    await expect(page.getByRole('tab', { name: '商业', exact: true })).toHaveAttribute('aria-selected', 'true');
    await page.getByRole('tab', { name: '工业', exact: true }).click();
    await page.locator('.unified-building-list > .facility-cluster-selector-card').first().click();
    await expect(detail).toHaveAttribute('data-building-kind', 'industrial');
    await expect(page.getByRole('tablist')).toHaveCount(0);
    await expect(detail.locator('.facility-production-formula-heading')).toHaveText('生产结算');
    await expect(detail.locator('.facility-auto-operation__header')).toContainText('自动经营');
    await assertNoOverflow(page);
  });
}

test('global commerce restores its region, detail and filtered catalog', async ({ page }) => {
  await page.goto('runtime-test.html?view=unified-buildings&scenario=activity');
  await filter(page, '商业建筑');
  await page.locator('.global-facility-catalog-row').filter({ hasText: '便利店' }).locator('button').click();
  await expect(page.locator('.global-facility-region-row')).toHaveCount(2);
  const target = page.locator('.global-facility-region-row[data-province-id="120000"]');
  await expect(target.locator('.global-facility-region-row__metric')).toHaveText('7');
  await target.locator('button').click();
  await expect(page.locator('[data-drilldown-province-id="120000"] .building-detail-page')).toBeVisible();
  await expect(page.locator('.facility-information-total')).toContainText('7');
  await page.locator('.regional-entity-title__region-button').click();
  await expect(page.getByRole('tab', { name: '概览', exact: true })).toHaveAttribute('aria-selected', 'true');
  await page.locator('.page-navigation-button--back').click();
  await expect(page.locator('[data-drilldown-province-id="120000"] .building-detail-page')).toBeVisible();
  await page.locator('.page-navigation-button--back').click();
  await expect(page.locator('.global-facility-region-row')).toHaveCount(2);
  await page.locator('.page-navigation-button--back').click();
  await expect(page.locator('.global-facility-catalog-row')).toHaveCount(6);
});

test('commercial automatic operation is independent and prevents duplicate requests', async ({ page }) => {
  const requests: Record<string, unknown>[] = [];
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  await page.route('**/economy-api/game/commercial-buildings', async (route) => {
    const payload = route.request().postDataJSON(); requests.push(payload);
    if (requests.length === 1) await gate;
    await updateGroup(page, { autoOperationPolicy: payload.policy });
    await route.fulfill({ json: { result: { ok: true, message: '自动经营策略已保存' } } });
  });
  await openConvenienceDetail(page);
  const auto = page.locator('.facility-auto-operation__header .ui-switch');
  const running = page.locator('.facility-information-summary .ui-switch');
  await expect(auto).toBeChecked(); await auto.click();
  await expect(auto).toBeDisabled(); await expect(running).toBeDisabled();
  await auto.evaluate((element) => (element as HTMLInputElement).click());
  await expect.poll(() => requests.length).toBe(1); release();
  await expect(auto).not.toBeChecked(); await expect(running).toBeChecked();
  expect(requests[0]).toMatchObject({ operation: 'auto-operation', provinceId: '110000', commercialTypeId: 'convenience-store', policy: { enabled: false, inputCoverageCycles: 2 } });
  await auto.click(); await expect(auto).toBeChecked();
  const coverage = page.getByRole('combobox', { name: '便利店商品保障', exact: true });
  await coverage.click(); await page.getByRole('option', { name: '5 个营业周期', exact: true }).click();
  await expect.poll(() => requests.length).toBe(3);
  expect(requests[2]).toMatchObject({ policy: { enabled: true, inputCoverageCycles: 5 } });
  await expect(coverage).toContainText('5 个营业周期');
  await expect(page.getByText('本周期锁定利润', { exact: true }).locator('..')).toContainText('5.00');
});

test('failed commercial policy save preserves the authoritative setting', async ({ page }) => {
  await page.route('**/economy-api/game/commercial-buildings', (route) => route.fulfill({ json: { result: { ok: false, message: '自动经营策略无效' } } }));
  await openConvenienceDetail(page);
  const auto = page.locator('.facility-auto-operation__header .ui-switch');
  await auto.click(); await expect(page.getByRole('alert')).toHaveText('自动经营策略无效');
  await expect(auto).toBeChecked(); await expect(auto).toBeEnabled();
  await expect(page.locator('.facility-information-summary .ui-switch')).toBeChecked();
});

test('commercial goods open the same local product and return without trading', async ({ page }) => {
  const mutations: string[] = [];
  page.on('request', (request) => { if (request.method() === 'POST') mutations.push(request.url()); });
  await openConvenienceDetail(page);
  const regionName = await page.locator('.regional-entity-title__region-button').textContent();
  await page.locator('.commercial-settlement .facility-formula-item-group').first().click();
  await expect(page.locator('.regional-entity-title__name')).toHaveText('食品');
  await expect(page.locator('.regional-entity-title__region-button')).toHaveText(regionName!);
  await page.locator('.page-navigation-button--back').click();
  await expect(page.locator('.building-detail-page[data-building-kind="commercial"]')).toBeVisible();
  expect(mutations).toEqual([]);
});

test('legacy unknown settlement detail stays unknown and empty commerce retains construction', async ({ page }) => {
  await openConvenienceDetail(page);
  await updateGroup(page, { pendingInputs: null, pendingOperatingCost: null, pendingInputValue: null });
  await expect(page.locator('.commercial-settlement')).toContainText('锁定明细待确认');
  await expect(page.getByText('本周期锁定商品价值', { exact: true }).locator('..')).toContainText('—');
  await expect(page.getByText('本周期锁定收入', { exact: true }).locator('..')).toContainText('101.25');
  await openRegional(page, 'empty');
  await expect(page.locator('.commercial-build-card')).toBeVisible();
  await expect(page.locator('.unified-building-list .facility-cluster-selector-card')).toHaveCount(0);
  await expect(page.getByText('当前地区尚未拥有商业建筑。')).toBeVisible();
});
