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

test('mobile bottom navigation may still show its compact reminder badge', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('runtime-test.html?view=overview&scenario=many-orders');
  const market = page.getByRole('navigation', { name: '游戏主导航' })
    .getByRole('button', { name: '市场，6 笔未完成订单' });
  await expect(market.locator('.navigation-badge')).toHaveText('6');
});
