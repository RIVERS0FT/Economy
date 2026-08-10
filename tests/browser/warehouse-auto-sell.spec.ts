import { expect, test } from '@playwright/test';

test.describe('warehouse online auto sell policy', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('shows a zero-default minimum free inventory alongside the minimum price', async ({ page }) => {
    await page.goto('runtime-test.html?view=production&scenario=cluster-summary');

    const productCard = page.locator('.warehouse-product-card').first();
    await expect(productCard).toBeVisible();
    await productCard.click();

    const panel = page.locator('.warehouse-auto-sell-panel');
    await expect(panel).toBeVisible();
    await expect(panel).toContainText('最低自由库存');
    await expect(panel.getByLabel('最低自由库存')).toHaveValue('0');
    await expect(panel.getByLabel('最低自动出售价格')).toBeVisible();
  });
});
