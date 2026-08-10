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
  await page.keyboard.press('Home');
  await page.keyboard.press('Enter');
  await expect(trigger).toContainText('每 3s');
  await expect(nativeSelect).toHaveValue('3');
});
