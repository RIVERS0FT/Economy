import { expect, test } from '@playwright/test';

// Regional detail regression locks the compact facts-only layout; retired fundamentals must stay absent.
test('market uses product-first global and regional information hierarchy', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('?preview=game');
  const sidebar = page.locator('.desktop-sidebar');
  await sidebar.getByRole('button', { name: /^市场/ }).click();

  await expect(page.getByRole('heading', { level: 1, name: '市场' })).toBeVisible();
  const expandedSidebarBox = await sidebar.boundingBox();
  if (!expandedSidebarBox) throw new Error('desktop sidebar is missing after opening market');
  await page.mouse.move(expandedSidebarBox.x + expandedSidebarBox.width + 80, expandedSidebarBox.y + 30);
  await expect(sidebar).toHaveAttribute('data-collapsed', 'true');

  await expect(page.locator('.global-market-page > .widget-heading')).toHaveCount(0);
  await expect(page.locator('.global-market-summary-strip')).toHaveCount(0);
  await expect(page.locator('.global-market-provinces-panel')).toHaveCount(0);
  await expect(page.locator('.global-market-filter-disclosure').first()).toBeVisible();
  expect(await page.locator('.global-market-filter-disclosure').first().getAttribute('open')).toBeNull();
  await expect(page.getByRole('searchbox')).toHaveCount(0);

  const goodsHeader = page.locator('.global-market-goods-header');
  await expect(goodsHeader).toBeVisible();
  for (const label of ['商品', '卖单量', '买单量', '24h成交量', '市场价', '24h价格变化']) {
    await expect(goodsHeader.getByText(label, { exact: true })).toBeVisible();
  }
  for (const label of ['成交地区', '真实成交价范围', '需求未满足']) {
    await expect(goodsHeader.getByText(label, { exact: true })).toHaveCount(0);
  }

  const goods = page.locator('.global-market-goods-list');
  await expect(goods).toBeVisible();
  const globalNames = goods.locator('.global-market-goods-row__name strong');
  const initialGlobalOrder = await globalNames.allTextContents();
  const productNameSort = goodsHeader.getByRole('button', { name: '商品', exact: true });
  await productNameSort.click();
  await expect(goodsHeader.getByRole('columnheader', { name: '商品' })).toHaveAttribute('aria-sort', 'ascending');
  expect(await globalNames.allTextContents()).toEqual([...initialGlobalOrder].sort((left, right) => left.localeCompare(right, 'zh-CN')));
  await productNameSort.click();
  await expect(goodsHeader.getByRole('columnheader', { name: '商品' })).toHaveAttribute('aria-sort', 'descending');
  expect(await globalNames.allTextContents()).toEqual([...initialGlobalOrder].sort((left, right) => right.localeCompare(left, 'zh-CN')));
  await productNameSort.click();
  await expect(goodsHeader.getByRole('columnheader', { name: '商品' })).toHaveAttribute('aria-sort', 'none');
  expect(await globalNames.allTextContents()).toEqual(initialGlobalOrder);

  for (const label of ['卖单量', '买单量', '24h成交量', '市场价', '24h价格变化']) {
    const sortButton = goodsHeader.getByRole('button', { name: label, exact: true });
    await sortButton.click();
    await expect(goodsHeader.getByRole('columnheader', { name: label })).toHaveAttribute('aria-sort', 'descending');
    await sortButton.click();
    await expect(goodsHeader.getByRole('columnheader', { name: label })).toHaveAttribute('aria-sort', 'ascending');
    await sortButton.click();
    await expect(goodsHeader.getByRole('columnheader', { name: label })).toHaveAttribute('aria-sort', 'none');
  }

  const globalRow = page.getByRole('button', { name: '打开小麦全局详情' });
  await expect(globalRow).toBeVisible();
  for (const label of ['卖单量', '买单量', '24h成交量', '市场价', '24h价格变化', '成交地区', '真实成交价范围', '需求未满足']) {
    await expect(globalRow.getByText(label, { exact: true })).toHaveCount(0);
  }
  await expect(globalRow.locator('.global-market-goods-row__chevron .game-icon')).toHaveCount(1);
  const globalGeometry = await globalRow.evaluate((row) => ({ clientWidth: row.clientWidth, scrollWidth: row.scrollWidth }));
  expect(globalGeometry.scrollWidth).toBeLessThanOrEqual(globalGeometry.clientWidth + 1);

  await page.setViewportSize({ width: 500, height: 900 });
  const compactGlobalHeaderGeometry = await goodsHeader.evaluate((header) => ({ clientWidth: header.clientWidth, scrollWidth: header.scrollWidth }));
  const compactGlobalRowGeometry = await globalRow.evaluate((row) => ({ clientWidth: row.clientWidth, scrollWidth: row.scrollWidth }));
  expect(compactGlobalHeaderGeometry.scrollWidth).toBeLessThanOrEqual(compactGlobalHeaderGeometry.clientWidth + 1);
  expect(compactGlobalRowGeometry.scrollWidth).toBeLessThanOrEqual(compactGlobalRowGeometry.clientWidth + 1);
  await page.setViewportSize({ width: 1440, height: 900 });

  await globalRow.click();
  await expect(page.locator('.global-market-product-region-list')).toBeVisible();
  const regionalHeader = page.locator('.global-market-product-region-surface > .market-commodity-row-header');
  await expect(regionalHeader).toBeVisible();
  await expect(page.locator('.global-market-product-region-list .market-commodity-row-header')).toHaveCount(0);
  for (const label of ['地区', '卖单量', '买单量', '24h成交量', '市场价', '24h价格变化']) {
    await expect(regionalHeader.getByText(label, { exact: true })).toBeVisible();
  }
  const regionalRow = page.getByRole('button', { name: '打开加利福尼亚小麦详情' });
  await expect(regionalRow).toBeVisible();
  await expect(regionalRow.locator('.market-commodity-row__name strong')).toHaveText('加利福尼亚');
  await expect(regionalRow.locator('.market-commodity-row__name small')).toHaveCount(0);
  await expect(regionalRow.locator('.market-commodity-row__artwork')).toHaveCount(0);
  const regionalNames = page.locator('.global-market-product-region-list .market-commodity-row__name strong');
  const initialRegionOrder = await regionalNames.allTextContents();
  const regionNameSort = regionalHeader.getByRole('button', { name: '地区', exact: true });
  await regionNameSort.click();
  await expect(regionalHeader.getByRole('columnheader', { name: '地区' })).toHaveAttribute('aria-sort', 'ascending');
  expect(await regionalNames.allTextContents()).toEqual([...initialRegionOrder].sort((left, right) => left.localeCompare(right, 'zh-CN')));
  await regionNameSort.click();
  await expect(regionalHeader.getByRole('columnheader', { name: '地区' })).toHaveAttribute('aria-sort', 'descending');
  expect(await regionalNames.allTextContents()).toEqual([...initialRegionOrder].sort((left, right) => right.localeCompare(left, 'zh-CN')));
  await regionNameSort.click();
  await expect(regionalHeader.getByRole('columnheader', { name: '地区' })).toHaveAttribute('aria-sort', 'none');
  expect(await regionalNames.allTextContents()).toEqual(initialRegionOrder);
  const regionalPriceSort = regionalHeader.getByRole('button', { name: '市场价' });
  await regionalPriceSort.click();
  await expect(regionalHeader.locator('[aria-sort="descending"]')).toHaveText('市场价');
  await regionalPriceSort.click();
  await expect(regionalHeader.locator('[aria-sort="ascending"]')).toHaveText('市场价');
  for (const label of ['卖单量', '买单量', '24h成交量', '市场价', '24h价格变化', '挂单差额', '基准偏离', '挂单状态']) {
    await expect(regionalRow.getByText(label, { exact: true })).toHaveCount(0);
  }
  await expect(regionalRow.locator('.market-commodity-row__chevron .game-icon')).toHaveCount(1);

  await page.setViewportSize({ width: 500, height: 900 });
  await expect(regionalRow).toBeVisible();
  const compactRegionIdentityGeometry = await regionalRow.locator('.market-commodity-row__identity--region').evaluate((identity) => ({
    columnCount: getComputedStyle(identity).gridTemplateColumns.split(/\s+/).filter(Boolean).length,
    width: identity.getBoundingClientRect().width,
  }));
  const compactRegionNameGeometry = await regionalRow.locator('.market-commodity-row__name strong').evaluate((name) => ({
    clientWidth: name.clientWidth,
    scrollWidth: name.scrollWidth,
  }));
  expect(compactRegionIdentityGeometry.columnCount).toBe(1);
  expect(compactRegionIdentityGeometry.width).toBeGreaterThan(60);
  expect(compactRegionNameGeometry.scrollWidth).toBeLessThanOrEqual(compactRegionNameGeometry.clientWidth + 1);
  await page.setViewportSize({ width: 1440, height: 900 });

  await regionalRow.click();
  const visibleHeroMetrics = await page.locator('.market-detail-hero__metric:visible small').allTextContents();
  expect(visibleHeroMetrics).toEqual(['24h 变化', '可用库存']);
  for (const deletedLabel of ['市场价', '基准偏离', '需求满足率', '参考价', '上轮需求']) {
    await expect(page.getByText(deletedLabel, { exact: true })).toHaveCount(0);
  }
  await expect(page.locator('.market-fundamentals-grid')).toHaveCount(0);
  await expect(page.locator('.market-auto-trade-execution')).toHaveCount(0);
  const chartBox = await page.locator('.market-chart-card').boundingBox();
  const tradeBox = await page.locator('.market-trade-card').boundingBox();
  expect(chartBox).not.toBeNull();
  expect(tradeBox).not.toBeNull();
  expect(chartBox!.y).toBeLessThan(tradeBox!.y);

  const accountPanel = page.locator('.market-account-panel');
  await expect(accountPanel).toBeVisible();
  await expect(accountPanel.getByText('资产', { exact: true })).toHaveCount(0);
});