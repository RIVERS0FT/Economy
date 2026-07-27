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

    const detailAcceleration = page.locator('.facility-cluster-detail-card .construction-status');
    await expect(detailAcceleration).toHaveCount(1);
    await expect(detailAcceleration).toBeHidden();
    await expect(detailAcceleration).toHaveAttribute('aria-hidden', 'true');
    await expect(detailAcceleration).toHaveAttribute('data-gem-acceleration-relocated', 'true');
  });
});
