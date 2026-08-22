import { expect, test } from '@playwright/test';

test.describe('desktop sidebar navigation collapse', () => {
  test('hovered navigation survives page changes while browser restore still requires fresh foreground intent', async ({ page }) => {
    await page.setViewportSize({ width: 1684, height: 931 });
    await page.goto('runtime-test.html?view=overview&scenario=empty');

    const sidebar = page.locator('.desktop-sidebar');
    await expect(sidebar).toBeVisible();
    await expect(sidebar).toHaveAttribute('data-collapsed', 'true');

    await sidebar.hover();
    await expect(sidebar).toHaveAttribute('data-collapsed', 'false');
    expect((await sidebar.boundingBox())?.width).toBeCloseTo(224, 0);

    await sidebar.getByRole('button', { name: '设置', exact: true }).click();
    await expect.poll(() => page.evaluate(() => (
      window as Window & { __lastSelectedTab?: string }
    ).__lastSelectedTab)).toBe('settings');

    await expect(sidebar).toHaveAttribute('data-collapsed', 'false');
    await page.waitForTimeout(80);
    await expect(sidebar).toHaveAttribute('data-collapsed', 'false');

    const expandedBox = await sidebar.boundingBox();
    if (!expandedBox) throw new Error('desktop sidebar is missing after navigation');
    await page.mouse.move(expandedBox.x + expandedBox.width + 80, expandedBox.y + 30);
    await expect(sidebar).toHaveAttribute('data-collapsed', 'true');

    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    await expect(sidebar).toHaveAttribute('data-collapsed', 'true');
    await page.waitForTimeout(80);
    await expect(sidebar).toHaveAttribute('data-collapsed', 'true');

    const overviewButton = sidebar.getByRole('button', { name: '概览', exact: true });
    await overviewButton.focus();
    await expect(sidebar).toHaveAttribute('data-collapsed', 'true');

    await page.keyboard.press('Tab');
    await expect(sidebar).toHaveAttribute('data-collapsed', 'false');
  });
});
