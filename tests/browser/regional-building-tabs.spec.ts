import { expect, test, type Page } from '@playwright/test';

const tab = (page: Page, name: string) => page.getByRole('tab', { name, exact: true });
const cards = (page: Page) => page.locator('.unified-building-list > .facility-cluster-selector-card');
async function openRegion(page: Page, scenario = 'activity') {
  await page.goto(`runtime-test.html?view=regional-buildings&scenario=${scenario}`);
  await expect(tab(page, '商业')).toBeVisible();
}
async function selectQuantity(page: Page, quantity: number) {
  const control = page.getByRole('combobox', { name: '建造数量', exact: true });
  await control.click();
  await page.getByRole('option', { name: String(quantity), exact: true }).click();
  await expect(control).toContainText(String(quantity));
}
async function switchProvince(page: Page, provinceId: string) {
  await page.evaluate((id) => {
    (window as unknown as { __setCommercialProvince: (value: string) => void }).__setCommercialProvince(id);
  }, provinceId);
  await expect(tab(page, '概览')).toHaveAttribute('aria-selected', 'true');
}

for (const width of [320, 390, 720, 1440]) {
  test(`five regional tabs separate categories without a filter at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    const mutations: string[] = [];
    page.on('request', (request) => { if (request.method() === 'POST') mutations.push(request.url()); });
    await openRegion(page);
    const tabs = page.getByRole('tab');
    await expect(tabs).toHaveText(['概览', '市场', '商业', '工业', '仓库']);
    const boxes = await tabs.evaluateAll((elements) => elements.map((element) => {
      const box = element.getBoundingClientRect();
      return { x: box.x, y: box.y, width: box.width, height: box.height, right: box.right };
    }));
    expect(Math.max(...boxes.map((box) => box.y)) - Math.min(...boxes.map((box) => box.y))).toBeLessThanOrEqual(1);
    for (const box of boxes) expect(box.height).toBeGreaterThanOrEqual(44);
    expect(boxes[4].right).toBeLessThanOrEqual(width);
    await tab(page, '商业').click();
    await expect(cards(page)).toHaveCount(6);
    await expect(page.locator('.commercial-build-card')).toBeVisible();
    await expect(page.locator('.building-type-filter, .production-build-card:not(.commercial-build-card)')).toHaveCount(0);
    await expect(cards(page).filter({ has: page.locator('[data-commercial-artwork]') })).toHaveCount(6);
    await tab(page, '工业').click();
    await expect(cards(page)).toHaveCount(1);
    await expect(page.locator('.production-build-card:not(.commercial-build-card)')).toBeVisible();
    await expect(page.locator('.building-type-filter, .commercial-building-card, .commercial-build-card')).toHaveCount(0);
    for (const container of await page.locator('.page-content--player, .unified-regional-buildings').all()) {
      expect(await container.evaluate((element) => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1);
    }
    expect(mutations).toEqual([]);
  });
}

test('regional keyboard navigation includes both categories and retains tab semantics', async ({ page }) => {
  await openRegion(page);
  await tab(page, '市场').click();
  await tab(page, '市场').focus();
  await tab(page, '市场').press('ArrowRight');
  await expect(tab(page, '商业')).toBeFocused();
  await expect(tab(page, '商业')).toHaveAttribute('aria-selected', 'true');
  await expect(cards(page)).toHaveCount(6);
  await tab(page, '商业').press('ArrowRight');
  await expect(tab(page, '工业')).toBeFocused();
  await expect(cards(page)).toHaveCount(1);
  await tab(page, '工业').press('End');
  await expect(tab(page, '仓库')).toBeFocused();
  await tab(page, '仓库').press('ArrowRight');
  await expect(tab(page, '概览')).toBeFocused();
  await tab(page, '概览').press('ArrowLeft');
  await expect(tab(page, '仓库')).toBeFocused();
  await tab(page, '仓库').press('Home');
  await expect(tab(page, '概览')).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tabpanel')).toHaveAttribute('aria-labelledby', 'province-section-tab-overview');
});

test('regional construction drafts survive category and detail returns without crossing provinces', async ({ page }) => {
  await openRegion(page);
  await tab(page, '商业').click();
  const type = page.getByRole('combobox', { name: '商业建筑类型', exact: true });
  await type.click();
  await page.getByRole('option', { name: '生鲜超市', exact: true }).click();
  await selectQuantity(page, 5);
  await tab(page, '工业').click();
  await expect(page.getByRole('combobox', { name: '建造数量', exact: true })).toContainText('1');
  await selectQuantity(page, 10);
  await tab(page, '商业').click();
  await expect(type).toContainText('生鲜超市');
  await expect(page.getByRole('combobox', { name: '建造数量', exact: true })).toContainText('5');
  await cards(page).first().click();
  await expect(page.getByRole('tablist')).toHaveCount(0);
  await expect(page.locator('.building-detail-page')).toHaveAttribute('data-building-kind', 'commercial');
  await page.locator('.regional-entity-title__region-button').click();
  await expect(tab(page, '概览')).toHaveAttribute('aria-selected', 'true');
  await page.locator('.page-navigation-button--back').click();
  await expect(page.locator('.building-detail-page')).toHaveAttribute('data-building-kind', 'commercial');
  await page.locator('.page-navigation-button--back').click();
  await expect(tab(page, '商业')).toHaveAttribute('aria-selected', 'true');
  await expect(type).toContainText('生鲜超市');
  await expect(page.getByRole('combobox', { name: '建造数量', exact: true })).toContainText('5');
  await switchProvince(page, '120000');
  await tab(page, '商业').click();
  await expect(type).toContainText('便利店');
  await expect(page.getByRole('combobox', { name: '建造数量', exact: true })).toContainText('1');
  await expect(cards(page)).toHaveCount(1);
  await switchProvince(page, '110000');
  await tab(page, '工业').click();
  await expect(page.getByRole('combobox', { name: '建造数量', exact: true })).toContainText('10');
  await tab(page, '商业').click();
  await expect(type).toContainText('生鲜超市');
  await expect(page.getByRole('combobox', { name: '建造数量', exact: true })).toContainText('5');
});

test('each empty regional category keeps its own construction form', async ({ page }) => {
  await openRegion(page, 'empty');
  for (const [name, label] of [['商业', '商业建筑'], ['工业', '工业建筑']]) {
    await tab(page, name).click();
    await expect(cards(page)).toHaveCount(0);
    await expect(page.getByText(`当前地区尚未拥有${label}。`, { exact: true })).toBeVisible();
    await expect(page.locator('.production-build-card')).toHaveCount(1);
    await expect(page.locator('.building-type-filter')).toHaveCount(0);
  }
});

test('without a page stack both building details return to their own regional tab', async ({ page }) => {
  await openRegion(page, 'no-navigation');
  for (const [name, kind] of [['商业', 'commercial'], ['工业', 'industrial']]) {
    await tab(page, name).click();
    await cards(page).first().click();
    await expect(page.locator('.building-detail-page')).toHaveAttribute('data-building-kind', kind);
    await expect(page.getByRole('tablist')).toHaveCount(0);
    await expect(page.locator('.page-navigation-button--close')).toHaveCount(0);
    await page.getByRole('button', { name: `返回${name}建筑列表`, exact: true }).click();
    await expect(tab(page, name)).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('.building-detail-page')).toHaveCount(0);
  }
});

test('missing commercial catalog remains stable and does not block the industrial tab', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.text().includes('Maximum update depth')) errors.push(message.text()); });
  await openRegion(page, 'missing-commercial-catalog');
  await tab(page, '商业').click();
  await expect(page.getByText('服务器尚未返回商业建筑目录。', { exact: true })).toBeVisible();
  await expect(page.locator('.building-type-filter')).toHaveCount(0);
  await tab(page, '工业').click();
  await expect(cards(page)).toHaveCount(1);
  await expect(page.locator('.production-build-card')).toBeVisible();
  expect(errors).toEqual([]);
});
