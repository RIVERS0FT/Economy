import { expect, test } from '@playwright/test';

test.describe('factory production methods', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('previews the pending method and submits the selected stable recipe variant', async ({ page }) => {
    await page.goto('runtime-test.html?view=production&scenario=production-methods');

    const detail = page.locator('.facility-cluster-detail-card');
    await expect(detail).toContainText('作业制度');
    await expect(detail).toContainText('下一周期切换为：机械制造 · 高速生产');

    const rapid = detail.getByRole('radio', { name: /高速生产/ });
    const economical = detail.getByRole('radio', { name: /节约生产/ });
    await expect(rapid).toHaveAttribute('aria-checked', 'true');
    await expect(economical).toHaveAttribute('aria-checked', 'false');

    await economical.click();
    await expect.poll(async () => page.evaluate(() => (
      window as typeof window & { __productionRecipeRequests?: string[] }
    ).__productionRecipeRequests ?? [])).toEqual([
      'machine-factory:machinery-recipe--economical',
    ]);
  });
});
