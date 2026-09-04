import { expect, test } from '@playwright/test';

test('commodity trade entry accepts quantity only', async ({ page }) => {
  await page.goto('market-runtime-test.html?scenario=active');
  await expect(page.getByText('即时交易', { exact: true })).toHaveCount(0);
  await expect(page.getByLabel('商品交易')).toBeVisible();
  await expect(page.locator('#market-trade-quantity')).toBeVisible();
  await expect(page.locator('#market-order-price')).toHaveCount(0);
  await expect(page.getByText('今日成交价', { exact: true })).toHaveCount(0);
  await expect(page.getByText('下次调价', { exact: true })).toHaveCount(0);
  await expect(page.locator('.market-order-summary-grid > span:visible small')).toHaveText(['交易总额', '可用资金', '手续费']);
});
