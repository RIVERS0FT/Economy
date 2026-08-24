import { expect, test } from '@playwright/test';

test('market uses product-first global and regional information hierarchy', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('?preview=game');
  await page.locator('.desktop-sidebar').getByRole('button', { name: /^市场/ }).click();

  await expect(page.locator('.global-market-summary-strip')).toHaveCount(0);
  await expect(page.locator('.global-market-provinces-panel')).toHaveCount(0);
  await expect(page.locator('.global-market-filter-disclosure').first()).toBeVisible();
  expect(await page.locator('.global-market-filter-disclosure').first().getAttribute('open')).toBeNull();
  await expect(page.getByRole('searchbox')).toHaveCount(0);
  const goods = page.locator('.global-market-goods-list');
  await expect(goods).toBeVisible();
  const globalRow = page.getByRole('button', { name: '打开小麦全局详情' });
  await expect(globalRow).toBeVisible();
  const globalGeometry = await globalRow.evaluate((row) => ({ clientWidth: row.clientWidth, scrollWidth: row.scrollWidth }));
  expect(globalGeometry.scrollWidth).toBeLessThanOrEqual(globalGeometry.clientWidth + 1);

  await globalRow.click();
  await expect(page.locator('.global-market-product-detail-panel')).toBeVisible();
  const regionalRow = page.getByRole('button', { name: '打开加利福尼亚州小麦详情' });
  await expect(regionalRow).toBeVisible();
  for (const label of ['卖单量', '买单量', '市场价', '24h']) {
    await expect(regionalRow.getByText(label, { exact: true })).toBeVisible();
  }
  for (const label of ['挂单差额', '基准偏离', '挂单状态']) {
    await expect(regionalRow.getByText(label, { exact: true })).toHaveCount(0);
  }

  await regionalRow.click();
  await expect(page.locator('.market-detail-hero__market-price')).toBeVisible();
  await expect(page.locator('.market-fundamentals-balance .market-balance-bar')).toHaveCount(1);
  const chartBox = await page.locator('.market-chart-card').boundingBox();
  const tradeBox = await page.locator('.market-trade-card').boundingBox();
  expect(chartBox).not.toBeNull();
  expect(tradeBox).not.toBeNull();
  expect(chartBox!.y).toBeLessThan(tradeBox!.y);
});
