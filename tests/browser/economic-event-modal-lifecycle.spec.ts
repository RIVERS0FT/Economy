import { expect, test } from '@playwright/test';

test('Escape closes only the event when a mobile workspace page is already open', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('runtime-test.html?view=map&scenario=economic-events');
  const map = page.getByTestId('us-mainland-map');
  await expect(map).toHaveAttribute('data-map-ready', 'true');
  await page.locator('.province-map-region[data-province-id="US-TX"]').focus();
  await page.keyboard.press('Enter');
  const shell = page.locator('.game-shell');
  const workspace = page.locator('.mobile-workspace-sheet-host');
  await expect(shell).toHaveClass(/strategic-tab-province/);
  await expect(workspace).toBeVisible();
  const camera = await page.locator('.province-map-world-svg').getAttribute('viewBox');

  // The map is shared by every page; its keyboard entry must not replace that page.
  const marker = page.locator('[data-economic-event-marker="fixture-event-0"]');
  await marker.focus();
  await page.keyboard.press('Enter');
  const dialog = page.locator('.economic-event-dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: '关闭事件详情' })).toBeFocused();
  await page.keyboard.press('Escape');

  await expect(dialog).toHaveCount(0);
  await expect(shell).toHaveClass(/strategic-tab-province/);
  await expect(workspace).toBeVisible();
  await expect(marker).toBeFocused();
  await expect(page.locator('.province-map-world-svg')).toHaveAttribute('viewBox', camera!);
});
