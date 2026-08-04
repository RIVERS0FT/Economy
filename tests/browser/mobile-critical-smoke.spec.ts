import { expect, test } from '@playwright/test';

test.describe('mobile critical path', () => {
  test('keeps mobile chrome inside the safe workspace', async ({ page }) => {
    await page.goto('runtime-test.html?view=overview&scenario=activity');
    const status = page.locator('.asset-bar');
    const navigation = page.locator('.mobile-bottom-navigation');
    const workspace = page.locator('.workspace');
    await expect(status).toBeVisible();
    await expect(navigation).toBeVisible();
    await expect(navigation.getByRole('button')).toHaveCount(10);
    const geometry = await page.evaluate(() => {
      const root = document.querySelector<HTMLElement>('.workspace');
      const bar = document.querySelector<HTMLElement>('.asset-bar');
      const nav = document.querySelector<HTMLElement>('.mobile-bottom-navigation');
      if (!root || !bar || !nav) throw new Error('mobile shell fixture is incomplete');
      const rootRect = root.getBoundingClientRect();
      const barRect = bar.getBoundingClientRect();
      const navRect = nav.getBoundingClientRect();
      return {
        pageOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
        statusInside: barRect.left >= rootRect.left && barRect.right <= rootRect.right,
        navigationInside: navRect.left >= rootRect.left && navRect.right <= rootRect.right,
      };
    });
    expect(geometry).toEqual({ pageOverflow: false, statusInside: true, navigationInside: true });
    await expect(workspace).toBeVisible();
  });

  test('opens the production sheet, shared selector and market entry without scroll leakage', async ({ page }) => {
    await page.goto('runtime-test.html?view=production&scenario=production-methods');
    const trigger = page.locator('.facility-cluster-selector-card').first();
    const pageScroll = page.locator('.page-scroll');
    await expect(trigger).toBeVisible();
    await trigger.tap();

    const sheet = page.locator('.facility-detail-sheet');
    await expect(sheet).toBeVisible();
    await expect(pageScroll).toHaveCSS('overflow-y', 'hidden');
    const method = sheet.getByRole('combobox', { name: '机械工厂生产方式' });
    await expect(method).toBeVisible();
    await method.click();
    const listbox = page.getByRole('listbox', { name: '机械工厂生产方式' });
    await expect(listbox).toBeVisible();
    await listbox.getByRole('option', { name: '节约生产' }).click();
    await expect(sheet.getByRole('button', { name: /前往市场交易该工厂/ })).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(sheet).toBeHidden();
    await expect(pageScroll).toHaveCSS('overflow-y', 'auto');
    await expect(trigger).toBeFocused();
  });
});
