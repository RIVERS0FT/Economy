import { expect, test } from '@playwright/test';

const lockedProvinceUrl = 'runtime-test.html?view=map&scenario=locked-province';

test('locked province overview exposes official population without unlock controls', async ({ page }) => {
  await page.goto(lockedProvinceUrl);
  await expect(page.getByText('常住人口', { exact: true })).toBeVisible();
  await expect(page.getByText('Census · 2025-07-01', { exact: true })).toBeVisible();
  await expect(page.locator('.province-unlock-button')).toHaveCount(0);
  await expect(page.getByText('州级地区未解锁', { exact: true })).toHaveCount(0);
});

test('locked province market remains readable and removes write controls', async ({ page }) => {
  await page.goto(lockedProvinceUrl);
  await page.getByRole('tab', { name: '市场' }).click();
  await expect(page.locator('.market-catalog-list')).toBeVisible();
  await expect(page.locator('.province-unlock-button')).toHaveCount(0);
  await page.getByRole('button', { name: '查看机械详情' }).click();
  await expect(page.getByText('该地区尚未解锁，市场仅供查看。', { exact: true })).toBeVisible();
  await expect(page.locator('.market-submit-order')).toHaveCount(0);
  await expect(page.locator('.market-detail-auto-trade')).toHaveCount(0);
  await expect(page.getByText('实时五档 · 只读', { exact: true })).toHaveCount(1);
});

test('locked province buildings and warehouse own the unlock action', async ({ page }) => {
  await page.goto(lockedProvinceUrl);
  await page.getByRole('tab', { name: '建筑' }).click();
  await expect(page.getByText('建筑功能未解锁', { exact: true })).toBeVisible();
  await expect(page.locator('.province-unlock-button')).toBeVisible();
  await expect(page.getByText('距起始州', { exact: true })).toBeVisible();

  await page.getByRole('tab', { name: '仓库' }).click();
  await expect(page.getByText('仓库功能未解锁', { exact: true })).toBeVisible();
  await expect(page.locator('.province-unlock-button')).toBeVisible();
  await expect(page.getByText('距起始州', { exact: true })).toBeVisible();
});
