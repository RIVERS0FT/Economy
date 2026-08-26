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
  await expect(page.locator('.global-market-provinces-panel')).toHaveCount(0);
  expect(await page.locator('.global-market-goods-row').count()).toBeGreaterThan(1);

  await page.getByRole('button', { name: '打开小麦全局详情' }).click();
  await expect(page.locator('.global-market-product-detail-panel')).toBeVisible();
  const regionalWheat = page.getByRole('button', { name: '打开加利福尼亚州小麦详情' });
  await expect(regionalWheat).toBeVisible();
  await regionalWheat.click();
  await expect(page.locator('.global-market-page[data-drilldown-province-id]')).toBeVisible();
  await expect(page.locator('.market-detail-surface')).toBeVisible();
  await page.getByRole('button', { name: '返回上一页面' }).click();
  await expect(page.locator('.global-market-product-detail-panel')).toBeVisible();
  await page.getByRole('button', { name: '返回上一页面' }).click();
  await expect(page.getByRole('heading', { name: '市场', exact: true })).toBeVisible();

  await sidebar.getByRole('button', { name: /^建筑/ }).click();
  await expect(page.getByRole('heading', { name: '建筑', exact: true })).toBeVisible();
  await expect(page.locator('.global-buildings-page')).toHaveAttribute('data-global-scope', 'buildings');
  await expect(page.getByText('全局工厂目录', { exact: true })).toHaveCount(0);
  await expect(page.getByText(/类已拥有/)).toHaveCount(0);
  await expect(page.locator('.global-facility-catalog-header')).toBeVisible();
  await expect(page.locator('.global-province-list-panel')).toHaveCount(0);
  await expect(page.locator('.global-province-list')).toHaveCount(0);
  await expect(page.locator('.global-province-row')).toHaveCount(0);

  const globalFacilityRows = page.locator('.global-buildings-page .global-facility-catalog-row');
  expect(await globalFacilityRows.count()).toBeGreaterThan(1);

  const firstGlobalFacilityRow = globalFacilityRows.first();
  const firstFacilityName = (await firstGlobalFacilityRow.locator('.global-facility-catalog-row__identity strong').textContent())?.trim();
  expect(firstFacilityName).toBeTruthy();
  const artworkBox = await firstGlobalFacilityRow.locator('.global-facility-catalog-row__artwork').boundingBox();
  expect(artworkBox).not.toBeNull();
  if (!artworkBox) throw new Error('全局工厂插画未渲染');
  expect(Math.abs(artworkBox.width - artworkBox.height)).toBeLessThan(1);

  await firstGlobalFacilityRow.click();
  await expect(page.getByRole('heading', { name: firstFacilityName!, exact: true })).toBeVisible();
  await expect(page.locator('.global-buildings-page[data-global-facility-type-id]')).toBeVisible();
  const regionHeader = page.locator('.global-facility-region-header');
  await expect(regionHeader).toBeVisible();
  await expect(regionHeader).toContainText('利润／分钟');
  const regionalFacilityRow = page.locator('.global-facility-region-row').first();
  await expect(regionalFacilityRow).toBeVisible();
  await expect(regionalFacilityRow.locator('.global-facility-region-row__profit')).toBeVisible();
  await expect(regionalFacilityRow).toHaveAttribute('aria-label', /单厂利润每分钟/);
  const regionalProvinceId = await regionalFacilityRow.getAttribute('data-province-id');
  expect(regionalProvinceId).toBeTruthy();
  await regionalFacilityRow.click();
  await expect(page.locator(`.global-buildings-page[data-drilldown-province-id="${regionalProvinceId}"]`)).toBeVisible();
  await expect(page.locator('.facility-cluster-detail-page')).toBeVisible();
  await page.getByRole('button', { name: '返回上一页面' }).click();
  await expect(page.locator('.global-buildings-page[data-global-facility-type-id]')).toBeVisible();
  await page.getByRole('button', { name: '返回上一页面' }).click();
  await expect(page.getByRole('heading', { name: '建筑', exact: true })).toBeVisible();
  await expect(page.locator('.global-province-list')).toHaveCount(0);
});
