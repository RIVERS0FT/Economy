import { expect, test } from '@playwright/test';

test.describe('shared input modality interaction protocol', () => {
  test.use({
    viewport: { width: 390, height: 844 },
  });

  test('mixed input switches shared surface hover and focus without reload', async ({ page }) => {
    await page.goto('runtime-test.html?view=research&scenario=research-active');

    const trigger = page.getByRole('button', { name: '放大技术树' });
    const detailTrigger = page.getByRole('button', { name: /冶金技术，研发中/ });
    const host = page.locator('.mobile-workspace-sheet-host');
    const basePage = host.locator('.mobile-workspace-sheet-page-layer');
    const detailView = host.locator('.mobile-workspace-sheet-detail-view');
    await page.mouse.move(1, 1);

    await trigger.dispatchEvent('pointerdown', {
      bubbles: true,
      isPrimary: true,
      pointerType: 'mouse',
    });
    await trigger.hover();
    await expect.poll(() => page.evaluate(() => document.documentElement.dataset.inputModality)).toBe('mouse');
    await expect.poll(() => trigger.evaluate((element) => element.matches(':hover'))).toBe(true);

    await detailTrigger.evaluate((element) => {
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
    await expect(host).toHaveAttribute('data-detail-active', 'true');
    await expect(detailView).toBeVisible();
    await expect(basePage).toHaveAttribute('aria-hidden', 'true');
    await expect.poll(() => basePage.evaluate((element) => (element as HTMLElement).inert)).toBe(true);
    await expect.poll(() => page.evaluate(() => document.documentElement.dataset.inputModality)).toBe('touch');

    await page.keyboard.press('Escape');
    await expect(host).toHaveAttribute('data-detail-active', 'false');
    await expect(detailView).toHaveCount(0);
    await expect(basePage).not.toHaveAttribute('aria-hidden', 'true');
    await expect.poll(() => page.evaluate(() => document.documentElement.dataset.inputModality)).toBe('keyboard');
    await expect(detailTrigger).toBeFocused();
  });
});
