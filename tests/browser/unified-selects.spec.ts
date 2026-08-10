import { expect, test } from '@playwright/test';

test('plain SelectInput uses the production rich select interaction', async ({ page }) => {
  await page.goto('runtime-test.html');

  const trigger = page.getByRole('combobox', { name: '状态刷新频率' });
  await expect(trigger).toBeVisible();
  await expect(trigger).toHaveClass(/ui-rich-select__trigger/);
  await expect(trigger).toContainText('每 5s');

  const nativeSelect = page.locator('select.ui-rich-select__native');
  await expect(nativeSelect).toHaveCount(1);
  await expect(nativeSelect).toHaveValue('5');
  await expect(nativeSelect).toHaveAttribute('aria-hidden', 'true');

  await trigger.click();
  const listbox = page.getByRole('listbox', { name: '状态刷新频率' });
  await expect(listbox).toBeVisible();
  await expect(listbox.getByRole('option', { name: '每 5s' })).toHaveAttribute('aria-selected', 'true');

  await listbox.getByRole('option', { name: '每 10s' }).click();
  await expect(trigger).toContainText('每 10s');
  await expect(nativeSelect).toHaveValue('10');

  await trigger.focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Home');
  await page.keyboard.press('Enter');
  await expect(trigger).toContainText('每 3s');
  await expect(nativeSelect).toHaveValue('3');
});

test('open select preserves active option, focus, and scroll across periodic production rerenders', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('runtime-test.html?view=production&scenario=facility-order');

  const trigger = page.getByRole('combobox', { name: '工厂类型' });
  await trigger.click();
  const listbox = page.getByRole('listbox', { name: '工厂类型' });
  await listbox.getByRole('option', { name: '机械厂' }).click();
  await expect(trigger).toContainText('机械厂');

  await trigger.click();
  await page.keyboard.press('Home');
  const activeOption = listbox.locator('[data-active="true"]');
  await expect(activeOption).toHaveAttribute('data-value', 'farm');
  await expect(activeOption.locator('.ui-rich-select__option-label')).toHaveText('农场');
  await expect(trigger).toBeFocused();
  const scrollTopBefore = await listbox.evaluate((element) => element.scrollTop);

  await page.waitForTimeout(1_300);

  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  await expect(trigger).toBeFocused();
  await expect(activeOption).toHaveAttribute('data-value', 'farm');
  await expect(activeOption.locator('.ui-rich-select__option-label')).toHaveText('农场');
  const scrollTopAfter = await listbox.evaluate((element) => element.scrollTop);
  expect(Math.abs(scrollTopAfter - scrollTopBefore)).toBeLessThanOrEqual(1);
});
