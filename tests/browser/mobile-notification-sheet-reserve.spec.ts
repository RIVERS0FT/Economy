import { expect, test } from '@playwright/test';

async function readMobileSheetGeometry(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const status = document.querySelector<HTMLElement>('.asset-bar');
    const sheet = document.querySelector<HTMLElement>('.mobile-workspace-sheet-host');
    const rootStyle = getComputedStyle(document.documentElement);
    if (!status || !sheet) throw new Error('mobile notification reserve fixture is incomplete');
    const statusBox = status.getBoundingClientRect();
    const sheetBox = sheet.getBoundingClientRect();
    return {
      statusBottom: statusBox.bottom,
      sheetTop: sheetBox.top,
      sheetBottom: sheetBox.bottom,
      islandHeight: Number.parseFloat(
        rootStyle.getPropertyValue('--mobile-notification-island-height'),
      ),
    };
  });
}

async function waitForSheetEntryAnimation(page: import('@playwright/test').Page) {
  const sheet = page.locator('.mobile-workspace-sheet-host');
  await expect(sheet).toBeVisible();
  await expect.poll(() => sheet.evaluate((element) => (
    element.getAnimations().every((animation) => animation.playState === 'finished')
  ))).toBe(true);
}

test.describe('mobile notification island sheet reserve', () => {
  test('workspace sheet stays below the notification-island lane even when no island is mounted', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('runtime-test.html?view=overview&scenario=activity');

    await waitForSheetEntryAnimation(page);
    await expect(page.locator('.notification-island')).toHaveCount(0);

    const geometry = await readMobileSheetGeometry(page);
    expect(geometry.islandHeight).toBe(56);
    expect(geometry.sheetBottom).toBeCloseTo(844, 0);
    expect(geometry.sheetTop).toBeGreaterThan(
      geometry.statusBottom + geometry.islandHeight,
    );
  });

  test('opening the notification panel overlays the sheet without changing its reserved top edge', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('runtime-test.html?view=overview&scenario=activity');

    await waitForSheetEntryAnimation(page);
    const before = await readMobileSheetGeometry(page);
    await page.getByRole('button', { name: /^通知，/ }).click();
    const panel = page.getByRole('dialog', { name: '通知' });
    await expect(panel).toBeVisible();
    await expect(page.locator('.notification-island')).toHaveCount(0);

    const after = await readMobileSheetGeometry(page);
    const panelGeometry = await panel.evaluate((element) => {
      const box = element.getBoundingClientRect();
      return { top: box.top, bottom: box.bottom };
    });
    expect(after.sheetTop).toBeCloseTo(before.sheetTop, 0);
    expect(after.sheetBottom).toBeCloseTo(before.sheetBottom, 0);
    expect(panelGeometry.top).toBeLessThan(after.sheetTop);
  });

  test('notification alerts can be disabled per player and stay disabled after reload', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('runtime-test.html?view=overview&scenario=activity');

    await page.getByRole('button', { name: /^通知，/ }).click();
    const panel = page.getByRole('dialog', { name: '通知' });
    await expect(panel).toBeVisible();
    await expect(panel.getByText(/项待处理|当前没有待处理事项/)).toHaveCount(0);

    const disable = panel.getByRole('button', { name: '禁用通知' });
    await expect(disable).toBeVisible();
    await disable.click();
    await expect(panel.getByRole('button', { name: '启用通知' })).toBeVisible();
    await expect(page.locator('.notification-island')).toHaveCount(0);

    const storedPreference = await page.evaluate(() => {
      const key = Object.keys(window.localStorage).find((candidate) => (
        candidate.startsWith('economy:notification-alerts:v1:')
      ));
      return key ? window.localStorage.getItem(key) : null;
    });
    expect(storedPreference).toBe('disabled');

    await page.reload();
    await page.getByRole('button', { name: /^通知，/ }).click();
    await expect(page.getByRole('dialog', { name: '通知' })
      .getByRole('button', { name: '启用通知' })).toBeVisible();
  });
});
