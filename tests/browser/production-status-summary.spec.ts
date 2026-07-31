import { expect, test } from '@playwright/test';

test.describe('production cluster status summary', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('counts clusters and keeps gem acceleration only in the build card', async ({ page }) => {
    await page.goto('runtime-test.html?view=production&scenario=cluster-summary');

    const summary = page.locator('.page-heading-actions');
    await expect(summary).toContainText('运行 2');
    await expect(summary).toContainText('停止 1');
    await expect(summary).toContainText('异常 1');
    await expect(summary).not.toContainText('施工');

    const buildConstruction = page.locator('.production-build-card .construction-status');
    await expect(buildConstruction).toHaveCount(1);
    await expect(buildConstruction).toContainText('施工中');
    await expect(buildConstruction).toContainText('宝石加速');
    await expect(buildConstruction.getByRole('button', { name: '1 宝石 · 加速 30m' })).toBeVisible();

    await expect(page.locator('.facility-cluster-detail-card')).not.toContainText('宝石加速');
    await expect(page.locator('.facility-detail-sheet')).toHaveCount(0);
    await expect(page.locator('.facility-cluster-selector-card[data-status="constructing"]')).toHaveCount(0);
  });

  test('renders decimal last trade prices in single-factory profit', async ({ page }) => {
    await page.goto('runtime-test.html?view=production&scenario=decimal-profit');

    const profit = page.locator('.facility-average-profit');
    await expect(profit).toHaveCount(1);
    await expect(profit).toContainText('5.38');
    await expect(profit).not.toContainText('缺少');
    await expect(profit).toHaveClass(/is-positive/);
  });
});
