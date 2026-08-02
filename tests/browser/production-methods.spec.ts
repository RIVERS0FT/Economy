import { expect, test } from '@playwright/test';

test.describe('factory production methods', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('previews the pending method and submits the selected stable recipe variant', async ({ page }) => {
    await page.goto('runtime-test.html?view=production&scenario=production-methods');

    const detail = page.locator('.facility-cluster-detail-card');
    await expect(detail).toContainText('作业制度');
    await expect(detail).toContainText('下一周期切换为：机械制造 · 高速生产');

    const methodSelect = detail.getByRole('combobox', { name: '机械工厂生产方式' });
    await expect(methodSelect).toHaveValue('rapid');

    const summary = detail.locator('.facility-production-method-summary');
    await expect(summary).toContainText('高速生产');
    await expect(summary).toContainText('1m · 产出 1 · 成本 12');
    await expect(summary).toContainText('缩短周期并提高成本');

    await methodSelect.selectOption('economical');
    await expect.poll(async () => page.evaluate(() => (
      window as typeof window & { __productionRecipeRequests?: string[] }
    ).__productionRecipeRequests ?? [])).toEqual([
      'machine-factory:machinery-recipe--economical',
    ]);
  });
});
