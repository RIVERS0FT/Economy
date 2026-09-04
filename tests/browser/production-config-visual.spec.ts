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
  expect(geometry.fields).toHaveLength(3);
  for (const field of geometry.fields) {
    expect(field.flexGrow).toBe('0');
    expect(field.flexShrink).toBe('0');
    expect(field.flexBasis).toBe('auto');
  }
  expect(Math.abs(geometry.fields[0].left - geometry.rowLeft)).toBeLessThanOrEqual(1);
  expect(Math.abs((geometry.fields[1].left - geometry.fields[0].right) - geometry.gap)).toBeLessThanOrEqual(1);
  expect(Math.abs((geometry.fields[2].left - geometry.fields[1].right) - geometry.gap)).toBeLessThanOrEqual(1);
  expect(geometry.rowRight - geometry.fields[2].right).toBeGreaterThanOrEqual(0);

  await page.mouse.click(
    geometry.rowRight - 8,
    geometry.rowTop + Math.max(1, geometry.rowHeight / 2),
  );
  const expanded = await trigger.evaluate((element) => {
    const row = element.closest('.ui-form-field')?.parentElement;
    return Array.from(row?.querySelectorAll('[role="combobox"]') ?? [])
      .map((item) => item.getAttribute('aria-expanded'));
  });
  expect(expanded).toEqual(['false', 'false', 'false']);
}

async function expectNoVerticalOverflow(listbox: Locator) {
  await expect(listbox).toBeVisible();
  const geometry = await listbox.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return {
      scrollHeight: element.scrollHeight,
      clientHeight: element.clientHeight,
      overflowY: getComputedStyle(element).overflowY,
      top: rect.top,
      bottom: rect.bottom,
      viewportHeight: document.documentElement.clientHeight,
    };
  });
  expect(geometry.scrollHeight - geometry.clientHeight).toBeLessThanOrEqual(1);
  expect(geometry.overflowY).toBe('hidden');
  expect(geometry.top).toBeGreaterThanOrEqual(0);
  expect(geometry.bottom).toBeLessThanOrEqual(geometry.viewportHeight);
}

test.describe('production configuration visual triggers', () => {
  test('collapsed production selectors use UMG-like auto slots instead of fill tracks', async ({ page }) => {
    for (const viewport of [
      { width: 1440, height: 900 },
      { width: 390, height: 844 },
    ]) {
      await page.setViewportSize(viewport);
      await page.goto('runtime-test.html?view=production&scenario=production-methods');
      await page.locator('.facility-cluster-selector-card').first().click();

      const scope = page.locator('.facility-cluster-detail-card');
      await expect(scope).toBeVisible();
      const workspaceHost = page.locator('.mobile-workspace-sheet-host');
      if (viewport.width <= 720) {
        await expect(workspaceHost).toHaveCount(1);
        await expect(workspaceHost).toHaveAttribute('data-detail-active', 'false');
        await expect(workspaceHost.locator('.mobile-workspace-sheet-detail-view')).toHaveCount(0);
      } else {
        await expect(workspaceHost).toHaveCount(0);
      }
      const recipeSelect = scope.getByRole('combobox', { name: '机械工厂生产产物' });
      const methodSelect = scope.getByRole('combobox', { name: '机械工厂生产方式' });
      const coverageSelect = scope.getByRole('combobox', { name: '机械工厂原料保障' });
      const expectedSize = viewport.width <= 720 ? 48 : 52;

      await expectSquareImageOnlyTrigger(recipeSelect, expectedSize);
      await expectSquareImageOnlyTrigger(methodSelect, expectedSize);
      await expectAutoSlotRow(page, recipeSelect);
      await expect(coverageSelect).toHaveAttribute('data-variant', 'default');
      await expect(recipeSelect.locator('[data-product-artwork="machinery"]')).toHaveCount(1);
      await expect(methodSelect.locator('[data-production-method-icon="precision-machine"]')).toHaveCount(1);

      await recipeSelect.click();
      const recipeListbox = page.getByRole('listbox', { name: '机械工厂生产产物' });
      const recipeOption = recipeListbox.getByRole('option', { name: '机械制造' });
      await expect(recipeOption).toContainText('机械制造');
      await expect(recipeOption).toContainText('投入');
      await expect(recipeOption).toContainText('产出');
      await expect(recipeOption).toContainText('周期 60s');
      await expect(recipeOption).toContainText('成本 12');
      await expectNoVerticalOverflow(recipeListbox);
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
      const currentMethod = methodListbox.getByRole('option', { name: '精密机加' });
      await expect(methodListbox.getByRole('option')).toHaveCount(4);
      await expect(currentMethod).toContainText('周期 60s');
      await expect(currentMethod).toContainText('成本 12');
      await expect(currentMethod).toContainText('产出 ×1');
      await expect(currentMethod).toContainText('投入');
      await expectNoVerticalOverflow(methodListbox);
      await page.keyboard.press('Escape');
    }
  });

  test('crop and work-method menus hide their scrollbar when all options fit', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('runtime-test.html?view=production&scenario=production-crops');
    await page.getByRole('button', { name: /农场，/ }).click();

    const scope = page.locator('.facility-cluster-detail-card');
    const cropSelect = scope.getByRole('combobox', { name: '农场生产产物' });
    const methodSelect = scope.getByRole('combobox', { name: '农场生产方式' });

    await cropSelect.click();
    const cropListbox = page.getByRole('listbox', { name: '农场生产产物' });
    await expect(cropListbox.getByRole('option')).toHaveCount(4);
    await expect(cropListbox).not.toHaveAttribute('data-scrollable', 'true');
    await expectNoVerticalOverflow(cropListbox);
    await page.keyboard.press('Escape');

    await methodSelect.click();
    const methodListbox = page.getByRole('listbox', { name: '农场生产方式' });
    await expect(methodListbox.getByRole('option')).toHaveCount(2);
    await expect(methodListbox).not.toHaveAttribute('data-scrollable', 'true');
    await expectNoVerticalOverflow(methodListbox);
  });
});
