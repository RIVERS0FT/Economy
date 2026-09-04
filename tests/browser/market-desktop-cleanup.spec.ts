import { expect, test } from '@playwright/test';
test('desktop instant market removes the resting order book', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('market-runtime-test.html');
  await expect(page.locator('.market-immediate-trade')).toBeVisible();
  await expect(page.getByText('今日成交价', { exact: true })).toBeVisible();
  await expect(page.locator('#market-trade-quantity')).toBeVisible();
  await expect(page.locator('.order-book')).toHaveCount(0);
  await expect(page.getByText('实时五档', { exact: false })).toHaveCount(0);
  await expect(page.getByText('已有订单', { exact: true })).toHaveCount(0);
});
test('mobile instant market keeps quantity trade controls without a book', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('market-runtime-test.html');
  await expect(page.locator('.market-immediate-trade')).toBeVisible();
  await expect(page.locator('.market-submit-order')).toBeVisible();
  await expect(page.locator('.order-book')).toHaveCount(0);
});
