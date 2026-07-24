import { expect, test, type Locator, type Page } from '@playwright/test';

async function requireBox(locator: Locator) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  return box!;
}

async function gridTrackCount(locator: Locator) {
  return locator.evaluate((element) => getComputedStyle(element).gridTemplateColumns
    .split(' ')
    .filter(Boolean)
    .length);
}

async function openContracts(page: Page, width: number, height: number) {
  await page.setViewportSize({ width, height });
  await page.goto('runtime-test.html?view=contracts');
  await expect(page.getByRole('heading', { name: '合同', exact: true })).toBeVisible();
  await expect(page.getByRole('tab', { name: /进行中的合同/ })).toHaveAttribute('aria-selected', 'true');
}

test('desktop contract workspace uses shared controls and dense two-column layouts', async ({ page }) => {
  await openContracts(page, 1440, 900);

  expect(await gridTrackCount(page.locator('.contract-summary-grid'))).toBe(4);
  expect(await gridTrackCount(page.locator('.contract-detail-layout').first())).toBe(2);
  await expect(page.getByRole('checkbox', { name: '自动补充货款' })).toBeVisible();
  await expect(page.locator('.contract-card h2 .product-icon')).toHaveCount(1);

  await page.getByRole('button', { name: '发布合同', exact: true }).click();
  expect(await gridTrackCount(page.locator('.contract-publish-layout'))).toBe(2);
  await expect(page.getByRole('group', { name: '发布方向' })).toBeVisible();
  await expect(page.getByRole('button', { name: '我长期采购', exact: true })).toHaveAttribute('aria-pressed', 'true');

  const quantity = page.getByLabel('每批数量');
  const submit = page.locator('.contract-publish-preview').getByRole('button', { name: '发布合同', exact: true });
  await quantity.fill('');
  await expect(quantity).toHaveValue('');
  await expect(submit).toBeDisabled();
  await quantity.blur();
  await expect(quantity).toHaveValue('100');

  await page.getByRole('tab', { name: /合同广场/ }).click();
  expect(await gridTrackCount(page.locator('.contract-offer-grid'))).toBe(2);
  await expect(page.getByText('采购 机械', { exact: true })).toBeVisible();

  await page.getByRole('tab', { name: /合同历史/ }).click();
  await expect(page.locator('.contract-history-panel')).toHaveCount(1);
  await expect(page.locator('.contract-history-row')).toHaveCount(1);
  expect(await page.locator('body').evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
});

test('tablet contract publish form keeps two-column fields', async ({ page }) => {
  await openContracts(page, 1100, 900);

  await page.getByRole('button', { name: '发布合同', exact: true }).click();
  expect(await gridTrackCount(page.locator('.contract-publish-layout'))).toBe(1);
  expect(await gridTrackCount(page.locator('.contract-publish-grid'))).toBe(2);
  expect(await page.locator('body').evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
});

test('mobile contract workspace keeps two-column summaries, scrollable tabs and full-size inputs', async ({ page }) => {
  await openContracts(page, 390, 844);

  expect(await gridTrackCount(page.locator('.contract-summary-grid'))).toBe(2);
  expect(await gridTrackCount(page.locator('.contract-card-heading').first())).toBe(1);
  const tabsOverflow = await page.locator('.contract-tabs').evaluate((element) => element.scrollWidth > element.clientWidth);
  expect(tabsOverflow).toBe(true);

  await page.getByRole('button', { name: '发布合同', exact: true }).click();
  expect(await gridTrackCount(page.locator('.contract-publish-layout'))).toBe(1);
  expect(await gridTrackCount(page.locator('.contract-publish-grid'))).toBe(1);

  const quantity = page.getByLabel('每批数量');
  const quantityBox = await requireBox(quantity);
  expect(quantityBox.height).toBeGreaterThanOrEqual(48);
  const quantityFontSize = await quantity.evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize));
  expect(quantityFontSize).toBeGreaterThanOrEqual(16);
  expect(await page.locator('body').evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
});
