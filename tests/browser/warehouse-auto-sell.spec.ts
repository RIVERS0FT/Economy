import { expect, test } from '@playwright/test';

async function clickMapProvinceLabel(page: import('@playwright/test').Page, provinceName: string) {
  const label = page.locator('.province-map-label').filter({ hasText: new RegExp(`^${provinceName}$`) });
  await expect(label).toBeVisible();
  const point = await label.evaluate((element) => {
    const x = Number(element.getAttribute('data-label-center-x'));
    const y = Number(element.getAttribute('data-label-center-y'));
    const matrix = element.ownerSVGElement?.getScreenCTM();
    if (!Number.isFinite(x) || !Number.isFinite(y) || !matrix) {
      throw new Error('province label center transform is missing');
    }
    return { x: matrix.a * x + matrix.c * y + matrix.e, y: matrix.b * x + matrix.d * y + matrix.f };
  });
  await page.mouse.click(point.x, point.y);
}

test.describe('warehouse and market online auto trade responsibilities', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('regional commodity detail keeps a fixed desktop auto-trade control', async ({ page }) => {
    await page.goto('market-runtime-test.html?scenario=active&view=catalog');
    await expect(page.locator('.market-workspace-switch')).toHaveCount(0);
    await expect(page.locator('.market-overview-metrics')).toHaveCount(0);
    await expect(page.locator('.market-catalog-panel')).toHaveCount(0);
    await page.getByRole('button', { name: '查看小麦详情' }).click();

    const autoTradeCard = page.locator('.market-auto-trade-card');
    await expect(autoTradeCard).toBeVisible();
    await expect(page.locator('.market-auto-trade-products')).toHaveCount(0);
    await expect(page.getByRole('combobox', { name: '自动交易商品' })).toHaveCount(0);
    await expect(autoTradeCard).toContainText('小麦 · 自动交易');
    await expect(autoTradeCard.getByRole('button', { name: '自动采购' })).toHaveAttribute('aria-pressed', 'true');
    await expect(autoTradeCard.getByLabel('目标自由库存')).toBeVisible();
    await autoTradeCard.getByRole('button', { name: '自动出售' }).click();
    await expect(autoTradeCard.getByLabel('最低自由库存')).toBeVisible();
    await expect(page.locator('.mobile-detail-sheet')).toHaveCount(0);
  });

  test('regional market catalog removes workspace switches and opens fixed commodity auto-trade', async ({ page }) => {
    await page.goto('market-runtime-test.html?scenario=active&view=catalog');
    const rows = page.locator('.market-commodity-row');
    expect(await rows.count()).toBeGreaterThan(1);
    await rows.last().click();
    await expect(page.locator('.market-auto-trade-workspace--fixed')).toBeVisible();
    await expect(page.locator('.market-auto-trade-card').getByRole('button', { name: '保存自动交易设置' })).toBeVisible();
  });

  test('regional commodity detail uses the shared bottom sheet at 720px', async ({ page }) => {
    await page.setViewportSize({ width: 720, height: 900 });
    await page.goto('market-runtime-test.html?scenario=active&view=catalog');
    await page.getByRole('button', { name: '查看小麦详情' }).click();

    const autoTradeCard = page.locator('.market-auto-trade-card');
    const trigger = page.getByRole('button', { name: '设置自动交易' });
    await expect(autoTradeCard).toBeHidden();
    await expect(trigger).toBeVisible();
    await trigger.click();

    const sheet = page.locator('.mobile-detail-sheet');
    const detailView = sheet.locator('.mobile-workspace-sheet-detail-view');
    await expect(sheet).toBeVisible();
    await expect(detailView).toBeVisible();
    await expect(detailView).toContainText('小麦 · 自动交易');
    await expect(detailView.getByLabel('目标自由库存')).toBeVisible();
    await expect(detailView.locator('.mobile-detail-sheet-footer').getByRole('button', { name: '保存自动交易设置' })).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(detailView).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });

  test('province warehouse stays read-only on mobile while transport remains available', async ({ page }) => {
    await page.setViewportSize({ width: 900, height: 900 });
    await page.goto('runtime-test.html?view=map', { waitUntil: 'domcontentloaded' });
    const map = page.getByTestId('us-mainland-map');
    await expect(map).toHaveAttribute('data-map-ready', 'true');
    await clickMapProvinceLabel(page, '加利福尼亚州');

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

  test('regional commodity detail keeps the fixed desktop control at 721px', async ({ page }) => {
    await page.setViewportSize({ width: 721, height: 900 });
    await page.goto('market-runtime-test.html?scenario=active&view=catalog');
    await page.getByRole('button', { name: '查看小麦详情' }).click();

    const autoTradeCard = page.locator('.market-auto-trade-card');
    await expect(autoTradeCard).toBeVisible();
    await expect(page.getByRole('button', { name: '设置自动交易' })).toBeHidden();
    await expect(autoTradeCard).toContainText('目标自由库存');
    await expect(page.locator('.mobile-detail-sheet')).toHaveCount(0);
  });
});
