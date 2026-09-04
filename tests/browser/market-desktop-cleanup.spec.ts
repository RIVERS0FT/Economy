import { expect, test } from '@playwright/test';

async function assertInstantMarket(page: import('@playwright/test').Page) {
  const detail = page.locator('.market-detail-surface');
  await expect(detail).toBeVisible();
  await expect(detail.locator('.market-immediate-trade-card')).toBeVisible();
  const summary = detail.locator('.market-trade-summary');
  await expect(summary.getByText('今日价格', { exact: true })).toBeVisible();
  await expect(summary.getByText('今日成交量', { exact: true })).toBeVisible();
  await expect(summary.getByText('24h 成交量', { exact: true })).toBeVisible();
  await expect(summary.getByText('下次调价', { exact: true })).toBeVisible();
  await expect(detail.locator('#market-trade-quantity')).toBeVisible();
  await expect(detail.locator('.local-trades-section')).toBeVisible();

  for (const selector of [
    '.market-trade-book',
    '.book-order-row',
    '.order-book-columns',
    '.order-book-midpoint',
    '.market-account-view-switch',
    '.market-compact-view-switch',
    '.own-open-orders-table',
  ]) {
    await expect(page.locator(selector)).toHaveCount(0);
  }
  await expect(page.getByText('已有订单', { exact: true })).toHaveCount(0);
  await expect(page.locator('.market-order-price')).toHaveCount(0);
}

test('desktop market shows daily-price immediate trade without an order book', async ({ page }) => {
  await page.setViewportSize({ width: 1684, height: 931 });
  await page.goto('market-runtime-test.html?scenario=active');
  await assertInstantMarket(page);

  const detail = page.locator('.market-detail-surface');
  const geometry = await detail.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }));
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth + 1);
});

test('mobile market keeps quantity-only immediate trade and recent trades readable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('market-runtime-test.html?scenario=active');
  await assertInstantMarket(page);

  await page.setViewportSize({ width: 320, height: 720 });
  const detail = page.locator('.market-detail-surface');
  await expect(detail.locator('#market-trade-quantity')).toBeVisible();
  await expect(detail.locator('.market-quantity-stepper')).toBeVisible();
  await expect(page.getByRole('button', { name: '盘口', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '下单', exact: true })).toHaveCount(0);
  const geometry = await detail.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }));
  expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth + 1);
});
