import { expect, test } from '@playwright/test';

test.describe('shared input modality interaction protocol', () => {
  test.use({
    viewport: { width: 390, height: 844 },
  });

  test('mixed input switches shared surface hover and focus without reload', async ({ page }) => {
    await page.goto('runtime-test.html?view=production&scenario=activity');

    const trigger = page.getByRole('button', { name: /机械工厂，数量 18，运行中/ });
    const dialog = page.getByRole('dialog', { name: /机械工厂/ });
    await page.mouse.move(1, 1);
    const baseBackground = await trigger.evaluate((element) => getComputedStyle(element).background);

    await page.mouse.click(2, 2);
    await trigger.hover();
    await expect.poll(() => page.evaluate(() => document.documentElement.dataset.inputModality)).toBe('mouse');
    await expect.poll(() => trigger.evaluate((element) => getComputedStyle(element).background))
      .not.toBe(baseBackground);

    await trigger.evaluate((element) => {
      element.dispatchEvent(new PointerEvent('pointerdown', {
        bubbles: true,
        isPrimary: true,
        pointerType: 'touch',
      }));
      element.dispatchEvent(new PointerEvent('pointerup', {
        bubbles: true,
        isPrimary: true,
        pointerType: 'touch',
      }));
      (element as HTMLButtonElement).click();
    });
    await expect(dialog).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.dataset.inputModality)).toBe('touch');
    await expect.poll(() => trigger.evaluate((element) => getComputedStyle(element).background))
      .toBe(baseBackground);

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect.poll(() => page.evaluate(() => document.documentElement.dataset.inputModality)).toBe('keyboard');
    await expect(trigger).toBeFocused();
  });
});
