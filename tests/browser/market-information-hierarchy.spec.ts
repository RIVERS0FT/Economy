import { expect, test } from '@playwright/test';

test('market uses commodity-first global and regional information hierarchy', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('?preview=game');
  await page.locator('.desktop-sidebar').getByRole('button', { name: /^市场/ }).click();

  await expect(page.locator('.global-market-summary-strip')).toHaveCount(0);
  await expect(page.locator('.global-market-goods-panel')).toHaveCount(0);
  await expect(page.locator('.global-market-page > .global-market-filter-row')).toBeVisible();
  await expect(page.locator('.global-market-page > .global-market-goods-list')).toBeVisible();
  await expect(page.locator('.global-market-goods-row').first()).toBeVisible();
  await expect(page.locator('.global-market-province-row').first()).toBeVisible();
  await expect(page.locator('.global-current-scope-summary')).toHaveCount(0);
  await expect(page.locator('.global-province-grid')).toHaveCount(0);

  const globalGeometry = await page.locator('.global-market-page').evaluate((market) => {
    const goodsRow = market.querySelector<HTMLElement>('.global-market-goods-row');
    const provinceRow = market.querySelector<HTMLElement>('.global-market-province-row');
    if (!goodsRow || !provinceRow) throw new Error('global market responsive rows are missing');
    return {
      marketClientWidth: market.clientWidth,
      marketScrollWidth: market.scrollWidth,
      goodsClientWidth: goodsRow.clientWidth,
      goodsScrollWidth: goodsRow.scrollWidth,
      provinceClientWidth: provinceRow.clientWidth,
      provinceScrollWidth: provinceRow.scrollWidth,
    };
  });
  expect(globalGeometry.marketScrollWidth).toBeLessThanOrEqual(globalGeometry.marketClientWidth + 1);
  expect(globalGeometry.goodsScrollWidth).toBeLessThanOrEqual(globalGeometry.goodsClientWidth + 1);
  expect(globalGeometry.provinceScrollWidth).toBeLessThanOrEqual(globalGeometry.provinceClientWidth + 1);

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
