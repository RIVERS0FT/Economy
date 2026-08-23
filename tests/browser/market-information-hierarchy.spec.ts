import { expect, test } from '@playwright/test';

test('market uses commodity-first global and regional information hierarchy', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('?preview=game');
  await page.locator('.desktop-sidebar').getByRole('button', { name: /^市场/ }).click();

  await expect(page.locator('.global-market-summary-strip')).toBeVisible();
  await expect(page.locator('.global-market-goods-row').first()).toBeVisible();
  await expect(page.locator('.global-market-province-row').first()).toBeVisible();
  await expect(page.locator('.global-current-scope-summary')).toHaveCount(0);
  await expect(page.locator('.global-province-grid')).toHaveCount(0);

  await page.locator('.global-market-province-row').first().click();
  const firstCommodity = page.locator('.market-catalog-row').first();
  await expect(firstCommodity).toBeVisible();
  await expect(firstCommodity.locator('.market-balance-bar')).toHaveCount(1);
  await firstCommodity.click();

  await expect(page.locator('.market-detail-hero__market-price')).toBeVisible();
  await expect(page.locator('.market-fundamentals-balance .market-balance-bar')).toHaveCount(1);
  const chartBox = await page.locator('.market-chart-card').boundingBox();
  const tradeBox = await page.locator('.market-trade-card').boundingBox();
  expect(chartBox).not.toBeNull();
  expect(tradeBox).not.toBeNull();
  expect(chartBox!.y).toBeLessThan(tradeBox!.y);
});
