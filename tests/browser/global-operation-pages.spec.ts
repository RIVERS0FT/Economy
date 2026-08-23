import { expect, test } from '@playwright/test';

test('map keeps gesture zoom without a control panel and primary market/buildings are global views', async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('?preview=game', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('html')).toHaveAttribute('data-local-game-preview', 'true');
  await expect(page.locator('.game-shell')).toHaveClass(/strategic-tab-map/);

  const map = page.getByTestId('us-mainland-map');
  await expect(map).toHaveAttribute('data-map-ready', 'true');
  await expect(page.locator('.province-map-chart')).toHaveAttribute('data-map-zoom-min', '0.5');
  await expect(page.locator('.province-map-chart')).toHaveAttribute('data-map-zoom-max', '4');
  await expect(page.getByRole('group', { name: '地图缩放' })).toHaveCount(0);
  await expect(page.locator('.strategic-map-zoom-controls')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '放大地图' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '缩小地图' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '重置地图缩放和平移' })).toHaveCount(0);

  const sidebar = page.locator('.desktop-sidebar');
  await sidebar.getByRole('button', { name: /^市场/ }).click();
  await expect(page.getByRole('heading', { name: '市场', exact: true })).toBeVisible();
  await expect(page.locator('.global-market-page')).toHaveAttribute('data-global-scope', 'market');
  expect(await page.locator('.global-market-page .global-market-province-row').count()).toBeGreaterThan(1);
  expect(await page.locator('.global-market-goods-row').count()).toBeGreaterThan(1);

  await page.locator('.global-market-page .global-market-province-row').first().click();
  await expect(page.locator('.global-market-page[data-drilldown-province-id]')).toBeVisible();
  await expect(page.locator('.market-catalog-surface')).toBeVisible();
  await page.getByRole('button', { name: '返回全局市场' }).click();
  await expect(page.locator('.global-market-page:not([data-drilldown-province-id])')).toBeVisible();

  await sidebar.getByRole('button', { name: /^建筑/ }).click();
  await expect(page.getByRole('heading', { name: '建筑', exact: true })).toBeVisible();
  await expect(page.locator('.global-buildings-page')).toHaveAttribute('data-global-scope', 'buildings');
  expect(await page.locator('.global-buildings-page .global-facility-catalog-row').count()).toBeGreaterThan(1);
  expect(await page.locator('.global-buildings-page .global-province-row').count()).toBeGreaterThan(1);

  await page.locator('.global-buildings-page .global-province-row').first().click();
  await expect(page.locator('.global-buildings-page[data-drilldown-province-id]')).toBeVisible();
  await expect(page.locator('.production-build-card')).toBeVisible();
  await expect(page.locator('.facility-cluster-selector-list')).toBeVisible();
  await expect(page.locator('.buildings-summary-panel')).toHaveCount(0);
  await expect(page.locator('.buildings-list-filters')).toHaveCount(0);
  await page.getByRole('button', { name: '返回全局建筑' }).click();
  await expect(page.locator('.global-buildings-page:not([data-drilldown-province-id])')).toBeVisible();
});
