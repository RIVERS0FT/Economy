import { expect, test } from '@playwright/test';

test.describe('warehouse and market online auto trade responsibilities', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('market auto-trade panel keeps its desktop control column', async ({ page }) => {
    await page.goto('market-runtime-test.html?scenario=active&view=catalog');
    await page.getByRole('button', { name: '自动交易', exact: true }).click();

    const autoTradeCard = page.locator('.market-auto-trade-card');
    const productPanel = page.locator('.market-auto-trade-products');
    await expect(autoTradeCard).toBeVisible();
    await expect(productPanel).toBeVisible();

    const [autoTradeBox, productPanelBox] = await Promise.all([
      autoTradeCard.boundingBox(),
      productPanel.boundingBox(),
    ]);
    expect(autoTradeBox).not.toBeNull();
    expect(productPanelBox).not.toBeNull();
    expect(autoTradeBox!.x).toBeLessThan(productPanelBox!.x);
    expect(autoTradeBox!.width).toBeGreaterThanOrEqual(280);
    expect(autoTradeBox!.width).toBeLessThanOrEqual(320);

    const productCard = page.locator('.market-auto-trade-product-card').first();
    await productCard.click();
    await expect(autoTradeCard.getByRole('button', { name: '自动采购' })).toHaveAttribute('aria-pressed', 'true');
    await expect(autoTradeCard).toContainText('设置保存至存档 · 在线维护买单');
    await expect(autoTradeCard.getByLabel('目标自由库存')).toHaveValue('0');
    await expect(autoTradeCard.getByLabel('最高自动采购价格')).toBeVisible();

    await autoTradeCard.getByRole('button', { name: '自动出售' }).click();
    await expect(autoTradeCard).toContainText('设置保存至存档 · 在线维护卖单');
    await expect(autoTradeCard.getByLabel('最低自由库存')).toHaveValue('0');
    await expect(autoTradeCard.getByLabel('最低自动出售价格')).toBeVisible();
    await expect(page.locator('.mobile-detail-sheet')).toHaveCount(0);
  });

  test('opens auto-trade for a zero-stock product from the full catalog selector', async ({ page }) => {
    await page.goto('market-runtime-test.html?scenario=active&view=catalog');
    await page.getByRole('button', { name: '自动交易', exact: true }).click();

    const activeProductIds = await page.locator('.market-auto-trade-product-card[data-product-id]').evaluateAll((elements) => (
      elements.map((element) => (element as HTMLElement).dataset.productId || '').filter(Boolean)
    ));
    const selector = page.getByRole('combobox', { name: '自动交易商品' });
    await selector.click();
    const optionValues = await page.locator('.ui-rich-select__option[data-value]').evaluateAll((elements) => (
      elements.map((element) => (element as HTMLElement).dataset.value || '').filter(Boolean)
    ));
    const zeroStockProductId = optionValues.find((value) => !activeProductIds.includes(value));
    expect(zeroStockProductId).toBeTruthy();
    await page.locator(`.ui-rich-select__option[data-value="${zeroStockProductId}"]`).click();

    const autoTradeCard = page.locator('.market-auto-trade-card');
    await expect(autoTradeCard).toContainText('目标自由库存');
    await expect(autoTradeCard).toContainText('预计自动采购');
    await expect(autoTradeCard.getByRole('button', { name: '保存自动交易设置' })).toBeVisible();
  });

  test('uses the shared bottom sheet at 720px and restores focus after closing', async ({ page }) => {
    await page.setViewportSize({ width: 720, height: 900 });
    await page.goto('market-runtime-test.html?scenario=active&view=catalog');
    await page.getByRole('button', { name: '自动交易', exact: true }).click();

    const autoTradeCard = page.locator('.market-auto-trade-card');
    const productCard = page.locator('.market-auto-trade-product-card').first();
    await expect(autoTradeCard).toBeHidden();
    await productCard.click();

    const sheet = page.locator('.mobile-detail-sheet');
    const detailView = sheet.locator('.mobile-workspace-sheet-detail-view');
    await expect(sheet).toBeVisible();
    await expect(detailView).toBeVisible();
    await expect(detailView).toContainText('自动交易');
    await expect(detailView).toContainText('设置保存至存档 · 在线维护买单');
    await expect(detailView.getByLabel('目标自由库存')).toHaveValue('0');
    await expect(detailView.getByLabel('最高自动采购价格')).toBeVisible();
    await expect(detailView.locator('.mobile-detail-sheet-footer').getByRole('button', { name: '保存自动交易设置' })).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(detailView).toHaveCount(0);
    await expect(sheet).toBeVisible();
    await expect(sheet).toHaveAttribute('data-detail-active', 'false');
    await expect(productCard).toBeFocused();
  });

  test('province warehouse stays read-only on mobile while transport remains available', async ({ page }) => {
    await page.setViewportSize({ width: 900, height: 900 });
    await page.goto('runtime-test.html?view=map', { waitUntil: 'domcontentloaded' });
    const map = page.getByTestId('us-mainland-map');
    await expect(map).toHaveAttribute('data-echarts-ready', 'true');
    await map.locator('svg text').filter({ hasText: /^CA$/ }).click();

    await page.setViewportSize({ width: 390, height: 844 });
    const provinceTabs = page.getByRole('tablist', { name: '加利福尼亚州页面分区' });
    await expect(provinceTabs).toBeVisible();
    await provinceTabs.getByRole('tab', { name: '仓库', exact: true }).click();

    const warehouse = page.locator('.province-warehouse-section');
    await expect(warehouse).toBeVisible();
    await expect(warehouse.getByText('无限容量', { exact: true })).toBeVisible();
    const productCards = warehouse.locator('.warehouse-product-card--readonly');
    expect(await productCards.count()).toBeGreaterThan(0);
    await expect(productCards.locator('button')).toHaveCount(0);
    await expect(warehouse.getByLabel('跨州运输')).toBeVisible();
    await expect(warehouse.locator('.transport-submit')).toBeVisible();
    await expect(warehouse.getByText('自动交易', { exact: true })).toHaveCount(0);
    const sheet = page.locator('.mobile-workspace-sheet-host');
    await expect(sheet).toBeVisible();
    await expect(sheet).toHaveAttribute('data-page-key', 'province');
    await expect(sheet).toHaveAttribute('data-detail-active', 'false');
  });

  test('keeps the desktop side panel at 721px instead of opening a mobile sheet', async ({ page }) => {
    await page.setViewportSize({ width: 721, height: 900 });
    await page.goto('market-runtime-test.html?scenario=active&view=catalog');
    await page.getByRole('button', { name: '自动交易', exact: true }).click();

    const autoTradeCard = page.locator('.market-auto-trade-card');
    await expect(autoTradeCard).toBeVisible();
    const productCard = page.locator('.market-auto-trade-product-card').first();
    await productCard.focus();
    await page.keyboard.press('Enter');
    await expect(autoTradeCard).toContainText('设置保存至存档 · 在线维护买单');
    await expect(autoTradeCard).toContainText('目标自由库存');
    await expect(page.locator('.mobile-detail-sheet')).toHaveCount(0);
  });
});
