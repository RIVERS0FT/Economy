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
  const marketHeaderHeight = (await page.locator('.global-market-goods-header').boundingBox())?.height ?? 0;
  const marketRowHeight = (await page.locator('.global-market-goods-row').first().boundingBox())?.height ?? 0;

  await page.getByRole('button', { name: '打开小麦全局详情' }).click();
  await expect(page.locator('.global-market-product-region-list')).toBeVisible();
  const regionalWheat = page.getByRole('button', { name: '打开加利福尼亚小麦详情' });
  await expect(regionalWheat).toBeVisible();
  const regionalMarketHeaderHeight = (await page.locator('.global-market-product-region-surface > .market-commodity-row-header').boundingBox())?.height ?? 0;
  const regionalMarketRowHeight = (await regionalWheat.boundingBox())?.height ?? 0;
  await regionalWheat.click();
  await expect(page.locator('.global-market-page[data-drilldown-province-id]')).toBeVisible();
  await expect(page.locator('.market-detail-surface')).toBeVisible();
  await page.getByRole('button', { name: '返回上一页面' }).click();
  await expect(page.locator('.global-market-product-region-list')).toBeVisible();
  await page.getByRole('button', { name: '返回上一页面' }).click();
  await expect(page.getByRole('heading', { name: '市场', exact: true })).toBeVisible();

  await sidebar.getByRole('button', { name: /^建筑/ }).click();
  await expect(page.getByRole('heading', { name: '建筑', exact: true })).toBeVisible();
  await expect(page.locator('.global-buildings-page')).toHaveAttribute('data-global-scope', 'buildings');
  await expect(page.getByText('全局工厂目录', { exact: true })).toHaveCount(0);
  await expect(page.getByText(/类已拥有/)).toHaveCount(0);
  const facilityHeader = page.locator('.global-facility-catalog-header');
  await expect(facilityHeader).toBeVisible();
  await expect(page.locator('.global-province-list-panel')).toHaveCount(0);
  await expect(page.locator('.global-province-list')).toHaveCount(0);
  await expect(page.locator('.global-province-row')).toHaveCount(0);
  await page.mouse.move(1000, 800);
  await expect(sidebar).toHaveAttribute('data-collapsed', 'true');

  const globalFacilityRows = page.locator('.global-buildings-page .global-facility-catalog-row');
  expect(await globalFacilityRows.count()).toBeGreaterThan(1);
  const initialFacilityNames = await globalFacilityRows.locator('.global-facility-catalog-row__identity strong').allTextContents();
  const facilityNameSort = facilityHeader.getByRole('button', { name: '工厂', exact: true });
  await facilityNameSort.click();
  await expect(facilityHeader.getByRole('columnheader', { name: '工厂' })).toHaveAttribute('aria-sort', 'ascending');
  expect(await globalFacilityRows.locator('.global-facility-catalog-row__identity strong').allTextContents())
    .toEqual([...initialFacilityNames].sort((left, right) => left.localeCompare(right, 'zh-CN')));
  await facilityNameSort.click();
  await expect(facilityHeader.getByRole('columnheader', { name: '工厂' })).toHaveAttribute('aria-sort', 'descending');
  await facilityNameSort.click();
  await expect(facilityHeader.getByRole('columnheader', { name: '工厂' })).toHaveAttribute('aria-sort', 'none');
  expect(await globalFacilityRows.locator('.global-facility-catalog-row__identity strong').allTextContents()).toEqual(initialFacilityNames);
  for (const label of ['平均利润／分钟', '拥有']) {
    const sortButton = facilityHeader.getByRole('button', { name: label, exact: true });
    await sortButton.click();
    await expect(facilityHeader.getByRole('columnheader', { name: label })).toHaveAttribute('aria-sort', 'descending');
    await sortButton.click();
    await sortButton.click();
    await expect(facilityHeader.getByRole('columnheader', { name: label })).toHaveAttribute('aria-sort', 'none');
  }
  const facilityHeaderHeight = (await facilityHeader.boundingBox())?.height ?? 0;
  const facilityRowHeight = (await globalFacilityRows.first().boundingBox())?.height ?? 0;

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
  const regionalFacilityRows = page.locator('.global-facility-region-row');
  const initialProvinceNames = await regionalFacilityRows.locator('.global-facility-region-row__identity strong').allTextContents();
  const provinceNameSort = regionHeader.getByRole('button', { name: '地区', exact: true });
  await provinceNameSort.click();
  await expect(regionHeader.getByRole('columnheader', { name: '地区' })).toHaveAttribute('aria-sort', 'ascending');
  expect(await regionalFacilityRows.locator('.global-facility-region-row__identity strong').allTextContents())
    .toEqual([...initialProvinceNames].sort((left, right) => left.localeCompare(right, 'zh-CN')));
  await provinceNameSort.click();
  await provinceNameSort.click();
  await expect(regionHeader.getByRole('columnheader', { name: '地区' })).toHaveAttribute('aria-sort', 'none');
  for (const [label, direction] of [['利润／分钟', 'descending'], ['拥有', 'descending'], ['状态', 'ascending']] as const) {
    const sortButton = regionHeader.getByRole('button', { name: label, exact: true });
    await sortButton.click();
    await expect(regionHeader.getByRole('columnheader', { name: label })).toHaveAttribute('aria-sort', direction);
    await sortButton.click();
    await sortButton.click();
    await expect(regionHeader.getByRole('columnheader', { name: label })).toHaveAttribute('aria-sort', 'none');
  }
  const regionalFacilityHeaderHeight = (await regionHeader.boundingBox())?.height ?? 0;
  const regionalFacilityRowHeight = (await regionalFacilityRow.boundingBox())?.height ?? 0;
  const headerHeights = [marketHeaderHeight, regionalMarketHeaderHeight, facilityHeaderHeight, regionalFacilityHeaderHeight];
  const marketRowHeights = [marketRowHeight, regionalMarketRowHeight];
  const facilityRowHeights = [facilityRowHeight, regionalFacilityRowHeight];
  expect(Math.max(...headerHeights) - Math.min(...headerHeights)).toBeLessThanOrEqual(1);
  expect(Math.max(...marketRowHeights) - Math.min(...marketRowHeights)).toBeLessThanOrEqual(1);
  expect(Math.max(...facilityRowHeights) - Math.min(...facilityRowHeights)).toBeLessThanOrEqual(1);
  expect(Math.max(...marketRowHeights)).toBeLessThan(Math.min(...facilityRowHeights));
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
