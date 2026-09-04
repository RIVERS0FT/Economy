import { expect, test } from '@playwright/test';

test.describe('production cluster status summary', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('production title omits status counts while instant construction shows costs without gem acceleration', async ({ page }) => {
    await page.goto('runtime-test.html?view=production&scenario=cluster-summary');

    const titleBlock = page.locator('.page-fixed-header');
    await expect(titleBlock).not.toContainText('运行 2');
    await expect(titleBlock).not.toContainText('停止 1');
    await expect(titleBlock).not.toContainText('异常 1');
    await expect(titleBlock).not.toContainText('施工');
    await expect(page.locator('.page-heading-actions')).toHaveCount(0);

    const buildCard = page.locator('.production-build-card');
    await expect(buildCard).toContainText('建造数量');
    await expect(buildCard).toContainText('建造资金');
    await expect(buildCard).toContainText('库存可直接建');
    await expect(buildCard).not.toContainText('宝石加速');
    await expect(buildCard).not.toContainText('施工中');
    await expect(buildCard).not.toContainText('施工时间');

    await page.locator('.facility-cluster-selector-card').first().click();
    await expect(page.locator('.facility-cluster-detail-card')).toBeVisible();
    await expect(page.locator('.facility-cluster-detail-card')).not.toContainText('宝石加速');
    await expect(page.locator('.mobile-detail-sheet')).toHaveCount(0);
    await expect(page.locator('.facility-cluster-selector-card[data-status="constructing"]')).toHaveCount(0);
  });

  test('renders decimal daily official prices in single-factory profit', async ({ page }) => {
    await page.goto('runtime-test.html?view=production&scenario=decimal-profit');
    await page.locator('.facility-cluster-selector-card').first().click();

    const profit = page.locator('.facility-average-profit');
    await expect(profit).toHaveCount(1);
    await expect(profit).toContainText('单厂平均利润／分钟');
    await expect(profit).not.toContainText('当前配方预计');
    await expect(profit).not.toContainText('最近真实成交价');
    await expect(profit.locator('small')).toHaveCount(0);
    await expect(profit).toContainText('5.38');
    await expect(profit).not.toContainText('缺少');
    await expect(profit).toHaveClass(/is-positive/);
  });
});