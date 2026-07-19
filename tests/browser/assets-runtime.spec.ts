import { expect, test, type Page } from '@playwright/test';

async function capturePageErrors(page: Page) {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  return pageErrors;
}

test('assets page keeps one consolidated overview without repeated headline metrics', async ({ page }) => {
  const pageErrors = await capturePageErrors(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('assets-runtime-test.html');

  await expect(page.getByRole('heading', { name: '资产', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: '资产总览', exact: true })).toBeVisible();
  await expect(page.getByText('当前总资产', { exact: true })).toHaveCount(1);
  await expect(page.getByText('可支配资产', { exact: true })).toHaveCount(1);
  await expect(page.getByText('冻结资产', { exact: true })).toHaveCount(1);
  await expect(page.getByRole('heading', { name: '资产配置', exact: true })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: '资产估值明细', exact: true })).toHaveCount(0);
  await expect(page.locator('.funds-summary-grid')).toHaveCount(0);
  await expect(page.locator('.asset-composition-row')).toHaveCount(3);
  await expect(page.getByRole('table', { name: '资产构成明细' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '本地资产变动', exact: true })).toBeVisible();
  await expect(page.getByText('这些记录不上传服务器。更换设备、无痕模式或清除网站数据后不会恢复。', { exact: true })).toBeVisible();

  const overviewColumns = await page.locator('.asset-overview-body').evaluate((element) => (
    getComputedStyle(element).gridTemplateColumns.split(' ').filter(Boolean).length
  ));
  expect(overviewColumns).toBe(3);
  expect(await page.locator('.page-content').evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
  expect(pageErrors).toEqual([]);
});

test('assets page stacks the overview and keeps composition readable on mobile', async ({ page }) => {
  const pageErrors = await capturePageErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('assets-runtime-test.html');

  const overviewColumns = await page.locator('.asset-overview-body').evaluate((element) => (
    getComputedStyle(element).gridTemplateColumns.split(' ').filter(Boolean).length
  ));
  expect(overviewColumns).toBe(1);
  await expect(page.locator('.asset-composition-header')).toBeHidden();

  const compositionColumns = await page.locator('.asset-composition-row').first().evaluate((element) => (
    getComputedStyle(element).gridTemplateColumns.split(' ').filter(Boolean).length
  ));
  expect(compositionColumns).toBe(2);
  await expect(page.getByRole('button', { name: '清除本地记录' })).toBeDisabled();
  await expect(page.getByRole('button', { name: '全部' })).toBeVisible();
  expect(await page.locator('.page-content').evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
  expect(pageErrors).toEqual([]);
});
