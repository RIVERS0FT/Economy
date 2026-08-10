import { expect, test, type Locator, type Page } from '@playwright/test';

async function expectSquareImageOnlyTrigger(trigger: Locator, expectedSize: number) {
  await expect(trigger.locator('.ui-rich-select__visual')).toHaveCount(1);
  await expect(trigger.locator('.ui-rich-select__content')).toBeHidden();
  await expect(trigger.locator('.ui-rich-select__chevron')).toBeHidden();
  await expect.poll(() => trigger.evaluate((element) => (element as HTMLElement).innerText.trim())).toBe('');

  const geometry = await trigger.evaluate((element) => {
    const triggerRect = element.getBoundingClientRect();
    const wrapper = element.closest('.ui-rich-select');
    const field = element.closest('.ui-form-field');
    const fieldLabel = field?.querySelector('.ui-form-field__label');
    const grid = field?.parentElement;
    const wrapperRect = wrapper?.getBoundingClientRect();
    const fieldRect = field?.getBoundingClientRect();
    const labelRect = fieldLabel?.getBoundingClientRect();
    const gridRect = grid?.getBoundingClientRect();
    const gridStyle = grid ? getComputedStyle(grid) : null;
    const columnGap = Number.parseFloat(gridStyle?.columnGap ?? '0') || 0;
    const fieldIndex = field && grid ? Array.from(grid.children).indexOf(field) : -1;
    const columnWidth = gridRect ? (gridRect.width - columnGap) / 2 : 0;
    const expectedFieldLeft = gridRect && fieldIndex >= 0
      ? gridRect.left + fieldIndex * (columnWidth + columnGap)
      : 0;
    return {
      width: triggerRect.width,
      height: triggerRect.height,
      left: triggerRect.left,
      wrapperWidth: wrapperRect?.width ?? 0,
      fieldWidth: fieldRect?.width ?? 0,
      fieldLeft: fieldRect?.left ?? 0,
      labelWidth: labelRect?.width ?? 0,
      columnWidth,
      expectedFieldLeft,
    };
  });
  expect(Math.abs(geometry.width - geometry.height)).toBeLessThanOrEqual(0.5);
  expect(Math.round(geometry.width)).toBe(expectedSize);
  expect(Math.abs(geometry.wrapperWidth - geometry.width)).toBeLessThanOrEqual(0.5);
  expect(Math.abs(geometry.fieldWidth - Math.max(geometry.labelWidth, geometry.width))).toBeLessThanOrEqual(1);
  expect(geometry.columnWidth - geometry.fieldWidth).toBeGreaterThan(24);
  expect(Math.abs(geometry.fieldLeft - geometry.expectedFieldLeft)).toBeLessThanOrEqual(1);
  expect(Math.abs(geometry.left - geometry.fieldLeft)).toBeLessThanOrEqual(1);

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

async function expectColumnRemainderInactive(page: Page, trigger: Locator) {
  const point = await trigger.evaluate((element) => {
    const triggerRect = element.getBoundingClientRect();
    const field = element.closest('.ui-form-field');
    const grid = field?.parentElement;
    const gridRect = grid?.getBoundingClientRect();
    const gridStyle = grid ? getComputedStyle(grid) : null;
    const columnGap = Number.parseFloat(gridStyle?.columnGap ?? '0') || 0;
    const fieldIndex = field && grid ? Array.from(grid.children).indexOf(field) : -1;
    if (!gridRect || fieldIndex < 0) return null;
    const columnWidth = (gridRect.width - columnGap) / 2;
    const columnLeft = gridRect.left + fieldIndex * (columnWidth + columnGap);
    return {
      x: columnLeft + columnWidth - 8,
      y: triggerRect.top + triggerRect.height / 2,
    };
  });
  expect(point).not.toBeNull();
  if (!point) return;
  await page.mouse.click(point.x, point.y);
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
}

test.describe('production configuration visual triggers', () => {
  test('collapsed production selectors use left-aligned square artwork buttons with inactive column remainder', async ({ page }) => {
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
      const expectedSize = viewport.width <= 720 ? 48 : 52;

      await expectSquareImageOnlyTrigger(recipeSelect, expectedSize);
      await expectSquareImageOnlyTrigger(methodSelect, expectedSize);
      await expectColumnRemainderInactive(page, recipeSelect);
      await expectColumnRemainderInactive(page, methodSelect);
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
