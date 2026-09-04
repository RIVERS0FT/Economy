import { expect, test } from '@playwright/test';

test('commodity trade entry accepts quantity only', async ({ page }) => {
  await page.goto('market-runtime-test.html?scenario=active');
  await expect(page.getByText('即时交易', { exact: true })).toBeVisible();
  await expect(page.locator('#market-trade-quantity')).toBeVisible();
  await expect(page.locator('#market-order-price')).toHaveCount(0);
  await expect(page.getByText('今日成交价')).toBeVisible();
});
