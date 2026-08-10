import { expect, test } from '@playwright/test';

test.describe('warehouse online auto sell policy', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('places the desktop auto-sell panel left of the warehouse at the build-card width', async ({ page }) => {
    await page.goto('runtime-test.html?view=production&scenario=cluster-summary');

    const autoSellCard = page.locator('.warehouse-auto-sell-card');
    const warehouseCard = page.locator('.warehouse-inventory-panel');
    const buildCard = page.locator('.production-build-card');
    await expect(autoSellCard).toBeVisible();
    await expect(warehouseCard).toBeVisible();
    await expect(buildCard).toBeVisible();

    const [autoSellBox, warehouseBox, buildBox] = await Promise.all([
      autoSellCard.boundingBox(),
      warehouseCard.boundingBox(),
      buildCard.boundingBox(),
    ]);
    expect(autoSellBox).not.toBeNull();
    expect(warehouseBox).not.toBeNull();
    expect(buildBox).not.toBeNull();
    expect(autoSellBox!.x).toBeLessThan(warehouseBox!.x);
    expect(Math.abs(autoSellBox!.width - buildBox!.width)).toBeLessThanOrEqual(1);

    const productCard = page.locator('.warehouse-product-card').first();
    await productCard.click();
    await expect(autoSellCard).toContainText('设置保存至存档 · 仅在线执行');
    await expect(autoSellCard).toContainText('最低自由库存');
    await expect(autoSellCard.getByLabel('最低自由库存')).toHaveValue('0');
    await expect(autoSellCard.getByLabel('最低自动出售价格')).toBeVisible();
    await expect(page.locator('.mobile-detail-sheet')).toHaveCount(0);
  });

  test('uses the shared bottom sheet at 720px and restores focus after closing', async ({ page }) => {
    await page.setViewportSize({ width: 720, height: 900 });
    await page.goto('runtime-test.html?view=production&scenario=cluster-summary');

    const autoSellCard = page.locator('.warehouse-auto-sell-card');
    const productCard = page.locator('.warehouse-product-card').first();
    await expect(autoSellCard).toBeHidden();
    await productCard.click();

    const sheet = page.locator('.mobile-detail-sheet');
    await expect(sheet).toBeVisible();
    await expect(sheet).toContainText('设置保存至存档 · 仅在线执行');
    await expect(sheet).toContainText('最低自由库存');
    await expect(sheet.getByLabel('最低自由库存')).toHaveValue('0');
    await expect(sheet.getByLabel('最低自动出售价格')).toBeVisible();
    await expect(page.locator('.mobile-detail-sheet-footer').getByRole('button')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(sheet).toHaveCount(0);
    await expect(productCard).toBeFocused();
  });

  test('keeps the desktop side panel at 721px instead of opening a mobile sheet', async ({ page }) => {
    await page.setViewportSize({ width: 721, height: 900 });
    await page.goto('runtime-test.html?view=production&scenario=cluster-summary');

    const autoSellCard = page.locator('.warehouse-auto-sell-card');
    await expect(autoSellCard).toBeVisible();
    await page.locator('.warehouse-product-card').first().click();
    await expect(autoSellCard).toContainText('设置保存至存档 · 仅在线执行');
    await expect(autoSellCard).toContainText('最低自由库存');
    await expect(page.locator('.mobile-detail-sheet')).toHaveCount(0);
  });
});
