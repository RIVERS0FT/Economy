import { expect, test, type Page } from '@playwright/test';

async function mapOutlineWidth(page: Page) {
  return page.evaluate(() => {
    const pathRects = [...document.querySelectorAll<SVGGraphicsElement>('.province-map-echart svg path')]
      .map((path) => path.getBoundingClientRect())
      .filter((rect) => rect.width > 0 && rect.height > 0);
    const left = Math.min(...pathRects.map((rect) => rect.left));
    const right = Math.max(...pathRects.map((rect) => rect.right));
    return right - left;
  });
}

test('map zoom controls persist on the global map and primary market/buildings are global views', async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('?preview=game', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('html')).toHaveAttribute('data-local-game-preview', 'true');
  await page.getByRole('button', { name: '关闭当前页面并显示地图' }).click();
  await expect(page.locator('.game-shell')).toHaveClass(/strategic-tab-map/);

  const map = page.getByTestId('us-mainland-map');
  const canvas = map.locator('.economy-chart__canvas');
  await expect(map).toHaveAttribute('data-echarts-ready', 'true');
  await expect(page.locator('.province-map-chart')).toHaveAttribute('data-map-zoom-min', '0.5');
  await expect(page.locator('.province-map-chart')).toHaveAttribute('data-map-zoom-max', '4');

  const baselineWidth = await mapOutlineWidth(page);
  const zoomControls = page.getByRole('group', { name: '地图缩放' });
  await expect(zoomControls).toBeVisible();
  await zoomControls.getByRole('button', { name: '缩小地图' }).click();
  await expect.poll(() => mapOutlineWidth(page)).toBeLessThan(baselineWidth * 0.95);

  await zoomControls.getByRole('button', { name: '重置地图缩放和平移' }).click();
  await expect(canvas).toHaveAttribute('data-map-camera-reset', 'zoom-control');
  await expect.poll(() => mapOutlineWidth(page)).toBeGreaterThan(baselineWidth * 0.98);

  await zoomControls.getByRole('button', { name: '放大地图' }).click();
  await expect.poll(() => mapOutlineWidth(page)).toBeGreaterThan(baselineWidth * 1.05);

  const sidebar = page.locator('.desktop-sidebar');
  await sidebar.getByRole('button', { name: /^市场/ }).click();
  await expect(page.getByRole('heading', { name: '市场', exact: true })).toBeVisible();
  await expect(page.locator('.global-market-page')).toHaveAttribute('data-global-scope', 'market');
  expect(await page.locator('.global-market-page .global-province-card').count()).toBeGreaterThan(1);
  expect(await page.locator('.global-market-product-row').count()).toBeGreaterThan(1);

  await page.locator('.global-market-page .global-province-card').first().click();
  await expect(page.locator('.global-market-page[data-drilldown-province-id]')).toBeVisible();
  await expect(page.locator('.market-catalog-surface')).toBeVisible();
  await page.getByRole('button', { name: '返回全局市场' }).click();
  await expect(page.locator('.global-market-page:not([data-drilldown-province-id])')).toBeVisible();

  await sidebar.getByRole('button', { name: /^建筑/ }).click();
  await expect(page.getByRole('heading', { name: '建筑', exact: true })).toBeVisible();
  await expect(page.locator('.global-buildings-page')).toHaveAttribute('data-global-scope', 'buildings');
  expect(await page.locator('.global-buildings-page .global-province-card').count()).toBeGreaterThan(1);

  await page.locator('.global-buildings-page .global-province-card').first().click();
  await expect(page.locator('.global-buildings-page[data-drilldown-province-id]')).toBeVisible();
  await expect(page.locator('.production-workspace')).toBeVisible();
  await page.getByRole('button', { name: '返回全局建筑' }).click();
  await expect(page.locator('.global-buildings-page:not([data-drilldown-province-id])')).toBeVisible();
});
