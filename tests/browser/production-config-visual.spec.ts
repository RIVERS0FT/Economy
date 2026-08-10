import { expect, test } from '@playwright/test';

async function expectImageOnlyTrigger(
  trigger: ReturnType<Parameters<typeof expect>[0]['locator']>,
) {
  await expect(trigger.locator('.ui-rich-select__visual')).toHaveCount(1);
  await expect(trigger.locator('.ui-rich-select__content')).toBeHidden();
  await expect(trigger.locator('.ui-rich-select__chevron')).toBeHidden();
  await expect.poll(() => trigger.evaluate((element) => (element as HTMLElement).innerText.trim())).toBe('');

  const visualStyle = await trigger.locator('.ui-rich-select__visual').evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      backgroundColor: style.backgroundColor,
      borderTopWidth: style.borderTopWidth,
    };
  });
  expect(visualStyle.backgroundColor).toBe('rgba(0, 0, 0, 0)');
  expect(visualStyle.borderTopWidth).toBe('0px');
}

test.describe('production configuration visual triggers', () => {
  test('collapsed production selectors show only artwork without arrows or image backplates', async ({ page }) => {
    for (const viewport of [
      { width: 1440, height: 900 },
      { width: 390, height: 844 },
    ]) {
      await page.setViewportSize(viewport);
      await page.goto('runtime-test.html?view=production&scenario=production-methods');

      if (viewport.width <= 720) {
        await page.locator('.facility-cluster-selector-card').first().click();
      }

      const scope = viewport.width <= 720
        ? page.locator('.mobile-detail-sheet')
        : page.locator('.facility-cluster-detail-card');
      const recipeSelect = scope.getByRole('combobox', { name: '机械工厂生产产物' });
      const methodSelect = scope.getByRole('combobox', { name: '机械工厂生产方式' });

      await expectImageOnlyTrigger(recipeSelect);
      await expectImageOnlyTrigger(methodSelect);
      await expect(recipeSelect.locator('[data-product-artwork="machinery"]')).toHaveCount(1);
      await expect(methodSelect.locator('[data-production-method-icon="rapid"]')).toHaveCount(1);

      await recipeSelect.click();
      const recipeListbox = page.getByRole('listbox', { name: '机械工厂生产产物' });
      const recipeOption = recipeListbox.getByRole('option', { name: '机械制造' });
      await expect(recipeOption).toContainText('机械制造');
      await expect(recipeOption).toContainText('投入');
      await expect(recipeOption).toContainText('产出');
      await expect(recipeOption).toContainText('周期 60s');
      await expect(recipeOption).toContainText('成本 12');
      const optionVisualStyle = await recipeOption.locator('.ui-rich-select__visual').evaluate((element) => {
        const style = getComputedStyle(element);
        return {
          backgroundColor: style.backgroundColor,
          borderTopWidth: style.borderTopWidth,
        };
      });
      expect(optionVisualStyle.backgroundColor).toBe('rgba(0, 0, 0, 0)');
      expect(optionVisualStyle.borderTopWidth).toBe('0px');
      await page.keyboard.press('Escape');

      await methodSelect.click();
      const methodListbox = page.getByRole('listbox', { name: '机械工厂生产方式' });
      const currentMethod = methodListbox.getByRole('option', { name: '高速生产' });
      await expect(currentMethod).toContainText('周期 60s');
      await expect(currentMethod).toContainText('成本 12');
      await expect(currentMethod).toContainText('产出 ×1');
      await expect(currentMethod).toContainText('投入');
      await page.keyboard.press('Escape');
    }
  });
});
