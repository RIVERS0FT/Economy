import { expect, test, type Locator, type Page } from '@playwright/test';
import { openRuntimePage } from './runtime-harness';

async function openGlobalPage(page: Page, navigationName: '市场' | '建筑') {
  await openRuntimePage(page, '/?page=home');
  const navigation = page.getByRole('button', { name: navigationName, exact: true });
  if (await navigation.count()) await navigation.click();
  else await page.goto(`/runtime-test.html?page=${navigationName === '市场' ? 'market' : 'buildings'}`);
}

async function expectNoPageHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1);
}

async function expectListTriggerSkin(locator: Locator) {
  return locator.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      borderRadius: style.borderRadius,
      borderTopColor: style.borderTopColor,
      backgroundColor: style.backgroundColor,
      color: style.color,
    };
  });
}

test('global market keeps catalog-first drilldown and explicit regional write scope', async ({ page }) => {
  await openGlobalPage(page, '市场');
  await expect(page.getByRole('heading', { name: '市场', exact: true })).toBeVisible();
  await expect(page.locator('.global-market-goods-list')).toBeVisible();
  await expect(page.locator('.global-province-list')).toHaveCount(0);

  const firstCommodityRow = page.locator('.global-market-goods-row').first();
  await expect(firstCommodityRow).toBeVisible();
  const productId = await firstCommodityRow.getAttribute('data-product-id');
  expect(productId).toBeTruthy();
  await firstCommodityRow.click();

  await expect(page.locator(`.global-market-product-detail[data-global-product-id="${productId}"]`)).toBeVisible();
  const regionRows = page.locator('.global-market-region-row');
  expect(await regionRows.count()).toBeGreaterThan(0);
  const firstRegion = regionRows.first();
  const provinceId = await firstRegion.getAttribute('data-province-id');
  expect(provinceId).toBeTruthy();
  await firstRegion.click();
  await expect(page.locator(`.global-market-page[data-drilldown-province-id="${provinceId}"]`)).toBeVisible();
  await expect(page.locator('.market-page')).toBeVisible();
});

test('global market and building tables keep reusable sortable headers aligned with body rows', async ({ page }) => {
  await openGlobalPage(page, '市场');
  const marketHeaders = page.locator('.global-market-goods-header .entity-list-header__sort-button');
  await expect(marketHeaders).toHaveCount(6);
  const firstMarketRow = page.locator('.global-market-goods-row').first();
  await expect(firstMarketRow).toBeVisible();
  const marketHeaderBox = await page.locator('.global-market-goods-header').boundingBox();
  const marketRowBox = await firstMarketRow.boundingBox();
  expect(marketHeaderBox?.width).toBeCloseTo(marketRowBox?.width ?? 0, 0);
  await marketHeaders.nth(1).click();
  await expect(page.locator('.global-market-goods-header')).toHaveAttribute('data-sort-key', 'price');

  await openGlobalPage(page, '建筑');
  const buildingHeaders = page.locator('.global-facility-catalog-header .entity-list-header__sort-button');
  await expect(buildingHeaders).toHaveCount(3);
  const firstBuildingRow = page.locator('.global-facility-catalog-row').first();
  await expect(firstBuildingRow).toBeVisible();
  const buildingHeaderBox = await page.locator('.global-facility-catalog-header').boundingBox();
  const buildingRowBox = await firstBuildingRow.boundingBox();
  expect(buildingHeaderBox?.width).toBeCloseTo(buildingRowBox?.width ?? 0, 0);
  await buildingHeaders.nth(2).click();
  await expect(page.locator('.global-facility-catalog-header')).toHaveAttribute('data-sort-key', 'count');
});

test('global catalog rows format single-factory profit direction without relying on a visible sign', async ({ page }) => {
  await openGlobalPage(page, '建筑');
  const profitCells = page.locator('.global-facility-catalog-row__profit');
  expect(await profitCells.count()).toBeGreaterThan(0);
  const values = await profitCells.evaluateAll((cells) => cells.map((cell) => ({
    text: cell.textContent?.trim() ?? '',
    className: cell.className,
    title: cell.getAttribute('title') ?? '',
  })));
  for (const value of values) {
    expect(value.text.startsWith('+')).toBe(false);
    if (value.className.includes('is-negative')) expect(value.text.startsWith('-')).toBe(false);
    expect(value.title).toContain('跨州单厂平均利润／分钟');
  }
});

test('global market summary distinguishes official, last-trade and reference prices', async ({ page }) => {
  await openGlobalPage(page, '市场');
  const firstCommodityRow = page.locator('.global-market-goods-row').first();
  await expect(firstCommodityRow).toBeVisible();
  const productId = await firstCommodityRow.getAttribute('data-product-id');
  expect(productId).toBeTruthy();
  await firstCommodityRow.click();

  const productDetail = page.locator(`.global-market-product-detail[data-global-product-id="${productId}"]`);
  await expect(productDetail).toBeVisible();
  await expect(productDetail.getByText('官方价格')).toBeVisible();
  await expect(productDetail.getByText('最近成交')).toBeVisible();
  await expect(productDetail.getByText('参考价')).toBeVisible();
  await expect(productDetail.getByText('价格区间')).toBeVisible();
});

test('global market region rows keep four decimal price columns aligned without horizontal page scroll', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openGlobalPage(page, '市场');
  const firstCommodityRow = page.locator('.global-market-goods-row').first();
  await expect(firstCommodityRow).toBeVisible();
  await firstCommodityRow.click();

  const regionRows = page.locator('.global-market-region-row');
  expect(await regionRows.count()).toBeGreaterThan(0);
  const firstRegion = regionRows.first();
  for (const selector of [
    '.global-market-region-row__price--official',
    '.global-market-region-row__price--trade',
    '.global-market-region-row__price--reference',
    '.global-market-region-row__price--range',
  ]) {
    await expect(firstRegion.locator(selector)).toBeVisible();
  }
  await expectNoPageHorizontalOverflow(page);
});

test('building catalog and region list share detail production-config content while compressing the first row', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await openGlobalPage(page, '建筑');
  const catalogRow = page.locator('.global-facility-catalog-row').first();
  await expect(catalogRow).toBeVisible();
  const firstFacilityName = (await catalogRow.locator('.global-facility-catalog-row__identity strong').textContent())?.trim();
  expect(firstFacilityName).toBeTruthy();

  const openButton = catalogRow.locator('.global-facility-catalog-row__open');
  const quickProduct = catalogRow.locator('[data-quick-production="product"]');
  const quickMethod = catalogRow.locator('[data-quick-production="method"]');
  const artwork = catalogRow.locator('.global-facility-catalog-row__artwork');
  await expect(quickProduct).toHaveCount(1);
  await expect(quickMethod).toHaveCount(1);
  await expect(artwork).toBeVisible();
  const openBox = await openButton.boundingBox();
  const productBox = await quickProduct.boundingBox();
  const methodBox = await quickMethod.boundingBox();
  const artworkBox = await artwork.boundingBox();
  expect(openBox).not.toBeNull();
  expect(productBox).not.toBeNull();
  expect(methodBox).not.toBeNull();
  expect(artworkBox).not.toBeNull();
  if (!openBox || !productBox || !methodBox || !artworkBox) throw new Error('建筑列表两行几何未渲染');
  expect(openBox.y + openBox.height).toBeLessThanOrEqual(productBox.y + 1);
  expect(openBox.height).toBeGreaterThanOrEqual(30);
  expect(openBox.height).toBeLessThan(44);
  expect(Math.abs(productBox.y - methodBox.y)).toBeLessThanOrEqual(1);
  expect(artworkBox.y).toBeLessThanOrEqual(openBox.y + 1);
  expect(artworkBox.y + artworkBox.height).toBeGreaterThanOrEqual(productBox.y + productBox.height - 1);
  const rowPadding = await catalogRow.evaluate((element) => {
    const style = getComputedStyle(element);
    return [style.paddingTop, style.paddingRight, style.paddingBottom, style.paddingLeft];
  });
  expect(rowPadding[0]).toBe(rowPadding[2]);
  expect(rowPadding[1]).toBe(rowPadding[3]);
  expect(Number.parseFloat(rowPadding[0])).toBeLessThan(Number.parseFloat(rowPadding[1]));

  const productSelect = quickProduct.getByRole('combobox');
  await expect(productSelect).toHaveAttribute('data-variant', 'production-config');
  if (await productSelect.isEnabled()) {
    await productSelect.click();
    const productListbox = page.getByRole('listbox');
    await expect(productListbox).toBeVisible();
    await expect(productListbox).toHaveAttribute('data-variant', 'production-config');
    await expect(productListbox.locator('.ui-rich-select__visual').first()).toBeVisible();
    await expect(productListbox.locator('.production-config-detail').first()).toBeVisible();
    expect(await page.getByRole('option').count()).toBeGreaterThan(1);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('listbox')).toHaveCount(0);
  }

  await openButton.click();
  await expect(page.getByRole('heading', { name: firstFacilityName!, exact: true })).toBeVisible();
  const regionalFacilityRow = page.locator('.global-facility-region-row').first();
  await expect(regionalFacilityRow).toBeVisible();
  const regionOpenButton = regionalFacilityRow.locator('.global-facility-region-row__open');
  const regionQuickProduct = regionalFacilityRow.locator('[data-quick-production="product"]');
  const regionQuickMethod = regionalFacilityRow.locator('[data-quick-production="method"]');
  await expect(regionQuickProduct).toHaveCount(1);
  await expect(regionQuickMethod).toHaveCount(1);
  await expect(regionalFacilityRow.locator('.global-facility-region-row__artwork')).toHaveCount(0);
  await expect(regionalFacilityRow.locator('.global-facility-region-row__quick-controls .ui-rich-select__visual')).toHaveCount(2);
  const regionOpenBox = await regionOpenButton.boundingBox();
  expect(regionOpenBox).not.toBeNull();
  if (!regionOpenBox) throw new Error('地区工厂第一行未渲染');
  expect(regionOpenBox.height).toBeGreaterThanOrEqual(30);
  expect(regionOpenBox.height).toBeLessThan(44);
  const regionProductSelect = regionQuickProduct.getByRole('combobox');
  await expect(regionProductSelect).toHaveAttribute('data-variant', 'production-config');
  if (await regionProductSelect.isEnabled()) {
    await regionProductSelect.click();
    const regionProductListbox = page.getByRole('listbox');
    await expect(regionProductListbox).toBeVisible();
    await expect(regionProductListbox).toHaveAttribute('data-variant', 'production-config');
    await expect(regionProductListbox.locator('.ui-rich-select__visual').first()).toBeVisible();
    await expect(regionProductListbox.locator('.production-config-detail').first()).toBeVisible();
    expect(await page.getByRole('option').count()).toBeGreaterThan(1);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('listbox')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: firstFacilityName!, exact: true })).toBeVisible();
  }
  await regionProductSelect.hover();
  const regionTriggerStyle = await expectListTriggerSkin(regionProductSelect);
  const regionalProvinceId = await regionalFacilityRow.getAttribute('data-province-id');
  expect(regionalProvinceId).toBeTruthy();
  await regionOpenButton.click();
  await expect(page.locator(`.global-buildings-page[data-drilldown-province-id="${regionalProvinceId}"]`)).toBeVisible();
  await expect(page.locator('.facility-cluster-detail-page')).toBeVisible();
  const detailProductSelect = page.locator('.facility-production-settings-grid').getByRole('combobox').first();
  await expect(detailProductSelect).toHaveAttribute('data-variant', 'production-config');
  await detailProductSelect.hover();
  const detailTriggerStyle = await expectListTriggerSkin(detailProductSelect);
  expect(regionTriggerStyle).toEqual(detailTriggerStyle);
  await page.getByRole('button', { name: '返回上一页面' }).click();
  await expect(page.locator('.global-buildings-page[data-global-facility-type-id]')).toBeVisible();
  await page.getByRole('button', { name: '返回上一页面' }).click();
  await expect(page.getByRole('heading', { name: '建筑', exact: true })).toBeVisible();
  await expect(page.locator('.global-province-list')).toHaveCount(0);
});
