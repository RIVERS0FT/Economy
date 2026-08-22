import { expect, test, type Locator } from '@playwright/test';

async function expectTopLayerHitTarget(locator: Locator) {
  const hit = await locator.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const target = document.elementFromPoint(
      rect.left + rect.width / 2,
      rect.top + rect.height / 2,
    );
    return target === element || element.contains(target);
  });
  expect(hit).toBe(true);
}

test('mobile production rich selects use the browser top layer above the factory detail page', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('runtime-test.html?view=production&scenario=production-methods');

  await page.locator('.facility-cluster-selector-card').first().click();
  const detail = page.locator('.facility-cluster-detail-card');
  await expect(detail).toBeVisible();
  await expect(page.locator('.mobile-detail-sheet')).toHaveCount(0);

  const recipeSelect = detail.getByRole('combobox', { name: '机械工厂生产产物' });
  await recipeSelect.click();
  const recipeListbox = page.getByRole('listbox', { name: '机械工厂生产产物' });
  await expect(recipeListbox).toBeVisible();
  await expect(recipeListbox).toHaveAttribute('data-top-layer', 'true');
  expect(await recipeListbox.evaluate((element) => element.matches(':popover-open'))).toBe(true);
  expect(await recipeListbox.evaluate((element) => getComputedStyle(element).position)).toBe('fixed');
  await expectTopLayerHitTarget(recipeListbox.getByRole('option').first());
  await page.keyboard.press('Escape');
  await expect(recipeListbox).toHaveCount(0);

  const methodSelect = detail.getByRole('combobox', { name: '机械工厂生产方式' });
  await methodSelect.click();
  const methodListbox = page.getByRole('listbox', { name: '机械工厂生产方式' });
  await expect(methodListbox).toBeVisible();
  await expect(methodListbox).toHaveAttribute('data-top-layer', 'true');
  const economical = methodListbox.getByRole('option', { name: '节约生产' });
  await expectTopLayerHitTarget(economical);
  await economical.click();

  await expect.poll(async () => page.evaluate(() => (
    window as typeof window & { __productionRecipeRequests?: string[] }
  ).__productionRecipeRequests ?? [])).toEqual([
    'machine-factory:machinery-recipe--economical',
  ]);
});