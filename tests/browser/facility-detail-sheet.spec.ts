import { expect, test } from '@playwright/test';

test.describe('mobile facility detail sheet close lifecycle', () => {
  test.use({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
  });

  test('backdrop touch closes after every reopen and restores focus and page scrolling', async ({ page }) => {
    await page.goto('runtime-test.html?view=production&scenario=activity');

    const trigger = page.getByRole('button', { name: /机械工厂，数量 18，运行中/ });
    const dialog = page.getByRole('dialog', { name: /机械工厂/ });
    const pageScroll = page.locator('.page-scroll');

    await expect(trigger).toBeVisible();

    for (let iteration = 0; iteration < 3; iteration += 1) {
      await trigger.tap();
      await expect(dialog).toBeVisible();
      await expect(pageScroll).toHaveCSS('overflow-y', 'hidden');

      const sheetBox = await dialog.boundingBox();
      expect(sheetBox).not.toBeNull();
      expect(sheetBox!.y).toBeGreaterThan(8);
      await page.touchscreen.tap(sheetBox!.x + sheetBox!.width / 2, Math.max(8, sheetBox!.y / 2));

      await expect(dialog).toBeHidden();
      await expect(pageScroll).toHaveCSS('overflow-y', 'auto');
      await expect(trigger).toBeFocused();
    }
  });
});
