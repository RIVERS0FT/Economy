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
    const wrapperRect = wrapper?.getBoundingClientRect();
    const fieldRect = field?.getBoundingClientRect();
    const labelRect = fieldLabel?.getBoundingClientRect();
    return {
      width: triggerRect.width,
      height: triggerRect.height,
      left: triggerRect.left,
      wrapperWidth: wrapperRect?.width ?? 0,
      fieldWidth: fieldRect?.width ?? 0,
      fieldLeft: fieldRect?.left ?? 0,
      labelWidth: labelRect?.width ?? 0,
    };
  });
  expect(Math.abs(geometry.width - geometry.height)).toBeLessThanOrEqual(0.5);
  expect(Math.round(geometry.width)).toBe(expectedSize);
  expect(Math.abs(geometry.wrapperWidth - geometry.width)).toBeLessThanOrEqual(0.5);
  expect(Math.abs(geometry.fieldWidth - Math.max(geometry.labelWidth, geometry.width))).toBeLessThanOrEqual(1);
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

async function expectAutoSlotRow(page: Page, trigger: Locator) {
  const geometry = await trigger.evaluate((element) => {
    const field = element.closest('.ui-form-field');
    const row = field?.parentElement;
    if (!row) return null;
    const fields = Array.from(row.children)
      .filter((child): child is HTMLElement => child instanceof HTMLElement && child.classList.contains('ui-form-field'));
    const rowRect = row.getBoundingClientRect();
    const rowStyle = getComputedStyle(row);
    return {
      display: rowStyle.display,
      justifyContent: rowStyle.justifyContent,
      flexWrap: rowStyle.flexWrap,
      gap: Number.parseFloat(rowStyle.columnGap || rowStyle.gap || '0') || 0,
      rowLeft: rowRect.left,
      rowRight: rowRect.right,
      rowTop: rowRect.top,
      rowHeight: rowRect.height,
      fields: fields.map((item) => {
        const rect = item.getBoundingClientRect();
        const style = getComputedStyle(item);
        return {
          left: rect.left,
          right: rect.right,
          width: rect.width,
          flexGrow: style.flexGrow,
          flexShrink: style.flexShrink,
          flexBasis: style.flexBasis,
        };
      }),
    };
  });

  expect(geometry).not.toBeNull();
  if (!geometry) return;
  expect(geometry.display).toBe('flex');
  expect(geometry.justifyContent).toBe('flex-start');
  expect(geometry.flexWrap).toBe('nowrap');
  expect(geometry.fields).toHaveLength(2);
  for (const field of geometry.fields) {
    expect(field.flexGrow).toBe('0');
    expect(field.flexShrink).toBe('0');
    expect(field.flexBasis).toBe('auto');
  }
  expect(Math.abs(geometry.fields[0].left - geometry.rowLeft)).toBeLessThanOrEqual(1);
  expect(Math.abs((geometry.fields[1].left - geometry.fields[0].right) - geometry.gap)).toBeLessThanOrEqual(1);
  expect(geometry.rowRight - geometry.fields[1].right).toBeGreaterThan(24);

  await page.mouse.click(
    geometry.rowRight - 8,
    geometry.rowTop + Math.max(1, geometry.rowHeight / 2),
  );
  const expanded = await trigger.evaluate((element) => {
    const row = element.closest('.ui-form-field')?.parentElement;
    return Array.from(row?.querySelectorAll('[role="combobox"]') ?? [])
      .map((item) => item.getAttribute('aria-expanded'));
  });
  expect(expanded).toEqual(['false', 'false']);
}

test.describe('production configuration visual triggers', () => {
  test('collapsed production selectors use UMG-like auto slots instead of fill tracks', async ({ page }) => {
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
      await expectAutoSlotRow(page, recipeSelect);
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
