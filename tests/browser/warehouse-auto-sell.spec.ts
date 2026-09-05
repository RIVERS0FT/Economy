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

test.describe('warehouse and factory automatic operation responsibilities', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('factory detail owns the editable automatic-operation policy', async ({ page }) => {
    await page.goto('runtime-test.html?view=production&scenario=production-methods');
    await page.locator('.facility-cluster-selector-card').first().click();

    const controls = page.locator('.facility-auto-operation');
    await expect(controls).toBeVisible();
    await expect(controls).toContainText('自动经营');
    await expect(controls).toContainText('原料保障');
    await expect(controls).not.toContainText('经营模式');
    await expect(controls).not.toContainText('产成品处理');
    await expect(controls.getByRole('button', { name: '保存自动经营策略' })).toHaveCount(0);
    await expect(controls).not.toContainText('系统仍通过本州统一商品订单簿执行真实买卖；合同保留与其他工厂的原料需求会一起计算，不创建工厂专属订单簿。');
    await expect(controls.locator('[data-game-concept="factory-auto-operation"]')).toHaveCount(1);
    await expect(controls.locator('[data-game-concept="input-coverage"]')).toHaveCount(1);
    await expect(controls.getByRole('checkbox', { name: /本地区自动出售/ })).toHaveCount(0);
    await expect(controls.getByText('出售本地区非冻结商品', { exact: true })).toHaveCount(0);
    const productionSettings = page.locator('.facility-production-settings-grid');
    await expect(productionSettings.getByRole('combobox')).toHaveCount(3);
    await expect(productionSettings.getByRole('combobox', { name: '机械工厂原料保障' })).toHaveCount(1);
    await expect(page.locator('.facility-cluster-detail-card')).not.toContainText('目标自由库存');
    await expect(page.locator('.facility-cluster-detail-card')).not.toContainText('最低自由库存');
  });

  test('regional commodity detail omits automatic-operation execution', async ({ page }) => {
    await page.goto('market-runtime-test.html?scenario=active&view=catalog');
    await expect(page.locator('.market-workspace-switch')).toHaveCount(0);
    await expect(page.locator('.market-overview-metrics')).toHaveCount(0);
    await expect(page.locator('.market-catalog-panel')).toHaveCount(0);
    await page.getByRole('button', { name: '查看小麦详情' }).click();

    await expect(page.locator('.market-auto-trade-execution')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: '自动经营执行', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: '设置自动交易' })).toHaveCount(0);
    await expect(page.locator('.market-trade-card')).toBeVisible();
    await expect(page.locator('.market-trade-card')).not.toHaveClass(/ui-primary-surface/);
  });

  test('regional market catalog opens commodity detail without an execution card', async ({ page }) => {
    await page.goto('market-runtime-test.html?scenario=active&view=catalog');
    const rows = page.locator('.market-commodity-row');
    expect(await rows.count()).toBeGreaterThan(1);
    await rows.last().click();
    await expect(page.locator('.market-auto-trade-execution')).toHaveCount(0);
    await expect(page.locator('.market-detail-product-summary')).toBeVisible();
    await expect(page.locator('.market-detail-trade-summary > span')).toHaveCount(4);
  });

  test('regional commodity detail stays direct at 720px without a second strategy sheet', async ({ page }) => {
    await page.setViewportSize({ width: 720, height: 900 });
    await page.goto('market-runtime-test.html?scenario=active&view=catalog');
    await page.getByRole('button', { name: '查看小麦详情' }).click();

    await expect(page.locator('.market-auto-trade-execution')).toHaveCount(0);
    await expect(page.locator('.market-trade-card')).toBeVisible();
    await expect(page.locator('.market-trade-card')).not.toHaveClass(/ui-primary-surface/);
    await expect(page.getByRole('button', { name: '设置自动交易' })).toHaveCount(0);
    await expect(page.locator('.mobile-workspace-sheet-detail-view')).toHaveCount(0);
  });

  test('province warehouse opens regional commodity detail without transport or policy controls', async ({ page }) => {
    await page.setViewportSize({ width: 900, height: 900 });
    await page.goto('runtime-test.html?view=map', { waitUntil: 'domcontentloaded' });
    const map = page.getByTestId('us-mainland-map');
    await expect(map).toHaveAttribute('data-map-ready', 'true');
    await clickMapProvinceLabel(page, '加利福尼亚');

    await page.setViewportSize({ width: 390, height: 844 });
    const provinceTabs = page.getByRole('tablist', { name: '加利福尼亚页面分区' });
    await expect(provinceTabs).toBeVisible();
    await provinceTabs.getByRole('tab', { name: '仓库', exact: true }).click();

    const warehouse = page.locator('.province-warehouse-section');
    await expect(warehouse).toBeVisible();
    await expect(warehouse.getByText('无限容量', { exact: true })).toHaveCount(0);
    await expect(warehouse.getByText('仓库内容', { exact: true })).toHaveCount(0);
    await expect(warehouse.getByText(/实物库存\s+\S+/)).toHaveCount(0);
    const productCards = warehouse.locator('button.warehouse-product-card');
    expect(await productCards.count()).toBeGreaterThan(0);
    await expect(warehouse.locator('.warehouse-transport-panel')).toHaveCount(0);
    await expect(warehouse.getByRole('heading', { name: '跨州运输', exact: true })).toHaveCount(0);
    await expect(warehouse.getByText('自动经营', { exact: true })).toHaveCount(0);

    await productCards.first().click();
    await expect(page.locator('.market-detail-product-summary')).toBeVisible();
    await expect(page.locator('.market-detail-trade-summary > span')).toHaveCount(4);
    await expect(page.getByText('生产者与消费者', { exact: true })).toHaveCount(0);
    await expect(page.getByText('可用库存', { exact: true })).toBeVisible();
    await expect(page.locator('.market-inventory-production-card')).toHaveCount(0);
    await expect(page.locator('.market-auto-trade-execution')).toHaveCount(0);

    const back = page.locator('.page-navigation-button--back');
    await back.click();
    await expect(page.locator('.province-warehouse-section')).toBeVisible();
    await back.click();
    await expect(page.locator('.strategic-page-host')).toHaveAttribute('data-strategic-page', 'map');
  });

  test('regional commodity detail keeps automatic-operation execution absent at 721px', async ({ page }) => {
    await page.setViewportSize({ width: 721, height: 900 });
    await page.goto('market-runtime-test.html?scenario=active&view=catalog');
    await page.getByRole('button', { name: '查看小麦详情' }).click();

    await expect(page.locator('.market-auto-trade-execution')).toHaveCount(0);
    await expect(page.locator('.market-detail-product-summary')).toBeVisible();
    await expect(page.locator('.market-detail-trade-summary > span')).toHaveCount(4);
    await expect(page.locator('.mobile-workspace-sheet-detail-view')).toHaveCount(0);
  });
});
