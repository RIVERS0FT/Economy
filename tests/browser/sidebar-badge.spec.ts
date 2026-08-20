import { expect, test } from '@playwright/test';

test('desktop sidebar omits button badges while preserving accessible reminder counts', async ({ page }) => {
  for (const viewport of [{ width: 1684, height: 931 }, { width: 900, height: 900 }]) {
    await page.setViewportSize(viewport);
    await page.goto('runtime-test.html?view=overview&scenario=many-orders');
    const sidebar = page.locator('.desktop-sidebar');
    const market = sidebar.getByRole('button', { name: '市场，6 笔未完成订单' });
    await expect(market).toBeVisible();
    await expect(sidebar.locator('.navigation-badge')).toHaveCount(0);

    await sidebar.hover();
    await expect(sidebar).toHaveAttribute('data-collapsed', 'false');
    await expect(market.locator('strong')).toBeVisible();
    await expect(sidebar.locator('.navigation-badge')).toHaveCount(0);
  }
});

test('mobile bottom navigation keeps its compact reminder badge while a sheet hides the navigation', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('runtime-test.html?view=overview&scenario=many-orders');
  const navigation = page.locator('.mobile-bottom-navigation');
  await expect(navigation).toHaveAttribute('data-workspace-sheet-hidden', 'true');
  await expect(navigation).toHaveAttribute('aria-hidden', 'true');
  await expect(navigation).toBeHidden();
  const market = navigation.locator('.sidebar-nav-button').filter({ hasText: '市场' }).first();
  await expect(market.locator('.navigation-badge')).toHaveText('6');
});
