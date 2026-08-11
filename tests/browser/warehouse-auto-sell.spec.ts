import { expect, test } from '@playwright/test';

test.describe('warehouse online auto trade policy', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('places the desktop auto-trade panel left of the warehouse at the build-card width', async ({ page }) => {
    await page.goto('runtime-test.html?view=production&scenario=cluster-summary');

    const autoTradeCard = page.locator('.warehouse-auto-trade-card');
    const warehouseCard = page.locator('.warehouse-inventory-panel');
    const buildCard = page.locator('.production-build-card');
    await expect(autoTradeCard).toBeVisible();
    await expect(warehouseCard).toBeVisible();
    await expect(buildCard).toBeVisible();

    const [autoTradeBox, warehouseBox, buildBox] = await Promise.all([
      autoTradeCard.boundingBox(),
      warehouseCard.boundingBox(),
      buildCard.boundingBox(),
    ]);
    expect(autoTradeBox).not.toBeNull();
    expect(warehouseBox).not.toBeNull();
    expect(buildBox).not.toBeNull();
    expect(autoTradeBox!.x).toBeLessThan(warehouseBox!.x);
    expect(Math.abs(autoTradeBox!.width - buildBox!.width)).toBeLessThanOrEqual(1);

    const productCard = page.locator('.warehouse-product-card').first();
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
    await page.goto('runtime-test.html?view=production&scenario=cluster-summary');

    const stockedIds = await page.locator('.warehouse-product-card[data-product-id]').evaluateAll((elements) => (
      elements.map((element) => (element as HTMLElement).dataset.productId || '').filter(Boolean)
    ));
    const selector = page.getByRole('combobox', { name: '自动交易商品' });
    await selector.click();
    const optionValues = await page.locator('.ui-rich-select__option[data-value]').evaluateAll((elements) => (
      elements.map((element) => (element as HTMLElement).dataset.value || '').filter(Boolean)
    ));
    const productWithoutWarehouseCard = optionValues.find((value) => !stockedIds.includes(value)) ?? optionValues.at(-1);
    expect(productWithoutWarehouseCard).toBeTruthy();
    if (productWithoutWarehouseCard && stockedIds.includes(productWithoutWarehouseCard)) {
      await page.locator(`.warehouse-product-card[data-product-id="${productWithoutWarehouseCard}"]`).evaluate((element) => element.remove());
    }
    await page.locator(`.ui-rich-select__option[data-value="${productWithoutWarehouseCard}"]`).click();

    const autoTradeCard = page.locator('.warehouse-auto-trade-card');
    await expect(autoTradeCard).toContainText('目标自由库存');
    await expect(autoTradeCard).toContainText('预计自动采购');
    await expect(autoTradeCard.getByRole('button', { name: '保存自动交易设置' })).toBeVisible();
  });

  test('uses the shared bottom sheet at 720px and restores focus after closing', async ({ page }) => {
    await page.setViewportSize({ width: 720, height: 900 });
    await page.goto('runtime-test.html?view=production&scenario=cluster-summary');

    const autoTradeCard = page.locator('.warehouse-auto-trade-card');
    const productCard = page.locator('.warehouse-product-card').first();
    await expect(autoTradeCard).toBeHidden();
    await productCard.click();

    const sheet = page.locator('.mobile-detail-sheet');
    await expect(sheet).toBeVisible();
    await expect(sheet).toContainText('自动交易');
    await expect(sheet).toContainText('设置保存至存档 · 在线维护买单');
    await expect(sheet.getByLabel('目标自由库存')).toHaveValue('0');
    await expect(sheet.getByLabel('最高自动采购价格')).toBeVisible();
    await expect(page.locator('.mobile-detail-sheet-footer').getByRole('button', { name: '保存自动交易设置' })).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(sheet).toHaveCount(0);
    await expect(productCard).toBeFocused();
  });

  test('opens the shared bottom sheet from the mobile warehouse header with the full catalog selector', async ({ page }) => {
    await page.setViewportSize({ width: 720, height: 900 });
    await page.goto('runtime-test.html?view=production&scenario=cluster-summary');

    const trigger = page.getByRole('button', { name: '自动交易' }).last();
    await expect(trigger).toBeVisible();
    await trigger.click();

    const sheet = page.locator('.mobile-detail-sheet');
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole('combobox', { name: '自动交易商品' })).toBeVisible();
    await expect(sheet).toContainText('可选择任意商品，包括当前库存为 0 的商品。');

    await page.keyboard.press('Escape');
    await expect(sheet).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });

  test('keeps the desktop side panel at 721px instead of opening a mobile sheet', async ({ page }) => {
    await page.setViewportSize({ width: 721, height: 900 });
    await page.goto('runtime-test.html?view=production&scenario=cluster-summary');

    const autoTradeCard = page.locator('.warehouse-auto-trade-card');
    await expect(autoTradeCard).toBeVisible();
    await page.locator('.warehouse-product-card').first().click();
    await expect(autoTradeCard).toContainText('设置保存至存档 · 在线维护买单');
    await expect(autoTradeCard).toContainText('目标自由库存');
    await expect(page.locator('.mobile-detail-sheet')).toHaveCount(0);
  });
});
