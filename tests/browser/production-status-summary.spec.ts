import { expect, test } from '@playwright/test';

test.describe('production cluster status summary', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('counts running, stopped and error clusters while omitting construction from the heading', async ({ page }) => {
    await page.goto('runtime-test.html?view=production&scenario=cluster-summary');

    const summary = page.locator('.page-heading-actions');
    await expect(summary).toContainText('运行 2');
    await expect(summary).toContainText('停止 1');
    await expect(summary).toContainText('异常 1');
    await expect(summary).not.toContainText('施工');

    const buildConstruction = page.locator('.production-build-card .construction-status');
    await expect(buildConstruction).toHaveCount(1);
    await expect(buildConstruction).toContainText('施工中');

    const detailAcceleration = page.locator('.facility-cluster-detail-card .construction-status');
    await expect(detailAcceleration).toHaveCount(1);
    await expect(detailAcceleration).toContainText('宝石加速');
  });
});
